import type { AttributeId } from './types.ts';

/** Tipos de evento que um caminho pode revelar durante a exploração. */
export type ExploreEventKind = 'combate' | 'variante' | 'coleta' | 'ruina' | 'bau' | 'armadilha' | 'rastro' | 'descanso' | 'viajante' | 'covil';

export const EVENT_INFO: Record<ExploreEventKind, { label: string; hint: string; weight: number }> = {
  combate: { label: 'Criaturas', hint: 'Movimento entre os arbustos.', weight: 30 },
  variante: { label: 'Criatura incomum', hint: 'Rastros grandes demais para o normal.', weight: 6 },
  coleta: { label: 'Recursos', hint: 'Algo útil cresce ou brilha por ali.', weight: 18 },
  ruina: { label: 'Ruína', hint: 'Pedras talhadas despontam do chão.', weight: 9 },
  bau: { label: 'Esconderijo', hint: 'Um volume coberto por folhas e lona.', weight: 7 },
  armadilha: { label: 'Perigo', hint: 'O caminho parece estreito e instável.', weight: 8 },
  rastro: { label: 'Rastro', hint: 'Marcas antigas levam para longe da trilha.', weight: 10 },
  descanso: { label: 'Abrigo', hint: 'Um lugar protegido do vento.', weight: 7 },
  viajante: { label: 'Viajante', hint: 'Fumaça de uma pequena fogueira.', weight: 5 },
  covil: { label: 'Covil', hint: 'Um silêncio pesado. Até os pássaros evitam o lugar.', weight: 0 },
};

/** Nomes de caminhos por região, para dar identidade às escolhas. */
export const PATH_NAMES: Record<string, string[]> = {
  bosque: ['Trilha das Samambaias', 'Margem do Riacho', 'Clareira Musgosa', 'Tronco Oco', 'Vale das Raízes', 'Pedra dos Corvos'],
  planicies: ['Fenda Ventosa', 'Estrada das Caravanas', 'Capinzal Alto', 'Colina dos Bisões', 'Moinho Quebrado', 'Poço Seco'],
  minas: ['Galeria Norte', 'Poço de Elevação', 'Trilhos Tortos', 'Câmara Inundada', 'Veio Exposto', 'Escadaria Anã'],
  pantano: ['Passarela Podre', 'Ilha dos Juncos', 'Lagoa Negra', 'Palafitas Abandonadas', 'Bosque Afogado', 'Altar Musgoso'],
  deserto: ['Dunas de Vidro', 'Cânion Seco', 'Ruína Soterrada', 'Oásis Falso', 'Trilha dos Ossos', 'Pilar Solitário'],
  montanhas: ['Passagem Estreita', 'Ponte de Corda', 'Encosta Nevada', 'Caverna do Eco', 'Ninho Antigo', 'Mosteiro em Ruínas'],
  tundra: ['Lago Congelado', 'Campo de Gelo', 'Floresta Branca', 'Abrigo de Pedra', 'Rachadura Azul', 'Acampamento Esquecido'],
  costa: ['Cais Afundado', 'Praia de Destroços', 'Farol Apagado', 'Gruta das Marés', 'Recife Exposto', 'Vila Pesqueira'],
  ruinas: ['Avenida Imperial', 'Biblioteca Desabada', 'Quartel Vazio', 'Jardim Suspenso', 'Arena Antiga', 'Catacumbas'],
  fungica: ['Trilha Luminosa', 'Chapéus Gigantes', 'Lago de Esporos', 'Tronco Colonizado', 'Câmara do Micélio', 'Raízes Pulsantes'],
  fendas: ['Ponte de Basalto', 'Rio de Lava', 'Gêiser Rubro', 'Forja Abandonada', 'Campo de Cinzas', 'Câmara de Obsidiana'],
  veu: ['Caminho Dobrado', 'Ilha Flutuante', 'Espelho do Céu', 'Ruína Repetida', 'Fenda Menor', 'Silêncio Branco'],
};

/** Testes de atributo usados em ruínas, baús e armadilhas. */
export const CHECKS: Record<'ruina' | 'bau' | 'armadilha', { attr: AttributeId; alt: AttributeId; text: string; success: string; fail: string }[]> = {
  ruina: [
    { attr: 'intelecto', alt: 'percepcao', text: 'Inscrições antigas cobrem uma porta selada.', success: 'Vocês decifram o mecanismo e a porta se abre.', fail: 'Os símbolos não fazem sentido. A porta continua fechada.' },
    { attr: 'forca', alt: 'vigor', text: 'Uma laje pesada bloqueia uma câmara.', success: 'A laje cede com um rangido.', fail: 'A laje não se move.' },
    { attr: 'espirito', alt: 'intelecto', text: 'Um altar vibra com energia do Véu.', success: 'Vocês acalmam a energia e recolhem o que restou.', fail: 'A energia explode em faíscas.' },
  ],
  bau: [
    { attr: 'percepcao', alt: 'destreza', text: 'Um baú com fechadura enferrujada — e um fio suspeito.', success: 'Vocês desarmam a armadilha e abrem o baú.', fail: 'Uma agulha envenenada salta do fecho.' },
    { attr: 'destreza', alt: 'intelecto', text: 'Uma caixa trancada com mecanismo delicado.', success: 'Clique. Aberta.', fail: 'O mecanismo trava e algo se quebra lá dentro.' },
  ],
  armadilha: [
    { attr: 'destreza', alt: 'percepcao', text: 'O chão cede sob seus pés!', success: 'Você salta a tempo.', fail: 'Você cai e se machuca.' },
    { attr: 'percepcao', alt: 'destreza', text: 'Um zumbido estranho vem dos arbustos.', success: 'Você percebe o ninho e contorna.', fail: 'Um enxame cai sobre você.' },
    { attr: 'vigor', alt: 'forca', text: 'Gases sobem de uma fenda no chão.', success: 'Você prende a respiração e atravessa.', fail: 'O gás queima seus pulmões.' },
  ],
};

export const EXPLORATION_STEPS = 6;
/** Fração da mochila de expedição perdida em uma derrota solo. */
export const DEFEAT_LOSS = 0.5;

/** Descobertas raras: combinações de local, clima e preparação. */
export interface RareDiscovery {
  id: string; name: string; desc: string; region: string; weather?: string;
  requires?: { profession?: [string, number]; item?: string; race?: string; sense?: string; attr?: [AttributeId, number] };
  chance: number;
  reward: { title?: string; items?: [string, number][]; visual?: string; recipe?: string };
}
export const RARE_DISCOVERIES: RareDiscovery[] = [
  { id: 'orquidea-eco', name: 'Orquídea do Eco', desc: 'Uma flor que só abre na névoa das montanhas, repetindo o som do vento.', region: 'montanhas', weather: 'nevoa', requires: { profession: ['herbalismo', 30] }, chance: 0.15, reward: { title: 'Ouvinte do Eco', items: [['eco-cristalizado', 3]] } },
  { id: 'peixe-aurora', name: 'Peixe da Aurora', desc: 'Sobe à superfície do lago congelado apenas sob a aurora.', region: 'tundra', weather: 'aurora', requires: { profession: ['pesca', 40] }, chance: 0.15, reward: { title: 'Pescador da Aurora', items: [['perola', 2]] } },
  { id: 'veio-cantante', name: 'Veio Cantante', desc: 'Durante tremores, um veio de prata canta. Anões o ouvem melhor.', region: 'minas', weather: 'tremor', requires: { race: 'anao' }, chance: 0.2, reward: { items: [['minerio-prata', 6], ['rubi', 1]], title: 'Ouvido de Pedra' } },
  { id: 'farol-aceso', name: 'O Farol Aceso', desc: 'Na tempestade, o farol apagado volta a brilhar por um instante.', region: 'costa', weather: 'tempestade', requires: { attr: ['percepcao', 25] }, chance: 0.12, reward: { title: 'Guardião do Farol', visual: 'brigandina-mares' } },
  { id: 'eclipse-imperial', name: 'Sala do Eclipse', desc: 'Uma câmara imperial que só se revela durante o eclipse.', region: 'ruinas', weather: 'eclipse', requires: { attr: ['intelecto', 30] }, chance: 0.15, reward: { items: [['fragmento-imperial', 4], ['pagina-proibida', 1]], title: 'Arquivista do Eclipse' } },
  { id: 'ninho-fenix', name: 'Ninho de Cinzas', desc: 'Durante a erupção, um ninho brilha entre a lava.', region: 'fendas', weather: 'erupcao', requires: { item: 'pocao-res-fogo' }, chance: 0.12, reward: { items: [['brasa-viva', 4], ['pena', 10]], title: 'Filho das Cinzas' } },
  { id: 'lua-dupla', name: 'Lua Dupla', desc: 'No silêncio absoluto, duas luas aparecem no céu do Véu.', region: 'veu', weather: 'silencio', requires: { race: 'umbrino' }, chance: 0.2, reward: { title: 'Vidente da Lua Dupla', items: [['lagrima-veu', 1]] } },
  { id: 'trilha-perfumada', name: 'Trilha Perfumada', desc: 'Depois da chuva, um faro aguçado encontra o caminho até uma clareira secreta.', region: 'bosque', weather: 'chuva', requires: { sense: 'olfato' }, chance: 0.25, reward: { items: [['seiva-antiga', 3]], title: 'Nariz do Bosque' } },
  { id: 'esporo-dourado', name: 'Esporo Dourado', desc: 'Na nuvem de esporos, um cogumelo dourado brilha por segundos.', region: 'fungica', weather: 'esporos', requires: { profession: ['herbalismo', 55] }, chance: 0.12, reward: { items: [['micelio-luminoso', 4]], title: 'Colhedor Dourado' } },
  { id: 'miragem', name: 'Miragem Verdadeira', desc: 'No calor extremo, uma miragem leva a um oásis real.', region: 'deserto', weather: 'calor-extremo', requires: { item: 'cha-gelado' }, chance: 0.2, reward: { items: [['peixe-vidro', 4], ['areia-vidro', 3]], title: 'Andarilho da Miragem' } },
];
