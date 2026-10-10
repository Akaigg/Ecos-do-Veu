import { RUNE_TYPES, RUNE_GRADES } from './items.ts';

/** Receita simples: materiais → produtos empilháveis. Equipamentos e ferramentas usam composição (ver game/crafting). */
export interface RecipeDef {
  id: string;
  name: string;
  profession: string;
  level: number;
  /** Minutos por unidade produzida. */
  minutes: number;
  inputs: [string, number][];
  output: [string, number];
  /** Receitas que precisam ser aprendidas (chefe, reputação, descoberta). */
  unlock?: string;
  category: string;
}

const RECIPES: RecipeDef[] = [];
const r = (id: string, profession: string, level: number, minutes: number, inputs: [string, number][], output: [string, number], category: string, name?: string, unlock?: string) =>
  RECIPES.push({ id, profession, level, minutes, inputs, output, category, name: name ?? '', unlock });

// ---------------------------------------------------------------- Ferraria: fundição
r('lingote-cobre', 'ferraria', 1, 3, [['minerio-cobre', 2], ['carvao', 1]], ['lingote-cobre', 1], 'Fundição');
r('lingote-bronze', 'ferraria', 1, 4, [['minerio-cobre', 1], ['minerio-estanho', 1], ['carvao', 1]], ['lingote-bronze', 1], 'Fundição');
r('lingote-ferro', 'ferraria', 12, 5, [['minerio-ferro', 2], ['carvao', 1]], ['lingote-ferro', 1], 'Fundição');
r('lingote-aco', 'ferraria', 25, 6, [['lingote-ferro', 1], ['carvao', 2]], ['lingote-aco', 1], 'Fundição');
r('lingote-prata', 'ferraria', 28, 6, [['minerio-prata', 2], ['carvao', 1]], ['lingote-prata', 1], 'Fundição');
r('lingote-aco-negro', 'ferraria', 42, 8, [['minerio-ferro-negro', 2], ['carvao', 2]], ['lingote-aco-negro', 1], 'Fundição');
r('lingote-argenteo', 'ferraria', 58, 10, [['minerio-argenteo', 2], ['carvao', 1], ['obsidiana', 1]], ['lingote-argenteo', 1], 'Fundição');
r('liga-veu', 'ferraria', 72, 12, [['lingote-argenteo', 1], ['cristal-veu', 1], ['poeira-veu', 1]], ['liga-veu', 1], 'Fundição');

// ---------------------------------------------------------------- Caça e Curtume: curtimento
r('couro-curtido', 'caca', 1, 4, [['couro-cru', 2], ['sal-rocha', 1]], ['couro-curtido', 1], 'Curtume');
r('couro-reforcado', 'caca', 12, 5, [['couro-grosso', 2], ['resina', 1]], ['couro-reforcado', 1], 'Curtume');
r('couro-escama', 'caca', 25, 6, [['couro-escamoso', 2], ['escama', 2]], ['couro-escama', 1], 'Curtume');
r('couro-glacial', 'caca', 38, 8, [['pele-glacial', 2], ['sal-rocha', 1]], ['couro-glacial', 1], 'Curtume');
r('couro-sombrio-curtido', 'caca', 52, 10, [['couro-sombrio', 2], ['essencia-sombria', 1]], ['couro-sombrio-curtido', 1], 'Curtume');
r('couro-velado', 'caca', 66, 12, [['couro-veu', 2], ['poeira-veu', 1]], ['couro-velado', 1], 'Curtume');

// ---------------------------------------------------------------- Alfaiataria: tecelagem
r('tecido-linho', 'alfaiataria', 1, 3, [['linho', 3]], ['tecido-linho', 1], 'Tecelagem');
r('tecido-la', 'alfaiataria', 15, 4, [['la-crua', 3]], ['tecido-la', 1], 'Tecelagem');
r('tecido-la-algodao', 'alfaiataria', 15, 4, [['algodao-cinzento', 3], ['la-crua', 1]], ['tecido-la', 1], 'Tecelagem', 'Tecido de Lã (algodão)');
r('seda', 'alfaiataria', 30, 6, [['seda-aranha', 4]], ['seda', 1], 'Tecelagem');
r('seda-lunar', 'alfaiataria', 45, 8, [['seda', 2], ['musgo-lunar', 1]], ['seda-lunar', 1], 'Tecelagem');
r('tecido-cinzas', 'alfaiataria', 60, 10, [['seda', 2], ['flor-cinza', 1], ['brasa-viva', 1]], ['tecido-cinzas', 1], 'Tecelagem');
r('tecido-veu', 'alfaiataria', 75, 12, [['seda-lunar', 2], ['petala-veu', 1], ['poeira-veu', 1]], ['tecido-veu', 1], 'Tecelagem');

// ---------------------------------------------------------------- Alquimia
r('pocao-vida-menor', 'alquimia', 1, 3, [['erva-folha-prata', 2], ['agua', 1]], ['pocao-vida-menor', 1], 'Poções');
r('pocao-recurso-menor', 'alquimia', 1, 3, [['erva-raiz-amarga', 2], ['agua', 1]], ['pocao-recurso-menor', 1], 'Poções');
r('antidoto', 'alquimia', 5, 3, [['erva-folha-prata', 1], ['erva-raiz-amarga', 1], ['agua', 1]], ['antidoto', 1], 'Poções');
r('cera-selagem', 'alquimia', 1, 2, [['resina', 2]], ['cera-selagem', 1], 'Reagentes');
r('tinta-arcana', 'alquimia', 8, 3, [['cogumelo-brilho', 1], ['carvao', 1], ['gosma', 1]], ['tinta-arcana', 2], 'Reagentes');
r('solvente', 'alquimia', 10, 3, [['gosma', 1], ['erva-raiz-amarga', 1]], ['solvente', 1], 'Reagentes');
r('oleo-inflamavel', 'alquimia', 10, 4, [['resina', 1], ['carvao', 1]], ['oleo-inflamavel', 1], 'Óleos');
r('oleo-peconhento', 'alquimia', 12, 4, [['glandula-veneno', 2]], ['oleo-peconhento', 1], 'Óleos');
r('pocao-vida-comum', 'alquimia', 15, 4, [['flor-sangue', 2], ['agua', 1]], ['pocao-vida-comum', 1], 'Poções');
r('pocao-recurso-comum', 'alquimia', 15, 4, [['cogumelo-brilho', 2], ['agua', 1]], ['pocao-recurso-comum', 1], 'Poções');
r('pocao-visao', 'alquimia', 18, 4, [['cogumelo-brilho', 2], ['quartzo', 1]], ['pocao-visao', 1], 'Poções');
r('oleo-gelido', 'alquimia', 20, 5, [['nucleo-elemental', 1], ['agua', 1]], ['oleo-gelido', 1], 'Óleos');
r('pocao-res-veneno', 'alquimia', 22, 5, [['lirio-pantano', 2], ['agua', 1]], ['pocao-res-veneno', 1], 'Resistências');
r('oleo-sagrado', 'alquimia', 25, 5, [['erva-folha-prata', 2], ['ambar', 1]], ['oleo-sagrado', 1], 'Óleos');
r('oleo-condutor', 'alquimia', 25, 5, [['escama', 1], ['cortica', 1]], ['oleo-condutor', 1], 'Óleos');
r('pocao-regeneracao', 'alquimia', 30, 6, [['lirio-pantano', 2], ['musgo-lunar', 1]], ['pocao-regeneracao', 1], 'Poções');
r('pocao-res-fogo', 'alquimia', 30, 5, [['cacto-vidro', 2], ['agua', 1]], ['pocao-res-fogo', 1], 'Resistências');
r('pocao-res-gelo', 'alquimia', 30, 5, [['flor-sangue', 1], ['nucleo-elemental', 1], ['agua', 1]], ['pocao-res-gelo', 1], 'Resistências');
r('pocao-res-raio', 'alquimia', 38, 5, [['cortica', 1], ['alga-mare', 1], ['agua', 1]], ['pocao-res-raio', 1], 'Resistências');
r('pocao-res-sombra', 'alquimia', 40, 6, [['musgo-lunar', 1], ['essencia-sombria', 1], ['agua', 1]], ['pocao-res-sombra', 1], 'Resistências');
r('pocao-vida-maior', 'alquimia', 45, 6, [['flor-gelo', 2], ['alga-mare', 1], ['agua', 1]], ['pocao-vida-maior', 1], 'Poções');
r('pocao-recurso-maior', 'alquimia', 45, 6, [['musgo-lunar', 2], ['alga-mare', 1], ['agua', 1]], ['pocao-recurso-maior', 1], 'Poções');
r('pocao-vida-superior', 'alquimia', 75, 8, [['petala-veu', 2], ['fungo-miceliar', 1], ['agua', 1]], ['pocao-vida-superior', 1], 'Poções');
r('pocao-recurso-superior', 'alquimia', 75, 8, [['fungo-miceliar', 2], ['petala-veu', 1], ['agua', 1]], ['pocao-recurso-superior', 1], 'Poções');
r('elixir-brejo', 'alquimia', 30, 8, [['essencia-brejo', 1], ['lirio-pantano', 2], ['agua', 1]], ['pocao-regeneracao', 3], 'Fórmulas especiais', 'Elixir do Brejo', 'chefe:bruxa-brejo');

// ---------------------------------------------------------------- Culinária
r('racao', 'culinaria', 1, 2, [['carne-caca', 1], ['erva-folha-prata', 1]], ['racao', 3], 'Suprimentos', 'Rações de Expedição');
r('racao-peixe', 'culinaria', 1, 2, [['peixe-rio', 1], ['farinha', 1]], ['racao', 3], 'Suprimentos', 'Rações de Peixe');
r('pao-viagem', 'culinaria', 1, 3, [['farinha', 2], ['agua', 1]], ['pao-viagem', 2], 'Refeições');
r('petisco', 'culinaria', 1, 2, [['carne-caca', 1]], ['petisco', 2], 'Pets');
r('isca-simples', 'culinaria', 3, 2, [['carne-caca', 1], ['gosma', 1]], ['isca-simples', 2], 'Pets');
r('racao-pet', 'culinaria', 5, 3, [['carne-caca', 1], ['peixe-rio', 1]], ['racao-pet', 4], 'Pets');
r('ensopado-cacador', 'culinaria', 12, 4, [['carne-caca', 2], ['erva-raiz-amarga', 1], ['agua', 1]], ['ensopado-cacador', 1], 'Refeições');
r('peixe-assado', 'culinaria', 15, 4, [['truta-prateada', 2], ['erva-folha-prata', 1]], ['peixe-assado', 1], 'Refeições');
r('cha-gelado', 'culinaria', 20, 4, [['cacto-vidro', 2], ['agua', 1]], ['cha-gelado', 1], 'Refeições');
r('sopa-quente', 'culinaria', 28, 5, [['carne-caca', 2], ['flor-sangue', 1], ['agua', 1]], ['sopa-quente', 1], 'Refeições');
r('isca-aromatica', 'culinaria', 28, 3, [['carne-caca', 1], ['flor-sangue', 1], ['lirio-pantano', 1]], ['isca-aromatica', 2], 'Pets');
r('torta-ervas', 'culinaria', 30, 5, [['farinha', 2], ['musgo-lunar', 2]], ['torta-ervas', 1], 'Refeições');
r('banquete-minerador', 'culinaria', 30, 6, [['carne-caca', 3], ['farinha', 1], ['sal-rocha', 1]], ['banquete-minerador', 1], 'Refeições');
r('isca-veu', 'culinaria', 60, 4, [['carne-caca', 1], ['poeira-veu', 2]], ['isca-veu', 2], 'Pets');
r('banquete-heroico', 'culinaria', 60, 8, [['peixe-lanterna', 2], ['carne-caca', 2], ['farinha', 2]], ['banquete-heroico', 1], 'Refeições');

// ---------------------------------------------------------------- Engenharia Rúnica
r('celula-energia', 'engenharia', 1, 3, [['lingote-cobre', 1], ['quartzo', 1]], ['celula-energia', 3], 'Dispositivos');
const RUNE_REAGENT: Record<string, string> = {
  protecao: 'lingote-ferro', vida: 'flor-sangue', foco: 'cogumelo-brilho', furia: 'presa', mobilidade: 'pena',
  precisao: 'garra', graca: 'erva-folha-prata', 'res-fogo': 'nucleo-elemental', 'res-gelo': 'pele-glacial',
  'res-raio': 'cortica', 'res-veneno': 'glandula-veneno', 'res-sombra': 'essencia-sombria', 'res-arcano': 'olho-arcano',
};
const GRADE_GEM = ['', 'quartzo', 'rubi', 'onix-velado'];
const GRADE_LEVEL = [0, 5, 30, 60];
for (const key of Object.keys(RUNE_TYPES)) {
  for (const [grade] of RUNE_GRADES) {
    r(`runa-${key}-${grade}`, 'engenharia', GRADE_LEVEL[grade], 5 + grade * 5,
      [['tinta-arcana', grade], [GRADE_GEM[grade], 1], [RUNE_REAGENT[key], grade]], [`runa-${key}-${grade}`, 1], 'Runas');
  }
}

export { RECIPES };
export const recipeById = new Map(RECIPES.map((x) => [x.id, x]));

/** Tempo (min) para fabricar equipamento por faixa. */
export const EQUIP_CRAFT_MINUTES = (tier: number) => 20 + tier * 15;
export const TOOL_CRAFT_MINUTES = (tier: number) => 15 + tier * 10;
export const QUEUE_BASE_SLOTS = 2;
