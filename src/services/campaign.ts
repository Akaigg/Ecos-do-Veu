import { campaignById, CAMPAIGN_MAX_PLAYERS, type CampaignDef, type CampaignNode } from '../data/campaigns.ts';
import { bossById, monsterById } from '../data/monsters/index.ts';
import { originById } from '../data/races.ts';
import { itemById } from '../data/items.ts';
import { json } from '../db/database.ts';
import { Rng, randomSeed } from '../game/rng.ts';
import { addItem, charOwner, fail, ledger, removeItem, HOUR, type Game } from './core.ts';
import {
  activeCombatId, activeFieldActivity, activeProgress, addRep, changeGold, getCharacter, snapshot, saveCharacterJson, unlock, type Character,
} from './character.ts';
import { startCombat, type CombatSettlement } from './combat.ts';
import { contractProgress } from './contracts.ts';
import { partyOf, partyCharacters } from './party.ts';

export interface RunState {
  loot: Record<number, Record<string, number>>;
  gold: Record<number, number>;
  hp: Record<number, number>;
  lastCamp: [number, number];
  log: string[];
  postures: Record<number, 'defender' | 'atacar'>;
}
export interface Run {
  id: number; campaignId: string; partyId: number | null; members: number[]; chapter: number; node: number; flags: string[];
  votes: Record<string, Record<string, string>>; status: 'ativa' | 'pausada' | 'concluida' | 'abandonada'; mode: 'ao_vivo' | 'assincrono';
  deadlineHours: number; deadlineAt: number | null; combatId: string | null; channelId: string | null; state: RunState;
}
interface RunRow { id: number; campaign_id: string; party_id: number | null; members: string; chapter: number; node: number; flags: string; votes: string; status: string; mode: string; deadline_hours: number; deadline_at: number | null; combat_id: string | null; channel_id: string | null; loot: string }

const toRun = (r: RunRow): Run => ({
  id: r.id, campaignId: r.campaign_id, partyId: r.party_id, members: json(r.members, []), chapter: r.chapter, node: r.node, flags: json(r.flags, []),
  votes: json(r.votes, {}), status: r.status as Run['status'], mode: r.mode as Run['mode'], deadlineHours: r.deadline_hours, deadlineAt: r.deadline_at,
  combatId: r.combat_id, channelId: r.channel_id, state: json(r.loot, { loot: {}, gold: {}, hp: {}, lastCamp: [0, 0], log: [], postures: {} }),
});

export function getRun(g: Game, id: number): Run | undefined {
  const r = g.db.get<RunRow>('SELECT * FROM campaign_runs WHERE id = ?', id);
  return r ? toRun(r) : undefined;
}
export function runOf(g: Game, charId: number): Run | undefined {
  const rows = g.db.all<RunRow>("SELECT * FROM campaign_runs WHERE status IN ('ativa','pausada') ORDER BY id DESC");
  const r = rows.find((x) => (json<number[]>(x.members, [])).includes(charId));
  return r ? toRun(r) : undefined;
}
function saveRun(g: Game, run: Run) {
  g.db.run(`UPDATE campaign_runs SET members=?, chapter=?, node=?, flags=?, votes=?, status=?, mode=?, deadline_at=?, combat_id=?, channel_id=?, loot=?, updated_at=? WHERE id=?`,
    JSON.stringify(run.members), run.chapter, run.node, JSON.stringify(run.flags), JSON.stringify(run.votes), run.status, run.mode, run.deadlineAt,
    run.combatId, run.channelId, JSON.stringify(run.state), g.now(), run.id);
}

function historyFlags(g: Game, run: Run): string[] {
  const out = new Set<string>();
  for (const id of run.members) for (const f of getCharacter(g, id)?.history ?? []) out.add(`hist:${f}`);
  return [...out];
}

function nodeValid(g: Game, run: Run, n: CampaignNode): boolean {
  const flags = new Set([...run.flags, ...historyFlags(g, run)]);
  if (n.requires && !flags.has(n.requires)) return false;
  if (n.unless && flags.has(n.unless)) return false;
  return true;
}

/** Avança o ponteiro até o próximo nó válido. Retorna o nó atual ou null quando a campanha termina. */
export function currentNode(g: Game, run: Run): { def: CampaignDef; chapter: number; node: CampaignNode } | null {
  const def = campaignById.get(run.campaignId)!;
  while (run.chapter < def.chapters.length) {
    const ch = def.chapters[run.chapter];
    while (run.node < ch.nodes.length) {
      const n = ch.nodes[run.node];
      if (nodeValid(g, run, n)) return { def, chapter: run.chapter, node: n };
      run.node++;
    }
    run.chapter++;
    run.node = 0;
  }
  return null;
}

function setCampActivity(g: Game, run: Run, atCamp: boolean) {
  for (const id of run.members) g.db.run("UPDATE activities SET state = ? WHERE character_id = ? AND kind = 'campanha' AND status = 'ativa'", JSON.stringify({ runId: run.id, atCamp }), id);
}

export function startCampaign(g: Game, leader: Character, campaignId: string, channelId?: string): Run {
  return g.db.tx(() => {
    const def = campaignById.get(campaignId) ?? fail('Campanha desconhecida.');
    const party = partyOf(g, leader.id);
    const members = party ? partyCharacters(g, party) : [leader];
    if (party && party.leaderId !== leader.id) fail('Só quem lidera o grupo inicia a campanha.');
    if (members.length > CAMPAIGN_MAX_PLAYERS) fail(`No máximo ${CAMPAIGN_MAX_PLAYERS} participantes.`);
    if (def!.requiresExactly && members.length !== def!.requiresExactly) fail(`Este desafio especial exige exatamente ${def!.requiresExactly} participantes.`);
    for (const m of members) {
      const lv = activeProgress(g, m).level;
      if (lv < def!.minLevel) fail(`${m.name} precisa de nível ${def!.minLevel}.`);
      if (m.region !== def!.region) fail(`Todos precisam estar na região da campanha (${def!.region}). ${m.name} não está.`);
      if (activeCombatId(g, m.id) || activeFieldActivity(g, m.id)) fail(`${m.name} está ocupado com outra atividade.`);
      if (runOf(g, m.id)) fail(`${m.name} já está vinculado a outra campanha.`);
    }
    const now = g.now();
    const state: RunState = { loot: {}, gold: {}, hp: Object.fromEntries(members.map((m) => [m.id, 1])), lastCamp: [0, 0], log: [], postures: Object.fromEntries((party?.members ?? []).map((m) => [m.id, m.posture])) };
    const id = g.db.run(`INSERT INTO campaign_runs (campaign_id, party_id, members, status, mode, deadline_hours, channel_id, loot, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      def!.id, party?.id ?? null, JSON.stringify(members.map((m) => m.id)), 'ativa', party?.mode ?? 'ao_vivo', party?.deadlineHours ?? 12, channelId, JSON.stringify(state), now, now).lastInsertRowid;
    for (const m of members) {
      g.db.run(`INSERT INTO activities (character_id, kind, status, params, state, seed, started_at, ends_at) VALUES (?,?,?,?,?,?,?,?)`,
        m.id, 'campanha', 'ativa', JSON.stringify({ runId: id }), JSON.stringify({ runId: id, atCamp: false }), randomSeed(), now, now + 30 * 24 * HOUR);
    }
    const run = getRun(g, id)!;
    run.state.log.push(`📜 **${def!.name}** começa com ${members.map((m) => m.name).join(', ')}.`);
    saveRun(g, run);
    return run;
  });
}

export interface AdvanceResult { run: Run; text: string[]; combatId?: string; awaitingVote?: boolean; completed?: boolean }

/** Botão "Continuar": resolve nós automáticos ou inicia combates. Escolhas aguardam votos. */
export function advanceCampaign(g: Game, c: Character, runId: number): AdvanceResult {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (!run!.members.includes(c.id)) fail('Você não participa desta campanha.');
    if (run!.status === 'pausada') fail('A campanha está pausada. Use `/campanha retomar`.');
    if (run!.status !== 'ativa') fail('Essa campanha já terminou.');
    if (run!.combatId) fail('Há um combate em andamento.');
    return processNode(g, run!);
  });
}

function processNode(g: Game, run: Run): AdvanceResult {
  const text: string[] = [];
  const cur = currentNode(g, run);
  if (!cur) return complete(g, run, text);
  const n = cur.node;
  const members = run.members.map((id) => getCharacter(g, id)!);
  setCampActivity(g, run, false);
  switch (n.t) {
    case 'narrativa':
      text.push(`📖 ${n.text}`);
      run.node++;
      break;
    case 'acampamento': {
      text.push(`🏕️ **Ponto seguro.** ${n.text}`);
      secureLoot(g, run, members);
      run.state.hp = Object.fromEntries(members.map((m) => [m.id, 1]));
      run.node++;
      run.state.lastCamp = [run.chapter, run.node];
      text.push('Vida restaurada e saques guardados. Aqui é possível trocar conjuntos de habilidades, pausar (`/campanha pausar`) ou substituir participantes.');
      setCampActivity(g, run, true);
      break;
    }
    case 'recompensa':
      text.push(`🎁 ${n.text}`);
      for (const m of members) {
        for (const [k, q] of n.items) addLoot(run, m.id, k, q);
        run.state.gold[m.id] = (run.state.gold[m.id] ?? 0) + n.gold;
      }
      text.push(`Cada participante recebe ${n.items.map(([k, q]) => `${q}× ${itemById.get(k)?.name}`).join(', ')}${n.gold ? ` e ${n.gold} de ouro` : ''}.`);
      run.node++;
      break;
    case 'teste': {
      const r = new Rng(`${run.id}:${run.chapter}:${run.node}`);
      let best = members[0], bv = -1;
      for (const m of members) { const v = snapshot(g, m).derived.attrs[n.attr]; if (v > bv) { bv = v; best = m; } }
      const roll = r.int(1, 20);
      const total = roll + Math.floor(bv / 2);
      text.push(`🎲 ${n.text}\n${best.name} tenta (${n.attr}): ${roll} + ${Math.floor(bv / 2)} = **${total}** contra ${n.dc}.`);
      if (total >= n.dc) {
        text.push(`✅ ${n.success.text}`);
        if (n.success.flag) run.flags.push(n.success.flag);
        for (const m of members) for (const [k, q] of n.success.items ?? []) addLoot(run, m.id, k, q);
      } else {
        text.push(`❌ ${n.fail.text}`);
        if (n.fail.flag) run.flags.push(n.fail.flag);
        if (n.fail.damagePct) for (const m of members) run.state.hp[m.id] = Math.max(0.1, (run.state.hp[m.id] ?? 1) - n.fail.damagePct);
      }
      run.node++;
      break;
    }
    case 'escolha': {
      text.push(`🔀 ${n.text}`);
      const key = `${run.chapter}:${run.node}`;
      run.votes[key] = run.votes[key] ?? {};
      if (run.mode === 'assincrono' && !run.deadlineAt) run.deadlineAt = g.now() + run.deadlineHours * HOUR;
      saveRun(g, run);
      return { run, text, awaitingVote: true };
    }
    case 'combate':
    case 'chefe': {
      const avgLevel = Math.round(members.reduce((s, m) => s + activeProgress(g, m).level, 0) / members.length);
      let enemies: { monsterId: string; level?: number; hpMult?: number; atkMult?: number }[];
      if (n.t === 'combate') {
        enemies = n.enemies.map((id) => {
          const def = monsterById.get(id)!;
          return { monsterId: id, level: def.rank === 'comum' ? Math.max(def.level, Math.min(def.level + 4, avgLevel)) : undefined };
        });
        // Conteúdo comum se adapta ao número de participantes.
        if (members.length >= 3) enemies.push({ monsterId: n.enemies[0], level: enemies[0].level });
        text.push(`⚔️ ${n.text}`);
      } else {
        const boss = bossById.get(n.boss)!;
        let hpMult = 1, atkMult = 1;
        const flags = new Set([...run.flags, ...historyFlags(g, run)]);
        for (const w of n.weakenedBy ?? []) if (flags.has(w.flag)) { hpMult -= w.hpPct; text.push(`🔻 ${w.text}`); }
        for (const e of n.empoweredBy ?? []) if (flags.has(e.flag)) { atkMult += e.atkPct; text.push(`🔺 ${e.text}`); }
        enemies = [{ monsterId: boss.id, hpMult: Math.max(0.5, hpMult), atkMult }, ...(n.withAdds ?? []).map((a) => ({ monsterId: a }))];
        text.push(`👑 ${n.text}`);
      }
      const cb = startCombat(g, {
        members, enemies, kind: 'campanha', ref: `run:${run.id}`, hp: run.state.hp, channelId: run.channelId ?? undefined,
        context: { kind: n.t === 'chefe' ? 'chefe' : 'campanha', region: cur.def.region, mode: members.length === 1 ? 'solo' : run.mode, canFlee: false, flags: run.flags },
        deadlineHours: run.deadlineHours,
      });
      for (const m of members) {
        const f = cb.fighters.find((x) => x.id === `p${m.id}`);
        if (f && run.state.postures[m.id]) f.autoPosture = run.state.postures[m.id];
      }
      g.db.run('UPDATE combats SET state = ? WHERE id = ?', JSON.stringify(cb), cb.id);
      run.combatId = cb.id;
      saveRun(g, run);
      return { run, text, combatId: cb.id };
    }
  }
  run.state.log = [...run.state.log, ...text].slice(-15);
  saveRun(g, run);
  const next = currentNode(g, run);
  if (!next) return complete(g, run, text);
  saveRun(g, run);
  return { run, text };
}

function addLoot(run: Run, charId: number, k: string, q: number) {
  run.state.loot[charId] = run.state.loot[charId] ?? {};
  run.state.loot[charId][k] = (run.state.loot[charId][k] ?? 0) + q;
}

function secureLoot(g: Game, run: Run, members: Character[]) {
  for (const m of members) {
    for (const [k, q] of Object.entries(run.state.loot[m.id] ?? {})) if (q > 0) addItem(g, charOwner(m.id), k, q);
    if (run.state.gold[m.id]) changeGold(g, m.id, run.state.gold[m.id], 'campanha', `run:${run.id}`);
  }
  run.state.loot = {};
  run.state.gold = {};
}

export function vote(g: Game, c: Character, runId: number, optionId: string): AdvanceResult {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (!run!.members.includes(c.id)) fail('Você não participa desta campanha.');
    const cur = currentNode(g, run!);
    if (!cur || cur.node.t !== 'escolha') fail('Não há escolha em aberto.');
    const node = cur!.node as Extract<CampaignNode, { t: 'escolha' }>;
    if (!node.options.some((o) => o.id === optionId)) fail('Opção inválida.');
    const key = `${run!.chapter}:${run!.node}`;
    run!.votes[key] = run!.votes[key] ?? {};
    run!.votes[key][String(c.id)] = optionId;
    if (Object.keys(run!.votes[key]).length >= run!.members.length) return resolveVote(g, run!);
    saveRun(g, run!);
    return { run: run!, text: [`🗳️ ${c.name} votou. Aguardando ${run!.members.length - Object.keys(run!.votes[key]).length} voto(s).`], awaitingVote: true };
  });
}

/** Maioria vence; empate fica com quem lidera. No assíncrono, o prazo decide com os votos recebidos. */
export function resolveVote(g: Game, run: Run): AdvanceResult {
  const cur = currentNode(g, run);
  if (!cur || cur.node.t !== 'escolha') return { run, text: [] };
  const node = cur.node;
  const key = `${run.chapter}:${run.node}`;
  const votes = run.votes[key] ?? {};
  const tally: Record<string, number> = {};
  for (const v of Object.values(votes)) tally[v] = (tally[v] ?? 0) + 1;
  const leaderVote = votes[String(run.members[0])];
  let winner = node.options[0].id;
  let best = -1;
  for (const o of node.options) {
    const t = (tally[o.id] ?? 0) + (o.id === leaderVote ? 0.5 : 0);
    if (t > best) { best = t; winner = o.id; }
  }
  const opt = node.options.find((o) => o.id === winner)!;
  run.flags.push(opt.flag);
  const text = [`🗳️ Decisão: **${opt.label}**.`];
  if (opt.originBonus) {
    const helper = run.members.map((id) => getCharacter(g, id)!).find((m) => originById.get(m.origin)?.tag === opt.originBonus);
    if (helper) { run.flags.push(`bonus:${opt.flag}`); text.push(`✨ A origem de ${helper.name} ajuda nesta escolha.`); }
  }
  run.node++;
  run.deadlineAt = null;
  saveRun(g, run);
  const more = processNodeIfAuto(g, run);
  return { ...more, text: [...text, ...more.text] };
}

function processNodeIfAuto(g: Game, run: Run): AdvanceResult {
  const cur = currentNode(g, run);
  if (!cur) return complete(g, run, []);
  saveRun(g, run);
  return { run, text: [] };
}

/** Chamado quando um combate de campanha termina. */
export function onCampaignCombat(g: Game, runId: number, s: CombatSettlement): AdvanceResult | null {
  return g.db.tx(() => {
    const run = getRun(g, runId);
    if (!run || run.status !== 'ativa') return null;
    run.combatId = null;
    const text: string[] = [];
    if (s.outcome === 'vitoria') {
      for (const m of s.members) {
        for (const [k, q] of Object.entries(m.items)) addLoot(run, m.characterId, k, q);
        run.state.hp[m.characterId] = Math.max(0.15, m.hpPct);
      }
      text.push('🏆 Vitória! Os saques individuais ficam com cada participante e serão guardados no próximo ponto seguro.');
      run.node++;
      saveRun(g, run);
      const next = currentNode(g, run);
      if (!next) return complete(g, run, text);
      return { run, text };
    }
    // Derrota: volta ao último ponto seguro e perde o progresso da expedição desde lá.
    run.state.loot = {};
    run.state.gold = {};
    [run.chapter, run.node] = run.state.lastCamp;
    run.state.hp = Object.fromEntries(run.members.map((id) => [id, 1]));
    text.push('💀 O grupo foi derrotado e recua até o último ponto seguro. Os saques desde o acampamento se perderam; equipamentos permanentes continuam com vocês.');
    saveRun(g, run);
    setCampActivity(g, run, true);
    return { run, text };
  });
}

function complete(g: Game, run: Run, text: string[]): AdvanceResult {
  const def = campaignById.get(run.campaignId)!;
  const members = run.members.map((id) => getCharacter(g, id)!);
  secureLoot(g, run, members);
  for (const m of members) {
    addRep(g, m.id, def.reputation[0], def.reputation[1]);
    // Proteção contra azar: cada conclusão gera um fragmento da recompensa especial.
    g.db.run(`INSERT INTO fragments (character_id, key, count) VALUES (?,?,1) ON CONFLICT(character_id, key) DO UPDATE SET count = count + 1`, m.id, def.fragmentReward.key);
    const hist = new Set(m.history);
    for (const f of run.flags) hist.add(f);
    hist.add(`concluiu:${def.id}`);
    m.history = [...hist];
    saveCharacterJson(g, m, 'history');
    contractProgress(g, m.id, { t: 'campanha' });
    if (def.id === 'ultimo-rasgo') unlock(g, m.id, 'titulo', 'fechador-veu');
    g.db.run("UPDATE activities SET status = 'concluida', resolved_at = ? WHERE character_id = ? AND kind = 'campanha' AND status = 'ativa'", g.now(), m.id);
    ledger(g, m.id, 'campanha_concluida', 0, undefined, undefined, `run:${run.id}`, { flags: run.flags });
  }
  run.status = 'concluida';
  saveRun(g, run);
  text.push(`🎉 **${def.name} concluída!** +${def.reputation[1]} de reputação e 1 fragmento de ${def.fragmentReward.label} para cada participante.`);
  return { run, text, completed: true };
}

export function pauseCampaign(g: Game, c: Character, runId: number) {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (run!.members[0] !== c.id) fail('Só quem lidera pode pausar.');
    if (run!.combatId) fail('Não é possível pausar durante um combate.');
    const atCamp = run!.chapter === run!.state.lastCamp[0] && run!.node === run!.state.lastCamp[1];
    if (!atCamp) fail('A campanha só pode ser pausada em um acampamento.');
    run!.status = 'pausada';
    saveRun(g, run!);
    for (const id of run!.members) g.db.run("UPDATE activities SET status = 'concluida', resolved_at = ? WHERE character_id = ? AND kind = 'campanha' AND status = 'ativa'", g.now(), id);
    return run!;
  });
}

export function resumeCampaign(g: Game, c: Character, runId: number) {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (run!.status !== 'pausada') fail('A campanha não está pausada.');
    if (run!.members[0] !== c.id) fail('Só quem lidera pode retomar.');
    for (const id of run!.members) {
      if (activeCombatId(g, id) || activeFieldActivity(g, id)) fail(`${getCharacter(g, id)?.name} está ocupado agora.`);
      g.db.run(`INSERT INTO activities (character_id, kind, status, params, state, seed, started_at, ends_at) VALUES (?,?,?,?,?,?,?,?)`,
        id, 'campanha', 'ativa', JSON.stringify({ runId: run!.id }), JSON.stringify({ runId: run!.id, atCamp: true }), randomSeed(), g.now(), g.now() + 30 * 24 * HOUR);
    }
    run!.status = 'ativa';
    saveRun(g, run!);
    return run!;
  });
}

/** Substituição de participante permitida apenas em pontos seguros. */
export function substitute(g: Game, c: Character, runId: number, outId: number, incoming: Character) {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (run!.members[0] !== c.id) fail('Só quem lidera pode substituir participantes.');
    const atCamp = run!.chapter === run!.state.lastCamp[0] && run!.node === run!.state.lastCamp[1];
    if (!atCamp && run!.status !== 'pausada') fail('Substituições só em acampamentos.');
    if (!run!.members.includes(outId)) fail('Essa pessoa não está na campanha.');
    if (run!.members.includes(incoming.id)) fail('Essa pessoa já está na campanha.');
    const def = campaignById.get(run!.campaignId)!;
    if (activeProgress(g, incoming).level < def.minLevel) fail(`${incoming.name} precisa de nível ${def.minLevel}.`);
    if (runOf(g, incoming.id) || activeFieldActivity(g, incoming.id)) fail(`${incoming.name} está ocupado.`);
    run!.members = run!.members.map((id) => (id === outId ? incoming.id : id));
    run!.state.hp[incoming.id] = 1;
    g.db.run("UPDATE activities SET status = 'concluida', resolved_at = ? WHERE character_id = ? AND kind = 'campanha' AND status = 'ativa'", g.now(), outId);
    if (run!.status === 'ativa') g.db.run(`INSERT INTO activities (character_id, kind, status, params, state, seed, started_at, ends_at) VALUES (?,?,?,?,?,?,?,?)`,
      incoming.id, 'campanha', 'ativa', JSON.stringify({ runId: run!.id }), JSON.stringify({ runId: run!.id, atCamp: true }), randomSeed(), g.now(), g.now() + 30 * 24 * HOUR);
    saveRun(g, run!);
    return run!;
  });
}

export function abandonCampaign(g: Game, c: Character, runId: number) {
  return g.db.tx(() => {
    const run = getRun(g, runId) ?? fail('Campanha não encontrada.');
    if (run!.members[0] !== c.id) fail('Só quem lidera pode abandonar a campanha.');
    if (run!.combatId) fail('Termine o combate primeiro.');
    run!.status = 'abandonada';
    saveRun(g, run!);
    for (const id of run!.members) g.db.run("UPDATE activities SET status = 'concluida', resolved_at = ? WHERE character_id = ? AND kind = 'campanha' AND status = 'ativa'", g.now(), id);
  });
}

export function fragments(g: Game, charId: number) {
  return g.db.all<{ key: string; count: number }>('SELECT key, count FROM fragments WHERE character_id = ? AND count > 0', charId);
}

export function redeemFragments(g: Game, c: Character, key: string) {
  return g.db.tx(() => {
    const def = [...campaignById.values()].find((x) => x.fragmentReward.key === key) ?? fail('Fragmento desconhecido.');
    const have = g.db.get<{ count: number }>('SELECT count FROM fragments WHERE character_id = ? AND key = ?', c.id, key)?.count ?? 0;
    if (have < def!.fragmentReward.needed) fail(`Você tem ${have}/${def!.fragmentReward.needed} fragmentos.`);
    g.db.run('UPDATE fragments SET count = count - ? WHERE character_id = ? AND key = ?', def!.fragmentReward.needed, c.id, key);
    addItem(g, charOwner(c.id), key, 1);
    return def!.fragmentReward.label;
  });
}

export function dueVotes(g: Game): number[] {
  return g.db.all<{ id: number }>("SELECT id FROM campaign_runs WHERE status = 'ativa' AND deadline_at IS NOT NULL AND deadline_at <= ?", g.now()).map((r) => r.id);
}

export { removeItem };
