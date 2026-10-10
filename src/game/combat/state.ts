import type {
  AttributeId, Effect, Element, Line, MonsterAbility, MonsterTarget, MonsterTrait, PassiveHook, Range, StatKey,
  StatusId, TargetKind, BossMeter, BossStack, BossPhase,
} from '../../data/types.ts';

export type Side = 'herois' | 'inimigos';
export type FighterKind = 'jogador' | 'lacaio' | 'pet' | 'monstro' | 'objeto';

export interface StatusInst {
  id: StatusId;
  dur: number;
  stacks: number;
  potency: number;
  source?: string;
  elem?: Element;
}

export interface ResolvedSkill {
  id: string;
  name: string;
  cost: number;
  cooldown: number;
  range: Range;
  target: TargetKind;
  effects: Effect[];
  anyLine: boolean;
  tags: string[];
  culminant: boolean;
  icon: string;
  mods: string[];
}

export interface Intent {
  ability: string;
  name: string;
  text: string;
  targetId?: string;
  pattern: MonsterTarget;
  chargeLeft: number;
  charging: boolean;
  interruptible: boolean;
}

export interface ObjectInfo {
  role: string;
  order?: number;
  protects?: number;
  aura?: { on: 'jogadores' | 'chefe' | 'linha_frente_jogadores'; effects: Effect[] };
  meterPerRound?: [string, number];
  onDeath?: { meter?: [string, number]; regrow?: number; text?: string };
  fuse?: { rounds: number; ability: MonsterAbility };
  enables?: string;
  /** Jogador preso (casulo). */
  holds?: string;
  defId: string;
}

export interface Fighter {
  id: string;
  side: Side;
  kind: FighterKind;
  name: string;
  /** characterId, monsterId ou id de lacaio/objeto. */
  ref: string;
  ownerId?: string;
  level: number;
  line: Line;
  hp: number;
  maxHp: number;
  shield: number;
  shieldDur: number;
  alive: boolean;
  res?: { id: string; name: string; cur: number; max: number; regen: number; onBasic: number; onHurt: number; onKill: number; onDefend: number; onDeathAny: number };
  attrs: Record<AttributeId, number>;
  atk: number;
  armor: number;
  resist: Partial<Record<Element, number>>;
  ctrlRes: number;
  dodge: number;
  crit: number;
  critDmg: number;
  initiative: number;
  accuracy: number;
  weapon?: { damage: number; elem: Element; range: Range; reach: boolean; scale: Partial<Record<AttributeId, number>>; breaks: boolean; oil?: { elem: Element; bonus: number; status?: string } };
  magicPower: number;
  healPower: number;
  block: number;
  bonus: Partial<Record<StatKey, number>>;
  hooks: PassiveHook[];
  legendary: string[];
  skills: ResolvedSkill[];
  cooldowns: Record<string, number>;
  statuses: StatusInst[];
  /** Para inimigos: ameaça acumulada por herói. */
  threat: Record<string, number>;
  tags: string[];
  weak: Element[];
  resistList: Element[];
  traits: MonsterTrait[];
  // ---- IA de criaturas
  monsterId?: string;
  abilities?: MonsterAbility[];
  abilityCd?: Record<string, number>;
  rotation?: string[];
  rotIndex?: number;
  targeting?: MonsterTarget;
  intent?: Intent;
  phase?: number;
  rank?: 'comum' | 'variante' | 'chefe';
  tameable?: boolean;
  xp?: number;
  // ---- objetos e chefes
  object?: ObjectInfo;
  boss?: { phases: BossPhase[]; phasesDone: number[]; copied?: MonsterAbility; atkMultBonus: number; regrow: { defId: string; rounds: number }[] };
  ctrlStacks: number;
  summonedBy?: string;
  temp?: number;
  // ---- jogadores
  belt?: { item: string; qty: number }[];
  potionCd: number;
  combo?: { last?: string; chain: number };
  dodgedLastRound?: boolean;
  usedFirstSkill?: boolean;
  hitThisRound?: boolean;
  defending?: boolean;
  pet?: { id: number; name: string; species: string; affinity: string; level: number; assistCd: number; atk: number };
  autoPosture?: 'defender' | 'atacar';
  rewardsShare?: number;
}

export type PlayerAction =
  | { kind: 'atacar'; targetId?: string; move?: boolean }
  | { kind: 'defender'; move?: boolean }
  | { kind: 'habilidade'; skillId: string; targetId?: string; move?: boolean }
  | { kind: 'item'; itemId: string; targetId?: string; move?: boolean }
  | { kind: 'domar'; targetId: string; itemId: string; move?: boolean }
  | { kind: 'analisar'; targetId: string; move?: boolean }
  | { kind: 'mover' }
  | { kind: 'fugir' };

export interface CombatContext {
  kind: 'exploracao' | 'campanha' | 'chefe' | 'treino';
  region: string;
  partySize: number;
  mode: 'solo' | 'ao_vivo' | 'assincrono';
  canFlee: boolean;
  flags: string[];
}

export interface CombatState {
  id: string;
  seed: number;
  rngState: number;
  round: number;
  fighters: Fighter[];
  log: string[];
  history: string[];
  pending: Record<string, PlayerAction>;
  outcome?: 'vitoria' | 'derrota' | 'fuga';
  meters: { id: string; label: string; value: number; max: number; def: BossMeter }[];
  fields: { id: string; rounds: number }[];
  stack?: BossStack & { zone?: Line; zoneRounds?: number };
  context: CombatContext;
  /** Domados durante o combate (entregues ao fim). */
  tamed: { ownerId: string; monsterId: string; level: number }[];
  /** Fraquezas reveladas por análise. */
  revealed: { ownerId: string; monsterId: string }[];
  kills: { monsterId: string; by: string }[];
  /** Consumo de cinto (para devolver o restante). */
  consumed: Record<string, Record<string, number>>;
  nextId: number;
}

export const STATUS_INFO: Record<StatusId, { label: string; icon: string; bad: boolean; control?: boolean; desc: string }> = {
  fortalecido: { label: 'Fortalecido', icon: '🔺', bad: false, desc: 'Causa mais dano.' },
  enfraquecido: { label: 'Enfraquecido', icon: '🔻', bad: true, desc: 'Causa menos dano.' },
  vulneravel: { label: 'Vulnerável', icon: '💢', bad: true, desc: 'Recebe mais dano.' },
  fortificado: { label: 'Fortificado', icon: '🛡️', bad: false, desc: 'Recebe menos dano.' },
  evasivo: { label: 'Evasivo', icon: '💨', bad: false, desc: 'Esquiva com mais frequência.' },
  cegueira: { label: 'Cego', icon: '🌫️', bad: true, desc: 'Erra com mais frequência.' },
  lento: { label: 'Lento', icon: '🐌', bad: true, desc: 'Age por último e esquiva menos.' },
  enraizado: { label: 'Enraizado', icon: '🌿', bad: true, desc: 'Não pode trocar de linha.' },
  atordoado: { label: 'Atordoado', icon: '💫', bad: true, control: true, desc: 'Perde a próxima ação.' },
  silenciado: { label: 'Silenciado', icon: '🤐', bad: true, control: true, desc: 'Só pode usar ações universais.' },
  confuso: { label: 'Confuso', icon: '❓', bad: true, control: true, desc: 'Pode atacar o alvo errado.' },
  marcado: { label: 'Marcado', icon: '🎯', bad: true, desc: 'Recebe mais dano.' },
  oculto: { label: 'Oculto', icon: '🌑', bad: false, desc: 'Não pode ser alvo direto.' },
  imagem: { label: 'Imagens', icon: '🪞', bad: false, desc: 'Cada imagem anula um ataque direto.' },
  sangramento: { label: 'Sangramento', icon: '🩸', bad: true, desc: 'Dano físico por rodada.' },
  veneno: { label: 'Veneno', icon: '🧪', bad: true, desc: 'Dano de veneno por rodada.' },
  queimadura: { label: 'Queimadura', icon: '🔥', bad: true, desc: 'Dano de fogo por rodada; impede regeneração.' },
  decadencia: { label: 'Decadência', icon: '☠️', bad: true, desc: 'Dano por rodada e cura recebida reduzida.' },
  regeneracao: { label: 'Regeneração', icon: '💚', bad: false, desc: 'Cura por rodada.' },
  molhado: { label: 'Molhado', icon: '💧', bad: true, desc: 'Raio causa +50%; fogo causa menos.' },
  oleado: { label: 'Oleado', icon: '🛢️', bad: true, desc: 'Fogo causa +50% e incendeia.' },
  resfriado: { label: 'Resfriado', icon: '❄️', bad: true, desc: '3 acúmulos congelam.' },
  congelado: { label: 'Congelado', icon: '🧊', bad: true, control: true, desc: 'Perde ações; recebe +25% de dano físico.' },
  provocado: { label: 'Provocado', icon: '😠', bad: true, desc: 'Precisa atacar quem provocou.' },
  acelerado: { label: 'Acelerado', icon: '⏩', bad: false, desc: 'Recargas caem mais rápido.' },
  indestrutivel: { label: 'Indestrutível', icon: '✨', bad: false, desc: 'Não cai abaixo de 1 de vida.' },
  contra_ataque: { label: 'Contra-ataque', icon: '⚔️', bad: false, desc: 'Responde a golpes corpo a corpo.' },
  redirecionar: { label: 'Redirecionar', icon: '🌀', bad: false, desc: 'Devolve o próximo ataque.' },
  interceptado: { label: 'Protegido', icon: '🤝', bad: false, desc: 'Um aliado recebe parte dos golpes.' },
  forma_urso: { label: 'Forma de Urso', icon: '🐻', bad: false, desc: 'Recebe menos dano.' },
  forma_pantera: { label: 'Forma de Pantera', icon: '🐆', bad: false, desc: 'Mais dano e crítico.' },
  forma_ceifador: { label: 'Ceifador', icon: '💀', bad: false, desc: 'Mais dano e roubo de vida.' },
  determinacao: { label: 'Determinação', icon: '🔰', bad: false, desc: 'Menos dano recebido e mais dano causado.' },
  firmeza: { label: 'Firmeza', icon: '🗿', bad: false, desc: 'Imune a controle.' },
  detonacao: { label: 'Carga', icon: '💣', bad: true, desc: 'Explode quando a duração acabar.' },
  casulo: { label: 'Casulo', icon: '🕸️', bad: true, control: true, desc: 'Preso até o casulo ser destruído.' },
  exposto: { label: 'Exposto', icon: '🎯', bad: true, desc: 'A carapaça está aberta.' },
  duelo: { label: 'Duelo', icon: '🤺', bad: false, desc: 'Vantagem contra o desafiado.' },
  refletir: { label: 'Reflexo', icon: '🪞', bad: false, desc: 'Reflete parte do dano.' },
  imune_fisico: { label: 'Absorve físico', icon: '🔴', bad: false, desc: 'Dano físico o cura.' },
  imune_magico: { label: 'Absorve magia', icon: '🔵', bad: false, desc: 'Dano mágico o cura.' },
  geada: { label: 'Geada', icon: '🌨️', bad: true, desc: 'Acumula até congelar.' },
  esporos: { label: 'Esporos', icon: '🍄', bad: true, desc: 'Acumulam até envenenar e confundir.' },
  combo: { label: 'Combo', icon: '🔗', bad: false, desc: 'Encadeamento de golpes.' },
};
