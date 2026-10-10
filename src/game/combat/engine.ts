import type {
  DamageEffect, Effect, Element, HealEffect, MonsterAbility, MonsterTarget, ShieldEffect, StatusEffect, StatusId, BossDef, MonsterDef,
} from '../../data/types.ts';
import { itemById } from '../../data/items.ts';
import { fieldById, enemyObjectById, ENEMY_OBJECTS } from '../../data/minions.ts';
import { bossById, monsterById, BOSSES, tierOfLevel } from '../../data/monsters/index.ts';
import { PET_AFFINITIES } from '../../data/pets.ts';
import { SKILLS } from '../../data/classes/index.ts';
import { Rng } from '../rng.ts';
import { armorPct, resistPct } from '../stats.ts';
import { buildEnemyObject, buildMinion, buildMonsterFighter, buildPetMinion } from './build.ts';
import { STATUS_INFO, type CombatContext, type CombatState, type Fighter, type Intent, type PlayerAction, type ResolvedSkill, type StatusInst } from './state.ts';

const CONTROL: ReadonlySet<StatusId> = new Set(['atordoado', 'congelado', 'silenciado', 'confuso', 'casulo']);
const TURN_STATUSES: ReadonlySet<StatusId> = new Set(['atordoado', 'congelado', 'silenciado', 'confuso']);
const DOTS: ReadonlySet<StatusId> = new Set(['sangramento', 'veneno', 'queimadura', 'decadencia']);
const STACKING: Partial<Record<StatusId, number>> = { resfriado: 3, determinacao: 5, imagem: 3, geada: 99, esporos: 99, combo: 5, fortalecido: 1 };
const MAGIC_CLASSES = new Set(['mana', 'fe', 'seiva', 'essencia', 'inspiracao', 'carga']);
const HEALER_CLASSES = new Set(['fe', 'seiva', 'inspiracao']);
const POTION_COOLDOWN = 2;

// ===================================================================== utilitários

const pct = (n: number) => Math.round(n);
const fmt = (n: number) => Math.max(0, Math.round(n));

function rng(st: CombatState): Rng {
  const r = new Rng(0);
  r.state = st.rngState;
  return r;
}
function saveRng(st: CombatState, r: Rng) { st.rngState = r.state; }

export const living = (st: CombatState) => st.fighters.filter((f) => f.alive);
export const heroesOf = (st: CombatState) => st.fighters.filter((f) => f.side === 'herois');
export const enemiesOf = (st: CombatState) => st.fighters.filter((f) => f.side === 'inimigos');
export const byId = (st: CombatState, id?: string) => st.fighters.find((f) => f.id === id);
const opponents = (st: CombatState, f: Fighter) => st.fighters.filter((x) => x.alive && x.side !== f.side);
const allies = (st: CombatState, f: Fighter) => st.fighters.filter((x) => x.alive && x.side === f.side);
const hasStatus = (f: Fighter, id: StatusId) => f.statuses.some((s) => s.id === id && (s.dur > 0 || s.stacks > 0));
const statusOf = (f: Fighter, id: StatusId) => f.statuses.find((s) => s.id === id);
const removeStatus = (f: Fighter, id: StatusId) => { f.statuses = f.statuses.filter((s) => s.id !== id); };
const isMagicUser = (f: Fighter) => !!f.res && MAGIC_CLASSES.has(f.res.id);
const isHealer = (f: Fighter) => !!f.res && HEALER_CLASSES.has(f.res.id);
const hpFrac = (f: Fighter) => f.hp / Math.max(1, f.maxHp);
const bossOf = (st: CombatState) => st.fighters.find((f) => f.alive && f.boss);

function log(st: CombatState, line: string) {
  st.log.push(line);
}

// ===================================================================== criação

export interface CreateCombatInput {
  id: string;
  seed: number;
  heroes: Fighter[];
  enemies: { monsterId: string; level?: number; hpMult?: number; atkMult?: number }[];
  context: CombatContext;
}

export function createCombat(input: CreateCombatInput): CombatState {
  const st: CombatState = {
    id: input.id, seed: input.seed, rngState: input.seed >>> 0, round: 1, fighters: [...input.heroes], log: [], history: [],
    pending: {}, meters: [], fields: [], context: input.context, tamed: [], revealed: [], kills: [], consumed: {}, nextId: 1,
  };
  for (const h of st.fighters) {
    for (const e of [] as string[]) void e;
    h.threat = {};
  }
  input.enemies.forEach((e) => {
    const def = monsterById.get(e.monsterId);
    if (!def) throw new Error(`Criatura desconhecida: ${e.monsterId}`);
    spawnMonster(st, def, { level: e.level, hpMult: e.hpMult, atkMult: e.atkMult });
  });
  const boss = st.fighters.find((f) => f.boss);
  if (boss) {
    const def = bossById.get(boss.ref)!;
    for (const m of def.meters ?? []) st.meters.push({ id: m.id, label: m.label, value: m.start, max: m.max, def: m });
    if (def.stack) st.stack = { ...def.stack, zone: 'frente', zoneRounds: 0 };
    for (const o of def.start ?? []) spawnObject(st, o, boss);
    checkPhases(st, boss);
  }
  refreshOrderImmunity(st);
  for (const e of enemiesOf(st)) for (const h of heroesOf(st)) e.threat[h.id] = h.line === 'frente' ? 10 : 0;
  chooseIntents(st);
  log(st, `⚔️ Combate iniciado contra ${enemiesOf(st).filter((e) => e.kind !== 'objeto').map((e) => e.name).join(', ')}.`);
  return st;
}

function newId(st: CombatState, prefix: string) {
  return `${prefix}${st.nextId++}`;
}

function spawnMonster(st: CombatState, def: MonsterDef, o: { level?: number; hpMult?: number; atkMult?: number; summonedBy?: string; echo?: boolean; line?: 'frente' | 'tras' } = {}): Fighter {
  const f = buildMonsterFighter(def, {
    id: newId(st, 'e'), partySize: st.context.partySize, levelOverride: o.level, hpMult: o.hpMult, atkMult: o.atkMult,
    summonedBy: o.summonedBy, echo: o.echo, line: o.line,
  });
  if (o.echo) {
    f.name = `Eco de ${def.name}`;
    f.boss = undefined;
    f.rotation = undefined;
    f.abilities = (def.abilities ?? []).filter((a) => !a.effects.some((e) => ['invocar', 'casulo', 'copiar_habilidade', 'campo', 'medidor'].includes(e.k)));
    f.traits = [];
  }
  for (const h of heroesOf(st)) f.threat[h.id] = h.line === 'frente' ? 10 : 0;
  st.fighters.push(f);
  return f;
}

function spawnObject(st: CombatState, defId: string, owner: Fighter): Fighter | null {
  const f = buildEnemyObject(defId, owner, newId(st, 'o'));
  if (!f) return null;
  st.fighters.push(f);
  return f;
}

// ===================================================================== consultas para a interface

export function canAct(f: Fighter): boolean {
  return f.alive && !hasStatus(f, 'casulo');
}

export function frontEmpty(st: CombatState, side: Fighter['side']): boolean {
  return !st.fighters.some((f) => f.alive && f.side === side && f.line === 'frente' && f.kind !== 'objeto');
}

/** Pode alcançar o alvo com um ataque corpo a corpo? */
function meleeReachable(st: CombatState, tgt: Fighter): boolean {
  if (tgt.line === 'frente') return true;
  return frontEmpty(st, tgt.side);
}

export function validTargets(st: CombatState, actor: Fighter, kind: 'inimigo' | 'aliado' | 'caido', melee: boolean): Fighter[] {
  if (kind === 'caido') return st.fighters.filter((f) => !f.alive && f.side === actor.side && f.kind === 'jogador');
  if (kind === 'aliado') return allies(st, actor);
  return opponents(st, actor).filter((t) => !hasStatus(t, 'oculto') && (!melee || meleeReachable(st, t)) && isTargetable(st, t));
}

/** Partes protegidas por ordem (placas, sigilos) e chefes blindados não aparecem como alvo. */
export function isTargetable(st: CombatState, t: Fighter): boolean {
  if (isOrderLocked(st, t)) return false;
  if (t.boss && bossLockedByOrder(st, t)) return false;
  return true;
}

export function skillUsable(st: CombatState, f: Fighter, s: ResolvedSkill): string | null {
  if (!f.alive) return 'Você está fora de combate.';
  if (hasStatus(f, 'silenciado')) return 'Você está silenciado.';
  if ((f.cooldowns[s.id] ?? 0) > 0) return `Em recarga (${f.cooldowns[s.id]} rodada(s)).`;
  const cost = effectiveCost(f, s);
  if (f.res && f.res.cur < cost) return `${f.res.name} insuficiente (${Math.floor(f.res.cur)}/${cost}).`;
  if (s.range === 'corpo' && !s.anyLine && f.line === 'tras' && !f.weapon?.reach && s.target !== 'si' && s.target !== 'nenhum' && s.target !== 'aliado' && s.target !== 'todos_aliados') {
    return 'Habilidade corpo a corpo: vá para a linha de frente.';
  }
  return null;
}

function effectiveCost(f: Fighter, s: ResolvedSkill): number {
  let c = s.cost;
  if (s.culminant && f.legendary.includes('reliquia-veu')) c = Math.floor(c * 0.75);
  if (f.legendary.includes('mascara-copia')) c = Math.ceil(c * 1.2);
  return c;
}

// ===================================================================== ações dos jogadores

export function submitAction(st: CombatState, fighterId: string, action: PlayerAction): string | null {
  if (st.outcome) return 'O combate já terminou.';
  const f = byId(st, fighterId);
  if (!f || f.kind !== 'jogador') return 'Combatente inválido.';
  if (!f.alive) return 'Você está fora de combate.';
  const err = validateAction(st, f, action);
  if (err) return err;
  st.pending[fighterId] = action;
  return null;
}

function validateAction(st: CombatState, f: Fighter, a: PlayerAction): string | null {
  switch (a.kind) {
    case 'habilidade': {
      const s = f.skills.find((x) => x.id === a.skillId);
      if (!s) return 'Habilidade não equipada.';
      const e = skillUsable(st, f, s);
      if (e) return e;
      if (s.target === 'inimigo' || s.target === 'linha_inimiga') {
        if (a.targetId) {
          const t = byId(st, a.targetId);
          if (!t || !t.alive || t.side === f.side) return 'Alvo inválido.';
        }
      }
      if (s.target === 'aliado' && a.targetId) {
        const t = byId(st, a.targetId);
        if (!t || t.side !== f.side) return 'Alvo inválido.';
        if (!t.alive && !s.tags.includes('alvo_caido')) return 'Esse aliado caiu.';
      }
      return null;
    }
    case 'item': {
      const b = f.belt?.find((x) => x.item === a.itemId && x.qty > 0);
      if (!b) return 'Você não tem esse item no cinto.';
      const def = itemById.get(a.itemId);
      if (!def?.use) return 'Esse item não pode ser usado em combate.';
      if (def.kind === 'pocao' && f.potionCd > 0) return `Poções em recarga (${f.potionCd} rodada(s)).`;
      return null;
    }
    case 'domar': {
      const t = byId(st, a.targetId);
      if (!t || !t.alive || t.side === f.side || t.kind !== 'monstro') return 'Alvo inválido.';
      if (!t.tameable) return 'Essa criatura não pode ser domada.';
      if (!f.belt?.some((x) => x.item === a.itemId && x.qty > 0)) return 'Você precisa de uma isca no cinto.';
      return null;
    }
    case 'fugir':
      if (!st.context.canFlee) return 'Não é possível fugir deste combate.';
      return null;
    default:
      return null;
  }
}

export function missingActors(st: CombatState): Fighter[] {
  return st.fighters.filter((f) => f.kind === 'jogador' && f.alive && canAct(f) && !st.pending[f.id]);
}

/** Preenche ações ausentes com a postura automática (modo assíncrono). */
export function fillAutoActions(st: CombatState) {
  for (const f of missingActors(st)) {
    if (f.autoPosture === 'atacar') {
      const t = validTargets(st, f, 'inimigo', (f.weapon?.range ?? 'corpo') === 'corpo' && !f.weapon?.reach)
        .sort((a, b) => hpFrac(a) - hpFrac(b))[0];
      st.pending[f.id] = t ? { kind: 'atacar', targetId: t.id } : { kind: 'defender' };
    } else st.pending[f.id] = { kind: 'defender' };
  }
}

// ===================================================================== resolução da rodada

export function resolveRound(st: CombatState): string[] {
  if (st.outcome) return [];
  st.log = [];
  const r = rng(st);
  fillAutoActions(st);
  for (const f of st.fighters) f.hitThisRound = false;

  // Fase dos heróis (por iniciativa; Lentos agem por último)
  const heroes = st.fighters
    .filter((f) => f.side === 'herois' && f.kind === 'jogador' && f.alive)
    .sort((a, b) => initiativeOf(b) - initiativeOf(a));
  for (const h of heroes) {
    if (st.outcome) break;
    if (!h.alive) continue;
    const action = st.pending[h.id] ?? { kind: 'defender' };
    heroTurn(st, h, action, r);
    if (!st.outcome) minionsAndPetAct(st, h, r, action);
    checkEnd(st);
  }
  // Lacaios de heróis caídos já desapareceram; lacaios independentes não existem.

  // Fase dos inimigos
  if (!st.outcome) {
    const enemies = st.fighters.filter((f) => f.side === 'inimigos' && f.alive).sort((a, b) => initiativeOf(b) - initiativeOf(a));
    for (const e of enemies) {
      if (st.outcome) break;
      if (!e.alive) continue;
      enemyTurn(st, e, r);
      checkEnd(st);
    }
  }

  if (!st.outcome) endOfRound(st, r);
  checkEnd(st);
  if (!st.outcome) chooseIntents(st, r);
  st.pending = {};
  st.round++;
  st.history.push(...st.log.map((l) => `[${st.round - 1}] ${l}`));
  if (st.history.length > 200) st.history = st.history.slice(-200);
  saveRng(st, r);
  return st.log;
}

function initiativeOf(f: Fighter): number {
  let i = f.initiative;
  if (hasStatus(f, 'lento')) i -= 1000;
  if (hasStatus(f, 'acelerado')) i += 20;
  return i;
}

/** Retorna true se o combatente perdeu o turno por controle. */
function controlledSkip(st: CombatState, f: Fighter): boolean {
  if (hasStatus(f, 'casulo')) {
    log(st, `🕸️ ${f.name} está preso em um casulo.`);
    return true;
  }
  for (const id of ['congelado', 'atordoado'] as StatusId[]) {
    const s = statusOf(f, id);
    if (s && s.dur > 0) {
      log(st, `${STATUS_INFO[id].icon} ${f.name} está ${STATUS_INFO[id].label.toLowerCase()} e perde a ação.`);
      tickTurnStatuses(f);
      if (f.intent) f.intent = undefined;
      return true;
    }
  }
  return false;
}

function tickTurnStatuses(f: Fighter) {
  for (const s of f.statuses) if (TURN_STATUSES.has(s.id)) s.dur -= 1;
  f.statuses = f.statuses.filter((s) => !(TURN_STATUSES.has(s.id) && s.dur <= 0));
}

function heroTurn(st: CombatState, h: Fighter, a: PlayerAction, r: Rng) {
  if (controlledSkip(st, h)) return;
  if ('move' in a && a.move) doMove(st, h);
  switch (a.kind) {
    case 'mover':
      doMove(st, h);
      break;
    case 'defender':
      h.defending = true;
      gainResource(h, h.res?.onDefend ?? 0);
      for (const hk of h.hooks) if (hk.t === 'ao_defender') addStacks(h, hk.status, hk.stacks, hk.max, hk.potency);
      log(st, `🛡️ ${h.name} se defende.`);
      break;
    case 'atacar':
      basicAttack(st, h, a.targetId, r);
      break;
    case 'habilidade': {
      const s = h.skills.find((x) => x.id === a.skillId);
      if (!s || skillUsable(st, h, s)) { basicAttack(st, h, a.targetId, r); break; }
      useSkill(st, h, s, a.targetId, r);
      break;
    }
    case 'item':
      useItem(st, h, a.itemId, a.targetId);
      break;
    case 'domar':
      tryTame(st, h, a.targetId, a.itemId, r);
      break;
    case 'analisar':
      analyze(st, h, a.targetId);
      break;
    case 'fugir': {
      const avgLevel = enemiesOf(st).filter((e) => e.alive && e.kind === 'monstro').reduce((s, e, _, arr) => s + e.level / arr.length, 0);
      const chance = Math.max(0.2, Math.min(0.9, 0.55 + (h.attrs.destreza - avgLevel) * 0.01));
      if (r.chance(chance)) {
        st.outcome = 'fuga';
        log(st, `🏃 ${h.name} consegue fugir!`);
      } else log(st, `🏃 ${h.name} tenta fugir, mas é cercado.`);
      break;
    }
  }
  tickTurnStatuses(h);
}

function doMove(st: CombatState, f: Fighter) {
  if (hasStatus(f, 'enraizado')) { log(st, `🌿 ${f.name} está enraizado e não consegue se mover.`); return; }
  f.line = f.line === 'frente' ? 'tras' : 'frente';
  log(st, `↔️ ${f.name} vai para a ${f.line === 'frente' ? 'linha de frente' : 'retaguarda'}.`);
  if (st.stack?.reduceOnMove) reduceStacks(f, st.stack.status, st.stack.reduceOnMove);
  if (f.legendary.includes('pluma-vento')) applyStatusRaw(f, { id: 'evasivo', dur: 1, stacks: 1, potency: 25 });
}

function gainResource(f: Fighter, amount: number) {
  if (!f.res || !amount) return;
  f.res.cur = Math.max(0, Math.min(f.res.max, f.res.cur + amount));
}

// ---------------------------------------------------------------- ataque básico

function basicAttack(st: CombatState, h: Fighter, targetId: string | undefined, r: Rng) {
  const melee = (h.weapon?.range ?? 'corpo') === 'corpo';
  if (melee && h.line === 'tras' && !h.weapon?.reach) {
    log(st, `${h.name} está na retaguarda sem alcance corpo a corpo e se defende.`);
    h.defending = true;
    return;
  }
  let t = pickTarget(st, h, targetId, melee && !h.weapon?.reach, r);
  if (!t) { log(st, `${h.name} não encontra alvo.`); return; }
  t = confusedRedirect(st, h, t, r);
  const scale = Object.fromEntries(Object.entries(h.weapon?.scale ?? { forca: 0.6 }).map(([k, v]) => [k, (v ?? 0) * 0.6]));
  const eff: DamageEffect = { k: 'dano', power: 4, scale, weapon: 1, elem: h.weapon?.elem ?? 'fisico', breaks: h.weapon?.breaks };
  log(st, `🗡️ ${h.name} ataca ${t.name}.`);
  const dealt = dealDamage(st, h, t, eff, { single: true, melee, basic: true }, r);
  if (dealt >= 0) gainResource(h, h.res?.onBasic ?? 0);
  if (h.weapon?.oil && t.alive) {
    const oil = h.weapon.oil;
    dealDamage(st, h, t, { k: 'dano', power: 0, elem: oil.elem, weapon: oil.bonus, scale: {} }, { single: true, melee, basic: true, quiet: true }, r);
    if (oil.status && t.alive && r.chance(0.3)) applyStatus(st, h, t, { k: 'status', id: oil.status as StatusId, dur: 2, stacks: 1, potency: 0, elem: oil.elem }, r);
  }
  if (h.legendary.includes('brasa-primordial') && t.alive) applyStatus(st, h, t, { k: 'status', id: 'queimadura', dur: 2, potency: Math.round(h.level * 0.4) + 2, elem: 'fogo' }, r);
  updateCombo(h, 'basico');
}

function pickTarget(st: CombatState, h: Fighter, targetId: string | undefined, melee: boolean, r: Rng): Fighter | undefined {
  const valid = validTargets(st, h, 'inimigo', melee);
  const chosen = targetId ? valid.find((t) => t.id === targetId) : undefined;
  if (chosen) return chosen;
  const nonObj = valid.filter((t) => t.kind !== 'objeto');
  return (nonObj.length ? nonObj : valid).sort((a, b) => hpFrac(a) - hpFrac(b))[0] ?? (valid.length ? r.pick(valid) : undefined);
}

function confusedRedirect(st: CombatState, f: Fighter, t: Fighter, r: Rng): Fighter {
  if (!hasStatus(f, 'confuso') || !r.chance(0.5)) return t;
  const pool = living(st).filter((x) => x.id !== f.id && x.kind !== 'objeto');
  const nt = r.pick(pool);
  if (nt && nt.id !== t.id) log(st, `❓ ${f.name}, confuso, ataca ${nt.name}!`);
  return nt ?? t;
}

function updateCombo(f: Fighter, used: string) {
  const hook = f.hooks.find((x) => x.t === 'combo');
  if (!hook || hook.t !== 'combo') return;
  if (!f.combo) f.combo = { chain: 0 };
  if (f.combo.last && f.combo.last !== used) f.combo.chain = Math.min(hook.max, f.combo.chain + 1);
  else if (f.combo.last === used) f.combo.chain = 0;
  f.combo.last = used;
}

// ---------------------------------------------------------------- habilidades

function useSkill(st: CombatState, h: Fighter, s: ResolvedSkill, targetId: string | undefined, r: Rng) {
  const cost = effectiveCost(h, s);
  if (h.res) h.res.cur -= cost;
  const noCd = (h.hooks.some((x) => x.t === 'sem_recarga_chance' && r.chance(x.pct / 100)))
    || (h.legendary.includes('mascara-copia') && !h.usedFirstSkill);
  h.usedFirstSkill = true;
  let cd = s.cooldown;
  if (s.id === 'interceptar' && h.legendary.includes('egide-linha')) cd += 2;
  if (!noCd && cd > 0) h.cooldowns[s.id] = cd + 1; // +1 porque a recarga cai no fim desta rodada
  if (noCd && cd > 0) log(st, `⏳ ${s.name} não entra em recarga!`);

  const melee = s.range === 'corpo';
  let primary: Fighter[] = [];
  switch (s.target) {
    case 'si': primary = [h]; break;
    case 'nenhum': primary = []; break;
    case 'aliado': {
      let t = targetId ? byId(st, targetId) : undefined;
      if (s.tags.includes('alvo_caido') && t && !t.alive && t.side === h.side) primary = [t];
      else {
        if (!t || !t.alive || t.side !== h.side) t = allies(st, h).sort((a, b) => hpFrac(a) - hpFrac(b))[0];
        primary = t ? [t] : [h];
      }
      break;
    }
    case 'todos_aliados': primary = allies(st, h); break;
    case 'todos_inimigos': primary = opponents(st, h); break;
    case 'inimigo': {
      let t = pickTarget(st, h, targetId, melee && !s.anyLine && !h.weapon?.reach, r);
      if (t) t = confusedRedirect(st, h, t, r);
      primary = t ? [t] : [];
      break;
    }
    case 'linha_inimiga': {
      const t = pickTarget(st, h, targetId, false, r);
      const line = t?.line ?? (frontEmpty(st, 'inimigos') ? 'tras' : 'frente');
      primary = opponents(st, h).filter((x) => x.line === line);
      break;
    }
  }
  const tname = primary.length === 1 && primary[0].id !== h.id ? ` em ${primary[0].name}` : '';
  log(st, `✨ ${h.name} usa **${s.name}**${tname}.`);
  const killedBefore = st.kills.length;
  applyEffects(st, h, s.effects, primary, r, { melee, skill: s });
  if (s.tags.includes('atrasar_intencoes')) {
    for (const e of opponents(st, h)) if (e.intent) e.intent.chargeLeft += 1;
    log(st, '⏳ As ações preparadas pelos inimigos são atrasadas.');
  }
  if (s.tags.includes('reset_ao_abater') && st.kills.length > killedBefore) {
    h.cooldowns[s.id] = 0;
    gainResource(h, 30);
    log(st, `💀 ${s.name} colhe uma alma: recarga zerada!`);
  }
  for (const hk of h.hooks) if (hk.t === 'acumulo_ao_usar') addStacks(h, hk.status, 1, hk.max, hk.potency, true);
  updateCombo(h, s.id);
}

interface EffectCtx { melee: boolean; skill?: ResolvedSkill; ability?: MonsterAbility; mult?: number }

function applyEffects(st: CombatState, src: Fighter, effects: Effect[], primary: Fighter[], r: Rng, ctx: EffectCtx) {
  for (const e of effects) {
    if (!src.alive && e.k !== 'invocar') break;
    applyEffect(st, src, e, primary, r, ctx);
  }
}

function resolveOn(st: CombatState, src: Fighter, e: Effect, primary: Fighter[]): Fighter[] {
  const on = ('on' in e && e.on) || (primary.length === 0 ? 'si' : 'alvo');
  switch (on) {
    case 'alvo': return primary.filter((p) => p.alive || (e.k === 'cura' && (e as HealEffect).revive));
    case 'si': return [src];
    case 'linha_alvo': {
      const p = primary[0];
      return p ? st.fighters.filter((f) => f.alive && f.side === p.side && f.line === p.line) : [];
    }
    case 'inimigos': return opponents(st, src);
    case 'aliados': return allies(st, src);
    case 'linha_si': return allies(st, src).filter((f) => f.line === src.line);
    case 'aliado_ferido': {
      const a = allies(st, src).filter((f) => f.kind !== 'objeto').sort((x, y) => hpFrac(x) - hpFrac(y))[0];
      return a ? [a] : [];
    }
    case 'aleatorio': return primary;
  }
  return primary;
}

function applyEffect(st: CombatState, src: Fighter, e: Effect, primary: Fighter[], r: Rng, ctx: EffectCtx) {
  switch (e.k) {
    case 'dano': {
      const hits = e.hits ?? 1;
      if (e.selfCost) {
        const cost = Math.round(src.maxHp * e.selfCost);
        src.hp = Math.max(1, src.hp - cost);
        log(st, `🩸 ${src.name} sacrifica ${cost} de vida.`);
      }
      const extraHits = ctx.ability?.hitsPerObject ? st.fighters.filter((f) => f.alive && f.object?.defId === ctx.ability!.hitsPerObject).length : 0;
      for (let i = 0; i < hits + extraHits; i++) {
        let targets: Fighter[];
        if (e.on === 'aleatorio') {
          const pool = opponents(st, src).filter((t) => !hasStatus(t, 'oculto'));
          targets = pool.length ? [r.pick(pool)] : [];
        } else targets = resolveOn(st, src, e, primary);
        for (const t of targets) {
          const single = targets.length === 1 && (ctx.skill?.target === 'inimigo' || ctx.ability ? true : false);
          dealDamage(st, src, t, e, { single, melee: ctx.melee, skill: ctx.skill, mult: ctx.mult }, r);
          if (!src.alive) return;
        }
      }
      break;
    }
    case 'cura':
      for (const t of resolveOn(st, src, e, primary)) heal(st, src, t, e);
      break;
    case 'escudo':
      for (const t of resolveOn(st, src, e, primary)) giveShield(st, src, t, e);
      break;
    case 'status':
      for (const t of resolveOn(st, src, e, primary)) applyStatus(st, src, t, e, r);
      break;
    case 'purificar':
      for (const t of resolveOn(st, src, e, primary)) cleanse(st, t, e.count);
      break;
    case 'dissipar':
      for (const t of resolveOn(st, src, e, primary)) dispel(st, t, e.count);
      break;
    case 'provocar':
      for (const t of resolveOn(st, src, e, primary)) {
        if (t.side === src.side) continue;
        if (t.rank === 'chefe' && t.ctrlStacks >= 3) { log(st, `${t.name} ignora a provocação.`); continue; }
        applyStatusRaw(t, { id: 'provocado', dur: e.dur, stacks: 1, potency: 0, source: src.id });
        t.threat[src.id] = (t.threat[src.id] ?? 0) + 60;
      }
      log(st, `😠 ${src.name} provoca os inimigos.`);
      break;
    case 'interromper':
      for (const t of resolveOn(st, src, e, primary)) interrupt(st, src, t, r);
      break;
    case 'mover':
      for (const t of resolveOn(st, src, e, primary)) {
        if (t.kind === 'objeto') continue;
        if (t.legendary.includes('ancora-mares') && t.id !== src.id) { log(st, `⚓ ${t.name} não sai do lugar.`); continue; }
        if (t.rank === 'chefe' && t.id !== src.id) continue;
        if (hasStatus(t, 'enraizado') && t.id !== src.id) continue;
        const to = e.to === 'trocar' ? (t.line === 'frente' ? 'tras' : 'frente') : e.to;
        if (t.line !== to) {
          t.line = to;
          if (st.stack?.reduceOnMove && t.side === 'herois') reduceStacks(t, st.stack.status, st.stack.reduceOnMove);
          log(st, `↔️ ${t.name} vai para a ${to === 'frente' ? 'linha de frente' : 'retaguarda'}.`);
        }
      }
      break;
    case 'recurso':
      for (const t of resolveOn(st, src, e, primary)) gainResource(t, e.amount);
      break;
    case 'invocar':
      summon(st, src, e.minion, e.max, e.count ?? 1, e.temp, r);
      break;
    case 'interceptar':
      for (const t of resolveOn(st, src, e, primary)) {
        if (t.id === src.id) continue;
        const targets = src.legendary.includes('egide-linha') ? allies(st, src).filter((a) => a.line === t.line && a.id !== src.id) : [t];
        for (const x of targets) applyStatusRaw(x, { id: 'interceptado', dur: e.dur, stacks: 1, potency: Math.round(e.ratio * 100), source: src.id });
        log(st, `🤝 ${src.name} protege ${targets.map((x) => x.name).join(', ')}.`);
      }
      if (resolveOn(st, src, e, primary).some((t) => t.id === src.id) && src.kind === 'jogador') {
        // assistência do pet "Corpo a Corpo": nada a fazer aqui
      }
      break;
    case 'ameaca':
      for (const en of opponents(st, src)) en.threat[src.id] = (en.threat[src.id] ?? 0) + e.amount;
      break;
    case 'expor':
      for (const t of resolveOn(st, src, e, primary)) applyStatusRaw(t, { id: 'exposto', dur: e.dur, stacks: 1, potency: 0 });
      break;
    case 'medidor': {
      const m = st.meters.find((x) => x.id === e.meter);
      if (m) { m.value = Math.max(0, Math.min(m.max, m.value + e.amount)); log(st, `📈 ${m.label}: ${m.value}/${m.max}.`); }
      break;
    }
    case 'trocar_linhas': {
      const side = e.side === 'aliados' ? src.side : (src.side === 'herois' ? 'inimigos' : 'herois');
      for (const f of st.fighters.filter((x) => x.alive && x.side === side && x.kind !== 'objeto' && !x.legendary.includes('ancora-mares') && x.rank !== 'chefe')) {
        f.line = f.line === 'frente' ? 'tras' : 'frente';
      }
      log(st, `🌪️ As linhas ${side === 'herois' ? 'do grupo' : 'inimigas'} são trocadas!`);
      break;
    }
    case 'casulo':
      for (const t of resolveOn(st, src, e, primary)) {
        if (t.kind !== 'jogador' || !t.alive) continue;
        const obj = spawnObject(st, 'casulo', src);
        if (!obj || !obj.object) continue;
        obj.object.holds = t.id;
        obj.name = `Casulo de ${t.name}`;
        applyStatusRaw(t, { id: 'casulo', dur: 99, stacks: 1, potency: 0, source: obj.id });
        log(st, `🕸️ ${t.name} é preso em um casulo! Destruam o casulo para libertá-lo.`);
      }
      break;
    case 'copiar_habilidade': {
      const t = resolveOn(st, src, e, primary).find((x) => x.kind === 'jogador') ?? r.pick(heroesOf(st).filter((x) => x.alive && x.kind === 'jogador'));
      if (!t || !src.boss) break;
      const candidates = t.skills.filter((s) => !s.culminant);
      if (!candidates.length) break;
      const sk = r.pick(candidates);
      src.boss.copied = copySkillAsAbility(sk, t.name);
      log(st, `🎭 ${src.name} rouba o rosto de ${t.name} e aprende **${sk.name}**!`);
      break;
    }
    case 'campo':
      setField(st, e.id, e.dur);
      break;
    case 'comandar':
      for (const m of st.fighters.filter((x) => x.alive && x.ownerId === src.id)) {
        const t = primary.find((p) => p.alive && p.side !== src.side);
        if (!t) break;
        minionAct(st, m, r, t.id, e.mult);
      }
      break;
    case 'recarga':
      break;
    case 'detonar_sangramento':
      for (const t of resolveOn(st, src, e, primary)) {
        const b = statusOf(t, 'sangramento');
        if (!b) continue;
        const dmg = Math.round(b.potency * Math.max(1, b.dur) * e.mult);
        removeStatus(t, 'sangramento');
        applyRawDamage(st, src, t, dmg, 'fisico', `💥 O sangramento de ${t.name} ferve`, r);
      }
      break;
  }
}

function copySkillAsAbility(s: ResolvedSkill, heroName: string): MonsterAbility {
  const effects: Effect[] = [];
  for (const e of s.effects) {
    if (e.k === 'dano') effects.push({ k: 'dano', power: 0, elem: e.elem, atk: 0.9, hits: e.hits, on: e.on === 'si' ? 'si' : undefined });
    else if (e.k === 'cura') effects.push({ k: 'cura', power: 0, pctMax: 0.08, on: 'si' });
    else if (e.k === 'escudo') effects.push({ k: 'escudo', power: 0, scale: {}, dur: e.dur, on: 'si' });
    else if (e.k === 'status') {
      const info = STATUS_INFO[e.id];
      effects.push({ ...e, potency: DOTS.has(e.id) ? 0 : e.potency, scale: undefined, on: info.bad ? undefined : 'si' });
    } else if (e.k === 'interromper' || e.k === 'provocar' || e.k === 'mover') effects.push(e);
  }
  const target: MonsterTarget = s.target === 'todos_inimigos' ? 'todos' : s.target === 'linha_inimiga' ? 'linha_frente' : s.target === 'inimigo' ? 'aleatorio' : 'si';
  return { id: 'copiada', name: `${s.name} (cópia)`, telegraph: `{n} imita ${s.name}, de ${heroName}, contra {a}.`, target, range: s.range, effects, weight: 1 };
}

// ---------------------------------------------------------------- dano

interface DamageCtx { single: boolean; melee: boolean; basic?: boolean; skill?: ResolvedSkill; mult?: number; quiet?: boolean; reflected?: boolean }

function damageMultiplier(st: CombatState, src: Fighter, tgt: Fighter, e: DamageEffect, ctx: DamageCtx): number {
  let m = 1;
  const add = (v: number) => { m *= 1 + v / 100; };
  for (const s of src.statuses) {
    if (s.id === 'fortalecido') add(s.potency);
    if (s.id === 'enfraquecido') add(-s.potency);
    if (s.id === 'forma_pantera') add(s.potency);
    if (s.id === 'forma_ceifador') add(s.potency);
    if (s.id === 'determinacao') add(s.potency * s.stacks);
    if (s.id === 'duelo' && hasStatusFrom(tgt, 'provocado', src.id)) add(s.potency);
  }
  const b = src.bonus;
  add(b.dano ?? 0);
  if (e.elem === 'fisico') add(b.dano_fisico ?? 0); else add(b.dano_magico ?? 0);
  if (e.elem === 'raio') add(b.dano_raio ?? 0);
  if (!ctx.melee) add(b.dano_distancia ?? 0);
  for (const hk of src.hooks) {
    if (hk.t === 'dano_vs_status' && hasStatus(tgt, hk.status)) add(hk.pct);
    if (hk.t === 'dano_vida_perdida') add(hk.maxPct * (1 - hpFrac(src)));
    if (hk.t === 'dano_alvo_abaixo' && hpFrac(tgt) < hk.below) add(hk.pct);
    if (hk.t === 'retaguarda_distancia' && !ctx.melee && src.line === 'tras') add(hk.pct);
    if (hk.t === 'combo' && src.combo) add(hk.pctPerLink * src.combo.chain);
  }
  if (src.boss) add(src.boss.atkMultBonus * 100);
  for (const meter of st.meters) {
    if (src.boss && meter.def.empowerAbove !== undefined && meter.value > meter.def.empowerAbove) add(meter.value - meter.def.empowerAbove);
  }
  if (ctx.skill?.tags.includes('furtivo') && hasStatus(src, 'oculto')) { m *= 2; removeStatus(src, 'oculto'); }
  if (ctx.skill?.tags.includes('bonus_evasivo') && hasStatus(src, 'evasivo')) add(50);
  if (e.bonusVs) {
    const bv = e.bonusVs;
    const ok = (bv.status && hasStatus(tgt, bv.status)) || (bv.hpBelow !== undefined && hpFrac(tgt) < bv.hpBelow)
      || (bv.tag && tgt.tags.includes(bv.tag)) || (bv.charging && !!tgt.intent?.charging);
    if (ok) m *= bv.mult;
  }
  if (ctx.mult) m *= ctx.mult;
  // Defensor
  for (const s of tgt.statuses) {
    if (s.id === 'vulneravel' || s.id === 'marcado') add(s.potency);
    if (s.id === 'fortificado' || s.id === 'forma_urso') add(-s.potency);
    if (s.id === 'determinacao') add(-s.potency * s.stacks);
    if (s.id === 'duelo' && hasStatusFrom(src, 'provocado', tgt.id)) add(-30);
  }
  if (tgt.defending) add(-(50 + tgt.block * 0.5));
  for (const ally of allies(st, tgt)) {
    for (const hk of ally.hooks) if (hk.t === 'linha_reducao' && ally.line === tgt.line) add(-hk.pct);
  }
  if (tgt.boss) {
    const protect = Math.min(80, st.fighters.filter((f) => f.alive && f.object?.protects && f.summonedBy === tgt.id).reduce((s, f) => s + (f.object!.protects ?? 0), 0));
    if (protect) add(-protect);
  }
  if (tgt.traits.includes('carapaca') && !hasStatus(tgt, 'exposto')) add(-60);
  if (hasStatus(tgt, 'congelado') && e.elem === 'fisico') add(25);
  if (tgt.weak.includes(e.elem)) add(50);
  if (tgt.resistList.includes(e.elem)) add(-50);
  if (tgt.legendary.includes('coracao-glacial') && e.elem === 'fogo') add(15);
  if (tgt.legendary.includes('brasa-primordial') && e.elem === 'gelo') add(10);
  if (tgt.legendary.includes('escama-dragao') && !tgt.hitThisRound) add(-30);
  return Math.max(0, m);
}

function hasStatusFrom(f: Fighter, id: StatusId, source: string) {
  return f.statuses.some((s) => s.id === id && s.source === source && s.dur > 0);
}

/** Pipeline completo de um golpe. Retorna o dano aplicado, ou -1 se errou. */
function dealDamage(st: CombatState, src: Fighter, tgt: Fighter, e: DamageEffect, ctx: DamageCtx, r: Rng): number {
  if (!tgt.alive) return 0;
  // Objetos em ordem: só o próximo da sequência pode ser atingido.
  if (isOrderLocked(st, tgt) || (tgt.boss && bossLockedByOrder(st, tgt))) {
    if (!ctx.quiet) log(st, `🔒 ${tgt.name} está protegido — quebre a sequência na ordem certa.`);
    return 0;
  }
  // Esquiva
  if (!ctx.quiet && src.side !== tgt.side) {
    if (ctx.single && hasStatus(tgt, 'imagem')) {
      const im = statusOf(tgt, 'imagem')!;
      im.stacks -= 1;
      if (im.stacks <= 0) removeStatus(tgt, 'imagem');
      log(st, `🪞 O golpe atinge uma imagem de ${tgt.name}.`);
      return -1;
    }
    const evasivo = hasStatus(tgt, 'marcado') ? 0 : (statusOf(tgt, 'evasivo')?.potency ?? 0);
    const blind = statusOf(src, 'cegueira')?.potency ?? 0;
    const lineDebuff = allies(st, tgt).reduce((s, a) => s + a.hooks.reduce((x, h) => x + (h.t === 'linha_precisao_inimiga' && a.line === tgt.line ? h.pct : 0), 0), 0);
    let miss = tgt.dodge + evasivo + blind + lineDebuff - (src.accuracy - 90) - (hasStatus(tgt, 'lento') ? 10 : 0);
    if (!ctx.single) miss /= 2;
    if (hasStatus(tgt, 'atordoado') || hasStatus(tgt, 'congelado') || hasStatus(tgt, 'casulo') || tgt.kind === 'objeto') miss = 0;
    if (r.chance(Math.max(0, Math.min(75, miss)) / 100)) {
      log(st, `💨 ${tgt.name} esquiva de ${src.name}.`);
      tgt.dodgedLastRound = true;
      for (const hk of tgt.hooks) if (hk.t === 'ao_esquivar') {
        gainResource(tgt, hk.recurso ?? 0);
        if (hk.status) applyStatusRaw(tgt, { id: hk.status, dur: 1, stacks: 1, potency: hk.potency ?? 10 });
      }
      if (tgt.legendary.includes('seda-viva') && ctx.melee) applyStatusRaw(src, { id: 'enraizado', dur: 1, stacks: 1, potency: 0 });
      return -1;
    }
    // Redirecionar
    const redir = statusOf(tgt, 'redirecionar');
    if (redir && ctx.single && !ctx.reflected) {
      removeStatus(tgt, 'redirecionar');
      const raw = baseDamage(src, e, ctx) * damageMultiplier(st, src, tgt, e, ctx);
      log(st, `🌀 ${tgt.name} redireciona o golpe de volta a ${src.name}!`);
      applyRawDamage(st, tgt, src, Math.round(raw * redir.potency / 100), e.elem, '', r);
      return 0;
    }
  }

  let amount = baseDamage(src, e, ctx) * damageMultiplier(st, src, tgt, e, ctx);
  // Combinações elementais
  const synergy = 1 + ((src.bonus.efeito_elemental ?? 0) / 100);
  if (e.elem === 'raio' && hasStatus(tgt, 'molhado') && !e.bonusVs?.status) amount *= 1 + 0.5 * synergy;
  if (e.elem === 'fogo' && hasStatus(tgt, 'molhado')) { amount *= 0.75; removeStatus(tgt, 'molhado'); }
  if (e.elem === 'fogo' && hasStatus(tgt, 'oleado')) {
    amount *= 1 + 0.5 * synergy;
    removeStatus(tgt, 'oleado');
    applyStatusRaw(tgt, { id: 'queimadura', dur: 3, stacks: 1, potency: Math.round(4 + src.level * 0.5), elem: 'fogo', source: src.id });
    if (!ctx.quiet) log(st, `🛢️🔥 O óleo em ${tgt.name} pega fogo!`);
  }
  if (e.elem === 'fogo') { removeStatus(tgt, 'congelado'); removeStatus(tgt, 'resfriado'); }
  if (e.elem === 'gelo' && hasStatus(tgt, 'molhado')) addStacks(tgt, 'resfriado', 1, 3, 0);
  // Crítico
  let crit = false;
  if (src.side !== tgt.side) {
    let critChance = src.crit + (statusOf(src, 'forma_pantera') ? 20 : 0) + (ctx.skill?.id === 'apunhalar' ? 20 : 0);
    if (hasStatus(tgt, 'atordoado') || hasStatus(tgt, 'congelado')) critChance += 10;
    if (r.chance(Math.min(90, critChance) / 100)) { crit = true; amount *= 1 + src.critDmg / 100; }
  }
  // Mitigação
  const pierce = e.pierce ?? 0;
  if (e.elem === 'fisico') amount *= 1 - armorPct(tgt.armor * (1 - pierce), src.level);
  else amount *= 1 - resistPct((tgt.resist[e.elem] ?? 0) * (1 - pierce));
  // Absorção (Devorador da Aurora)
  if ((e.elem === 'fisico' && hasStatus(tgt, 'imune_fisico')) || (e.elem !== 'fisico' && hasStatus(tgt, 'imune_magico'))) {
    const healed = Math.round(amount * 0.5);
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + healed);
    if (!ctx.quiet) log(st, `🌈 ${tgt.name} absorve o golpe e recupera ${healed} de vida!`);
    return 0;
  }
  amount = Math.max(1, Math.round(amount));
  if (crit && src.kind === 'jogador') for (const hk of src.hooks) if (hk.t === 'ao_causar_dano' && hk.critOnly) gainResource(src, hk.recurso ?? 0);

  const dealt = applyRawDamage(st, src, tgt, amount, e.elem, ctx.quiet ? '' : `${crit ? '💥 Crítico! ' : ''}${tgt.name} sofre`, r, ctx);
  // Efeitos pós-golpe
  if (e.breaks || (ctx.basic && src.weapon?.breaks)) {
    if (tgt.traits.includes('carapaca') || tgt.rank === 'chefe') {
      const dur = src.legendary.includes('presa-ancestral') ? 2 : 1;
      applyStatusRaw(tgt, { id: 'exposto', dur, stacks: 1, potency: 0 });
    }
    if (tgt.boss && hasStatus(tgt, 'fortificado') && tgt.ref === 'rei-goblin') { removeStatus(tgt, 'fortificado'); log(st, '🍳 O escudo de panelas desmorona!'); }
  }
  let lifesteal = e.lifesteal ?? 0;
  if (hasStatus(src, 'forma_ceifador')) lifesteal += 0.2;
  if (src.traits.includes('drenagem')) lifesteal += 0.3;
  for (const hk of src.hooks) if (hk.t === 'ao_causar_dano' && hk.lifesteal && (!hk.elem || hk.elem === e.elem)) lifesteal += hk.lifesteal;
  if (lifesteal > 0 && dealt > 0) {
    const h = Math.round(dealt * lifesteal);
    src.hp = Math.min(src.maxHp, src.hp + h);
  }
  if (src.side === 'herois' && src.kind === 'jogador' && dealt > 0) {
    for (const hk of src.hooks) if (hk.t === 'ao_causar_dano' && hk.recurso && !hk.critOnly) gainResource(src, hk.recurso);
    if (st.stack?.reduceOnElem && st.stack.reduceOnElem.elem === e.elem) reduceStacks(src, st.stack.status, st.stack.reduceOnElem.amount);
  }
  // Medidores do chefe por elemento
  if (tgt.boss) for (const m of st.meters) {
    const d = m.def.elemDelta?.[e.elem];
    if (d) m.value = Math.max(0, Math.min(m.max, m.value + d));
  }
  // Elemental prismático: passa a resistir ao último elemento
  if (tgt.monsterId === 'elemental-prismatico' && tgt.alive) { tgt.resist = { [e.elem]: 80 }; }
  if (tgt.legendary.includes('prisma-adaptativo') && e.elem !== 'fisico') tgt.resist[e.elem] = (tgt.resist[e.elem] ?? 0) + 20;
  // Reflexos
  if (!ctx.reflected && tgt.alive && src.side !== tgt.side && dealt > 0) {
    const refl = statusOf(tgt, 'refletir')?.potency ?? 0;
    const traitRefl = (tgt.traits.includes('reflete_magia') && e.elem !== 'fisico') || (tgt.traits.includes('reflete_fisico') && e.elem === 'fisico' && ctx.melee) ? 30 : 0;
    const legend = tgt.legendary.includes('reflexo-farao') && e.elem !== 'fisico' ? 20 : 0;
    const total = (e.elem !== 'fisico' || statusOf(tgt, 'refletir')) ? refl + traitRefl + legend : traitRefl;
    if (total > 0) applyRawDamage(st, tgt, src, Math.round(dealt * total / 100), e.elem, `🪞 Reflexo: ${src.name} sofre`, r, { single: true, melee: false, reflected: true });
    // Contra-ataque
    const ca = statusOf(tgt, 'contra_ataque');
    if (ca && ctx.melee && src.alive) applyRawDamage(st, tgt, src, Math.round(ca.potency), 'fisico', `⚔️ Contra-ataque! ${src.name} sofre`, r, { single: true, melee: true, reflected: true });
  }
  return dealt;
}

function baseDamage(src: Fighter, e: DamageEffect, ctx: DamageCtx): number {
  let v = e.power;
  for (const [a, k] of Object.entries(e.scale ?? {})) v += (src.attrs[a as keyof Fighter['attrs']] ?? 0) * (k ?? 0);
  if (e.weapon && src.weapon) v += src.weapon.damage * e.weapon;
  if (e.atk) v += src.atk * e.atk;
  if (ctx.skill && e.elem !== 'fisico') v += src.magicPower * 0.5;
  if (e.power === 0 && !e.atk && !e.weapon && !e.scale) v = src.atk;
  return Math.max(0, v);
}

/** Aplica dano já calculado (escudos, interceptação, morte). */
function applyRawDamage(st: CombatState, src: Fighter, tgt: Fighter, amount: number, elem: Element, label: string, r: Rng, ctx?: DamageCtx): number {
  if (!tgt.alive || amount <= 0) return 0;
  // Interceptação
  const ic = statusOf(tgt, 'interceptado');
  if (ic && ic.source && ic.source !== src.id) {
    const guard = byId(st, ic.source);
    if (guard && guard.alive) {
      const share = Math.round(amount * ic.potency / 100);
      amount -= share;
      const gm = 1 - ((statusOf(guard, 'fortificado')?.potency ?? 0) + (guard.defending ? 50 : 0)) / 100;
      if (share > 0) {
        if (guard.hooks.some((h) => h.t === 'ao_defender') && guard.defending) {
          const hk = guard.hooks.find((h) => h.t === 'ao_defender')!;
          if (hk.t === 'ao_defender') addStacks(guard, hk.status, hk.stacks, hk.max, hk.potency);
        }
        absorb(st, src, guard, Math.max(1, Math.round(share * Math.max(0.2, gm))), elem, `🤝 ${guard.name} intercepta e sofre`, r);
      }
    }
  }
  return absorb(st, src, tgt, amount, elem, label, r, ctx);
}

function absorb(st: CombatState, src: Fighter, tgt: Fighter, amount: number, elem: Element, label: string, r: Rng, ctx?: DamageCtx): number {
  if (!tgt.alive) return 0;
  let rest = amount;
  let absorbed = 0;
  if (tgt.shield > 0) {
    absorbed = Math.min(tgt.shield, rest);
    tgt.shield -= absorbed;
    rest -= absorbed;
  }
  const before = tgt.hp;
  tgt.hp -= rest;
  if (tgt.hp <= 0 && hasStatus(tgt, 'indestrutivel')) tgt.hp = 1;
  const dealt = before - Math.max(0, tgt.hp);
  tgt.hitThisRound = true;
  if (label) log(st, `${label} **${amount}**${absorbed ? ` (${absorbed} no escudo)` : ''}${elem !== 'fisico' ? ` de ${elem}` : ''}.`);
  // Ameaça
  if (tgt.side === 'inimigos') {
    const owner = src.ownerId ?? src.id;
    tgt.threat[src.id] = (tgt.threat[src.id] ?? 0) + amount;
    if (owner !== src.id) tgt.threat[owner] = (tgt.threat[owner] ?? 0) + amount * 0.3;
  }
  if (tgt.kind === 'jogador') {
    gainResource(tgt, tgt.res?.onHurt ?? 0);
    for (const hk of tgt.hooks) if (hk.t === 'ao_receber_dano') gainResource(tgt, hk.recurso ?? 0);
    if (tgt.defending) for (const hk of tgt.hooks) if (hk.t === 'ao_defender') addStacks(tgt, hk.status, hk.stacks, hk.max, hk.potency);
  }
  if (tgt.hp <= 0) kill(st, src, tgt, r);
  else if (tgt.boss) checkPhases(st, tgt);
  else if (tgt.traits.includes('transformacao') && (tgt.phase ?? 0) === 0 && hpFrac(tgt) <= 0.5) transform(st, tgt);
  void ctx;
  return dealt;
}

function kill(st: CombatState, killer: Fighter, f: Fighter, r: Rng) {
  f.hp = 0;
  f.alive = false;
  f.shield = 0;
  f.intent = undefined;
  if (f.kind === 'objeto') {
    log(st, `💥 ${f.name} é destruído!`);
    onObjectDeath(st, f);
  } else log(st, `☠️ **${f.name}** cai!`);
  if (f.kind === 'monstro') st.kills.push({ monsterId: f.monsterId!, by: killer.ownerId ?? killer.id });
  // Recursos por abate e por morte
  const owner = killer.ownerId ? byId(st, killer.ownerId) : killer;
  if (owner && owner.kind === 'jogador' && f.side !== owner.side && f.kind !== 'objeto') {
    gainResource(owner, owner.res?.onKill ?? 0);
    for (const hk of owner.hooks) if (hk.t === 'ao_abater') {
      gainResource(owner, hk.recurso ?? 0);
      if (hk.curaPct) owner.hp = Math.min(owner.maxHp, owner.hp + Math.round(owner.maxHp * hk.curaPct));
    }
  }
  if (f.kind !== 'objeto') for (const x of living(st)) if (x.res?.onDeathAny) gainResource(x, x.res.onDeathAny);
  // Lacaios somem com o dono
  for (const m of st.fighters.filter((x) => x.alive && x.ownerId === f.id)) { m.alive = false; m.hp = 0; }
  // Chefe morto: partes e invocações também caem
  if (f.boss) {
    for (const o of st.fighters.filter((x) => x.alive && x.summonedBy === f.id)) { o.alive = false; o.hp = 0; }
    for (const h of heroesOf(st)) { removeStatus(h, 'casulo'); }
  }
  if (f.traits.includes('instabilidade')) {
    log(st, `☢️ ${f.name} explode ao morrer!`);
    const elem: Element = f.monsterId?.includes('slime') || f.monsterId?.includes('escorpiao') ? 'veneno' : (monsterById.get(f.monsterId ?? '')?.elem ?? 'fisico');
    for (const h of heroesOf(st).filter((x) => x.alive && x.line === 'frente')) {
      const amount = Math.round(f.atk * 1.0 * (1 - resistPct(h.resist[elem] ?? 0)));
      applyRawDamage(st, f, h, amount, elem, `☢️ ${h.name} sofre`, r);
    }
  }
  if (f.traits.includes('lideranca')) {
    for (const a of enemiesOf(st).filter((x) => x.alive && x.kind === 'monstro')) {
      removeStatus(a, 'fortalecido');
      applyStatusRaw(a, { id: 'enfraquecido', dur: 2, stacks: 1, potency: 10 });
    }
    log(st, '🏳️ Sem o líder, os aliados hesitam.');
  }
  if (f.kind === 'jogador') for (const o of st.fighters.filter((x) => x.alive && x.object?.holds === f.id)) { o.object!.holds = undefined; }
}

function onObjectDeath(st: CombatState, f: Fighter) {
  const o = f.object!;
  if (o.holds) {
    const h = byId(st, o.holds);
    if (h) { removeStatus(h, 'casulo'); log(st, `🕸️ ${h.name} é libertado do casulo!`); }
  }
  if (o.onDeath?.text) log(st, o.onDeath.text);
  if (o.onDeath?.meter) {
    const m = st.meters.find((x) => x.id === o.onDeath!.meter![0]);
    if (m) m.value = Math.max(0, Math.min(m.max, m.value + o.onDeath.meter[1]));
  }
  const boss = byId(st, f.summonedBy);
  if (o.onDeath?.regrow && boss?.alive && boss.boss) boss.boss.regrow.push({ defId: o.defId, rounds: o.onDeath.regrow });
  refreshOrderImmunity(st);
}

/** Objetos com ordem: apenas o de menor ordem (por papel) pode ser atingido. */
function isOrderLocked(st: CombatState, f: Fighter): boolean {
  if (!f.object?.order) return false;
  const same = st.fighters.filter((x) => x.alive && x.object?.role === f.object!.role && x.object.order !== undefined && x.summonedBy === f.summonedBy);
  const min = Math.min(...same.map((x) => x.object!.order!));
  return f.object.order > min;
}
function bossLockedByOrder(st: CombatState, boss: Fighter): boolean {
  return st.fighters.some((x) => x.alive && x.summonedBy === boss.id && x.object?.role === 'placa' && x.object.order !== undefined);
}
function refreshOrderImmunity(_st: CombatState) { /* a imunidade é calculada sob demanda em isOrderLocked/bossLockedByOrder */ }

// ---------------------------------------------------------------- cura e escudos

function heal(st: CombatState, src: Fighter, t: Fighter, e: HealEffect) {
  if (!t.alive) {
    if (!e.revive || t.kind !== 'jogador') return;
    t.alive = true;
    t.hp = Math.max(1, Math.round(t.maxHp * (e.pctMax ?? 0.3)));
    t.statuses = [];
    log(st, `🌟 ${t.name} é trazido de volta com ${t.hp} de vida!`);
    return;
  }
  let v = e.power + (e.pctMax ?? 0) * t.maxHp;
  for (const [a, k] of Object.entries(e.scale ?? {})) v += (src.attrs[a as keyof Fighter['attrs']] ?? 0) * (k ?? 0);
  if (src.kind === 'jogador' && e.power > 0) v += src.healPower * 0.5;
  if (src.kind !== 'jogador' && e.power === 0 && !e.pctMax) v = src.atk;
  v *= 1 + (src.bonus.cura ?? 0) / 100;
  v *= 1 + (t.bonus.cura_recebida ?? 0) / 100;
  if (hasStatus(t, 'decadencia')) v *= 0.5;
  if (t.legendary.includes('reflexo-farao')) v *= 0.9;
  if (e.revive && e.pctMax) v = Math.max(v, t.maxHp * 0.5);
  v = Math.round(v);
  const missing = t.maxHp - t.hp;
  const healed = Math.min(missing, v);
  t.hp += healed;
  const over = v - healed;
  if (over > 0) for (const hk of src.hooks) if (hk.t === 'cura_excedente_escudo') {
    t.shield += Math.round(over * hk.pct / 100); t.shieldDur = Math.max(t.shieldDur, 2);
  }
  if (healed > 0) {
    log(st, `💚 ${t.name} recupera **${healed}** de vida.`);
    if (st.stack?.reduceOnHeal && t.side === 'herois') reduceStacks(t, st.stack.status, st.stack.reduceOnHeal);
    if (src.side === 'herois') for (const en of opponents(st, src)) en.threat[src.id] = (en.threat[src.id] ?? 0) + healed * 0.4;
  }
}

function giveShield(st: CombatState, src: Fighter, t: Fighter, e: ShieldEffect) {
  if (!t.alive) return;
  let v = e.power;
  for (const [a, k] of Object.entries(e.scale ?? {})) v += (src.attrs[a as keyof Fighter['attrs']] ?? 0) * (k ?? 0);
  if (src.kind !== 'jogador' && e.power === 0) v = src.atk * 1.2;
  if (src.kind === 'lacaio' && e.power === 0) v = src.atk * 1.0;
  if (src.kind === 'jogador') v *= 1 + (src.bonus.cura ?? 0) / 200;
  v = Math.round(v);
  t.shield = Math.max(t.shield, 0) + v;
  t.shieldDur = Math.max(t.shieldDur, e.dur);
  log(st, `🛡️ ${t.name} recebe um escudo de **${v}**.`);
}

// ---------------------------------------------------------------- estados

function statusPotency(src: Fighter, e: StatusEffect): number {
  let p = e.potency ?? 0;
  for (const [a, k] of Object.entries(e.scale ?? {})) p += (src.attrs[a as keyof Fighter['attrs']] ?? 0) * (k ?? 0);
  if ((e.potency ?? 0) === 0 && !e.scale && (DOTS.has(e.id) || e.id === 'regeneracao' || e.id === 'detonacao' || e.id === 'contra_ataque')) p = src.atk * 0.3;
  return Math.round(p);
}

export function applyStatus(st: CombatState, src: Fighter, t: Fighter, e: StatusEffect, r: Rng): boolean {
  if (!t.alive) return false;
  const info = STATUS_INFO[e.id];
  const control = CONTROL.has(e.id) || e.id === 'enraizado';
  let chance = e.chance ?? 1;
  if (info.bad && t.side !== src.side) {
    if (control && hasStatus(t, 'firmeza')) { log(st, `🗿 ${t.name} resiste (${info.label}).`); return false; }
    if (e.id === 'congelado' && t.legendary.includes('coracao-glacial')) return false;
    if (t.kind === 'objeto') return false;
    if (control) {
      chance *= 1 - Math.min(0.6, t.ctrlRes / 100);
      if (t.rank === 'chefe') chance *= Math.pow(0.75, t.ctrlStacks);
    }
    if (DOTS.has(e.id)) chance *= 1 - Math.min(0.5, (t.resist.veneno ?? 0) / 400);
  }
  if (!r.chance(chance)) {
    if ((e.chance ?? 1) < 1 || control) log(st, `${t.name} resiste a ${info.label}.`);
    return false;
  }
  let dur = e.dur;
  if (info.bad && t.side !== src.side) dur += src.bonus.duracao_debuff ?? 0;
  if (control && t.rank === 'chefe') {
    dur = Math.max(1, dur - Math.floor(t.ctrlStacks / 2));
    t.ctrlStacks += 1;
  }
  const potency = statusPotency(src, e);
  if (e.id === 'resfriado') {
    addStacks(t, 'resfriado', e.stacks ?? 1, 99, 0);
    const s = statusOf(t, 'resfriado')!;
    s.dur = Math.max(s.dur, dur);
    if (s.stacks >= 3) {
      removeStatus(t, 'resfriado');
      return applyStatus(st, src, t, { k: 'status', id: 'congelado', dur: 1 }, r);
    }
    log(st, `❄️ ${t.name}: Resfriado ${s.stacks}/3.`);
    return true;
  }
  if (e.id === 'geada' || e.id === 'esporos') {
    addStacks(t, e.id, e.stacks ?? 1, 99, 0);
    checkStackThreshold(st, t, r);
    return true;
  }
  if (STACKING[e.id] && e.id !== 'fortalecido') {
    addStacks(t, e.id, e.stacks ?? 1, STACKING[e.id]!, potency);
    const s = statusOf(t, e.id)!;
    s.dur = Math.max(s.dur, dur);
  } else {
    applyStatusRaw(t, { id: e.id, dur, stacks: 1, potency, source: src.id, elem: e.elem });
  }
  if (info.bad || ['fortalecido', 'fortificado', 'regeneracao', 'indestrutivel', 'firmeza'].includes(e.id)) {
    const extra = DOTS.has(e.id) || e.id === 'regeneracao' ? ` (${potency}/rodada)` : potency && !['detonacao', 'contra_ataque'].includes(e.id) ? ` (${potency}%)` : '';
    log(st, `${info.icon} ${t.name}: ${info.label}${extra} por ${dur} rodada(s).`);
  }
  return true;
}

function applyStatusRaw(t: Fighter, s: StatusInst) {
  const ex = t.statuses.find((x) => x.id === s.id && (s.id !== 'interceptado' || x.source === s.source) && (s.id !== 'provocado' || true));
  if (ex) {
    ex.dur = Math.max(ex.dur, s.dur);
    ex.potency = Math.max(ex.potency, s.potency);
    if (s.source) ex.source = s.source;
    if (s.elem) ex.elem = s.elem;
  } else t.statuses.push({ ...s });
}

function addStacks(t: Fighter, id: StatusId, n: number, max: number, potency: number, refreshDur = false) {
  const ex = statusOf(t, id);
  if (ex) {
    ex.stacks = Math.min(max, ex.stacks + n);
    ex.potency = Math.max(ex.potency, potency);
    if (refreshDur) ex.dur = Math.max(ex.dur, 99);
  } else t.statuses.push({ id, dur: id === 'determinacao' || refreshDur ? 99 : 3, stacks: Math.min(max, n), potency });
}

function reduceStacks(t: Fighter, id: StatusId, n: number) {
  const ex = statusOf(t, id);
  if (!ex) return;
  ex.stacks -= n;
  if (ex.stacks <= 0) removeStatus(t, id);
}

function checkStackThreshold(st: CombatState, t: Fighter, r: Rng) {
  if (!st.stack) return;
  const s = statusOf(t, st.stack.status);
  if (!s || s.stacks < st.stack.threshold) return;
  removeStatus(t, st.stack.status);
  log(st, `${STATUS_INFO[st.stack.status].icon} ${t.name} atinge o limite de ${STATUS_INFO[st.stack.status].label}!`);
  const boss = bossOf(st) ?? t;
  for (const e of st.stack.effects) if (e.k === 'status') applyStatus(st, boss, t, e, r);
}

function cleanse(st: CombatState, t: Fighter, count: number) {
  const bad = t.statuses.filter((s) => STATUS_INFO[s.id].bad && s.id !== 'casulo' && s.id !== 'provocado');
  bad.sort((a, b) => Number(CONTROL.has(b.id)) - Number(CONTROL.has(a.id)) || Number(DOTS.has(b.id)) - Number(DOTS.has(a.id)));
  const removed = bad.slice(0, count);
  if (!removed.length) return;
  t.statuses = t.statuses.filter((s) => !removed.includes(s));
  log(st, `✨ ${t.name} é purificado (${removed.map((s) => STATUS_INFO[s.id].label).join(', ')}).`);
}

function dispel(st: CombatState, t: Fighter, count: number) {
  let n = count;
  if (t.shield > 0) { t.shield = 0; n--; log(st, `💨 O escudo de ${t.name} se desfaz.`); }
  const good = t.statuses.filter((s) => !STATUS_INFO[s.id].bad && !['determinacao', 'combo', 'interceptado', 'imune_fisico', 'imune_magico'].includes(s.id));
  const removed = good.slice(0, Math.max(0, n));
  if (removed.length) {
    t.statuses = t.statuses.filter((s) => !removed.includes(s));
    log(st, `💨 ${t.name} perde ${removed.map((s) => STATUS_INFO[s.id].label).join(', ')}.`);
  }
}

function interrupt(st: CombatState, src: Fighter, t: Fighter, r: Rng) {
  if (t.side === src.side || !t.alive) return;
  if (t.object?.role === 'sigilo') {
    if (isOrderLocked(st, t)) {
      log(st, `⚠️ Ordem errada! ${t.name} explode.`);
      if (t.object.fuse) executeAbility(st, t, t.object.fuse.ability, undefined, r);
    } else log(st, `✋ ${t.name} é desfeito na ordem certa.`);
    kill(st, src, t, r);
    return;
  }
  if (!t.intent) return;
  if (t.rank === 'chefe' && !t.intent.interruptible) { log(st, `${t.name} não pode ser interrompido agora (${t.intent.name}).`); return; }
  log(st, `✋ ${src.name} interrompe **${t.intent.name}** de ${t.name}!`);
  t.intent = undefined;
  if (t.traits.includes('regeneracao')) applyStatusRaw(t, { id: 'exposto', dur: 1, stacks: 1, potency: 0 });
  if (t.rank === 'chefe') t.ctrlStacks += 1;
}

// ---------------------------------------------------------------- invocações

function summon(st: CombatState, src: Fighter, minion: string, max: number, count: number, temp: number | undefined, r: Rng) {
  if (src.side === 'herois') {
    const owned = st.fighters.filter((f) => f.alive && f.ownerId === src.id && (f.ref === minion || (minion === 'lobo-companheiro' && f.kind === 'pet')));
    for (let i = 0; i < count; i++) {
      if (owned.length >= max) {
        const oldest = owned.shift()!;
        oldest.hp = oldest.maxHp;
        log(st, `${oldest.name} é renovado.`);
        continue;
      }
      let m: Fighter | null = null;
      if (minion === 'lobo-companheiro' && src.pet && !st.fighters.some((f) => f.alive && f.kind === 'pet' && f.ownerId === src.id)) m = buildPetMinion(src, newId(st, 'm'));
      if (!m) m = buildMinion(minion, src, newId(st, 'm'), temp);
      if (!m) return;
      if (temp) m.temp = temp;
      st.fighters.push(m);
      owned.push(m);
      for (const e of enemiesOf(st)) e.threat[m.id] = m.tags.includes('provocador') ? 40 : 5;
      log(st, `🐾 ${m.name} surge ao lado de ${src.name}.`);
    }
    return;
  }
  // Inimigos
  let ids: string[] = [];
  if (minion === '$caldeirao') ids = [r.pick(['caldeirao-venenoso', 'caldeirao-nevoa', 'caldeirao-fortificante'])];
  else if (minion === '$sigilos') ids = ['sigilo-1', 'sigilo-2', 'sigilo-3'];
  else if (minion === '$ecos') {
    const pool = BOSSES.filter((b) => b.id !== 'primeira-fenda');
    ids = Array.from({ length: count }, () => `eco:${r.pick(pool).id}`);
  } else ids = Array.from({ length: count }, () => minion);
  for (const id of ids) {
    const alive = st.fighters.filter((f) => f.alive && f.summonedBy === src.id && (f.ref === id || f.object?.defId === id || (id.startsWith('eco:') && f.name.startsWith('Eco')) || (minion === '$caldeirao' && f.object?.role === 'campo')));
    if (alive.length >= max) continue;
    if (enemyObjectById.has(id)) {
      if (id.startsWith('sigilo') && st.fighters.some((f) => f.alive && f.object?.defId === id)) continue;
      const o = spawnObject(st, id, src);
      if (o) log(st, `🔮 ${o.name} surge!`);
      continue;
    }
    const isEcho = id.startsWith('eco:');
    const def = monsterById.get(isEcho ? id.slice(4) : id);
    if (!def) continue;
    if (st.fighters.filter((f) => f.alive && f.side === 'inimigos' && f.kind === 'monstro').length >= 3 + st.context.partySize) continue;
    const m = spawnMonster(st, def, {
      level: Math.min(src.level, def.level + 5), summonedBy: src.id, echo: isEcho,
      hpMult: isEcho ? 0.12 : src.rank === 'chefe' ? 0.6 : 0.7, atkMult: isEcho ? 0.6 : 0.85,
    });
    m.xp = Math.round((m.xp ?? 0) * 0.3);
    log(st, `➕ ${m.name} entra no combate!`);
  }
  void ENEMY_OBJECTS;
}

// ---------------------------------------------------------------- lacaios e pet

function minionsAndPetAct(st: CombatState, owner: Fighter, r: Rng, action: PlayerAction) {
  const target = 'targetId' in action ? action.targetId : undefined;
  for (const m of st.fighters.filter((f) => f.alive && f.ownerId === owner.id)) {
    if (controlledSkip(st, m)) continue;
    minionAct(st, m, r, target, 1);
  }
  if (owner.pet && owner.alive && !hasStatus(owner, 'casulo') && !st.fighters.some((f) => f.alive && f.kind === 'pet' && f.ownerId === owner.id)) {
    if (owner.pet.assistCd > 0) { owner.pet.assistCd--; return; }
    const aff = PET_AFFINITIES[owner.pet.affinity];
    if (!aff) return;
    owner.pet.assistCd = 1;
    const petAsFighter: Fighter = { ...owner, id: `${owner.id}:pet`, name: owner.pet.name, atk: owner.pet.atk, attrs: { ...owner.attrs }, kind: 'lacaio', ownerId: owner.id, hooks: [], bonus: {}, statuses: [], legendary: [] };
    let primary: Fighter[] = [];
    if (aff.assist.target === 'inimigo') {
      const t = (target && byId(st, target)?.alive && byId(st, target)!.side !== owner.side ? byId(st, target) : undefined) ?? pickTarget(st, owner, undefined, false, r);
      primary = t ? [t] : [];
    } else if (aff.assist.target === 'aliado_ferido') primary = [allies(st, owner).sort((a, b) => hpFrac(a) - hpFrac(b))[0]].filter(Boolean);
    else primary = [owner];
    if (!primary.length) return;
    log(st, `🐾 ${owner.pet.name} ajuda: ${aff.assist.name}.`);
    for (const e of aff.assist.effects) {
      if (e.k === 'interceptar') { applyStatusRaw(owner, { id: 'fortificado', dur: 1, stacks: 1, potency: 15 }); continue; }
      if (e.k === 'escudo') { owner.shield += Math.round(owner.pet.atk * 0.8); owner.shieldDur = Math.max(owner.shieldDur, 1); continue; }
      applyEffect(st, petAsFighter, e, primary, r, { melee: true });
    }
  }
  void SKILLS;
}

function minionAct(st: CombatState, m: Fighter, r: Rng, preferTarget: string | undefined, mult: number) {
  const ab = m.abilities?.[0];
  if (!ab) return;
  let primary: Fighter[] = [];
  if (ab.target === 'aliado_ferido') {
    const a = allies(st, m).filter((x) => x.kind !== 'objeto').sort((x, y) => hpFrac(x) - hpFrac(y))[0];
    if (!a || hpFrac(a) >= 1) return;
    primary = [a];
  } else if (ab.target === 'aliados') primary = allies(st, m);
  else {
    const melee = ab.range === 'corpo';
    const pt = preferTarget ? byId(st, preferTarget) : undefined;
    const valid = validTargets(st, m, 'inimigo', melee && m.line === 'frente' ? true : melee);
    const t = (pt && valid.includes(pt) ? pt : undefined) ?? valid.sort((a, b) => hpFrac(a) - hpFrac(b))[0];
    if (!t) return;
    primary = [t];
  }
  log(st, `🐾 ${m.name}: ${ab.name}${primary.length === 1 && primary[0].side !== m.side ? ` em ${primary[0].name}` : ''}.`);
  applyEffects(st, m, ab.effects, primary, r, { melee: ab.range === 'corpo', mult });
}

// ---------------------------------------------------------------- itens, doma, análise

function useItem(st: CombatState, h: Fighter, itemId: string, targetId: string | undefined) {
  const b = h.belt?.find((x) => x.item === itemId && x.qty > 0);
  const def = itemById.get(itemId);
  if (!b || !def?.use) return;
  b.qty--;
  st.consumed[h.ref] = st.consumed[h.ref] ?? {};
  st.consumed[h.ref][itemId] = (st.consumed[h.ref][itemId] ?? 0) + 1;
  if (def.kind === 'pocao') h.potionCd = POTION_COOLDOWN + 1;
  let t = targetId ? byId(st, targetId) : h;
  if (!t || !t.alive || t.side !== h.side) t = h;
  const u = def.use;
  log(st, `🧪 ${h.name} usa **${def.name}**${t.id !== h.id ? ` em ${t.name}` : ''}.`);
  switch (u.t) {
    case 'cura': {
      const v = Math.round(u.power + u.pct * t.maxHp);
      const healed = Math.min(t.maxHp - t.hp, v);
      t.hp += healed;
      log(st, `💚 ${t.name} recupera **${healed}** de vida.`);
      break;
    }
    case 'recurso': gainResource(t, u.amount); log(st, `🔷 ${t.name} recupera ${u.amount} de ${t.res?.name ?? 'recurso'}.`); break;
    case 'purificar':
      t.statuses = t.statuses.filter((s) => !u.statuses.includes(s.id));
      log(st, `✨ ${t.name} é purificado.`);
      break;
    case 'resistencia':
      t.resist[u.elem] = (t.resist[u.elem] ?? 0) + u.amount;
      log(st, `🛡️ ${t.name}: +${u.amount} de resistência a ${u.elem} até o fim do combate.`);
      break;
    case 'regeneracao':
      applyStatusRaw(t, { id: 'regeneracao', dur: u.rounds, stacks: 1, potency: u.power });
      log(st, `💚 ${t.name} ganha Regeneração.`);
      break;
    default:
      log(st, 'Nada acontece.');
  }
}

function tryTame(st: CombatState, h: Fighter, targetId: string, itemId: string, r: Rng) {
  const t = byId(st, targetId);
  const b = h.belt?.find((x) => x.item === itemId && x.qty > 0);
  const isca = itemById.get(itemId)?.use;
  if (!t || !t.alive || !b || !isca || isca.t !== 'isca') return;
  b.qty--;
  st.consumed[h.ref] = st.consumed[h.ref] ?? {};
  st.consumed[h.ref][itemId] = (st.consumed[h.ref][itemId] ?? 0) + 1;
  const tier = tierOfLevel(t.level);
  const limit = t.rank === 'variante' ? 0.25 : 0.35;
  if (tier > isca.maxTier) { log(st, `🪤 ${t.name} ignora a isca — é fraca demais para uma criatura deste porte.`); return; }
  if (hpFrac(t) > limit) { log(st, `🪤 ${t.name} ainda está forte demais para ser domado (abaixo de ${Math.round(limit * 100)}% de vida).`); return; }
  let chance = 0.3 + (limit - hpFrac(t)) * 1.2 + h.attrs.percepcao * 0.004 + h.attrs.espirito * 0.003 + isca.bonus - Math.max(0, t.level - h.level) * 0.05;
  if (t.rank === 'variante') chance *= 0.5;
  chance = Math.max(0.05, Math.min(0.9, chance));
  if (r.chance(chance)) {
    t.alive = false;
    t.hp = 0;
    t.intent = undefined;
    st.tamed.push({ ownerId: h.ref, monsterId: t.monsterId!, level: t.level });
    log(st, `🐾 **${t.name} foi domado por ${h.name}!** (chance ${Math.round(chance * 100)}%)`);
  } else {
    applyStatusRaw(t, { id: 'fortalecido', dur: 2, stacks: 1, potency: 20 });
    log(st, `🪤 ${t.name} rejeita a isca e fica furioso! (chance ${Math.round(chance * 100)}%)`);
  }
}

function analyze(st: CombatState, h: Fighter, targetId: string) {
  const t = byId(st, targetId);
  if (!t || !t.monsterId) { log(st, `${h.name} observa o campo.`); return; }
  st.revealed.push({ ownerId: h.ref, monsterId: t.monsterId });
  const weak = t.weak.length ? t.weak.join(', ') : 'nenhuma evidente';
  const res = t.resistList.length ? t.resistList.join(', ') : 'nenhuma';
  log(st, `🔍 ${h.name} analisa ${t.name}: fraco contra **${weak}**; resiste a ${res}.`);
  applyStatusRaw(t, { id: 'marcado', dur: 2, stacks: 1, potency: 5 });
}

// ===================================================================== turno dos inimigos

function enemyTurn(st: CombatState, e: Fighter, r: Rng) {
  if (e.kind === 'objeto' && !e.intent) return;
  if (controlledSkip(st, e)) return;
  const it = e.intent;
  if (!it) { tickTurnStatuses(e); return; }
  if (it.chargeLeft > 0) {
    it.chargeLeft -= 1;
    log(st, `⏳ ${e.name} continua preparando **${it.name}**.`);
    tickTurnStatuses(e);
    return;
  }
  const ab = abilityById(e, it.ability);
  e.intent = undefined;
  if (!ab) return;
  if (hasStatus(e, 'silenciado') && ab.id !== 'basico' && e.kind !== 'objeto') {
    log(st, `🤐 ${e.name} está silenciado e só consegue um ataque simples.`);
    const basic = e.abilities?.find((a) => a.id === 'basico');
    if (basic) executeAbility(st, e, basic, it.targetId, r);
    tickTurnStatuses(e);
    return;
  }
  executeAbility(st, e, ab, it.targetId, r);
  if (ab.cooldown) e.abilityCd![ab.id] = ab.cooldown + 1;
  if (e.object?.fuse && it.ability === e.object.fuse.ability.id) {
    const held = e.object.holds;
    e.alive = false;
    e.hp = 0;
    if (held) { const h = byId(st, held); if (h) { removeStatus(h, 'casulo'); log(st, `🕸️ O casulo se rompe e ${h.name} cai, livre.`); } }
  }
  tickTurnStatuses(e);
}

function abilityById(e: Fighter, id: string): MonsterAbility | undefined {
  if (id === 'copiada') return e.boss?.copied;
  if (e.object?.fuse && e.object.fuse.ability.id === id) return e.object.fuse.ability;
  return e.abilities?.find((a) => a.id === id);
}

function executeAbility(st: CombatState, e: Fighter, ab: MonsterAbility, lockedTarget: string | undefined, r: Rng) {
  const primary = abilityTargets(st, e, ab, lockedTarget, r);
  const tdesc = primary.length === 1 && primary[0].id !== e.id ? ` em ${primary[0].name}` : primary.length > 1 && primary[0].side !== e.side ? ' em vários alvos' : '';
  log(st, `👹 ${e.name} usa **${ab.name}**${tdesc}.`);
  if (!primary.length && !['si', 'aliados'].includes(ab.target)) return;
  const melee = ab.range === 'corpo';
  for (const eff of ab.effects) {
    if (!e.alive) break;
    if (eff.k === 'escudo' && (ab.target === 'aliados')) {
      for (const a of allies(st, e).filter((x) => x.kind !== 'objeto')) giveShield(st, e, a, eff);
      continue;
    }
    applyEffect(st, e, eff, primary, r, { melee, ability: ab });
  }
  if (ab.effects.some((x) => x.k === 'dano') && ab.charge && e.traits.includes('carapaca')) applyStatusRaw(e, { id: 'exposto', dur: 2, stacks: 1, potency: 0 });
}

function heroCandidates(st: CombatState, e: Fighter, melee: boolean, includeHidden = false): Fighter[] {
  let c = st.fighters.filter((f) => f.alive && f.side !== e.side && (includeHidden || !hasStatus(f, 'oculto')));
  if (melee && c.some((f) => f.line === 'frente')) c = c.filter((f) => f.line === 'frente');
  return c;
}

function abilityTargets(st: CombatState, e: Fighter, ab: MonsterAbility, locked: string | undefined, r: Rng): Fighter[] {
  const melee = ab.range === 'corpo';
  switch (ab.target) {
    case 'si': return [e];
    case 'aliados': return allies(st, e);
    case 'aliado_ferido': { const a = allies(st, e).filter((x) => x.kind !== 'objeto').sort((x, y) => hpFrac(x) - hpFrac(y))[0]; return a ? [a] : []; }
    case 'todos': return st.fighters.filter((f) => f.alive && f.side !== e.side);
    case 'linha_frente': {
      const front = st.fighters.filter((f) => f.alive && f.side !== e.side && f.line === 'frente');
      return front.length ? front : st.fighters.filter((f) => f.alive && f.side !== e.side);
    }
    case 'linha_tras': {
      const back = st.fighters.filter((f) => f.alive && f.side !== e.side && f.line === 'tras');
      return back.length ? back : st.fighters.filter((f) => f.alive && f.side !== e.side && f.line === 'frente');
    }
    default: {
      const lockedF = locked ? byId(st, locked) : undefined;
      const special = ['retaguarda', 'conjurador', 'curandeiro'].includes(ab.target);
      let valid = heroCandidates(st, e, melee && !special);
      if (ab.effects.some((x) => x.k === 'casulo' || x.k === 'copiar_habilidade')) {
        const players = heroCandidates(st, e, false, true).filter((f) => f.kind === 'jogador' && !hasStatus(f, 'casulo'));
        if (players.length) valid = players;
      }
      // Provocação
      const taunt = e.statuses.find((s) => s.id === 'provocado' && s.dur > 0);
      if (taunt) {
        const tf = byId(st, taunt.source);
        if (tf && tf.alive && heroCandidates(st, e, false).includes(tf)) return [tf];
      }
      if (lockedF && lockedF.alive && valid.includes(lockedF)) return [lockedF];
      const t = pickByPattern(st, e, ab.target, valid, r);
      return t ? [t] : [];
    }
  }
}

function pickByPattern(st: CombatState, e: Fighter, pattern: MonsterTarget, valid: Fighter[], r: Rng): Fighter | undefined {
  if (!valid.length) return undefined;
  const effective = e.targeting && pattern === 'ameaca' ? e.targeting : pattern;
  switch (effective) {
    case 'menor_vida': return [...valid].sort((a, b) => hpFrac(a) - hpFrac(b))[0];
    case 'retaguarda': { const back = valid.filter((v) => v.line === 'tras'); return r.pick(back.length ? back : valid); }
    case 'conjurador': { const m = valid.filter(isMagicUser); return r.pick(m.length ? m : valid); }
    case 'curandeiro': { const m = valid.filter(isHealer); return m.length ? r.pick(m) : [...valid].sort((a, b) => hpFrac(a) - hpFrac(b))[0]; }
    case 'aleatorio': return r.pick(valid);
    default: {
      let best = valid[0], bv = -Infinity;
      for (const v of valid) {
        const t = (e.threat[v.id] ?? 0) + (v.tags.includes('provocador') ? 30 : 0) + r.next();
        if (t > bv) { bv = t; best = v; }
      }
      return best;
    }
  }
}

// ===================================================================== intenções

export function chooseIntents(st: CombatState, r0?: Rng) {
  const r = r0 ?? rng(st);
  for (const e of st.fighters.filter((f) => f.alive && f.side === 'inimigos')) {
    if (e.intent && e.intent.chargeLeft > 0) continue;
    if (e.object?.fuse) {
      if (e.object.fuse.rounds <= 1) setIntent(st, e, e.object.fuse.ability, r);
      continue;
    }
    if (!e.abilities?.length) continue;
    const ab = chooseAbility(st, e, r);
    if (ab) setIntent(st, e, ab, r);
  }
  if (!r0) saveRng(st, r);
}

function abilityAvailable(st: CombatState, e: Fighter, a: MonsterAbility): boolean {
  if ((e.abilityCd?.[a.id] ?? 0) > 0) return false;
  if (a.phase !== undefined && a.phase !== (e.phase ?? 0) && !(a.phase === 0 && e.boss)) return false;
  if (a.hpBelow !== undefined && hpFrac(e) > a.hpBelow) return false;
  const enabler = ENEMY_OBJECTS.find((o) => o.enables === a.id);
  if (enabler && e.boss && !st.fighters.some((f) => f.alive && f.summonedBy === e.id && f.object?.defId === enabler.id)) return false;
  if (a.effects.some((x) => x.k === 'invocar')) {
    const inv = a.effects.find((x) => x.k === 'invocar') as { minion: string; max: number };
    const count = st.fighters.filter((f) => f.alive && f.summonedBy === e.id).length;
    if (count >= Math.max(inv.max, 3) + 2) return false;
  }
  if (a.effects.every((x) => x.k === 'cura') && hpFrac(e) > 0.75) return false;
  if (a.effects.some((x) => x.k === 'status' && (x.id === 'imune_fisico' || x.id === 'imune_magico')) && (hasStatus(e, 'imune_fisico') || hasStatus(e, 'imune_magico'))) return false;
  return true;
}

function chooseAbility(st: CombatState, e: Fighter, r: Rng): MonsterAbility | undefined {
  if (e.boss?.copied) {
    const c = e.boss.copied;
    e.boss.copied = undefined;
    return c;
  }
  const list = (e.abilities ?? []).filter((a) => {
    if (e.phase && e.phase > 0 && a.phase === undefined && a.id === 'basico' && e.abilities!.some((x) => x.phase === e.phase)) return false;
    return true;
  });
  if (e.rotation?.length) {
    for (let i = 0; i < e.rotation.length; i++) {
      const id = e.rotation[(e.rotIndex ?? 0) % e.rotation.length];
      e.rotIndex = (e.rotIndex ?? 0) + 1;
      const a = list.find((x) => x.id === id);
      if (a && abilityAvailable(st, e, a)) return a;
    }
  }
  const avail = list.filter((a) => abilityAvailable(st, e, a));
  if (!avail.length) return list.find((a) => a.id === 'basico');
  if (e.traits.includes('regeneracao')) {
    const reg = avail.find((a) => a.id === 'regenerar');
    if (reg && hpFrac(e) < 0.7 && r.chance(0.6)) return reg;
  }
  return r.weighted(avail.map((a) => [a, a.weight ?? 1] as const));
}

function setIntent(st: CombatState, e: Fighter, ab: MonsterAbility, r: Rng) {
  let targetId: string | undefined;
  let tname = '';
  if (!['si', 'aliados', 'aliado_ferido', 'todos', 'linha_frente', 'linha_tras'].includes(ab.target)) {
    const t = abilityTargets(st, e, ab, undefined, r)[0];
    targetId = t?.id;
    tname = t?.name ?? '';
  } else if (ab.target === 'linha_frente') tname = 'a linha de frente';
  else if (ab.target === 'linha_tras') tname = 'a retaguarda';
  else if (ab.target === 'todos') tname = 'todos';
  const text = ab.telegraph.replace('{n}', e.name).replace('{a}', tname || 'alguém');
  const charge = Math.max(0, (ab.charge ?? 0) - 1);
  const intent: Intent = {
    ability: ab.id, name: ab.name, text, targetId, pattern: ab.target, chargeLeft: charge,
    charging: (ab.charge ?? 0) > 0, interruptible: ab.interruptible ?? e.rank !== 'chefe',
  };
  e.intent = intent;
}

// ===================================================================== fim da rodada

function endOfRound(st: CombatState, r: Rng) {
  // Efeitos contínuos
  for (const f of st.fighters.filter((x) => x.alive)) {
    for (const s of [...f.statuses]) {
      if (!f.alive) break;
      if (DOTS.has(s.id) && s.potency > 0) {
        const elem: Element = s.id === 'sangramento' ? 'fisico' : s.id === 'queimadura' ? (s.elem ?? 'fogo') : s.id === 'veneno' ? 'veneno' : (s.elem ?? 'sombra');
        const mult = s.id === 'sangramento' ? 1 : 1 - resistPct((f.resist[elem] ?? 0) * 0.5);
        const amt = Math.max(1, Math.round(s.potency * mult));
        const src = byId(st, s.source) ?? f;
        applyRawDamage(st, src, f, amt, elem, `${STATUS_INFO[s.id].icon} ${f.name} sofre`, r);
      }
      if (s.id === 'regeneracao' && f.alive) {
        const v = Math.min(f.maxHp - f.hp, Math.round(s.potency * (hasStatus(f, 'decadencia') ? 0.5 : 1)));
        if (v > 0) { f.hp += v; log(st, `💚 ${f.name} regenera ${v}.`); }
      }
      if (s.id === 'detonacao' && s.dur <= 1 && f.alive) {
        const src = byId(st, s.source) ?? f;
        const mult = s.elem === 'fisico' || !s.elem ? 1 - armorPct(f.armor * 0.5, src.level) : 1 - resistPct(f.resist[s.elem] ?? 0);
        const amt = Math.round(s.potency * mult);
        removeStatus(f, 'detonacao');
        applyRawDamage(st, src, f, amt, s.elem ?? 'fisico', `💣 A carga explode em ${f.name}:`, r);
      }
    }
  }
  // Regeneração natural e recursos
  for (const f of st.fighters.filter((x) => x.alive)) {
    const regenPct = f.bonus.regen_vida ?? 0;
    if (regenPct && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * regenPct / 100));
    if (f.res) {
      let regen = f.res.regen + (f.bonus.regen_recurso ?? 0);
      for (const hk of f.hooks) {
        if (hk.t === 'recurso_inicio_rodada') regen += hk.amount;
        if (hk.t === 'forma_bonus' && (hasStatus(f, 'forma_urso') || hasStatus(f, 'forma_pantera'))) regen += hk.recurso;
      }
      gainResource(f, regen);
    }
    if (f.potionCd > 0) f.potionCd--;
    for (const k of Object.keys(f.cooldowns)) {
      f.cooldowns[k] = Math.max(0, f.cooldowns[k] - 1 - (hasStatus(f, 'acelerado') ? 1 : 0));
    }
    if (f.abilityCd) for (const k of Object.keys(f.abilityCd)) f.abilityCd[k] = Math.max(0, f.abilityCd[k] - 1);
    // Traços de criaturas
    if (f.traits.includes('regeneracao') && f.hp < f.maxHp) {
      if (hasStatus(f, 'queimadura') || hasStatus(f, 'sangramento') || hasStatus(f, 'exposto')) log(st, `🔥 ${f.name} não consegue regenerar.`);
      else { const v = Math.round(f.maxHp * 0.06); f.hp = Math.min(f.maxHp, f.hp + v); log(st, `🌱 ${f.name} regenera ${v}.`); }
    }
    if (f.traits.includes('regenera_sem_fogo') && f.hp < f.maxHp && !hasStatus(f, 'queimadura')) {
      f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.04));
    }
    if (f.traits.includes('lideranca')) {
      for (const a of allies(st, f).filter((x) => x.id !== f.id && x.kind === 'monstro')) applyStatusRaw(a, { id: 'fortalecido', dur: 1, stacks: 1, potency: 15 });
    }
    // Duração dos estados (exceto os que contam por turno)
    for (const s of f.statuses) if (!TURN_STATUSES.has(s.id) && s.id !== 'casulo' && s.id !== 'determinacao') s.dur -= 1;
    f.statuses = f.statuses.filter((s) => s.dur > 0 || ((s.id === 'resfriado' || s.id === 'geada' || s.id === 'esporos' || s.id === 'imagem' || s.id === 'combo') && s.stacks > 0 && s.dur > -5) || s.id === 'casulo' || s.id === 'determinacao');
    if (f.shieldDur > 0) { f.shieldDur--; if (f.shieldDur === 0) f.shield = 0; }
    f.defending = false;
    if (f.temp !== undefined) {
      f.temp--;
      if (f.temp <= 0) { f.alive = false; f.hp = 0; log(st, `${f.name} desaparece.`); }
    }
    if (f.rank === 'chefe' && st.round % 2 === 0 && f.ctrlStacks > 0) f.ctrlStacks--;
    if (f.pet && f.pet.assistCd > 0 && !f.alive) f.pet.assistCd = 0;
  }
  // Objetos: auras, medidores e pavios
  for (const o of st.fighters.filter((x) => x.alive && x.object)) {
    const obj = o.object!;
    if (obj.aura) {
      const boss = byId(st, o.summonedBy);
      const targets = obj.aura.on === 'chefe' ? (boss?.alive ? [boss] : []) : obj.aura.on === 'jogadores'
        ? heroesOf(st).filter((h) => h.alive && h.kind === 'jogador')
        : heroesOf(st).filter((h) => h.alive && h.kind === 'jogador' && h.line === 'frente');
      for (const e of obj.aura.effects) for (const t of targets) {
        if (e.k === 'status') applyStatus(st, o, t, e, r);
        else if (e.k === 'cura') heal(st, o, t, e);
      }
    }
    if (obj.meterPerRound) {
      const m = st.meters.find((x) => x.id === obj.meterPerRound![0]);
      if (m) m.value = Math.min(m.max, m.value + obj.meterPerRound[1]);
    }
    if (obj.fuse && obj.fuse.rounds > 0) obj.fuse.rounds--;
  }
  // Campos
  for (const fl of st.fields) {
    const def = fieldById.get(fl.id);
    if (!def) continue;
    const boss = bossOf(st);
    const players = heroesOf(st).filter((h) => h.alive && h.kind === 'jogador');
    const run = (effects: Effect[] | undefined, targets: Fighter[]) => {
      for (const e of effects ?? []) for (const t of targets) {
        if (e.k === 'status') applyStatus(st, boss ?? t, t, e, r);
        else if (e.k === 'dano') applyRawDamage(st, boss ?? t, t, Math.round((boss?.atk ?? 10) * (e.atk ?? 0.3)), e.elem, `🌍 ${def.name}: ${t.name} sofre`, r);
      }
    };
    run(def.players, players);
    run(def.frontPlayers, players.filter((p) => p.line === 'frente'));
    run(def.backPlayers, players.filter((p) => p.line === 'tras'));
    if (boss) run(def.boss, [boss]);
    if (fl.id === 'distorcao') {
      for (const p of heroesOf(st).filter((h) => h.alive && h.kind !== 'objeto' && !h.legendary.includes('ancora-mares'))) p.line = p.line === 'frente' ? 'tras' : 'frente';
      log(st, '🌀 A distorção troca as linhas do grupo!');
    }
    fl.rounds--;
  }
  st.fields = st.fields.filter((f) => f.rounds > 0);
  // Chefe: medidores, acúmulos, rebrota
  const boss = bossOf(st);
  if (boss) {
    for (const m of st.meters) {
      m.value = Math.min(m.max, m.value + m.def.perRound);
      if (m.value >= m.max) {
        const ab = boss.abilities?.find((a) => a.id === m.def.onFull);
        log(st, `⚠️ ${m.label} chegou ao limite!`);
        if (ab) executeAbility(st, boss, ab, undefined, r);
        m.value = m.def.resetTo;
      }
    }
    if (st.stack) {
      st.stack.zoneRounds = (st.stack.zoneRounds ?? 0) + 1;
      if (st.stack.byLine && st.stack.zoneRounds >= 2) {
        st.stack.zone = st.stack.zone === 'frente' ? 'tras' : 'frente';
        st.stack.zoneRounds = 0;
        log(st, `🍄 Os esporos se espalham para a ${st.stack.zone === 'frente' ? 'linha de frente' : 'retaguarda'}.`);
      }
      for (const h of heroesOf(st).filter((x) => x.alive && x.kind === 'jogador')) {
        if (st.stack.byLine && h.line !== st.stack.zone) continue;
        addStacks(h, st.stack.status, st.stack.perRound, 99, 0);
        const s = statusOf(h, st.stack.status)!;
        s.dur = 99;
        checkStackThreshold(st, h, r);
      }
    }
    if (boss.boss) {
      for (const g of boss.boss.regrow) g.rounds--;
      const due = boss.boss.regrow.filter((g) => g.rounds <= 0);
      boss.boss.regrow = boss.boss.regrow.filter((g) => g.rounds > 0);
      for (const g of due) {
        const def = enemyObjectById.get(g.defId);
        if (def?.role === 'cabeca' && hasStatus(boss, 'queimadura')) { log(st, `🔥 O pescoço cauterizado não volta a crescer!`); continue; }
        const count = st.fighters.filter((f) => f.alive && f.summonedBy === boss.id && f.object?.role === def?.role).length;
        if (count >= 4) continue;
        const o = spawnObject(st, g.defId, boss);
        if (o) log(st, `🐍 ${o.name} volta a crescer!`);
        if (def?.role === 'cabeca' && count < 3 && r.chance(0.5)) {
          const extra = spawnObject(st, g.defId, boss);
          if (extra) log(st, `🐍 Duas cabeças crescem no lugar de uma!`);
        }
      }
    }
  }
  // Casulos sem objeto
  for (const h of heroesOf(st)) {
    const c = statusOf(h, 'casulo');
    if (c && !st.fighters.some((f) => f.alive && f.object?.holds === h.id)) removeStatus(h, 'casulo');
  }
  for (const f of st.fighters) f.dodgedLastRound = f.dodgedLastRound && f.hitThisRound ? false : f.dodgedLastRound;
}

function setField(st: CombatState, id: string, dur: number) {
  const def = fieldById.get(id);
  if (!def) return;
  const ex = st.fields.find((f) => f.id === id);
  if (ex) ex.rounds = Math.max(ex.rounds, dur);
  else st.fields.push({ id, rounds: dur });
  log(st, `🌍 **${def.name}**: ${def.desc}`);
}

function checkPhases(st: CombatState, boss: Fighter) {
  if (!boss.boss) return;
  const frac = hpFrac(boss);
  boss.boss.phases.forEach((p, i) => {
    if (boss.boss!.phasesDone.includes(i) || frac > p.at) return;
    boss.boss!.phasesDone.push(i);
    boss.phase = i + 1;
    log(st, `🔥 **${p.text}**`);
    if (p.field) setField(st, p.field, 99);
    for (const s of p.status ?? []) applyStatusRaw(boss, { id: s.id, dur: s.dur, stacks: 1, potency: s.potency ?? 0 });
    if (p.heal) boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(boss.maxHp * p.heal));
    for (const sm of p.summon ?? []) summon(st, boss, sm.minion, sm.count + 2, sm.count, undefined, rng(st));
  });
}

function transform(st: CombatState, f: Fighter) {
  f.phase = 1;
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.1));
  f.intent = undefined;
  applyStatusRaw(f, { id: 'fortalecido', dur: 99, stacks: 1, potency: 15 });
  log(st, `🔁 **${f.name} se transforma!** Seu comportamento muda.`);
}

// ===================================================================== fim do combate

function checkEnd(st: CombatState) {
  if (st.outcome) return;
  const enemiesAlive = st.fighters.some((f) => f.alive && f.side === 'inimigos' && f.kind === 'monstro');
  const heroesAlive = st.fighters.some((f) => f.alive && f.kind === 'jogador');
  if (!enemiesAlive) {
    st.outcome = 'vitoria';
    for (const o of st.fighters.filter((f) => f.alive && f.side === 'inimigos')) { o.alive = false; o.hp = 0; }
    log(st, '🏆 **Vitória!**');
  } else if (!heroesAlive) {
    st.outcome = 'derrota';
    log(st, '💀 **Derrota.** O grupo recua para o último ponto seguro.');
  }
}

// ===================================================================== resumo para a interface

export function describeIntent(st: CombatState, e: Fighter): string {
  const it = e.intent;
  if (!it) return '';
  const prep = it.chargeLeft > 0 ? ` (em ${it.chargeLeft + 1} rodadas)` : '';
  const tag = it.charging ? (it.interruptible ? ' ✋interrompível' : ' ⛔não interrompível') : '';
  return `${it.text}${prep}${tag}`;
}

export function bossDefOf(st: CombatState): BossDef | undefined {
  const b = st.fighters.find((f) => f.boss);
  return b ? bossById.get(b.ref) : undefined;
}
