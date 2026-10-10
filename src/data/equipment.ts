import type { ArmorClass, AttrScale, Element, Range } from './types.ts';

export const SLOTS = ['cabeca', 'torso', 'maos', 'pernas', 'pes', 'capa', 'amuleto', 'anel1', 'anel2', 'arma', 'secundaria'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  cabeca: 'Cabeça', torso: 'Torso', maos: 'Mãos', pernas: 'Pernas', pes: 'Pés', capa: 'Capa',
  amuleto: 'Amuleto', anel1: 'Anel I', anel2: 'Anel II', arma: 'Arma principal', secundaria: 'Mão secundária',
};

export type PieceSlot = 'cabeca' | 'torso' | 'maos' | 'pernas' | 'pes';
/** Fração da proteção e do peso de um modelo em cada parte do corpo. */
export const PIECE_FACTOR: Record<PieceSlot, { armor: number; weight: number; qty: number; icon: string; label: string }> = {
  torso: { armor: 1.0, weight: 1.0, qty: 6, icon: 'peitoral', label: 'Peitoral' },
  pernas: { armor: 0.7, weight: 0.7, qty: 4, icon: 'calca', label: 'Perneiras' },
  cabeca: { armor: 0.5, weight: 0.4, qty: 3, icon: 'elmo', label: 'Elmo' },
  maos: { armor: 0.35, weight: 0.25, qty: 2, icon: 'luvas', label: 'Luvas' },
  pes: { armor: 0.4, weight: 0.3, qty: 2, icon: 'botas', label: 'Botas' },
};

export type MaterialFamily = 'metal' | 'couro' | 'tecido' | 'madeira' | 'osso' | 'cristal';

export interface MaterialProps {
  item: string; family: MaterialFamily; tier: number;
  armor: number; weight: number; damage: number; durability: number;
  resist?: Partial<Record<Element, number>>;
  note?: string;
}

/** Propriedades de cada material principal (multiplicadores sobre o modelo). */
export const MATERIALS: MaterialProps[] = [
  { item: 'lingote-bronze', family: 'metal', tier: 1, armor: 1.0, weight: 1.0, damage: 1.0, durability: 100 },
  { item: 'lingote-ferro', family: 'metal', tier: 2, armor: 1.0, weight: 1.0, damage: 1.0, durability: 120 },
  { item: 'lingote-aco', family: 'metal', tier: 3, armor: 1.05, weight: 1.0, damage: 1.05, durability: 150 },
  { item: 'lingote-prata', family: 'metal', tier: 3, armor: 0.9, weight: 0.85, damage: 0.95, durability: 110, resist: { sombra: 15 }, note: 'Leve; resiste à sombra.' },
  { item: 'lingote-aco-negro', family: 'metal', tier: 4, armor: 1.05, weight: 1.05, damage: 1.08, durability: 180 },
  { item: 'lingote-argenteo', family: 'metal', tier: 5, armor: 1.0, weight: 0.75, damage: 1.05, durability: 200, resist: { arcano: 10 }, note: 'Muito leve.' },
  { item: 'liga-veu', family: 'metal', tier: 6, armor: 1.08, weight: 0.85, damage: 1.1, durability: 240, resist: { arcano: 15, sombra: 10 } },
  { item: 'couro-curtido', family: 'couro', tier: 1, armor: 1.0, weight: 1.0, damage: 1.0, durability: 90 },
  { item: 'couro-reforcado', family: 'couro', tier: 2, armor: 1.0, weight: 1.0, damage: 1.0, durability: 110 },
  { item: 'couro-escama', family: 'couro', tier: 3, armor: 1.05, weight: 1.05, damage: 1.0, durability: 130, resist: { veneno: 10 } },
  { item: 'couro-glacial', family: 'couro', tier: 4, armor: 1.0, weight: 1.0, damage: 1.0, durability: 150, resist: { gelo: 20 } },
  { item: 'couro-sombrio-curtido', family: 'couro', tier: 5, armor: 1.0, weight: 0.9, damage: 1.0, durability: 170, resist: { sombra: 15 } },
  { item: 'couro-velado', family: 'couro', tier: 6, armor: 1.05, weight: 0.85, damage: 1.0, durability: 200, resist: { arcano: 10 } },
  { item: 'tecido-linho', family: 'tecido', tier: 1, armor: 1.0, weight: 1.0, damage: 1.0, durability: 70 },
  { item: 'tecido-la', family: 'tecido', tier: 2, armor: 1.0, weight: 1.0, damage: 1.0, durability: 85, resist: { gelo: 8 } },
  { item: 'seda', family: 'tecido', tier: 3, armor: 0.95, weight: 0.8, damage: 1.0, durability: 95 },
  { item: 'seda-lunar', family: 'tecido', tier: 4, armor: 1.0, weight: 0.8, damage: 1.0, durability: 110, resist: { arcano: 10 } },
  { item: 'tecido-cinzas', family: 'tecido', tier: 5, armor: 1.0, weight: 0.9, damage: 1.0, durability: 130, resist: { fogo: 25 } },
  { item: 'tecido-veu', family: 'tecido', tier: 6, armor: 1.05, weight: 0.8, damage: 1.0, durability: 150, resist: { arcano: 15, sombra: 10 } },
  { item: 'tora-pinho', family: 'madeira', tier: 1, armor: 1.0, weight: 1.0, damage: 1.0, durability: 80 },
  { item: 'tora-carvalho', family: 'madeira', tier: 2, armor: 1.0, weight: 1.0, damage: 1.0, durability: 100 },
  { item: 'tora-teixo', family: 'madeira', tier: 3, armor: 1.0, weight: 0.95, damage: 1.06, durability: 120 },
  { item: 'tora-pau-ferro', family: 'madeira', tier: 4, armor: 1.1, weight: 1.1, damage: 1.05, durability: 150 },
  { item: 'tora-cinzaluz', family: 'madeira', tier: 5, armor: 1.0, weight: 0.85, damage: 1.06, durability: 160, resist: { luz: 10 } },
  { item: 'tora-velada', family: 'madeira', tier: 6, armor: 1.05, weight: 0.85, damage: 1.1, durability: 190 },
  { item: 'osso-grande', family: 'osso', tier: 3, armor: 0.95, weight: 0.9, damage: 1.02, durability: 100, resist: { sombra: 8 } },
  { item: 'quartzo', family: 'cristal', tier: 1, armor: 1, weight: 1, damage: 1, durability: 80 },
  { item: 'ametista', family: 'cristal', tier: 2, armor: 1, weight: 1, damage: 1, durability: 90 },
  { item: 'rubi', family: 'cristal', tier: 3, armor: 1, weight: 1, damage: 1.05, durability: 100, resist: { fogo: 10 } },
  { item: 'safira', family: 'cristal', tier: 4, armor: 1, weight: 1, damage: 1.05, durability: 110, resist: { gelo: 10 } },
  { item: 'onix-velado', family: 'cristal', tier: 5, armor: 1, weight: 1, damage: 1.06, durability: 120, resist: { sombra: 10 } },
  { item: 'lagrima-veu', family: 'cristal', tier: 6, armor: 1, weight: 1, damage: 1.1, durability: 140, resist: { arcano: 15 } },
];
export const materialByItem = new Map(MATERIALS.map((m) => [m.item, m]));

/** Escala por faixa (tier) de proteção e dano. */
export const TIER_ARMOR = [0, 1, 1.9, 3.0, 4.4, 6.0, 8.0];
export const TIER_DAMAGE = [0, 7, 13, 21, 31, 43, 57];
export const TIER_REQ_LEVEL = [0, 1, 11, 21, 31, 41, 51];
/** Nível de profissão necessário para fabricar cada faixa. Não-mestres param no 50 (faixa 4). */
export const TIER_PROFESSION_LEVEL = [0, 1, 15, 30, 45, 60, 75];

export interface ArmorModel {
  id: string; name: string; class: ArmorClass; families: MaterialFamily[];
  armor: number; weight: number; mobility: number; capacity: number; runeMax: number;
  /** Tipo de visual (usado para aparência e retrato). */
  look: string;
  profession: string;
  bonus?: { dodge?: number; magic?: number; resist?: Partial<Record<Element, number>> };
}

/** Modelos de armadura: definem estrutura e limites. Valores são para o torso na faixa 1. */
export const ARMOR_MODELS: ArmorModel[] = [
  { id: 'acolchoado', name: 'Gibão Acolchoado', class: 'leve', families: ['tecido'], armor: 6, weight: 2, mobility: 0, capacity: 5, runeMax: 3, look: 'tunica', profession: 'alfaiataria' },
  { id: 'vestes-runicas', name: 'Vestes Rúnicas', class: 'leve', families: ['tecido'], armor: 4, weight: 1.5, mobility: 0, capacity: 6, runeMax: 4, look: 'manto', profession: 'alfaiataria', bonus: { magic: 4 } },
  { id: 'sobretudo', name: 'Sobretudo', class: 'leve', families: ['tecido', 'couro'], armor: 7, weight: 3, mobility: 0, capacity: 4, runeMax: 2, look: 'sobretudo', profession: 'alfaiataria' },
  { id: 'couro', name: 'Armadura de Couro', class: 'leve', families: ['couro'], armor: 9, weight: 4, mobility: 0, capacity: 4, runeMax: 2, look: 'couro', profession: 'alfaiataria', bonus: { dodge: 2 } },
  { id: 'brigandina', name: 'Brigandina', class: 'media', families: ['metal'], armor: 13, weight: 7, mobility: 2, capacity: 4, runeMax: 2, look: 'brigandina', profession: 'ferraria' },
  { id: 'cota-malha', name: 'Cota de Malha', class: 'media', families: ['metal'], armor: 14, weight: 9, mobility: 3, capacity: 3, runeMax: 2, look: 'malha', profession: 'ferraria' },
  { id: 'escamas', name: 'Armadura de Escamas', class: 'media', families: ['metal', 'osso'], armor: 15, weight: 10, mobility: 3, capacity: 3, runeMax: 1, look: 'escamas', profession: 'ferraria', bonus: { resist: { fogo: 5, gelo: 5 } } },
  { id: 'placas', name: 'Armadura de Placas', class: 'pesada', families: ['metal'], armor: 20, weight: 15, mobility: 6, capacity: 3, runeMax: 1, look: 'placas', profession: 'ferraria' },
];

export interface CloakModel { id: string; name: string; families: MaterialFamily[]; armor: number; weight: number; capacity: number; runeMax: number; look: string; bonus?: { dodge?: number; resist?: Partial<Record<Element, number>> } }
export const CLOAK_MODELS: CloakModel[] = [
  { id: 'capa-viagem', name: 'Capa de Viagem', families: ['tecido', 'couro'], armor: 2, weight: 1, capacity: 4, runeMax: 2, look: 'capa', bonus: { resist: { gelo: 5 } } },
  { id: 'manto', name: 'Manto Longo', families: ['tecido'], armor: 1, weight: 1, capacity: 5, runeMax: 3, look: 'manto' },
  { id: 'capa-pele', name: 'Capa de Pele', families: ['couro'], armor: 3, weight: 2, capacity: 3, runeMax: 1, look: 'pele', bonus: { resist: { gelo: 12 } } },
];

export interface JewelryModel { id: string; name: string; slot: 'amuleto' | 'anel'; capacity: number; runeMax: number }
export const JEWELRY_MODELS: JewelryModel[] = [
  { id: 'amuleto', name: 'Amuleto', slot: 'amuleto', capacity: 3, runeMax: 3 },
  { id: 'anel', name: 'Anel', slot: 'anel', capacity: 2, runeMax: 2 },
];

export interface WeaponModel {
  id: string; name: string; hands: 1 | 2; range: Range; families: MaterialFamily[];
  damage: number; scale: AttrScale; elem: Element; crit: number; weight: number;
  capacity: number; runeMax: number; profession: string; icon: string;
  /** Ataca da retaguarda mesmo sendo corpo a corpo. */
  reach?: boolean;
  offhand?: boolean; armor?: number; magic?: number; heal?: number; block?: number;
  breaks?: boolean;
}
export const WEAPON_MODELS: WeaponModel[] = [
  { id: 'espada', name: 'Espada', hands: 1, range: 'corpo', families: ['metal'], damage: 1.0, scale: { forca: 0.5, destreza: 0.5 }, elem: 'fisico', crit: 5, weight: 3, capacity: 3, runeMax: 2, profession: 'ferraria', icon: 'espada' },
  { id: 'machado', name: 'Machado', hands: 1, range: 'corpo', families: ['metal'], damage: 1.08, scale: { forca: 0.9 }, elem: 'fisico', crit: 3, weight: 4, capacity: 3, runeMax: 2, profession: 'ferraria', icon: 'machado' },
  { id: 'maca', name: 'Maça', hands: 1, range: 'corpo', families: ['metal'], damage: 1.0, scale: { forca: 0.7, espirito: 0.3 }, elem: 'fisico', crit: 2, weight: 4, capacity: 3, runeMax: 2, profession: 'ferraria', icon: 'maca', breaks: true },
  { id: 'adaga', name: 'Adaga', hands: 1, range: 'corpo', families: ['metal', 'osso'], damage: 0.8, scale: { destreza: 1.0 }, elem: 'fisico', crit: 12, weight: 1, capacity: 3, runeMax: 2, profession: 'ferraria', icon: 'adaga' },
  { id: 'punhos', name: 'Manoplas de Combate', hands: 1, range: 'corpo', families: ['metal', 'couro'], damage: 0.85, scale: { destreza: 0.6, forca: 0.4 }, elem: 'fisico', crit: 8, weight: 1.5, capacity: 3, runeMax: 2, profession: 'ferraria', icon: 'punho' },
  { id: 'lanca', name: 'Lança', hands: 2, range: 'corpo', families: ['metal', 'madeira'], damage: 1.3, scale: { forca: 0.6, destreza: 0.6 }, elem: 'fisico', crit: 5, weight: 5, capacity: 4, runeMax: 2, profession: 'ferraria', icon: 'lanca', reach: true },
  { id: 'martelo', name: 'Martelo de Guerra', hands: 2, range: 'corpo', families: ['metal'], damage: 1.55, scale: { forca: 1.2 }, elem: 'fisico', crit: 2, weight: 9, capacity: 4, runeMax: 2, profession: 'ferraria', icon: 'martelo', breaks: true },
  { id: 'espadao', name: 'Espadão', hands: 2, range: 'corpo', families: ['metal'], damage: 1.45, scale: { forca: 1.0, destreza: 0.3 }, elem: 'fisico', crit: 5, weight: 7, capacity: 4, runeMax: 2, profession: 'ferraria', icon: 'espadao' },
  { id: 'foice', name: 'Foice de Guerra', hands: 2, range: 'corpo', families: ['metal'], damage: 1.3, scale: { forca: 0.5, intelecto: 0.7 }, elem: 'fisico', crit: 6, weight: 6, capacity: 4, runeMax: 3, profession: 'ferraria', icon: 'foice' },
  { id: 'arco', name: 'Arco', hands: 2, range: 'distancia', families: ['madeira', 'osso'], damage: 1.2, scale: { destreza: 1.0, percepcao: 0.3 }, elem: 'fisico', crit: 7, weight: 2, capacity: 4, runeMax: 2, profession: 'engenharia', icon: 'arco' },
  { id: 'besta', name: 'Besta', hands: 2, range: 'distancia', families: ['madeira', 'metal'], damage: 1.35, scale: { percepcao: 0.8, destreza: 0.4 }, elem: 'fisico', crit: 6, weight: 5, capacity: 4, runeMax: 2, profession: 'engenharia', icon: 'besta' },
  { id: 'pistola', name: 'Pistola Rúnica', hands: 1, range: 'distancia', families: ['metal'], damage: 0.95, scale: { intelecto: 0.6, destreza: 0.4 }, elem: 'fisico', crit: 6, weight: 2, capacity: 3, runeMax: 3, profession: 'engenharia', icon: 'pistola' },
  { id: 'cajado', name: 'Cajado', hands: 2, range: 'distancia', families: ['madeira', 'cristal'], damage: 1.0, scale: { intelecto: 0.6, espirito: 0.6 }, elem: 'arcano', crit: 4, weight: 3, capacity: 5, runeMax: 3, profession: 'engenharia', icon: 'cajado', magic: 12, heal: 8 },
  { id: 'varinha', name: 'Varinha', hands: 1, range: 'distancia', families: ['madeira', 'cristal', 'osso'], damage: 0.75, scale: { intelecto: 1.0 }, elem: 'arcano', crit: 5, weight: 0.5, capacity: 3, runeMax: 3, profession: 'engenharia', icon: 'varinha', magic: 6 },
  { id: 'escudo', name: 'Escudo', hands: 1, range: 'corpo', families: ['metal', 'madeira'], damage: 0, scale: {}, elem: 'fisico', crit: 0, weight: 5, capacity: 3, runeMax: 1, profession: 'ferraria', icon: 'escudo', offhand: true, armor: 8, block: 20 },
  { id: 'tomo', name: 'Tomo', hands: 1, range: 'distancia', families: ['couro', 'tecido'], damage: 0, scale: {}, elem: 'arcano', crit: 0, weight: 1, capacity: 3, runeMax: 3, profession: 'alfaiataria', icon: 'livro', offhand: true, magic: 8, heal: 4 },
  { id: 'foco', name: 'Foco Cristalino', hands: 1, range: 'distancia', families: ['cristal'], damage: 0, scale: {}, elem: 'arcano', crit: 0, weight: 0.5, capacity: 3, runeMax: 3, profession: 'engenharia', icon: 'orbe', offhand: true, magic: 10 },
  { id: 'instrumento', name: 'Alaúde', hands: 1, range: 'distancia', families: ['madeira'], damage: 0, scale: {}, elem: 'arcano', crit: 0, weight: 2, capacity: 3, runeMax: 2, profession: 'engenharia', icon: 'alaude', offhand: true, magic: 4, heal: 8 },
];

export interface AddonDef {
  id: string; name: string; desc: string; capacity: number; items: [string, number][];
  armorPct?: number; weightPct?: number; durabilityPct?: number; dodge?: number; initiative?: number;
  resist?: Partial<Record<Element, number>>; controle?: number; mobilityPct?: number;
  families?: MaterialFamily[];
}

/** Reforços: especializam a proteção e ocupam capacidade. */
export const REINFORCEMENTS: AddonDef[] = [
  { id: 'placas-extras', name: 'Placas Extras', desc: '+30% de armadura, +40% de peso.', capacity: 2, items: [['$metal', 2]], armorPct: 30, weightPct: 40 },
  { id: 'malha', name: 'Malha', desc: '+15% de armadura, +15% de peso.', capacity: 1, items: [['$metal', 1]], armorPct: 15, weightPct: 15 },
  { id: 'escamas', name: 'Escamas', desc: '+10% de armadura e resistência a fogo e veneno.', capacity: 1, items: [['escama', 3]], armorPct: 10, resist: { fogo: 8, veneno: 8 } },
  { id: 'couro-duplo', name: 'Couro Duplo', desc: '+10% de armadura e +20% de durabilidade.', capacity: 1, items: [['couro-curtido', 2]], armorPct: 10, durabilityPct: 20 },
  { id: 'acolchoamento', name: 'Acolchoamento', desc: '+10 de resistência a controle.', capacity: 1, items: [['tecido-linho', 2]], controle: 10 },
  { id: 'quitina', name: 'Placas de Quitina', desc: '+18% de armadura com pouco peso.', capacity: 1, items: [['quitina', 4]], armorPct: 18, weightPct: 5 },
];

/** Forros: conforto e resistências ambientais. Um por peça, sem custo de capacidade. */
export const LININGS: AddonDef[] = [
  { id: 'la', name: 'Forro de Lã', desc: 'Resistência a gelo; protege do frio.', capacity: 0, items: [['tecido-la', 1]], resist: { gelo: 12 } },
  { id: 'couro-tratado', name: 'Forro de Couro Tratado', desc: 'Resistência a veneno e durabilidade.', capacity: 0, items: [['couro-curtido', 1]], resist: { veneno: 10 }, durabilityPct: 10 },
  { id: 'isolante', name: 'Tecido Isolante', desc: 'Resistência a raio.', capacity: 0, items: [['cortica', 2], ['tecido-linho', 1]], resist: { raio: 12 } },
  { id: 'seda', name: 'Forro de Seda', desc: 'Leveza: −5% de peso e +1% de esquiva.', capacity: 0, items: [['seda', 1]], weightPct: -5, dodge: 1 },
  { id: 'feltro-cinzas', name: 'Feltro de Cinzas', desc: 'Resistência a fogo; protege do calor.', capacity: 0, items: [['tecido-cinzas', 1]], resist: { fogo: 14 } },
  { id: 'lunar', name: 'Forro Lunar', desc: 'Resistência a sombra e arcano.', capacity: 0, items: [['seda-lunar', 1]], resist: { sombra: 10, arcano: 6 } },
];

/** Acabamentos: durabilidade ou utilidade. Um por peça. */
export const FINISHES: AddonDef[] = [
  { id: 'selagem', name: 'Selagem', desc: '+15% de durabilidade e resistência a veneno.', capacity: 0, items: [['cera-selagem', 1]], durabilityPct: 15, resist: { veneno: 5 } },
  { id: 'polimento', name: 'Polimento', desc: '+5% de armadura.', capacity: 0, items: [['sal-rocha', 2]], armorPct: 5 },
  { id: 'isolamento', name: 'Isolamento', desc: 'Resistência a raio.', capacity: 0, items: [['resina', 2]], resist: { raio: 6 } },
  { id: 'oleado', name: 'Oleado', desc: '+25% de durabilidade.', capacity: 0, items: [['resina', 1], ['cera-selagem', 1]], durabilityPct: 25 },
  { id: 'juntas-flexiveis', name: 'Juntas Flexíveis', desc: 'Reduz pela metade a penalidade de mobilidade da peça.', capacity: 0, items: [['couro-curtido', 1]], mobilityPct: -50 },
  { id: 'silenciador', name: 'Silenciador', desc: '+3 de iniciativa.', capacity: 0, items: [['la-crua', 1]], initiative: 3 },
];

export const RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_INFO: Record<Rarity, { label: string; capacity: number; statPct: number; color: string; props: number }> = {
  comum: { label: 'Comum', capacity: 0, statPct: 0, color: '#b0b0b0', props: 0 },
  incomum: { label: 'Incomum', capacity: 1, statPct: 4, color: '#60c060', props: 0 },
  raro: { label: 'Raro', capacity: 1, statPct: 8, color: '#5090f0', props: 1 },
  epico: { label: 'Épico', capacity: 2, statPct: 10, color: '#b060f0', props: 2 },
  lendario: { label: 'Lendário', capacity: 2, statPct: 12, color: '#f0a030', props: 2 },
};

/** Propriedades especiais sorteadas em itens raros e épicos. */
export const SPECIAL_PROPS: { id: string; label: string; stat: string; value: number }[] = [
  { id: 'robusto', label: '+4% de vida', stat: 'vida_pct', value: 4 },
  { id: 'agil', label: '+2% de esquiva', stat: 'esquiva', value: 2 },
  { id: 'atento', label: '+4 de iniciativa', stat: 'iniciativa', value: 4 },
  { id: 'afiado', label: '+3% de crítico', stat: 'critico', value: 3 },
  { id: 'abencoado', label: '+5% de cura', stat: 'cura', value: 5 },
  { id: 'focado', label: '+4% de dano mágico', stat: 'dano_magico', value: 4 },
  { id: 'brutal', label: '+4% de dano físico', stat: 'dano_fisico', value: 4 },
  { id: 'firme', label: '+8 de resistência a controle', stat: 'resist_controle', value: 8 },
  { id: 'duravel', label: '+30% de durabilidade', stat: 'durabilidade', value: 30 },
  { id: 'leve', label: '−15% de peso', stat: 'peso', value: -15 },
];

/** Efeitos lendários: mudam decisões, sempre com uma contrapartida. */
export const LEGENDARY_EFFECTS: Record<string, { name: string; desc: string }> = {
  'egide-linha': { name: 'Égide da Linha', desc: 'Interceptar protege toda a linha do aliado, mas tem +2 rodadas de recarga.' },
  'presa-ancestral': { name: 'Ímpeto Ancestral', desc: 'Investidas e golpes de quebra expõem carapaças por +1 rodada; −5% de esquiva.' },
  'seda-viva': { name: 'Seda Viva', desc: 'Ao esquivar, prende o atacante (Enraizado 1); −10% de armadura.' },
  'reflexo-farao': { name: 'Reflexo Faraônico', desc: 'Reflete 20% do dano mágico recebido; curas recebidas −10%.' },
  'pluma-vento': { name: 'Pluma do Vento', desc: 'Mover-se entre linhas concede Evasivo por 1 rodada; −10% de vida.' },
  'coracao-glacial': { name: 'Coração Glacial', desc: 'Imune a Congelado; dano de fogo recebido +15%.' },
  'prisma-adaptativo': { name: 'Prisma Adaptativo', desc: 'Ao receber dano elemental, ganha +20 de resistência àquele elemento por 2 rodadas; −10 em todas as outras.' },
  'ancora-mares': { name: 'Âncora das Marés', desc: 'Não pode ser movido de linha à força; −10 de iniciativa.' },
  'mascara-copia': { name: 'Máscara Sem Rosto', desc: 'A primeira habilidade usada em cada combate não entra em recarga; custo +20%.' },
  'brasa-primordial': { name: 'Brasa Primordial', desc: 'Seus ataques aplicam Queimadura leve; você recebe +10% de dano de gelo.' },
  'escama-dragao': { name: 'Escama do Dragão', desc: 'O primeiro golpe recebido em cada rodada é reduzido em 30%; +15% de peso.' },
  'reliquia-veu': { name: 'Eco do Véu', desc: 'Habilidades culminantes custam 25% menos; vida máxima −8%.' },
};

// ---------------------------------------------------------------- ferramentas

export interface ToolModel { id: string; name: string; profession: string; icon: string; families: MaterialFamily[]; baseDurability: number; craftProfession: string }
export const TOOL_MODELS: ToolModel[] = [
  { id: 'picareta', name: 'Picareta', profession: 'mineracao', icon: 'picareta', families: ['metal'], baseDurability: 100, craftProfession: 'ferraria' },
  { id: 'machado-lenhador', name: 'Machado de Lenhador', profession: 'lenharia', icon: 'machado', families: ['metal'], baseDurability: 100, craftProfession: 'ferraria' },
  { id: 'foice-colheita', name: 'Foice de Colheita', profession: 'herbalismo', icon: 'foice-pequena', families: ['metal'], baseDurability: 100, craftProfession: 'ferraria' },
  { id: 'vara-pesca', name: 'Vara de Pesca', profession: 'pesca', icon: 'vara', families: ['madeira'], baseDurability: 100, craftProfession: 'engenharia' },
  { id: 'kit-caca', name: 'Kit de Caça e Esfola', profession: 'caca', icon: 'faca', families: ['metal', 'osso'], baseDurability: 100, craftProfession: 'ferraria' },
];
export const toolByProfession = new Map(TOOL_MODELS.map((t) => [t.profession, t]));

export const armorModelById = new Map(ARMOR_MODELS.map((m) => [m.id, m]));
export const cloakModelById = new Map(CLOAK_MODELS.map((m) => [m.id, m]));
export const jewelryModelById = new Map(JEWELRY_MODELS.map((m) => [m.id, m]));
export const weaponModelById = new Map(WEAPON_MODELS.map((m) => [m.id, m]));
export const toolModelById = new Map(TOOL_MODELS.map((m) => [m.id, m]));
export const reinforcementById = new Map(REINFORCEMENTS.map((m) => [m.id, m]));
export const liningById = new Map(LININGS.map((m) => [m.id, m]));
export const finishById = new Map(FINISHES.map((m) => [m.id, m]));

/** Visuais desbloqueáveis (transmog). A aparência não altera atributos. */
export const VISUALS: { id: string; name: string; look: string; unlock: string }[] = [
  { id: 'tunica-errante', name: 'Túnica do Errante', look: 'tunica', unlock: 'inicial' },
  { id: 'sobretudo-elegante', name: 'Sobretudo Elegante', look: 'sobretudo', unlock: 'origem:nobre-caido' },
  { id: 'manto-arquivista', name: 'Manto do Arquivista', look: 'manto', unlock: 'reputacao:arquivistas:3' },
  { id: 'placas-imperiais', name: 'Placas Imperiais', look: 'placas', unlock: 'chefe:imperador-sem-rosto' },
  { id: 'couro-cacador', name: 'Couro do Caçador', look: 'couro', unlock: 'reputacao:floresta:2' },
  { id: 'malha-guarda', name: 'Malha da Guarda', look: 'malha', unlock: 'reputacao:guarda:2' },
  { id: 'escamas-dracônicas', name: 'Escamas Dracônicas', look: 'escamas', unlock: 'chefe:dragao-obsidiana' },
  { id: 'brigandina-mares', name: 'Brigandina das Marés', look: 'brigandina', unlock: 'reputacao:mares:3' },
];
