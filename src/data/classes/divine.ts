import type { ClassDef } from '../types.ts';
import { dmg, heal, mod, passive, shield, skill, st, tree } from './helpers.ts';

// =====================================================================
// CLÉRIGO — cura e sustentação. Recurso: Fé.
// =====================================================================
export const CLERIGO: ClassDef = {
  id: 'clerigo', name: 'Clérigo', role: 'Cura e sustentação', color: '#e0c040',
  desc: 'Mantém o grupo de pé com luz, julgamento e espíritos guardiões.',
  resource: { id: 'fe', name: 'Fé', max: 100, start: 100, regen: 10, maxPerAttr: { attr: 'espirito', per: 1 } },
  armorTraining: 'media', suggested: { espirito: 3, vigor: 2, forca: 1 },
  weapons: ['maca', 'martelo', 'cajado', 'escudo', 'tomo'],
  fundamento: skill('prece-cura', 'Prece de Cura', 'Cura um aliado.', {
    cost: 15, cd: 0, target: 'aliado', icon: 'cruz', range: 'distancia', anyLine: true,
    effects: [heal(14, { espirito: 1.2 })],
  }),
  innate: passive('bencao-menor', 'Bênção Menor', 'Suas curas são 10% mais fortes.', [{ t: 'stat', stat: 'cura', value: 10 }], 'cruz'),
  trees: [
    tree({
      id: 'devoto', name: 'Devoto', desc: 'Curas fortes, escudos de fé e restauração.',
      a1: skill('luz-restauradora', 'Luz Restauradora', 'Cura forte com Regeneração por 2 rodadas.', {
        cost: 25, cd: 1, target: 'aliado', icon: 'sol', range: 'distancia', anyLine: true,
        effects: [heal(20, { espirito: 1.5 }), st('regeneracao', 2, { potency: 4, scale: { espirito: 0.25 } })],
      }),
      f1: [
        mod('luz-abundante', 'Luz Abundante', 'luz-restauradora', 'Cura todos os aliados com 40% do poder.', { icon: 'sol', target: 'todos_aliados', powerMult: 0.4, costDelta: 10 }),
        mod('luz-purificadora', 'Luz Purificadora', 'luz-restauradora', 'Remove um efeito negativo.', { icon: 'cruz', add: [{ k: 'purificar', count: 1 }] }),
      ],
      a2: skill('escudo-fe', 'Escudo da Fé', 'Escudo sagrado por 2 rodadas.', {
        cost: 20, cd: 2, target: 'aliado', icon: 'escudo', range: 'distancia', anyLine: true,
        effects: [shield(18, { espirito: 1.3 }, 2)],
      }),
      f2: [
        mod('fe-inabalavel', 'Fé Inabalável', 'escudo-fe', 'Também Fortifica por 1 rodada.', { icon: 'escudo', add: [st('fortificado', 1, { potency: 20 })] }),
        mod('escudo-renovado', 'Escudo Renovado', 'escudo-fe', 'O escudo dura 4 rodadas.', { icon: 'relogio', patch: [{ index: 0, set: { dur: 4 } }] }),
      ],
      p: passive('graca', 'Graça', 'Cura excedente vira escudo (50%).', [{ t: 'cura_excedente_escudo', pct: 50 }], 'coracao'),
      a3: skill('circulo-cura', 'Círculo de Cura', 'Cura todos os aliados e concede Regeneração.', {
        cost: 40, cd: 3, target: 'todos_aliados', icon: 'cruz', range: 'distancia', anyLine: true,
        effects: [heal(14, { espirito: 1.0 }), st('regeneracao', 2, { potency: 4, scale: { espirito: 0.2 } })],
      }),
      m3: mod('circulo-sagrado', 'Círculo Sagrado', 'circulo-cura', 'Também causa dano de luz em todos os inimigos.', { icon: 'sol', add: [dmg(8, { espirito: 0.6 }, 'luz', { on: 'inimigos' })] }),
      c: skill('ressurgir', 'Ressurgir', 'Revive um aliado caído com 40% da vida (ou cura 50% de um aliado vivo).', {
        cost: 90, cd: 10, target: 'aliado', icon: 'estrela', range: 'distancia', anyLine: true,
        effects: [heal(0, {}, { pctMax: 0.4, revive: true })],
        tags: ['alvo_caido'],
      }),
    }),
    tree({
      id: 'inquisidor', name: 'Inquisidor', desc: 'Luz como arma contra o que vem do Véu.',
      a1: skill('golpe-sagrado', 'Golpe Sagrado', 'Golpe de luz; +50% contra mortos-vivos e criaturas do Véu.', {
        cost: 15, cd: 0, target: 'inimigo', icon: 'cruz',
        effects: [dmg(10, { espirito: 0.8, forca: 0.4 }, 'luz', { weapon: 0.6, bonusVs: { tag: 'veu', mult: 1.5 } })],
      }),
      f1: [
        mod('marca-inquisicao', 'Marca da Inquisição', 'golpe-sagrado', 'Deixa o alvo Vulnerável por 2 rodadas.', { icon: 'alvo', add: [st('vulneravel', 2, { potency: 15 })] }),
        mod('golpe-restaurador', 'Golpe Restaurador', 'golpe-sagrado', 'Drena 30% do dano como vida.', { icon: 'coracao', patch: [{ index: 0, set: { lifesteal: 0.3 } }] }),
      ],
      a2: skill('julgamento', 'Julgamento', 'Dano de luz à distância; dobra contra quem está preparando uma ação.', {
        cost: 25, cd: 2, target: 'inimigo', icon: 'sol', range: 'distancia',
        effects: [dmg(16, { espirito: 1.2 }, 'luz', { bonusVs: { charging: true, mult: 2 } })],
      }),
      f2: [
        mod('sentenca', 'Sentença', 'julgamento', 'Também interrompe.', { icon: 'mao', add: [{ k: 'interromper' }], cooldownDelta: 1 }),
        mod('veredito-final', 'Veredito Final', 'julgamento', '+60% contra alvos abaixo de 40% de vida.', { icon: 'caveira', add: [dmg(6, { espirito: 0.4 }, 'luz', { bonusVs: { hpBelow: 0.4, mult: 3 } })] }),
      ],
      p: passive('zelo', 'Zelo', 'Causar dano gera 4 de fé.', [{ t: 'ao_causar_dano', recurso: 4 }], 'chama'),
      a3: skill('chama-purificadora', 'Chama Purificadora', 'Luz em todos os inimigos, com Queimadura.', {
        cost: 40, cd: 3, target: 'todos_inimigos', icon: 'fogo', range: 'distancia',
        effects: [dmg(10, { espirito: 0.8 }, 'luz'), st('queimadura', 2, { potency: 3, scale: { espirito: 0.2 }, elem: 'luz' })],
      }),
      m3: mod('purgar', 'Purgar', 'chama-purificadora', 'Remove um efeito negativo de cada aliado.', { icon: 'cruz', add: [{ k: 'purificar', count: 1, on: 'aliados' }] }),
      c: skill('ira-divina', 'Ira Divina', 'Grande dano de luz em todos os inimigos; mortos-vivos ficam atordoados.', {
        cost: 90, cd: 9, target: 'todos_inimigos', icon: 'sol', range: 'distancia',
        effects: [dmg(35, { espirito: 2.0 }, 'luz', { bonusVs: { tag: 'veu', mult: 1.3 } }), st('atordoado', 1, { chance: 0.35 })],
      }),
    }),
    tree({
      id: 'guardiao-espiritual', name: 'Guardião Espiritual', desc: 'Espíritos aliados e vínculos protetores.',
      a1: skill('espirito-protetor', 'Espírito Protetor', 'Invoca um espírito que cura o aliado mais ferido a cada rodada (até 1).', {
        cost: 25, cd: 3, target: 'nenhum', icon: 'espirito', anyLine: true,
        effects: [{ k: 'invocar', minion: 'espirito-guardiao', max: 1 }],
      }),
      f1: [
        mod('espirito-sereno', 'Espírito Sereno', 'espirito-protetor', 'Ao surgir, cura todos os aliados.', { icon: 'cruz', add: [heal(8, { espirito: 0.6 }, { on: 'aliados' })] }),
        mod('espirito-vigilante', 'Espírito Vigilante', 'espirito-protetor', 'Até 2 espíritos.', { icon: 'olho', patch: [{ index: 0, set: { max: 2 } }] }),
      ],
      a2: skill('vinculo-espiritual', 'Vínculo Espiritual', 'Você absorve 50% do dano recebido por um aliado por 3 rodadas.', {
        cost: 25, cd: 3, target: 'aliado', icon: 'coracao', range: 'distancia', anyLine: true,
        effects: [{ k: 'interceptar', ratio: 0.5, dur: 3 }],
      }),
      f2: [
        mod('vinculo-revigorante', 'Vínculo Revigorante', 'vinculo-espiritual', 'Vocês dois ganham Regeneração.', { icon: 'cruz', add: [st('regeneracao', 3, { potency: 4, scale: { espirito: 0.2 } }), st('regeneracao', 3, { potency: 4, scale: { espirito: 0.2 }, on: 'si' })] }),
        mod('vinculo-duradouro', 'Vínculo Duradouro', 'vinculo-espiritual', 'Dura 5 rodadas.', { icon: 'relogio', patch: [{ index: 0, set: { dur: 5 } }] }),
      ],
      p: passive('presenca-espiritual', 'Presença Espiritual', 'Aliados na sua linha recebem 8% menos dano.', [{ t: 'linha_reducao', pct: 8 }], 'espirito'),
      a3: skill('santuario', 'Santuário', 'Sua linha fica Fortificada e é purificada.', {
        cost: 35, cd: 4, target: 'nenhum', icon: 'torre', anyLine: true,
        effects: [st('fortificado', 2, { potency: 20, on: 'linha_si' }), { k: 'purificar', count: 1, on: 'linha_si' }],
      }),
      m3: mod('santuario-firme', 'Santuário Firme', 'santuario', 'Também concede imunidade a controle por 1 rodada.', { icon: 'escudo', add: [st('firmeza', 1, { on: 'linha_si' })] }),
      c: skill('ascensao-ancestrais', 'Ascensão dos Ancestrais', 'Invoca dois espíritos e protege todos os aliados com escudo.', {
        cost: 90, cd: 9, target: 'nenhum', icon: 'coroa', anyLine: true,
        effects: [{ k: 'invocar', minion: 'espirito-guardiao', max: 3, count: 2 }, shield(20, { espirito: 1.2 }, 3, { on: 'aliados' })],
      }),
    }),
  ],
};

// =====================================================================
// DRUIDA — transformação e natureza. Recurso: Seiva.
// =====================================================================
export const DRUIDA: ClassDef = {
  id: 'druida', name: 'Druida', role: 'Transformação e natureza', color: '#5a8a3a',
  desc: 'Assume formas animais, cultiva a vida e chama a tempestade.',
  resource: { id: 'seiva', name: 'Seiva', max: 100, start: 60, regen: 12, onBasic: 5 },
  armorTraining: 'media', suggested: { espirito: 2, intelecto: 1, vigor: 2, forca: 1 },
  weapons: ['cajado', 'lanca', 'foco', 'adaga'],
  fundamento: skill('espinhos', 'Espinhos', 'Espinhos que causam dano de natureza e Veneno.', {
    cost: 10, cd: 0, target: 'inimigo', icon: 'folha', range: 'distancia',
    effects: [dmg(8, { espirito: 0.6, intelecto: 0.4 }, 'natureza', { weapon: 0.4 }), st('veneno', 2, { potency: 2, scale: { espirito: 0.15 }, elem: 'veneno' })],
  }),
  innate: passive('harmonia-natural', 'Harmonia Natural', 'Regenera 2% da vida por rodada.', [{ t: 'stat', stat: 'regen_vida', value: 2 }], 'folha'),
  trees: [
    tree({
      id: 'metamorfo', name: 'Metamorfo', desc: 'Formas de urso e pantera.',
      a1: skill('forma-urso', 'Forma de Urso', 'Por 5 rodadas: −30% de dano recebido, +20% de vida efetiva e ataques que geram ameaça.', {
        cost: 20, cd: 5, target: 'si', icon: 'urso', anyLine: true,
        effects: [st('forma_urso', 5, { potency: 30 }), { k: 'mover', to: 'frente' }, heal(0, {}, { pctMax: 0.1 })],
      }),
      f1: [
        mod('urso-anciao', 'Urso Ancião', 'forma-urso', 'Provoca a linha de frente inimiga ao se transformar.', { icon: 'bandeira', add: [{ k: 'provocar', dur: 2, on: 'inimigos' }] }),
        mod('garras-selvagens', 'Garras Selvagens', 'forma-urso', 'Golpeia o inimigo à frente ao se transformar.', { icon: 'garra', add: [dmg(10, { forca: 0.8, vigor: 0.4 }, 'fisico', { on: 'aleatorio' })] }),
      ],
      a2: skill('forma-pantera', 'Forma de Pantera', 'Por 5 rodadas: +20% de dano e +20% de crítico; ataca ao se transformar.', {
        cost: 20, cd: 5, target: 'inimigo', icon: 'garra',
        effects: [st('forma_pantera', 5, { potency: 20, on: 'si' }), dmg(12, { destreza: 1.0 }, 'fisico', { weapon: 0.6 })],
      }),
      f2: [
        mod('bote', 'Bote', 'forma-pantera', '40% de chance de atordoar.', { icon: 'pata', add: [st('atordoado', 1, { chance: 0.4 })] }),
        mod('rasgar', 'Rasgar', 'forma-pantera', 'Causa Sangramento.', { icon: 'sangue', add: [st('sangramento', 3, { potency: 4, scale: { destreza: 0.2 } })] }),
      ],
      p: passive('instinto-animal', 'Instinto Animal', 'Em forma animal: +10% de esquiva e +4 de seiva por rodada.', [{ t: 'forma_bonus', esquiva: 10, recurso: 4 }], 'pata'),
      a3: skill('rugido-primal', 'Rugido Primal', 'Enfraquece a linha de frente inimiga e fortalece aliados.', {
        cost: 30, cd: 4, target: 'linha_inimiga', icon: 'urso',
        effects: [st('enfraquecido', 2, { potency: 20 }), st('fortalecido', 2, { potency: 10, on: 'aliados' })],
        anyLine: true,
      }),
      m3: mod('rugido-aterrador', 'Rugido Aterrador', 'rugido-primal', '30% de chance de atordoar.', { icon: 'estrela', add: [st('atordoado', 1, { chance: 0.3 })] }),
      c: skill('avatar-selvagem', 'Avatar Selvagem', 'Por 3 rodadas, assume as duas formas e cura 30%.', {
        cost: 80, cd: 9, target: 'si', icon: 'coroa', anyLine: true,
        effects: [st('forma_urso', 3, { potency: 30 }), st('forma_pantera', 3, { potency: 25 }), heal(0, {}, { pctMax: 0.3 })],
      }),
    }),
    tree({
      id: 'guardiao-verde', name: 'Guardião Verde', desc: 'Regeneração, raízes e casca.',
      a1: skill('florescer', 'Florescer', 'Cura e concede Regeneração por 3 rodadas.', {
        cost: 20, cd: 1, target: 'aliado', icon: 'folha', range: 'distancia', anyLine: true,
        effects: [heal(12, { espirito: 1.1 }), st('regeneracao', 3, { potency: 5, scale: { espirito: 0.25 } })],
      }),
      f1: [
        mod('florescer-duplo', 'Florescer Duplo', 'florescer', 'Também cura o aliado mais ferido.', { icon: 'folha', add: [heal(8, { espirito: 0.7 }, { on: 'aliado_ferido' })] }),
        mod('seiva-restauradora', 'Seiva Restauradora', 'florescer', 'O aliado recupera 15 de recurso.', { icon: 'gota', add: [{ k: 'recurso', amount: 15 }] }),
      ],
      a2: skill('raizes-enredantes', 'Raízes Enredantes', 'Enraíza o alvo por 2 rodadas.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'raiz', range: 'distancia',
        effects: [dmg(6, { espirito: 0.5, intelecto: 0.3 }, 'natureza'), st('enraizado', 2), st('lento', 1)],
      }),
      f2: [
        mod('raizes-espinhosas', 'Raízes Espinhosas', 'raizes-enredantes', 'Veneno por 3 rodadas.', { icon: 'folha', add: [st('veneno', 3, { potency: 3, scale: { espirito: 0.2 }, elem: 'veneno' })] }),
        mod('raizes-profundas', 'Raízes Profundas', 'raizes-enredantes', 'Atinge toda a linha do alvo.', { icon: 'raiz', target: 'linha_inimiga', costDelta: 10 }),
      ],
      p: passive('ciclo-vida', 'Ciclo da Vida', '+20% de cura.', [{ t: 'stat', stat: 'cura', value: 20 }], 'arvore'),
      a3: skill('pele-casca', 'Pele de Casca', 'Aliado fica Fortificado (−30% de dano) por 3 rodadas.', {
        cost: 25, cd: 3, target: 'aliado', icon: 'arvore', range: 'distancia', anyLine: true,
        effects: [st('fortificado', 3, { potency: 30 })],
      }),
      m3: mod('casca-espinhosa', 'Casca Espinhosa', 'pele-casca', 'Atacantes corpo a corpo sofrem dano.', { icon: 'folha', add: [st('contra_ataque', 3, { potency: 6, scale: { espirito: 0.4 } })] }),
      c: skill('bosque-sagrado', 'Bosque Sagrado', 'Regeneração forte em todos os aliados por 4 rodadas e purificação.', {
        cost: 85, cd: 9, target: 'todos_aliados', icon: 'arvore', range: 'distancia', anyLine: true,
        effects: [st('regeneracao', 4, { potency: 10, scale: { espirito: 0.6 } }), { k: 'purificar', count: 9 }],
      }),
    }),
    tree({
      id: 'senhor-tempestades', name: 'Senhor das Tempestades', desc: 'Chuva, raio e vento — combinações em cadeia.',
      a1: skill('relampago', 'Relâmpago', 'Dano de raio; dobra contra alvos Molhados.', {
        cost: 20, cd: 1, target: 'inimigo', icon: 'raio', range: 'distancia',
        effects: [dmg(12, { intelecto: 0.6, espirito: 0.6 }, 'raio', { bonusVs: { status: 'molhado', mult: 2 } })],
      }),
      f1: [
        mod('raio-bifurcado', 'Raio Bifurcado', 'relampago', 'Atinge também um inimigo aleatório.', { icon: 'raio', add: [dmg(8, { intelecto: 0.4, espirito: 0.4 }, 'raio', { on: 'aleatorio', bonusVs: { status: 'molhado', mult: 2 } })] }),
        mod('carga-estatica', 'Carga Estática', 'relampago', '20% de chance de atordoar.', { icon: 'estrela', add: [st('atordoado', 1, { chance: 0.2 })] }),
      ],
      a2: skill('chamar-chuva', 'Chamar Chuva', 'Todos os inimigos ficam Molhados por 3 rodadas; aliados têm Queimadura apagada.', {
        cost: 25, cd: 4, target: 'todos_inimigos', icon: 'nuvem', range: 'distancia',
        effects: [st('molhado', 3), { k: 'purificar', count: 1, on: 'aliados' }],
      }),
      f2: [
        mod('chuva-gelida', 'Chuva Gélida', 'chamar-chuva', 'Aplica 1 acúmulo de Resfriado.', { icon: 'gelo', add: [st('resfriado', 3, { stacks: 1 })] }),
        mod('chuva-revigorante', 'Chuva Revigorante', 'chamar-chuva', 'Aliados ganham Regeneração.', { icon: 'cruz', add: [st('regeneracao', 2, { potency: 4, scale: { espirito: 0.2 }, on: 'aliados' })] }),
      ],
      p: passive('olho-tempestade', 'Olho da Tempestade', '+15% de dano de raio.', [{ t: 'stat', stat: 'dano_raio', value: 15 }], 'nuvem'),
      a3: skill('ciclone', 'Ciclone', 'Dano de natureza em todos os inimigos e troca as linhas inimigas.', {
        cost: 40, cd: 4, target: 'todos_inimigos', icon: 'vento', range: 'distancia',
        effects: [dmg(10, { intelecto: 0.8 }, 'natureza'), { k: 'trocar_linhas', side: 'inimigos' }],
      }),
      m3: mod('olho-ciclone', 'Olho do Ciclone', 'ciclone', 'Aliados ficam Evasivos por 1 rodada.', { icon: 'vento', add: [st('evasivo', 1, { potency: 25, on: 'aliados' })] }),
      c: skill('furia-tempestade', 'Fúria da Tempestade', 'Molha todos os inimigos e lança 3 grandes raios.', {
        cost: 85, cd: 8, target: 'todos_inimigos', icon: 'raio', range: 'distancia',
        effects: [st('molhado', 3), dmg(20, { intelecto: 1.0, espirito: 1.0 }, 'raio', { hits: 3, on: 'aleatorio', bonusVs: { status: 'molhado', mult: 1.5 } })],
      }),
    }),
  ],
};

// =====================================================================
// BARDO — apoio, perturbação e versatilidade. Recurso: Inspiração.
// =====================================================================
export const BARDO: ClassDef = {
  id: 'bardo', name: 'Bardo', role: 'Apoio, perturbação e versatilidade', color: '#c05a8a',
  desc: 'Canções que fortalecem, brados que comandam e ilusões que confundem.',
  resource: { id: 'inspiracao', name: 'Inspiração', max: 100, start: 40, regen: 15 },
  armorTraining: 'leve', suggested: { espirito: 2, destreza: 2, intelecto: 1, percepcao: 1 },
  weapons: ['instrumento', 'adaga', 'espada', 'arco', 'varinha'],
  fundamento: skill('nota-dissonante', 'Nota Dissonante', 'Som cortante que enfraquece o alvo.', {
    cost: 10, cd: 0, target: 'inimigo', icon: 'nota', range: 'distancia',
    effects: [dmg(11, { espirito: 0.8, intelecto: 0.5 }, 'arcano', { weapon: 0.6 }), st('enfraquecido', 1, { potency: 10 })],
  }),
  innate: passive('repertorio', 'Repertório', 'Escudos e curas que você aplica são 10% mais fortes.', [{ t: 'stat', stat: 'cura', value: 10 }], 'nota'),
  trees: [
    tree({
      id: 'virtuoso', name: 'Virtuoso', desc: 'Canções contínuas para o grupo.',
      a1: skill('cancao-inspiradora', 'Canção Inspiradora', 'Aliados ficam Fortalecidos (+15%) por 3 rodadas.', {
        cost: 25, cd: 3, target: 'todos_aliados', icon: 'nota', range: 'distancia', anyLine: true,
        effects: [st('fortalecido', 3, { potency: 15 })],
      }),
      f1: [
        mod('refrao', 'Refrão', 'cancao-inspiradora', 'Dura 5 rodadas.', { icon: 'relogio', patch: [{ index: 0, set: { dur: 5 } }] }),
        mod('crescendo', 'Crescendo', 'cancao-inspiradora', '+25%, mas dura 2 rodadas.', { icon: 'estrela', patch: [{ index: 0, set: { dur: 2, potency: 25 } }] }),
      ],
      a2: skill('balada-restauradora', 'Balada Restauradora', 'Cura todos os aliados e concede Regeneração.', {
        cost: 30, cd: 2, target: 'todos_aliados', icon: 'coracao', range: 'distancia', anyLine: true,
        effects: [heal(10, { espirito: 0.8 }), st('regeneracao', 2, { potency: 3, scale: { espirito: 0.2 } })],
      }),
      f2: [
        mod('balada-serena', 'Balada Serena', 'balada-restauradora', 'Remove um efeito negativo de cada aliado.', { icon: 'cruz', add: [{ k: 'purificar', count: 1 }] }),
        mod('balada-vigorosa', 'Balada Vigorosa', 'balada-restauradora', 'Aliados recuperam 10 de recurso.', { icon: 'gota', add: [{ k: 'recurso', amount: 10 }] }),
      ],
      p: passive('ressonancia-harmonica', 'Ressonância Harmônica', '+6 de inspiração por rodada.', [{ t: 'recurso_inicio_rodada', amount: 6 }], 'nota'),
      a3: skill('hino-batalha', 'Hino de Batalha', 'Aliados ficam Fortificados e recuperam 20 de recurso.', {
        cost: 35, cd: 4, target: 'todos_aliados', icon: 'bandeira', range: 'distancia', anyLine: true,
        effects: [st('fortificado', 2, { potency: 15 }), { k: 'recurso', amount: 20 }],
      }),
      m3: mod('hino-ressonante', 'Hino Ressonante', 'hino-batalha', 'Aliados ficam Acelerados por 1 rodada.', { icon: 'vento', add: [st('acelerado', 1)] }),
      c: skill('sinfonia-lendaria', 'Sinfonia Lendária', 'Aliados: Fortalecidos, Fortificados, Regeneração e Acelerados por 3 rodadas.', {
        cost: 90, cd: 10, target: 'todos_aliados', icon: 'coroa', range: 'distancia', anyLine: true,
        effects: [st('fortalecido', 3, { potency: 20 }), st('fortificado', 3, { potency: 15 }), st('regeneracao', 3, { potency: 6, scale: { espirito: 0.3 } }), st('acelerado', 3)],
      }),
    }),
    tree({
      id: 'arauto', name: 'Arauto', desc: 'Proclamações, comando e brados.',
      a1: skill('proclamacao', 'Proclamação Ofensiva', 'Aponta o alvo: Vulnerável e Marcado por 2 rodadas.', {
        cost: 20, cd: 2, target: 'inimigo', icon: 'bandeira', range: 'distancia',
        effects: [dmg(8, { espirito: 0.6, intelecto: 0.3 }, 'arcano'), st('vulneravel', 2, { potency: 15 }), st('marcado', 2, { potency: 10 })],
      }),
      f1: [
        mod('proclamacao-ampla', 'Proclamação Ampla', 'proclamacao', 'Afeta toda a linha do alvo.', { icon: 'bandeira', target: 'linha_inimiga', costDelta: 10 }),
        mod('escarnio', 'Escárnio', 'proclamacao', 'Também provoca o alvo.', { icon: 'mascara', add: [{ k: 'provocar', dur: 2 }] }),
      ],
      a2: skill('brado-coragem', 'Brado de Coragem', 'Escudo em todos os aliados.', {
        cost: 30, cd: 3, target: 'todos_aliados', icon: 'escudo', range: 'distancia', anyLine: true,
        effects: [shield(10, { espirito: 0.8 }, 2)],
      }),
      f2: [
        mod('coragem-inabalavel', 'Coragem Inabalável', 'brado-coragem', 'Imunidade a controle por 1 rodada.', { icon: 'escudo', add: [st('firmeza', 1)] }),
        mod('coragem-contagiante', 'Coragem Contagiante', 'brado-coragem', 'Fortalecidos (+10%) por 2 rodadas.', { icon: 'estrela', add: [st('fortalecido', 2, { potency: 10 })] }),
      ],
      p: passive('voz-comando', 'Voz de Comando', '+8 de iniciativa e +5% de precisão.', [
        { t: 'stat', stat: 'iniciativa', value: 8 }, { t: 'stat', stat: 'precisao', value: 5 },
      ], 'bandeira'),
      a3: skill('grito-atordoante', 'Grito Atordoante', 'Interrompe e tem 50% de chance de atordoar.', {
        cost: 30, cd: 4, target: 'inimigo', icon: 'nota', range: 'distancia',
        effects: [{ k: 'interromper' }, st('atordoado', 1, { chance: 0.5 }), dmg(14, { espirito: 1.0, intelecto: 0.3 }, 'arcano')],
      }),
      m3: mod('eco-ensurdecedor', 'Eco Ensurdecedor', 'grito-atordoante', 'Silencia a linha do alvo.', { icon: 'nota', add: [st('silenciado', 1, { on: 'linha_alvo' })] }),
      c: skill('estandarte-arauto', 'Estandarte do Arauto', 'Por 4 rodadas: aliados +20% de dano e −15% de dano recebido.', {
        cost: 90, cd: 9, target: 'todos_aliados', icon: 'bandeira', range: 'distancia', anyLine: true,
        effects: [st('fortalecido', 4, { potency: 20 }), st('fortificado', 4, { potency: 15 })],
      }),
    }),
    tree({
      id: 'ilusionista', name: 'Ilusionista', desc: 'Imagens, confusão e pavor.',
      a1: skill('imagem-espelhada', 'Imagem Espelhada', 'Cria 2 imagens: cada uma anula um ataque direto.', {
        cost: 25, cd: 3, target: 'si', icon: 'espelho', anyLine: true,
        effects: [st('imagem', 3, { stacks: 2 })],
      }),
      f1: [
        mod('imagens-multiplas', 'Imagens Múltiplas', 'imagem-espelhada', 'Três imagens.', { icon: 'espelho', patch: [{ index: 0, set: { stacks: 3 } }] }),
        mod('imagem-compartilhada', 'Imagem Compartilhada', 'imagem-espelhada', 'Pode ser lançada em um aliado.', { icon: 'mascara', target: 'aliado' }),
      ],
      a2: skill('confusao', 'Confusão', 'O alvo fica Confuso por 2 rodadas (pode atacar os próprios aliados).', {
        cost: 30, cd: 3, target: 'inimigo', icon: 'espiral', range: 'distancia',
        effects: [dmg(8, { intelecto: 0.6, espirito: 0.4 }, 'arcano'), st('confuso', 2)],
      }),
      f2: [
        mod('confusao-massa', 'Confusão em Massa', 'confusao', 'Afeta toda a linha por 1 rodada.', { icon: 'espiral', target: 'linha_inimiga', patch: [{ index: 1, set: { dur: 1 } }], costDelta: 10 }),
        mod('delirio', 'Delírio', 'confusao', 'Também causa dano arcano por rodada.', { icon: 'mascara', add: [st('decadencia', 2, { potency: 4, scale: { intelecto: 0.3 }, elem: 'arcano' })] }),
      ],
      p: passive('desvio-percepcao', 'Desvio da Percepção', 'Inimigos têm −10% de precisão contra você e sua linha.', [{ t: 'linha_precisao_inimiga', pct: 10 }], 'olho'),
      a3: skill('fantasma-aterrador', 'Fantasma Aterrador', 'A linha do alvo fica Enfraquecida e Lenta.', {
        cost: 30, cd: 4, target: 'linha_inimiga', icon: 'espirito', range: 'distancia',
        effects: [dmg(10, { espirito: 0.7, intelecto: 0.4 }, 'arcano'), st('enfraquecido', 2, { potency: 15 }), st('lento', 2)],
      }),
      m3: mod('pavor', 'Pavor', 'fantasma-aterrador', '25% de chance de atordoar.', { icon: 'caveira', add: [st('atordoado', 1, { chance: 0.25 })] }),
      c: skill('grande-ilusao', 'Grande Ilusão', 'Todos os inimigos ficam Confusos e Cegos por 2 rodadas.', {
        cost: 90, cd: 9, target: 'todos_inimigos', icon: 'mascara', range: 'distancia',
        effects: [st('confuso', 2), st('cegueira', 2, { potency: 30 })],
      }),
    }),
  ],
};
