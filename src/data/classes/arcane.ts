import type { ClassDef } from '../types.ts';
import { dmg, heal, mod, passive, shield, skill, st, tree } from './helpers.ts';

// =====================================================================
// MAGO — dano mágico e controle. Recurso: Mana.
// =====================================================================
export const MAGO: ClassDef = {
  id: 'mago', name: 'Mago', role: 'Dano mágico e controle', color: '#3a6ab8',
  desc: 'Combina elementos, dobra o tempo e domina o campo com energia arcana.',
  resource: { id: 'mana', name: 'Mana', max: 100, start: 100, regen: 8, maxPerAttr: { attr: 'intelecto', per: 2 } },
  armorTraining: 'leve', suggested: { intelecto: 3, percepcao: 1, espirito: 1, vigor: 1 },
  weapons: ['cajado', 'varinha', 'tomo', 'foco'],
  fundamento: skill('dardo-arcano', 'Dardo Arcano', 'Projétil arcano barato.', {
    cost: 8, cd: 0, target: 'inimigo', icon: 'espiral', range: 'distancia',
    effects: [dmg(8, { intelecto: 1.0 }, 'arcano', { weapon: 0.5 })],
  }),
  innate: passive('afinidade-arcana', 'Afinidade Arcana', '+10% de dano mágico.', [{ t: 'stat', stat: 'dano_magico', value: 10 }], 'espiral'),
  trees: [
    tree({
      id: 'elementalista', name: 'Elementalista', desc: 'Fogo, gelo e raio em combinações legíveis.',
      a1: skill('bola-fogo', 'Bola de Fogo', 'Dano de fogo e Queimadura.', {
        cost: 20, cd: 1, target: 'inimigo', icon: 'fogo', range: 'distancia',
        effects: [dmg(14, { intelecto: 1.2 }, 'fogo', { weapon: 0.5 }), st('queimadura', 2, { potency: 3, scale: { intelecto: 0.2 }, elem: 'fogo' })],
      }),
      f1: [
        mod('explosao-ignea', 'Explosão Ígnea', 'bola-fogo', 'Atinge toda a linha do alvo com 70% do poder.', { icon: 'fogo', target: 'linha_inimiga', powerMult: 0.7, costDelta: 8 }),
        mod('chama-persistente', 'Chama Persistente', 'bola-fogo', 'Queimadura dura 4 rodadas e é mais forte.', { icon: 'fogo', patch: [{ index: 1, set: { dur: 4, potency: 5 } }] }),
      ],
      a2: skill('lanca-gelo', 'Lança de Gelo', 'Dano de gelo e 2 acúmulos de Resfriado (3 acúmulos congelam).', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'gelo', range: 'distancia',
        effects: [dmg(12, { intelecto: 1.1 }, 'gelo', { weapon: 0.4 }), st('resfriado', 3, { stacks: 2 })],
      }),
      f2: [
        mod('estilhacos', 'Estilhaços', 'lanca-gelo', 'Atinge toda a linha com 60% do poder.', { icon: 'gelo', target: 'linha_inimiga', powerMult: 0.6 }),
        mod('congelamento-profundo', 'Congelamento Profundo', 'lanca-gelo', '+1 acúmulo de Resfriado.', { icon: 'gelo', patch: [{ index: 1, set: { stacks: 3 } }] }),
      ],
      p: passive('sintonia-elemental', 'Sintonia Elemental', 'Combinações elementais (molhado, óleo, resfriado) causam +20% de efeito.', [{ t: 'stat', stat: 'efeito_elemental', value: 20 }], 'estrela'),
      a3: skill('corrente-eletrica', 'Corrente Elétrica', 'Raio que salta para até 3 inimigos; dobra contra alvos Molhados.', {
        cost: 30, cd: 2, target: 'inimigo', icon: 'raio', range: 'distancia',
        effects: [dmg(12, { intelecto: 1.0 }, 'raio', { weapon: 0.4, hits: 3, on: 'aleatorio', bonusVs: { status: 'molhado', mult: 2 } })],
      }),
      m3: mod('tempestade-condutora', 'Tempestade Condutora', 'corrente-eletrica', 'Salta 5 vezes.', { icon: 'raio', patch: [{ index: 0, set: { hits: 5 } }], costDelta: 10 }),
      c: skill('cataclismo', 'Cataclismo Elemental', 'Fogo, gelo e raio atingem todos os inimigos.', {
        cost: 90, cd: 8, target: 'todos_inimigos', icon: 'sol', range: 'distancia',
        effects: [dmg(15, { intelecto: 1.0 }, 'fogo'), dmg(15, { intelecto: 1.0 }, 'gelo'), dmg(15, { intelecto: 1.0 }, 'raio')],
      }),
    }),
    tree({
      id: 'arcanista', name: 'Arcanista', desc: 'Energia pura, barreiras e silêncio.',
      a1: skill('misseis-arcanos', 'Mísseis Arcanos', 'Três mísseis em inimigos aleatórios.', {
        cost: 18, cd: 1, target: 'todos_inimigos', icon: 'estrela', range: 'distancia',
        effects: [dmg(5, { intelecto: 0.55 }, 'arcano', { hits: 3, on: 'aleatorio' })],
      }),
      f1: [
        mod('misseis-teleguiados', 'Mísseis Teleguiados', 'misseis-arcanos', 'Todos os mísseis atingem o alvo escolhido.', { icon: 'alvo', target: 'inimigo', patch: [{ index: 0, set: { on: 'alvo' } }] }),
        mod('sobrecarga', 'Sobrecarga', 'misseis-arcanos', 'Quatro mísseis.', { icon: 'estrela', patch: [{ index: 0, set: { hits: 4 } }], costDelta: 6 }),
      ],
      a2: skill('barreira-arcana', 'Barreira Arcana', 'Escudo em um aliado por 3 rodadas.', {
        cost: 25, cd: 3, target: 'aliado', icon: 'escudo', range: 'distancia', anyLine: true,
        effects: [shield(15, { intelecto: 1.2 }, 3)],
      }),
      f2: [
        mod('barreira-refletora', 'Barreira Refletora', 'barreira-arcana', 'O protegido reflete 30% do dano mágico recebido.', { icon: 'espelho', add: [st('refletir', 3, { potency: 30 })] }),
        mod('barreira-ampla', 'Barreira Ampla', 'barreira-arcana', 'Protege todos os aliados com 60% do poder.', { icon: 'escudo', target: 'todos_aliados', powerMult: 0.6, costDelta: 10 }),
      ],
      p: passive('mente-analitica', 'Mente Analítica', '+5 de mana por rodada e +5% de chance crítica.', [
        { t: 'stat', stat: 'regen_recurso', value: 5 }, { t: 'stat', stat: 'critico', value: 5 },
      ], 'livro'),
      a3: skill('silencio-arcano', 'Silêncio Arcano', 'Interrompe e silencia o alvo por 2 rodadas.', {
        cost: 30, cd: 4, target: 'inimigo', icon: 'mascara', range: 'distancia',
        effects: [{ k: 'interromper' }, st('silenciado', 2), dmg(6, { intelecto: 0.5 }, 'arcano')],
      }),
      m3: mod('dreno-arcano', 'Dreno Arcano', 'silencio-arcano', 'Recupera 20 de mana.', { icon: 'gota', add: [{ k: 'recurso', amount: 20, on: 'si' }] }),
      c: skill('singularidade', 'Singularidade', 'Grande dano arcano; puxa a retaguarda inimiga para a frente e deixa todos Lentos.', {
        cost: 80, cd: 7, target: 'inimigo', icon: 'espiral', range: 'distancia',
        effects: [dmg(25, { intelecto: 2.0 }, 'arcano', { weapon: 0.6 }), { k: 'mover', to: 'frente', on: 'inimigos' }, st('lento', 2, { on: 'inimigos' })],
      }),
    }),
    tree({
      id: 'cronomante', name: 'Cronomante', desc: 'Atrasa inimigos, acelera aliados e desfaz ferimentos.',
      a1: skill('distorcao-temporal', 'Distorção Temporal', 'Deixa o alvo Lento por 2 rodadas.', {
        cost: 15, cd: 1, target: 'inimigo', icon: 'relogio', range: 'distancia',
        effects: [dmg(6, { intelecto: 0.6 }, 'arcano'), st('lento', 2)],
      }),
      f1: [
        mod('peso-seculos', 'Peso dos Séculos', 'distorcao-temporal', 'Também enfraquece.', { icon: 'relogio', add: [st('enfraquecido', 1, { potency: 20 })] }),
        mod('eco-temporal', 'Eco Temporal', 'distorcao-temporal', 'Afeta toda a linha do alvo.', { icon: 'espiral', target: 'linha_inimiga', costDelta: 8 }),
      ],
      a2: skill('aceleracao', 'Aceleração', 'Aliado fica Acelerado: recargas caem 1 rodada extra e +20 de iniciativa.', {
        cost: 25, cd: 4, target: 'aliado', icon: 'vento', range: 'distancia', anyLine: true,
        effects: [st('acelerado', 2)],
      }),
      f2: [
        mod('acelerar-grupo', 'Acelerar Grupo', 'aceleracao', 'Acelera todos os aliados por 1 rodada.', { icon: 'vento', target: 'todos_aliados', patch: [{ index: 0, set: { dur: 1 } }] }),
        mod('pressa-arcana', 'Pressa Arcana', 'aceleracao', 'O aliado recupera 20 de recurso.', { icon: 'gota', add: [{ k: 'recurso', amount: 20 }] }),
      ],
      p: passive('fluxo-temporal', 'Fluxo Temporal', '15% de chance de uma habilidade não entrar em recarga.', [{ t: 'sem_recarga_chance', pct: 15 }], 'relogio'),
      a3: skill('retroceder', 'Retroceder', 'Desfaz ferimentos recentes: cura e remove um efeito negativo.', {
        cost: 35, cd: 3, target: 'aliado', icon: 'relogio', range: 'distancia', anyLine: true,
        effects: [heal(25, { intelecto: 1.2 }), { k: 'purificar', count: 1 }],
      }),
      m3: mod('rebobinar', 'Rebobinar Ferimentos', 'retroceder', 'Remove todos os efeitos negativos.', { icon: 'cruz', patch: [{ index: 1, set: { count: 9 } }] }),
      c: skill('parar-tempo', 'Parar o Tempo', 'Atordoa todos os inimigos e atrasa ações preparadas em 1 rodada.', {
        cost: 90, cd: 9, target: 'todos_inimigos', icon: 'relogio', range: 'distancia',
        effects: [st('atordoado', 1)],
        tags: ['atrasar_intencoes'],
      }),
    }),
  ],
};

// =====================================================================
// NECROMANTE — lacaios e manipulação de essência. Recurso: Essência.
// =====================================================================
export const NECROMANTE: ClassDef = {
  id: 'necromante', name: 'Necromante', role: 'Lacaios e manipulação de essência', color: '#6a4a9a',
  desc: 'Colhe a essência que escapa pelas rachaduras do Véu: ossos, sangue e ceifa.',
  resource: { id: 'essencia', name: 'Essência', max: 100, start: 30, regen: 6, onDeathAny: 15 },
  armorTraining: 'leve', suggested: { intelecto: 3, vigor: 2, espirito: 1 },
  weapons: ['foice', 'cajado', 'varinha', 'tomo', 'adaga'],
  fundamento: skill('toque-sombrio', 'Toque Sombrio', 'Dano de sombra que drena 20% como vida.', {
    cost: 10, cd: 0, target: 'inimigo', icon: 'mao', range: 'distancia',
    effects: [dmg(9, { intelecto: 1.0 }, 'sombra', { weapon: 0.5, lifesteal: 0.2 })],
  }),
  innate: passive('colheita-essencia', 'Colheita de Essência', 'Abates concedem +10 de essência extra.', [{ t: 'ao_abater', recurso: 10 }], 'caveira'),
  trees: [
    tree({
      id: 'legiao', name: 'Legião', desc: 'Esqueletos e abominações agem junto ao dono.',
      a1: skill('erguer-esqueleto', 'Erguer Esqueleto', 'Ergue um esqueleto (até 2). Lacaios agem junto com você.', {
        cost: 25, cd: 2, target: 'nenhum', icon: 'osso', anyLine: true,
        effects: [{ k: 'invocar', minion: 'esqueleto', max: 2 }],
      }),
      f1: [
        mod('ossos-reforcados', 'Ossos Reforçados', 'erguer-esqueleto', 'Lacaios recebem um escudo ao surgir.', { icon: 'escudo', add: [shield(8, { intelecto: 0.6 }, 3, { on: 'aliados' })] }),
        mod('exercito-ossos', 'Exército de Ossos', 'erguer-esqueleto', 'Até 3 esqueletos.', { icon: 'osso', patch: [{ index: 0, set: { max: 3 } }] }),
      ],
      a2: skill('comandar-mortos', 'Comandar Mortos', 'Seus lacaios atacam o alvo com o dobro de força; ele fica Vulnerável.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'caveira', range: 'distancia',
        effects: [{ k: 'comandar', mult: 2 }, st('vulneravel', 1, { potency: 15 })],
      }),
      f2: [
        mod('ossos-explosivos', 'Ossos Explosivos', 'comandar-mortos', 'Também causa dano de sombra na linha do alvo.', { icon: 'bomba', add: [dmg(10, { intelecto: 0.8 }, 'sombra', { on: 'linha_alvo' })] }),
        mod('marcha-funebre', 'Marcha Fúnebre', 'comandar-mortos', 'Lacaios ficam Fortalecidos por 3 rodadas.', { icon: 'nota', add: [st('fortalecido', 3, { potency: 30, on: 'aliados' })] }),
      ],
      p: passive('mestre-legiao', 'Mestre da Legião', 'Lacaios têm +20% de vida e dano.', [{ t: 'stat', stat: 'lacaios', value: 20 }], 'osso'),
      a3: skill('erguer-abominacao', 'Erguer Abominação', 'Ergue uma abominação robusta que protege a linha de frente (até 1).', {
        cost: 50, cd: 6, target: 'nenhum', icon: 'caveira', anyLine: true,
        effects: [{ k: 'invocar', minion: 'abominacao', max: 1 }],
      }),
      m3: mod('abominacao-faminta', 'Abominação Faminta', 'erguer-abominacao', 'Lacaios recuperam 30% da vida.', { icon: 'sangue', add: [heal(0, {}, { pctMax: 0.3, on: 'aliados' })] }),
      c: skill('exercito-condenados', 'Exército dos Condenados', 'Ergue 3 guerreiros esqueléticos por 3 rodadas.', {
        cost: 90, cd: 10, target: 'nenhum', icon: 'coroa', anyLine: true,
        effects: [{ k: 'invocar', minion: 'esqueleto-guerreiro', max: 3, count: 3, temp: 3 }],
      }),
    }),
    tree({
      id: 'sangue', name: 'Sangue', desc: 'Sacrifício de vida por poder e cura roubada.',
      a1: skill('lanca-sangue', 'Lança de Sangue', 'Custa 6% da sua vida; grande dano de sombra que drena 30%.', {
        cost: 5, cd: 1, target: 'inimigo', icon: 'sangue', range: 'distancia',
        effects: [dmg(14, { intelecto: 1.2 }, 'sombra', { weapon: 0.6, lifesteal: 0.3, selfCost: 0.06 })],
      }),
      f1: [
        mod('hemorragia', 'Hemorragia', 'lanca-sangue', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 4, scale: { intelecto: 0.2 } })] }),
        mod('sangue-fervente', 'Sangue Fervente', 'lanca-sangue', '+25% de dano.', { icon: 'fogo', powerMult: 1.25 }),
      ],
      a2: skill('transfusao', 'Transfusão', 'Drena um inimigo e cura o aliado mais ferido.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'coracao', range: 'distancia',
        effects: [dmg(8, { intelecto: 0.6 }, 'sombra'), heal(12, { intelecto: 0.9 }, { on: 'aliado_ferido' })],
      }),
      f2: [
        mod('transfusao-grupal', 'Transfusão Grupal', 'transfusao', 'Cura todos os aliados com metade do poder.', { icon: 'coracao', add: [heal(6, { intelecto: 0.45 }, { on: 'aliados' })], costDelta: 10 }),
        mod('pacto', 'Pacto', 'transfusao', 'Recupera 20 de essência.', { icon: 'gota', add: [{ k: 'recurso', amount: 20, on: 'si' }] }),
      ],
      p: passive('sangue-vivo', 'Sangue Vivo', 'Seu dano de sombra drena +10% como vida.', [{ t: 'ao_causar_dano', lifesteal: 0.1, elem: 'sombra' }], 'sangue'),
      a3: skill('fervura-sangue', 'Fervura de Sangue', 'Detona o Sangramento de todos os inimigos e aplica um novo.', {
        cost: 35, cd: 4, target: 'todos_inimigos', icon: 'sangue', range: 'distancia',
        effects: [{ k: 'detonar_sangramento', mult: 2 }, st('sangramento', 2, { potency: 4, scale: { intelecto: 0.2 } })],
      }),
      m3: mod('coagulacao', 'Coagulação', 'fervura-sangue', 'Aliados ganham Regeneração.', { icon: 'cruz', add: [st('regeneracao', 2, { potency: 5, scale: { intelecto: 0.2 }, on: 'aliados' })] }),
      c: skill('rito-carmesim', 'Rito Carmesim', 'Sacrifica 20% da vida: sombra em todos os inimigos, drenando 50%.', {
        cost: 60, cd: 9, target: 'todos_inimigos', icon: 'lua', range: 'distancia',
        effects: [dmg(40, { intelecto: 2.4 }, 'sombra', { lifesteal: 0.5, selfCost: 0.2 })],
      }),
    }),
    tree({
      id: 'ceifador', name: 'Ceifador', desc: 'Foices, maldições e colheita de almas.',
      a1: skill('foice-ceifa', 'Foice da Ceifa', 'Golpe de sombra em toda a linha de frente inimiga.', {
        cost: 20, cd: 1, target: 'linha_inimiga', icon: 'foice',
        effects: [dmg(10, { intelecto: 0.7, forca: 0.5 }, 'sombra', { weapon: 0.6 })],
      }),
      f1: [
        mod('ceifa-profunda', 'Ceifa Profunda', 'foice-ceifa', 'Enfraquece os atingidos.', { icon: 'foice', add: [st('enfraquecido', 1, { potency: 15 })] }),
        mod('ceifa-voraz', 'Ceifa Voraz', 'foice-ceifa', 'Recupera 15 de essência.', { icon: 'gota', add: [{ k: 'recurso', amount: 15, on: 'si' }] }),
      ],
      a2: skill('maldicao-decadencia', 'Maldição da Decadência', 'Dano de sombra por 3 rodadas; o alvo recebe 50% menos cura.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'caveira', range: 'distancia',
        effects: [st('decadencia', 3, { potency: 5, scale: { intelecto: 0.35 }, elem: 'sombra' })],
      }),
      f2: [
        mod('decadencia-contagiosa', 'Decadência Contagiosa', 'maldicao-decadencia', 'Atinge toda a linha do alvo.', { icon: 'nuvem', target: 'linha_inimiga', costDelta: 10 }),
        mod('maldicao-debilitante', 'Maldição Debilitante', 'maldicao-decadencia', 'Também enfraquece.', { icon: 'caveira', add: [st('enfraquecido', 2, { potency: 20 })] }),
      ],
      p: passive('arauto-morte', 'Arauto da Morte', '+30% de dano contra alvos abaixo de 30% de vida.', [{ t: 'dano_alvo_abaixo', below: 0.3, pct: 30 }], 'foice'),
      a3: skill('colher-almas', 'Colher Almas', 'Grande dano de sombra; se abater, zera a recarga e devolve 30 de essência.', {
        cost: 30, cd: 3, target: 'inimigo', icon: 'foice', range: 'distancia',
        effects: [dmg(18, { intelecto: 1.4 }, 'sombra', { weapon: 0.6 })],
        tags: ['reset_ao_abater'],
      }),
      m3: mod('ceifa-cadeia', 'Ceifa em Cadeia', 'colher-almas', 'Também atinge um inimigo aleatório com metade do poder.', { icon: 'foice', add: [dmg(9, { intelecto: 0.7 }, 'sombra', { on: 'aleatorio' })] }),
      c: skill('ceifador-encarnado', 'Ceifador Encarnado', 'Por 3 rodadas: +40% de dano e drena 20% como vida.', {
        cost: 70, cd: 9, target: 'si', icon: 'foice', anyLine: true,
        effects: [st('forma_ceifador', 3, { potency: 40 })],
      }),
    }),
  ],
};

// =====================================================================
// ARTÍFICE — dispositivos e combate técnico. Recurso: Carga.
// =====================================================================
export const ARTIFICE: ClassDef = {
  id: 'artifice', name: 'Artífice', role: 'Dispositivos e combate técnico', color: '#b07a3a',
  desc: 'Leva oficina para o campo: torretas, explosivos e tecnomancia rúnica.',
  resource: { id: 'carga', name: 'Carga', max: 100, start: 60, regen: 10, onBasic: 5 },
  armorTraining: 'media', suggested: { intelecto: 3, destreza: 2, vigor: 1 },
  weapons: ['pistola', 'besta', 'martelo', 'maca', 'foco'],
  fundamento: skill('pistola-runica', 'Disparo Rúnico', 'Disparo técnico à distância.', {
    cost: 10, cd: 0, target: 'inimigo', icon: 'engrenagem', range: 'distancia',
    effects: [dmg(8, { intelecto: 0.6, destreza: 0.4 }, 'fisico', { weapon: 0.7 })],
  }),
  innate: passive('mecanica-campo', 'Mecânica de Campo', 'Dispositivos e lacaios têm +15% de vida e dano.', [{ t: 'stat', stat: 'lacaios', value: 15 }], 'engrenagem'),
  trees: [
    tree({
      id: 'engenho', name: 'Engenho', desc: 'Torretas, minas e drones.',
      a1: skill('torreta', 'Torreta de Campo', 'Monta uma torreta que dispara junto com você (até 1).', {
        cost: 30, cd: 3, target: 'nenhum', icon: 'torre', anyLine: true,
        effects: [{ k: 'invocar', minion: 'torreta', max: 1 }],
      }),
      f1: [
        mod('torreta-dupla', 'Torreta Dupla', 'torreta', 'Até 2 torretas.', { icon: 'torre', patch: [{ index: 0, set: { max: 2 } }] }),
        mod('torreta-blindada', 'Torreta Blindada', 'torreta', 'Torretas recebem escudo ao surgir.', { icon: 'escudo', add: [shield(12, { intelecto: 0.8 }, 4, { on: 'aliados' })] }),
      ],
      a2: skill('mina-pressao', 'Mina de Pressão', 'Planta uma carga no alvo que explode após 1 rodada.', {
        cost: 25, cd: 2, target: 'inimigo', icon: 'bomba', range: 'distancia',
        effects: [st('detonacao', 1, { potency: 18, scale: { intelecto: 1.1 }, elem: 'fisico' })],
      }),
      f2: [
        mod('mina-choque', 'Mina de Choque', 'mina-pressao', 'A explosão vira raio e pode atordoar.', { icon: 'raio', patch: [{ index: 0, set: { elem: 'raio' } }], add: [st('atordoado', 1, { chance: 0.25 })] }),
        mod('mina-fragmentaria', 'Mina Fragmentária', 'mina-pressao', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 4, scale: { intelecto: 0.2 } })] }),
      ],
      p: passive('engenheiro-meticuloso', 'Engenheiro Meticuloso', 'Dispositivos +20% de dano.', [{ t: 'stat', stat: 'lacaios', value: 20 }], 'engrenagem'),
      a3: skill('drone-reparador', 'Drone Reparador', 'Lança um drone que cura o aliado mais ferido a cada rodada (até 1).', {
        cost: 35, cd: 5, target: 'nenhum', icon: 'engrenagem', anyLine: true,
        effects: [{ k: 'invocar', minion: 'drone', max: 1 }],
      }),
      m3: mod('drone-blindado', 'Drone Blindado', 'drone-reparador', 'Ao surgir, protege todos os aliados com um escudo.', { icon: 'escudo', add: [shield(10, { intelecto: 0.7 }, 2, { on: 'aliados' })] }),
      c: skill('fortaleza-mecanica', 'Fortaleza Mecânica', 'Monta um Baluarte que intercepta parte dos golpes do grupo por 3 rodadas.', {
        cost: 90, cd: 10, target: 'nenhum', icon: 'torre', anyLine: true,
        effects: [{ k: 'invocar', minion: 'baluarte', max: 1, temp: 3 }, st('fortificado', 3, { potency: 20, on: 'aliados' })],
      }),
    }),
    tree({
      id: 'artilharia', name: 'Artilharia', desc: 'Explosivos e canhões portáteis.',
      a1: skill('granada', 'Granada', 'Explosão de fogo na linha do alvo.', {
        cost: 25, cd: 1, target: 'linha_inimiga', icon: 'bomba', range: 'distancia',
        effects: [dmg(10, { intelecto: 0.8 }, 'fogo', { weapon: 0.3 })],
      }),
      f1: [
        mod('granada-fragmentacao', 'Granada de Fragmentação', 'granada', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 2, { potency: 3, scale: { intelecto: 0.2 } })] }),
        mod('granada-incendiaria', 'Granada Incendiária', 'granada', 'Causa Queimadura.', { icon: 'fogo', add: [st('queimadura', 3, { potency: 3, scale: { intelecto: 0.2 }, elem: 'fogo' })] }),
      ],
      a2: skill('canhao-mao', 'Canhão de Mão', 'Disparo pesado que empurra o alvo para a retaguarda.', {
        cost: 30, cd: 3, target: 'inimigo', icon: 'bomba', range: 'distancia',
        effects: [dmg(20, { intelecto: 1.0, forca: 0.6 }, 'fisico', { weapon: 1.0, breaks: true }), { k: 'mover', to: 'tras' }],
      }),
      f2: [
        mod('projetil-perfurante', 'Projétil Perfurante', 'canhao-mao', 'Ignora 50% da armadura.', { icon: 'seta', patch: [{ index: 0, set: { pierce: 0.5 } }] }),
        mod('coice-controlado', 'Coice Controlado', 'canhao-mao', 'Também interrompe.', { icon: 'mao', add: [{ k: 'interromper' }] }),
      ],
      p: passive('calibragem', 'Calibragem', '+12% de dano à distância e +5% crítico.', [
        { t: 'stat', stat: 'dano_distancia', value: 12 }, { t: 'stat', stat: 'critico', value: 5 },
      ], 'alvo'),
      a3: skill('bombardeio', 'Bombardeio', 'Três explosões em inimigos aleatórios, com Queimadura.', {
        cost: 40, cd: 3, target: 'todos_inimigos', icon: 'fogo', range: 'distancia',
        effects: [dmg(12, { intelecto: 0.8 }, 'fogo', { hits: 3, on: 'aleatorio' }), st('queimadura', 2, { potency: 3, scale: { intelecto: 0.15 }, elem: 'fogo', on: 'inimigos', chance: 0.5 })],
      }),
      m3: mod('bombardeio-saturado', 'Bombardeio Saturado', 'bombardeio', 'Cinco explosões.', { icon: 'bomba', patch: [{ index: 0, set: { hits: 5 } }], costDelta: 10 }),
      c: skill('barragem-total', 'Barragem Total', 'Atinge todos os inimigos e os deixa Vulneráveis.', {
        cost: 100, cd: 9, target: 'todos_inimigos', icon: 'sol', range: 'distancia',
        effects: [dmg(30, { intelecto: 2.0 }, 'fisico', { weapon: 0.8 }), st('vulneravel', 2, { potency: 20 })],
      }),
    }),
    tree({
      id: 'tecnomancia', name: 'Tecnomancia', desc: 'Runas, campos de força e eletricidade.',
      a1: skill('pulso-runico', 'Pulso Rúnico', 'Dano arcano que remove um efeito positivo do alvo.', {
        cost: 20, cd: 1, target: 'inimigo', icon: 'runa', range: 'distancia',
        effects: [dmg(10, { intelecto: 1.0 }, 'arcano', { weapon: 0.4 }), { k: 'dissipar', count: 1 }],
      }),
      f1: [
        mod('pulso-sobrecarregado', 'Pulso Sobrecarregado', 'pulso-runico', 'Silencia por 1 rodada.', { icon: 'mascara', add: [st('silenciado', 1)] }),
        mod('pulso-absorvente', 'Pulso Absorvente', 'pulso-runico', 'Recupera 15 de carga.', { icon: 'gota', add: [{ k: 'recurso', amount: 15, on: 'si' }] }),
      ],
      a2: skill('campo-forca', 'Campo de Força', 'Escudo em um aliado.', {
        cost: 25, cd: 2, target: 'aliado', icon: 'escudo', range: 'distancia', anyLine: true,
        effects: [shield(16, { intelecto: 1.2 }, 3)],
      }),
      f2: [
        mod('campo-amplo', 'Campo Amplo', 'campo-forca', 'Protege a linha do aliado com 70% do poder.', { icon: 'escudo', target: 'todos_aliados', powerMult: 0.7, costDelta: 10 }),
        mod('campo-reativo', 'Campo Reativo', 'campo-forca', 'O protegido reflete 25% do dano físico.', { icon: 'espelho', add: [st('refletir', 3, { potency: 25 })] }),
      ],
      p: passive('sobrecarga-runica', 'Sobrecarga Rúnica', 'Cada habilidade usada concede +4% de dano até 5 acúmulos.', [{ t: 'acumulo_ao_usar', status: 'fortalecido', potency: 4, max: 5 }], 'runa'),
      a3: skill('raio-tecnomantico', 'Raio Tecnomântico', 'Raio que salta 2 vezes; dobra contra alvos Molhados.', {
        cost: 30, cd: 2, target: 'inimigo', icon: 'raio', range: 'distancia',
        effects: [dmg(16, { intelecto: 1.3 }, 'raio', { hits: 2, on: 'aleatorio', bonusVs: { status: 'molhado', mult: 2 } })],
      }),
      m3: mod('arco-voltaico', 'Arco Voltaico', 'raio-tecnomantico', '25% de chance de atordoar.', { icon: 'raio', add: [st('atordoado', 1, { chance: 0.25 })] }),
      c: skill('nucleo-veu', 'Núcleo do Véu', 'Dano arcano massivo no alvo e metade nos demais; você fica Lento.', {
        cost: 100, cd: 9, target: 'inimigo', icon: 'runa', range: 'distancia',
        effects: [dmg(40, { intelecto: 2.4 }, 'arcano'), dmg(20, { intelecto: 1.2 }, 'arcano', { on: 'inimigos' }), st('lento', 1, { on: 'si' })],
      }),
    }),
  ],
};
