import type { AttributeId } from './types.ts';

export type CampaignNode =
  | { t: 'narrativa'; id: string; text: string; requires?: string; unless?: string }
  | { t: 'escolha'; id: string; text: string; options: { id: string; label: string; flag: string; desc: string; originBonus?: string }[]; requires?: string; unless?: string }
  | { t: 'teste'; id: string; text: string; attr: AttributeId; dc: number; success: { text: string; flag?: string; items?: [string, number][] }; fail: { text: string; flag?: string; damagePct?: number }; requires?: string; unless?: string }
  | { t: 'combate'; id: string; text: string; enemies: string[]; requires?: string; unless?: string }
  | { t: 'acampamento'; id: string; text: string; requires?: string; unless?: string }
  | { t: 'chefe'; id: string; text: string; boss: string; withAdds?: string[]; weakenedBy?: { flag: string; hpPct: number; text: string }[]; empoweredBy?: { flag: string; atkPct: number; text: string }[]; requires?: string; unless?: string }
  | { t: 'recompensa'; id: string; text: string; items: [string, number][]; gold: number; requires?: string; unless?: string };

export interface CampaignChapter { id: string; title: string; nodes: CampaignNode[] }

export interface CampaignDef {
  id: string;
  name: string;
  region: string;
  minLevel: number;
  /** Desafio especial: exige exatamente este número de participantes. */
  requiresExactly?: number;
  desc: string;
  boss: string;
  reputation: [string, number];
  chapters: CampaignChapter[];
  /** Recompensa que, após repetidas conclusões sem sorte, pode ser fabricada com fragmentos. */
  fragmentReward: { key: string; label: string; needed: number };
}

export const CAMPAIGNS: CampaignDef[] = [
  {
    id: 'colmeia-seda', name: 'A Colmeia de Seda', region: 'bosque', minLevel: 5, boss: 'matriarca-teias', reputation: ['floresta', 250],
    desc: 'Caçadores somem no coração do bosque, e as árvores amanhecem cobertas de seda.',
    fragmentReward: { key: 'seda-matriarca', label: 'Seda da Matriarca', needed: 5 },
    chapters: [
      {
        id: 'c1', title: 'Fios na Trilha', nodes: [
          { t: 'narrativa', id: 'n1', text: 'A Companhia dos Errantes recebeu três pedidos de busca em uma semana. Todos os desaparecidos seguiam a mesma trilha de caça.' },
          { t: 'teste', id: 't1', text: 'Fios quase invisíveis cruzam a trilha. Alguém precisa perceber antes de tocá-los.', attr: 'percepcao', dc: 14,
            success: { text: 'Vocês desviam dos fios e encontram uma bolsa de caçador presa na teia.', flag: 'evitou-alarme', items: [['pocao-vida-menor', 2]] },
            fail: { text: 'Um fio vibra. Ao longe, algo responde ao chamado.', damagePct: 0.05 } },
          { t: 'combate', id: 'b1', text: 'Aranhas descem das copas!', enemies: ['aranha-musgo', 'aranha-musgo', 'vespa-gigante'] },
          { t: 'acampamento', id: 'a1', text: 'Uma clareira segura. O grupo pode descansar e reorganizar os conjuntos de habilidades.' },
        ],
      },
      {
        id: 'c2', title: 'Os Casulos', nodes: [
          { t: 'narrativa', id: 'n2', text: 'Dezenas de casulos pendem dos galhos. Alguns ainda se mexem.' },
          { t: 'escolha', id: 'e1', text: 'O que fazer com os casulos?', options: [
            { id: 'libertar', label: 'Libertar os presos', flag: 'libertou-cacadores', desc: 'Leva tempo e chama atenção, mas salva os caçadores.' },
            { id: 'queimar', label: 'Queimar o ninho', flag: 'queimou-ninho', desc: 'Rápido e seguro — e definitivo.', originBonus: 'soldado' },
          ] },
          { t: 'combate', id: 'b2', text: 'Os caçadores libertados atraem guardiãs da colmeia.', requires: 'libertou-cacadores', enemies: ['aranha-emboscadora', 'aranha-musgo'] },
          { t: 'recompensa', id: 'r1', text: 'Os caçadores agradecem com o que conseguiram salvar.', requires: 'libertou-cacadores', items: [['isca-simples', 3], ['couro-curtido', 2]], gold: 30 },
          { t: 'narrativa', id: 'n3', text: 'As chamas sobem pelos fios. Algo grande guincha no fundo da mata.', requires: 'queimou-ninho' },
          { t: 'acampamento', id: 'a2', text: 'O grupo encontra uma toca abandonada para descansar.' },
        ],
      },
      {
        id: 'c3', title: 'A Rainha do Musgo', nodes: [
          { t: 'chefe', id: 'boss', text: 'A Matriarca das Teias desce do dossel.', boss: 'matriarca-teias',
            weakenedBy: [{ flag: 'queimou-ninho', hpPct: 0.15, text: 'Sem o ninho, a Matriarca chega ferida e com menos filhotes.' }],
            empoweredBy: [{ flag: 'libertou-cacadores', atkPct: 0.1, text: 'Furiosa pela perda das presas, a Matriarca ataca com mais força.' }] },
          { t: 'recompensa', id: 'r2', text: 'Os Guardiões da Floresta registram o feito.', items: [['seda-matriarca', 1]], gold: 120 },
        ],
      },
    ],
  },
  {
    id: 'trono-sucata', name: 'O Trono de Sucata', region: 'planicies', minLevel: 10, boss: 'rei-goblin', reputation: ['guarda', 300],
    desc: 'Caravanas inteiras desaparecem nas Planícies Partidas. Os goblins começaram a usar engenhocas.',
    fragmentReward: { key: 'engrenagem-rei', label: 'Engrenagem do Rei', needed: 5 },
    chapters: [
      {
        id: 'c1', title: 'A Caravana Saqueada', nodes: [
          { t: 'narrativa', id: 'n1', text: 'Uma carroça tombada ainda fumega. Rastros pequenos e marcas de rodas levam a leste.' },
          { t: 'teste', id: 't1', text: 'Seguir rastros misturados no capim seco.', attr: 'percepcao', dc: 15,
            success: { text: 'Vocês descobrem a rota de patrulha dos goblins.', flag: 'conhece-rota' },
            fail: { text: 'Os rastros se perdem; vocês seguem pela estrada principal.' } },
          { t: 'combate', id: 'b1', text: 'Uma patrulha goblin cai sobre o grupo!', unless: 'conhece-rota', enemies: ['goblin-batedor', 'goblin-batedor', 'gnoll-saqueador'] },
          { t: 'combate', id: 'b1b', text: 'Vocês emboscam a patrulha antes que ela perceba.', requires: 'conhece-rota', enemies: ['goblin-batedor', 'goblin-batedor'] },
          { t: 'acampamento', id: 'a1', text: 'Um posto de guarda abandonado oferece abrigo.' },
        ],
      },
      {
        id: 'c2', title: 'O Ferro-Velho', nodes: [
          { t: 'escolha', id: 'e1', text: 'O acampamento goblin é cercado por sucata. Como entrar?', options: [
            { id: 'negociar', label: 'Fingir ser compradores de sucata', flag: 'infiltrou', desc: 'Exige lábia; abre a porta da oficina do rei.', originBonus: 'artista' },
            { id: 'sabotar', label: 'Sabotar as engenhocas à noite', flag: 'sabotou', desc: 'O rei terá menos engenhocas na luta.', originBonus: 'artesao' },
            { id: 'atacar', label: 'Atacar o portão', flag: 'atacou', desc: 'Direto, barulhento e cheio de goblins.' },
          ] },
          { t: 'teste', id: 't2', text: 'Convencer o porteiro goblin de que vocês são compradores.', requires: 'infiltrou', attr: 'espirito', dc: 15,
            success: { text: 'O porteiro sorri com todos os seus três dentes e abre o portão.', items: [['engrenagem-velha', 3]] },
            fail: { text: 'O porteiro desconfia e toca o alarme!', flag: 'alarme', damagePct: 0 } },
          { t: 'teste', id: 't3', text: 'Desmontar as engrenagens sem fazer barulho.', requires: 'sabotou', attr: 'intelecto', dc: 15,
            success: { text: 'Várias engenhocas não vão funcionar amanhã.', flag: 'engenhocas-quebradas' },
            fail: { text: 'Uma mola salta e acerta alguém no rosto.', damagePct: 0.08 } },
          { t: 'combate', id: 'b2', text: 'O portão cede — e o bando inteiro vem junto.', requires: 'atacou', enemies: ['goblin-porta-estandarte', 'goblin-batedor', 'kobold-lanceiro'] },
          { t: 'combate', id: 'b2b', text: 'O alarme reúne os guardas!', requires: 'alarme', enemies: ['goblin-batedor', 'kobold-lanceiro'] },
          { t: 'acampamento', id: 'a2', text: 'Atrás de uma pilha de rodas quebradas, o grupo respira.' },
        ],
      },
      {
        id: 'c3', title: 'O Trono', nodes: [
          { t: 'chefe', id: 'boss', text: 'Sobre um trono de carroças, o Rei Goblin ajeita a coroa de panela.', boss: 'rei-goblin',
            weakenedBy: [{ flag: 'engenhocas-quebradas', hpPct: 0.2, text: 'Metade das engenhocas do rei explode sozinha.' }],
            empoweredBy: [{ flag: 'atacou', atkPct: 0.1, text: 'O rei viu vocês chegando e está preparado.' }] },
          { t: 'recompensa', id: 'r1', text: 'A Guarda das Estradas recupera parte das cargas.', items: [['engrenagem-rei', 1], ['lingote-ferro', 4]], gold: 200 },
        ],
      },
    ],
  },
  {
    id: 'coracao-mina', name: 'O Coração Sob a Mina', region: 'minas', minLevel: 15, boss: 'colosso-mina-oca', reputation: ['forjas', 350],
    desc: 'Os anões fugiram das Minas Abandonadas sem explicar por quê. A Irmandade das Forjas quer o motivo.',
    fragmentReward: { key: 'nucleo-colosso', label: 'Núcleo do Colosso', needed: 5 },
    chapters: [
      {
        id: 'c1', title: 'Galerias Escuras', nodes: [
          { t: 'narrativa', id: 'n1', text: 'As lanternas falham perto da terceira galeria. Algo bate na rocha em intervalos regulares.' },
          { t: 'combate', id: 'b1', text: 'Kobolds mineiros defendem seu território.', enemies: ['kobold-mineiro', 'kobold-supervisor', 'morcego-cego'] },
          { t: 'escolha', id: 'e1', text: 'Um anão ferido está preso sob escombros.', options: [
            { id: 'resgatar', label: 'Resgatá-lo', flag: 'resgatou-anao', desc: 'Ele conhece o colosso, mas atrasá-los custa vida.' },
            { id: 'seguir', label: 'Marcar a posição e seguir', flag: 'seguiu', desc: 'A Irmandade virá buscá-lo depois.' },
          ] },
          { t: 'teste', id: 't1', text: 'Erguer os escombros sem derrubar o teto.', requires: 'resgatou-anao', attr: 'forca', dc: 16,
            success: { text: 'O anão explica: "As placas. Quebrem na ordem — esquerda, direita, núcleo."', flag: 'sabe-ordem' },
            fail: { text: 'Pedras desabam sobre o grupo antes que vocês o tirem dali.', damagePct: 0.12, flag: 'sabe-ordem' } },
          { t: 'acampamento', id: 'a1', text: 'Uma antiga sala de descanso dos mineiros.' },
        ],
      },
      {
        id: 'c2', title: 'O Veio Vivo', nodes: [
          { t: 'combate', id: 'b2', text: 'O veio se mexe: golems se soltam da parede.', enemies: ['golem-rachado', 'caranguejo-minerio', 'slime-ferruginoso'] },
          { t: 'recompensa', id: 'r1', text: 'Minério puro, exposto pelos golems.', items: [['minerio-prata', 4], ['veio-ferruginoso', 2]], gold: 60 },
          { t: 'acampamento', id: 'a2', text: 'O som das batidas está muito perto agora.' },
        ],
      },
      {
        id: 'c3', title: 'A Mina Oca', nodes: [
          { t: 'chefe', id: 'boss', text: 'O Colosso desperta. Três placas cobrem seu núcleo.', boss: 'colosso-mina-oca',
            weakenedBy: [{ flag: 'sabe-ordem', hpPct: 0.1, text: 'Graças ao anão, vocês sabem onde golpear.' }] },
          { t: 'recompensa', id: 'r2', text: 'A Irmandade das Forjas agradece.', items: [['nucleo-colosso', 1], ['lingote-aco', 4]], gold: 250 },
        ],
      },
    ],
  },
  {
    id: 'sinos-cidade-afogada', name: 'Os Sinos da Cidade Afogada', region: 'costa', minLevel: 33, boss: 'almirante-afogado', reputation: ['mares', 600],
    desc: 'Pescadores desaparecem na costa. À noite, sinos tocam sob a maré.',
    fragmentReward: { key: 'ancora-afogada', label: 'Âncora Afogada', needed: 6 },
    chapters: [
      {
        id: 'c1', title: 'Desaparecimentos na Costa', nodes: [
          { t: 'narrativa', id: 'n1', text: 'Em Porto Salobro, ninguém pesca depois do pôr do sol. Os que tentaram não voltaram.' },
          { t: 'teste', id: 't1', text: 'Interrogar os pescadores sem assustá-los.', attr: 'espirito', dc: 18,
            success: { text: 'Uma velha pescadora conta: os desaparecidos foram vistos com contrabandistas.', flag: 'pista-contrabando' },
            fail: { text: 'Os pescadores se fecham. Vocês terão de descobrir sozinhos.' } },
          { t: 'combate', id: 'b1', text: 'Afogados saem da arrebentação!', enemies: ['afogado-errante', 'afogado-errante', 'caranguejo-blindado'] },
          { t: 'acampamento', id: 'a1', text: 'Uma taverna vazia aceita o grupo por uma noite.' },
        ],
      },
      {
        id: 'c2', title: 'O Armazém', nodes: [
          { t: 'escolha', id: 'e1', text: 'Os contrabandistas guardam algo no armazém do cais.', options: [
            { id: 'negociar', label: 'Negociar com os contrabandistas', flag: 'negociou', desc: 'Eles conhecem um caminho seguro para a cidade submersa.', originBonus: 'naufrago' },
            { id: 'atacar', label: 'Atacar o armazém', flag: 'atacou-armazem', desc: 'Recupera a carga roubada, mas sem guia.' },
          ] },
          { t: 'combate', id: 'b2', text: 'O armazém está cheio de contrabandistas — e de coisas piores.', requires: 'atacou-armazem', enemies: ['pirata-amaldicoado', 'pirata-amaldicoado', 'polvo-poca'] },
          { t: 'recompensa', id: 'r1', text: 'Carga recuperada: a Liga das Marés vai gostar disso.', requires: 'atacou-armazem', items: [['perola', 2], ['escama-mare', 3]], gold: 200 },
          { t: 'narrativa', id: 'n2', text: 'A líder dos contrabandistas cospe no chão: "Tem uma passagem pelos recifes. Mas eu não volto lá."', requires: 'negociou' },
          { t: 'acampamento', id: 'a2', text: 'O grupo prepara equipamento de mergulho e resistência a raio.' },
        ],
      },
      {
        id: 'c3', title: 'A Cidade Submersa', nodes: [
          { t: 'teste', id: 't2', text: 'Atravessar os recifes na maré baixa.', attr: 'destreza', dc: 19,
            success: { text: 'Vocês alcançam as ruas afogadas sem um arranhão.' },
            fail: { text: 'Corais cortam e a correnteza arrasta o grupo.', damagePct: 0.12 }, requires: 'negociou' },
          { t: 'combate', id: 'b3', text: 'Sem guia, vocês entram pelo caminho mais vigiado.', requires: 'atacou-armazem', enemies: ['sereia-hipnotica', 'cacador-mares', 'enguia-eletrica'] },
          { t: 'combate', id: 'b4', text: 'Os sinos tocam e as ruas despertam.', enemies: ['afogado-errante', 'coral-vivo', 'enguia-eletrica'] },
          { t: 'acampamento', id: 'a3', text: 'Uma torre de sino ainda acima da água serve de refúgio.' },
        ],
      },
      {
        id: 'c4', title: 'Prisioneiros ou Relíquia', nodes: [
          { t: 'narrativa', id: 'n3', text: 'A água sobe rápido. Numa ala, os pescadores presos; na outra, a relíquia que mantém a cidade submersa.' },
          { t: 'escolha', id: 'e2', text: 'Só há tempo para uma coisa antes da inundação.', options: [
            { id: 'prisioneiros', label: 'Resgatar os prisioneiros', flag: 'resgatou-prisioneiros', desc: 'Vidas salvas. O Almirante manterá sua relíquia.' },
            { id: 'reliquia', label: 'Recuperar a relíquia', flag: 'recuperou-reliquia', desc: 'Sem ela, o Almirante enfraquece — mas os prisioneiros…' },
          ] },
          { t: 'recompensa', id: 'r2', text: 'Os pescadores juram lealdade à Liga das Marés — e a vocês.', requires: 'resgatou-prisioneiros', items: [['pocao-vida-maior', 3]], gold: 150 },
          { t: 'recompensa', id: 'r3', text: 'A relíquia pulsa em suas mãos, fria como o fundo do mar.', requires: 'recuperou-reliquia', items: [['sal-mares', 3]], gold: 100 },
          { t: 'acampamento', id: 'a4', text: 'Último fôlego antes da ponte do navio-capitânia.' },
        ],
      },
      {
        id: 'c5', title: 'O Almirante Afogado', nodes: [
          { t: 'chefe', id: 'boss', text: 'No convés do navio afundado, o Almirante ergue o sabre. Os sinos tocam uma última vez.', boss: 'almirante-afogado',
            weakenedBy: [{ flag: 'recuperou-reliquia', hpPct: 0.2, text: 'Sem a relíquia, o Almirante mal consegue conter a água.' }],
            empoweredBy: [{ flag: 'resgatou-prisioneiros', atkPct: 0.1, text: 'O Almirante ainda tem a relíquia — e a fúria de quem perdeu sua tripulação.' }] },
          { t: 'recompensa', id: 'r4', text: 'Os sinos silenciam. Porto Salobro volta a pescar à noite.', items: [['ancora-afogada', 1]], gold: 500 },
        ],
      },
    ],
  },
  {
    id: 'ultimo-rasgo', name: 'O Último Rasgo', region: 'veu', minLevel: 55, boss: 'primeira-fenda', reputation: ['companhia', 1500], requiresExactly: 4,
    desc: 'Desafio especial para quatro aventureiros: atravessar as Terras do Véu e enfrentar a Primeira Fenda. Escolhas de campanhas anteriores pesam aqui.',
    fragmentReward: { key: 'reliquia-veu', label: 'Relíquia do Véu', needed: 8 },
    chapters: [
      {
        id: 'c1', title: 'Última Vigília', nodes: [
          { t: 'narrativa', id: 'n1', text: 'Os últimos vigias da Companhia entregam a vocês o mapa que ninguém voltou para corrigir.' },
          { t: 'combate', id: 'b1', text: 'Sentinelas vazias guardam a passagem.', enemies: ['sentinela-vazia', 'umbral-protetor', 'mariposa-astral'] },
          { t: 'acampamento', id: 'a1', text: 'Uma fogueira que queima em duas cores.' },
        ],
      },
      {
        id: 'c2', title: 'Terras Dobradas', nodes: [
          { t: 'teste', id: 't1', text: 'Seguir o caminho certo entre ecos de si mesmos.', attr: 'intelecto', dc: 22,
            success: { text: 'Vocês reconhecem o padrão da distorção.', flag: 'leu-distorcao' },
            fail: { text: 'Vocês andam em círculos por horas.', damagePct: 0.1 } },
          { t: 'combate', id: 'b2', text: 'O Véu cospe aberrações.', enemies: ['devorador-metamorfico', 'aberracao-rastejante', 'observador-psiquico'] },
          { t: 'acampamento', id: 'a2', text: 'Uma ilha de chão firme no meio do nada.' },
        ],
      },
      {
        id: 'c3', title: 'A Primeira Fenda', nodes: [
          { t: 'chefe', id: 'boss', text: 'Diante de vocês, o lugar onde o Véu rasgou pela primeira vez.', boss: 'primeira-fenda',
            weakenedBy: [
              { flag: 'leu-distorcao', hpPct: 0.08, text: 'Vocês já conhecem o padrão da distorção.' },
              { flag: 'hist:recuperou-reliquia', hpPct: 0.08, text: 'A relíquia da Cidade Afogada ressoa e fecha parte da fenda.' },
              { flag: 'hist:queimou-ninho', hpPct: 0.04, text: 'Sem a colmeia de seda, menos ecos atravessam.' },
            ],
            empoweredBy: [{ flag: 'hist:atacou', atkPct: 0.05, text: 'A fenda lembra da violência de vocês.' }] },
          { t: 'recompensa', id: 'r1', text: 'O Véu se acalma. Por enquanto.', items: [['reliquia-veu', 1], ['fragmento-veu', 5]], gold: 2000 },
        ],
      },
    ],
  },
];
export const campaignById = new Map(CAMPAIGNS.map((c) => [c.id, c]));
export const CAMPAIGN_MAX_PLAYERS = 4;
