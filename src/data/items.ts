import type { ConsumableUse, Element, ItemDef, ItemKind } from './types.ts';

const ITEMS: ItemDef[] = [];
const tierValue = (tier: number, base = 3) => Math.round(base * Math.pow(2.2, tier - 1));

function add(id: string, name: string, kind: ItemKind, tier: number, icon: string, color: string,
  opts: { weight?: number; value?: number; desc?: string; use?: ConsumableUse; untradeable?: boolean } = {}): void {
  ITEMS.push({
    id, name, kind, tier, icon, color, weight: opts.weight ?? 1, value: opts.value ?? tierValue(tier),
    desc: opts.desc, use: opts.use, untradeable: opts.untradeable,
  });
}

// ------------------------------------------------------------ Mineração
add('minerio-cobre', 'Minério de Cobre', 'minerio', 1, 'minerio', '#c87533', { weight: 2 });
add('minerio-estanho', 'Minério de Estanho', 'minerio', 1, 'minerio', '#a8b0b8', { weight: 2 });
add('carvao', 'Carvão', 'minerio', 1, 'minerio', '#3a3a40', { weight: 1 });
add('sal-rocha', 'Sal de Rocha', 'minerio', 1, 'cristal', '#f0e8e0', { weight: 1, desc: 'Usado em curtume, conservas e polimento.' });
add('quartzo', 'Quartzo', 'gema', 1, 'gema', '#e8e8f8', { weight: 0.2 });
add('minerio-ferro', 'Minério de Ferro', 'minerio', 2, 'minerio', '#8a6a5a', { weight: 2 });
add('ametista', 'Ametista', 'gema', 2, 'gema', '#9a5ad0', { weight: 0.2 });
add('minerio-prata', 'Minério de Prata', 'minerio', 3, 'minerio', '#d0d8e0', { weight: 2 });
add('rubi', 'Rubi', 'gema', 3, 'gema', '#d03040', { weight: 0.2 });
add('minerio-ferro-negro', 'Minério de Ferro Negro', 'minerio', 4, 'minerio', '#3a3048', { weight: 2.5 });
add('safira', 'Safira', 'gema', 4, 'gema', '#3060d0', { weight: 0.2 });
add('cristal-gelo', 'Cristal de Gelo Eterno', 'gema', 4, 'cristal', '#a0e0f8', { weight: 0.5 });
add('minerio-argenteo', 'Minério Argênteo', 'minerio', 5, 'minerio', '#c0f0f0', { weight: 1.5 });
add('obsidiana', 'Obsidiana', 'minerio', 5, 'cristal', '#2a1a3a', { weight: 2 });
add('onix-velado', 'Ônix Velado', 'gema', 5, 'gema', '#4a2a6a', { weight: 0.2 });
add('cristal-veu', 'Cristal do Véu', 'minerio', 6, 'cristal', '#c080ff', { weight: 1 });
add('lagrima-veu', 'Lágrima do Véu', 'gema', 6, 'gema', '#f0a0ff', { weight: 0.2 });

// Lingotes (Ferraria)
add('lingote-cobre', 'Lingote de Cobre', 'lingote', 1, 'lingote', '#c87533', { weight: 1 });
add('lingote-bronze', 'Lingote de Bronze', 'lingote', 1, 'lingote', '#b08a3a', { weight: 1 });
add('lingote-ferro', 'Lingote de Ferro', 'lingote', 2, 'lingote', '#8a8a92', { weight: 1 });
add('lingote-aco', 'Lingote de Aço', 'lingote', 3, 'lingote', '#b0b8c8', { weight: 1 });
add('lingote-prata', 'Lingote de Prata', 'lingote', 3, 'lingote', '#e0e8f0', { weight: 0.9 });
add('lingote-aco-negro', 'Lingote de Aço Negro', 'lingote', 4, 'lingote', '#4a4058', { weight: 1 });
add('lingote-argenteo', 'Lingote Argênteo', 'lingote', 5, 'lingote', '#b0f0f0', { weight: 0.7 });
add('liga-veu', 'Liga do Véu', 'lingote', 6, 'lingote', '#b070f0', { weight: 0.8 });

// ------------------------------------------------------------ Lenharia
add('tora-pinho', 'Tora de Pinho', 'madeira', 1, 'tora', '#a0703a', { weight: 3 });
add('fibra-casca', 'Fibra de Casca', 'fibra', 1, 'fibra', '#a08a5a', { weight: 0.3 });
add('resina', 'Resina', 'resina', 1, 'resina', '#d0902a', { weight: 0.3 });
add('tora-carvalho', 'Tora de Carvalho', 'madeira', 2, 'tora', '#7a5030', { weight: 3 });
add('cortica', 'Cortiça', 'madeira', 2, 'fibra', '#c09060', { weight: 0.3 });
add('tora-teixo', 'Tora de Teixo', 'madeira', 3, 'tora', '#8a3a2a', { weight: 3 });
add('ambar', 'Âmbar', 'resina', 3, 'gema', '#e0a020', { weight: 0.2 });
add('tora-pau-ferro', 'Tora de Pau-ferro', 'madeira', 4, 'tora', '#4a3a3a', { weight: 3.5 });
add('tora-cinzaluz', 'Tora de Cinzaluz', 'madeira', 5, 'tora', '#d0c8b0', { weight: 2.5 });
add('tora-velada', 'Tora Velada', 'madeira', 6, 'tora', '#7050a0', { weight: 2.5 });

// ------------------------------------------------------------ Herbalismo
add('erva-folha-prata', 'Folha-prata', 'erva', 1, 'erva', '#a0c8a0', { weight: 0.1 });
add('erva-raiz-amarga', 'Raiz Amarga', 'erva', 1, 'raiz', '#8a6a3a', { weight: 0.2 });
add('linho', 'Linho', 'fibra', 1, 'fibra', '#e0d8b0', { weight: 0.2 });
add('flor-sangue', 'Flor-de-sangue', 'erva', 2, 'flor', '#c02030', { weight: 0.1 });
add('cogumelo-brilho', 'Cogumelo-brilho', 'fungo', 2, 'cogumelo', '#60d0c0', { weight: 0.1 });
add('algodao-cinzento', 'Algodão Cinzento', 'fibra', 2, 'fibra', '#c0c0c8', { weight: 0.2 });
add('lirio-pantano', 'Lírio do Pântano', 'erva', 3, 'flor', '#d0e070', { weight: 0.1 });
add('musgo-lunar', 'Musgo Lunar', 'erva', 3, 'erva', '#a0b0f0', { weight: 0.1 });
add('cacto-vidro', 'Cacto-de-vidro', 'erva', 3, 'erva', '#90e0d0', { weight: 0.2 });
add('flor-gelo', 'Flor-de-gelo', 'erva', 4, 'flor', '#d0f0ff', { weight: 0.1 });
add('alga-mare', 'Alga das Marés', 'erva', 4, 'erva', '#3a8a6a', { weight: 0.2 });
add('fungo-miceliar', 'Fungo Miceliar', 'fungo', 5, 'cogumelo', '#d080d0', { weight: 0.1 });
add('flor-cinza', 'Flor-de-cinza', 'erva', 5, 'flor', '#f07030', { weight: 0.1 });
add('petala-veu', 'Pétala do Véu', 'erva', 6, 'flor', '#e0a0ff', { weight: 0.1 });

// ------------------------------------------------------------ Pesca
add('peixe-rio', 'Peixe de Rio', 'peixe', 1, 'peixe', '#7a9ab0', { weight: 0.6 });
add('truta-prateada', 'Truta Prateada', 'peixe', 2, 'peixe', '#c0d0e0', { weight: 0.7 });
add('enguia-lodo', 'Enguia do Lodo', 'peixe', 2, 'peixe', '#5a6a3a', { weight: 0.8 });
add('carpa-dourada', 'Carpa Dourada', 'peixe', 3, 'peixe', '#e0b030', { weight: 0.8 });
add('peixe-vidro', 'Peixe-vidro', 'peixe', 3, 'peixe', '#b0f0f0', { weight: 0.5 });
add('salmao-glacial', 'Salmão Glacial', 'peixe', 4, 'peixe', '#f09080', { weight: 1 });
add('baiacu-abissal', 'Baiacu Abissal', 'peixe', 4, 'peixe', '#4a5a8a', { weight: 0.8 });
add('perola', 'Pérola', 'gema', 4, 'perola', '#f0f0f0', { weight: 0.1 });
add('escama-mare', 'Escama das Marés', 'monstro', 4, 'escama', '#3a9ab0', { weight: 0.2 });
add('peixe-lanterna', 'Peixe-lanterna', 'peixe', 5, 'peixe', '#f0e070', { weight: 0.6 });
add('peixe-veu', 'Peixe do Véu', 'peixe', 6, 'peixe', '#b080e0', { weight: 0.6 });

// ------------------------------------------------------------ Caça e Curtume
add('carne-caca', 'Carne de Caça', 'carne', 1, 'carne', '#c05040', { weight: 0.8 });
add('couro-cru', 'Couro Cru', 'couro', 1, 'couro', '#a07050', { weight: 1 });
add('osso', 'Osso', 'osso', 1, 'osso', '#e8e0c8', { weight: 0.5 });
add('pena', 'Pena', 'monstro', 1, 'pena', '#e0e0e0', { weight: 0.05 });
add('couro-grosso', 'Couro Grosso', 'couro', 2, 'couro', '#7a5030', { weight: 1.2 });
add('la-crua', 'Lã Crua', 'fibra', 2, 'fibra', '#f0e8d8', { weight: 0.4 });
add('presa', 'Presa', 'monstro', 2, 'presa', '#f0e8d0', { weight: 0.2 });
add('couro-escamoso', 'Couro Escamoso', 'couro', 3, 'couro', '#5a7a4a', { weight: 1.2 });
add('osso-grande', 'Osso Grande', 'osso', 3, 'osso', '#d8d0b0', { weight: 1.5 });
add('pele-glacial', 'Pele Glacial', 'couro', 4, 'couro', '#e0f0f8', { weight: 1.3 });
add('couro-sombrio', 'Couro Sombrio', 'couro', 5, 'couro', '#3a2a4a', { weight: 1 });
add('couro-veu', 'Couro do Véu', 'couro', 6, 'couro', '#7a4aa0', { weight: 0.9 });

// Couros curtidos (Caça e Curtume)
add('couro-curtido', 'Couro Curtido', 'couro', 1, 'couro-curtido', '#b08050');
add('couro-reforcado', 'Couro Reforçado', 'couro', 2, 'couro-curtido', '#8a5a30');
add('couro-escama', 'Couro de Escama', 'couro', 3, 'couro-curtido', '#5a8a5a');
add('couro-glacial', 'Couro Glacial', 'couro', 4, 'couro-curtido', '#c8e0f0');
add('couro-sombrio-curtido', 'Couro Sombrio Curtido', 'couro', 5, 'couro-curtido', '#4a3a5a');
add('couro-velado', 'Couro Velado', 'couro', 6, 'couro-curtido', '#8a5ab0');

// Tecidos (Alfaiataria)
add('tecido-linho', 'Tecido de Linho', 'tecido', 1, 'tecido', '#e0d8b0');
add('tecido-la', 'Tecido de Lã', 'tecido', 2, 'tecido', '#d8c8a8');
add('seda', 'Seda', 'tecido', 3, 'tecido', '#f0f0ff');
add('seda-lunar', 'Seda Lunar', 'tecido', 4, 'tecido', '#b0c0ff');
add('tecido-cinzas', 'Tecido de Cinzas', 'tecido', 5, 'tecido', '#8a6a6a');
add('tecido-veu', 'Tecido do Véu', 'tecido', 6, 'tecido', '#c090f0');

// ------------------------------------------------------------ Partes de criaturas
add('seda-aranha', 'Seda de Aranha', 'monstro', 1, 'seda', '#f0f0f0', { weight: 0.1 });
add('quitina', 'Quitina', 'monstro', 2, 'quitina', '#6a5a3a', { weight: 0.4 });
add('garra', 'Garra', 'monstro', 1, 'garra', '#d8d0c0', { weight: 0.1 });
add('glandula-veneno', 'Glândula de Veneno', 'monstro', 2, 'gota', '#80c040', { weight: 0.1 });
add('gosma', 'Gosma', 'monstro', 1, 'gota', '#60c060', { weight: 0.3 });
add('escama', 'Escama', 'monstro', 2, 'escama', '#4a8a5a', { weight: 0.1 });
add('esporo', 'Esporo', 'monstro', 2, 'esporo', '#c0a0d0', { weight: 0.05 });
add('engrenagem-velha', 'Engrenagem Velha', 'componente', 2, 'engrenagem', '#a08a5a', { weight: 0.3 });
add('essencia-sombria', 'Essência Sombria', 'essencia', 3, 'essencia', '#5a3a8a', { weight: 0.05 });
add('nucleo-elemental', 'Núcleo Elemental', 'essencia', 3, 'nucleo', '#f0a040', { weight: 0.3 });
add('olho-arcano', 'Olho Arcano', 'monstro', 4, 'olho', '#a060f0', { weight: 0.1 });
add('fragmento-veu', 'Fragmento do Véu', 'essencia', 6, 'fragmento', '#d090ff', { weight: 0.05 });

// Materiais regionais (marca de cada região)
add('seiva-antiga', 'Seiva Antiga', 'reagente', 1, 'gota', '#c0a030', { desc: 'Bosque Inicial' });
add('chifre-bisao', 'Chifre de Bisão', 'monstro', 2, 'presa', '#a08060', { desc: 'Planícies Partidas' });
add('veio-ferruginoso', 'Veio Ferruginoso', 'minerio', 2, 'cristal', '#b05a3a', { desc: 'Minas Abandonadas' });
add('lodo-vivo', 'Lodo Vivo', 'reagente', 3, 'gota', '#5a7a2a', { desc: 'Pântano das Vozes' });
add('areia-vidro', 'Areia de Vidro', 'reagente', 3, 'cristal', '#f0e0a0', { desc: 'Deserto de Vidro' });
add('eco-cristalizado', 'Eco Cristalizado', 'reagente', 4, 'cristal', '#a0c0e0', { desc: 'Montanhas do Eco' });
add('gelo-eterno', 'Gelo Eterno', 'reagente', 4, 'cristal', '#c0f0ff', { desc: 'Tundra Silenciosa' });
add('sal-mares', 'Sal das Marés', 'reagente', 4, 'cristal', '#a0d0d0', { desc: 'Costa Afogada' });
add('fragmento-imperial', 'Fragmento Imperial', 'reagente', 5, 'fragmento', '#d0b060', { desc: 'Ruínas do Império' });
add('micelio-luminoso', 'Micélio Luminoso', 'reagente', 5, 'esporo', '#80f0c0', { desc: 'Floresta Fúngica' });
add('brasa-viva', 'Brasa Viva', 'reagente', 5, 'nucleo', '#f05020', { desc: 'Fendas Vulcânicas' });
add('poeira-veu', 'Poeira do Véu', 'reagente', 6, 'esporo', '#c0a0f0', { desc: 'Terras do Véu' });

// Materiais de chefes
const BOSS_MATS: [string, string, number, string, string][] = [
  ['presa-ancestral', 'Presa Ancestral', 2, 'presa', '#f0e0b0'],
  ['seda-matriarca', 'Seda da Matriarca', 2, 'seda', '#f8f0ff'],
  ['engrenagem-rei', 'Engrenagem do Rei', 2, 'engrenagem', '#d0a030'],
  ['nucleo-colosso', 'Núcleo do Colosso', 3, 'nucleo', '#a0a0b0'],
  ['essencia-brejo', 'Essência do Brejo', 3, 'essencia', '#6a8a3a'],
  ['escama-hidra', 'Escama de Hidra', 3, 'escama', '#3a8a6a'],
  ['vidro-tempestuoso', 'Vidro Tempestuoso', 4, 'cristal', '#e0d090'],
  ['espelho-farao', 'Espelho Faraônico', 4, 'cristal', '#f0f0c0'],
  ['pluma-rainha', 'Pluma da Rainha', 4, 'pena', '#c0c0e0'],
  ['placa-tita', 'Placa do Titã', 4, 'quitina', '#8a8a9a'],
  ['coracao-glacial', 'Coração Glacial', 5, 'nucleo', '#a0e0ff'],
  ['prisma-aurora', 'Prisma da Aurora', 5, 'gema', '#f0b0e0'],
  ['ancora-afogada', 'Âncora Afogada', 5, 'lingote', '#3a5a6a'],
  ['tentaculo-acorrentado', 'Tentáculo Acorrentado', 5, 'carne', '#8a3a6a'],
  ['mascara-sem-rosto', 'Máscara Sem Rosto', 5, 'fragmento', '#e0e0e0'],
  ['pagina-proibida', 'Página Proibida', 5, 'mapa', '#c0a070'],
  ['esporo-mae', 'Esporo-Mãe', 6, 'esporo', '#f080f0'],
  ['brasa-primordial', 'Brasa Primordial', 6, 'nucleo', '#ff6020'],
  ['escama-obsidiana', 'Escama de Obsidiana', 6, 'escama', '#3a2a4a'],
  ['reliquia-veu', 'Relíquia do Véu', 6, 'fragmento', '#ffb0ff'],
];
for (const [id, name, tier, icon, color] of BOSS_MATS) add(id, name, 'monstro', tier, icon, color, { value: tierValue(tier, 25) });

// ------------------------------------------------------------ Consumíveis
// Poções (Alquimia)
const potionTiers: [string, number, number][] = [['menor', 1, 30], ['comum', 2, 70], ['maior', 4, 140], ['superior', 6, 260]];
for (const [suffix, tier, power] of potionTiers) {
  add(`pocao-vida-${suffix}`, `Poção de Vida ${suffix[0].toUpperCase()}${suffix.slice(1)}`, 'pocao', tier, 'pocao', '#e03040',
    { weight: 0.3, use: { t: 'cura', power, pct: 0.1 } });
  add(`pocao-recurso-${suffix}`, `Tônico de Recurso ${suffix[0].toUpperCase()}${suffix.slice(1)}`, 'pocao', tier, 'pocao', '#3060e0',
    { weight: 0.3, use: { t: 'recurso', amount: 20 + tier * 8 } });
}
add('antidoto', 'Antídoto', 'pocao', 1, 'pocao', '#60c040', { weight: 0.2, use: { t: 'purificar', statuses: ['veneno', 'decadencia', 'sangramento'], resist: 20 } });
add('pocao-regeneracao', 'Poção de Regeneração', 'pocao', 3, 'pocao', '#e080a0', { weight: 0.3, use: { t: 'regeneracao', power: 18, rounds: 4 } });
add('pocao-visao', 'Poção de Visão Noturna', 'pocao', 2, 'pocao', '#a0a0f0', { weight: 0.2, use: { t: 'visao', hours: 3 }, desc: 'Remove a penalidade de escuridão em explorações e trabalhos.' });
const RES_POTIONS: [Element, string, string][] = [['fogo', 'Fogo', '#f07030'], ['gelo', 'Gelo', '#80d0f0'], ['veneno', 'Veneno', '#80c040'], ['raio', 'Raio', '#f0e040'], ['sombra', 'Sombra', '#6a4a9a']];
for (const [elem, label, color] of RES_POTIONS) {
  add(`pocao-res-${elem}`, `Poção de Resistência a ${label}`, 'pocao', 3, 'pocao', color, { weight: 0.3, use: { t: 'resistencia', elem, amount: 60, rounds: 5 } });
}
// Óleos de arma (aplicados antes de expedições)
const OILS: [string, string, Element, string, ConsumableUse][] = [
  ['oleo-inflamavel', 'Óleo Inflamável', 'fogo', '#f08030', { t: 'oleo', elem: 'fogo', bonus: 0.15, fights: 8, status: 'queimadura' }],
  ['oleo-gelido', 'Óleo Gélido', 'gelo', '#80d0f0', { t: 'oleo', elem: 'gelo', bonus: 0.15, fights: 8, status: 'resfriado' }],
  ['oleo-peconhento', 'Óleo Peçonhento', 'veneno', '#80c040', { t: 'oleo', elem: 'veneno', bonus: 0.15, fights: 8, status: 'veneno' }],
  ['oleo-sagrado', 'Óleo Sagrado', 'luz', '#f0e080', { t: 'oleo', elem: 'luz', bonus: 0.2, fights: 8 }],
  ['oleo-condutor', 'Óleo Condutor', 'raio', '#f0f060', { t: 'oleo', elem: 'raio', bonus: 0.15, fights: 8 }],
];
for (const [id, name, , color, use] of OILS) add(id, name, 'oleo', 2, 'frasco', color, { weight: 0.3, use });
add('solvente', 'Solvente Alquímico', 'reagente', 2, 'frasco', '#d0d0a0', { weight: 0.2, desc: 'Usado para remover runas sem destruí-las.' });
add('tinta-arcana', 'Tinta Arcana', 'reagente', 2, 'frasco', '#6040c0', { weight: 0.1, desc: 'Base para gravar runas.' });
add('cera-selagem', 'Cera de Selagem', 'reagente', 1, 'resina', '#d0b060', { weight: 0.2 });

// Suprimentos (atividades)
add('racao', 'Ração de Expedição', 'suprimento', 1, 'racao', '#b08a5a', { weight: 0.5, value: 2, use: { t: 'racao', hours: 1 } });
add('agua', 'Cantil de Água', 'suprimento', 1, 'cantil', '#5a9ad0', { weight: 0.5, value: 1, use: { t: 'agua', hours: 1 } });
add('celula-energia', 'Célula de Energia', 'suprimento', 1, 'celula', '#60e0f0', { weight: 0.2, value: 4, use: { t: 'celula', hours: 4 } });

// Refeições (Culinária) — um benefício principal por vez
add('pao-viagem', 'Pão de Viagem', 'comida', 1, 'pao', '#d0a060', { weight: 0.3, use: { t: 'refeicao', minutes: 60, buff: { label: 'Bem alimentado', stats: { vigor: 2 } } } });
add('ensopado-cacador', 'Ensopado do Caçador', 'comida', 2, 'ensopado', '#a05030', { weight: 0.5, use: { t: 'refeicao', minutes: 120, buff: { label: 'Ensopado do Caçador', stats: { vigor: 4, forca: 2 } } } });
add('peixe-assado', 'Peixe Assado com Ervas', 'comida', 2, 'peixe-assado', '#d08a40', { weight: 0.4, use: { t: 'refeicao', minutes: 120, buff: { label: 'Peixe com Ervas', stats: { percepcao: 4, destreza: 2 } } } });
add('torta-ervas', 'Torta de Ervas Lunares', 'comida', 3, 'pao', '#90a0d0', { weight: 0.4, use: { t: 'refeicao', minutes: 120, buff: { label: 'Torta Lunar', stats: { espirito: 5, intelecto: 3 } } } });
add('banquete-minerador', 'Banquete do Minerador', 'comida', 3, 'ensopado', '#8a6a4a', { weight: 0.6, use: { t: 'refeicao', minutes: 240, buff: { label: 'Banquete do Minerador', stats: { forca: 3 }, workYield: 0.1 } } });
add('sopa-quente', 'Sopa Fumegante', 'comida', 3, 'ensopado', '#d06030', { weight: 0.5, use: { t: 'refeicao', minutes: 180, buff: { label: 'Aquecido', stats: { vigor: 3 } } }, desc: 'Protege do frio nas regiões geladas.' });
add('cha-gelado', 'Chá de Cacto Gelado', 'comida', 3, 'cantil', '#80e0c0', { weight: 0.3, use: { t: 'refeicao', minutes: 180, buff: { label: 'Refrescado', stats: { espirito: 2 } } }, desc: 'Protege do calor no deserto e nas fendas.' });
add('banquete-heroico', 'Banquete Heroico', 'comida', 5, 'ensopado', '#e0a040', { weight: 0.8, use: { t: 'refeicao', minutes: 240, buff: { label: 'Banquete Heroico', stats: { vigor: 6, forca: 4, destreza: 4, intelecto: 4, espirito: 4 } } } });

// Pets
add('petisco', 'Petisco para Pets', 'petisco', 1, 'carne', '#e08060', { weight: 0.2, use: { t: 'petisco', loyalty: 5, heal: 0.3 } });
add('racao-pet', 'Ração de Pet', 'petisco', 2, 'racao', '#c09060', { weight: 0.4, use: { t: 'petisco', loyalty: 2, heal: 0.1 }, desc: 'Consumida por pets em missões (1 a cada 2 horas).' });
add('isca-simples', 'Isca Simples', 'isca', 1, 'isca', '#c0a060', { weight: 0.2, use: { t: 'isca', bonus: 0, maxTier: 2 } });
add('isca-aromatica', 'Isca Aromática', 'isca', 3, 'isca', '#e08040', { weight: 0.2, use: { t: 'isca', bonus: 0.1, maxTier: 4 } });
add('isca-veu', 'Isca do Véu', 'isca', 5, 'isca', '#c080f0', { weight: 0.2, use: { t: 'isca', bonus: 0.2, maxTier: 6 } });

// Runas (Engenharia Rúnica) em três graus
export const RUNE_TYPES: Record<string, { name: string; stat: string; per: number; color: string }> = {
  protecao: { name: 'Proteção', stat: 'armadura', per: 6, color: '#a0a0b0' },
  vida: { name: 'Vida', stat: 'vida', per: 12, color: '#e04050' },
  foco: { name: 'Foco', stat: 'dano_magico', per: 3, color: '#5070e0' },
  furia: { name: 'Fúria', stat: 'critico', per: 2, color: '#e07030' },
  mobilidade: { name: 'Mobilidade', stat: 'esquiva', per: 2, color: '#60d0a0' },
  precisao: { name: 'Precisão', stat: 'dano_fisico', per: 3, color: '#d0d060' },
  graca: { name: 'Graça', stat: 'cura', per: 4, color: '#f0e0a0' },
  'res-fogo': { name: 'Brasa Contida', stat: 'res_fogo', per: 12, color: '#f07030' },
  'res-gelo': { name: 'Inverno Contido', stat: 'res_gelo', per: 12, color: '#80d0f0' },
  'res-raio': { name: 'Aterramento', stat: 'res_raio', per: 12, color: '#f0e040' },
  'res-veneno': { name: 'Pureza', stat: 'res_veneno', per: 12, color: '#80c040' },
  'res-sombra': { name: 'Vigília', stat: 'res_sombra', per: 12, color: '#7050a0' },
  'res-arcano': { name: 'Silêncio', stat: 'res_arcano', per: 12, color: '#a070f0' },
};
export const RUNE_GRADES: [number, string, number][] = [[1, 'Menor', 1], [2, '', 3], [3, 'Maior', 5]];
for (const [key, r] of Object.entries(RUNE_TYPES)) {
  for (const [grade, label, tier] of RUNE_GRADES) {
    add(`runa-${key}-${grade}`, `Runa${label ? ' ' + label : ''} de ${r.name}`, 'runa', tier, 'runa', r.color, { weight: 0.1, value: tierValue(tier, 8) });
  }
}

// Mapas de tesouro (um por região, dropados em áreas antigas)
export const TREASURE_MAP_REGIONS = ['bosque', 'planicies', 'minas', 'pantano', 'deserto', 'montanhas', 'tundra', 'costa', 'ruinas', 'fungica', 'fendas', 'veu'];
TREASURE_MAP_REGIONS.forEach((region, i) => add(`mapa-${region}`, `Mapa de Tesouro Antigo (${region})`, 'mapa', Math.min(6, 1 + Math.floor(i / 2)), 'mapa', '#d0b080', { weight: 0.05, use: { t: 'mapa', region } }));

export { ITEMS };
export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
export function getItem(id: string): ItemDef {
  const it = itemById.get(id);
  if (!it) throw new Error(`Item desconhecido: ${id}`);
  return it;
}
