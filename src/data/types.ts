// Tipos compartilhados entre os dados do jogo (conteúdo) e a lógica (motor).
// Os arquivos em src/data descrevem O QUE existe; src/game decide COMO funciona.

export const ATTRIBUTES = ['vigor', 'forca', 'destreza', 'intelecto', 'espirito', 'percepcao'] as const;
export type AttributeId = (typeof ATTRIBUTES)[number];
export type AttrScale = Partial<Record<AttributeId, number>>;

/** Tipos de dano. "fisico" é mitigado por armadura; os demais por resistência. */
export const ELEMENTS = ['fisico', 'fogo', 'gelo', 'raio', 'veneno', 'sombra', 'luz', 'arcano', 'natureza'] as const;
export type Element = (typeof ELEMENTS)[number];

/** Resistências a condições (diminuem duração e chance de aplicação). */
export const CONDITION_RESISTS = ['controle', 'toxina', 'mental'] as const;
export type ConditionResist = (typeof CONDITION_RESISTS)[number];

export type Line = 'frente' | 'tras';
export type Range = 'corpo' | 'distancia';

// ---------------------------------------------------------------- estados

export type StatusId =
  | 'fortalecido' | 'enfraquecido' | 'vulneravel' | 'fortificado' | 'evasivo' | 'cegueira'
  | 'lento' | 'enraizado' | 'atordoado' | 'silenciado' | 'confuso' | 'marcado' | 'oculto'
  | 'imagem' | 'sangramento' | 'veneno' | 'queimadura' | 'decadencia' | 'regeneracao'
  | 'molhado' | 'oleado' | 'resfriado' | 'congelado' | 'provocado' | 'acelerado'
  | 'indestrutivel' | 'contra_ataque' | 'redirecionar' | 'interceptado' | 'forma_urso'
  | 'forma_pantera' | 'forma_ceifador' | 'determinacao' | 'firmeza' | 'detonacao'
  | 'casulo' | 'exposto' | 'duelo' | 'refletir' | 'imune_fisico' | 'imune_magico'
  | 'geada' | 'esporos' | 'combo';

// ---------------------------------------------------------------- efeitos

/** Quem recebe o efeito, relativo ao alvo escolhido pela ação. */
export type EffectOn =
  | 'alvo'          // o alvo escolhido
  | 'si'            // quem usa
  | 'linha_alvo'    // todos na linha do alvo (mesmo lado do alvo)
  | 'inimigos'      // todos os inimigos de quem usa
  | 'aliados'       // todos os aliados de quem usa (inclui si)
  | 'linha_si'      // aliados na linha de quem usa
  | 'aleatorio'     // um inimigo aleatório por golpe
  | 'aliado_ferido'; // aliado com menor porcentagem de vida

export interface DamageEffect {
  k: 'dano';
  power: number;
  scale?: AttrScale;
  /** Multiplicador do dano da arma equipada. */
  weapon?: number;
  /** Multiplicador do ataque base (usado por monstros e lacaios). */
  atk?: number;
  elem: Element;
  on?: EffectOn;
  hits?: number;
  /** Fração de armadura/resistência ignorada (0..1). */
  pierce?: number;
  /** Fração do dano causado que vira cura. */
  lifesteal?: number;
  bonusVs?: { status?: StatusId; hpBelow?: number; tag?: string; charging?: boolean; mult: number };
  /** Ataques com quebra expõem carapaças. */
  breaks?: boolean;
  /** Custo em vida de quem usa (fração da vida máxima). */
  selfCost?: number;
}
export interface HealEffect { k: 'cura'; power: number; scale?: AttrScale; pctMax?: number; on?: EffectOn; revive?: boolean }
export interface ShieldEffect { k: 'escudo'; power: number; scale?: AttrScale; dur: number; on?: EffectOn }
export interface StatusEffect {
  k: 'status'; id: StatusId; dur: number; stacks?: number; chance?: number;
  /** Intensidade: % para modificadores, dano/cura por rodada para efeitos contínuos. */
  potency?: number; scale?: AttrScale; elem?: Element; on?: EffectOn;
}
export interface CleanseEffect { k: 'purificar'; count: number; on?: EffectOn }
export interface DispelEffect { k: 'dissipar'; count: number; on?: EffectOn }
export interface TauntEffect { k: 'provocar'; dur: number; on?: EffectOn }
export interface InterruptEffect { k: 'interromper'; on?: EffectOn }
export interface MoveEffect { k: 'mover'; to: Line | 'trocar'; on?: EffectOn }
export interface ResourceEffect { k: 'recurso'; amount: number; on?: EffectOn }
export interface SummonEffect { k: 'invocar'; minion: string; max: number; count?: number; temp?: number }
export interface InterceptEffect { k: 'interceptar'; ratio: number; dur: number; on?: EffectOn }
export interface ThreatEffect { k: 'ameaca'; amount: number }
export interface ExposeEffect { k: 'expor'; dur: number; on?: EffectOn }
export interface MeterEffect { k: 'medidor'; meter: string; amount: number }
export interface SwapLinesEffect { k: 'trocar_linhas'; side: 'inimigos' | 'aliados' }
export interface CocoonEffect { k: 'casulo'; dur: number; on?: EffectOn }
export interface CopySkillEffect { k: 'copiar_habilidade'; on?: EffectOn }
export interface FieldEffect { k: 'campo'; id: string; dur: number }
export interface MinionCommandEffect { k: 'comandar'; mult: number }
export interface CooldownEffect { k: 'recarga'; amount: number; on?: EffectOn }
export interface DetonateEffect { k: 'detonar_sangramento'; mult: number; on?: EffectOn }

export type Effect =
  | DamageEffect | HealEffect | ShieldEffect | StatusEffect | CleanseEffect | DispelEffect
  | TauntEffect | InterruptEffect | MoveEffect | ResourceEffect | SummonEffect | InterceptEffect
  | ThreatEffect | ExposeEffect | MeterEffect | SwapLinesEffect | CocoonEffect | CopySkillEffect
  | FieldEffect | MinionCommandEffect | CooldownEffect | DetonateEffect;

/** O que o jogador escolhe ao usar a habilidade. */
export type TargetKind = 'si' | 'inimigo' | 'aliado' | 'todos_inimigos' | 'todos_aliados' | 'linha_inimiga' | 'nenhum';

// ---------------------------------------------------------------- habilidades

export type IconKey = string;

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  cooldown: number;
  range: Range;
  target: TargetKind;
  effects: Effect[];
  icon: IconKey;
  /** Pode ser usada na linha de trás mesmo sendo corpo a corpo (lanças, investidas). */
  anyLine?: boolean;
  tags?: string[];
}

export type StatKey =
  | 'dano' | 'dano_magico' | 'dano_fisico' | 'dano_distancia' | 'cura' | 'cura_recebida'
  | 'critico' | 'dano_critico' | 'esquiva' | 'armadura' | 'vida' | 'iniciativa'
  | 'reducao_dano' | 'regen_recurso' | 'lacaios' | 'duracao_debuff' | 'resist_controle'
  | 'regen_vida' | 'precisao' | 'efeito_elemental' | 'dano_raio';

export type PassiveHook =
  | { t: 'stat'; stat: StatKey; value: number }
  | { t: 'ao_defender'; status: StatusId; stacks: number; max: number; potency: number }
  | { t: 'ao_abater'; recurso?: number; curaPct?: number }
  | { t: 'ao_receber_dano'; recurso?: number }
  | { t: 'ao_esquivar'; recurso?: number; status?: StatusId; potency?: number }
  | { t: 'ao_causar_dano'; recurso?: number; lifesteal?: number; elem?: Element; critOnly?: boolean }
  | { t: 'dano_vs_status'; status: StatusId; pct: number }
  | { t: 'dano_vida_perdida'; maxPct: number }
  | { t: 'dano_alvo_abaixo'; below: number; pct: number }
  | { t: 'combo'; pctPerLink: number; max: number }
  | { t: 'cura_excedente_escudo'; pct: number }
  | { t: 'linha_reducao'; pct: number }
  | { t: 'linha_precisao_inimiga'; pct: number }
  | { t: 'sem_recarga_chance'; pct: number }
  | { t: 'recurso_inicio_rodada'; amount: number }
  | { t: 'forma_bonus'; esquiva: number; recurso: number }
  | { t: 'retaguarda_distancia'; pct: number }
  | { t: 'acumulo_ao_usar'; status: StatusId; potency: number; max: number };

export interface PassiveDef { id: string; name: string; desc: string; hooks: PassiveHook[]; icon: IconKey }

/** Alterações que um modificador faz em uma habilidade (só vale com ela equipada). */
export interface SkillModDef {
  id: string;
  name: string;
  desc: string;
  skill: string;
  powerMult?: number;
  costDelta?: number;
  cooldownDelta?: number;
  target?: TargetKind;
  /** Efeitos extras anexados à habilidade. */
  add?: Effect[];
  /** Ajustes em efeitos existentes pelo índice. */
  patch?: { index: number; set: Partial<Record<string, unknown>> }[];
  icon: IconKey;
}

export interface TreeDef {
  id: string;
  name: string;
  desc: string;
  /** a1: inicial, f1: bifurcação, a2: intermediária, f2: bifurcação, p: passiva, a3: avançada, m3: conexão, c: culminante */
  a1: SkillDef; f1: [SkillModDef, SkillModDef];
  a2: SkillDef; f2: [SkillModDef, SkillModDef];
  p: PassiveDef;
  a3: SkillDef; m3: SkillModDef;
  c: SkillDef;
}

export interface ResourceDef {
  id: string; name: string; max: number; start: number; regen: number;
  onBasic?: number; onHurt?: number; onKill?: number; onDefend?: number; onDeathAny?: number;
  /** Mana cresce com intelecto, Fé com espírito. */
  maxPerAttr?: { attr: AttributeId; per: number };
}

export type ArmorClass = 'leve' | 'media' | 'pesada';

export interface ClassDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  resource: ResourceDef;
  armorTraining: ArmorClass;
  suggested: AttrScale;
  weapons: string[];
  fundamento: SkillDef;
  innate: PassiveDef;
  trees: [TreeDef, TreeDef, TreeDef];
  color: string;
}

// ---------------------------------------------------------------- monstros

export type MonsterTarget =
  | 'ameaca' | 'menor_vida' | 'retaguarda' | 'conjurador' | 'aleatorio' | 'linha_frente'
  | 'linha_tras' | 'todos' | 'si' | 'aliado_ferido' | 'aliados' | 'curandeiro';

export interface MonsterAbility {
  id: string;
  name: string;
  /** Texto anunciado na rodada anterior. {n} = nome do monstro, {a} = alvo. */
  telegraph: string;
  charge?: number;
  interruptible?: boolean;
  target: MonsterTarget;
  range: Range;
  effects: Effect[];
  weight?: number;
  cooldown?: number;
  hpBelow?: number;
  phase?: number;
  /** Golpes extras por objeto vivo com este id (espelhos do Faraó). */
  hitsPerObject?: string;
}

export type MonsterTrait =
  | 'lideranca' | 'carapaca' | 'caca' | 'instabilidade' | 'drenagem' | 'regeneracao'
  | 'controle' | 'protecao' | 'transformacao' | 'invocacao' | 'enxame' | 'voador'
  | 'regenera_sem_fogo' | 'reflete_magia' | 'reflete_fisico' | 'chefe';

export type MonsterRole = 'bruto' | 'agil' | 'conjurador' | 'tanque' | 'enxame' | 'suporte' | 'cacador';

export interface MonsterDef {
  id: string;
  name: string;
  region: string;
  family: string;
  shape: string;
  role: MonsterRole;
  level: number;
  rank: 'comum' | 'variante' | 'chefe';
  habit: string;
  colors: [string, string];
  elem: Element;
  weak: Element[];
  resist: Element[];
  tags: string[];
  traits: MonsterTrait[];
  abilities: MonsterAbility[];
  drops: { item: string; chance: number; min: number; max: number }[];
  tameable: boolean;
  /** Para variantes: a criatura comum de origem. */
  base?: string;
  hpMult: number;
  atkMult: number;
  armor: number;
  line: Line;
  xp: number;
}

export interface BossPhase {
  at: number; // fração de vida em que a fase começa
  text: string;
  field?: string;
  summon?: { minion: string; count: number }[];
  heal?: number;
  status?: { id: StatusId; dur: number; potency?: number }[];
}

export interface BossMeter {
  id: string; label: string; max: number; start: number; perRound: number;
  /** Ao chegar no máximo, executa a habilidade indicada e volta a este valor. */
  onFull: string; resetTo: number;
  /** Variação quando o chefe recebe dano de certos elementos. */
  elemDelta?: Partial<Record<Element, number>>;
  /** Acima deste valor, o chefe causa dano extra proporcional. */
  empowerAbove?: number;
}

/** Acúmulos que o chefe aplica nos jogadores (geada, esporos…). */
export interface BossStack {
  status: StatusId;
  perRound: number;
  threshold: number;
  effects: Effect[];
  /** Causar dano deste elemento remove acúmulos de quem atacou. */
  reduceOnElem?: { elem: Element; amount: number };
  /** Ser curado remove acúmulos. */
  reduceOnHeal?: number;
  /** Trocar de linha remove acúmulos. */
  reduceOnMove?: number;
  /** Só acumula na linha indicada pelo medidor de zona (alterna a cada 2 rodadas). */
  byLine?: boolean;
}

export interface BossDef extends MonsterDef {
  title: string;
  mechanic: string;
  reward: string;
  phases: BossPhase[];
  meters: BossMeter[];
  adds: string[];
  recipeUnlock?: string;
  partySuggested: number;
  /** Habilidades executadas em ordem fixa (padrão legível), em vez de sorteio. */
  rotation?: string[];
  /** Objetos/partes que surgem no início da luta. */
  start?: string[];
  stack?: BossStack;
}

export interface MinionDef {
  id: string; name: string; shape: string; colors: [string, string];
  hpPct: number; atkPct: number; line: Line; abilities: MonsterAbility[];
  armorPct?: number; taunts?: boolean; tags?: string[];
}

// ---------------------------------------------------------------- itens

export type ItemKind =
  | 'minerio' | 'lingote' | 'gema' | 'madeira' | 'tabua' | 'resina' | 'erva' | 'fungo'
  | 'peixe' | 'carne' | 'couro' | 'osso' | 'fibra' | 'tecido' | 'reagente' | 'monstro'
  | 'essencia' | 'pocao' | 'oleo' | 'comida' | 'suprimento' | 'ferramenta' | 'runa'
  | 'isca' | 'petisco' | 'mapa' | 'fragmento' | 'equipamento' | 'componente' | 'tesouro';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  tier: number;
  weight: number;
  value: number;
  icon: string;
  color: string;
  desc?: string;
  /** Não pode ser negociado (recompensas de marcos pessoais). */
  untradeable?: boolean;
  use?: ConsumableUse;
}

export type ConsumableUse =
  | { t: 'cura'; power: number; pct: number }
  | { t: 'recurso'; amount: number }
  | { t: 'purificar'; statuses: StatusId[]; resist?: number }
  | { t: 'resistencia'; elem: Element; amount: number; rounds: number }
  | { t: 'regeneracao'; power: number; rounds: number }
  | { t: 'visao'; hours: number }
  | { t: 'refeicao'; buff: MealBuff; minutes: number }
  | { t: 'oleo'; elem: Element; bonus: number; fights: number; status?: StatusId }
  | { t: 'isca'; bonus: number; maxTier: number }
  | { t: 'petisco'; loyalty: number; heal: number }
  | { t: 'racao'; hours: number }
  | { t: 'agua'; hours: number }
  | { t: 'celula'; hours: number }
  | { t: 'mapa'; region: string };

export interface MealBuff { label: string; stats: Partial<Record<StatKey | AttributeId, number>>; workYield?: number }
