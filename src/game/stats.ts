import { ATTRIBUTES, type AttributeId, type Element, type MealBuff, type PassiveHook, type StatKey, ELEMENTS, type ArmorClass } from '../data/types.ts';
import { classById, PASSIVES } from '../data/classes/index.ts';
import { raceById } from '../data/races.ts';
import { weaponModelById, type Slot } from '../data/equipment.ts';
import { computeEquipStats, type EquipData } from './equipment.ts';

export const BASE_ATTRIBUTE = 5;
export const CREATION_POINTS = 10;
export const POINTS_PER_LEVEL = 2;
export const MAX_CLASS_LEVEL = 60;

export const xpForClassLevel = (level: number) => Math.floor(80 * Math.pow(level, 1.75) + 120);

export function attributePointsTotal(level: number): number {
  return CREATION_POINTS + (level - 1) * POINTS_PER_LEVEL;
}

export interface CharacterSnapshot {
  id: number;
  name: string;
  race: string;
  raceChoice?: string;
  origin: string;
  classId: string;
  level: number;
  /** Pontos distribuídos (sem a base). */
  allocated: Record<AttributeId, number>;
  equipment: { slot: Slot; data: EquipData }[];
  passive?: string;
  mealBuff?: MealBuff;
  resistBuffs?: Partial<Record<Element, number>>;
}

export interface DerivedStats {
  attrs: Record<AttributeId, number>;
  maxHp: number;
  armor: number;
  resist: Record<Element, number>;
  ctrlRes: number;
  dodge: number;
  crit: number;
  critDmg: number;
  initiative: number;
  accuracy: number;
  weapon: { damage: number; elem: Element; range: 'corpo' | 'distancia'; reach: boolean; scale: Partial<Record<AttributeId, number>>; breaks: boolean; model?: string };
  magicPower: number;
  healPower: number;
  block: number;
  carry: number;
  armorWeight: number;
  heaviest?: ArmorClass;
  penalties: string[];
  bonus: Partial<Record<StatKey, number>>;
  hooks: PassiveHook[];
  legendary: string[];
  resourceMax: number;
}

const CLASS_RANK: Record<ArmorClass, number> = { leve: 0, media: 1, pesada: 2 };

export function deriveStats(c: CharacterSnapshot): DerivedStats {
  const cls = classById.get(c.classId)!;
  const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a, BASE_ATTRIBUTE + (c.allocated[a] ?? 0)])) as Record<AttributeId, number>;
  if (c.mealBuff) {
    for (const [k, v] of Object.entries(c.mealBuff.stats)) if ((ATTRIBUTES as readonly string[]).includes(k)) attrs[k as AttributeId] += v ?? 0;
  }
  const bonus: Partial<Record<StatKey, number>> = {};
  const addBonus = (k: string, v: number) => { bonus[k as StatKey] = (bonus[k as StatKey] ?? 0) + v; };
  const hooks: PassiveHook[] = [];
  const passive = PASSIVES.get(c.passive ?? cls.innate.id) ?? PASSIVES.get(cls.innate.id)!;
  for (const h of passive.hooks) {
    if (h.t === 'stat') addBonus(h.stat, h.value);
    else hooks.push(h);
  }
  if (c.mealBuff) for (const [k, v] of Object.entries(c.mealBuff.stats)) if (!(ATTRIBUTES as readonly string[]).includes(k)) addBonus(k, v ?? 0);

  const resist = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  let armor = 0, weight = 0, mobility = 0, dodgeEq = 0, initEq = 0, ctrlEq = 0, magic = 0, healP = 0, block = 0;
  let heaviest: ArmorClass | undefined;
  const legendary: string[] = [];
  let weapon: DerivedStats['weapon'] = { damage: 3, elem: 'fisico', range: 'corpo', reach: false, scale: { forca: 0.6 }, breaks: false };
  let weaponCrit = 0;
  for (const { slot, data } of c.equipment) {
    const s = computeEquipStats(data);
    armor += s.armor;
    weight += s.weight;
    mobility += s.mobility;
    dodgeEq += s.dodge;
    initEq += s.initiative;
    ctrlEq += s.controle;
    magic += s.magic;
    healP += s.heal;
    for (const [k, v] of Object.entries(s.resist)) resist[k as Element] += v ?? 0;
    for (const [k, v] of Object.entries(s.bonus)) addBonus(k, v);
    if (data.legendary && !s.broken) legendary.push(data.legendary);
    if (s.armorClass && (!heaviest || CLASS_RANK[s.armorClass] > CLASS_RANK[heaviest])) heaviest = s.armorClass;
    if (slot === 'arma' && data.kind === 'arma') {
      const m = weaponModelById.get(data.model)!;
      weapon = { damage: s.damage, elem: data.oil?.elem && data.oil.fights > 0 ? weapon.elem : m.elem, range: m.range, reach: !!m.reach, scale: m.scale, breaks: !!m.breaks, model: m.id };
      weaponCrit = s.crit;
    }
    if (slot === 'secundaria') block = Math.max(block, s.block);
  }

  const race = raceById.get(c.race);
  if (race?.trait.t === 'resistencia_escolhida' && c.raceChoice && (ELEMENTS as readonly string[]).includes(c.raceChoice)) {
    resist[c.raceChoice as Element] += race.trait.amount;
  }
  for (const [k, v] of Object.entries(c.resistBuffs ?? {})) resist[k as Element] += v ?? 0;

  const penalties: string[] = [];
  let trainingPenalty = 0;
  if (heaviest && CLASS_RANK[heaviest] > CLASS_RANK[cls.armorTraining]) {
    trainingPenalty = CLASS_RANK[heaviest] - CLASS_RANK[cls.armorTraining];
    penalties.push(`Sem treinamento para armadura ${heaviest}: −${8 * trainingPenalty} iniciativa, −${4 * trainingPenalty}% esquiva, −${5 * trainingPenalty}% dano`);
    addBonus('dano', -5 * trainingPenalty);
  }
  const weightLimit = 10 + attrs.forca * 0.6;
  const over = Math.max(0, weight - weightLimit);
  if (over > 0) penalties.push(`Sobrepeso de armadura (${over.toFixed(1)} kg): −${Math.min(15, Math.round(over))} esquiva e iniciativa`);

  const flatHp = (bonus as Record<string, number>).vida_flat ?? 0;
  const maxHp = Math.round((40 + attrs.vigor * 8 + c.level * 6) * (1 + (bonus.vida ?? 0) / 100) + flatHp * Math.max(1, c.level / 10));
  const dodge = Math.max(0, 3 + attrs.destreza * 0.25 + dodgeEq + (bonus.esquiva ?? 0) - mobility - trainingPenalty * 4 - Math.min(15, over));
  const initiative = Math.round(10 + attrs.percepcao * 1.0 + attrs.destreza * 0.5 + initEq + (bonus.iniciativa ?? 0) - trainingPenalty * 8 - Math.min(15, over) - mobility);
  const crit = Math.min(60, 5 + attrs.percepcao * 0.2 + attrs.destreza * 0.1 + weaponCrit + (bonus.critico ?? 0));
  const resourceMax = cls.resource.max + (cls.resource.maxPerAttr ? attrs[cls.resource.maxPerAttr.attr] * cls.resource.maxPerAttr.per : 0);

  return {
    attrs,
    maxHp,
    armor: Math.round(armor * (1 + (bonus.armadura ?? 0) / 100)),
    resist,
    ctrlRes: Math.round(ctrlEq + (bonus.resist_controle ?? 0) + attrs.espirito * 0.2),
    dodge: Math.round(dodge * 10) / 10,
    crit: Math.round(crit * 10) / 10,
    critDmg: 50 + (bonus.dano_critico ?? 0),
    initiative,
    accuracy: 90 + attrs.percepcao * 0.2 + (bonus.precisao ?? 0),
    weapon,
    magicPower: magic,
    healPower: healP,
    block,
    carry: Math.round(30 + attrs.forca * 1.5),
    armorWeight: Math.round(weight * 10) / 10,
    heaviest,
    penalties,
    bonus,
    hooks,
    legendary,
    resourceMax,
  };
}

/** Percentual efetivo de uma resistência, com ganhos decrescentes e teto de 75%. */
export function resistPct(rating: number): number {
  if (rating <= 0) return Math.max(-0.5, rating / 200);
  return Math.min(0.75, rating / (rating + 100));
}

export function armorPct(armor: number, attackerLevel: number): number {
  if (armor <= 0) return 0;
  return Math.min(0.8, armor / (armor + 40 + attackerLevel * 12));
}
