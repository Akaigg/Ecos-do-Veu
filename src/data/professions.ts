export type ProfessionKind = 'coleta' | 'fabricacao';

export type ProfEffect =
  | 'rendimento' | 'conservacao' | 'raridade' | 'secundario' | 'eficiencia' | 'qualidade'
  | 'velocidade' | 'duracao' | 'potencia' | 'fartura';

export interface ProfessionBranch { id: string; name: string; desc: string; effect: ProfEffect; perRank: number; maxRank: number }

export interface ProfessionDef {
  id: string;
  name: string;
  kind: ProfessionKind;
  desc: string;
  icon: string;
  color: string;
  branches: [ProfessionBranch, ProfessionBranch, ProfessionBranch];
}

const b = (id: string, name: string, desc: string, effect: ProfEffect, perRank: number): ProfessionBranch =>
  ({ id, name, desc, effect, perRank, maxRank: 5 });

export const PROFESSIONS: ProfessionDef[] = [
  {
    id: 'mineracao', name: 'Mineração', kind: 'coleta', icon: 'picareta', color: '#8a8a92',
    desc: 'Minérios, gemas, sal e cristais.',
    branches: [
      b('rendimento', 'Rendimento', '+4% de produção por grau.', 'rendimento', 4),
      b('conservacao', 'Conservação da Picareta', '−6% de desgaste da ferramenta por grau.', 'conservacao', 6),
      b('gemas', 'Busca de Gemas', '+10% de chance de gemas e achados raros por grau.', 'raridade', 10),
    ],
  },
  {
    id: 'lenharia', name: 'Lenharia', kind: 'coleta', icon: 'machado', color: '#7a5030',
    desc: 'Madeira, resinas, cortiça e fibras de casca.',
    branches: [
      b('rendimento', 'Corte Eficiente', '+4% de produção por grau.', 'rendimento', 4),
      b('conservacao', 'Fio Preservado', '−6% de desgaste do machado por grau.', 'conservacao', 6),
      b('resinas', 'Seiva e Resinas', '+12% de materiais secundários por grau.', 'secundario', 12),
    ],
  },
  {
    id: 'herbalismo', name: 'Herbalismo', kind: 'coleta', icon: 'erva', color: '#5a9a4a',
    desc: 'Ervas, fungos e reagentes naturais.',
    branches: [
      b('rendimento', 'Mãos Verdes', '+4% de produção por grau.', 'rendimento', 4),
      b('conservacao', 'Colheita Cuidadosa', '−6% de desgaste da foice por grau.', 'conservacao', 6),
      b('raridades', 'Olho para Raridades', '+10% de chance de plantas raras por grau.', 'raridade', 10),
    ],
  },
  {
    id: 'pesca', name: 'Pesca', kind: 'coleta', icon: 'vara', color: '#3a7ab0',
    desc: 'Peixes, ingredientes e materiais aquáticos.',
    branches: [
      b('rendimento', 'Paciência', '+4% de produção por grau.', 'rendimento', 4),
      b('conservacao', 'Linha Resistente', '−6% de desgaste da vara por grau.', 'conservacao', 6),
      b('profundas', 'Águas Profundas', '+10% de chance de capturas raras por grau.', 'raridade', 10),
    ],
  },
  {
    id: 'caca', name: 'Caça e Curtume', kind: 'coleta', icon: 'faca', color: '#a05a3a',
    desc: 'Carnes, couros, ossos e componentes animais.',
    branches: [
      b('rendimento', 'Rastreador', '+4% de produção por grau.', 'rendimento', 4),
      b('esfola', 'Esfola Limpa', '+12% de couros e ossos extras por grau.', 'secundario', 12),
      b('trofeus', 'Troféus', '+10% de chance de partes raras por grau.', 'raridade', 10),
    ],
  },
  {
    id: 'ferraria', name: 'Ferraria', kind: 'fabricacao', icon: 'bigorna', color: '#6a6a7a',
    desc: 'Armas metálicas, placas e ferramentas.',
    branches: [
      b('eficiencia', 'Aproveitamento', '+5% de chance por grau de economizar materiais.', 'eficiencia', 5),
      b('qualidade', 'Têmpera', '+4% de chance de raridade superior por grau.', 'qualidade', 4),
      b('velocidade', 'Ritmo de Forja', '−8% de tempo de produção por grau.', 'velocidade', 8),
    ],
  },
  {
    id: 'alfaiataria', name: 'Alfaiataria', kind: 'fabricacao', icon: 'agulha', color: '#c08ab0',
    desc: 'Tecidos, roupas, armaduras leves, bolsas e forros.',
    branches: [
      b('eficiencia', 'Corte Econômico', '+5% de chance por grau de economizar materiais.', 'eficiencia', 5),
      b('qualidade', 'Costura Fina', '+4% de chance de raridade superior por grau.', 'qualidade', 4),
      b('velocidade', 'Agulha Ligeira', '−8% de tempo de produção por grau.', 'velocidade', 8),
    ],
  },
  {
    id: 'alquimia', name: 'Alquimia', kind: 'fabricacao', icon: 'pocao', color: '#60b060',
    desc: 'Poções, antídotos, óleos e solventes.',
    branches: [
      b('eficiencia', 'Eficiência de Produção', '+6% de chance por grau de produzir uma unidade extra.', 'fartura', 6),
      b('duracao', 'Duração', '+8% de duração dos efeitos por grau.', 'duracao', 8),
      b('potencia', 'Potência', '+5% de potência por grau.', 'potencia', 5),
    ],
  },
  {
    id: 'culinaria', name: 'Culinária', kind: 'fabricacao', icon: 'panela', color: '#d08a40',
    desc: 'Refeições, bebidas e rações de expedição.',
    branches: [
      b('fartura', 'Fartura', '+8% de chance por grau de uma porção extra.', 'fartura', 8),
      b('sabor', 'Sabor Marcante', '+10% de duração de refeições por grau.', 'duracao', 10),
      b('nutricao', 'Nutrição', '+5% de potência de refeições por grau.', 'potencia', 5),
    ],
  },
  {
    id: 'engenharia', name: 'Engenharia Rúnica', kind: 'fabricacao', icon: 'engrenagem', color: '#b07a3a',
    desc: 'Dispositivos, encaixes, runas, armas de projétil, focos e aprimoramentos técnicos.',
    branches: [
      b('precisao', 'Precisão', '+4% de chance de raridade superior por grau.', 'qualidade', 4),
      b('eficiencia', 'Reaproveitamento', '+5% de chance por grau de economizar materiais.', 'eficiencia', 5),
      b('velocidade', 'Montagem Rápida', '−8% de tempo de produção por grau.', 'velocidade', 8),
    ],
  },
];

export const professionById = new Map(PROFESSIONS.map((p) => [p.id, p]));
export const MASTER_SLOTS = 2;
export const PROFESSION_MAX_LEVEL = 100;
export const NON_MASTER_CAP = 50;
/** Um ponto de especialização a cada 10 níveis. */
export const profPointsForLevel = (level: number) => Math.floor(level / 10);
export const profXpForLevel = (level: number) => Math.floor(40 * Math.pow(level, 1.55) + 60);
/** Custo em ouro para trocar uma especialidade de mestre (humanos pagam metade). */
export const MASTER_SWAP_COST = 500;
