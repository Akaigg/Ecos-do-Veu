import { monsterById, bossById } from '../data/monsters/index.ts';
import { RECIPES } from '../data/recipes.ts';
import { VISUALS } from '../data/equipment.ts';
import { bossLegendary } from '../data/monsters/index.ts';
import { buildPlayerFighter } from '../game/combat/build.ts';
import { createCombat, resolveRound, submitAction, missingActors, fillAutoActions } from '../game/combat/engine.ts';
import type { CombatContext, CombatState, Fighter, PlayerAction } from '../game/combat/state.ts';
import { Rng, randomSeed } from '../game/rng.ts';
import type { EquipData } from '../game/equipment.ts';
import { addItem, charOwner, countItem, fail, getUnique, ledger, moveItem, updateUnique, type Game, type Owner } from './core.ts';
import {
  activeCombatId, addClassXp, getCharacter, recordBestiary, snapshot, unlock, unlocksOf, type Character,
} from './character.ts';
import { knownModifiers } from './talents.ts';
import { contractProgress } from './contracts.ts';
import { shareDiscovery } from './guild.ts';
import { activePet, tamePet } from './pets.ts';

const escrow = (charId: number): Owner => ({ kind: 'escrow', id: charId });

export interface HeroOptions { line?: 'frente' | 'tras'; hpPct?: number; posture?: 'defender' | 'atacar' }

export function buildHero(g: Game, c: Character, o: HeroOptions = {}): Fighter {
  const { derived, progress } = snapshot(g, c);
  const own = charOwner(c.id);
  // Cinto: os consumíveis ficam reservados durante o combate.
  const belt: { item: string; qty: number }[] = [];
  for (const b of c.belt) {
    const have = countItem(g, own, b.item);
    const q = Math.min(have, b.qty);
    if (q > 0) { moveItem(g, own, escrow(c.id), b.item, q); belt.push({ item: b.item, qty: q }); }
  }
  const pet = activePet(g, c);
  const weapon = g.db.get<{ data: string }>("SELECT data FROM items WHERE owner_kind='char' AND owner_id=? AND slot='arma'", c.id);
  const wd = weapon ? (JSON.parse(weapon.data) as EquipData) : undefined;
  const oil = wd?.oil && wd.oil.fights > 0 ? { elem: wd.oil.elem, bonus: wd.oil.bonus, status: wd.oil.status } : undefined;
  const melee = !derived.weapon || derived.weapon.range === 'corpo';
  const f = buildPlayerFighter({
    characterId: c.id, name: c.name, classId: c.classId, level: progress.level, derived,
    skills: progress.equipped, modifiers: knownModifiers(progress), belt,
    line: o.line ?? (melee ? 'frente' : 'tras'),
    pet: pet ? { id: pet.id, name: pet.name, species: pet.species, affinity: pet.affinity, level: pet.level, assistCd: 0, atk: Math.round(4 + pet.level * 2.2) } : undefined,
    autoPosture: o.posture ?? c.settings.posture ?? 'defender',
    oil,
  });
  if (o.hpPct !== undefined) f.hp = Math.max(1, Math.round(f.maxHp * o.hpPct));
  return f;
}

export interface StartCombatInput {
  members: Character[];
  enemies: { monsterId: string; level?: number; hpMult?: number; atkMult?: number }[];
  context: Omit<CombatContext, 'partySize'>;
  kind: string;
  ref?: string;
  hp?: Record<number, number>;
  lines?: Record<number, 'frente' | 'tras'>;
  channelId?: string;
  deadlineHours?: number;
}

export function startCombat(g: Game, input: StartCombatInput): CombatState {
  return g.db.tx(() => {
    for (const m of input.members) if (activeCombatId(g, m.id)) fail(`${m.name} já está em combate.`);
    const heroes = input.members.map((m) => buildHero(g, m, { hpPct: input.hp?.[m.id], line: input.lines?.[m.id] }));
    const id = `cb${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const st = createCombat({ id, seed: randomSeed(), heroes, enemies: input.enemies, context: { ...input.context, partySize: input.members.length, deadlineHours: input.deadlineHours } });
    const now = g.now();
    const deadline = input.context.mode === 'assincrono' ? now + (input.deadlineHours ?? 12) * 3600_000 : null;
    g.db.run('INSERT INTO combats (id, kind, ref, state, status, channel_id, deadline_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      id, input.kind, input.ref, JSON.stringify(st), 'ativo', input.channelId, deadline, now, now);
    for (const m of input.members) g.db.run('INSERT INTO combat_members (combat_id, character_id) VALUES (?,?)', id, m.id);
    for (const e of st.fighters.filter((f) => f.monsterId)) for (const m of input.members) recordBestiary(g, m.id, e.monsterId!, 0);
    return st;
  });
}

interface CombatRow { id: string; kind: string; ref: string | null; state: string; version: number; status: string; channel_id: string | null; message_id: string | null; deadline_at: number | null }

export function loadCombat(g: Game, id: string): { row: CombatRow; state: CombatState } | undefined {
  const row = g.db.get<CombatRow>('SELECT * FROM combats WHERE id = ?', id);
  return row ? { row, state: JSON.parse(row.state) as CombatState } : undefined;
}

function saveCombat(g: Game, row: CombatRow, st: CombatState) {
  const r = g.db.run('UPDATE combats SET state = ?, version = version + 1, updated_at = ?, status = ? WHERE id = ? AND version = ?',
    JSON.stringify(st), g.now(), st.outcome ? 'encerrado' : 'ativo', row.id, row.version);
  if (!r.changes) fail('O combate foi atualizado por outra ação. Tente novamente.');
}

export function setCombatMessage(g: Game, id: string, channelId: string, messageId: string) {
  g.db.run('UPDATE combats SET channel_id = ?, message_id = ? WHERE id = ?', channelId, messageId, id);
}

export interface ActResult { state: CombatState; resolved: boolean; log: string[]; settlement?: CombatSettlement; kind: string; ref: string | null }

/** Registra a ação de um jogador. Em combate solo, resolve a rodada na hora; em grupo, quando todos agirem. */
export function act(g: Game, c: Character, combatId: string, action: PlayerAction): ActResult {
  return g.db.tx(() => {
    const loaded = loadCombat(g, combatId) ?? fail('Combate não encontrado.');
    const { row, state } = loaded!;
    if (row.status !== 'ativo' || state.outcome) fail('Esse combate já terminou.');
    const fid = `p${c.id}`;
    if (!state.fighters.some((f) => f.id === fid)) fail('Você não participa deste combate.');
    const err = submitAction(state, fid, action);
    if (err) fail(err);
    let resolved = false;
    let log: string[] = [];
    if (missingActors(state).length === 0) { log = resolveRound(state); resolved = true; }
    let settlement: CombatSettlement | undefined;
    if (state.outcome) settlement = settleCombat(g, state, row);
    saveCombat(g, row, state);
    if (state.outcome) g.db.run("UPDATE combats SET status = 'encerrado' WHERE id = ?", row.id);
    return { state, resolved, log, settlement, kind: row.kind, ref: row.ref };
  });
}

/** Prazo do modo assíncrono: ausentes usam a postura automática. */
export function forceResolve(g: Game, combatId: string): ActResult | null {
  return g.db.tx(() => {
    const loaded = loadCombat(g, combatId);
    if (!loaded || loaded.row.status !== 'ativo') return null;
    const { row, state } = loaded;
    fillAutoActions(state);
    const log = resolveRound(state);
    let settlement: CombatSettlement | undefined;
    if (state.outcome) settlement = settleCombat(g, state, row);
    saveCombat(g, row, state);
    if (row.deadline_at && !state.outcome) g.db.run('UPDATE combats SET deadline_at = ? WHERE id = ?', g.now() + (state.context.deadlineHours ?? 12) * 3600_000, row.id);
    return { state, resolved: true, log, settlement, kind: row.kind, ref: row.ref };
  });
}

export function abandonCombat(g: Game, c: Character, combatId: string) {
  return g.db.tx(() => {
    const loaded = loadCombat(g, combatId) ?? fail('Combate não encontrado.');
    const { row, state } = loaded!;
    if (state.context.partySize > 1) fail('Em grupo, use a postura automática ou aguarde o prazo.');
    state.outcome = 'derrota';
    state.log = ['🏳️ Você recua do combate.'];
    const s = settleCombat(g, state, row);
    saveCombat(g, row, state);
    return { state, settlement: s, kind: row.kind, ref: row.ref };
  });
}

export interface MemberLoot { characterId: number; items: Record<string, number>; xp: number; levels: number; level: number; hpPct: number; tamed: string[]; firstBoss?: string }
export interface CombatSettlement { outcome: CombatState['outcome']; members: MemberLoot[] }

/**
 * Encerramento: experiência, saque individual, bestiário, pets domados, desgaste e devolução do cinto.
 * O destino dos itens (mochila de expedição, campanha ou inventário) é decidido por quem iniciou o combate.
 */
function settleCombat(g: Game, st: CombatState, row: CombatRow): CombatSettlement {
  const heroes = st.fighters.filter((f) => f.kind === 'jogador');
  const party = heroes.length;
  const r = new Rng(st.seed ^ 0x5bd1e995);
  const out: CombatSettlement = { outcome: st.outcome, members: [] };
  const killedIds = st.kills.map((k) => k.monsterId);
  const totalXp = st.fighters.filter((f) => f.kind === 'monstro' && !f.alive && killedIds.includes(f.monsterId!) && !st.tamed.some((t) => t.monsterId === f.monsterId && false))
    .reduce((s, f) => s + (f.xp ?? 0), 0);
  for (const h of heroes) {
    const charId = Number(h.ref);
    const c = getCharacter(g, charId);
    if (!c) continue;
    const loot: MemberLoot = { characterId: charId, items: {}, xp: 0, levels: 0, level: 0, hpPct: h.alive ? h.hp / h.maxHp : 0, tamed: [] };
    // Cinto: devolve o que sobrou; o consumido sai da reserva
    for (const b of h.belt ?? []) if (b.qty > 0) moveItem(g, escrow(charId), charOwner(charId), b.item, b.qty);
    for (const [k, q] of Object.entries(st.consumed[h.ref] ?? {})) ledger(g, charId, 'consumo_combate', 0, k, -q, `combat:${row.id}`);
    g.db.run("DELETE FROM items WHERE owner_kind = 'escrow' AND owner_id = ? AND data IS NULL", charId);
    if (st.outcome === 'vitoria') {
      loot.xp = Math.round((totalXp / party) * (1 + 0.2 * (party - 1)));
      const lv = addClassXp(g, c, loot.xp);
      loot.levels = lv.levels; loot.level = lv.level;
      for (const k of st.kills) {
        const def = monsterById.get(k.monsterId);
        if (!def) continue;
        for (const d of def.drops) {
          if (!r.chance(d.chance)) continue;
          const q = r.int(d.min, d.max);
          loot.items[d.item] = (loot.items[d.item] ?? 0) + q;
        }
      }
      if (loot.hpPct <= 0) loot.hpPct = 0.1;
    }
    // Bestiário e contratos
    const killsBy: Record<string, number> = {};
    for (const k of st.kills) killsBy[k.monsterId] = (killsBy[k.monsterId] ?? 0) + 1;
    for (const [mid, n] of Object.entries(killsBy)) {
      recordBestiary(g, charId, mid, n);
      const def = monsterById.get(mid)!;
      contractProgress(g, charId, { t: 'abate', family: def.family, region: def.region, rank: def.rank, count: n });
      const kills = g.db.get<{ kills: number }>('SELECT kills FROM bestiary WHERE character_id = ? AND monster_id = ?', charId, mid)?.kills ?? 0;
      if (kills >= 10) shareDiscovery(g, charId, mid);
    }
    for (const a of st.revealed.filter((x) => x.ownerId === String(charId))) {
      g.db.run('UPDATE bestiary SET analyzed = 1 WHERE character_id = ? AND monster_id = ?', charId, a.monsterId);
      shareDiscovery(g, charId, a.monsterId);
    }
    // Pets domados
    for (const t of st.tamed.filter((x) => x.ownerId === String(charId))) {
      const pet = tamePet(g, c, t.monsterId, t.level);
      loot.tamed.push(pet ? pet.name : `${monsterById.get(t.monsterId)?.name} (estábulo cheio — fugiu)`);
      contractProgress(g, charId, { t: 'doma' });
    }
    // Chefes: primeira vitória libera receitas, visuais e títulos
    if (st.outcome === 'vitoria') for (const mid of Object.keys(killsBy)) {
      if (!bossById.has(mid)) continue;
      if (unlock(g, charId, 'chefe', mid)) {
        loot.firstBoss = mid;
        const leg = bossLegendary.get(mid);
        if (leg) unlock(g, charId, 'receita', `lendario:${leg}`);
        for (const rec of RECIPES.filter((x) => x.unlock === `chefe:${mid}`)) unlock(g, charId, 'receita', rec.id);
        for (const v of VISUALS.filter((x) => x.unlock === `chefe:${mid}`)) unlock(g, charId, 'visual', v.id);
        if (unlocksOf(g, charId, 'chefe').length >= 5) unlock(g, charId, 'titulo', 'cacador-chefes');
      }
    }
    // Desgaste dos equipamentos (derrota desgasta mais) e óleo de arma
    const eq = g.db.all<{ id: number; slot: string }>("SELECT id, slot FROM items WHERE owner_kind='char' AND owner_id=? AND slot IS NOT NULL", charId);
    for (const e of eq) {
      const it = getUnique(g, e.id);
      if (!it) continue;
      const d = it.equip;
      const wear = st.outcome === 'derrota' ? Math.ceil(d.maxDurability * 0.1) : 1;
      d.durability = Math.max(0, d.durability - wear);
      if (e.slot === 'arma' && d.oil && d.oil.fights > 0) { d.oil.fights--; if (d.oil.fights <= 0) d.oil = undefined; }
      updateUnique(g, e.id, d);
    }
    // Pet ativo ganha experiência junto
    const pet = activePet(g, c);
    if (pet && st.outcome === 'vitoria') g.db.run('UPDATE pets SET xp = xp + ? WHERE id = ?', Math.round(loot.xp * 0.3), pet.id);
    out.members.push(loot);
    ledger(g, charId, 'combate', 0, undefined, undefined, `combat:${row.id}`, { outcome: st.outcome, xp: loot.xp, items: loot.items });
  }
  return out;
}

/** Entrega o saque diretamente no inventário (chefes e treinos). */
export function deliverLoot(g: Game, s: CombatSettlement) {
  for (const m of s.members) for (const [k, q] of Object.entries(m.items)) addItem(g, charOwner(m.characterId), k, q);
}
