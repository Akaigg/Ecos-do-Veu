import { itemById } from '../../data/items.ts';
import { Canvas, hex, light, shade, toHex } from '../canvas.ts';
import { M, renderRoles, RoleCanvas } from '../paint.ts';

/** Ícones 16×16: itens, equipamentos, ferramentas e símbolos de habilidades. */
type Icon = (r: RoleCanvas) => void;

export const ICONS: Record<string, Icon> = {
  // ---------------- materiais
  minerio: (r) => { r.poly([[2, 11], [5, 4], [11, 3], [14, 9], [11, 14], [4, 14]], M.DARK); r.circle(6, 8, 2, M.BASE); r.circle(10, 11, 1.5, M.BASE); r.dot(11, 6, M.BASE); },
  lingote: (r) => { r.poly([[1, 11], [4, 6], [15, 6], [13, 11]], M.BASE); r.poly([[1, 11], [13, 11], [13, 13], [1, 13]], M.BASE); r.line(5, 7, 13, 7, M.WHITE); },
  gema: (r) => { r.poly([[3, 6], [6, 3], [10, 3], [13, 6], [8, 14]], M.BASE); r.line(3, 6, 13, 6, M.ACCENT); r.line(6, 3, 8, 6, M.WHITE); r.dot(6, 5, M.WHITE); },
  cristal: (r) => { r.poly([[6, 14], [4, 6], [7, 2], [9, 6], [9, 14]], M.BASE); r.poly([[9, 14], [10, 8], [13, 5], [13, 14]], M.ACCENT); r.line(6, 4, 6, 12, M.WHITE); },
  tora: (r) => { r.rect(2, 5, 12, 7, M.BASE); r.ellipse(13, 8.5, 2, 3.5, M.ACCENT); r.ellipse(13, 8.5, 1, 2, M.BASE); r.line(4, 7, 10, 7, M.DARK); r.line(5, 10, 9, 10, M.DARK); },
  fibra: (r) => { for (let i = 0; i < 4; i++) r.line(3 + i * 2, 14, 6 + i * 2, 2, M.BASE); r.line(2, 8, 13, 8, M.ACCENT, 2); },
  resina: (r) => { r.ellipse(8, 10, 5, 4, M.BASE); r.poly([[6, 7], [8, 2], [10, 7]], M.BASE); r.dot(6, 9, M.WHITE); },
  erva: (r) => { r.line(8, 15, 8, 6, M.LEAF); r.ellipse(5, 7, 3, 2, M.BASE); r.ellipse(11, 5, 3, 2, M.BASE); r.ellipse(6, 11, 3, 1.5, M.BASE); r.ellipse(11, 10, 3, 1.5, M.BASE); },
  raiz: (r) => { r.line(8, 2, 8, 9, M.LEAF); r.ellipse(8, 3, 3, 2, M.LEAF); r.line(8, 9, 4, 14, M.BASE, 2); r.line(8, 9, 12, 14, M.BASE, 2); r.line(8, 9, 8, 15, M.BASE, 2); },
  flor: (r) => { r.line(8, 15, 8, 8, M.LEAF); r.ellipse(5, 12, 2, 1, M.LEAF); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; r.circle(8 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, 2, M.BASE); } r.circle(8, 6, 1.5, M.GOLD); },
  cogumelo: (r) => { r.rect(7, 8, 3, 6, M.WHITE); r.ellipse(8, 7, 6, 4, M.BASE); r.rect(2, 8, 12, 2, M.NONE); r.dot(6, 5, M.WHITE); r.dot(10, 6, M.WHITE); },
  peixe: (r) => { r.ellipse(7, 8, 6, 3.5, M.BASE); r.poly([[12, 8], [15, 4], [15, 12]], M.ACCENT); r.dot(3, 7, M.PUPIL); r.line(6, 9, 9, 9, M.ACCENT); },
  carne: (r) => { r.ellipse(7, 8, 5, 4, M.BASE); r.ellipse(6, 7, 3, 2, M.ACCENT); r.line(11, 11, 14, 14, M.BONE, 2); r.circle(14, 14, 1.2, M.BONE); },
  couro: (r) => { r.poly([[2, 4], [6, 2], [10, 3], [14, 2], [13, 8], [14, 14], [9, 13], [4, 14], [3, 9]], M.BASE); r.line(5, 6, 11, 10, M.ACCENT); },
  'couro-curtido': (r) => { r.rect(2, 4, 12, 8, M.BASE); r.rect(2, 4, 12, 2, M.ACCENT); r.line(3, 9, 13, 9, M.DARK); r.ellipse(8, 13, 6, 1, M.DARK); },
  osso: (r) => { r.line(4, 12, 12, 4, M.BONE, 2); for (const [x, y] of [[3, 11], [4, 13], [11, 3], [13, 5]]) r.circle(x, y, 1.6, M.BONE); },
  pena: (r) => { r.line(3, 14, 12, 3, M.WHITE); r.poly([[5, 11], [12, 3], [13, 6], [7, 12]], M.BASE); r.poly([[5, 11], [10, 3], [12, 3]], M.ACCENT); },
  presa: (r) => { r.poly([[4, 3], [9, 3], [12, 9], [10, 14], [8, 8]], M.BASE); r.line(5, 4, 9, 9, M.WHITE); },
  garra: (r) => { for (let i = 0; i < 3; i++) r.poly([[3 + i * 4, 3], [6 + i * 4, 3], [5 + i * 4, 13]], M.BASE); },
  seda: (r) => { r.circle(8, 8, 6, M.BASE); for (let i = 0; i < 4; i++) r.line(2, 4 + i * 3, 14, 6 + i * 3, M.ACCENT); },
  quitina: (r) => { r.poly([[2, 10], [5, 3], [11, 3], [14, 10], [8, 14]], M.BASE); r.line(8, 3, 8, 14, M.ACCENT); r.dot(5, 6, M.WHITE); },
  gota: (r) => { r.poly([[8, 1], [12, 8], [4, 8]], M.BASE); r.circle(8, 10, 4.5, M.BASE); r.dot(6, 9, M.WHITE); },
  escama: (r) => { for (const [x, y] of [[5, 5], [11, 5], [8, 10], [3, 11], [13, 11]]) { r.circle(x, y, 3, M.BASE); r.dot(x - 1, y - 1, M.WHITE); } },
  esporo: (r) => { for (const [x, y, s] of [[5, 5, 2.5], [11, 6, 2], [8, 11, 3], [13, 12, 1.5]]) r.circle(x, y, s, M.BASE); r.dot(7, 10, M.GLOW); },
  engrenagem: (r) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r.circle(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.5, M.BASE); } r.circle(8, 8, 5, M.BASE); r.circle(8, 8, 2, M.NONE); },
  essencia: (r) => { r.circle(8, 9, 5, M.BASE); r.circle(8, 9, 3, M.GLOW); r.poly([[6, 4], [8, 0], [10, 4]], M.BASE); },
  nucleo: (r) => { r.circle(8, 8, 6, M.DARK); r.circle(8, 8, 4, M.BASE); r.circle(7, 7, 1.5, M.WHITE); },
  olho: (r) => { r.ellipse(8, 8, 7, 5, M.WHITE); r.circle(8, 8, 3, M.BASE); r.circle(8, 8, 1.5, M.PUPIL); },
  fragmento: (r) => { r.poly([[8, 1], [13, 7], [9, 15], [4, 9]], M.BASE); r.line(8, 2, 8, 13, M.WHITE); },
  tecido: (r) => { r.rect(2, 3, 11, 10, M.BASE); r.poly([[13, 3], [15, 5], [15, 13], [13, 13]], M.ACCENT); for (let y = 5; y < 13; y += 3) r.line(3, y, 12, y, M.ACCENT); },
  perola: (r) => { r.ellipse(8, 10, 6, 4, M.DARK); r.circle(8, 8, 3, M.BASE); r.dot(7, 7, M.WHITE); },
  // ---------------- consumíveis
  pocao: (r) => { r.rect(6, 1, 4, 2, M.WOOD); r.rect(6, 3, 4, 3, M.GEM); r.circle(8, 10, 5, M.GEM); r.circle(8, 11, 4, M.BASE); r.dot(6, 8, M.WHITE); },
  frasco: (r) => { r.rect(7, 1, 3, 2, M.WOOD); r.poly([[6, 3], [10, 3], [13, 14], [3, 14]], M.GEM); r.poly([[5, 8], [11, 8], [13, 14], [3, 14]], M.BASE); r.dot(6, 6, M.WHITE); },
  racao: (r) => { r.rect(2, 5, 12, 8, M.LEATHER); r.rect(2, 5, 12, 2, M.BASE); r.line(8, 5, 8, 13, M.DARK); },
  cantil: (r) => { r.ellipse(8, 9, 6, 6, M.LEATHER); r.circle(8, 9, 4, M.BASE); r.rect(7, 1, 2, 3, M.WOOD); },
  celula: (r) => { r.rect(4, 3, 8, 11, M.METAL); r.rect(5, 4, 6, 9, M.BASE); r.rect(6, 1, 4, 2, M.METAL); r.line(7, 6, 9, 9, M.WHITE); },
  pao: (r) => { r.ellipse(8, 9, 7, 4.5, M.BASE); for (const x of [5, 8, 11]) r.line(x, 7, x + 1, 10, M.ACCENT); },
  ensopado: (r) => { r.ellipse(8, 10, 7, 4, M.DARK); r.ellipse(8, 8, 6, 2, M.BASE); r.dot(6, 8, M.LEAF); r.dot(10, 7, M.ACCENT); r.line(10, 2, 13, 7, M.WOOD); },
  'peixe-assado': (r) => { r.ellipse(8, 12, 7, 2, M.WHITE); r.ellipse(7, 9, 5, 2.5, M.BASE); r.poly([[11, 9], [14, 6], [14, 12]], M.ACCENT); },
  saco: (r) => { r.poly([[3, 14], [4, 6], [6, 4], [10, 4], [12, 6], [13, 14]], M.BASE); r.line(5, 4, 11, 4, M.LEATHER); r.dot(6, 9, M.WHITE); },
  runa: (r) => { r.poly([[3, 3], [13, 2], [14, 13], [2, 14]], M.DARK); r.line(8, 4, 8, 12, M.BASE); r.line(5, 6, 11, 10, M.BASE); r.line(11, 6, 5, 10, M.BASE); },
  isca: (r) => { r.ellipse(7, 10, 4, 3, M.BASE); r.line(10, 9, 14, 3, M.METAL); r.line(14, 3, 14, 6, M.METAL); },
  mapa: (r) => { r.rect(2, 3, 12, 10, M.BASE); r.line(4, 6, 9, 9, M.FIRE); r.line(9, 9, 12, 6, M.FIRE); r.line(10, 9, 12, 11, M.DARK); r.line(12, 9, 10, 11, M.DARK); r.rect(2, 3, 12, 1, M.ACCENT); },
  moeda: (r) => { r.circle(8, 8, 6, M.GOLD); r.circle(8, 8, 4, M.BASE2); r.line(8, 5, 8, 11, M.GOLD); },
  // ---------------- armas
  espada: (r) => { r.line(4, 12, 13, 3, M.BASE, 2); r.line(5, 11, 13, 3, M.WHITE); r.line(2, 10, 6, 14, M.GOLD); r.line(1, 15, 4, 12, M.WOOD, 2); },
  machado: (r) => { r.line(3, 14, 11, 4, M.WOOD, 2); r.poly([[9, 2], [15, 4], [14, 10], [10, 7]], M.BASE); r.line(14, 4, 14, 9, M.WHITE); },
  maca: (r) => { r.line(3, 14, 10, 6, M.WOOD, 2); r.circle(11, 5, 4, M.BASE); for (const [x, y] of [[11, 0], [15, 5], [7, 3], [14, 1]]) r.dot(x, y, M.BASE); },
  adaga: (r) => { r.line(6, 10, 12, 3, M.BASE, 2); r.line(4, 9, 8, 13, M.GOLD); r.line(3, 14, 5, 12, M.WOOD, 2); },
  punho: (r) => { r.rect(3, 6, 10, 7, M.BASE); for (let x = 3; x < 13; x += 3) r.rect(x, 4, 2, 3, M.BASE); r.rect(3, 11, 10, 2, M.ACCENT); },
  lanca: (r) => { r.line(2, 15, 12, 4, M.WOOD, 1); r.poly([[11, 5], [15, 0], [14, 6]], M.BASE); },
  martelo: (r) => { r.line(3, 15, 9, 6, M.WOOD, 2); r.poly([[6, 3], [11, 0], [15, 6], [10, 9]], M.BASE); },
  espadao: (r) => { r.line(4, 12, 14, 1, M.BASE, 3); r.line(5, 11, 14, 1, M.WHITE); r.line(1, 9, 7, 15, M.GOLD, 2); },
  foice: (r) => { r.line(4, 15, 9, 2, M.WOOD, 1); r.poly([[9, 2], [15, 3], [14, 8], [12, 4]], M.BASE); },
  arco: (r) => { r.line(4, 1, 12, 8, M.WOOD, 2); r.line(12, 8, 4, 15, M.WOOD, 2); r.line(4, 1, 4, 15, M.WHITE); },
  besta: (r) => { r.line(3, 13, 12, 4, M.WOOD, 2); r.line(6, 2, 14, 10, M.BASE, 1); r.line(6, 2, 10, 8, M.WHITE); },
  pistola: (r) => { r.rect(3, 5, 11, 3, M.BASE); r.rect(4, 8, 3, 6, M.WOOD); r.dot(13, 6, M.GLOW); r.dot(8, 9, M.DARK); },
  cajado: (r) => { r.line(3, 15, 11, 4, M.WOOD, 2); r.circle(12, 3, 2.5, M.GEM); r.dot(12, 3, M.WHITE); },
  varinha: (r) => { r.line(4, 13, 12, 4, M.BASE, 1); r.dot(12, 3, M.GLOW); r.dot(13, 2, M.GLOW); r.dot(11, 2, M.GLOW); },
  escudo: (r) => { r.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], M.BASE); r.poly([[4, 4], [12, 4], [12, 8], [8, 12], [4, 8]], M.ACCENT); r.line(8, 4, 8, 12, M.GOLD); },
  livro: (r) => { r.rect(3, 2, 10, 12, M.BASE); r.rect(4, 3, 8, 10, M.ACCENT); r.rect(11, 3, 2, 10, M.WHITE); r.circle(8, 8, 2, M.GOLD); },
  orbe: (r) => { r.circle(8, 7, 5, M.GEM); r.circle(8, 7, 3, M.BASE); r.dot(6, 5, M.WHITE); r.rect(5, 12, 6, 3, M.GOLD); },
  alaude: (r) => { r.ellipse(6, 10, 5, 4, M.WOOD); r.circle(6, 10, 1.5, M.DARK); r.line(9, 8, 14, 2, M.WOOD, 2); r.line(3, 10, 14, 2, M.WHITE); },
  // ---------------- armaduras
  peitoral: (r) => { r.poly([[2, 3], [5, 2], [8, 4], [11, 2], [14, 3], [13, 14], [3, 14]], M.BASE); r.line(8, 4, 8, 14, M.ACCENT); r.line(3, 9, 13, 9, M.ACCENT); },
  calca: (r) => { r.poly([[3, 2], [13, 2], [14, 15], [10, 15], [8, 7], [6, 15], [2, 15]], M.BASE); r.rect(3, 2, 10, 2, M.ACCENT); },
  elmo: (r) => { r.ellipse(8, 8, 6, 6, M.BASE); r.rect(2, 9, 12, 6, M.BASE); r.rect(4, 8, 8, 2, M.DARK); r.line(8, 2, 8, 6, M.ACCENT); },
  luvas: (r) => { r.rect(3, 6, 8, 8, M.BASE); for (let i = 0; i < 4; i++) r.rect(3 + i * 2, 3, 2, 4, M.BASE); r.rect(11, 8, 3, 2, M.BASE); r.rect(3, 12, 8, 2, M.ACCENT); },
  botas: (r) => { r.rect(4, 2, 6, 10, M.BASE); r.rect(4, 11, 10, 4, M.BASE); r.rect(4, 2, 6, 2, M.ACCENT); },
  capa: (r) => { r.poly([[5, 2], [11, 2], [15, 15], [1, 15]], M.BASE); r.poly([[5, 2], [11, 2], [10, 5], [6, 5]], M.ACCENT); r.circle(8, 3, 1, M.GOLD); },
  amuleto: (r) => { r.line(3, 1, 8, 8, M.GOLD); r.line(13, 1, 8, 8, M.GOLD); r.circle(8, 10, 4, M.GOLD); r.circle(8, 10, 2.5, M.GEM); },
  anel: (r) => { r.ellipse(8, 10, 5, 4, M.GOLD); r.ellipse(8, 10, 3, 2, M.NONE); r.circle(8, 5, 2.5, M.GEM); r.dot(7, 4, M.WHITE); },
  // ---------------- ferramentas
  picareta: (r) => { r.line(4, 15, 9, 4, M.WOOD, 2); r.poly([[2, 4], [8, 1], [15, 4], [14, 5], [8, 3], [3, 6]], M.BASE); },
  'foice-pequena': (r) => { r.line(4, 15, 7, 7, M.WOOD, 2); r.poly([[6, 7], [8, 2], [14, 3], [13, 6], [9, 4]], M.BASE); },
  vara: (r) => { r.line(2, 15, 13, 2, M.WOOD, 1); r.line(13, 2, 14, 12, M.WHITE); r.dot(14, 13, M.FIRE); },
  faca: (r) => { r.poly([[6, 9], [14, 2], [13, 6], [8, 11]], M.BASE); r.line(3, 14, 7, 10, M.WOOD, 2); },
  bigorna: (r) => { r.poly([[2, 5], [14, 5], [12, 8], [10, 8], [11, 13], [5, 13], [6, 8], [4, 8]], M.BASE); },
  agulha: (r) => { r.line(3, 13, 13, 3, M.METAL); r.line(3, 3, 13, 13, M.CLOTH, 1); },
  panela: (r) => { r.ellipse(8, 10, 6, 4, M.DARK); r.rect(2, 7, 12, 2, M.METAL); r.line(14, 8, 15, 6, M.METAL); },
};

const DEFAULT_ROLES: Partial<Record<string, string>> = { metal: '#a0a8b8' };
void DEFAULT_ROLES;

const cache = new Map<string, Canvas>();

/** Ícone de um item do catálogo (16×16, cor do próprio item). */
export function itemIcon(itemId: string): Canvas {
  const def = itemById.get(itemId);
  return iconFor(def?.icon ?? 'saco', def?.color ?? '#a0a0a0');
}

export function iconFor(icon: string, color: string, gem = '#60c0f0'): Canvas {
  const key = `${icon}:${color}:${gem}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = new RoleCanvas(16, 16);
  (ICONS[icon] ?? ICONS.saco)(r);
  const base = hex(color);
  const out = renderRoles(r, {
    [M.BASE]: color, [M.ACCENT]: toHex(shade(base, 0.35)), [M.BASE2]: toHex(light(base, 0.35)), [M.GEM]: gem, [M.GLOW]: toHex(light(base, 0.5)),
  }, { outline: 'auto', shadeAmt: 0.28, lightAmt: 0.25 });
  cache.set(key, out);
  return out;
}

// ===================================================================== símbolos de habilidade

type Glyph = (r: RoleCanvas) => void;
export const GLYPHS: Record<string, Glyph> = {
  espada: ICONS.espada, escudo: (r) => { r.poly([[3, 2], [13, 2], [13, 8], [8, 14], [3, 8]], M.BASE); r.line(8, 3, 8, 12, M.ACCENT); },
  machado: ICONS.machado, adaga: ICONS.adaga, punho: ICONS.punho, arco: ICONS.arco, foice: ICONS.foice, livro: ICONS.livro, osso: ICONS.osso,
  bandeira: (r) => { r.line(4, 1, 4, 15, M.BASE); r.poly([[5, 2], [14, 4], [5, 8]], M.ACCENT); },
  mao: (r) => { r.rect(4, 7, 8, 7, M.BASE); for (let i = 0; i < 4; i++) r.rect(4 + i * 2, 2 + (i % 2), 2, 6, M.BASE); r.rect(12, 8, 3, 2, M.BASE); },
  passo: (r) => { r.ellipse(5, 11, 3, 4, M.BASE); r.ellipse(11, 5, 3, 4, M.BASE); },
  sangue: (r) => { r.poly([[8, 1], [12, 8], [4, 8]], M.ACCENT); r.circle(8, 10, 4.5, M.ACCENT); r.dot(6, 9, M.WHITE); },
  vento: (r) => { r.line(1, 5, 11, 5, M.BASE); r.line(3, 9, 14, 9, M.BASE); r.line(1, 13, 9, 13, M.BASE); r.circle(11, 3, 2, M.BASE); r.circle(14, 11, 1.5, M.BASE); },
  coroa: (r) => { r.poly([[2, 13], [2, 4], [5, 8], [8, 2], [11, 8], [14, 4], [14, 13]], M.BASE); r.dot(8, 9, M.ACCENT); },
  torre: (r) => { r.rect(4, 5, 8, 10, M.BASE); for (let x = 3; x < 13; x += 3) r.rect(x, 2, 2, 3, M.BASE); r.rect(7, 10, 2, 5, M.ACCENT); },
  alvo: (r) => { r.circle(8, 8, 6, M.BASE); r.circle(8, 8, 4, M.ACCENT); r.circle(8, 8, 2, M.BASE); },
  mascara: (r) => { r.ellipse(8, 8, 6, 5, M.BASE); r.ellipse(5, 7, 1.5, 1, M.DARK); r.ellipse(11, 7, 1.5, 1, M.DARK); r.line(5, 11, 11, 11, M.ACCENT); },
  lua: (r) => { r.circle(8, 8, 6, M.BASE); r.circle(11, 6, 5, M.NONE); },
  caveira: (r) => { r.circle(8, 7, 5, M.BASE); r.rect(5, 11, 6, 3, M.BASE); r.rect(5, 6, 2, 2, M.DARK); r.rect(9, 6, 2, 2, M.DARK); r.line(6, 13, 10, 13, M.DARK); },
  estrela: (r) => { r.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], M.BASE); },
  olho: (r) => { r.ellipse(8, 8, 7, 4, M.BASE); r.circle(8, 8, 2.5, M.ACCENT); r.dot(8, 8, M.DARK); },
  nuvem: (r) => { r.circle(5, 9, 3, M.BASE); r.circle(9, 7, 4, M.BASE); r.circle(12, 10, 3, M.BASE); r.rect(4, 10, 9, 3, M.BASE); },
  gota: ICONS.gota,
  teia: (r) => { for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; r.line(8 - Math.cos(a) * 7, 8 - Math.sin(a) * 7, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, M.BASE); } r.circle(8, 8, 4, M.BASE); r.circle(8, 8, 3, M.NONE); },
  fogo: (r) => { r.poly([[8, 1], [13, 9], [11, 15], [5, 15], [3, 9], [6, 5]], M.ACCENT); r.poly([[8, 7], [11, 12], [9, 15], [7, 15], [5, 12]], M.BASE); },
  chama: (r) => GLYPHS.fogo(r),
  bomba: (r) => { r.circle(7, 10, 5, M.BASE); r.line(10, 5, 13, 2, M.ACCENT); r.dot(14, 1, M.ACCENT); r.dot(5, 8, M.WHITE); },
  engrenagem: ICONS.engrenagem,
  seta: (r) => { r.line(2, 14, 13, 3, M.BASE); r.poly([[13, 1], [15, 3], [11, 5]], M.ACCENT); r.line(2, 12, 4, 14, M.ACCENT); },
  pata: (r) => { r.ellipse(8, 11, 4, 3, M.BASE); for (const [x, y] of [[3, 6], [6, 3], [10, 3], [13, 6]]) r.circle(x, y, 1.6, M.BASE); },
  garra: (r) => { for (let i = 0; i < 3; i++) r.line(3 + i * 4, 2, 6 + i * 4, 14, M.BASE, 2); },
  folha: (r) => { r.ellipse(8, 8, 4, 7, M.BASE); r.line(8, 2, 8, 15, M.ACCENT); },
  coracao: (r) => { r.circle(5, 6, 3.5, M.BASE); r.circle(11, 6, 3.5, M.BASE); r.poly([[2, 7], [14, 7], [8, 14]], M.BASE); },
  nota: (r) => { r.circle(5, 12, 2.5, M.BASE); r.line(7, 12, 7, 2, M.BASE); r.line(7, 2, 13, 4, M.BASE, 2); r.circle(11, 10, 2.5, M.BASE); r.line(13, 10, 13, 4, M.BASE); },
  espiral: (r) => { for (let t = 0; t < 14; t += 0.25) r.dot(8 + Math.cos(t) * t / 2.2, 8 + Math.sin(t) * t / 2.2, M.BASE); },
  relogio: (r) => { r.circle(8, 8, 6, M.BASE); r.circle(8, 8, 5, M.NONE); r.line(8, 8, 8, 4, M.ACCENT); r.line(8, 8, 11, 9, M.ACCENT); },
  gelo: (r) => { r.line(8, 1, 8, 15, M.BASE); r.line(2, 4, 14, 12, M.BASE); r.line(2, 12, 14, 4, M.BASE); r.circle(8, 8, 1.5, M.ACCENT); },
  raio: (r) => { r.poly([[9, 1], [4, 9], [8, 9], [6, 15], [12, 6], [8, 6]], M.BASE); },
  sol: (r) => { r.circle(8, 8, 4, M.BASE); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r.line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, M.ACCENT); } },
  runa: ICONS.runa,
  cruz: (r) => { r.rect(6, 2, 4, 12, M.BASE); r.rect(2, 6, 12, 4, M.BASE); },
  espirito: (r) => { r.poly([[8, 2], [13, 7], [13, 14], [10, 12], [8, 15], [6, 12], [3, 14], [3, 7]], M.BASE); r.dot(6, 7, M.DARK); r.dot(10, 7, M.DARK); },
  urso: (r) => { r.circle(8, 9, 5, M.BASE); r.circle(4, 4, 2, M.BASE); r.circle(12, 4, 2, M.BASE); r.ellipse(8, 11, 2, 1.5, M.ACCENT); r.dot(6, 8, M.DARK); r.dot(10, 8, M.DARK); },
  raiz: ICONS.raiz,
  arvore: (r) => { r.rect(7, 9, 3, 6, M.ACCENT); r.circle(8, 6, 5, M.BASE); },
  espelho: (r) => { r.ellipse(8, 7, 5, 6, M.BASE); r.ellipse(8, 7, 3, 4, M.ACCENT); r.rect(7, 13, 2, 3, M.BASE); },
};

/** Símbolo de habilidade sobre placa colorida (24×24). `kind` define a moldura. */
export function skillIcon(glyph: string, classColor: string, kind: 'ativa' | 'modificador' | 'passiva' | 'culminante' = 'ativa', state: 'ok' | 'off' | 'lock' = 'ok'): Canvas {
  const c = new Canvas(24, 24);
  const base = hex(classColor);
  const bg = state === 'ok' ? shade(base, 0.45) : state === 'off' ? hex('#3a3442') : hex('#241e2c');
  if (kind === 'passiva') { for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if ((x - 11.5) ** 2 + (y - 11.5) ** 2 <= 132) c.set(x, y, bg); }
  else if (kind === 'modificador') { for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (Math.abs(x - 11.5) + Math.abs(y - 11.5) <= 12) c.set(x, y, bg); }
  else c.rect(1, 1, 22, 22, bg);
  const frame = kind === 'culminante' ? hex('#f0c040') : state === 'ok' ? light(base, 0.3) : hex('#5a5462');
  if (kind === 'ativa' || kind === 'culminante') { c.frame(0, 0, 24, 24, frame); if (kind === 'culminante') c.frame(1, 1, 22, 22, hex('#a07020')); }
  else if (kind === 'passiva') { for (let a = 0; a < 360; a += 2) c.set(11.5 + Math.cos((a * Math.PI) / 180) * 11.5, 11.5 + Math.sin((a * Math.PI) / 180) * 11.5, frame); }
  else { for (let i = 0; i < 12; i++) { c.set(11.5 - i, i, frame); c.set(12 + i, i, frame); c.set(i, 12 + i, frame); c.set(23 - i, 12 + i, frame); } }
  const r = new RoleCanvas(16, 16);
  (GLYPHS[glyph] ?? GLYPHS.estrela)(r);
  const fg = state === 'ok' ? '#f4ecd8' : '#7a7482';
  const g = renderRoles(r, { [M.BASE]: fg, [M.ACCENT]: state === 'ok' ? toHex(light(base, 0.4)) : '#5a5462', [M.WHITE]: '#ffffff', [M.DARK]: '#2a2030', [M.GOLD]: '#f0c040', [M.WOOD]: fg, [M.GEM]: fg }, { outline: '#1a1020', shadeAmt: 0.15, lightAmt: 0.1 });
  c.blit(g, 4, 4);
  if (state === 'lock') { c.rect(16, 15, 6, 6, hex('#1a1020')); c.frame(16, 15, 6, 6, hex('#7a7482')); c.rect(17, 13, 4, 2, hex('#7a7482')); }
  return c;
}

/** Símbolo colorido sem placa (estandartes, mapas). */
export function glyphIcon(glyph: string, color: string): Canvas {
  const r = new RoleCanvas(16, 16);
  (GLYPHS[glyph] ?? GLYPHS.estrela)(r);
  const base = hex(color);
  return renderRoles(r, { [M.BASE]: color, [M.ACCENT]: toHex(shade(base, 0.35)), [M.WHITE]: '#ffffff', [M.DARK]: '#2a2030', [M.GOLD]: '#f0c040' }, { outline: 'auto' });
}
