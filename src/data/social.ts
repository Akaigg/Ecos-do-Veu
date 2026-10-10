// Contratos, guildas, loja, títulos e economia.

// ---------------------------------------------------------------- contratos semanais
export type ContractGoal =
  | { t: 'abater_familia'; family: string; count: number }
  | { t: 'abater_regiao'; region: string; count: number }
  | { t: 'abater_variante'; count: number }
  | { t: 'coletar'; profession: string; count: number }
  | { t: 'fabricar'; count: number }
  | { t: 'explorar'; steps: number }
  | { t: 'campanha'; count: number }
  | { t: 'domar'; count: number }
  | { t: 'missao_pet'; count: number };

export interface ContractTemplate { id: string; label: string; goal: ContractGoal; gold: number; rep: number; xp: number; minLevel: number }

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  { id: 'feras', label: 'Controle de feras: derrote {n} feras caninas', goal: { t: 'abater_familia', family: 'canino', count: 12 }, gold: 80, rep: 60, xp: 300, minLevel: 1 },
  { id: 'insetos', label: 'Praga de insetos: derrote {n} insetos', goal: { t: 'abater_familia', family: 'inseto', count: 10 }, gold: 80, rep: 60, xp: 300, minLevel: 1 },
  { id: 'mortos', label: 'Descanso dos mortos: derrote {n} mortos-vivos', goal: { t: 'abater_familia', family: 'morto_vivo', count: 10 }, gold: 140, rep: 80, xp: 600, minLevel: 14 },
  { id: 'constructos', label: 'Desativação: derrote {n} constructos', goal: { t: 'abater_familia', family: 'constructo', count: 8 }, gold: 140, rep: 80, xp: 600, minLevel: 9 },
  { id: 'variantes', label: 'Ameaças incomuns: derrote {n} criaturas variantes', goal: { t: 'abater_variante', count: 3 }, gold: 200, rep: 120, xp: 900, minLevel: 5 },
  { id: 'mineracao', label: 'Encomenda de minério: colete {n} itens minerando', goal: { t: 'coletar', profession: 'mineracao', count: 60 }, gold: 100, rep: 50, xp: 200, minLevel: 1 },
  { id: 'lenharia', label: 'Madeira para a sede: colete {n} itens de lenharia', goal: { t: 'coletar', profession: 'lenharia', count: 60 }, gold: 100, rep: 50, xp: 200, minLevel: 1 },
  { id: 'herbalismo', label: 'Ervas para a enfermaria: colete {n} ervas', goal: { t: 'coletar', profession: 'herbalismo', count: 60 }, gold: 100, rep: 50, xp: 200, minLevel: 1 },
  { id: 'pesca', label: 'Peixe para a cozinha: colete {n} itens pescando', goal: { t: 'coletar', profession: 'pesca', count: 40 }, gold: 100, rep: 50, xp: 200, minLevel: 1 },
  { id: 'fabricar', label: 'Oficinas cheias: fabrique {n} itens', goal: { t: 'fabricar', count: 15 }, gold: 120, rep: 60, xp: 250, minLevel: 1 },
  { id: 'explorar', label: 'Cartografia: avance {n} passos de exploração', goal: { t: 'explorar', steps: 18 }, gold: 120, rep: 80, xp: 500, minLevel: 1 },
  { id: 'campanha', label: 'Expedição cooperativa: conclua {n} campanha', goal: { t: 'campanha', count: 1 }, gold: 250, rep: 150, xp: 1200, minLevel: 5 },
  { id: 'domar', label: 'Estudo de campo: dome {n} criatura', goal: { t: 'domar', count: 1 }, gold: 120, rep: 80, xp: 300, minLevel: 3 },
  { id: 'missoes-pet', label: 'Rede de batedores: conclua {n} missões de pet', goal: { t: 'missao_pet', count: 4 }, gold: 100, rep: 60, xp: 200, minLevel: 3 },
];
export const contractTemplateById = new Map(CONTRACT_TEMPLATES.map((c) => [c.id, c]));
export const CONTRACTS_PER_WEEK = 3;
/** Contratos não concluídos acumulam por até 3 semanas — dá direção sem exigir entrada diária. */
export const CONTRACT_MAX_STORED_WEEKS = 3;

// ---------------------------------------------------------------- guildas
export type GuildRank = 'lider' | 'oficial' | 'membro' | 'recruta';
export const GUILD_RANKS: Record<GuildRank, { label: string; vaultWithdrawPerDay: number; canInvite: boolean; canManage: boolean }> = {
  lider: { label: 'Líder', vaultWithdrawPerDay: Infinity, canInvite: true, canManage: true },
  oficial: { label: 'Oficial', vaultWithdrawPerDay: 50, canInvite: true, canManage: false },
  membro: { label: 'Membro', vaultWithdrawPerDay: 10, canInvite: false, canManage: false },
  recruta: { label: 'Recruta', vaultWithdrawPerDay: 0, canInvite: false, canManage: false },
};
export const GUILD_CREATE_COST = 1000;
export const GUILD_BASE_MEMBERS = 20;
export const GUILD_MAX_MEMBERS = 50;

export interface GuildUpgrade { id: string; name: string; desc: string; maxLevel: number; cost: (level: number) => { gold: number; items: [string, number][]; work: number } }
export const GUILD_UPGRADES: GuildUpgrade[] = [
  { id: 'salao', name: 'Salão da Guilda', desc: '+10 vagas de membro por nível (até 50).', maxLevel: 3,
    cost: (l) => ({ gold: 2000 * l, items: [['tora-carvalho', 40 * l], ['lingote-ferro', 20 * l]], work: 20 * l }) },
  { id: 'oficina', name: 'Oficina', desc: 'Por nível: 4% de chance de economizar materiais ao fabricar; no nível 2, +1 vaga na fila de produção.', maxLevel: 3,
    cost: (l) => ({ gold: 1500 * l, items: [['lingote-ferro', 30 * l], ['tora-pinho', 30 * l]], work: 15 * l }) },
  { id: 'cofre', name: 'Cofre', desc: 'Registro detalhado e +200 espaços de armazenamento por nível.', maxLevel: 3,
    cost: (l) => ({ gold: 1000 * l, items: [['lingote-bronze', 20 * l]], work: 10 * l }) },
  { id: 'estabulo', name: 'Estábulo', desc: '+1 vaga de pet para cada membro por nível.', maxLevel: 2,
    cost: (l) => ({ gold: 1200 * l, items: [['tora-pinho', 40 * l], ['racao-pet', 20 * l]], work: 12 * l }) },
  { id: 'biblioteca', name: 'Biblioteca de Descobertas', desc: 'Compartilha pistas do bestiário entre membros (fraquezas reveladas).', maxLevel: 1,
    cost: () => ({ gold: 2500, items: [['tinta-arcana', 30], ['tecido-linho', 20]], work: 20 }) },
  { id: 'quadro', name: 'Quadro de Contratos', desc: 'Libera contratos de guilda semanais com recompensas para o cofre.', maxLevel: 1,
    cost: () => ({ gold: 1500, items: [['tora-carvalho', 20]], work: 10 }) },
];
export const guildUpgradeById = new Map(GUILD_UPGRADES.map((u) => [u.id, u]));

// ---------------------------------------------------------------- loja das cidades (catálogo)
export interface ShopEntry { item: string; price: number; minRegionIndex?: number }
export const SHOP_STOCK: ShopEntry[] = [
  { item: 'racao', price: 3 },
  { item: 'agua', price: 2 },
  { item: 'farinha', price: 3 },
  { item: 'celula-energia', price: 6 },
  { item: 'petisco', price: 6 },
  { item: 'racao-pet', price: 5 },
  { item: 'isca-simples', price: 15 },
  { item: 'pocao-vida-menor', price: 18 },
  { item: 'pocao-recurso-menor', price: 18 },
  { item: 'antidoto', price: 15 },
  { item: 'sal-rocha', price: 4 },
  { item: 'cera-selagem', price: 6 },
  { item: 'tinta-arcana', price: 14 },
  { item: 'carvao', price: 3 },
  { item: 'pocao-vida-comum', price: 45, minRegionIndex: 3 },
  { item: 'pocao-visao', price: 30, minRegionIndex: 2 },
  { item: 'isca-aromatica', price: 60, minRegionIndex: 5 },
];
/** Ferramentas básicas vendidas pela Companhia (bronze/pinho). */
export const SHOP_TOOLS: { tool: string; material: string; price: number }[] = [
  { tool: 'picareta', material: 'lingote-bronze', price: 40 },
  { tool: 'machado-lenhador', material: 'lingote-bronze', price: 40 },
  { tool: 'foice-colheita', material: 'lingote-bronze', price: 40 },
  { tool: 'vara-pesca', material: 'tora-pinho', price: 35 },
  { tool: 'kit-caca', material: 'lingote-bronze', price: 40 },
];
/** Vendedores compram por esta fração do valor base. */
export const SELL_RATE = 0.3;

// ---------------------------------------------------------------- economia (drenos de ouro)
export const ECONOMY = {
  marketListingFee: 0.02,
  marketSaleTax: 0.05,
  marketMaxListings: 20,
  marketListingHours: 72,
  repairPerPoint: (tier: number) => 0.15 * tier,
  respecFree: 2,
  respecCost: (count: number, level: number) => Math.round(30 + level * 6 * Math.min(4, count - 1)),
  classChangeCost: 50,
  upgradeGold: (tier: number, plus: number) => Math.round(25 * tier * (plus + 1)),
  commissionFee: 0.05,
  travelDiscountOrigin: 0.25,
  attributeRespecCost: (level: number) => 20 + level * 5,
};

// ---------------------------------------------------------------- títulos
export interface TitleDef { id: string; name: string; desc: string }
export const TITLES: TitleDef[] = [
  { id: 'errante', name: 'Errante', desc: 'Registrado na Companhia dos Errantes.' },
  { id: 'domador', name: 'Domador', desc: 'Domou a primeira criatura.' },
  { id: 'cacador-chefes', name: 'Caçador de Chefes', desc: 'Derrotou 5 chefes diferentes.' },
  { id: 'cartografo', name: 'Cartógrafo', desc: 'Visitou todas as regiões.' },
  { id: 'mestre-artesao', name: 'Mestre Artesão', desc: 'Alcançou nível 100 em uma profissão.' },
  { id: 'enciclopedista', name: 'Enciclopedista', desc: 'Registrou 100 criaturas no bestiário.' },
  { id: 'fechador-veu', name: 'Aquele que Fechou o Véu', desc: 'Concluiu O Último Rasgo.' },
  { id: 'ouvinte-eco', name: 'Ouvinte do Eco', desc: 'Encontrou a Orquídea do Eco.' },
];

/** Equipamento inicial por classe: arma (modelo/material) e armadura. */
export const STARTER_KIT: Record<string, { weapon: string; weaponMat: string; offhand?: [string, string]; armor: string; armorMat: string }> = {
  guerreiro: { weapon: 'espada', weaponMat: 'lingote-bronze', offhand: ['escudo', 'tora-pinho'], armor: 'couro', armorMat: 'couro-curtido' },
  ladino: { weapon: 'adaga', weaponMat: 'lingote-bronze', armor: 'couro', armorMat: 'couro-curtido' },
  patrulheiro: { weapon: 'arco', weaponMat: 'tora-pinho', armor: 'couro', armorMat: 'couro-curtido' },
  mago: { weapon: 'cajado', weaponMat: 'tora-pinho', armor: 'vestes-runicas', armorMat: 'tecido-linho' },
  clerigo: { weapon: 'maca', weaponMat: 'lingote-bronze', offhand: ['tomo', 'tecido-linho'], armor: 'acolchoado', armorMat: 'tecido-linho' },
  druida: { weapon: 'cajado', weaponMat: 'tora-pinho', armor: 'couro', armorMat: 'couro-curtido' },
  necromante: { weapon: 'varinha', weaponMat: 'tora-pinho', offhand: ['tomo', 'tecido-linho'], armor: 'vestes-runicas', armorMat: 'tecido-linho' },
  monge: { weapon: 'punhos', weaponMat: 'couro-curtido', armor: 'acolchoado', armorMat: 'tecido-linho' },
  bardo: { weapon: 'adaga', weaponMat: 'lingote-bronze', offhand: ['instrumento', 'tora-pinho'], armor: 'acolchoado', armorMat: 'tecido-linho' },
  artifice: { weapon: 'pistola', weaponMat: 'lingote-bronze', armor: 'couro', armorMat: 'couro-curtido' },
};
