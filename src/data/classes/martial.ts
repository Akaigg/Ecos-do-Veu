import type { ClassDef } from '../types.ts';
import { dmg, heal, mod, passive, shield, skill, st, tree } from './helpers.ts';

// =====================================================================
// GUERREIRO — combate físico e proteção. Recurso: Fúria.
// =====================================================================
export const GUERREIRO: ClassDef = {
  id: 'guerreiro', name: 'Guerreiro', role: 'Combate físico e proteção', color: '#b8433a',
  desc: 'Mestre da linha de frente: protege aliados, quebra defesas e transforma dor em fúria.',
  resource: { id: 'furia', name: 'Fúria', max: 100, start: 20, regen: 0, onBasic: 12, onHurt: 6, onDefend: 10, onKill: 10 },
  armorTraining: 'pesada', suggested: { forca: 3, vigor: 2, destreza: 1 },
  weapons: ['espada', 'machado', 'maca', 'lanca', 'martelo', 'espadao', 'escudo'],
  fundamento: skill('provocacao', 'Provocação', 'Força os inimigos da linha de frente a atacar você por 2 rodadas.', {
    cost: 10, cd: 3, target: 'nenhum', icon: 'bandeira', anyLine: true,
    effects: [{ k: 'provocar', dur: 2, on: 'inimigos' }, { k: 'ameaca', amount: 50 }, st('fortificado', 1, { potency: 10, on: 'si' })],
  }),
  innate: passive('treino-combate', 'Treino de Combate', '+6% de vida máxima e +5% de armadura.', [
    { t: 'stat', stat: 'vida', value: 6 }, { t: 'stat', stat: 'armadura', value: 5 },
  ], 'escudo'),
  trees: [
    tree({
      id: 'bastiao', name: 'Bastião', desc: 'Escudos, interceptações e proteção de grupo.',
      a1: skill('golpe-escudo', 'Golpe de Escudo', 'Causa dano e reduz a capacidade ofensiva do alvo (Enfraquecido).', {
        cost: 15, cd: 2, target: 'inimigo', icon: 'escudo',
        effects: [dmg(8, { forca: 0.8, vigor: 0.3 }, 'fisico', { weapon: 0.5, breaks: true }), st('enfraquecido', 2, { potency: 20 })],
      }),
      f1: [
        mod('escudo-opressor', 'Escudo Opressor', 'golpe-escudo', 'Interrompe a ação preparada do alvo e o enfraquecimento dura +1 rodada.', {
          icon: 'escudo', add: [{ k: 'interromper' }], patch: [{ index: 1, set: { dur: 3 } }], cooldownDelta: 1,
        }),
        mod('escudo-protetor', 'Escudo Protetor', 'golpe-escudo', 'Também concede um escudo ao aliado mais ferido.', {
          icon: 'escudo', add: [shield(10, { vigor: 0.8 }, 2, { on: 'aliado_ferido' })],
        }),
      ],
      a2: skill('interceptar', 'Interceptar', 'Recebe 50% dos ataques direcionados a um aliado por 2 rodadas.', {
        cost: 20, cd: 3, target: 'aliado', icon: 'mao', anyLine: true,
        effects: [{ k: 'interceptar', ratio: 0.5, dur: 2 }, st('fortificado', 1, { potency: 15, on: 'si' })],
      }),
      f2: [
        mod('guarda-movel', 'Guarda Móvel', 'interceptar', 'Você se move para a linha do aliado e intercepta 65%.', {
          icon: 'passo', patch: [{ index: 0, set: { ratio: 0.65 } }], add: [{ k: 'mover', to: 'frente', on: 'si' }],
        }),
        mod('guarda-firme', 'Guarda Firme', 'interceptar', 'Fortificação dura 3 rodadas e gera ameaça extra.', {
          icon: 'escudo', patch: [{ index: 1, set: { dur: 3, potency: 20 } }], add: [{ k: 'ameaca', amount: 40 }],
        }),
      ],
      p: passive('inabalavel', 'Inabalável', 'Defender ou bloquear acumula Determinação (até 5): cada acúmulo reduz o dano recebido em 4% e aumenta o dano em 4%.', [
        { t: 'ao_defender', status: 'determinacao', stacks: 1, max: 5, potency: 4 },
      ], 'escudo'),
      a3: skill('muralha', 'Muralha', 'Aliados na sua linha ficam Fortificados e recebem um escudo.', {
        cost: 35, cd: 4, target: 'nenhum', icon: 'torre', anyLine: true,
        effects: [st('fortificado', 2, { potency: 20, on: 'linha_si' }), shield(12, { vigor: 0.6 }, 2, { on: 'linha_si' })],
      }),
      m3: mod('muralha-viva', 'Muralha Viva', 'muralha', 'Também provoca a linha de frente inimiga por 1 rodada.', {
        icon: 'bandeira', add: [{ k: 'provocar', dur: 1, on: 'inimigos' }],
      }),
      c: skill('ultimo-bastiao', 'Último Bastião', 'Por 2 rodadas, nenhum aliado cai abaixo de 1 de vida, e você fica Fortificado.', {
        cost: 60, cd: 8, target: 'nenhum', icon: 'coroa', anyLine: true,
        effects: [st('indestrutivel', 2, { on: 'aliados' }), st('fortificado', 2, { potency: 30, on: 'si' }), { k: 'ameaca', amount: 80 }],
      }),
    }),
    tree({
      id: 'berserker', name: 'Berserker', desc: 'Agressão crescente, risco calculado e golpes devastadores.',
      a1: skill('investida', 'Investida', 'Avança para a linha de frente e golpeia; 25% de chance de atordoar.', {
        cost: 0, cd: 3, target: 'inimigo', icon: 'passo', anyLine: true,
        effects: [{ k: 'mover', to: 'frente', on: 'si' }, dmg(10, { forca: 1.0 }, 'fisico', { weapon: 0.8 }), st('atordoado', 1, { chance: 0.25 }), { k: 'recurso', amount: 10, on: 'si' }],
      }),
      f1: [
        mod('investida-brutal', 'Investida Brutal', 'investida', '+20% de dano e 50% de chance de atordoar.', {
          icon: 'punho', powerMult: 1.2, patch: [{ index: 2, set: { chance: 0.5 } }],
        }),
        mod('investida-rasante', 'Investida Rasante', 'investida', 'Atinge toda a linha do alvo com 60% do poder.', {
          icon: 'vento', powerMult: 0.6, target: 'linha_inimiga',
        }),
      ],
      a2: skill('golpe-selvagem', 'Golpe Selvagem', 'Golpe pesado; +50% de dano se você estiver abaixo de 50% de vida.', {
        cost: 30, cd: 2, target: 'inimigo', icon: 'machado',
        effects: [dmg(18, { forca: 1.4 }, 'fisico', { weapon: 1.0, breaks: true })],
      }),
      f2: [
        mod('sede-sangue', 'Sede de Sangue', 'golpe-selvagem', 'Recupera vida igual a 25% do dano causado.', {
          icon: 'sangue', patch: [{ index: 0, set: { lifesteal: 0.25 } }],
        }),
        mod('golpe-rachador', 'Golpe Rachador', 'golpe-selvagem', 'Deixa o alvo Vulnerável por 2 rodadas.', {
          icon: 'machado', add: [st('vulneravel', 2, { potency: 20 })],
        }),
      ],
      p: passive('sangue-quente', 'Sangue Quente', 'Causa até +30% de dano conforme sua vida diminui.', [
        { t: 'dano_vida_perdida', maxPct: 30 },
      ], 'sangue'),
      a3: skill('redemoinho', 'Redemoinho', 'Gira a arma contra toda a linha de frente inimiga, causando Sangramento.', {
        cost: 40, cd: 3, target: 'linha_inimiga', icon: 'vento',
        effects: [dmg(12, { forca: 1.0 }, 'fisico', { weapon: 0.6 }), st('sangramento', 2, { potency: 4, scale: { forca: 0.3 } })],
      }),
      m3: mod('redemoinho-implacavel', 'Redemoinho Implacável', 'redemoinho', 'Atinge todos os inimigos, com 80% do poder.', {
        icon: 'vento', target: 'todos_inimigos', powerMult: 0.8,
      }),
      c: skill('furia-imortal', 'Fúria Imortal', 'Por 3 rodadas, você não cai abaixo de 1 de vida e causa +30% de dano.', {
        cost: 70, cd: 9, target: 'si', icon: 'coroa',
        effects: [st('indestrutivel', 3), st('fortalecido', 3, { potency: 30 }), heal(0, {}, { pctMax: 0.1 })],
      }),
    }),
    tree({
      id: 'mestre-armas', name: 'Mestre de Armas', desc: 'Precisão, técnica e respostas a cada abertura.',
      a1: skill('golpe-preciso', 'Golpe Preciso', 'Ataque técnico que ignora 30% da armadura.', {
        cost: 15, cd: 1, target: 'inimigo', icon: 'espada',
        effects: [dmg(10, { forca: 0.6, destreza: 0.6 }, 'fisico', { weapon: 1.0, pierce: 0.3 })],
      }),
      f1: [
        mod('corte-tendinoso', 'Corte Tendinoso', 'golpe-preciso', 'Deixa o alvo Lento por 2 rodadas.', { icon: 'passo', add: [st('lento', 2)] }),
        mod('estocada-perfurante', 'Estocada Perfurante', 'golpe-preciso', 'Ignora 60% da armadura.', { icon: 'espada', patch: [{ index: 0, set: { pierce: 0.6 } }] }),
      ],
      a2: skill('contra-ataque', 'Contra-ataque', 'Assume postura: ao ser atacado corpo a corpo, responde com um golpe.', {
        cost: 20, cd: 3, target: 'si', icon: 'espada',
        effects: [st('contra_ataque', 2, { potency: 10, scale: { forca: 0.8, destreza: 0.4 } })],
      }),
      f2: [
        mod('aparar', 'Aparar', 'contra-ataque', 'Também reduz em 30% o dano recebido enquanto a postura durar.', {
          icon: 'escudo', add: [st('fortificado', 2, { potency: 30 })],
        }),
        mod('riposta', 'Riposta', 'contra-ataque', 'A resposta deixa o atacante Vulnerável.', {
          icon: 'espada', patch: [{ index: 0, set: { potency: 14 } }], add: [{ k: 'ameaca', amount: 20 }],
        }),
      ],
      p: passive('disciplina-marcial', 'Disciplina Marcial', '+8% de chance crítica; críticos geram 5 de Fúria.', [
        { t: 'stat', stat: 'critico', value: 8 }, { t: 'ao_causar_dano', recurso: 5, critOnly: true },
      ], 'alvo'),
      a3: skill('desarmar', 'Desarmar', 'Golpe que interrompe e reduz o dano do alvo em 40% por 2 rodadas.', {
        cost: 30, cd: 4, target: 'inimigo', icon: 'mao',
        effects: [dmg(8, { forca: 0.8 }, 'fisico', { weapon: 0.5 }), { k: 'interromper' }, st('enfraquecido', 2, { potency: 40 })],
      }),
      m3: mod('desarmar-tomar', 'Desarmar e Tomar', 'desarmar', 'Você fica Fortalecido (+20% de dano) por 2 rodadas.', {
        icon: 'punho', add: [st('fortalecido', 2, { potency: 20, on: 'si' })],
      }),
      c: skill('tempestade-aco', 'Tempestade de Aço', 'Desfere 4 golpes em inimigos aleatórios.', {
        cost: 60, cd: 7, target: 'todos_inimigos', icon: 'espada',
        effects: [dmg(9, { forca: 0.5, destreza: 0.5 }, 'fisico', { weapon: 0.6, hits: 4, on: 'aleatorio' })],
      }),
    }),
  ],
};

// =====================================================================
// LADINO — mobilidade e oportunismo. Recurso: Energia.
// =====================================================================
export const LADINO: ClassDef = {
  id: 'ladino', name: 'Ladino', role: 'Mobilidade e oportunismo', color: '#5a5a7a',
  desc: 'Aparece onde não é esperado: venenos, fintas, sabotagem e finalizações.',
  resource: { id: 'energia', name: 'Energia', max: 100, start: 100, regen: 20, onBasic: 5 },
  armorTraining: 'leve', suggested: { destreza: 3, percepcao: 2, vigor: 1 },
  weapons: ['adaga', 'espada', 'besta', 'arco'],
  fundamento: skill('golpe-baixo', 'Golpe Baixo', 'Golpe rápido com 30% de chance de atordoar.', {
    cost: 25, cd: 2, target: 'inimigo', icon: 'adaga',
    effects: [dmg(6, { destreza: 0.8 }, 'fisico', { weapon: 0.7 }), st('atordoado', 1, { chance: 0.3 })],
  }),
  innate: passive('oportunista', 'Oportunista', '+15% de dano contra alvos Lentos, Atordoados ou Cegos.', [
    { t: 'dano_vs_status', status: 'lento', pct: 15 }, { t: 'dano_vs_status', status: 'atordoado', pct: 15 },
    { t: 'dano_vs_status', status: 'cegueira', pct: 15 },
  ], 'mascara'),
  trees: [
    tree({
      id: 'assassino', name: 'Assassino', desc: 'Furtividade, venenos e execuções.',
      a1: skill('apunhalar', 'Apunhalar', 'Golpe preciso com +20% de chance crítica; dano dobrado se você estiver Oculto.', {
        cost: 30, cd: 0, target: 'inimigo', icon: 'adaga',
        effects: [dmg(9, { destreza: 1.1 }, 'fisico', { weapon: 1.0 })],
        tags: ['furtivo'],
      }),
      f1: [
        mod('lamina-envenenada', 'Lâmina Envenenada', 'apunhalar', 'Envenena o alvo por 3 rodadas.', {
          icon: 'gota', add: [st('veneno', 3, { potency: 3, scale: { destreza: 0.25 }, elem: 'veneno' })],
        }),
        mod('golpe-furtivo', 'Golpe Furtivo', 'apunhalar', '+25% de dano.', { icon: 'mascara', powerMult: 1.25 }),
      ],
      a2: skill('sumir-sombras', 'Sumir nas Sombras', 'Fica Oculto por 2 rodadas (não pode ser alvo direto) e recua para a retaguarda.', {
        cost: 35, cd: 4, target: 'si', icon: 'lua', anyLine: true,
        effects: [st('oculto', 2), { k: 'mover', to: 'tras' }],
      }),
      f2: [
        mod('sombra-persistente', 'Sombra Persistente', 'sumir-sombras', 'Oculto dura 3 rodadas.', { icon: 'lua', patch: [{ index: 0, set: { dur: 3 } }] }),
        mod('fuga-agil', 'Fuga Ágil', 'sumir-sombras', 'Recupera 40 de energia.', { icon: 'passo', add: [{ k: 'recurso', amount: 40 }] }),
      ],
      p: passive('instinto-letal', 'Instinto Letal', '+25% de dano crítico.', [{ t: 'stat', stat: 'dano_critico', value: 25 }], 'caveira'),
      a3: skill('marca-morte', 'Marca da Morte', 'Marca o alvo: ele recebe +20% de dano por 3 rodadas.', {
        cost: 25, cd: 4, target: 'inimigo', icon: 'alvo', range: 'distancia',
        effects: [st('marcado', 3, { potency: 20 })],
      }),
      m3: mod('marca-contagiosa', 'Marca Contagiosa', 'marca-morte', 'A marca dura 5 rodadas e devolve 20 de energia.', {
        icon: 'alvo', patch: [{ index: 0, set: { dur: 5 } }], add: [{ k: 'recurso', amount: 20, on: 'si' }],
      }),
      c: skill('execucao', 'Execução', 'Golpe devastador; dano dobrado contra alvos abaixo de 30% de vida.', {
        cost: 60, cd: 7, target: 'inimigo', icon: 'caveira',
        effects: [dmg(30, { destreza: 2.0 }, 'fisico', { weapon: 1.5, bonusVs: { hpBelow: 0.3, mult: 2 } })],
      }),
    }),
    tree({
      id: 'duelista', name: 'Duelista', desc: 'Esquiva, fintas e combate um contra um.',
      a1: skill('finta', 'Finta', 'Golpe enganoso que deixa você Evasivo (+30% de esquiva) por 1 rodada.', {
        cost: 20, cd: 1, target: 'inimigo', icon: 'espada',
        effects: [dmg(7, { destreza: 0.9 }, 'fisico', { weapon: 0.8 }), st('evasivo', 1, { potency: 30, on: 'si' })],
      }),
      f1: [
        mod('finta-dupla', 'Finta Dupla', 'finta', 'Golpeia duas vezes com 65% do poder.', { icon: 'espada', powerMult: 0.65, patch: [{ index: 0, set: { hits: 2 } }] }),
        mod('finta-desconcertante', 'Finta Desconcertante', 'finta', 'Cega o alvo por 1 rodada.', { icon: 'olho', add: [st('cegueira', 1, { potency: 30 })] }),
      ],
      a2: skill('laminas-gemeas', 'Lâminas Gêmeas', 'Dois cortes rápidos.', {
        cost: 35, cd: 2, target: 'inimigo', icon: 'adaga',
        effects: [dmg(8, { destreza: 0.8 }, 'fisico', { weapon: 0.7, hits: 2 })],
      }),
      f2: [
        mod('ritmo-cortante', 'Ritmo Cortante', 'laminas-gemeas', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 3, scale: { destreza: 0.2 } })] }),
        mod('golpe-abertura', 'Golpe de Abertura', 'laminas-gemeas', 'Deixa o alvo Vulnerável por 1 rodada.', { icon: 'alvo', add: [st('vulneravel', 1, { potency: 25 })] }),
      ],
      p: passive('pes-leves', 'Pés Leves', '+8% de esquiva; esquivar gera 10 de energia.', [
        { t: 'stat', stat: 'esquiva', value: 8 }, { t: 'ao_esquivar', recurso: 10 },
      ], 'passo'),
      a3: skill('desafio-duelista', 'Desafio do Duelista', 'Desafia um inimigo: ele é provocado, você recebe −30% de dano dele e causa +20%.', {
        cost: 30, cd: 5, target: 'inimigo', icon: 'bandeira',
        effects: [{ k: 'provocar', dur: 3 }, st('duelo', 3, { potency: 20 })],
      }),
      m3: mod('honra-afiada', 'Honra Afiada', 'desafio-duelista', 'Você também fica Evasivo por 2 rodadas.', { icon: 'passo', add: [st('evasivo', 2, { potency: 20, on: 'si' })] }),
      c: skill('danca-laminas', 'Dança das Lâminas', 'Cinco golpes no alvo; você fica Evasivo por 2 rodadas.', {
        cost: 65, cd: 7, target: 'inimigo', icon: 'estrela',
        effects: [dmg(7, { destreza: 0.7 }, 'fisico', { weapon: 0.6, hits: 5 }), st('evasivo', 2, { potency: 35, on: 'si' })],
      }),
    }),
    tree({
      id: 'sabotador', name: 'Sabotador', desc: 'Fumaça, armadilhas, óleo e caos controlado.',
      a1: skill('bomba-fumaca', 'Bomba de Fumaça', 'Cega a linha de frente inimiga por 2 rodadas (−30% de precisão).', {
        cost: 30, cd: 3, target: 'linha_inimiga', icon: 'nuvem', range: 'distancia',
        effects: [st('cegueira', 2, { potency: 30 })],
      }),
      f1: [
        mod('fumaca-toxica', 'Fumaça Tóxica', 'bomba-fumaca', 'Também envenena.', { icon: 'gota', add: [st('veneno', 2, { potency: 3, scale: { destreza: 0.2 }, elem: 'veneno' })] }),
        mod('fumaca-densa', 'Fumaça Densa', 'bomba-fumaca', 'Atinge todos os inimigos.', { icon: 'nuvem', target: 'todos_inimigos' }),
      ],
      a2: skill('armadilha-fios', 'Armadilha de Fios', 'Prende o alvo: Enraizado e Lento por 2 rodadas.', {
        cost: 25, cd: 3, target: 'inimigo', icon: 'teia', range: 'distancia',
        effects: [dmg(6, { destreza: 0.5, intelecto: 0.3 }), st('enraizado', 2), st('lento', 2)],
      }),
      f2: [
        mod('fios-cortantes', 'Fios Cortantes', 'armadilha-fios', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 3, scale: { destreza: 0.2 } })] }),
        mod('fios-aco', 'Fios de Aço', 'armadilha-fios', '40% de chance de atordoar.', { icon: 'teia', add: [st('atordoado', 1, { chance: 0.4 })] }),
      ],
      p: passive('engenhosidade', 'Engenhosidade', 'Efeitos negativos que você aplica duram +1 rodada.', [{ t: 'stat', stat: 'duracao_debuff', value: 1 }], 'engrenagem'),
      a3: skill('frasco-oleo', 'Frasco de Óleo', 'Encharca a linha do alvo de óleo (fogo causa +50% e incendeia).', {
        cost: 25, cd: 3, target: 'linha_inimiga', icon: 'gota', range: 'distancia',
        effects: [st('oleado', 3), dmg(4, { destreza: 0.3 })],
      }),
      m3: mod('pavio-curto', 'Pavio Curto', 'frasco-oleo', 'Acende o óleo imediatamente com dano de fogo.', {
        icon: 'fogo', add: [dmg(8, { destreza: 0.5, intelecto: 0.3 }, 'fogo')],
      }),
      c: skill('sabotagem-total', 'Sabotagem Total', 'Interrompe todas as ações preparadas e deixa todos os inimigos Vulneráveis.', {
        cost: 70, cd: 9, target: 'todos_inimigos', icon: 'bomba', range: 'distancia',
        effects: [{ k: 'interromper' }, st('vulneravel', 2, { potency: 20 })],
      }),
    }),
  ],
};

// =====================================================================
// PATRULHEIRO — distância e rastreamento. Recurso: Foco.
// =====================================================================
export const PATRULHEIRO: ClassDef = {
  id: 'patrulheiro', name: 'Patrulheiro', role: 'Ataques à distância e rastreamento', color: '#3f8a52',
  desc: 'Lê o terreno, marca a presa e derruba ameaças antes que cheguem perto.',
  resource: { id: 'foco', name: 'Foco', max: 100, start: 50, regen: 15, onBasic: 10 },
  armorTraining: 'media', suggested: { destreza: 3, percepcao: 2, vigor: 1 },
  weapons: ['arco', 'besta', 'lanca', 'adaga'],
  fundamento: skill('tiro-rapido', 'Tiro Rápido', 'Disparo ágil e barato.', {
    cost: 10, cd: 0, target: 'inimigo', icon: 'seta', range: 'distancia',
    effects: [dmg(8, { destreza: 0.9 }, 'fisico', { weapon: 0.9 })],
  }),
  innate: passive('olhos-cacador', 'Olhos de Caçador', '+10 de iniciativa e +5% de dano à distância.', [
    { t: 'stat', stat: 'iniciativa', value: 10 }, { t: 'stat', stat: 'dano_distancia', value: 5 },
  ], 'olho'),
  trees: [
    tree({
      id: 'atirador', name: 'Atirador', desc: 'Disparos poderosos e supressão.',
      a1: skill('tiro-mirado', 'Tiro Mirado', 'Disparo carregado com grande dano.', {
        cost: 25, cd: 2, target: 'inimigo', icon: 'alvo', range: 'distancia',
        effects: [dmg(14, { destreza: 1.3 }, 'fisico', { weapon: 1.2 })],
      }),
      f1: [
        mod('tiro-perfurante', 'Tiro Perfurante', 'tiro-mirado', 'Ignora 50% da armadura.', { icon: 'seta', patch: [{ index: 0, set: { pierce: 0.5 } }] }),
        mod('tiro-incapacitante', 'Tiro Incapacitante', 'tiro-mirado', 'Deixa o alvo Lento.', { icon: 'passo', add: [st('lento', 2)] }),
      ],
      a2: skill('saraivada', 'Saraivada', 'Chuva de flechas em todos os inimigos.', {
        cost: 35, cd: 3, target: 'todos_inimigos', icon: 'seta', range: 'distancia',
        effects: [dmg(7, { destreza: 0.6 }, 'fisico', { weapon: 0.5 })],
      }),
      f2: [
        mod('flechas-incendiarias', 'Flechas Incendiárias', 'saraivada', 'O dano vira fogo e causa Queimadura.', {
          icon: 'fogo', patch: [{ index: 0, set: { elem: 'fogo' } }], add: [st('queimadura', 2, { potency: 3, scale: { destreza: 0.15 }, elem: 'fogo' })],
        }),
        mod('chuva-concentrada', 'Chuva Concentrada', 'saraivada', 'Atinge só uma linha, com +40% de poder.', { icon: 'alvo', target: 'linha_inimiga', powerMult: 1.4 }),
      ],
      p: passive('postura-atirador', 'Postura de Atirador', 'Na retaguarda, +12% de dano à distância.', [{ t: 'retaguarda_distancia', pct: 12 }], 'arco'),
      a3: skill('tiro-supressao', 'Tiro de Supressão', 'Interrompe a ação preparada do alvo e o enfraquece.', {
        cost: 30, cd: 4, target: 'inimigo', icon: 'seta', range: 'distancia',
        effects: [dmg(8, { destreza: 0.7 }, 'fisico', { weapon: 0.6 }), { k: 'interromper' }, st('enfraquecido', 2, { potency: 20 })],
      }),
      m3: mod('supressao-continua', 'Supressão Contínua', 'tiro-supressao', 'Recarga reduzida em 1 rodada.', { icon: 'relogio', cooldownDelta: -1 }),
      c: skill('tiro-horizonte', 'Tiro do Horizonte', 'Disparo lendário que ignora metade da armadura.', {
        cost: 70, cd: 7, target: 'inimigo', icon: 'sol', range: 'distancia',
        effects: [dmg(40, { destreza: 2.4 }, 'fisico', { weapon: 2.0, pierce: 0.5 })],
      }),
    }),
    tree({
      id: 'cacador', name: 'Caçador', desc: 'Marcas, armadilhas e conhecimento da presa.',
      a1: skill('marcar-presa', 'Marcar Presa', 'Marca o alvo: todo o grupo causa +15% de dano nele.', {
        cost: 10, cd: 2, target: 'inimigo', icon: 'olho', range: 'distancia',
        effects: [st('marcado', 4, { potency: 15 })], tags: ['analisa'],
      }),
      f1: [
        mod('rastro-persistente', 'Rastro Persistente', 'marcar-presa', 'A marca dura 7 rodadas.', { icon: 'pata', patch: [{ index: 0, set: { dur: 7 } }] }),
        mod('presa-exposta', 'Presa Exposta', 'marcar-presa', 'A marca concede +25%.', { icon: 'alvo', patch: [{ index: 0, set: { potency: 25 } }] }),
      ],
      a2: skill('armadilha-mandibula', 'Armadilha de Mandíbula', 'Prende o alvo (Enraizado) e causa Sangramento.', {
        cost: 30, cd: 3, target: 'inimigo', icon: 'garra', range: 'distancia',
        effects: [dmg(10, { percepcao: 0.8 }), st('enraizado', 2), st('sangramento', 3, { potency: 3, scale: { percepcao: 0.2 } })],
      }),
      f2: [
        mod('mandibula-serrilhada', 'Mandíbula Serrilhada', 'armadilha-mandibula', 'Sangramento muito mais forte.', { icon: 'sangue', patch: [{ index: 2, set: { potency: 7 } }] }),
        mod('mola-reforcada', 'Mola Reforçada', 'armadilha-mandibula', 'Atordoa por 1 rodada.', { icon: 'engrenagem', add: [st('atordoado', 1, { chance: 0.6 })] }),
      ],
      p: passive('conhecer-presa', 'Conhecimento da Presa', '+15% de dano contra alvos Marcados.', [{ t: 'dano_vs_status', status: 'marcado', pct: 15 }], 'livro'),
      a3: skill('tiro-certeiro', 'Tiro na Fraqueza', 'Disparo que causa +50% de dano em alvos Marcados.', {
        cost: 30, cd: 2, target: 'inimigo', icon: 'alvo', range: 'distancia',
        effects: [dmg(18, { percepcao: 1.2, destreza: 0.6 }, 'fisico', { weapon: 1.0, bonusVs: { status: 'marcado', mult: 1.5 } })],
      }),
      m3: mod('golpe-misericordia', 'Golpe de Misericórdia', 'tiro-certeiro', 'Também +50% contra alvos abaixo de 35% de vida.', {
        icon: 'caveira', add: [dmg(6, { percepcao: 0.4 }, 'fisico', { bonusVs: { hpBelow: 0.35, mult: 3 } })],
      }),
      c: skill('cacada-implacavel', 'Caçada Implacável', 'Por 3 rodadas, você fica Fortalecido (+35%) e recupera 30 de foco.', {
        cost: 50, cd: 8, target: 'si', icon: 'pata',
        effects: [st('fortalecido', 3, { potency: 35 }), { k: 'recurso', amount: 30 }, st('marcado', 3, { potency: 15, on: 'inimigos' })],
      }),
    }),
    tree({
      id: 'companheiro-selvagem', name: 'Companheiro Selvagem', desc: 'Luta ao lado de uma fera — ou do seu pet domado.',
      a1: skill('chamar-companheiro', 'Chamar Companheiro', 'Invoca um lobo companheiro. Se houver um pet ativo, ele entra em combate no lugar.', {
        cost: 20, cd: 4, target: 'nenhum', icon: 'pata', anyLine: true,
        effects: [{ k: 'invocar', minion: 'lobo-companheiro', max: 1 }],
      }),
      f1: [
        mod('matilha', 'Matilha', 'chamar-companheiro', 'Até dois companheiros ao mesmo tempo.', { icon: 'pata', patch: [{ index: 0, set: { max: 2 } }] }),
        mod('fera-robusta', 'Fera Robusta', 'chamar-companheiro', 'O companheiro chega com um escudo.', { icon: 'escudo', add: [shield(10, { espirito: 0.5, percepcao: 0.5 }, 3, { on: 'aliados' })] }),
      ],
      a2: skill('ordem-atacar', 'Ordem: Atacar!', 'Seus companheiros atacam o alvo agora com o dobro de força; o alvo fica Vulnerável.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'garra', range: 'distancia',
        effects: [{ k: 'comandar', mult: 2 }, st('vulneravel', 1, { potency: 15 })],
      }),
      f2: [
        mod('mordida-dilacerante', 'Mordida Dilacerante', 'ordem-atacar', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 4, scale: { percepcao: 0.2 } })] }),
        mod('investida-fera', 'Investida da Fera', 'ordem-atacar', '30% de chance de atordoar.', { icon: 'passo', add: [st('atordoado', 1, { chance: 0.3 })] }),
      ],
      p: passive('vinculo-selvagem', 'Vínculo Selvagem', 'Lacaios e pets têm +25% de vida e dano.', [{ t: 'stat', stat: 'lacaios', value: 25 }], 'coracao'),
      a3: skill('proteger-mestre', 'Proteger o Mestre', 'Companheiros curam 30% e você fica Fortificado.', {
        cost: 25, cd: 4, target: 'si', icon: 'escudo', anyLine: true,
        effects: [st('fortificado', 2, { potency: 25 }), heal(0, {}, { pctMax: 0.3, on: 'aliados' })],
      }),
      m3: mod('uivo-guerra', 'Uivo de Guerra', 'proteger-mestre', 'Aliados ficam Fortalecidos (+10%) por 2 rodadas.', { icon: 'nota', add: [st('fortalecido', 2, { potency: 10, on: 'aliados' })] }),
      c: skill('furia-natureza', 'Fúria da Natureza', 'Invoca duas Feras Ancestrais por 3 rodadas.', {
        cost: 60, cd: 9, target: 'nenhum', icon: 'folha', anyLine: true,
        effects: [{ k: 'invocar', minion: 'fera-ancestral', max: 2, count: 2, temp: 3 }],
      }),
    }),
  ],
};

// =====================================================================
// MONGE — combos e disciplina corporal. Recurso: Chi (0–5).
// =====================================================================
export const MONGE: ClassDef = {
  id: 'monge', name: 'Monge', role: 'Combos e disciplina corporal', color: '#c9a227',
  desc: 'Encadeia golpes, redireciona força e transforma disciplina em resistência.',
  resource: { id: 'chi', name: 'Chi', max: 5, start: 1, regen: 1, onBasic: 1 },
  armorTraining: 'leve', suggested: { destreza: 3, espirito: 2, vigor: 1 },
  weapons: ['punhos', 'lanca', 'cajado'],
  fundamento: skill('palma-ressonante', 'Palma Ressonante', 'Golpe que gera 1 de Chi.', {
    cost: 0, cd: 1, target: 'inimigo', icon: 'mao',
    effects: [dmg(8, { destreza: 0.6, forca: 0.4 }, 'fisico', { weapon: 0.6 }), { k: 'recurso', amount: 1, on: 'si' }],
  }),
  innate: passive('corpo-disciplinado', 'Corpo Disciplinado', '+6% de esquiva, +8% de vida e +10 de resistência a controle.', [
    { t: 'stat', stat: 'esquiva', value: 6 }, { t: 'stat', stat: 'vida', value: 8 }, { t: 'stat', stat: 'resist_controle', value: 10 },
  ], 'punho'),
  trees: [
    tree({
      id: 'punho', name: 'Punho', desc: 'Sequências rápidas e golpes explosivos.',
      a1: skill('sequencia-golpes', 'Sequência de Golpes', 'Três golpes rápidos.', {
        cost: 1, cd: 0, target: 'inimigo', icon: 'punho',
        effects: [dmg(5, { destreza: 0.5, forca: 0.3 }, 'fisico', { weapon: 0.4, hits: 3 })],
      }),
      f1: [
        mod('punhos-ferro', 'Punhos de Ferro', 'sequencia-golpes', 'Deixa o alvo Vulnerável.', { icon: 'punho', add: [st('vulneravel', 1, { potency: 15 })] }),
        mod('golpe-final', 'Golpe Final', 'sequencia-golpes', 'Um quarto golpe.', { icon: 'estrela', patch: [{ index: 0, set: { hits: 4 } }] }),
      ],
      a2: skill('chute-giratorio', 'Chute Giratório', 'Atinge a linha de frente inimiga.', {
        cost: 2, cd: 2, target: 'linha_inimiga', icon: 'vento',
        effects: [dmg(10, { destreza: 0.8, forca: 0.6 }, 'fisico', { weapon: 0.5 })],
      }),
      f2: [
        mod('chute-deslocador', 'Chute Deslocador', 'chute-giratorio', 'Empurra os atingidos para a retaguarda.', { icon: 'passo', add: [{ k: 'mover', to: 'tras' }] }),
        mod('chute-atordoante', 'Chute Atordoante', 'chute-giratorio', '30% de chance de atordoar.', { icon: 'estrela', add: [st('atordoado', 1, { chance: 0.3 })] }),
      ],
      p: passive('fluxo-combate', 'Fluxo de Combate', 'Usar habilidades diferentes em sequência concede +6% de dano por elo (até 5).', [{ t: 'combo', pctPerLink: 6, max: 5 }], 'espiral'),
      a3: skill('palma-explosiva', 'Palma Explosiva', 'Golpe que planta energia: explode após 2 rodadas.', {
        cost: 2, cd: 3, target: 'inimigo', icon: 'bomba',
        effects: [dmg(16, { destreza: 1.2 }, 'fisico', { weapon: 0.6 }), st('detonacao', 2, { potency: 20, scale: { destreza: 1.0 }, elem: 'fisico' })],
      }),
      m3: mod('ressonancia', 'Ressonância', 'palma-explosiva', 'A explosão é mais forte.', { icon: 'espiral', patch: [{ index: 1, set: { potency: 32 } }] }),
      c: skill('cem-punhos', 'Cem Punhos', 'Oito golpes em sequência. Consome todo o Chi.', {
        cost: 5, cd: 6, target: 'inimigo', icon: 'estrela',
        effects: [dmg(4, { destreza: 0.5, forca: 0.3 }, 'fisico', { weapon: 0.35, hits: 8 })],
      }),
    }),
    tree({
      id: 'espirito', name: 'Espírito', desc: 'Meditação, ki e calma.',
      a1: skill('meditacao', 'Meditação', 'Cura a si mesmo, remove um efeito negativo e gera 2 de Chi.', {
        cost: 0, cd: 3, target: 'si', icon: 'lua', anyLine: true,
        effects: [heal(15, { espirito: 1.2 }), { k: 'purificar', count: 1 }, { k: 'recurso', amount: 2 }],
      }),
      f1: [
        mod('mente-clara', 'Mente Clara', 'meditacao', 'Imune a controle por 2 rodadas.', { icon: 'olho', add: [st('firmeza', 2)] }),
        mod('partilha', 'Partilha', 'meditacao', 'Também cura o aliado mais ferido.', { icon: 'coracao', add: [heal(8, { espirito: 0.6 }, { on: 'aliado_ferido' })] }),
      ],
      a2: skill('pulso-ki', 'Pulso de Ki', 'Projeta energia à distância.', {
        cost: 1, cd: 1, target: 'inimigo', icon: 'espiral', range: 'distancia',
        effects: [dmg(10, { espirito: 1.0 }, 'arcano')],
      }),
      f2: [
        mod('pulso-restaurador', 'Pulso Restaurador', 'pulso-ki', 'Cura o aliado mais ferido.', { icon: 'cruz', add: [heal(6, { espirito: 0.5 }, { on: 'aliado_ferido' })] }),
        mod('pulso-penetrante', 'Pulso Penetrante', 'pulso-ki', 'Ignora 50% da resistência.', { icon: 'seta', patch: [{ index: 0, set: { pierce: 0.5 } }] }),
      ],
      p: passive('serenidade', 'Serenidade', '+15% de cura recebida e regenera 2% da vida por rodada.', [
        { t: 'stat', stat: 'cura_recebida', value: 15 }, { t: 'stat', stat: 'regen_vida', value: 2 },
      ], 'lua'),
      a3: skill('palma-espiritual', 'Palma Espiritual', 'Interrompe e silencia o alvo por 1 rodada.', {
        cost: 2, cd: 4, target: 'inimigo', icon: 'mao',
        effects: [dmg(8, { espirito: 0.6, destreza: 0.4 }, 'arcano'), { k: 'interromper' }, st('silenciado', 1)],
      }),
      m3: mod('palma-pacificadora', 'Palma Pacificadora', 'palma-espiritual', 'Também enfraquece por 2 rodadas.', { icon: 'mao', add: [st('enfraquecido', 2, { potency: 25 })] }),
      c: skill('transcendencia', 'Transcendência', 'Por 3 rodadas: +50% de esquiva; cura 25% da vida.', {
        cost: 4, cd: 8, target: 'si', icon: 'sol', anyLine: true,
        effects: [st('evasivo', 3, { potency: 50 }), heal(0, {}, { pctMax: 0.25 }), st('firmeza', 3)],
      }),
    }),
    tree({
      id: 'fluxo', name: 'Fluxo', desc: 'Movimento, esquiva e redirecionamento.',
      a1: skill('passo-vento', 'Passo do Vento', 'Muda de linha, golpeia e fica Evasivo.', {
        cost: 1, cd: 1, target: 'inimigo', icon: 'vento', anyLine: true,
        effects: [{ k: 'mover', to: 'trocar', on: 'si' }, dmg(8, { destreza: 0.8 }, 'fisico', { weapon: 0.5 }), st('evasivo', 1, { potency: 25, on: 'si' })],
      }),
      f1: [
        mod('passo-duplo', 'Passo Duplo', 'passo-vento', 'Golpeia duas vezes.', { icon: 'passo', patch: [{ index: 1, set: { hits: 2 } }], powerMult: 0.7 }),
        mod('vento-cortante', 'Vento Cortante', 'passo-vento', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 2, { potency: 3, scale: { destreza: 0.2 } })] }),
      ],
      a2: skill('redirecionar', 'Redirecionar', 'O próximo ataque contra você é devolvido ao atacante.', {
        cost: 2, cd: 3, target: 'si', icon: 'espiral', anyLine: true,
        effects: [st('redirecionar', 2, { potency: 80 })],
      }),
      f2: [
        mod('redirecionar-grupo', 'Redirecionar Grupo', 'redirecionar', 'Também intercepta 30% dos ataques ao aliado mais ferido.', { icon: 'mao', add: [{ k: 'interceptar', ratio: 0.3, dur: 2, on: 'aliado_ferido' }] }),
        mod('fluxo-reverso', 'Fluxo Reverso', 'redirecionar', 'O dano devolvido é maior.', { icon: 'espiral', patch: [{ index: 0, set: { potency: 130 } }] }),
      ],
      p: passive('agua-corrente', 'Água Corrente', 'Esquivar gera 1 de Chi e concede +10% de dano por 1 rodada.', [
        { t: 'ao_esquivar', recurso: 1, status: 'fortalecido', potency: 10 },
      ], 'gota'),
      a3: skill('golpe-rio', 'Golpe do Rio', 'Golpe fluido; +50% se você estiver Evasivo.', {
        cost: 2, cd: 2, target: 'inimigo', icon: 'gota',
        effects: [dmg(14, { destreza: 1.2 }, 'fisico', { weapon: 0.7 })],
        tags: ['bonus_evasivo'],
      }),
      m3: mod('correnteza', 'Correnteza', 'golpe-rio', 'Deixa o alvo Lento.', { icon: 'passo', add: [st('lento', 2)] }),
      c: skill('tempestade-interior', 'Tempestade Interior', 'Cinco golpes distribuídos entre os inimigos; você fica Evasivo.', {
        cost: 5, cd: 7, target: 'todos_inimigos', icon: 'vento',
        effects: [dmg(10, { destreza: 0.8 }, 'fisico', { weapon: 0.5, hits: 5, on: 'aleatorio' }), st('evasivo', 2, { potency: 40, on: 'si' })],
      }),
    }),
  ],
};
