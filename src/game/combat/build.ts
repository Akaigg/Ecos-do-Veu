import { classById, MODIFIERS, SKILLS } from '../../data/classes/index.ts';
import type { BossDef, Effect, MonsterDef } from '../../data/types.ts';
import { ATTRIBUTES } from '../../data/types.ts';
import { enemyObjectById, minionById } from '../../data/minions.ts';
import { monsterStats } from '../../data/monsters/index.ts';
import type { DerivedStats } from '../stats.ts';
import type { Fighter, ResolvedSkill } from './state.ts';

const zeroAttrs = () => Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Fighter['attrs'];

function scaleEffect(e: Effect, mult: number): Effect {
  if (e.k === 'dano') return { ...e, power: e.power * mult, scale: scaleObj(e.scale, mult), weapon: e.weapon ? e.weapon * mult : e.weapon, atk: e.atk ? e.atk * mult : e.atk };
  if (e.k === 'cura') return { ...e, power: e.power * mult, scale: scaleObj(e.scale, mult), pctMax: e.pctMax ? e.pctMax * mult : e.pctMax };
  if (e.k === 'escudo') return { ...e, power: e.power * mult, scale: scaleObj(e.scale, mult) };
  return e;
}
function scaleObj<T extends Record<string, number | undefined>>(o: T | undefined, mult: number): T | undefined {
  if (!o) return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (v ?? 0) * mult])) as T;
}

/** Aplica os modificadores aprendidos a uma habilidade equipada. */
export function resolveSkill(skillId: string, learnedMods: string[]): ResolvedSkill {
  const base = SKILLS.get(skillId);
  if (!base) throw new Error(`Habilidade desconhecida: ${skillId}`);
  let effects: Effect[] = base.effects.map((e) => ({ ...e }));
  let cost = base.cost, cooldown = base.cooldown, target = base.target, powerMult = 1;
  const mods: string[] = [];
  for (const modId of learnedMods) {
    const m = MODIFIERS.get(modId);
    if (!m || m.skill !== skillId) continue;
    mods.push(m.id);
    for (const p of m.patch ?? []) {
      if (effects[p.index]) effects[p.index] = { ...effects[p.index], ...(p.set as object) } as Effect;
    }
    if (m.add) effects = [...effects, ...m.add.map((e) => ({ ...e }))];
    if (m.powerMult) powerMult *= m.powerMult;
    cost += m.costDelta ?? 0;
    cooldown += m.cooldownDelta ?? 0;
    if (m.target) target = m.target;
  }
  if (powerMult !== 1) effects = effects.map((e) => scaleEffect(e, powerMult));
  return {
    id: base.id, name: base.name, cost: Math.max(0, cost), cooldown: Math.max(0, cooldown), range: base.range, target, effects,
    anyLine: !!base.anyLine, tags: base.tags ?? [], culminant: !!base.culminant, icon: base.icon, mods,
  };
}

export interface PlayerFighterInput {
  characterId: number;
  name: string;
  classId: string;
  level: number;
  derived: DerivedStats;
  skills: string[];
  modifiers: string[];
  belt: { item: string; qty: number }[];
  line: 'frente' | 'tras';
  pet?: Fighter['pet'];
  autoPosture?: 'defender' | 'atacar';
  oil?: { elem: Fighter['resist'] extends Partial<Record<infer E, number>> ? E : never; bonus: number; status?: string };
}

export function buildPlayerFighter(p: PlayerFighterInput): Fighter {
  const cls = classById.get(p.classId)!;
  const d = p.derived;
  const legendaryHpMult = d.legendary.includes('reliquia-veu') ? 0.92 : d.legendary.includes('pluma-vento') ? 0.9 : 1;
  const maxHp = Math.round(d.maxHp * legendaryHpMult);
  const resStart = Math.min(d.resourceMax, cls.resource.start === cls.resource.max ? d.resourceMax : cls.resource.start);
  return {
    id: `p${p.characterId}`, side: 'herois', kind: 'jogador', name: p.name, ref: String(p.characterId), level: p.level, line: p.line,
    hp: maxHp, maxHp, shield: 0, shieldDur: 0, alive: true,
    res: {
      id: cls.resource.id, name: cls.resource.name, cur: resStart, max: d.resourceMax, regen: cls.resource.regen,
      onBasic: cls.resource.onBasic ?? 0, onHurt: cls.resource.onHurt ?? 0, onKill: cls.resource.onKill ?? 0,
      onDefend: cls.resource.onDefend ?? 0, onDeathAny: cls.resource.onDeathAny ?? 0,
    },
    attrs: { ...d.attrs }, atk: Math.round(6 + p.level * 2.2 + d.weapon.damage * 0.5),
    armor: d.armor, resist: { ...d.resist }, ctrlRes: d.ctrlRes, dodge: d.dodge, crit: d.crit, critDmg: d.critDmg,
    initiative: d.initiative, accuracy: d.accuracy,
    weapon: { ...d.weapon, oil: p.oil },
    magicPower: d.magicPower, healPower: d.healPower, block: d.block, bonus: { ...d.bonus }, hooks: d.hooks, legendary: d.legendary,
    skills: p.skills.map((s) => resolveSkill(s, p.modifiers)),
    cooldowns: {}, statuses: [], threat: {}, tags: ['heroi'], weak: [], resistList: [], traits: [],
    ctrlStacks: 0, belt: p.belt.map((b) => ({ ...b })), potionCd: 0, combo: { chain: 0 },
    pet: p.pet, autoPosture: p.autoPosture ?? 'defender',
  };
}

export interface MonsterBuildOpts { id: string; partySize: number; levelOverride?: number; hpMult?: number; atkMult?: number; line?: 'frente' | 'tras'; summonedBy?: string; echo?: boolean }

export function buildMonsterFighter(m: MonsterDef, o: MonsterBuildOpts): Fighter {
  const lvl = o.levelOverride ?? m.level;
  const st = monsterStats({ ...m, level: lvl });
  const isBoss = m.rank === 'chefe' && !o.echo;
  const partyHp = isBoss ? [1, 1.8, 2.6, 3.4][Math.min(3, o.partySize - 1)] : [1, 1.5, 2.0, 2.5][Math.min(3, o.partySize - 1)];
  const hp = Math.round(st.hp * partyHp * (o.hpMult ?? 1));
  const boss = m as BossDef;
  return {
    id: o.id, side: 'inimigos', kind: 'monstro', name: m.name, ref: m.id, monsterId: m.id, level: lvl,
    line: o.line ?? m.line, hp, maxHp: hp, shield: 0, shieldDur: 0, alive: true,
    attrs: zeroAttrs(), atk: Math.round(st.atk * (o.atkMult ?? 1)), armor: st.armor,
    resist: {}, ctrlRes: isBoss ? 30 : m.rank === 'variante' ? 15 : 0, dodge: m.role === 'agil' ? 10 : m.role === 'tanque' ? 0 : 5,
    crit: 5, critDmg: 50, initiative: Math.round(10 + lvl * 0.8 + (m.role === 'agil' ? 10 : 0) + (m.role === 'cacador' ? 6 : 0)),
    accuracy: 92 + lvl * 0.2, magicPower: 0, healPower: 0, block: 0, bonus: {}, hooks: [], legendary: [],
    skills: [], cooldowns: {}, statuses: [], threat: {}, tags: m.tags, weak: m.weak, resistList: m.resist, traits: m.traits,
    abilities: m.abilities, abilityCd: {}, rotation: isBoss ? boss.rotation : undefined, rotIndex: 0,
    phase: 0, rank: o.echo ? 'variante' : m.rank, tameable: m.tameable, xp: o.echo ? 0 : m.xp, ctrlStacks: 0, summonedBy: o.summonedBy,
    boss: isBoss ? { phases: boss.phases ?? [], phasesDone: [], atkMultBonus: 0, regrow: [] } : undefined,
    potionCd: 0,
  };
}

export function buildEnemyObject(defId: string, owner: Fighter, id: string): Fighter | null {
  const def = enemyObjectById.get(defId);
  if (!def) return null;
  const hp = Math.max(20, Math.round(owner.maxHp * def.hpPct));
  return {
    id, side: 'inimigos', kind: 'objeto', name: def.name, ref: def.id, level: owner.level, line: def.line,
    hp, maxHp: hp, shield: 0, shieldDur: 0, alive: true, attrs: zeroAttrs(), atk: Math.round(owner.atk * Math.max(0.3, def.atkPct)),
    armor: Math.round(owner.armor * (def.armorPct ?? 1)), resist: {}, ctrlRes: 100, dodge: 0, crit: 0, critDmg: 50,
    initiative: owner.initiative - 1, accuracy: 95, magicPower: 0, healPower: 0, block: 0, bonus: {}, hooks: [], legendary: [],
    skills: [], cooldowns: {}, statuses: [], threat: {}, tags: ['objeto'], weak: [], resistList: [], traits: [],
    abilities: def.abilities, abilityCd: {}, ctrlStacks: 0, summonedBy: owner.id, potionCd: 0,
    object: {
      role: def.role, order: def.order, protects: def.protects, aura: def.aura, meterPerRound: def.meterPerRound,
      onDeath: def.onDeath, fuse: def.fuse ? { ...def.fuse } : undefined, enables: def.enables, defId: def.id,
    },
  };
}

export function buildMinion(defId: string, owner: Fighter, id: string, temp?: number): Fighter | null {
  const def = minionById.get(defId);
  if (!def) return null;
  const boost = 1 + ((owner.bonus.lacaios ?? 0) / 100);
  const hp = Math.max(10, Math.round(owner.maxHp * def.hpPct * boost));
  return {
    id, side: owner.side, kind: 'lacaio', name: def.name, ref: def.id, ownerId: owner.id, level: owner.level,
    line: def.line, hp, maxHp: hp, shield: 0, shieldDur: 0, alive: true, attrs: zeroAttrs(),
    atk: Math.round(owner.atk * def.atkPct * boost), armor: Math.round(owner.armor * 0.5 * (def.armorPct ?? 1)),
    resist: {}, ctrlRes: 20, dodge: 5, crit: 5, critDmg: 50, initiative: owner.initiative - 1, accuracy: 95,
    magicPower: 0, healPower: 0, block: 0, bonus: {}, hooks: [], legendary: [], skills: [], cooldowns: {}, statuses: [],
    threat: {}, tags: ['lacaio', ...(def.tags ?? []), ...(def.taunts ? ['provocador'] : [])], weak: [], resistList: [], traits: [],
    abilities: def.abilities, abilityCd: {}, ctrlStacks: 0, temp, potionCd: 0,
  };
}

/** O pet ativo entra como lacaio quando o Patrulheiro usa Chamar Companheiro. */
export function buildPetMinion(owner: Fighter, id: string): Fighter | null {
  if (!owner.pet) return null;
  const base = buildMinion('lobo-companheiro', owner, id);
  if (!base) return null;
  const petBoost = 1 + owner.pet.level / 30;
  base.name = owner.pet.name;
  base.ref = `pet:${owner.pet.id}`;
  base.kind = 'pet';
  base.tags = [...base.tags, `especie:${owner.pet.species}`];
  base.maxHp = base.hp = Math.round(base.hp * petBoost);
  base.atk = Math.round(base.atk * petBoost);
  return base;
}
