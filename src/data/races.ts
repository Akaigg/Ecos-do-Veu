import type { AttributeId, Element } from './types.ts';

export const ATTRIBUTE_INFO: Record<AttributeId, { name: string; short: string; desc: string }> = {
  vigor: { name: 'Vigor', short: 'VIG', desc: 'Vida, resistência física e tolerância à exaustão' },
  forca: { name: 'Força', short: 'FOR', desc: 'Golpes pesados, bloqueios e capacidade de carga' },
  destreza: { name: 'Destreza', short: 'DES', desc: 'Precisão, mobilidade e armas leves' },
  intelecto: { name: 'Intelecto', short: 'INT', desc: 'Magia técnica, análise e mecanismos' },
  espirito: { name: 'Espírito', short: 'ESP', desc: 'Cura, proteção e resistência mental' },
  percepcao: { name: 'Percepção', short: 'PER', desc: 'Iniciativa, rastreamento e identificação de ameaças' },
};

/**
 * Traço racial: separado da passiva de combate. São benefícios moderados,
 * em sua maioria utilitários, para que a aparência preferida nunca seja uma escolha ruim.
 */
export type RaceTrait =
  | { t: 'troca_profissao'; discount: number }
  | { t: 'rastros_magicos'; discoveryBonus: number }
  | { t: 'avaliar_jazidas'; toolWear: number; showVein: true }
  | { t: 'exaustao'; reduction: number }
  | { t: 'suprimentos'; reduction: number }
  | { t: 'resistencia_escolhida'; amount: number; options: Element[] }
  | { t: 'sentido_escolhido'; options: ('olfato' | 'audicao' | 'visao')[] }
  | { t: 'plantas_agua'; herbYield: number; waterReduction: number }
  | { t: 'penumbra'; darkYield: number }
  | { t: 'forjado'; waterReplaced: true; cellPerHour: number };

export interface RaceDef {
  id: string;
  name: string;
  plural: string;
  identity: string;
  traitName: string;
  traitDesc: string;
  trait: RaceTrait;
  /** Paleta de aparência sugerida (pele/escamas/casca/metal). */
  skins: string[];
  features: string[];
}

export const RACES: RaceDef[] = [
  {
    id: 'humano', name: 'Humano', plural: 'Humanos', identity: 'Adaptáveis e culturalmente diversos',
    traitName: 'Versatilidade', traitDesc: 'Trocar de especialização profissional custa 50% menos.',
    trait: { t: 'troca_profissao', discount: 0.5 },
    skins: ['#f1c7a5', '#d9a07a', '#b07850', '#8a5636', '#5e3a24'], features: [],
  },
  {
    id: 'elfo', name: 'Elfo', plural: 'Elfos', identity: 'Ligados à memória e à magia',
    traitName: 'Memória do Véu', traitDesc: 'Percebem rastros mágicos: +20% de chance de descobertas durante explorações.',
    trait: { t: 'rastros_magicos', discoveryBonus: 0.2 },
    skins: ['#f4d9c0', '#e2b896', '#c8a2c8', '#9fb4c8', '#7d6a8a'], features: ['orelhas_longas'],
  },
  {
    id: 'anao', name: 'Anão', plural: 'Anões', identity: 'Habitantes de fortalezas e oficinas',
    traitName: 'Olho de Jazida', traitDesc: 'Avaliam a riqueza das jazidas antes do trabalho e desgastam ferramentas 15% menos.',
    trait: { t: 'avaliar_jazidas', toolWear: 0.15, showVein: true },
    skins: ['#efc19a', '#cf9a72', '#a8714c', '#7a4f33'], features: ['barba'],
  },
  {
    id: 'orc', name: 'Orc', plural: 'Orcs', identity: 'Povos de tradição guerreira e comunitária',
    traitName: 'Fôlego de Clã', traitDesc: 'Resistência moderada à exaustão física: a fadiga em trabalhos longos acumula 25% mais devagar.',
    trait: { t: 'exaustao', reduction: 0.25 },
    skins: ['#7fa35a', '#5f8a45', '#8c9a6a', '#6b7d5a', '#a0a080'], features: ['presas'],
  },
  {
    id: 'pequeno', name: 'Pequeno', plural: 'Pequenos', identity: 'Viajantes, comerciantes e exploradores',
    traitName: 'Mochila Esperta', traitDesc: 'Consomem 15% menos comida e água em viagens e trabalhos.',
    trait: { t: 'suprimentos', reduction: 0.15 },
    skins: ['#f6cfae', '#e0aa82', '#b98260', '#8f6040'], features: ['baixo'],
  },
  {
    id: 'draconato', name: 'Draconato', plural: 'Draconatos', identity: 'Descendentes de antigas linhagens dracônicas',
    traitName: 'Sangue Antigo', traitDesc: 'Escolhem uma resistência elemental pequena (fogo, gelo, raio ou veneno).',
    trait: { t: 'resistencia_escolhida', amount: 30, options: ['fogo', 'gelo', 'raio', 'veneno'] },
    skins: ['#b8433a', '#3a7ab8', '#c9a227', '#3f8a52', '#6a4a9a', '#8a8a8a'], features: ['chifres', 'escamas'],
  },
  {
    id: 'feral', name: 'Feral', plural: 'Ferais', identity: 'Povos de características animais variadas',
    traitName: 'Sentido Aguçado', traitDesc: 'Escolhem um sentido: olfato (rastros e caça), audição (evita emboscadas) ou visão (descobertas).',
    trait: { t: 'sentido_escolhido', options: ['olfato', 'audicao', 'visao'] },
    skins: ['#a87a50', '#d8b080', '#6a5040', '#e8e0d0', '#404040'], features: ['orelhas_animais', 'pelagem'],
  },
  {
    id: 'silvestre', name: 'Silvestre', plural: 'Silvestres', identity: 'Seres ligados à flora e aos ciclos naturais',
    traitName: 'Raiz Antiga', traitDesc: 'Identificam plantas (+10% no herbalismo) e fontes de água (−40% de água em regiões naturais).',
    trait: { t: 'plantas_agua', herbYield: 0.1, waterReduction: 0.4 },
    skins: ['#8fb07a', '#a89a6a', '#6a8a5a', '#b0c890'], features: ['folhas'],
  },
  {
    id: 'umbrino', name: 'Umbrino', plural: 'Umbrinos', identity: 'Transformados pela proximidade do Véu',
    traitName: 'Olhos da Penumbra', traitDesc: 'Enxergam melhor em pouca luz: sem penalidade de escuridão e +10% de rendimento em locais escuros.',
    trait: { t: 'penumbra', darkYield: 0.1 },
    skins: ['#9a9ab8', '#7a7a9a', '#5a5a7a', '#c0b0d0'], features: ['olhos_brilhantes', 'veios'],
  },
  {
    id: 'forjado', name: 'Forjado', plural: 'Forjados', identity: 'Seres artificiais conscientes',
    traitName: 'Corpo de Engrenagens', traitDesc: 'Não consomem água: usam células de energia (1 a cada 4 horas) e manutenção.',
    trait: { t: 'forjado', waterReplaced: true, cellPerHour: 0.25 },
    skins: ['#a0a4a8', '#b08a5a', '#6a6e74', '#c8b070'], features: ['placas', 'olhos_brilhantes'],
  },
];

export interface OriginDef {
  id: string;
  name: string;
  desc: string;
  perk: string;
  /** Itens iniciais extras. */
  items: [string, number][];
  gold: number;
  /** Etiqueta usada por escolhas narrativas em campanhas. */
  tag: string;
  bonus?: { craftXp?: number; gatherXp?: number; repStart?: [string, number]; supplies?: number; travel?: number };
}

export const ORIGINS: OriginDef[] = [
  { id: 'ex-soldado', name: 'Ex-soldado', desc: 'Serviu em uma guarnição antes de o Véu rachar as fronteiras.', perk: 'Começa com reputação com a Guarda das Estradas e uma ração extra por expedição.', items: [['racao', 6]], gold: 40, tag: 'soldado', bonus: { repStart: ['guarda', 150] } },
  { id: 'aprendiz-artesao', name: 'Aprendiz de artesão', desc: 'Cresceu entre bancadas, moldes e encomendas atrasadas.', perk: '+10% de experiência em profissões de fabricação.', items: [['lingote-cobre', 4]], gold: 40, tag: 'artesao', bonus: { craftXp: 0.1 } },
  { id: 'eremita', name: 'Eremita', desc: 'Viveu anos longe das cidades, lendo o tempo pelas plantas.', perk: '+10% de experiência em profissões de coleta.', items: [['erva-folha-prata', 6]], gold: 20, tag: 'eremita', bonus: { gatherXp: 0.1 } },
  { id: 'naufrago', name: 'Sobrevivente de naufrágio', desc: 'Foi o único a voltar quando a maré trouxe a névoa.', perk: 'Consome 5% menos suprimentos e começa com reputação na Liga das Marés.', items: [['agua', 6]], gold: 30, tag: 'naufrago', bonus: { supplies: 0.05, repStart: ['mares', 150] } },
  { id: 'estudioso', name: 'Estudioso', desc: 'Catalogava ruínas para a Academia antes de virar aventureiro.', perk: 'Começa com reputação com o Círculo dos Arquivistas e pistas extras no bestiário.', items: [['tinta-arcana', 2]], gold: 40, tag: 'estudioso', bonus: { repStart: ['arquivistas', 150] } },
  { id: 'artista', name: 'Artista itinerante', desc: 'Atravessou vilarejos trocando canções por abrigo.', perk: 'Viagens entre cidades custam 25% menos.', items: [['pao-viagem', 3]], gold: 60, tag: 'artista', bonus: { travel: 0.25 } },
  { id: 'cacador', name: 'Caçador de fronteira', desc: 'Conhece trilhas, armadilhas e o cheiro da chuva.', perk: 'Começa com uma isca extra e reputação com os Guardiões da Floresta.', items: [['isca-simples', 3]], gold: 30, tag: 'cacador', bonus: { repStart: ['floresta', 150] } },
  { id: 'nobre-caido', name: 'Nobre caído', desc: 'Perdeu título e terras quando a primeira fenda se abriu.', perk: 'Começa com mais ouro e um visual de sobretudo elegante.', items: [], gold: 150, tag: 'nobre' },
];

export const PRONOUNS = ['ele/dele', 'ela/dela', 'elu/delu', 'outro'];
export const HEIGHTS = ['baixa', 'média', 'alta'] as const;
export const BUILDS = ['esguia', 'atlética', 'robusta'] as const;
export const HAIR_STYLES = ['raspado', 'curto', 'longo', 'trança', 'moicano', 'coque', 'cacheado'] as const;
export const HAIR_COLORS: Record<string, string> = {
  preto: '#22202a', castanho: '#5a3a22', ruivo: '#a8452a', loiro: '#d8b450', branco: '#e8e8f0',
  cinza: '#8a8a94', azul: '#3a5ab0', verde: '#3a8a4a', violeta: '#7a4ab0', rosa: '#d07aa8',
};
export const EYE_COLORS: Record<string, string> = {
  castanho: '#5a3a22', azul: '#3a7ad0', verde: '#3aa050', ambar: '#d09020', cinza: '#9098a0',
  violeta: '#9a5ad0', vermelho: '#c03030', dourado: '#e0c040',
};
export const MARKS = ['nenhuma', 'cicatriz', 'tatuagem', 'pintura', 'sardas', 'runas'] as const;

export const raceById = new Map(RACES.map((r) => [r.id, r]));
export const originById = new Map(ORIGINS.map((o) => [o.id, o]));
