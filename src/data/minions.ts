import type { Effect, MinionDef, MonsterAbility } from './types.ts';
import { dmg, st } from './classes/helpers.ts';

const A = (id: string, name: string, telegraph: string, o: Partial<MonsterAbility> & Pick<MonsterAbility, 'effects' | 'target'>): MonsterAbility =>
  ({ id, name, telegraph, range: 'corpo', weight: 1, ...o });

/**
 * Lacaios de jogadores: agem logo depois do dono, sem turno próprio.
 * hpPct/atkPct são relativos à vida máxima e ao "ataque" do dono.
 */
export const PLAYER_MINIONS: MinionDef[] = [
  { id: 'lobo-companheiro', name: 'Lobo Companheiro', shape: 'lobo', colors: ['#8a7a6a', '#5a4a3a'], hpPct: 0.45, atkPct: 0.45, line: 'frente', abilities: [A('mordida', 'Mordida', '', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1 })] })] },
  { id: 'fera-ancestral', name: 'Fera Ancestral', shape: 'urso', colors: ['#6a8a4a', '#c0e080'], hpPct: 0.6, atkPct: 0.7, line: 'frente', abilities: [A('patada', 'Patada Ancestral', '', { target: 'ameaca', effects: [dmg(0, {}, 'natureza', { atk: 1 })] })] },
  { id: 'esqueleto', name: 'Esqueleto', shape: 'esqueleto', colors: ['#e8e0c8', '#6a4a9a'], hpPct: 0.35, atkPct: 0.4, line: 'frente', abilities: [A('golpe', 'Golpe Ósseo', '', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1 })] })] },
  { id: 'esqueleto-guerreiro', name: 'Guerreiro Esquelético', shape: 'esqueleto', colors: ['#f0e8d0', '#a070d0'], hpPct: 0.4, atkPct: 0.6, line: 'frente', abilities: [A('golpe', 'Golpe de Espada', '', { target: 'ameaca', effects: [dmg(0, {}, 'sombra', { atk: 1 })] })] },
  { id: 'abominacao', name: 'Abominação', shape: 'zumbi', colors: ['#7a8a6a', '#a04060'], hpPct: 0.9, atkPct: 0.5, line: 'frente', taunts: true, armorPct: 1.2, abilities: [A('pancada', 'Pancada', '', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1 }), st('lento', 1, { chance: 0.3 })] })] },
  { id: 'espirito-guardiao', name: 'Espírito Guardião', shape: 'espectro', colors: ['#f0e8a0', '#ffffff'], hpPct: 0.3, atkPct: 0.35, line: 'tras', abilities: [A('bencao', 'Bênção', '', { target: 'aliado_ferido', range: 'distancia', effects: [{ k: 'cura', power: 0, pctMax: 0.06, scale: {} }] })] },
  { id: 'torreta', name: 'Torreta de Campo', shape: 'torreta', colors: ['#b07a3a', '#5a5a62'], hpPct: 0.35, atkPct: 0.5, line: 'tras', armorPct: 1.3, abilities: [A('disparo', 'Disparo', '', { target: 'ameaca', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 1 })] })] },
  { id: 'drone', name: 'Drone Reparador', shape: 'drone', colors: ['#c0c0c8', '#60e0f0'], hpPct: 0.25, atkPct: 0.3, line: 'tras', abilities: [A('reparar', 'Reparar', '', { target: 'aliado_ferido', range: 'distancia', effects: [{ k: 'cura', power: 0, pctMax: 0.07, scale: {} }] })] },
  { id: 'baluarte', name: 'Baluarte Mecânico', shape: 'torreta', colors: ['#8a6a3a', '#c0c0c8'], hpPct: 1.0, atkPct: 0.3, line: 'frente', taunts: true, armorPct: 2, abilities: [A('proteger', 'Proteger', '', { target: 'aliados', range: 'distancia', effects: [{ k: 'escudo', power: 0, scale: {}, dur: 1 }] })] },
];

/** Etiqueta de comportamento de objetos inimigos (partes de chefes, caldeirões, sigilos…). */
export interface EnemyObjectDef extends MinionDef {
  role: 'placa' | 'protetor' | 'campo' | 'casulo' | 'sigilo' | 'cabeca' | 'comporta' | 'tentaculo' | 'espelho';
  /** Ordem de vulnerabilidade (placas, sigilos). */
  order?: number;
  /** Efeitos aplicados ao fim de cada rodada enquanto o objeto existir. */
  aura?: { on: 'jogadores' | 'chefe' | 'linha_frente_jogadores'; effects: Effect[] };
  /** Redução de dano do chefe enquanto o objeto existir (somada, até 80%). */
  protects?: number;
  /** Variação em medidores do chefe por rodada enquanto existir. */
  meterPerRound?: [string, number];
  onDeath?: { meter?: [string, number]; regrow?: number; text?: string };
  /** Dispara uma habilidade depois de N rodadas e desaparece. */
  fuse?: { rounds: number; ability: MonsterAbility };
  /** Desativa uma habilidade do chefe enquanto o objeto existir (placas do dragão). */
  enables?: string;
}

export const ENEMY_OBJECTS: EnemyObjectDef[] = [
  // Colosso da Mina Oca
  { id: 'placa-esquerda', name: 'Placa Esquerda', shape: 'placa', colors: ['#8a8a92', '#5a5a62'], hpPct: 0.12, atkPct: 0, line: 'frente', abilities: [], role: 'placa', order: 1, armorPct: 1.5 },
  { id: 'placa-direita', name: 'Placa Direita', shape: 'placa', colors: ['#8a8a92', '#5a5a62'], hpPct: 0.12, atkPct: 0, line: 'frente', abilities: [], role: 'placa', order: 2, armorPct: 1.5 },
  { id: 'placa-nucleo', name: 'Placa do Núcleo', shape: 'placa', colors: ['#c0a060', '#7a6a3a'], hpPct: 0.15, atkPct: 0, line: 'frente', abilities: [], role: 'placa', order: 3, armorPct: 1.5 },
  // Matriarca das Teias
  { id: 'casulo', name: 'Casulo', shape: 'casulo', colors: ['#f0f0f0', '#c0c0c0'], hpPct: 0.08, atkPct: 0, line: 'frente', abilities: [], role: 'casulo',
    fuse: { rounds: 3, ability: A('eclodir', 'Eclodir', 'O casulo pulsa: filhotes estão prestes a nascer.', { target: 'si', effects: [{ k: 'invocar', minion: 'aranha-musgo', max: 4, count: 2 }] }) } },
  // Bruxa do Brejo
  { id: 'caldeirao-venenoso', name: 'Caldeirão Venenoso', shape: 'caldeirao', colors: ['#3a3a3a', '#80e040'], hpPct: 0.1, atkPct: 0, line: 'tras', abilities: [], role: 'campo', aura: { on: 'jogadores', effects: [st('veneno', 2, { potency: 0 })] } },
  { id: 'caldeirao-nevoa', name: 'Caldeirão de Névoa', shape: 'caldeirao', colors: ['#3a3a3a', '#c0c0e0'], hpPct: 0.1, atkPct: 0, line: 'tras', abilities: [], role: 'campo', aura: { on: 'jogadores', effects: [st('cegueira', 1, { potency: 25 })] } },
  { id: 'caldeirao-fortificante', name: 'Caldeirão Fortificante', shape: 'caldeirao', colors: ['#3a3a3a', '#f0a040'], hpPct: 0.1, atkPct: 0, line: 'tras', abilities: [], role: 'campo', aura: { on: 'chefe', effects: [{ k: 'cura', power: 0, pctMax: 0.03 }, st('fortalecido', 1, { potency: 20 })] } },
  // Hidra das Sete Fomes
  { id: 'cabeca-venenosa', name: 'Cabeça Venenosa', shape: 'serpente', colors: ['#3a8a3a', '#c0f040'], hpPct: 0.14, atkPct: 0.6, line: 'frente', role: 'cabeca', protects: 15, onDeath: { regrow: 2, text: 'O pescoço se contorce — se não for cauterizado, voltará a crescer.' },
    abilities: [A('mordida-venenosa', 'Mordida Venenosa', '{n} mira {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'veneno', { atk: 1 }), st('veneno', 2, { potency: 0 })] })] },
  { id: 'cabeca-ignea', name: 'Cabeça Ígnea', shape: 'serpente', colors: ['#c04020', '#f0c040'], hpPct: 0.14, atkPct: 0.6, line: 'frente', role: 'cabeca', protects: 15, onDeath: { regrow: 2 },
    abilities: [A('sopro-fogo', 'Sopro de Fogo', '{n} acumula chamas, mirando a linha de frente.', { target: 'linha_frente', range: 'distancia', effects: [dmg(0, {}, 'fogo', { atk: 0.8 })] })] },
  { id: 'cabeca-gelida', name: 'Cabeça Gélida', shape: 'serpente', colors: ['#3a7ab0', '#c0f0ff'], hpPct: 0.14, atkPct: 0.6, line: 'frente', role: 'cabeca', protects: 15, onDeath: { regrow: 2 },
    abilities: [A('mordida-gelida', 'Mordida Gélida', '{n} mira {a}.', { target: 'aleatorio', effects: [dmg(0, {}, 'gelo', { atk: 1 }), st('resfriado', 3, { stacks: 1 })] })] },
  // Faraó de Vidro
  { id: 'espelho', name: 'Espelho Faraônico', shape: 'espelho', colors: ['#f0f0c0', '#c0a040'], hpPct: 0.1, atkPct: 0, line: 'tras', abilities: [], role: 'espelho', aura: { on: 'chefe', effects: [st('refletir', 1, { potency: 25 })] } },
  // Almirante Afogado
  { id: 'comporta', name: 'Comporta Aberta', shape: 'comporta', colors: ['#5a4a3a', '#3a8ab0'], hpPct: 0.1, atkPct: 0, line: 'tras', abilities: [], role: 'comporta', meterPerRound: ['inundacao', 12], onDeath: { meter: ['inundacao', -20], text: 'A comporta se fecha com um estrondo. A água recua.' } },
  // Kraken das Correntes
  { id: 'tentaculo-agarrador', name: 'Tentáculo Agarrador', shape: 'tentaculo', colors: ['#8a3a6a', '#f0a0c0'], hpPct: 0.12, atkPct: 0.5, line: 'frente', role: 'tentaculo', onDeath: { regrow: 4 },
    abilities: [A('agarrar', 'Agarrar', '{n} se enrola ao redor de {a}.', { target: 'retaguarda', effects: [st('atordoado', 1), { k: 'mover', to: 'frente' }], cooldown: 2 }), A('chicote', 'Chicote', '{n} chicoteia {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1 })] })] },
  { id: 'tentaculo-esmagador', name: 'Tentáculo Esmagador', shape: 'tentaculo', colors: ['#6a2a4a', '#c06080'], hpPct: 0.14, atkPct: 0.9, line: 'frente', role: 'tentaculo', onDeath: { regrow: 4 },
    abilities: [A('esmagar', 'Esmagar', '{n} se ergue sobre a linha de frente. Na próxima rodada, cairá com tudo.', { target: 'linha_frente', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fisico', { atk: 1.6 })], cooldown: 2 })] },
  { id: 'tentaculo-protetor', name: 'Tentáculo Protetor', shape: 'tentaculo', colors: ['#3a5a8a', '#80c0f0'], hpPct: 0.12, atkPct: 0.3, line: 'frente', role: 'protetor', protects: 40, onDeath: { regrow: 5, text: 'O kraken fica exposto!' },
    abilities: [A('guardar', 'Guardar', '{n} se enrola diante do kraken.', { target: 'si', effects: [st('fortificado', 1, { potency: 30 })] })] },
  // Arquivista Proibido
  { id: 'sigilo-1', name: 'Sigilo I', shape: 'sigilo', colors: ['#c0a070', '#f0e0a0'], hpPct: 0.05, atkPct: 0, line: 'tras', abilities: [], role: 'sigilo', order: 1,
    fuse: { rounds: 3, ability: A('sigilo-explosao', 'Explosão do Sigilo', 'O Sigilo I brilha — explodirá na próxima rodada se não for interrompido.', { target: 'todos', range: 'distancia', effects: [dmg(0, {}, 'arcano', { atk: 1.2 }), st('silenciado', 1)] }) } },
  { id: 'sigilo-2', name: 'Sigilo II', shape: 'sigilo', colors: ['#c070a0', '#f0a0e0'], hpPct: 0.05, atkPct: 0, line: 'tras', abilities: [], role: 'sigilo', order: 2,
    fuse: { rounds: 4, ability: A('sigilo-explosao', 'Explosão do Sigilo', 'O Sigilo II brilha.', { target: 'todos', range: 'distancia', effects: [dmg(0, {}, 'arcano', { atk: 1.4 }), st('enfraquecido', 2, { potency: 25 })] }) } },
  { id: 'sigilo-3', name: 'Sigilo III', shape: 'sigilo', colors: ['#7070c0', '#a0a0f0'], hpPct: 0.05, atkPct: 0, line: 'tras', abilities: [], role: 'sigilo', order: 3,
    fuse: { rounds: 5, ability: A('sigilo-explosao', 'Explosão do Sigilo', 'O Sigilo III brilha.', { target: 'todos', range: 'distancia', effects: [dmg(0, {}, 'arcano', { atk: 1.8 })] }) } },
  // Dragão de Obsidiana
  { id: 'placa-peito', name: 'Placa do Peito', shape: 'placa', colors: ['#3a2a4a', '#a070d0'], hpPct: 0.1, atkPct: 0, line: 'frente', abilities: [], role: 'protetor', protects: 40, armorPct: 2 },
  { id: 'placa-asas', name: 'Placa das Asas', shape: 'placa', colors: ['#3a2a4a', '#f06020'], hpPct: 0.08, atkPct: 0, line: 'tras', abilities: [], role: 'placa', armorPct: 2, enables: 'voo' },
  { id: 'placa-cauda', name: 'Placa da Cauda', shape: 'placa', colors: ['#3a2a4a', '#f0c040'], hpPct: 0.08, atkPct: 0, line: 'frente', abilities: [], role: 'placa', armorPct: 2, enables: 'varrida' },
];

export const minionById = new Map<string, MinionDef>(PLAYER_MINIONS.map((m) => [m.id, m]));
export const enemyObjectById = new Map(ENEMY_OBJECTS.map((o) => [o.id, o]));

/** Campos de batalha (efeitos globais aplicados por fases e chefes). */
export interface FieldDef { id: string; name: string; desc: string; players?: Effect[]; boss?: Effect[]; frontPlayers?: Effect[]; backPlayers?: Effect[] }
export const FIELDS: FieldDef[] = [
  { id: 'tempestade-areia', name: 'Tempestade de Areia', desc: 'Jogadores perdem precisão; o chefe fica difícil de acertar (Marcar o alvo anula).', players: [st('cegueira', 1, { potency: 30 })], boss: [st('evasivo', 1, { potency: 30 })] },
  { id: 'avalanche', name: 'Avalanche', desc: 'Pedras caem sobre a linha de frente a cada rodada.', frontPlayers: [dmg(0, {}, 'fisico', { atk: 0.4 })] },
  { id: 'gelo-fino', name: 'Gelo Fino', desc: 'Todos ficam lentos.', players: [st('lento', 1)] },
  { id: 'penhasco', name: 'Beira do Penhasco', desc: 'Ventos castigam a retaguarda.', backPlayers: [dmg(0, {}, 'fisico', { atk: 0.4 })] },
  { id: 'distorcao', name: 'Distorção', desc: 'O Véu troca as linhas dos jogadores a cada rodada.', players: [] },
  { id: 'nevoa-bruxa', name: 'Névoa da Bruxa', desc: 'Névoa venenosa cobre o brejo.', players: [st('veneno', 1, { potency: 0 })] },
  { id: 'fornalha', name: 'Calor da Fornalha', desc: 'O calor queima todos os jogadores.', players: [st('queimadura', 1, { potency: 0 })] },
  { id: 'aurora', name: 'Aurora', desc: 'A luz da aurora alterna o tipo de dano absorvido.', players: [] },
  { id: 'colapso', name: 'Colapso do Véu', desc: 'A realidade desaba sobre todos.', players: [dmg(0, {}, 'arcano', { atk: 0.3 })] },
];
export const fieldById = new Map(FIELDS.map((f) => [f.id, f]));
