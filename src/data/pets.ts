import type { Effect } from './types.ts';
import { dmg, heal, shield, st } from './classes/helpers.ts';

/**
 * Pets são criaturas domadas em combate. Eles podem acompanhar o personagem
 * (apoio limitado, sem ação extra própria) ou partir em missões automáticas.
 */
export interface PetAffinity {
  id: string;
  label: string;
  mission: string;
  desc: string;
  /** Itens por faixa (índice = tier-1) com peso. */
  loot: [string, number][][];
  /** Chance por hora de achados especiais. */
  special?: { kind: 'mapa' | 'descoberta' | 'ouro'; chancePerHour: number };
  /** Apoio em combate: age logo após o dono, sem turno próprio. */
  assist: { name: string; desc: string; effects: Effect[]; target: 'inimigo' | 'aliado_ferido' | 'si' };
}

const tiers = (...t: [string, number][][]) => t;

export const PET_AFFINITIES: Record<string, PetAffinity> = {
  caca: {
    id: 'caca', label: 'Caçador', mission: 'Caçada', desc: 'Traz carne, couros e presas.',
    loot: tiers(
      [['carne-caca', 50], ['couro-cru', 40], ['presa', 6]],
      [['carne-caca', 40], ['couro-grosso', 40], ['presa', 10], ['la-crua', 15]],
      [['carne-caca', 30], ['couro-escamoso', 40], ['osso-grande', 15]],
      [['carne-caca', 30], ['pele-glacial', 35], ['osso-grande', 15]],
      [['carne-caca', 30], ['couro-sombrio', 30], ['osso-grande', 20]],
      [['carne-caca', 30], ['couro-veu', 25], ['couro-sombrio', 25]],
    ),
    assist: { name: 'Mordida', desc: 'Morde o alvo do dono.', target: 'inimigo', effects: [dmg(0, {}, 'fisico', { atk: 1 })] },
  },
  transporte: {
    id: 'transporte', label: 'Carregador', mission: 'Caravana', desc: 'Faz fretes entre cidades e volta com ouro e mercadorias.',
    loot: tiers(
      [['racao', 30], ['agua', 30], ['sal-rocha', 20]],
      [['racao', 30], ['agua', 30], ['lingote-ferro', 10]],
      [['racao', 30], ['tinta-arcana', 10], ['lingote-aco', 10]],
      [['racao', 30], ['cera-selagem', 20], ['lingote-aco-negro', 8]],
      [['racao', 30], ['tinta-arcana', 20], ['lingote-argenteo', 6]],
      [['racao', 30], ['tinta-arcana', 20], ['liga-veu', 4]],
    ),
    special: { kind: 'ouro', chancePerHour: 1 },
    assist: { name: 'Corpo a Corpo', desc: 'Fica à frente do dono e recebe parte dos golpes.', target: 'si', effects: [{ k: 'interceptar', ratio: 0.2, dur: 1, on: 'si' }] },
  },
  seda: {
    id: 'seda', label: 'Tecelão', mission: 'Tecelagem', desc: 'Produz seda e glândulas.',
    loot: tiers(
      [['seda-aranha', 60], ['glandula-veneno', 10]],
      [['seda-aranha', 60], ['glandula-veneno', 15]],
      [['seda-aranha', 50], ['glandula-veneno', 15], ['seda', 6]],
      [['seda-aranha', 40], ['seda', 12]],
      [['seda-aranha', 30], ['seda-lunar', 8]],
      [['seda', 30], ['seda-lunar', 12], ['tecido-veu', 3]],
    ),
    assist: { name: 'Teia', desc: 'Deixa o alvo Lento.', target: 'inimigo', effects: [st('lento', 1, { chance: 0.6 })] },
  },
  ervas: {
    id: 'ervas', label: 'Forrageador', mission: 'Forrageio', desc: 'Coleta ervas e flores.',
    loot: tiers(
      [['erva-folha-prata', 50], ['erva-raiz-amarga', 30], ['linho', 20]],
      [['flor-sangue', 40], ['cogumelo-brilho', 30], ['algodao-cinzento', 20]],
      [['lirio-pantano', 30], ['musgo-lunar', 30], ['cacto-vidro', 20]],
      [['flor-gelo', 35], ['alga-mare', 30]],
      [['fungo-miceliar', 30], ['flor-cinza', 30]],
      [['petala-veu', 25], ['fungo-miceliar', 25]],
    ),
    assist: { name: 'Pólen Calmante', desc: 'Cura um pouco o aliado mais ferido.', target: 'aliado_ferido', effects: [heal(0, {}, { pctMax: 0.04 })] },
  },
  faro: {
    id: 'faro', label: 'Farejador', mission: 'Farejar Tesouros', desc: 'Encontra minérios, gemas e, às vezes, mapas antigos.',
    loot: tiers(
      [['minerio-cobre', 40], ['quartzo', 8], ['sal-rocha', 30]],
      [['minerio-ferro', 40], ['ametista', 8]],
      [['minerio-prata', 35], ['rubi', 6]],
      [['minerio-ferro-negro', 30], ['safira', 6], ['perola', 3]],
      [['minerio-argenteo', 25], ['onix-velado', 5]],
      [['cristal-veu', 20], ['lagrima-veu', 3]],
    ),
    special: { kind: 'mapa', chancePerHour: 0.03 },
    assist: { name: 'Farejar Fraqueza', desc: 'Marca o alvo do dono.', target: 'inimigo', effects: [st('marcado', 2, { potency: 8 })] },
  },
  batedor: {
    id: 'batedor', label: 'Batedor', mission: 'Reconhecimento', desc: 'Sobrevoa a região: traz penas, mapas e pode revelar locais de trabalho.',
    loot: tiers(
      [['pena', 60], ['garra', 15]], [['pena', 60], ['garra', 15]], [['pena', 50], ['garra', 20]],
      [['pena', 50], ['garra', 20]], [['pena', 40], ['garra', 20]], [['pena', 40], ['poeira-veu', 5]],
    ),
    special: { kind: 'descoberta', chancePerHour: 0.06 },
    assist: { name: 'Bicada nos Olhos', desc: 'Pode cegar o alvo do dono.', target: 'inimigo', effects: [dmg(0, {}, 'fisico', { atk: 0.6 }), st('cegueira', 1, { potency: 20, chance: 0.4 })] },
  },
  coleta: {
    id: 'coleta', label: 'Garimpeiro', mission: 'Garimpo', desc: 'Junta sucata, gosma e minérios comuns.',
    loot: tiers(
      [['gosma', 30], ['minerio-cobre', 30], ['engrenagem-velha', 10], ['carvao', 30]],
      [['gosma', 25], ['minerio-ferro', 30], ['engrenagem-velha', 15], ['carvao', 30]],
      [['gosma', 20], ['minerio-ferro', 30], ['engrenagem-velha', 20], ['quitina', 15]],
      [['minerio-ferro-negro', 20], ['engrenagem-velha', 20], ['quitina', 20]],
      [['obsidiana', 15], ['engrenagem-velha', 20], ['quitina', 20]],
      [['cristal-veu', 10], ['engrenagem-velha', 20]],
    ),
    assist: { name: 'Casca Protetora', desc: 'Concede um pequeno escudo ao dono.', target: 'si', effects: [shield(0, {}, 1, { on: 'si' })] },
  },
  pesca: {
    id: 'pesca', label: 'Pescador', mission: 'Pescaria', desc: 'Traz peixes e materiais aquáticos.',
    loot: tiers(
      [['peixe-rio', 60], ['truta-prateada', 10]],
      [['truta-prateada', 40], ['enguia-lodo', 30]],
      [['carpa-dourada', 35], ['peixe-vidro', 25]],
      [['salmao-glacial', 30], ['baiacu-abissal', 25], ['perola', 4], ['escama-mare', 8]],
      [['peixe-lanterna', 30], ['perola', 4]],
      [['peixe-veu', 25], ['peixe-lanterna', 25]],
    ),
    assist: { name: 'Jato d\'Água', desc: 'Deixa o alvo Molhado (raio causa mais dano).', target: 'inimigo', effects: [dmg(0, {}, 'fisico', { atk: 0.5 }), st('molhado', 2)] },
  },
};

export interface PetTraitDef { id: string; name: string; desc: string; yield?: number; speed?: number; injury?: number; loyalty?: number; food?: number; combat?: number }
export const PET_TRAITS: PetTraitDef[] = [
  { id: 'farejador', name: 'Farejador', desc: '+15% de chance de achados especiais.', yield: 0.05 },
  { id: 'robusto', name: 'Robusto', desc: '−40% de chance de se ferir.', injury: -0.4 },
  { id: 'veloz', name: 'Veloz', desc: 'Missões 15% mais curtas.', speed: 0.15 },
  { id: 'leal', name: 'Leal', desc: 'Lealdade cresce 50% mais rápido.', loyalty: 0.5 },
  { id: 'guloso', name: 'Guloso', desc: 'Come o dobro, mas traz 15% a mais.', food: 1, yield: 0.15 },
  { id: 'valente', name: 'Valente', desc: '+20% de força em combate.', combat: 0.2 },
  { id: 'preguicoso', name: 'Preguiçoso', desc: 'Traz 10% a menos, mas nunca se fere em áreas seguras.', yield: -0.1, injury: -0.3 },
  { id: 'curioso', name: 'Curioso', desc: '+10% de produção, +20% de chance de se ferir.', yield: 0.1, injury: 0.2 },
];
export const petTraitById = new Map(PET_TRAITS.map((t) => [t.id, t]));

export const PET_MAX_LEVEL = 30;
export const PET_STABLE_BASE = 3;
export const PET_MISSION_DURATIONS = [1, 2, 4, 8, 12];
export const petXpForLevel = (level: number) => Math.floor(30 * Math.pow(level, 1.5) + 40);
/** Nível mínimo de pet para missões em cada faixa de região. */
export const PET_TIER_LEVEL = [0, 1, 5, 10, 15, 20, 25];
/** Ração de pet consumida por hora de missão. */
export const PET_FOOD_PER_HOUR = 0.5;
