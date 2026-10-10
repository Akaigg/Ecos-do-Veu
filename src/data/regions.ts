export type Hazard = 'frio' | 'calor' | 'toxicidade' | 'escuridao' | 'altitude';
export type Danger = 'segura' | 'moderada' | 'perigosa';

export const HAZARD_INFO: Record<Hazard, { label: string; desc: string; counters: string }> = {
  frio: { label: 'Frio', desc: 'Consome mais comida e reduz a produção.', counters: 'resistência a gelo ≥ 20, forro de lã, capa de pele ou Sopa Fumegante' },
  calor: { label: 'Calor', desc: 'Consome mais água e reduz a produção.', counters: 'resistência a fogo ≥ 20, feltro de cinzas ou Chá de Cacto Gelado' },
  toxicidade: { label: 'Toxicidade', desc: 'Causa desgaste e reduz a produção.', counters: 'resistência a veneno ≥ 20 ou Antídoto' },
  escuridao: { label: 'Escuridão', desc: 'Reduz produção e descobertas.', counters: 'Umbrinos, Poção de Visão Noturna' },
  altitude: { label: 'Altitude', desc: 'Aumenta a fadiga.', counters: 'Vigor ≥ 25 ou Orcs' },
};

export interface YieldEntry { item: string; weight: number; minLevel?: number; rare?: boolean; secondary?: boolean }

export interface WorkLocation {
  id: string;
  name: string;
  region: string;
  profession: string;
  tier: number;
  danger: Danger;
  hazard?: Hazard;
  unlock: 'inicial' | 'descoberta';
  /** Itens por hora na base (antes de perícia e ferramenta). */
  rate: number;
  yields: YieldEntry[];
  desc: string;
}

export interface RegionDef {
  id: string;
  name: string;
  hub: string;
  levels: [number, number];
  desc: string;
  hazard?: Hazard;
  travelCost: number;
  /** Nível mínimo de classe para viajar até a região. */
  minLevel: number;
  color: string;
  signature: string;
  weathers: string[];
  faction: string;
  /** Posição no mapa-múndi (em blocos). */
  map: { x: number; y: number; terrain: string };
}

export const REGIONS: RegionDef[] = [
  { id: 'bosque', name: 'Bosque Inicial', hub: 'Vau dos Errantes', levels: [1, 7], desc: 'Matas antigas ao redor da sede da Companhia dos Errantes. As primeiras rachaduras do Véu deixaram os animais inquietos.', travelCost: 0, minLevel: 1, color: '#4a8a3a', signature: 'seiva-antiga', weathers: ['limpo', 'chuva', 'nevoa'], faction: 'floresta', map: { x: 2, y: 5, terrain: 'floresta' } },
  { id: 'planicies', name: 'Planícies Partidas', hub: 'Posto da Fenda', levels: [5, 12], desc: 'Campos rasgados por fendas que exalam vento quente. Gnolls e kobolds disputam as rotas de comércio.', travelCost: 20, minLevel: 4, color: '#b0a050', signature: 'chifre-bisao', weathers: ['limpo', 'vento', 'tempestade'], faction: 'guarda', map: { x: 5, y: 5, terrain: 'campo' } },
  { id: 'minas', name: 'Minas Abandonadas', hub: 'Forte Cinzento', levels: [9, 17], desc: 'Galerias anãs evacuadas às pressas. Algo despertou nos veios mais profundos.', hazard: 'escuridao', travelCost: 35, minLevel: 8, color: '#6a6a72', signature: 'veio-ferruginoso', weathers: ['abafado', 'tremor'], faction: 'forjas', map: { x: 5, y: 2, terrain: 'montanha' } },
  { id: 'pantano', name: 'Pântano das Vozes', hub: 'Palafita das Lamparinas', levels: [14, 22], desc: 'Um brejo onde os mortos sussurram nomes. A névoa raramente se dissipa.', hazard: 'toxicidade', travelCost: 50, minLevel: 13, color: '#4a6a3a', signature: 'lodo-vivo', weathers: ['nevoa', 'chuva', 'abafado'], faction: 'mares', map: { x: 8, y: 7, terrain: 'pantano' } },
  { id: 'deserto', name: 'Deserto de Vidro', hub: 'Oásis de Âmbar', levels: [19, 27], desc: 'Areia fundida por um antigo rompimento. Tempestades cortam como lâminas.', hazard: 'calor', travelCost: 70, minLevel: 18, color: '#e0c070', signature: 'areia-vidro', weathers: ['limpo', 'tempestade-areia', 'calor-extremo'], faction: 'arquivistas', map: { x: 11, y: 8, terrain: 'deserto' } },
  { id: 'montanhas', name: 'Montanhas do Eco', hub: 'Mosteiro do Eco', levels: [24, 32], desc: 'Picos onde cada som retorna alterado. Harpias e trolls guardam as passagens.', hazard: 'altitude', travelCost: 90, minLevel: 23, color: '#8a8aa0', signature: 'eco-cristalizado', weathers: ['limpo', 'vento', 'nevoa', 'neve'], faction: 'guarda', map: { x: 9, y: 1, terrain: 'montanha' } },
  { id: 'tundra', name: 'Tundra Silenciosa', hub: 'Bastião Branco', levels: [29, 37], desc: 'Planícies geladas onde o silêncio é absoluto. Nada que morre aqui apodrece.', hazard: 'frio', travelCost: 110, minLevel: 28, color: '#d0e0f0', signature: 'gelo-eterno', weathers: ['neve', 'nevasca', 'aurora'], faction: 'forjas', map: { x: 13, y: 0, terrain: 'neve' } },
  { id: 'costa', name: 'Costa Afogada', hub: 'Porto Salobro', levels: [33, 41], desc: 'Uma cidade inteira afundou numa noite. Os sinos ainda tocam sob a maré.', travelCost: 130, minLevel: 32, color: '#3a7a9a', signature: 'sal-mares', weathers: ['limpo', 'chuva', 'tempestade', 'mare-alta'], faction: 'mares', map: { x: 15, y: 6, terrain: 'costa' } },
  { id: 'ruinas', name: 'Ruínas do Império', hub: 'Acampamento dos Arquivistas', levels: [38, 46], desc: 'A antiga capital imperial, mantida por guardiões que não sabem que seu senhor caiu.', hazard: 'escuridao', travelCost: 150, minLevel: 37, color: '#b09060', signature: 'fragmento-imperial', weathers: ['limpo', 'nevoa', 'eclipse'], faction: 'arquivistas', map: { x: 18, y: 3, terrain: 'ruinas' } },
  { id: 'fungica', name: 'Floresta Fúngica', hub: 'Clareira Luminosa', levels: [43, 51], desc: 'Fungos gigantes cobriram uma floresta inteira. O micélio pensa — e lembra.', hazard: 'toxicidade', travelCost: 170, minLevel: 42, color: '#a060b0', signature: 'micelio-luminoso', weathers: ['esporos', 'abafado', 'chuva'], faction: 'floresta', map: { x: 21, y: 7, terrain: 'fungos' } },
  { id: 'fendas', name: 'Fendas Vulcânicas', hub: 'Forja Rubra', levels: [48, 56], desc: 'Rios de lava abertos por rupturas. A melhor forja do mundo, e a mais perigosa.', hazard: 'calor', travelCost: 200, minLevel: 47, color: '#c04020', signature: 'brasa-viva', weathers: ['cinzas', 'erupcao', 'calor-extremo'], faction: 'forjas', map: { x: 23, y: 2, terrain: 'vulcao' } },
  { id: 'veu', name: 'Terras do Véu', hub: 'Última Vigília', levels: [53, 60], desc: 'Onde o Véu não existe mais. A realidade se dobra, e a Primeira Fenda aguarda.', hazard: 'escuridao', travelCost: 250, minLevel: 52, color: '#7040a0', signature: 'poeira-veu', weathers: ['distorcao', 'silencio', 'eclipse'], faction: 'companhia', map: { x: 26, y: 5, terrain: 'veu' } },
];
export const regionById = new Map(REGIONS.map((r) => [r.id, r]));

const loc = (id: string, name: string, region: string, profession: string, tier: number, danger: Danger,
  unlock: WorkLocation['unlock'], rate: number, yields: YieldEntry[], desc: string, hazard?: Hazard): WorkLocation =>
  ({ id, name, region, profession, tier, danger, unlock, rate, yields, desc, hazard: hazard ?? regionById.get(region)?.hazard });

export const WORK_LOCATIONS: WorkLocation[] = [
  // Bosque Inicial
  loc('mina-cinzenta', 'Mina Cinzenta', 'bosque', 'mineracao', 1, 'segura', 'inicial', 9, [
    { item: 'minerio-cobre', weight: 50 }, { item: 'minerio-estanho', weight: 35 }, { item: 'carvao', weight: 30 },
    { item: 'sal-rocha', weight: 15, secondary: true }, { item: 'quartzo', weight: 5, rare: true },
  ], 'Uma mina rasa e bem escorada, perto do Vau dos Errantes.', 'escuridao'),
  loc('mata-pinheiros', 'Mata dos Pinheiros', 'bosque', 'lenharia', 1, 'segura', 'inicial', 8, [
    { item: 'tora-pinho', weight: 60 }, { item: 'fibra-casca', weight: 25, secondary: true }, { item: 'resina', weight: 20, secondary: true },
  ], 'Pinheiros altos e trilhas largas.'),
  loc('clareira-ervas', 'Clareira das Ervas', 'bosque', 'herbalismo', 1, 'segura', 'inicial', 10, [
    { item: 'erva-folha-prata', weight: 50 }, { item: 'erva-raiz-amarga', weight: 30 }, { item: 'linho', weight: 25 },
    { item: 'seiva-antiga', weight: 4, rare: true, minLevel: 5 },
  ], 'Clareira ensolarada onde os curandeiros da Companhia colhem.'),
  loc('riacho-claro', 'Riacho Claro', 'bosque', 'pesca', 1, 'segura', 'inicial', 7, [
    { item: 'peixe-rio', weight: 70 }, { item: 'truta-prateada', weight: 10, minLevel: 10 },
  ], 'Águas rasas e frias.'),
  loc('trilha-cacadores', 'Trilha dos Caçadores', 'bosque', 'caca', 1, 'moderada', 'descoberta', 6, [
    { item: 'carne-caca', weight: 50 }, { item: 'couro-cru', weight: 45 }, { item: 'osso', weight: 25, secondary: true },
    { item: 'pena', weight: 15, secondary: true }, { item: 'presa', weight: 4, rare: true },
  ], 'Trilhas marcadas por armadilhas antigas. Lobos rondam à noite.'),
  // Planícies Partidas
  loc('campos-algodao', 'Campos de Algodão Cinzento', 'planicies', 'herbalismo', 2, 'segura', 'inicial', 9, [
    { item: 'algodao-cinzento', weight: 40 }, { item: 'linho', weight: 30 }, { item: 'flor-sangue', weight: 20, minLevel: 12 },
  ], 'Algodão que cresce cinzento perto das fendas.'),
  loc('pastos-partidos', 'Pastos Partidos', 'planicies', 'caca', 2, 'moderada', 'inicial', 6, [
    { item: 'couro-grosso', weight: 40 }, { item: 'la-crua', weight: 30, secondary: true }, { item: 'carne-caca', weight: 40 },
    { item: 'chifre-bisao', weight: 6, rare: true },
  ], 'Manadas nervosas pastando entre rachaduras.'),
  loc('pedreira-rachada', 'Pedreira Rachada', 'planicies', 'mineracao', 2, 'moderada', 'descoberta', 8, [
    { item: 'minerio-ferro', weight: 45 }, { item: 'carvao', weight: 30 }, { item: 'minerio-cobre', weight: 20 },
    { item: 'ametista', weight: 5, rare: true },
  ], 'Uma pedreira partida ao meio por uma fenda.'),
  // Minas Abandonadas
  loc('veios-profundos', 'Veios Profundos', 'minas', 'mineracao', 2, 'moderada', 'inicial', 9, [
    { item: 'minerio-ferro', weight: 50 }, { item: 'carvao', weight: 30 }, { item: 'minerio-prata', weight: 15, minLevel: 25 },
    { item: 'veio-ferruginoso', weight: 8, rare: true }, { item: 'rubi', weight: 3, rare: true, minLevel: 25 },
  ], 'Galerias fundas, escoradas por vigas que rangem.'),
  loc('galeria-fungos', 'Galeria dos Fungos', 'minas', 'herbalismo', 2, 'moderada', 'descoberta', 8, [
    { item: 'cogumelo-brilho', weight: 50 }, { item: 'erva-raiz-amarga', weight: 20 },
  ], 'Fungos luminosos crescem onde antes havia trilhos.'),
  loc('lago-subterraneo', 'Lago Subterrâneo', 'minas', 'pesca', 2, 'moderada', 'descoberta', 6, [
    { item: 'truta-prateada', weight: 40 }, { item: 'peixe-rio', weight: 30 }, { item: 'perola', weight: 1, rare: true },
  ], 'Um lago escuro e imóvel.'),
  // Pântano das Vozes
  loc('brejo-lirios', 'Brejo dos Lírios', 'pantano', 'herbalismo', 3, 'moderada', 'inicial', 8, [
    { item: 'lirio-pantano', weight: 40 }, { item: 'flor-sangue', weight: 20 }, { item: 'musgo-lunar', weight: 20, minLevel: 28 },
    { item: 'lodo-vivo', weight: 6, rare: true },
  ], 'Lírios pálidos em águas paradas.'),
  loc('aguas-turvas', 'Águas Turvas', 'pantano', 'pesca', 3, 'moderada', 'inicial', 6, [
    { item: 'enguia-lodo', weight: 50 }, { item: 'carpa-dourada', weight: 20, minLevel: 28 },
  ], 'Algo grande se move sob o lodo.'),
  loc('mangue-antigo', 'Mangue Antigo', 'pantano', 'lenharia', 3, 'perigosa', 'descoberta', 7, [
    { item: 'tora-carvalho', weight: 40 }, { item: 'tora-teixo', weight: 30, minLevel: 25 }, { item: 'resina', weight: 20, secondary: true },
    { item: 'ambar', weight: 6, rare: true },
  ], 'Raízes retorcidas guardam madeira rara — e carniçais.'),
  // Deserto de Vidro
  loc('jazida-vidro', 'Jazida de Vidro', 'deserto', 'mineracao', 3, 'moderada', 'inicial', 8, [
    { item: 'minerio-prata', weight: 40 }, { item: 'sal-rocha', weight: 20, secondary: true }, { item: 'areia-vidro', weight: 10, rare: true },
    { item: 'rubi', weight: 8, rare: true },
  ], 'Veios de prata expostos pelo calor.'),
  loc('oasis-ambar', 'Oásis de Âmbar', 'deserto', 'pesca', 3, 'segura', 'inicial', 6, [
    { item: 'peixe-vidro', weight: 50 }, { item: 'carpa-dourada', weight: 30 },
  ], 'Águas cristalinas cercadas de palmeiras.'),
  loc('campo-cactos', 'Campo de Cactos-de-vidro', 'deserto', 'herbalismo', 3, 'moderada', 'descoberta', 8, [
    { item: 'cacto-vidro', weight: 50 }, { item: 'erva-raiz-amarga', weight: 20 },
  ], 'Cactos translúcidos que cortam como cacos.'),
  // Montanhas do Eco
  loc('veio-alto', 'Veio Alto', 'montanhas', 'mineracao', 4, 'moderada', 'inicial', 8, [
    { item: 'minerio-ferro-negro', weight: 30, minLevel: 38 }, { item: 'minerio-prata', weight: 30 }, { item: 'safira', weight: 4, rare: true, minLevel: 38 },
    { item: 'eco-cristalizado', weight: 6, rare: true },
  ], 'Um veio exposto à beira do penhasco.'),
  loc('bosque-teixos', 'Bosque de Teixos', 'montanhas', 'lenharia', 4, 'moderada', 'inicial', 7, [
    { item: 'tora-teixo', weight: 50 }, { item: 'tora-pau-ferro', weight: 15, minLevel: 38 }, { item: 'cortica', weight: 20, secondary: true },
  ], 'Teixos centenários em encostas íngremes.'),
  loc('trilha-cabras', 'Trilha das Cabras', 'montanhas', 'caca', 4, 'perigosa', 'descoberta', 6, [
    { item: 'couro-escamoso', weight: 30 }, { item: 'couro-grosso', weight: 30 }, { item: 'osso-grande', weight: 15, secondary: true },
    { item: 'pena', weight: 20, secondary: true },
  ], 'Trilhas estreitas disputadas com grifos.'),
  // Tundra Silenciosa
  loc('lago-congelado', 'Lago Congelado', 'tundra', 'pesca', 4, 'moderada', 'inicial', 6, [
    { item: 'salmao-glacial', weight: 50 }, { item: 'perola', weight: 2, rare: true },
  ], 'Pesca em buracos no gelo.'),
  loc('campos-gelo', 'Campos de Flor-de-gelo', 'tundra', 'herbalismo', 4, 'moderada', 'inicial', 7, [
    { item: 'flor-gelo', weight: 40 }, { item: 'musgo-lunar', weight: 30 },
  ], 'Flores que só abrem no frio absoluto.'),
  loc('rastro-branco', 'Rastro Branco', 'tundra', 'caca', 4, 'perigosa', 'descoberta', 6, [
    { item: 'pele-glacial', weight: 35 }, { item: 'carne-caca', weight: 40 }, { item: 'osso-grande', weight: 15, secondary: true },
    { item: 'gelo-eterno', weight: 4, rare: true },
  ], 'Rastros de ursos glaciais na neve fresca.'),
  loc('geleira-cristal', 'Geleira de Cristal', 'tundra', 'mineracao', 4, 'perigosa', 'descoberta', 7, [
    { item: 'minerio-ferro-negro', weight: 30 }, { item: 'cristal-gelo', weight: 15 }, { item: 'safira', weight: 6, rare: true },
  ], 'Cristais presos no gelo milenar.'),
  // Costa Afogada
  loc('recifes', 'Recifes Sussurrantes', 'costa', 'pesca', 4, 'moderada', 'inicial', 6, [
    { item: 'baiacu-abissal', weight: 40 }, { item: 'escama-mare', weight: 15, secondary: true }, { item: 'perola', weight: 5, rare: true },
    { item: 'alga-mare', weight: 20, secondary: true },
  ], 'Recifes onde se ouvem sinos ao longe.'),
  loc('praia-destrocos', 'Praia dos Destroços', 'costa', 'herbalismo', 4, 'segura', 'inicial', 8, [
    { item: 'alga-mare', weight: 50 }, { item: 'sal-mares', weight: 8, rare: true }, { item: 'ambar', weight: 5, rare: true },
  ], 'Restos de navios e algas trazidas pela maré.'),
  loc('falesias', 'Falésias Salinas', 'costa', 'mineracao', 4, 'moderada', 'descoberta', 7, [
    { item: 'minerio-ferro-negro', weight: 40 }, { item: 'sal-rocha', weight: 30, secondary: true }, { item: 'safira', weight: 6, rare: true },
  ], 'Paredões batidos pelo mar.'),
  // Ruínas do Império
  loc('jardim-imperial', 'Jardim Imperial', 'ruinas', 'herbalismo', 5, 'moderada', 'inicial', 7, [
    { item: 'musgo-lunar', weight: 40 }, { item: 'lirio-pantano', weight: 20 }, { item: 'fragmento-imperial', weight: 4, rare: true },
  ], 'Jardins que ninguém cuida há séculos — e ainda florescem.'),
  loc('pedreira-imperial', 'Pedreira Imperial', 'ruinas', 'mineracao', 5, 'perigosa', 'inicial', 7, [
    { item: 'minerio-ferro-negro', weight: 40 }, { item: 'minerio-argenteo', weight: 15, minLevel: 52 }, { item: 'onix-velado', weight: 3, rare: true, minLevel: 52 },
    { item: 'fragmento-imperial', weight: 5, rare: true },
  ], 'Onde se extraía a pedra dos palácios.'),
  loc('arvoredo-cinzaluz', 'Arvoredo de Cinzaluz', 'ruinas', 'lenharia', 5, 'moderada', 'descoberta', 6, [
    { item: 'tora-pau-ferro', weight: 40 }, { item: 'tora-cinzaluz', weight: 20, minLevel: 52 },
  ], 'Árvores pálidas que brilham ao entardecer.'),
  // Floresta Fúngica
  loc('colonia-micelio', 'Colônia de Micélio', 'fungica', 'herbalismo', 5, 'perigosa', 'inicial', 7, [
    { item: 'fungo-miceliar', weight: 40, minLevel: 52 }, { item: 'cogumelo-brilho', weight: 30 }, { item: 'micelio-luminoso', weight: 6, rare: true },
  ], 'O chão pulsa sob os pés.'),
  loc('troncos-parasitados', 'Troncos Parasitados', 'fungica', 'lenharia', 5, 'perigosa', 'inicial', 6, [
    { item: 'tora-cinzaluz', weight: 35, minLevel: 52 }, { item: 'tora-pau-ferro', weight: 30 },
  ], 'Árvores tomadas por fungos — madeira leve e resistente.'),
  loc('lagoa-luminosa', 'Lagoa Luminosa', 'fungica', 'pesca', 5, 'moderada', 'descoberta', 6, [
    { item: 'peixe-lanterna', weight: 40, minLevel: 52 }, { item: 'carpa-dourada', weight: 20 },
  ], 'Água que brilha com esporos.'),
  // Fendas Vulcânicas
  loc('veios-obsidiana', 'Veios de Obsidiana', 'fendas', 'mineracao', 5, 'perigosa', 'inicial', 7, [
    { item: 'obsidiana', weight: 40, minLevel: 52 }, { item: 'minerio-argenteo', weight: 25, minLevel: 52 }, { item: 'onix-velado', weight: 4, rare: true },
    { item: 'brasa-viva', weight: 6, rare: true },
  ], 'Rocha vítrea entre rios de lava.'),
  loc('campos-cinza', 'Campos de Cinza', 'fendas', 'herbalismo', 5, 'moderada', 'inicial', 7, [
    { item: 'flor-cinza', weight: 40, minLevel: 52 }, { item: 'erva-raiz-amarga', weight: 20 },
  ], 'Flores que só crescem sobre cinza vulcânica.'),
  loc('covis-salamandra', 'Covis das Salamandras', 'fendas', 'caca', 5, 'perigosa', 'descoberta', 5, [
    { item: 'couro-sombrio', weight: 25, minLevel: 52 }, { item: 'escama', weight: 30, secondary: true }, { item: 'osso-grande', weight: 20, secondary: true },
  ], 'Tocas quentes de salamandras gigantes.'),
  // Terras do Véu
  loc('fenda-cristalina', 'Fenda Cristalina', 'veu', 'mineracao', 6, 'perigosa', 'inicial', 6, [
    { item: 'cristal-veu', weight: 25, minLevel: 66 }, { item: 'minerio-argenteo', weight: 30 }, { item: 'lagrima-veu', weight: 3, rare: true, minLevel: 66 },
    { item: 'poeira-veu', weight: 8, rare: true },
  ], 'Cristais que cantam quando tocados.'),
  loc('bosque-velado', 'Bosque Velado', 'veu', 'lenharia', 6, 'perigosa', 'inicial', 6, [
    { item: 'tora-velada', weight: 30, minLevel: 66 }, { item: 'tora-cinzaluz', weight: 30 },
  ], 'Árvores que existem em dois lugares ao mesmo tempo.'),
  loc('margem-eco', 'Margem do Eco', 'veu', 'pesca', 6, 'perigosa', 'descoberta', 5, [
    { item: 'peixe-veu', weight: 30, minLevel: 66 }, { item: 'peixe-lanterna', weight: 30 },
  ], 'Águas que refletem outro céu.'),
  loc('jardim-fendido', 'Jardim Fendido', 'veu', 'herbalismo', 6, 'perigosa', 'descoberta', 6, [
    { item: 'petala-veu', weight: 30, minLevel: 66 }, { item: 'fungo-miceliar', weight: 20 },
  ], 'Flores que nascem da própria fenda.'),
  loc('caca-umbral', 'Território Umbral', 'veu', 'caca', 6, 'perigosa', 'descoberta', 5, [
    { item: 'couro-veu', weight: 25, minLevel: 66 }, { item: 'couro-sombrio', weight: 30 },
  ], 'Feras alteradas pelo Véu.'),
];
export const workLocationById = new Map(WORK_LOCATIONS.map((l) => [l.id, l]));
export const LOCATION_MIN_LEVEL = [0, 1, 12, 25, 38, 52, 66];

export interface FactionDef { id: string; name: string; desc: string; ranks: string[] }
export const FACTIONS: FactionDef[] = [
  { id: 'companhia', name: 'Companhia dos Errantes', desc: 'Autoriza expedições, distribui contratos e registra descobertas.', ranks: ['Recruta', 'Errante', 'Batedor', 'Veterano', 'Capitão', 'Lenda'] },
  { id: 'guarda', name: 'Guarda das Estradas', desc: 'Mantém as rotas de comércio abertas.', ranks: ['Desconhecido', 'Aliado', 'Confiável', 'Honrado', 'Exaltado'] },
  { id: 'floresta', name: 'Guardiões da Floresta', desc: 'Druidas e caçadores que vigiam as matas.', ranks: ['Desconhecido', 'Aliado', 'Confiável', 'Honrado', 'Exaltado'] },
  { id: 'forjas', name: 'Irmandade das Forjas', desc: 'Ferreiros e mineradores das fortalezas.', ranks: ['Desconhecido', 'Aliado', 'Confiável', 'Honrado', 'Exaltado'] },
  { id: 'mares', name: 'Liga das Marés', desc: 'Pescadores, contrabandistas e marinheiros.', ranks: ['Desconhecido', 'Aliado', 'Confiável', 'Honrado', 'Exaltado'] },
  { id: 'arquivistas', name: 'Círculo dos Arquivistas', desc: 'Estudiosos que catalogam o que o Véu revela.', ranks: ['Desconhecido', 'Aliado', 'Confiável', 'Honrado', 'Exaltado'] },
];
export const factionById = new Map(FACTIONS.map((f) => [f.id, f]));
export const REP_PER_RANK = 1000;

/** Clima muda a cada 3 horas, de forma determinística por região. */
export const WEATHER_LABEL: Record<string, string> = {
  limpo: 'Céu limpo', chuva: 'Chuva', nevoa: 'Névoa', vento: 'Ventania', tempestade: 'Tempestade', abafado: 'Ar abafado',
  tremor: 'Tremores', 'tempestade-areia': 'Tempestade de areia', 'calor-extremo': 'Calor extremo', neve: 'Neve',
  nevasca: 'Nevasca', aurora: 'Aurora', 'mare-alta': 'Maré alta', eclipse: 'Eclipse', esporos: 'Nuvem de esporos',
  cinzas: 'Chuva de cinzas', erupcao: 'Erupção', distorcao: 'Distorção', silencio: 'Silêncio absoluto',
};
