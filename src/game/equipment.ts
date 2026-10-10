import {
  ARMOR_MODELS, CLOAK_MODELS, FINISHES, JEWELRY_MODELS, LEGENDARY_EFFECTS, LININGS, PIECE_FACTOR, RARITY_INFO,
  REINFORCEMENTS, SPECIAL_PROPS, TIER_ARMOR, TIER_DAMAGE, TIER_REQ_LEVEL, WEAPON_MODELS, finishById, liningById,
  materialByItem, reinforcementById, toolModelById, armorModelById, cloakModelById, jewelryModelById, weaponModelById,
  type PieceSlot, type Rarity, type Slot,
} from '../data/equipment.ts';
import { RUNE_TYPES, itemById } from '../data/items.ts';
import type { ArmorClass, Element } from '../data/types.ts';

export type EquipKind = 'armadura' | 'capa' | 'joia' | 'arma' | 'ferramenta';

/** Dados de uma peça única (guardados como JSON no banco). */
export interface EquipData {
  kind: EquipKind;
  /** Para armaduras: parte do corpo. Para joias: amuleto/anel. */
  piece?: PieceSlot | 'amuleto' | 'anel';
  model: string;
  material: string;
  tier: number;
  reinforcement?: string;
  lining?: string;
  finish?: string;
  gem?: string;
  runes: string[];
  rarity: Rarity;
  props: string[];
  legendary?: string;
  upgrade: number;
  durability: number;
  maxDurability: number;
  appearance?: { color?: string; crest?: string; visual?: string };
  crafter?: string;
  name: string;
  oil?: { elem: Element; bonus: number; fights: number; status?: string };
}

export interface EquipStats {
  armor: number;
  weight: number;
  mobility: number;
  resist: Partial<Record<Element, number>>;
  dodge: number;
  initiative: number;
  controle: number;
  magic: number;
  heal: number;
  block: number;
  damage: number;
  crit: number;
  bonus: Record<string, number>;
  capacityUsed: number;
  capacityMax: number;
  runeMax: number;
  armorClass?: ArmorClass;
  reqLevel: number;
  broken: boolean;
}

const RUNE_RE = /^runa-(.+)-(\d)$/;
export function parseRune(itemId: string): { key: string; grade: number } | null {
  const m = RUNE_RE.exec(itemId);
  if (!m || !RUNE_TYPES[m[1]]) return null;
  return { key: m[1], grade: Number(m[2]) };
}

export function runeValue(itemId: string): { stat: string; value: number } | null {
  const r = parseRune(itemId);
  if (!r) return null;
  const t = RUNE_TYPES[r.key];
  return { stat: t.stat, value: t.per * r.grade };
}

export function modelInfo(d: Pick<EquipData, 'kind' | 'model'>): { name: string; capacity: number; runeMax: number; families: string[] } {
  switch (d.kind) {
    case 'armadura': { const m = armorModelById.get(d.model)!; return { name: m.name, capacity: m.capacity, runeMax: m.runeMax, families: m.families }; }
    case 'capa': { const m = cloakModelById.get(d.model)!; return { name: m.name, capacity: m.capacity, runeMax: m.runeMax, families: m.families }; }
    case 'joia': { const m = jewelryModelById.get(d.model)!; return { name: m.name, capacity: m.capacity, runeMax: m.runeMax, families: ['metal'] }; }
    case 'arma': { const m = weaponModelById.get(d.model)!; return { name: m.name, capacity: m.capacity, runeMax: m.runeMax, families: m.families }; }
    case 'ferramenta': { const m = toolModelById.get(d.model)!; return { name: m.name, capacity: 0, runeMax: 0, families: m.families }; }
  }
}

function addResist(target: Partial<Record<Element, number>>, src?: Partial<Record<Element, number>>, mult = 1) {
  if (!src) return;
  for (const [k, v] of Object.entries(src)) target[k as Element] = (target[k as Element] ?? 0) + (v ?? 0) * mult;
}

/** Calcula os atributos de uma peça a partir das camadas (modelo, material, reforço, forro, acabamento, runas). */
export function computeEquipStats(d: EquipData): EquipStats {
  const mat = materialByItem.get(d.material);
  const rar = RARITY_INFO[d.rarity];
  const upMult = 1 + d.upgrade * 0.04;
  const rarMult = 1 + rar.statPct / 100;
  const info = modelInfo(d);
  const s: EquipStats = {
    armor: 0, weight: 0, mobility: 0, resist: {}, dodge: 0, initiative: 0, controle: 0, magic: 0, heal: 0, block: 0,
    damage: 0, crit: 0, bonus: {}, capacityUsed: 0, capacityMax: info.capacity + rar.capacity, runeMax: info.runeMax,
    reqLevel: TIER_REQ_LEVEL[d.tier] ?? 1, broken: d.durability <= 0,
  };
  const reinf = d.reinforcement ? reinforcementById.get(d.reinforcement) : undefined;
  const lining = d.lining ? liningById.get(d.lining) : undefined;
  const finish = d.finish ? finishById.get(d.finish) : undefined;
  const addons = [reinf, lining, finish].filter(Boolean) as NonNullable<typeof reinf>[];
  const armorPct = addons.reduce((a, x) => a + (x.armorPct ?? 0), 0);
  const weightPct = addons.reduce((a, x) => a + (x.weightPct ?? 0), 0);
  const mobilityPct = addons.reduce((a, x) => a + (x.mobilityPct ?? 0), 0);
  for (const x of addons) {
    addResist(s.resist, x.resist);
    s.dodge += x.dodge ?? 0;
    s.initiative += x.initiative ?? 0;
    s.controle += x.controle ?? 0;
  }
  s.capacityUsed = (reinf?.capacity ?? 0) + d.runes.length;
  if (mat) addResist(s.resist, mat.resist);

  if (d.kind === 'armadura' && d.piece && d.piece in PIECE_FACTOR) {
    const m = armorModelById.get(d.model)!;
    const pf = PIECE_FACTOR[d.piece as PieceSlot];
    s.armorClass = m.class;
    s.armor = m.armor * pf.armor * TIER_ARMOR[d.tier] * (mat?.armor ?? 1) * (1 + armorPct / 100) * upMult * rarMult;
    s.weight = m.weight * pf.weight * (mat?.weight ?? 1) * (1 + weightPct / 100);
    s.mobility = m.mobility * pf.armor * Math.max(0, 1 + mobilityPct / 100);
    s.dodge += (m.bonus?.dodge ?? 0) * pf.armor;
    s.magic += (m.bonus?.magic ?? 0) * pf.armor * d.tier;
    addResist(s.resist, m.bonus?.resist, pf.armor);
  } else if (d.kind === 'capa') {
    const m = cloakModelById.get(d.model)!;
    s.armor = m.armor * TIER_ARMOR[d.tier] * (mat?.armor ?? 1) * (1 + armorPct / 100) * upMult * rarMult;
    s.weight = m.weight * (mat?.weight ?? 1);
    s.dodge += m.bonus?.dodge ?? 0;
    addResist(s.resist, m.bonus?.resist);
  } else if (d.kind === 'joia') {
    const gem = d.gem ? materialByItem.get(d.gem) : undefined;
    addResist(s.resist, gem?.resist, 1.5);
    s.weight = 0.1;
  } else if (d.kind === 'arma') {
    const m = weaponModelById.get(d.model)!;
    s.damage = TIER_DAMAGE[d.tier] * m.damage * (mat?.damage ?? 1) * upMult * rarMult;
    s.crit = m.crit;
    s.weight = m.weight * (mat?.weight ?? 1);
    s.magic = (m.magic ?? 0) * d.tier * rarMult;
    s.heal = (m.heal ?? 0) * d.tier * rarMult;
    if (m.armor) s.armor = m.armor * TIER_ARMOR[d.tier] * (mat?.armor ?? 1) * upMult * rarMult;
    s.block = m.block ?? 0;
  } else if (d.kind === 'ferramenta') {
    s.weight = 2;
  }

  for (const r of d.runes) {
    const rv = runeValue(r);
    if (!rv) continue;
    if (rv.stat.startsWith('res_')) {
      const el = rv.stat.slice(4) as Element;
      s.resist[el] = (s.resist[el] ?? 0) + rv.value;
    } else if (rv.stat === 'armadura') s.armor += rv.value * d.tier;
    else s.bonus[rv.stat] = (s.bonus[rv.stat] ?? 0) + rv.value;
  }
  for (const p of d.props) {
    const prop = SPECIAL_PROPS.find((x) => x.id === p);
    if (!prop) continue;
    if (prop.stat === 'peso') s.weight *= 1 + prop.value / 100;
    else if (prop.stat === 'esquiva') s.dodge += prop.value;
    else if (prop.stat === 'iniciativa') s.initiative += prop.value;
    else if (prop.stat === 'resist_controle') s.controle += prop.value;
    else if (prop.stat !== 'durabilidade') s.bonus[prop.stat] = (s.bonus[prop.stat] ?? 0) + prop.value;
  }
  if (d.legendary === 'escama-dragao') s.weight *= 1.15;
  s.armor = Math.round(s.armor);
  s.damage = Math.round(s.damage * 10) / 10;
  s.weight = Math.round(s.weight * 10) / 10;
  if (s.broken) {
    // Peças com durabilidade zero continuam no personagem, mas não protegem até o reparo.
    s.armor = 0; s.damage = Math.round(s.damage * 0.25); s.resist = {}; s.bonus = {}; s.magic = 0; s.heal = 0;
  }
  return s;
}

export function maxDurabilityFor(d: Pick<EquipData, 'material' | 'reinforcement' | 'lining' | 'finish' | 'props'>): number {
  const mat = materialByItem.get(d.material);
  const addons = [d.reinforcement && reinforcementById.get(d.reinforcement), d.lining && liningById.get(d.lining), d.finish && finishById.get(d.finish)]
    .filter(Boolean) as { durabilityPct?: number }[];
  const pct = addons.reduce((a, x) => a + (x.durabilityPct ?? 0), 0) + (d.props.includes('duravel') ? 30 : 0);
  return Math.round((mat?.durability ?? 100) * (1 + pct / 100));
}

export function slotForEquip(d: EquipData): Slot[] {
  switch (d.kind) {
    case 'armadura': return [d.piece as Slot];
    case 'capa': return ['capa'];
    case 'joia': return d.piece === 'amuleto' ? ['amuleto'] : ['anel1', 'anel2'];
    case 'arma': {
      const m = weaponModelById.get(d.model)!;
      return m.offhand ? ['secundaria'] : ['arma'];
    }
    case 'ferramenta': return [];
  }
}

export function isTwoHanded(d: EquipData): boolean {
  return d.kind === 'arma' && weaponModelById.get(d.model)?.hands === 2;
}

export function equipIcon(d: EquipData): string {
  if (d.kind === 'armadura') return PIECE_FACTOR[d.piece as PieceSlot]?.icon ?? 'peitoral';
  if (d.kind === 'capa') return 'capa';
  if (d.kind === 'joia') return d.piece === 'amuleto' ? 'amuleto' : 'anel';
  if (d.kind === 'arma') return weaponModelById.get(d.model)?.icon ?? 'espada';
  return toolModelById.get(d.model)?.icon ?? 'picareta';
}

export function equipColor(d: EquipData): string {
  return d.appearance?.color ?? itemById.get(d.material)?.color ?? '#a0a0a0';
}

export function describeEquip(d: EquipData): string[] {
  const st = computeEquipStats(d);
  const lines: string[] = [];
  const matName = itemById.get(d.material)?.name ?? d.material;
  lines.push(`${modelInfo(d).name} • ${matName} • Faixa ${d.tier} • ${RARITY_INFO[d.rarity].label}${d.upgrade ? ` • +${d.upgrade}` : ''}`);
  if (st.damage) lines.push(`Dano ${st.damage} • Crítico +${st.crit}%`);
  if (st.armor) lines.push(`Armadura ${st.armor}`);
  if (st.weight) lines.push(`Peso ${st.weight} kg${st.mobility ? ` • Penalidade de mobilidade ${st.mobility.toFixed(1)}` : ''}`);
  const res = Object.entries(st.resist).filter(([, v]) => v).map(([k, v]) => `${k} ${Math.round(v!)}`);
  if (res.length) lines.push(`Resistências: ${res.join(', ')}`);
  const extras = Object.entries(st.bonus).map(([k, v]) => `${k} +${v}`);
  if (st.dodge) extras.push(`esquiva +${st.dodge}%`);
  if (st.initiative) extras.push(`iniciativa +${st.initiative}`);
  if (st.controle) extras.push(`res. controle +${st.controle}`);
  if (st.magic) extras.push(`poder mágico +${Math.round(st.magic)}`);
  if (st.heal) extras.push(`poder de cura +${Math.round(st.heal)}`);
  if (st.block) extras.push(`bloqueio ${st.block}%`);
  if (extras.length) lines.push(extras.join(' • '));
  const parts = [
    d.reinforcement && `Reforço: ${reinforcementById.get(d.reinforcement)?.name}`,
    d.lining && `Forro: ${liningById.get(d.lining)?.name}`,
    d.finish && `Acabamento: ${finishById.get(d.finish)?.name}`,
    d.runes.length ? `Runas: ${d.runes.map((r) => itemById.get(r)?.name ?? r).join(', ')}` : '',
  ].filter(Boolean);
  if (parts.length) lines.push(parts.join(' • '));
  if (d.legendary) lines.push(`✦ ${LEGENDARY_EFFECTS[d.legendary]?.name}: ${LEGENDARY_EFFECTS[d.legendary]?.desc}`);
  lines.push(`Capacidade ${st.capacityUsed}/${st.capacityMax} • Durabilidade ${d.durability}/${d.maxDurability}${st.broken ? ' (QUEBRADA — precisa de reparo)' : ''}`);
  return lines;
}

export const ALL_MODELS = { ARMOR_MODELS, CLOAK_MODELS, JEWELRY_MODELS, WEAPON_MODELS, REINFORCEMENTS, LININGS, FINISHES };
