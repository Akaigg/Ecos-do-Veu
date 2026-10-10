import type { Element, MonsterAbility, MonsterRole } from '../types.ts';
import { dmg, st } from '../classes/helpers.ts';

/**
 * Famílias agrupam comportamento base, saques e etiquetas. Cada criatura escolhe
 * uma família e pode sobrescrever o que quiser.
 */
export interface FamilyDef {
  id: string;
  label: string;
  tags: string[];
  tameable: boolean;
  /** Afinidade do pet em missões (se domável). */
  petAffinity?: string;
  abilities: MonsterAbility[];
  drops: [string, number][];
}

const A = (id: string, name: string, telegraph: string, o: Partial<MonsterAbility> & Pick<MonsterAbility, 'effects' | 'target'>): MonsterAbility =>
  ({ id, name, telegraph, range: 'corpo', weight: 1, ...o });

export const basic = (name = 'Ataque', elem: Element = 'fisico', range: 'corpo' | 'distancia' = 'corpo'): MonsterAbility =>
  A('basico', name, '{n} se prepara para atacar {a}.', { target: 'ameaca', range, effects: [dmg(0, {}, elem, { atk: 1 })], weight: 3 });

export const FAMILIES: Record<string, FamilyDef> = {
  canino: {
    id: 'canino', label: 'Canino', tags: ['fera'], tameable: true, petAffinity: 'caca',
    abilities: [
      basic('Mordida'),
      A('rasgar', 'Rasgar', '{n} mostra os dentes para {a}.', { target: 'menor_vida', effects: [dmg(0, {}, 'fisico', { atk: 0.8 }), st('sangramento', 3, { potency: 0, scale: {} , })], weight: 1 }),
      A('uivo', 'Uivo', '{n} ergue o focinho para uivar.', { target: 'aliados', range: 'distancia', effects: [st('fortalecido', 2, { potency: 15 })], weight: 1, cooldown: 4 }),
    ],
    drops: [['couro-cru', 0.6], ['presa', 0.25], ['carne-caca', 0.5], ['garra', 0.2]],
  },
  quadrupede: {
    id: 'quadrupede', label: 'Fera de grande porte', tags: ['fera'], tameable: true, petAffinity: 'transporte',
    abilities: [
      basic('Chifrada'),
      A('investida', 'Investida', '{n} raspa o chão. Na próxima rodada, investirá contra toda a linha de frente.', { target: 'linha_frente', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fisico', { atk: 1.4 }), st('atordoado', 1, { chance: 0.25 })], weight: 1, cooldown: 3 }),
      A('pisotear', 'Pisotear', '{n} se ergue sobre as patas traseiras diante de {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1.2 })], weight: 1 }),
    ],
    drops: [['couro-grosso', 0.6], ['carne-caca', 0.6], ['osso', 0.4], ['presa', 0.15]],
  },
  aracnideo: {
    id: 'aracnideo', label: 'Aracnídeo', tags: ['fera', 'peconhento'], tameable: true, petAffinity: 'seda',
    abilities: [
      basic('Picada'),
      A('picada-venenosa', 'Picada Venenosa', '{n} curva o ferrão na direção de {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'veneno', { atk: 0.7 }), st('veneno', 3, { potency: 0 })], weight: 2 }),
      A('teia', 'Teia', '{n} prepara um jato de teia contra {a}.', { target: 'retaguarda', range: 'distancia', effects: [st('enraizado', 2), st('lento', 2)], weight: 1, cooldown: 3 }),
    ],
    drops: [['seda-aranha', 0.6], ['glandula-veneno', 0.3], ['quitina', 0.3]],
  },
  inseto: {
    id: 'inseto', label: 'Inseto', tags: ['fera', 'voador'], tameable: true, petAffinity: 'ervas',
    abilities: [
      basic('Ferroada'),
      A('enxame', 'Enxame', '{n} zumbe alto, chamando o enxame sobre a linha de frente.', { target: 'linha_frente', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 0.6 })], weight: 1, cooldown: 2 }),
      A('ferrao-paralisante', 'Ferrão Paralisante', '{n} mira {a} com o ferrão.', { target: 'aleatorio', effects: [dmg(0, {}, 'veneno', { atk: 0.8 }), st('lento', 2)], weight: 1 }),
    ],
    drops: [['quitina', 0.4], ['glandula-veneno', 0.25]],
  },
  serpente: {
    id: 'serpente', label: 'Serpente', tags: ['fera', 'reptil'], tameable: true, petAffinity: 'faro',
    abilities: [
      basic('Bote'),
      A('presas-venenosas', 'Presas Venenosas', '{n} se enrola, pronta para dar o bote em {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'veneno', { atk: 0.9 }), st('veneno', 3, { potency: 0 })], weight: 2 }),
      A('constricao', 'Constrição', '{n} desliza na direção de {a}.', { target: 'menor_vida', effects: [dmg(0, {}, 'fisico', { atk: 0.6 }), st('enraizado', 2)], weight: 1, cooldown: 3 }),
    ],
    drops: [['escama', 0.5], ['glandula-veneno', 0.3], ['couro-cru', 0.3]],
  },
  planta: {
    id: 'planta', label: 'Planta', tags: ['planta'], tameable: false,
    abilities: [
      basic('Chicote de Vinha'),
      A('esporos-sonolentos', 'Esporos Sonolentos', '{n} infla bolsas de esporos.', { target: 'linha_frente', range: 'distancia', effects: [st('lento', 2), dmg(0, {}, 'veneno', { atk: 0.4 })], weight: 1, cooldown: 3 }),
      A('raizes', 'Raízes Agarradoras', '{n} afunda as raízes sob {a}.', { target: 'retaguarda', range: 'distancia', effects: [st('enraizado', 2), dmg(0, {}, 'natureza', { atk: 0.6 })], weight: 1 }),
    ],
    drops: [['fibra-casca', 0.5], ['erva-raiz-amarga', 0.4], ['resina', 0.3]],
  },
  humanoide: {
    id: 'humanoide', label: 'Humanoide', tags: ['humanoide'], tameable: false,
    abilities: [
      basic('Golpe'),
      A('arremesso', 'Arremesso', '{n} gira uma arma de arremesso mirando {a}.', { target: 'retaguarda', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 0.9 })], weight: 1 }),
      A('grito-tribal', 'Grito Tribal', '{n} bate no peito e grita.', { target: 'aliados', range: 'distancia', effects: [st('fortalecido', 2, { potency: 15 })], weight: 1, cooldown: 4 }),
    ],
    drops: [['engrenagem-velha', 0.2], ['couro-cru', 0.3], ['lingote-cobre', 0.15]],
  },
  ave: {
    id: 'ave', label: 'Ave', tags: ['fera', 'voador'], tameable: true, petAffinity: 'batedor',
    abilities: [
      basic('Bicada'),
      A('rasante', 'Rasante', '{n} circula alto, mirando a retaguarda.', { target: 'retaguarda', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 1.1 })], weight: 2 }),
      A('grasnido', 'Grasnido', '{n} abre o bico para um grito estridente.', { target: 'linha_frente', range: 'distancia', effects: [st('cegueira', 1, { potency: 20 })], weight: 1, cooldown: 3 }),
    ],
    drops: [['pena', 0.8], ['garra', 0.3], ['carne-caca', 0.3]],
  },
  slime: {
    id: 'slime', label: 'Gosma', tags: ['amorfo'], tameable: true, petAffinity: 'coleta',
    abilities: [
      basic('Pseudópode', 'veneno'),
      A('acido', 'Jato Ácido', '{n} borbulha e se contrai na direção de {a}.', { target: 'ameaca', range: 'distancia', effects: [dmg(0, {}, 'veneno', { atk: 0.8 }), st('vulneravel', 2, { potency: 15 })], weight: 1 }),
      A('absorver', 'Absorver', '{n} se espalha pelo chão.', { target: 'si', effects: [{ k: 'cura', power: 0, pctMax: 0.12 }], weight: 1, cooldown: 3, hpBelow: 0.6 }),
    ],
    drops: [['gosma', 0.8]],
  },
  carapaca: {
    id: 'carapaca', label: 'Criatura de carapaça', tags: ['fera'], tameable: true, petAffinity: 'coleta',
    abilities: [
      basic('Pinça'),
      A('recolher', 'Recolher na Carapaça', '{n} começa a se fechar na carapaça.', { target: 'si', effects: [st('fortificado', 2, { potency: 40 })], weight: 1, cooldown: 3 }),
      A('esmagar', 'Esmagar', '{n} abre as pinças diante de {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1.3 })], weight: 1 }),
    ],
    drops: [['quitina', 0.6], ['carne-caca', 0.3]],
  },
  roedor: {
    id: 'roedor', label: 'Roedor', tags: ['fera'], tameable: true, petAffinity: 'coleta',
    abilities: [
      basic('Roer'),
      A('mordida-infecta', 'Mordida Infecta', '{n} chia para {a}.', { target: 'menor_vida', effects: [dmg(0, {}, 'fisico', { atk: 0.7 }), st('veneno', 2, { potency: 0 })], weight: 1 }),
    ],
    drops: [['couro-cru', 0.4], ['garra', 0.3]],
  },
  morto_vivo: {
    id: 'morto_vivo', label: 'Morto-vivo', tags: ['morto-vivo', 'veu'], tameable: false,
    abilities: [
      basic('Golpe Podre'),
      A('mordida-pestilenta', 'Mordida Pestilenta', '{n} arrasta-se na direção de {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'sombra', { atk: 0.8 }), st('decadencia', 3, { potency: 0 })], weight: 1 }),
      A('lamento', 'Lamento', '{n} solta um lamento oco.', { target: 'linha_frente', range: 'distancia', effects: [st('enfraquecido', 2, { potency: 15 })], weight: 1, cooldown: 3 }),
    ],
    drops: [['osso', 0.6], ['essencia-sombria', 0.12]],
  },
  constructo: {
    id: 'constructo', label: 'Constructo', tags: ['constructo'], tameable: false,
    abilities: [
      basic('Esmagar'),
      A('pancada-sismica', 'Pancada Sísmica', '{n} ergue os punhos. Na próxima rodada, atingirá toda a linha de frente.', { target: 'linha_frente', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fisico', { atk: 1.5, breaks: false })], weight: 1, cooldown: 3 }),
      A('postura', 'Postura Blindada', '{n} trava as juntas.', { target: 'si', effects: [st('fortificado', 2, { potency: 35 })], weight: 1, cooldown: 4 }),
    ],
    drops: [['engrenagem-velha', 0.5], ['lingote-ferro', 0.15]],
  },
  elemental: {
    id: 'elemental', label: 'Elemental', tags: ['elemental', 'veu'], tameable: false,
    abilities: [
      basic('Golpe Elemental'),
      A('explosao', 'Explosão Elemental', '{n} brilha intensamente. Na próxima rodada, explodirá sobre todos.', { target: 'todos', range: 'distancia', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fogo', { atk: 0.9 })], weight: 1, cooldown: 4 }),
      A('rajada', 'Rajada', '{n} concentra energia em {a}.', { target: 'aleatorio', range: 'distancia', effects: [dmg(0, {}, 'fogo', { atk: 1.0 })], weight: 1 }),
    ],
    drops: [['nucleo-elemental', 0.4]],
  },
  espectro: {
    id: 'espectro', label: 'Espectro', tags: ['espirito', 'veu', 'morto-vivo'], tameable: false,
    abilities: [
      basic('Toque Gélido', 'sombra'),
      A('atravessar', 'Atravessar', '{n} perde a forma e avança através da linha de frente até {a}.', { target: 'retaguarda', effects: [dmg(0, {}, 'sombra', { atk: 1.0, pierce: 0.5 })], weight: 2 }),
      A('grito-fantasma', 'Grito Fantasmagórico', '{n} abre uma boca impossível.', { target: 'todos', range: 'distancia', effects: [st('enfraquecido', 2, { potency: 15 })], weight: 1, cooldown: 4 }),
    ],
    drops: [['essencia-sombria', 0.4]],
  },
  fungo: {
    id: 'fungo', label: 'Fungo', tags: ['planta', 'fungo'], tameable: false,
    abilities: [
      basic('Pancada Esponjosa'),
      A('nuvem-esporos', 'Nuvem de Esporos', '{n} se contrai, cheio de esporos.', { target: 'todos', range: 'distancia', effects: [st('veneno', 3, { potency: 0 }), dmg(0, {}, 'veneno', { atk: 0.4 })], weight: 1, cooldown: 3 }),
    ],
    drops: [['esporo', 0.6], ['cogumelo-brilho', 0.3]],
  },
  aberracao: {
    id: 'aberracao', label: 'Aberração', tags: ['aberracao', 'veu'], tameable: false,
    abilities: [
      basic('Golpe Distorcido', 'arcano'),
      A('raio-ocular', 'Raio Ocular', '{n} fixa o olhar em {a}.', { target: 'conjurador', range: 'distancia', effects: [dmg(0, {}, 'arcano', { atk: 1.2 })], weight: 2 }),
      A('drenar', 'Drenar Mente', '{n} estende filamentos na direção de {a}.', { target: 'aleatorio', range: 'distancia', effects: [dmg(0, {}, 'arcano', { atk: 0.6, lifesteal: 0.5 }), { k: 'recurso', amount: -15 }], weight: 1 }),
    ],
    drops: [['olho-arcano', 0.2], ['essencia-sombria', 0.3]],
  },
  reptil: {
    id: 'reptil', label: 'Réptil', tags: ['fera', 'reptil'], tameable: true, petAffinity: 'faro',
    abilities: [
      basic('Mordida'),
      A('cauda', 'Golpe de Cauda', '{n} gira o corpo. A cauda varrerá a linha de frente.', { target: 'linha_frente', effects: [dmg(0, {}, 'fisico', { atk: 0.9 })], weight: 1, cooldown: 2 }),
      A('sopro', 'Sopro', '{n} enche os pulmões, mirando {a}.', { target: 'aleatorio', range: 'distancia', effects: [dmg(0, {}, 'fogo', { atk: 1.0 })], weight: 1 }),
    ],
    drops: [['escama', 0.6], ['couro-escamoso', 0.2], ['carne-caca', 0.3]],
  },
  aquatico: {
    id: 'aquatico', label: 'Criatura aquática', tags: ['aquatico'], tameable: true, petAffinity: 'pesca',
    abilities: [
      basic('Tentáculo'),
      A('jato-agua', 'Jato d\'Água', '{n} infla, mirando {a}.', { target: 'aleatorio', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 0.8 }), st('molhado', 3)], weight: 2 }),
      A('arrastar', 'Arrastar', '{n} estica-se na direção de {a}.', { target: 'retaguarda', effects: [dmg(0, {}, 'fisico', { atk: 0.6 }), { k: 'mover', to: 'frente' }], weight: 1, cooldown: 3 }),
    ],
    drops: [['escama-mare', 0.2], ['peixe-rio', 0.3], ['escama', 0.3]],
  },
  gigante: {
    id: 'gigante', label: 'Gigante', tags: ['gigante', 'humanoide'], tameable: false,
    abilities: [
      basic('Pancada'),
      A('pancada-dupla', 'Pancada Dupla', '{n} ergue a clava. Na próxima rodada, atingirá toda a linha de frente.', { target: 'linha_frente', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fisico', { atk: 1.6 }), st('atordoado', 1, { chance: 0.3 })], weight: 1, cooldown: 3 }),
      A('rugido', 'Rugido', '{n} ruge.', { target: 'todos', range: 'distancia', effects: [st('enfraquecido', 2, { potency: 15 })], weight: 1, cooldown: 4 }),
    ],
    drops: [['osso-grande', 0.4], ['couro-grosso', 0.4]],
  },
  verme: {
    id: 'verme', label: 'Verme', tags: ['fera'], tameable: false,
    abilities: [
      basic('Mordida Circular'),
      A('escavar', 'Escavar', '{n} afunda no solo. Surgirá sob a retaguarda na próxima rodada.', { target: 'linha_tras', charge: 1, interruptible: false, effects: [dmg(0, {}, 'fisico', { atk: 1.3 })], weight: 1, cooldown: 3 }),
      A('engolir', 'Engolir', '{n} abre a boca diante de {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 1.0 }), st('atordoado', 1, { chance: 0.25 })], weight: 1 }),
    ],
    drops: [['couro-grosso', 0.3], ['osso', 0.4]],
  },
  diabrete: {
    id: 'diabrete', label: 'Diabrete', tags: ['veu', 'demonio'], tameable: false,
    abilities: [
      basic('Garras', 'fogo'),
      A('bola-fogo', 'Bola de Fogo', '{n} sopra uma chama na palma, mirando {a}.', { target: 'conjurador', range: 'distancia', effects: [dmg(0, {}, 'fogo', { atk: 1.1 }), st('queimadura', 2, { potency: 0 })], weight: 2 }),
      A('teleporte', 'Teleporte', '{n} pisca e some.', { target: 'si', effects: [st('evasivo', 2, { potency: 30 }), { k: 'mover', to: 'tras' }], weight: 1, cooldown: 4 }),
    ],
    drops: [['nucleo-elemental', 0.3], ['essencia-sombria', 0.2]],
  },
};

export const ROLE_STATS: Record<MonsterRole, { hp: number; atk: number; armor: number; line: 'frente' | 'tras' }> = {
  bruto: { hp: 1.25, atk: 1.15, armor: 1.0, line: 'frente' },
  agil: { hp: 0.85, atk: 1.05, armor: 0.6, line: 'frente' },
  conjurador: { hp: 0.8, atk: 1.15, armor: 0.5, line: 'tras' },
  tanque: { hp: 1.5, atk: 0.85, armor: 1.6, line: 'frente' },
  enxame: { hp: 0.65, atk: 0.8, armor: 0.4, line: 'frente' },
  suporte: { hp: 0.9, atk: 0.8, armor: 0.7, line: 'tras' },
  cacador: { hp: 0.9, atk: 1.1, armor: 0.7, line: 'tras' },
};
