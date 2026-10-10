import type { MonsterAbility, MonsterTarget, MonsterTrait } from '../types.ts';
import { dmg, st } from '../classes/helpers.ts';

export type VariantMechanic =
  | 'lideranca' | 'carapaca' | 'caca' | 'instabilidade' | 'drenagem'
  | 'regeneracao' | 'controle' | 'protecao' | 'transformacao' | 'invocacao';

export const MECHANIC_INFO: Record<VariantMechanic, { label: string; desc: string; hint: string }> = {
  lideranca: { label: 'Liderança', desc: 'Coordenam ou fortalecem aliados.', hint: 'Derrube o líder primeiro: os aliados perdem o bônus.' },
  carapaca: { label: 'Carapaça', desc: 'Exigem exposição de pontos frágeis.', hint: 'Golpes de quebra ou o momento após um ataque carregado expõem a criatura.' },
  caca: { label: 'Caça tática', desc: 'Priorizam determinados alvos e posições.', hint: 'Proteja a retaguarda: interceptação e provocação mudam o alvo.' },
  instabilidade: { label: 'Instabilidade', desc: 'Geram consequências perigosas ao sofrer dano ou morrer.', hint: 'Recue a linha de frente antes do golpe final ou mate-a com escudos ativos.' },
  drenagem: { label: 'Drenagem', desc: 'Roubam vida, recursos ou proteções.', hint: 'Controle e dano rápido reduzem o quanto ela drena.' },
  regeneracao: { label: 'Regeneração', desc: 'Exigem interromper sua recuperação.', hint: 'Queimadura, sangramento ou interrupções impedem a regeneração.' },
  controle: { label: 'Controle', desc: 'Imobilizam, deslocam ou perturbam ações.', hint: 'Firmeza, purificação e posicionamento reduzem o controle.' },
  protecao: { label: 'Proteção', desc: 'Protegem aliados ou respondem a tipos de ataque.', hint: 'Observe o que ela reflete e troque o tipo de dano.' },
  transformacao: { label: 'Transformação', desc: 'Mudam de comportamento durante a luta.', hint: 'Prepare-se para a segunda fase antes de chegar a metade da vida.' },
  invocacao: { label: 'Invocação', desc: 'Criam reforços ou objetos prioritários.', hint: 'Elimine a fonte das invocações ou os objetos prioritários.' },
};

export interface VariantSpec {
  id: string; name: string; base: string; mechanic: VariantMechanic; habit: string;
  colors?: [string, string];
  abilities?: MonsterAbility[];
  traits?: MonsterTrait[];
  targeting?: MonsterTarget;
  summon?: string;
  phase2?: MonsterAbility[];
  tameable?: boolean;
}

const A = (id: string, name: string, telegraph: string, o: Partial<MonsterAbility> & Pick<MonsterAbility, 'effects' | 'target'>): MonsterAbility =>
  ({ id, name, telegraph, range: 'corpo', weight: 1, ...o });

const comando = (name: string) => A('comando', name, '{n} organiza o grupo.', { target: 'aliados', range: 'distancia', effects: [st('fortalecido', 2, { potency: 25 }), st('fortificado', 2, { potency: 15 })], cooldown: 3, weight: 2 });
const exposto = (name: string, atk = 1.8) => A('golpe-carregado', name, '{n} recua e prepara um golpe devastador contra {a}. Depois dele, ficará exposto.', { target: 'ameaca', charge: 1, interruptible: true, effects: [dmg(0, {}, 'fisico', { atk }), { k: 'expor', dur: 2, on: 'si' }], cooldown: 3, weight: 2 });
const explosao = (name: string, elem: 'fogo' | 'veneno' | 'sombra' | 'arcano' | 'fisico' = 'veneno') => A('instavel', name, '{n} pulsa de forma instável.', { target: 'linha_frente', range: 'distancia', effects: [dmg(0, {}, elem, { atk: 0.7 })], cooldown: 2 });
const dreno = (name: string, elem: 'fisico' | 'sombra' | 'arcano' = 'fisico') => A('dreno', name, '{n} se fixa em {a} para drenar.', { target: 'menor_vida', effects: [dmg(0, {}, elem, { atk: 1.0, lifesteal: 0.6 }), { k: 'recurso', amount: -15 }, { k: 'dissipar', count: 1 }], weight: 2 });
const controle = (name: string, telegraph: string, effects: MonsterAbility['effects'], target: MonsterTarget = 'aleatorio') =>
  A('controle', name, telegraph, { target, range: 'distancia', effects, cooldown: 3, weight: 2 });
const protecao = (name: string) => A('protecao', name, '{n} ergue uma barreira sobre os aliados.', { target: 'aliados', range: 'distancia', effects: [{ k: 'escudo', power: 0, scale: {}, dur: 2 }, st('fortificado', 1, { potency: 20 })], cooldown: 3, weight: 2 });

export const VARIANT_SPECS: VariantSpec[] = [
  // ---------------- Liderança
  { id: 'lobo-alfa', name: 'Lobo Alfa', base: 'lobo-cinzento', mechanic: 'lideranca', habit: 'Coordena a matilha com uivos curtos; sem ele, os lobos hesitam.', colors: ['#5a5a62', '#e0e0e0'], abilities: [comando('Uivo de Comando')], traits: ['lideranca'], tameable: true },
  { id: 'goblin-porta-estandarte', name: 'Goblin Porta-Estandarte', base: 'goblin-batedor', mechanic: 'lideranca', habit: 'Enquanto o estandarte estiver de pé, os goblins não fogem.', abilities: [comando('Erguer Estandarte')], traits: ['lideranca'] },
  { id: 'gnoll-capitao', name: 'Gnoll Capitão', base: 'gnoll-saqueador', mechanic: 'lideranca', habit: 'Divide os saques por bravura — e pune covardes.', abilities: [comando('Ordem de Saque'), A('chicote', 'Chicotada', '{n} estala o chicote na direção de {a}.', { target: 'retaguarda', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 1.0 })] })], traits: ['lideranca'] },
  { id: 'miconide-patriarca', name: 'Micônide Patriarca', base: 'miconide-coletor', mechanic: 'lideranca', habit: 'Fala pela colônia através de esporos.', abilities: [comando('Esporos de Comando')], traits: ['lideranca'] },
  { id: 'kobold-supervisor', name: 'Kobold Supervisor', base: 'kobold-mineiro', mechanic: 'lideranca', habit: 'Grita ordens e conta cada pepita.', abilities: [comando('Apito de Turno')], traits: ['lideranca'] },
  // ---------------- Carapaça
  { id: 'javali-encouracado', name: 'Javali Encouraçado', base: 'javali-presas', mechanic: 'carapaca', habit: 'Couro endurecido por lama e resina.', colors: ['#5a4a3a', '#a0a0a0'], abilities: [exposto('Investida Encouraçada')], traits: ['carapaca'], tameable: true },
  { id: 'caranguejo-aco', name: 'Caranguejo de Aço', base: 'caranguejo-minerio', mechanic: 'carapaca', habit: 'Carapaça forjada pelo minério que comeu.', colors: ['#a0a0b0', '#5a5a6a'], abilities: [exposto('Pinçada Esmagadora')], traits: ['carapaca'] },
  { id: 'golem-veios-densos', name: 'Golem de Veios Densos', base: 'golem-rachado', mechanic: 'carapaca', habit: 'Veios de metal reforçam cada rachadura.', abilities: [exposto('Martelo de Pedra', 2.0)], traits: ['carapaca'] },
  { id: 'escaravelho-diamantino', name: 'Escaravelho Diamantino', base: 'escaravelho-solar', mechanic: 'carapaca', habit: 'Uma carapaça que refrata a luz em lâminas.', colors: ['#e0f0ff', '#a0c0e0'], abilities: [exposto('Clarão Cortante')], traits: ['carapaca'] },
  { id: 'tartaruga-fortaleza', name: 'Tartaruga Fortaleza', base: 'tartaruga-espinhos', mechanic: 'carapaca', habit: 'Algas, corais e espinhos — uma ilha que anda.', abilities: [exposto('Pisão da Maré', 2.0)], traits: ['carapaca'] },
  // ---------------- Caça tática
  { id: 'aranha-emboscadora', name: 'Aranha Emboscadora', base: 'aranha-musgo', mechanic: 'caca', habit: 'Sempre ataca quem está sozinho na retaguarda.', targeting: 'retaguarda', abilities: [A('emboscada', 'Emboscada', '{n} desaparece no teto, mirando {a}.', { target: 'retaguarda', effects: [dmg(0, {}, 'veneno', { atk: 1.4 }), st('enraizado', 1)], weight: 2 })], traits: ['caca'], tameable: true },
  { id: 'harpia-caca-magos', name: 'Harpia Caça-Magos', base: 'harpia-cinzenta', mechanic: 'caca', habit: 'Reconhece o cheiro de mana e mergulha sobre conjuradores.', targeting: 'conjurador', abilities: [A('mergulho', 'Mergulho', '{n} sobe alto, mirando quem conjura: {a}.', { target: 'conjurador', range: 'distancia', effects: [dmg(0, {}, 'fisico', { atk: 1.4 }), st('silenciado', 1)], weight: 2 })], traits: ['caca'] },
  { id: 'sombra-perseguidora', name: 'Sombra Perseguidora', base: 'sombra-errante', mechanic: 'caca', habit: 'Segue o mais ferido até que caia.', targeting: 'menor_vida', abilities: [A('perseguir', 'Perseguir', '{n} se estica até {a}.', { target: 'menor_vida', effects: [dmg(0, {}, 'sombra', { atk: 1.3, pierce: 0.4 })], weight: 2 })], traits: ['caca'] },
  { id: 'serpente-estranguladora', name: 'Serpente Estranguladora', base: 'serpente-brejo', mechanic: 'caca', habit: 'Prefere curandeiros — sem eles, a presa cai mais rápido.', targeting: 'curandeiro', abilities: [A('estrangular', 'Estrangular', '{n} se enrola em direção a {a}.', { target: 'curandeiro', effects: [dmg(0, {}, 'fisico', { atk: 1.0 }), st('silenciado', 1), st('enraizado', 2)], weight: 2 })], traits: ['caca'], tameable: true },
  { id: 'cao-farejador-mana', name: 'Cão Farejador de Mana', base: 'cao-espectral', mechanic: 'caca', habit: 'Fareja magia e morde quem a carrega.', targeting: 'conjurador', abilities: [A('farejar', 'Mordida Antimagia', '{n} fareja {a}.', { target: 'conjurador', effects: [dmg(0, {}, 'sombra', { atk: 1.2 }), { k: 'recurso', amount: -25 }], weight: 2 })], traits: ['caca'] },
  // ---------------- Instabilidade
  { id: 'slime-volatil', name: 'Slime Volátil', base: 'slime-verde', mechanic: 'instabilidade', habit: 'Explode em ácido quando estoura.', colors: ['#f0e040', '#a0c030'], abilities: [explosao('Respingo Ácido')], traits: ['instabilidade'] },
  { id: 'fungo-esporos-negros', name: 'Fungo de Esporos Negros', base: 'fungo-ambulante', mechanic: 'instabilidade', habit: 'Sua morte libera uma nuvem que cega.', colors: ['#3a2a3a', '#7a5a7a'], abilities: [explosao('Esporos Negros', 'sombra')], traits: ['instabilidade'] },
  { id: 'elemental-nucleo-partido', name: 'Elemental de Núcleo Partido', base: 'elemental-brasa', mechanic: 'instabilidade', habit: 'O núcleo rachado vaza energia a cada golpe.', abilities: [explosao('Vazamento de Núcleo', 'fogo')], traits: ['instabilidade'] },
  { id: 'cadaver-pestilento', name: 'Cadáver Pestilento', base: 'cadaver-colonizado', mechanic: 'instabilidade', habit: 'Inchado de esporos, prestes a romper.', abilities: [explosao('Golfada Pestilenta')], traits: ['instabilidade'] },
  { id: 'escorpiao-sangue-acido', name: 'Escorpião de Sangue Ácido', base: 'escorpiao-vidro', mechanic: 'instabilidade', habit: 'Cada ferida jorra ácido em quem está perto.', abilities: [explosao('Sangue Ácido')], traits: ['instabilidade'] },
  // ---------------- Drenagem
  { id: 'sanguessuga-carmesim', name: 'Sanguessuga Carmesim', base: 'sanguessuga-gigante', mechanic: 'drenagem', habit: 'Cresce a cada gole.', colors: ['#a02030', '#f06060'], abilities: [dreno('Sucção Carmesim')], traits: ['drenagem'] },
  { id: 'parasita-anciao', name: 'Parasita Ancião', base: 'parasita-mana', mechanic: 'drenagem', habit: 'Séculos bebendo magia o tornaram imenso.', abilities: [dreno('Sifão de Mana', 'arcano')], traits: ['drenagem'] },
  { id: 'tomo-sifonador', name: 'Tomo Sifonador', base: 'tomo-mordedor', mechanic: 'drenagem', habit: 'Absorve feitiços — e os escreve em suas páginas.', abilities: [dreno('Absorver Feitiço', 'arcano')], traits: ['drenagem'] },
  { id: 'espectro-sedento', name: 'Espectro Sedento', base: 'espectro-congelado', mechanic: 'drenagem', habit: 'Rouba o calor dos vivos.', abilities: [dreno('Toque Sedento', 'sombra')], traits: ['drenagem'] },
  { id: 'coral-vampirico', name: 'Coral Vampírico', base: 'coral-vivo', mechanic: 'drenagem', habit: 'Seus ramos perfuram e sugam.', abilities: [dreno('Ramos Sugadores')], traits: ['drenagem'] },
  // ---------------- Regeneração
  { id: 'troll-musgoso', name: 'Troll Musgoso', base: 'troll-serrano', mechanic: 'regeneracao', habit: 'O musgo fecha qualquer ferida que não queime.', colors: ['#4a7a3a', '#2a4a2a'], traits: ['regeneracao'] },
  { id: 'tronco-seiva-rubra', name: 'Tronco de Seiva Rubra', base: 'tronco-parasitado', mechanic: 'regeneracao', habit: 'Seiva vermelha escorre e solidifica sobre os cortes.', colors: ['#7a2a2a', '#c04040'], traits: ['regeneracao'] },
  { id: 'hidra-jovem', name: 'Hidra Jovem', base: 'serpente-brejo', mechanic: 'regeneracao', habit: 'Ainda tem só três cabeças — por enquanto.', colors: ['#3a7a5a', '#a0e0a0'], abilities: [A('tres-mordidas', 'Três Mordidas', '{n} ergue as três cabeças contra {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fisico', { atk: 0.6, hits: 3 })], weight: 2 })], traits: ['regeneracao'] },
  { id: 'zumbi-raizes', name: 'Zumbi de Raízes', base: 'zumbi-encharcado', mechanic: 'regeneracao', habit: 'Raízes costuram a carne de volta.', traits: ['regeneracao'] },
  { id: 'lagarto-renovador', name: 'Lagarto Renovador', base: 'lagarto-quartzo', mechanic: 'regeneracao', habit: 'Troca de pele no meio do combate.', traits: ['regeneracao'], tameable: true },
  // ---------------- Controle
  { id: 'sereia-hipnotica', name: 'Sereia Hipnótica', base: 'sereia-hostil', mechanic: 'controle', habit: 'Seu canto faz aliados se atacarem.', abilities: [controle('Canto Hipnótico', '{n} começa um canto hipnótico para {a}.', [st('confuso', 2)])], traits: ['controle'] },
  { id: 'basilisco-olhos-gemeos', name: 'Basilisco de Olhos Gêmeos', base: 'basilisco-menor', mechanic: 'controle', habit: 'Dois olhares: um paralisa, o outro petrifica.', abilities: [controle('Olhar Petrificante', '{n} abre os dois olhos para {a}. Desvie o olhar!', [st('atordoado', 1), st('lento', 2)])], traits: ['controle'] },
  { id: 'aranha-tecela-gelo', name: 'Aranha Tecelã de Gelo', base: 'aranha-geada', mechanic: 'controle', habit: 'Tece prisões de gelo ao redor da presa.', abilities: [controle('Casulo de Gelo', '{n} tece fios gelados ao redor de {a}.', [st('resfriado', 3, { stacks: 2 }), st('enraizado', 2)])], traits: ['controle'] },
  { id: 'marionete-condutora', name: 'Marionete Condutora', base: 'marionete-guerra', mechanic: 'controle', habit: 'Puxa fios que deslocam os inimigos.', abilities: [controle('Puxar Fios', '{n} estende fios até {a}.', [{ k: 'mover', to: 'trocar' }, st('lento', 1)])], traits: ['controle'] },
  { id: 'observador-psiquico', name: 'Observador Psíquico', base: 'observador-menor', mechanic: 'controle', habit: 'Seu olhar silencia e confunde.', abilities: [controle('Olhar Psíquico', '{n} foca todos os olhos em {a}.', [st('silenciado', 2), dmg(0, {}, 'arcano', { atk: 0.8 })], 'conjurador')], traits: ['controle'] },
  // ---------------- Proteção
  { id: 'esqueleto-escudeiro', name: 'Esqueleto Escudeiro', base: 'esqueleto-soldado', mechanic: 'protecao', habit: 'Ergue o escudo sobre o aliado mais ferido.', abilities: [protecao('Escudo Erguido')], traits: ['protecao'] },
  { id: 'guardiao-espelhado', name: 'Guardião Espelhado', base: 'guardiao-bronze', mechanic: 'protecao', habit: 'Superfície espelhada devolve magia ao conjurador.', colors: ['#e0e8f0', '#8090a0'], abilities: [protecao('Reflexo Protetor')], traits: ['protecao', 'reflete_magia'] },
  { id: 'gargula-runica', name: 'Gárgula Rúnica', base: 'gargula-rachada', mechanic: 'protecao', habit: 'Runas gravadas devolvem golpes físicos.', abilities: [protecao('Runa Guardiã')], traits: ['protecao', 'reflete_fisico'] },
  { id: 'umbral-protetor', name: 'Umbral Protetor', base: 'sentinela-vazia', mechanic: 'protecao', habit: 'Uma porta viva que se fecha diante dos aliados.', abilities: [protecao('Fechar Umbral')], traits: ['protecao'] },
  { id: 'elemental-prismatico', name: 'Elemental Prismático', base: 'elemental-gelo', mechanic: 'protecao', habit: 'Muda de cor conforme o elemento que o atinge, e passa a resisti-lo.', colors: ['#f0a0ff', '#a0f0ff'], abilities: [protecao('Prisma')], traits: ['protecao'] },
  // ---------------- Transformação
  { id: 'urso-duas-estacoes', name: 'Urso das Duas Estações', base: 'urso-glacial', mechanic: 'transformacao', habit: 'Metade inverno, metade verão: muda ao ser ferido.', colors: ['#e0f0f8', '#c06030'], traits: ['transformacao'], phase2: [A('furia-verao', 'Fúria do Verão', '{n} incendeia o pelo e avança sobre {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'fogo', { atk: 1.5 }), st('queimadura', 2, { potency: 0 })], weight: 3 })], tameable: true },
  { id: 'mumia-desperta', name: 'Múmia Desperta', base: 'mumia-errante', mechanic: 'transformacao', habit: 'As bandagens caem e revelam um antigo sacerdote.', traits: ['transformacao'], phase2: [A('maldicao-faraonica', 'Maldição Faraônica', '{n} ergue as mãos e amaldiçoa {a}.', { target: 'conjurador', range: 'distancia', effects: [dmg(0, {}, 'sombra', { atk: 1.3 }), st('decadencia', 3, { potency: 0 })], weight: 3 })] },
  { id: 'cavaleiro-armadura-partida', name: 'Cavaleiro da Armadura Partida', base: 'cavaleiro-oco', mechanic: 'transformacao', habit: 'Quando a armadura se parte, a fúria escapa.', traits: ['transformacao'], phase2: [A('furia-partida', 'Fúria Partida', '{n} solta a armadura em pedaços e avança contra {a}.', { target: 'ameaca', effects: [dmg(0, {}, 'sombra', { atk: 0.8, hits: 2 })], weight: 3 })] },
  { id: 'salamandra-incandescente', name: 'Salamandra Incandescente', base: 'salamandra-fogo', mechanic: 'transformacao', habit: 'Quando ferida, o corpo vira chama pura.', traits: ['transformacao'], phase2: [A('corpo-chama', 'Corpo de Chama', '{n} brilha branco. Toda a linha de frente queimará.', { target: 'linha_frente', range: 'distancia', effects: [dmg(0, {}, 'fogo', { atk: 1.1 }), st('queimadura', 2, { potency: 0 })], weight: 3 })] },
  { id: 'devorador-metamorfico', name: 'Devorador Metamórfico', base: 'devorador-ecos', mechanic: 'transformacao', habit: 'Copia a forma do último que o feriu.', traits: ['transformacao'], phase2: [A('forma-copiada', 'Forma Copiada', '{n} assume uma forma familiar diante de {a}.', { target: 'aleatorio', effects: [dmg(0, {}, 'arcano', { atk: 1.4 }), { k: 'dissipar', count: 1 }], weight: 3 })] },
  // ---------------- Invocação
  { id: 'rainha-vespa-menor', name: 'Rainha Vespa Menor', base: 'vespa-gigante', mechanic: 'invocacao', habit: 'Põe ovos que eclodem em segundos.', summon: 'vespa-gigante', traits: ['invocacao'] },
  { id: 'rato-ninhador', name: 'Rato Ninhador', base: 'rato-escavador', mechanic: 'invocacao', habit: 'Onde há um, logo há vinte.', summon: 'rato-escavador', traits: ['invocacao'], tameable: true },
  { id: 'necromante-errante', name: 'Necromante Errante', base: 'esqueleto-soldado', mechanic: 'invocacao', habit: 'Um aventureiro que encontrou o poder errado.', colors: ['#3a2a4a', '#a070d0'], summon: 'esqueleto-soldado', traits: ['invocacao'] },
  { id: 'miconide-semeador', name: 'Micônide Semeador', base: 'miconide-coletor', mechanic: 'invocacao', habit: 'Planta esporos que brotam em fungos explosivos.', summon: 'fungo-explosivo', traits: ['invocacao'] },
  { id: 'sentinela-fragmentos', name: 'Sentinela de Fragmentos', base: 'fragmento-vivo', mechanic: 'invocacao', habit: 'Cria cristais que ampliam seu poder enquanto existirem.', summon: 'fragmento-vivo', traits: ['invocacao'] },
];
