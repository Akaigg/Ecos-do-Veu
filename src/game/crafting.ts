import {
  PIECE_FACTOR, RARITY_INFO, SPECIAL_PROPS, TIER_PROFESSION_LEVEL, armorModelById, cloakModelById, finishById, jewelryModelById,
  liningById, materialByItem, reinforcementById, toolModelById, weaponModelById, LEGENDARY_EFFECTS, type PieceSlot, type Rarity,
} from '../data/equipment.ts';
import { itemById } from '../data/items.ts';
import { recipeById, EQUIP_CRAFT_MINUTES, TOOL_CRAFT_MINUTES, type RecipeDef } from '../data/recipes.ts';
import { BOSS_SPECS } from '../data/monsters/bosses.ts';
import { computeEquipStats, maxDurabilityFor, modelInfo, parseRune, type EquipData } from './equipment.ts';
import type { Rng } from './rng.ts';

export interface EquipSpec {
  t: 'equipamento';
  kind: 'armadura' | 'capa' | 'joia' | 'arma';
  model: string;
  piece?: PieceSlot | 'amuleto' | 'anel';
  material: string;
  reinforcement?: string;
  lining?: string;
  finish?: string;
  runes: string[];
  gem?: string;
  color?: string;
  crest?: string;
  /** Catalisador (material de chefe ou Fragmento do Véu): habilita raridade épica. */
  catalyst?: string;
  legendary?: string;
  name?: string;
}
export interface ToolSpec { t: 'ferramenta'; model: string; material: string }
export interface RecipeSpec { t: 'receita'; recipe: string; qty: number }
export type CraftSpec = EquipSpec | ToolSpec | RecipeSpec;

export interface CraftAnalysis {
  ok: boolean;
  errors: string[];
  profession: string;
  level: number;
  tier: number;
  inputs: [string, number][];
  minutes: number;
  label: string;
  preview?: EquipData;
  recipe?: RecipeDef;
}

/** Material de chefe exigido por cada efeito lendário. */
export const LEGENDARY_MATERIAL: Record<string, string> = Object.fromEntries(BOSS_SPECS.filter((b) => b.legendary).map((b) => [b.legendary!, b.rewardItem]));
LEGENDARY_MATERIAL['egide-linha'] = 'presa-ancestral';
const CATALYSTS = new Set(['fragmento-veu', ...BOSS_SPECS.map((b) => b.rewardItem)]);

function addInput(list: [string, number][], item: string, qty: number) {
  const ex = list.find((x) => x[0] === item);
  if (ex) ex[1] += qty;
  else list.push([item, qty]);
}

export function recipeLabel(r: RecipeDef): string {
  return r.name || itemById.get(r.output[0])?.name || r.id;
}

export function analyzeSpec(spec: CraftSpec, profLevels: Record<string, number>, unlocks: Set<string>, velocidadeRank = 0): CraftAnalysis {
  const errors: string[] = [];
  const inputs: [string, number][] = [];
  if (spec.t === 'receita') {
    const r = recipeById.get(spec.recipe);
    if (!r) return { ok: false, errors: ['Receita desconhecida.'], profession: '', level: 0, tier: 0, inputs, minutes: 0, label: spec.recipe };
    const qty = Math.max(1, Math.min(50, Math.floor(spec.qty)));
    if ((profLevels[r.profession] ?? 1) < r.level) errors.push(`Requer nível ${r.level} de profissão.`);
    if (r.unlock && !unlocks.has(`receita:${r.id}`)) errors.push('Receita ainda não aprendida.');
    for (const [it, q] of r.inputs) addInput(inputs, it, q * qty);
    const minutes = Math.max(1, Math.round(r.minutes * qty * (1 - velocidadeRank * 0.08)));
    return { ok: !errors.length, errors, profession: r.profession, level: r.level, tier: itemById.get(r.output[0])?.tier ?? 1, inputs, minutes, label: `${recipeLabel(r)} ×${qty * r.output[1]}`, recipe: r };
  }
  if (spec.t === 'ferramenta') {
    const m = toolModelById.get(spec.model);
    const mat = materialByItem.get(spec.material);
    if (!m) return { ok: false, errors: ['Ferramenta desconhecida.'], profession: '', level: 0, tier: 0, inputs, minutes: 0, label: spec.model };
    if (!mat || !m.families.includes(mat.family)) errors.push('Material incompatível com a ferramenta.');
    const tier = mat?.tier ?? 1;
    const level = TIER_PROFESSION_LEVEL[tier];
    if ((profLevels[m.craftProfession] ?? 1) < level) errors.push(`Requer nível ${level} em ${m.craftProfession}.`);
    addInput(inputs, spec.material, 3);
    addInput(inputs, 'tora-pinho', 1);
    return { ok: !errors.length, errors, profession: m.craftProfession, level, tier, inputs, minutes: Math.round(TOOL_CRAFT_MINUTES(tier) * (1 - velocidadeRank * 0.08)), label: `${m.name} de ${itemById.get(spec.material)?.name ?? spec.material}` };
  }
  // Equipamento
  const mat = materialByItem.get(spec.material);
  let profession = '';
  let qty = 3;
  let families: string[] = [];
  let reinforcementOk = false;
  switch (spec.kind) {
    case 'armadura': {
      const m = armorModelById.get(spec.model);
      if (!m) { errors.push('Modelo de armadura desconhecido.'); break; }
      if (!spec.piece || !(spec.piece in PIECE_FACTOR)) errors.push('Escolha a parte do corpo (cabeça, torso, mãos, pernas ou pés).');
      profession = m.profession; families = m.families; qty = PIECE_FACTOR[(spec.piece ?? 'torso') as PieceSlot]?.qty ?? 6; reinforcementOk = true;
      break;
    }
    case 'capa': {
      const m = cloakModelById.get(spec.model);
      if (!m) { errors.push('Modelo de capa desconhecido.'); break; }
      profession = 'alfaiataria'; families = m.families; qty = 3; reinforcementOk = true;
      break;
    }
    case 'joia': {
      const m = jewelryModelById.get(spec.model);
      if (!m) { errors.push('Modelo de joia desconhecido.'); break; }
      profession = 'engenharia'; families = ['metal']; qty = 2;
      if (!spec.gem || materialByItem.get(spec.gem)?.family !== 'cristal') errors.push('Joias precisam de uma gema.');
      break;
    }
    case 'arma': {
      const m = weaponModelById.get(spec.model);
      if (!m) { errors.push('Modelo de arma desconhecido.'); break; }
      profession = m.profession; families = m.families; qty = m.offhand ? 3 : m.hands === 2 ? 5 : 3;
      break;
    }
  }
  if (!mat) errors.push('Material principal desconhecido.');
  else if (families.length && !families.includes(mat.family)) errors.push(`Este modelo aceita ${families.join(', ')} — não ${mat.family}.`);
  const tier = mat?.tier ?? 1;
  const level = TIER_PROFESSION_LEVEL[tier];
  if (profession && (profLevels[profession] ?? 1) < level) errors.push(`Requer nível ${level} na profissão.`);
  addInput(inputs, spec.material, qty);
  if (spec.gem) addInput(inputs, spec.gem, 1);

  const reinf = spec.reinforcement ? reinforcementById.get(spec.reinforcement) : undefined;
  if (spec.reinforcement && !reinf) errors.push('Reforço desconhecido.');
  if (reinf && !reinforcementOk) errors.push('Reforços só podem ser aplicados em armaduras e capas.');
  if (reinf) for (const [it, q] of reinf.items) addInput(inputs, it === '$metal' ? (mat?.family === 'metal' ? spec.material : 'lingote-ferro') : it, q);
  const lining = spec.lining ? liningById.get(spec.lining) : undefined;
  if (spec.lining && !lining) errors.push('Forro desconhecido.');
  if (lining && !reinforcementOk) errors.push('Forros só podem ser aplicados em armaduras e capas.');
  if (lining) for (const [it, q] of lining.items) addInput(inputs, it, q);
  const finish = spec.finish ? finishById.get(spec.finish) : undefined;
  if (spec.finish && !finish) errors.push('Acabamento desconhecido.');
  if (finish) for (const [it, q] of finish.items) addInput(inputs, it, q);
  for (const rn of spec.runes) {
    if (!parseRune(rn)) errors.push(`Runa inválida: ${rn}.`);
    addInput(inputs, rn, 1);
  }
  if (spec.catalyst) {
    if (!CATALYSTS.has(spec.catalyst)) errors.push('Catalisador inválido (use material de chefe ou Fragmento do Véu).');
    addInput(inputs, spec.catalyst, 1);
  }
  if (spec.legendary) {
    if (!LEGENDARY_EFFECTS[spec.legendary]) errors.push('Efeito lendário desconhecido.');
    else if (!unlocks.has(`receita:lendario:${spec.legendary}`)) errors.push('Você ainda não aprendeu esta receita lendária (derrote o chefe correspondente).');
    if (tier < 3) errors.push('Peças lendárias exigem material de faixa 3 ou superior.');
    addInput(inputs, LEGENDARY_MATERIAL[spec.legendary] ?? 'fragmento-veu', 2);
  }

  const rarityForPreview: Rarity = spec.legendary ? 'lendario' : 'comum';
  const preview: EquipData = {
    kind: spec.kind, piece: spec.piece, model: spec.model, material: spec.material, tier, reinforcement: spec.reinforcement,
    lining: spec.lining, finish: spec.finish, gem: spec.gem, runes: [...spec.runes], rarity: rarityForPreview, props: [],
    legendary: spec.legendary, upgrade: 0, durability: 1, maxDurability: 1, appearance: { color: spec.color, crest: spec.crest },
    name: spec.name?.slice(0, 40) || defaultName(spec),
  };
  if (!errors.length) {
    preview.maxDurability = preview.durability = maxDurabilityFor(preview);
    const st = computeEquipStats(preview);
    const capBase = st.capacityMax - RARITY_INFO[rarityForPreview].capacity;
    if (st.capacityUsed > capBase) errors.push(`Capacidade excedida: ${st.capacityUsed}/${capBase}. Reforços e runas disputam o mesmo orçamento.`);
    if (spec.runes.length > st.runeMax) errors.push(`Este modelo comporta no máximo ${st.runeMax} runa(s).`);
  }
  const minutes = Math.round(EQUIP_CRAFT_MINUTES(tier) * (1 - velocidadeRank * 0.08));
  return { ok: !errors.length, errors, profession, level, tier, inputs, minutes, label: preview.name, preview };
}

export function defaultName(spec: EquipSpec): string {
  const info = modelInfo({ kind: spec.kind, model: spec.model });
  const matName = itemById.get(spec.material)?.name.replace(/^(Lingote|Tora|Tecido|Couro) (de |do )?/i, '') ?? '';
  const piece = spec.kind === 'armadura' && spec.piece ? `${PIECE_FACTOR[spec.piece as PieceSlot]?.label ?? ''} — ` : '';
  return `${piece}${info?.name ?? spec.model} ${matName ? `de ${matName}` : ''}`.trim();
}

/** Sorteia a raridade final. Raridade alta nunca torna a fabricação irrelevante: ela só adiciona capacidade e propriedades. */
export function rollRarity(r: Rng, excessLevels: number, qualityRank: number, hasCatalyst: boolean, legendary: boolean): Rarity {
  if (legendary) return 'lendario';
  const q = qualityRank * 0.04;
  if (hasCatalyst && r.chance(0.25 + q)) return 'epico';
  if (r.chance(0.06 + excessLevels * 0.004 + q)) return 'raro';
  if (r.chance(0.25 + excessLevels * 0.01 + q)) return 'incomum';
  return 'comum';
}

export function rollProps(r: Rng, rarity: Rarity): string[] {
  const n = RARITY_INFO[rarity].props;
  const pool = SPECIAL_PROPS.map((p) => p.id);
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(r.next() * pool.length), 1)[0]);
  return out;
}
