import { regionById, WORK_LOCATIONS, WEATHER_LABEL, type RegionDef } from '../data/regions.ts';
import { COMMONS, VARIANTS, BOSSES, tierOfLevel } from '../data/monsters/index.ts';
import { EVENT_INFO, PATH_NAMES, CHECKS, EXPLORATION_STEPS, DEFEAT_LOSS, RARE_DISCOVERIES, type ExploreEventKind } from '../data/exploration.ts';
import { raceById } from '../data/races.ts';
import { itemById, RUNE_TYPES } from '../data/items.ts';
import { json } from '../db/database.ts';
import { Rng, randomSeed, hashString } from '../game/rng.ts';
import { addItem, charOwner, fail, ledger, removeItem, countItem, HOUR, type Game } from './core.ts';
import {
  activeCombatId, activeFieldActivity, activeProgress, addClassXp, addRep, changeGold, getProf, hasUnlock, snapshot, unlock, getCharacter, type Character,
} from './character.ts';
import { startCombat, deliverLoot, type CombatSettlement } from './combat.ts';
import { contractProgress } from './contracts.ts';
import { libraryKnows } from './guild.ts';
import { activeEvent } from '../data/events.ts';

export interface PathOption { name: string; kind: ExploreEventKind; hint: string; revealed: boolean }
export interface ExploreState {
  region: string;
  step: number;
  maxSteps: number;
  hpPct: number;
  backpack: Record<string, number>;
  gold: number;
  paths: PathOption[];
  log: string[];
  combatId?: string;
  combatKind?: ExploreEventKind;
  treasure?: boolean;
  weather: string;
  ended?: 'retorno' | 'derrota' | 'concluida';
}

export function weatherOf(region: RegionDef, now: number): string {
  const slot = Math.floor(now / (3 * HOUR));
  return region.weathers[hashString(`${region.id}:${slot}`) % region.weathers.length];
}

interface ActRow { id: number; character_id: number; state: string; seed: number; status: string }

export function currentExploration(g: Game, charId: number): { id: number; state: ExploreState; seed: number } | undefined {
  const a = g.db.get<ActRow>("SELECT id, character_id, state, seed, status FROM activities WHERE character_id = ? AND kind = 'exploracao' AND status = 'ativa'", charId);
  return a ? { id: a.id, state: json(a.state, {} as ExploreState), seed: a.seed } : undefined;
}

function save(g: Game, id: number, st: ExploreState) {
  g.db.run('UPDATE activities SET state = ? WHERE id = ?', JSON.stringify(st), id);
}

function perceptionReveal(c: Character, perception: number, tier: number, kind: ExploreEventKind): boolean {
  const race = raceById.get(c.race)!;
  if (perception >= 15 + tier * 4) return true;
  if (race.trait.t === 'sentido_escolhido' && c.raceChoice === 'audicao' && (kind === 'combate' || kind === 'variante' || kind === 'armadilha')) return true;
  if (race.trait.t === 'rastros_magicos' && (kind === 'ruina' || kind === 'rastro')) return true;
  return false;
}

function rollPaths(g: Game, c: Character, st: ExploreState, r: Rng): PathOption[] {
  const reg = regionById.get(st.region)!;
  const tier = tierOfLevel(reg.levels[1]);
  const { derived } = snapshot(g, c);
  const names = r.shuffle([...(PATH_NAMES[reg.id] ?? ['Trilha'])]);
  const n = r.chance(0.5) ? 3 : 2;
  const ev = activeEvent(reg.id, g.now());
  const kinds = Object.entries(EVENT_INFO).filter(([, v]) => v.weight > 0).map(([k, v]) => [k as ExploreEventKind,
    v.weight * (k === 'variante' ? ev?.variantWeight ?? 1 : 1) * (k === 'rastro' || k === 'ruina' ? 1 + (ev?.discoveryBonus ?? 0) : 1)] as const);
  const out: PathOption[] = [];
  const lair = hasUnlock(g, c.id, 'covil', reg.id) && st.step >= 2 && !st.paths.some((p) => p.kind === 'covil');
  for (let i = 0; i < n; i++) {
    let kind = r.weighted(kinds);
    if (i === 0 && lair) kind = 'covil';
    if (st.treasure && st.step === st.maxSteps - 1 && i === n - 1) kind = 'bau';
    out.push({ name: names[i % names.length], kind, hint: EVENT_INFO[kind].hint, revealed: kind === 'covil' || perceptionReveal(c, derived.attrs.percepcao, tier, kind) });
  }
  return out;
}

export function startExploration(g: Game, c: Character, opts: { treasureMap?: boolean } = {}): ExploreState {
  return g.db.tx(() => {
    if (activeCombatId(g, c.id)) fail('Você está em combate.');
    if (activeFieldActivity(g, c.id)) fail('Você já tem uma atividade de campo em andamento. Veja `/atividade`.');
    const reg = regionById.get(c.region)!;
    if (opts.treasureMap) removeItem(g, charOwner(c.id), `mapa-${reg.id}`, 1);
    const seed = randomSeed();
    const st: ExploreState = {
      region: reg.id, step: 0, maxSteps: EXPLORATION_STEPS, hpPct: 1, backpack: {}, gold: 0, paths: [], log: [],
      treasure: !!opts.treasureMap, weather: weatherOf(reg, g.now()),
    };
    const r = new Rng(seed);
    st.paths = rollPaths(g, c, st, r);
    st.log.push(`Você parte de ${reg.hub} rumo a ${reg.name}. Clima: ${WEATHER_LABEL[st.weather] ?? st.weather}.`);
    const now = g.now();
    g.db.run(`INSERT INTO activities (character_id, kind, status, params, state, seed, started_at, ends_at) VALUES (?,?,?,?,?,?,?,?)`,
      c.id, 'exploracao', 'ativa', JSON.stringify({ region: reg.id }), JSON.stringify(st), seed, now, now + 24 * HOUR);
    return st;
  });
}

export interface StepOutcome { state: ExploreState; text: string[]; combatId?: string; ended?: boolean }

export function choosePath(g: Game, c: Character, index: number): StepOutcome {
  return g.db.tx(() => {
    const cur = currentExploration(g, c.id) ?? fail('Você não está explorando. Use `/explorar`.');
    const { id, state: st, seed } = cur!;
    if (st.combatId) fail('Resolva o combate atual primeiro.');
    const path = st.paths[index] ?? fail('Caminho inválido.');
    const r = new Rng(seed + st.step * 104729 + index);
    const reg = regionById.get(st.region)!;
    const tier = tierOfLevel(reg.levels[1]);
    const level = activeProgress(g, c).level;
    const text: string[] = [`➡️ **${path!.name}** — ${EVENT_INFO[path!.kind].label}`];
    st.step++;
    contractProgress(g, c.id, { t: 'exploracao', steps: 1 });
    const { derived } = snapshot(g, c);
    const check = (attr: keyof typeof derived.attrs, alt: keyof typeof derived.attrs) => {
      const v = Math.max(derived.attrs[attr], derived.attrs[alt]);
      const roll = r.int(1, 20) + Math.floor(v / 2);
      return roll >= 10 + tier * 3 + Math.floor(level / 6);
    };
    const lvlAt = Math.max(reg.levels[0], Math.min(reg.levels[1], level));
    switch (path!.kind) {
      case 'combate':
      case 'variante': {
        const pool = path!.kind === 'variante' ? VARIANTS.filter((m) => m.region === reg.id) : COMMONS.filter((m) => m.region === reg.id);
        const n = path!.kind === 'variante' ? 1 : r.chance(0.55) ? 1 : 2;
        const enemies = Array.from({ length: n }, () => ({ monsterId: r.pick(pool).id, level: path!.kind === 'variante' ? undefined : lvlAt }));
        const cb = startCombat(g, { members: [c], enemies, context: { kind: 'exploracao', region: reg.id, mode: 'solo', canFlee: true, flags: [] }, kind: 'exploracao', ref: `act:${id}`, hp: { [c.id]: st.hpPct } });
        st.combatId = cb.id;
        st.combatKind = path!.kind;
        text.push(`⚔️ ${cb.fighters.filter((f) => f.side === 'inimigos' && f.kind === 'monstro').map((f) => f.name).join(' e ')} bloqueiam o caminho!`);
        save(g, id, st);
        return { state: st, text, combatId: cb.id };
      }
      case 'covil': {
        const boss = BOSSES.filter((b) => b.region === reg.id).find((b) => !hasUnlock(g, c.id, 'chefe', b.id)) ?? r.pick(BOSSES.filter((b) => b.region === reg.id));
        const cb = startCombat(g, { members: [c], enemies: [{ monsterId: boss.id }], context: { kind: 'chefe', region: reg.id, mode: 'solo', canFlee: false, flags: [] }, kind: 'exploracao', ref: `act:${id}`, hp: { [c.id]: st.hpPct } });
        st.combatId = cb.id;
        st.combatKind = 'covil';
        text.push(`👑 **${boss.name}, ${boss.title}** desperta!${boss.partySuggested > 1 ? ` (grupo sugerido: ${boss.partySuggested})` : ''}`);
        save(g, id, st);
        return { state: st, text, combatId: cb.id };
      }
      case 'coleta': {
        const locs = WORK_LOCATIONS.filter((l) => l.region === reg.id);
        const loc = r.pick(locs);
        const prof = getProf(g, c.id, loc.profession);
        const yields = loc.yields.filter((y) => !y.minLevel || prof.level >= y.minLevel);
        const qty = r.int(2, 4) + Math.floor(prof.level / 20);
        for (let i = 0; i < qty; i++) {
          const y = r.weighted(yields.map((x) => [x, x.weight] as const));
          st.backpack[y.item] = (st.backpack[y.item] ?? 0) + 1;
        }
        text.push(`🌿 Você recolhe ${qty} materiais perto de ${loc.name}.`);
        if (loc.unlock === 'descoberta' && unlock(g, c.id, 'local', loc.id)) text.push(`📍 **Local descoberto:** ${loc.name} agora aceita ordens de trabalho!`);
        break;
      }
      case 'ruina':
      case 'bau':
      case 'armadilha': {
        const ch = r.pick(CHECKS[path!.kind]);
        text.push(ch.text);
        const ok = check(ch.attr, ch.alt);
        if (path!.kind === 'armadilha') {
          if (ok) text.push(`✅ ${ch.success}`);
          else { const dmg = 0.12 + r.next() * 0.12; st.hpPct = Math.max(0.05, st.hpPct - dmg); text.push(`❌ ${ch.fail} (−${Math.round(dmg * 100)}% de vida)`); }
          break;
        }
        if (!ok) {
          text.push(`❌ ${ch.fail}`);
          if (path!.kind === 'bau') st.hpPct = Math.max(0.05, st.hpPct - 0.08);
          break;
        }
        text.push(`✅ ${ch.success}`);
        const gold = r.int(5, 15) * tier * (path!.kind === 'bau' ? 2 : 1) * (st.treasure && st.step >= st.maxSteps - 1 ? 4 : 1);
        st.gold += gold;
        const loot: string[] = [reg.signature, 'tinta-arcana', 'pocao-vida-menor'];
        if (path!.kind === 'ruina') {
          const runeKey = r.pick(Object.keys(RUNE_TYPES));
          loot.push(`runa-${runeKey}-${Math.min(3, Math.ceil(tier / 2))}`);
        }
        const it = r.pick(loot);
        st.backpack[it] = (st.backpack[it] ?? 0) + 1;
        text.push(`💰 ${gold} de ouro e ${itemById.get(it)?.name}.`);
        if (r.chance(0.08)) { st.backpack[`mapa-${reg.id}`] = (st.backpack[`mapa-${reg.id}`] ?? 0) + 1; text.push('🗺️ Um mapa de tesouro antigo!'); }
        if (st.treasure && st.step >= st.maxSteps - 1) {
          st.backpack[reg.signature] = (st.backpack[reg.signature] ?? 0) + 3;
          st.treasure = false;
          text.push('🏴‍☠️ **O tesouro do mapa!**');
        }
        break;
      }
      case 'rastro': {
        const hidden = WORK_LOCATIONS.filter((l) => l.region === reg.id && l.unlock === 'descoberta' && !hasUnlock(g, c.id, 'local', l.id));
        if (hidden.length && r.chance(0.7)) {
          const l = r.pick(hidden);
          unlock(g, c.id, 'local', l.id);
          text.push(`📍 **Local descoberto:** ${l.name} (${l.desc})`);
        } else if (!hasUnlock(g, c.id, 'covil', reg.id) && st.step >= 2) {
          unlock(g, c.id, 'covil', reg.id);
          text.push('👁️ **Você encontrou o rastro de algo enorme.** O covil desta região poderá aparecer nos próximos caminhos.');
        } else {
          st.gold += 10 * tier;
          text.push(`Você segue o rastro até um esconderijo abandonado (+${10 * tier} de ouro).`);
        }
        break;
      }
      case 'descanso':
        st.hpPct = Math.min(1, st.hpPct + 0.35);
        text.push('🔥 Você descansa e recupera o fôlego (+35% de vida).');
        break;
      case 'viajante': {
        addRep(g, c.id, reg.faction, 25);
        const gift = r.pick(['racao', 'agua', 'pocao-vida-menor', 'antidoto']);
        st.backpack[gift] = (st.backpack[gift] ?? 0) + 2;
        text.push(`🧳 Um viajante troca notícias e lhe dá ${itemById.get(gift)?.name} (+25 de reputação).`);
        break;
      }
    }
    rareDiscovery(g, c, st, r, text);
    return advance(g, c, id, st, seed, text);
  });
}

function rareDiscovery(g: Game, c: Character, st: ExploreState, r: Rng, text: string[]) {
  const race = raceById.get(c.race)!;
  const { derived } = snapshot(g, c);
  for (const d of RARE_DISCOVERIES.filter((x) => x.region === st.region && (!x.weather || x.weather === st.weather))) {
    if (hasUnlock(g, c.id, 'descoberta', d.id)) continue;
    const q = d.requires;
    if (q?.race && q.race !== race.id) continue;
    if (q?.sense && !(race.trait.t === 'sentido_escolhido' && c.raceChoice === q.sense)) continue;
    if (q?.attr && derived.attrs[q.attr[0]] < q.attr[1]) continue;
    if (q?.profession && getProf(g, c.id, q.profession[0]).level < q.profession[1]) continue;
    if (q?.item && countItem(g, charOwner(c.id), q.item) < 1) continue;
    const bonus = race.trait.t === 'rastros_magicos' ? 1.2 : 1;
    if (!r.chance(d.chance * bonus)) continue;
    unlock(g, c.id, 'descoberta', d.id);
    text.push(`✨ **Descoberta rara: ${d.name}!** ${d.desc}`);
    for (const [k, n] of d.reward.items ?? []) st.backpack[k] = (st.backpack[k] ?? 0) + n;
    if (d.reward.title) { unlock(g, c.id, 'titulo', d.reward.title); text.push(`🏅 Título: ${d.reward.title}`); }
    if (d.reward.visual) unlock(g, c.id, 'visual', d.reward.visual);
  }
}

function advance(g: Game, c: Character, id: number, st: ExploreState, seed: number, text: string[]): StepOutcome {
  if (st.step >= st.maxSteps) {
    text.push('🏕️ Você chegou ao fim da trilha planejada e retorna à cidade.');
    const out = finishExploration(g, c, id, st, 'concluida');
    return { state: out, text, ended: true };
  }
  st.paths = rollPaths(g, c, st, new Rng(seed + st.step * 7));
  st.log = [...st.log, ...text].slice(-12);
  save(g, id, st);
  return { state: st, text };
}

/** Voltar à cidade guarda a mochila de expedição no inventário. */
export function finishExploration(g: Game, c: Character, id: number, st: ExploreState, reason: ExploreState['ended']): ExploreState {
  const own = charOwner(c.id);
  if (reason !== 'derrota') {
    for (const [k, q] of Object.entries(st.backpack)) if (q > 0) addItem(g, own, k, q);
    if (st.gold) changeGold(g, c.id, st.gold, 'exploracao', `act:${id}`);
    addClassXp(g, c, st.step * (10 + activeProgress(g, c).level * 2));
  }
  st.ended = reason;
  g.db.run("UPDATE activities SET status = 'concluida', state = ?, resolved_at = ?, result = ? WHERE id = ?", JSON.stringify(st), g.now(), JSON.stringify({ reason, backpack: st.backpack, gold: st.gold }), id);
  ledger(g, c.id, 'exploracao_fim', st.gold, undefined, undefined, `act:${id}`, { reason, backpack: st.backpack });
  return st;
}

export function returnToCity(g: Game, c: Character): ExploreState {
  return g.db.tx(() => {
    const cur = currentExploration(g, c.id) ?? fail('Você não está explorando.');
    if (cur!.state.combatId) fail('Você não pode voltar no meio de um combate.');
    return finishExploration(g, c, cur!.id, cur!.state, 'retorno');
  });
}

/** Chamado quando um combate de exploração termina. */
export function onExplorationCombat(g: Game, activityId: number, s: CombatSettlement): StepOutcome | null {
  return g.db.tx(() => {
    const a = g.db.get<ActRow>("SELECT id, character_id, state, seed, status FROM activities WHERE id = ? AND status = 'ativa'", activityId);
    if (!a) return null;
    const st = json(a.state, {} as ExploreState);
    const c = getCharacter(g, a.character_id)!;
    const m = s.members.find((x) => x.characterId === c.id);
    st.combatId = undefined;
    const text: string[] = [];
    if (s.outcome === 'vitoria' && m) {
      st.hpPct = Math.max(0.1, m.hpPct);
      if (st.combatKind === 'covil') {
        deliverLoot(g, { outcome: s.outcome, members: [m] });
        text.push('👑 O saque do chefe foi guardado diretamente no inventário.');
      } else for (const [k, q] of Object.entries(m.items)) st.backpack[k] = (st.backpack[k] ?? 0) + q;
      text.push(`🏆 Vitória! +${m.xp} XP${m.levels ? ` • **Subiu para o nível ${m.level}!**` : ''}`);
      if (m.tamed.length) text.push(`🐾 Domado: ${m.tamed.join(', ')}`);
      return advance(g, c, a.id, st, a.seed, text);
    }
    if (s.outcome === 'fuga') {
      st.hpPct = Math.max(0.1, m?.hpPct ?? 0.3);
      text.push('🏃 Você escapa e segue por outro caminho.');
      return advance(g, c, a.id, st, a.seed, text);
    }
    // Derrota solo: perde parte do que ainda não foi guardado.
    const lost: string[] = [];
    for (const [k, q] of Object.entries(st.backpack)) {
      const l = Math.ceil(q * DEFEAT_LOSS);
      st.backpack[k] = q - l;
      if (l) lost.push(`${l}× ${itemById.get(k)?.name ?? k}`);
    }
    st.gold = Math.floor(st.gold * (1 - DEFEAT_LOSS));
    for (const [k, q] of Object.entries(st.backpack)) if (q > 0) addItem(g, charOwner(c.id), k, q);
    if (st.gold) changeGold(g, c.id, st.gold, 'exploracao_derrota', `act:${a.id}`);
    text.push(`💀 Derrota. Você é levado de volta a ${regionById.get(st.region)!.hub}.${lost.length ? ` Perdeu: ${lost.join(', ')}.` : ''} Seus equipamentos sofreram desgaste.`);
    st.ended = 'derrota';
    g.db.run("UPDATE activities SET status = 'concluida', state = ?, resolved_at = ? WHERE id = ?", JSON.stringify(st), g.now(), a.id);
    return { state: st, text, ended: true };
  });
}

/** Explorações esquecidas (24h) são encerradas guardando a mochila. */
export function expireExplorations(g: Game) {
  for (const a of g.db.all<ActRow>("SELECT id, character_id, state, seed, status FROM activities WHERE kind = 'exploracao' AND status = 'ativa' AND ends_at <= ?", g.now())) {
    const st = json(a.state, {} as ExploreState);
    if (st.combatId) continue;
    const c = getCharacter(g, a.character_id);
    if (c) g.db.tx(() => finishExploration(g, c, a.id, st, 'retorno'));
  }
}

export function knowsWeakness(g: Game, charId: number, monsterId: string): boolean {
  const b = g.db.get<{ kills: number; analyzed: number }>('SELECT kills, analyzed FROM bestiary WHERE character_id = ? AND monster_id = ?', charId, monsterId);
  return !!b && (b.analyzed > 0 || b.kills >= 5) || libraryKnows(g, charId, monsterId);
}
