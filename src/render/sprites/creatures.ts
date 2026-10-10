import { M, RoleCanvas } from '../paint.ts';

/**
 * Formas de criaturas em 32×32, de perfil voltadas para a direita (humanoides de frente).
 * Cada forma desenha com papéis: BASE (corpo), ACCENT (detalhes), BONE (presas, garras),
 * EYE/PUPIL. As cores vêm da criatura. `v` (0..1) varia proporções para diferenciar espécies.
 */
type Shape = (r: RoleCanvas, v: number) => void;

const eye = (r: RoleCanvas, x: number, y: number, big = false) => {
  r.dot(x, y, M.EYE);
  if (big) { r.dot(x + 1, y, M.EYE); r.dot(x, y + 1, M.PUPIL); r.dot(x + 1, y + 1, M.EYE); }
  else r.dot(x + 1, y, M.PUPIL);
};
const legs = (r: RoleCanvas, xs: number[], top: number, bottom: number, w = 2, m: number = M.BASE) => {
  for (const x of xs) { r.rect(x, top, w, bottom - top, m); r.rect(x, bottom - 1, w + 1, 1, M.DARK); }
};

export const SHAPES: Record<string, Shape> = {
  lobo: (r, v) => {
    r.ellipse(14, 17, 9, 5 + v, M.BASE);
    r.ellipse(23, 12, 5, 4.5, M.BASE);
    r.poly([[25, 13], [31, 14], [31, 16], [25, 17]], M.BASE);
    r.poly([[20, 9], [21, 4], [23, 9]], M.BASE); r.poly([[23, 9], [25, 4], [26, 10]], M.ACCENT);
    r.line(5, 15, 1, 9, M.BASE, 3); r.line(2, 9, 1, 6, M.ACCENT, 2);
    legs(r, [7, 11, 17, 21], 20, 28);
    r.ellipse(14, 19, 7, 2, M.ACCENT);
    eye(r, 24, 11);
    r.dot(31, 14, M.DARK); r.dot(28, 17, M.BONE); r.dot(30, 17, M.BONE);
  },
  javali: (r, v) => {
    r.ellipse(14, 17, 11, 7 + v, M.BASE);
    r.ellipse(24, 16, 6, 5, M.BASE);
    r.rect(27, 15, 4, 5, M.ACCENT); r.dot(30, 16, M.DARK); r.dot(30, 18, M.DARK);
    r.line(26, 20, 29, 13 + Math.round(v * 2), M.BONE, 2);
    r.poly([[20, 11], [21, 7], [23, 11]], M.BASE);
    for (let x = 6; x < 20; x += 2) r.dot(x, 10 + (x % 4 === 0 ? 0 : 1), M.ACCENT);
    legs(r, [6, 10, 17, 21], 22, 29, 3);
    r.line(3, 15, 1, 12, M.BASE, 2);
    eye(r, 24, 13);
  },
  urso: (r, v) => {
    r.ellipse(14, 17, 11, 9 + v, M.BASE);
    r.ellipse(24, 12, 6, 6, M.BASE);
    r.circle(21, 6, 2, M.BASE); r.circle(26, 6, 2, M.BASE);
    r.ellipse(28, 14, 3, 2.5, M.ACCENT);
    r.dot(30, 13, M.DARK);
    legs(r, [5, 10, 17, 22], 23, 30, 4);
    r.ellipse(14, 21, 8, 3, M.ACCENT);
    eye(r, 25, 10);
    r.dot(25, 30, M.BONE); r.dot(9, 30, M.BONE);
  },
  cervo: (r, v) => {
    r.ellipse(13, 16, 9, 5, M.BASE);
    r.line(21, 13, 24, 7, M.BASE, 4);
    r.ellipse(25, 7, 4, 3, M.BASE); r.poly([[27, 6], [31, 8], [27, 10]], M.BASE);
    r.line(24, 4, 21, 0, M.BONE); r.line(22, 2, 19, 2, M.BONE); r.line(26, 4, 29, 0, M.BONE); r.line(28, 2, 31, 1, M.BONE);
    if (v > 0.5) { r.dot(20, 1, M.ACCENT); r.dot(30, 0, M.ACCENT); }
    legs(r, [6, 9, 17, 20], 19, 30, 2);
    r.ellipse(13, 18, 6, 2, M.ACCENT);
    r.line(4, 14, 2, 12, M.BASE, 2);
    eye(r, 25, 6);
  },
  morsa: (r) => {
    r.ellipse(13, 19, 12, 8, M.BASE);
    r.ellipse(24, 16, 6, 6, M.BASE);
    r.ellipse(27, 19, 4, 3, M.ACCENT);
    r.line(25, 21, 25, 28, M.BONE, 2); r.line(28, 21, 28, 27, M.BONE, 2);
    r.poly([[2, 22], [0, 27], [6, 25]], M.BASE);
    r.ellipse(18, 27, 4, 2, M.BASE);
    eye(r, 25, 14);
  },
  aranha: (r, v) => {
    for (const [i, x] of [6, 10, 20, 24].entries()) {
      const dir = i < 2 ? -1 : 1;
      r.line(16, 18, x, 12, M.ACCENT, 2); r.line(x, 12, x + dir * 4, 28, M.ACCENT, 2);
    }
    r.ellipse(10, 17, 8, 7 + v, M.BASE);
    for (let i = 0; i < 3; i++) r.dot(6 + i * 3, 13, M.ACCENT);
    r.ellipse(21, 19, 5, 4, M.BASE);
    eye(r, 23, 17); eye(r, 20, 17);
    r.dot(25, 22, M.BONE); r.dot(23, 23, M.BONE);
  },
  escorpiao: (r) => {
    r.ellipse(15, 21, 9, 4, M.BASE);
    for (let i = 0; i < 4; i++) r.line(10 + i * 3, 23, 8 + i * 3, 28, M.ACCENT, 1);
    r.line(7, 20, 3, 14, M.BASE, 3); r.line(3, 14, 5, 7, M.BASE, 3); r.line(5, 7, 10, 5, M.BASE, 2);
    r.poly([[10, 3], [13, 5], [10, 7]], M.BONE);
    r.line(22, 20, 27, 17, M.BASE, 2); r.ellipse(28, 15, 3, 2, M.ACCENT); r.dot(30, 13, M.BONE);
    eye(r, 22, 18);
  },
  vespa: (r, v) => {
    r.ellipse(8, 18, 7, 5, M.BASE);
    for (let x = 4; x < 14; x += 3) r.rect(x, 14, 1, 9, M.DARK);
    r.poly([[1, 18], [-2, 19], [1, 20]], M.BONE);
    r.ellipse(17, 16, 3, 3, M.ACCENT);
    r.circle(23, 14, 4, M.BASE);
    r.ellipse(14 + v * 2, 8, 6, 3, M.GLOW); r.ellipse(20, 7, 5, 2.5, M.GLOW);
    for (const x of [15, 18, 20]) r.line(x, 19, x - 1, 26, M.DARK);
    r.line(24, 10, 27, 5, M.DARK);
    eye(r, 24, 13, true);
  },
  besouro: (r, v) => {
    r.ellipse(14, 18, 11, 8, M.BASE);
    r.line(14, 10, 14, 25, M.ACCENT);
    r.ellipse(10, 15, 3, 2, M.ACCENT);
    r.ellipse(25, 19, 4, 4, M.ACCENT);
    r.line(28, 16, 31, 10 + Math.round(v * 3), M.BONE, 2);
    for (const x of [8, 14, 20]) r.line(x, 25, x - 2, 29, M.DARK, 2);
    eye(r, 26, 18);
  },
  serpente: (r, v) => {
    for (let x = 2; x < 24; x++) {
      const y = 22 + Math.sin(x / 3.2 + v * 3) * 4;
      r.ellipse(x, y, 2.6, 2.6, M.BASE);
      if (x % 3 === 0) r.dot(x, y - 1, M.ACCENT);
    }
    r.line(22, 20, 24, 10, M.BASE, 5);
    r.ellipse(26, 9, 5, 4, M.BASE);
    r.ellipse(25, 11, 4, 2, M.ACCENT);
    r.line(30, 11, 32, 12, M.FIRE);
    eye(r, 27, 7);
  },
  verme: (r, v) => {
    for (let i = 0; i < 6; i++) r.circle(4 + i * 4, 22 - i * 2 - Math.sin(i + v) * 2, 4 - i * 0.2, M.BASE);
    for (let i = 0; i < 6; i++) r.line(2 + i * 4, 18 - i * 2, 4 + i * 4, 26 - i * 2, M.ACCENT);
    r.circle(27, 10, 4.5, M.BASE);
    r.circle(28, 10, 2.5, M.DARK);
    for (const [x, y] of [[26, 8], [30, 9], [28, 12], [26, 11]]) r.dot(x, y, M.BONE);
  },
  broto: (r, v) => {
    r.ellipse(16, 25, 6, 4, M.ACCENT);
    r.line(16, 24, 16, 12, M.BASE, 3);
    r.poly([[16, 14], [6, 8], [9, 15]], M.BASE);
    r.poly([[16, 12], [26, 5 + v * 2], [24, 13]], M.BASE);
    r.circle(16, 10, 4, M.BASE);
    eye(r, 14, 9); eye(r, 17, 9);
    r.line(14, 12, 18, 12, M.DARK);
    for (const x of [11, 21]) r.line(x, 27, x + (x < 16 ? -3 : 3), 30, M.ACCENT, 2);
  },
  flor: (r, v) => {
    r.line(16, 30, 16, 16, M.LEAF, 3);
    r.poly([[16, 26], [7, 22], [12, 28]], M.LEAF); r.poly([[16, 23], [25, 19], [21, 26]], M.LEAF);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + v;
      r.ellipse(16 + Math.cos(a) * 7, 10 + Math.sin(a) * 6, 4, 3.5, M.BASE);
    }
    r.circle(16, 10, 5, M.ACCENT);
    r.ellipse(16, 11, 3, 2, M.DARK);
    for (const x of [14, 16, 18]) r.dot(x, 10, M.BONE);
  },
  arvore: (r) => {
    r.rect(11, 14, 10, 15, M.BASE);
    r.poly([[11, 28], [6, 31], [12, 31]], M.BASE); r.poly([[21, 28], [26, 31], [20, 31]], M.BASE);
    r.circle(16, 9, 9, M.ACCENT); r.circle(9, 12, 5, M.ACCENT); r.circle(23, 12, 5, M.ACCENT);
    r.ellipse(13, 18, 1.5, 2, M.DARK); r.ellipse(19, 18, 1.5, 2, M.DARK);
    r.dot(13, 18, M.GLOW); r.dot(19, 18, M.GLOW);
    r.rect(13, 23, 6, 2, M.DARK);
    r.line(11, 16, 4, 20, M.BASE, 2); r.line(21, 16, 28, 19, M.BASE, 2);
  },
  goblin: (r, v) => {
    r.rect(12, 18, 8, 7, M.ACCENT);
    r.circle(16, 12, 6, M.BASE);
    r.poly([[10, 11], [3, 7 + v * 3], [10, 14]], M.BASE); r.poly([[22, 11], [29, 7 + v * 3], [22, 14]], M.BASE);
    eye(r, 13, 11); eye(r, 18, 11);
    r.line(13, 15, 19, 15, M.DARK); r.dot(14, 16, M.BONE); r.dot(18, 16, M.BONE);
    r.rect(13, 25, 2, 5, M.BASE); r.rect(17, 25, 2, 5, M.BASE);
    r.line(12, 19, 8, 24, M.BASE, 2); r.line(20, 19, 24, 23, M.BASE, 2);
    r.line(25, 14, 25, 28, M.WOOD, 2); r.poly([[23, 12], [25, 8], [27, 12]], M.METAL);
  },
  kobold: (r, v) => {
    r.ellipse(15, 20, 5, 6, M.ACCENT);
    r.ellipse(17, 11, 5, 4, M.BASE);
    r.poly([[20, 10], [27, 12], [20, 14]], M.BASE);
    r.poly([[13, 9], [11, 4], [15, 8]], M.BONE);
    eye(r, 19, 10);
    r.line(10, 22, 4, 26, M.BASE, 2);
    r.rect(12, 25, 2, 5, M.BASE); r.rect(17, 25, 2, 5, M.BASE);
    r.line(22, 28, 27, 4 + v * 2, M.WOOD, 1); r.poly([[26, 6], [28, 1], [29, 6]], M.METAL);
    r.line(20, 18, 25, 17, M.BASE, 2);
  },
  gnoll: (r) => {
    r.ellipse(15, 18, 7, 8, M.BASE);
    r.rect(10, 17, 10, 6, M.LEATHER);
    r.ellipse(18, 8, 5, 4, M.BASE);
    r.poly([[21, 7], [28, 9], [21, 11]], M.BASE); r.dot(27, 9, M.DARK);
    r.poly([[15, 5], [14, 0], [17, 4]], M.BASE);
    for (let x = 12; x < 20; x += 2) r.dot(x, 3 + (x % 4 ? 1 : 0), M.ACCENT);
    eye(r, 20, 7);
    r.rect(11, 25, 3, 6, M.BASE); r.rect(17, 25, 3, 6, M.BASE);
    r.line(8, 15, 4, 24, M.BASE, 3); r.line(22, 15, 26, 22, M.BASE, 3);
    r.line(27, 26, 29, 8, M.WOOD, 2); r.ellipse(29, 8, 3, 3, M.METAL);
  },
  gigante: (r, v) => {
    r.ellipse(16, 17, 10, 10, M.BASE);
    r.circle(16, 6, 5, M.BASE);
    r.rect(12, 4, 8, 2, M.ACCENT);
    eye(r, 13, 6); eye(r, 18, 6);
    r.line(14, 9, 18, 9, M.DARK); r.dot(13, 10, M.BONE); r.dot(19, 10, M.BONE);
    r.ellipse(16, 20, 7, 5, M.ACCENT);
    r.line(6, 12, 2, 25, M.BASE, 5); r.line(26, 12, 29, 22, M.BASE, 5);
    r.rect(9, 26, 5, 5, M.BASE); r.rect(18, 26, 5, 5, M.BASE);
    if (v > 0.5) { r.line(29, 24, 31, 8, M.WOOD, 3); r.ellipse(30, 8, 3, 4, M.WOOD); }
  },
  humano: (r, v) => {
    r.poly([[9, 30], [12, 13], [20, 13], [23, 30]], M.ACCENT);
    r.rect(12, 13, 8, 8, M.BASE);
    r.circle(16, 8, 5, M.SKIN);
    r.poly([[10, 6], [16, 0 - v], [22, 6], [21, 8], [11, 8]], M.BASE);
    eye(r, 13, 8); eye(r, 17, 8);
    r.line(11, 14, 6, 24, M.BASE, 3); r.line(21, 14, 26, 22, M.BASE, 3);
    r.rect(14, 20, 4, 2, M.GOLD);
    r.line(27, 30, 27, 6, M.WOOD, 1); r.circle(27, 5, 2, M.GLOW);
  },
  ave: (r, v) => {
    r.ellipse(14, 18, 8, 6, M.BASE);
    r.circle(22, 12, 4.5, M.BASE);
    r.poly([[25, 11], [31, 13 + v * 2], [25, 14]], M.BONE);
    r.poly([[6, 15], [10, 6 - v * 3], [18, 14]], M.ACCENT);
    r.poly([[6, 18], [0, 20], [1, 23], [7, 22]], M.ACCENT);
    r.line(13, 24, 12, 29, M.BONE); r.line(17, 24, 18, 29, M.BONE);
    r.line(10, 29, 13, 29, M.BONE); r.line(16, 29, 20, 29, M.BONE);
    eye(r, 23, 11);
  },
  harpia: (r, v) => {
    r.ellipse(16, 18, 5, 7, M.ACCENT);
    r.circle(16, 9, 4, M.SKIN);
    r.poly([[12, 7], [16, 3], [20, 7], [21, 13], [11, 13]], M.HAIR);
    r.circle(16, 9, 3, M.SKIN);
    eye(r, 14, 9); eye(r, 17, 9);
    r.poly([[11, 14], [0, 6 - v * 4], [2, 16], [11, 21]], M.BASE);
    r.poly([[21, 14], [32, 6 - v * 4], [30, 16], [21, 21]], M.BASE);
    r.line(14, 25, 13, 30, M.BONE); r.line(18, 25, 19, 30, M.BONE);
  },
  grifo: (r) => {
    r.ellipse(13, 19, 9, 6, M.BASE);
    r.circle(23, 11, 5, M.ACCENT);
    r.poly([[26, 10], [31, 13], [26, 15]], M.GOLD);
    r.poly([[8, 15], [14, 3], [20, 15]], M.ACCENT);
    legs(r, [6, 10, 16, 20], 23, 30, 2);
    r.line(4, 18, 1, 13, M.BASE, 2); r.circle(1, 12, 1.5, M.ACCENT);
    eye(r, 24, 10);
  },
  morcego: (r, v) => {
    r.ellipse(16, 16, 4, 5, M.BASE);
    r.poly([[13, 13], [1, 8 + v * 4], [3, 15], [6, 13], [8, 18], [13, 18]], M.ACCENT);
    r.poly([[19, 13], [31, 8 + v * 4], [29, 15], [26, 13], [24, 18], [19, 18]], M.ACCENT);
    r.poly([[13, 12], [13, 8], [15, 11]], M.BASE); r.poly([[19, 12], [19, 8], [17, 11]], M.BASE);
    eye(r, 14, 14); eye(r, 17, 14);
    r.dot(15, 18, M.BONE); r.dot(17, 18, M.BONE);
  },
  slime: (r, v) => {
    r.ellipse(16, 22, 12 - v * 2, 8, M.BASE);
    r.ellipse(16, 16, 8, 8, M.BASE);
    r.ellipse(12, 13, 2, 3, M.WHITE);
    r.ellipse(19, 24, 3, 2, M.ACCENT);
    r.dot(11, 25, M.ACCENT);
    eye(r, 13, 17, true); eye(r, 18, 17, true);
    r.line(14, 21, 18, 21, M.DARK);
  },
  caracol: (r) => {
    r.ellipse(14, 26, 13, 3, M.BASE);
    r.line(24, 25, 27, 16, M.BASE, 4);
    r.line(26, 16, 28, 11, M.BASE); r.line(28, 16, 31, 12, M.BASE);
    r.dot(28, 10, M.EYE); r.dot(31, 11, M.EYE);
    r.circle(13, 16, 9, M.ACCENT);
    r.circle(13, 16, 6, M.BASE2);
    r.circle(13, 16, 3, M.ACCENT);
  },
  rato: (r, v) => {
    r.ellipse(14, 21, 8, 5, M.BASE);
    r.ellipse(22, 19, 5, 4, M.BASE);
    r.poly([[25, 18], [31, 21], [25, 22]], M.BASE); r.dot(31, 21, M.ACCENT);
    r.circle(20, 14, 3, M.ACCENT);
    r.line(6, 22, 0, 18 - v * 3, M.ACCENT);
    legs(r, [9, 18], 24, 28, 2);
    eye(r, 23, 18);
    r.dot(29, 23, M.BONE);
  },
  zumbi: (r, v) => {
    r.poly([[10, 30], [11, 13], [21, 13], [22, 30]], M.ACCENT);
    r.circle(15 + v, 8, 5, M.BASE);
    r.line(20, 15, 30, 14, M.BASE, 3); r.line(20, 19, 30, 19, M.BASE, 3);
    r.dot(13, 7, M.EYE); r.dot(17, 7, M.GLOW);
    r.line(12, 11, 18, 11, M.DARK);
    r.rect(12, 22, 3, 3, M.DARK); r.dot(18, 26, M.BONE);
    r.rect(11, 25, 4, 6, M.BASE); r.rect(17, 25, 4, 6, M.BASE);
  },
  esqueleto: (r, v) => {
    r.circle(16, 7, 5, M.BONE);
    r.rect(13, 6, 2, 2, M.DARK); r.rect(17, 6, 2, 2, M.DARK); r.dot(13, 6, M.GLOW); r.dot(17, 6, M.GLOW);
    r.line(13, 11, 19, 11, M.DARK);
    r.line(16, 12, 16, 22, M.BONE, 2);
    for (let y = 14; y < 21; y += 2) r.line(12, y, 20, y, M.BONE);
    r.line(12, 13, 8, 22, M.BONE); r.line(20, 13, 24, 20, M.BONE);
    r.line(14, 22, 12, 31, M.BONE, 2); r.line(18, 22, 20, 31, M.BONE, 2);
    r.rect(5, 18, 6, 8, M.BASE); r.dot(7, 21, M.ACCENT);
    r.line(24, 20, 30, 6 + v * 2, M.METAL, 2);
  },
  mumia: (r) => {
    r.poly([[10, 30], [11, 12], [21, 12], [22, 30]], M.BASE);
    r.circle(16, 8, 5, M.BASE);
    for (let y = 5; y < 30; y += 3) r.line(10, y, 22, y + 1, M.ACCENT);
    r.rect(13, 7, 6, 2, M.DARK); r.dot(14, 7, M.GLOW); r.dot(17, 7, M.GLOW);
    r.line(11, 14, 3, 18, M.BASE, 3); r.line(21, 14, 29, 18, M.BASE, 3);
    r.line(4, 19, 2, 24, M.ACCENT);
  },
  golem: (r, v) => {
    r.rect(8, 10, 16, 14, M.BASE);
    r.rect(11, 3, 10, 8, M.BASE);
    r.rect(13, 6, 2, 2, M.GLOW); r.rect(17, 6, 2, 2, M.GLOW);
    r.rect(2, 11, 6, 13, M.BASE); r.rect(24, 11, 6, 13, M.BASE);
    r.rect(1, 23, 7, 4, M.ACCENT); r.rect(24, 23, 7, 4, M.ACCENT);
    r.rect(9, 24, 6, 7, M.BASE); r.rect(17, 24, 6, 7, M.BASE);
    r.line(10, 13, 14, 19, M.DARK); r.line(20, 12, 18 + v * 3, 21, M.DARK);
    r.circle(16, 17, 2.5, M.ACCENT);
  },
  armadura: (r, v) => {
    r.poly([[9, 12], [23, 12], [21, 24], [11, 24]], M.BASE);
    r.rect(12, 3, 8, 9, M.BASE);
    r.rect(13, 6, 6, 1, M.DARK); r.dot(14, 6, M.GLOW); r.dot(17, 6, M.GLOW);
    r.poly([[16, 0], [18, 3], [14, 3]], M.ACCENT);
    r.ellipse(8, 13, 3, 2.5, M.BASE); r.ellipse(24, 13, 3, 2.5, M.BASE);
    r.line(7, 15, 6, 24, M.BASE, 3); r.line(25, 15, 26, 22, M.BASE, 3);
    r.rect(11, 24, 4, 7, M.BASE); r.rect(17, 24, 4, 7, M.BASE);
    r.line(16, 13, 16, 23, M.ACCENT);
    r.line(27, 23, 30, 3 + v * 3, M.METAL, 2); r.line(25, 21, 30, 21, M.ACCENT);
  },
  espantalho: (r) => {
    r.line(16, 8, 16, 31, M.WOOD, 2);
    r.line(4, 13, 28, 13, M.WOOD, 2);
    r.poly([[9, 12], [23, 12], [21, 24], [11, 24]], M.ACCENT);
    r.circle(16, 7, 5, M.BASE);
    r.poly([[8, 4], [24, 4], [20, 0], [12, 0]], M.LEATHER);
    r.dot(14, 7, M.GLOW); r.dot(18, 7, M.GLOW); r.line(13, 10, 19, 10, M.DARK);
    for (const x of [4, 28]) r.line(x, 13, x, 17, M.BASE);
  },
  gargula: (r) => {
    r.ellipse(16, 19, 6, 7, M.BASE);
    r.circle(16, 9, 5, M.BASE);
    r.poly([[12, 6], [10, 0], [14, 4]], M.ACCENT); r.poly([[20, 6], [22, 0], [18, 4]], M.ACCENT);
    eye(r, 13, 9); eye(r, 17, 9);
    r.poly([[10, 15], [0, 6], [1, 20], [10, 22]], M.ACCENT); r.poly([[22, 15], [32, 6], [31, 20], [22, 22]], M.ACCENT);
    r.rect(11, 25, 4, 6, M.BASE); r.rect(17, 25, 4, 6, M.BASE);
    r.line(13, 13, 15, 19, M.DARK);
  },
  elemental: (r, v) => {
    r.poly([[16, 2], [26, 14], [22, 28], [10, 28], [6, 14]], M.BASE);
    r.poly([[16, 7], [22, 15], [19, 25], [13, 25], [10, 15]], M.ACCENT);
    r.circle(16, 16, 3, M.GLOW);
    eye(r, 13, 12); eye(r, 18, 12);
    for (let i = 0; i < 4; i++) r.circle(4 + i * 8, 29 + (i % 2), 1.5 + v, M.ACCENT);
    r.line(6, 14, 1, 10, M.BASE, 3); r.line(26, 14, 31, 10, M.BASE, 3);
  },
  espectro: (r, v) => {
    r.poly([[16, 3], [24, 10], [25, 22], [28, 30], [22, 27], [18, 31], [14, 27], [8, 30], [7, 22], [8, 10]], M.BASE);
    r.ellipse(16, 11, 5, 5, M.ACCENT);
    r.ellipse(13, 11, 1.5, 2, M.GLOW); r.ellipse(19, 11, 1.5, 2, M.GLOW);
    r.ellipse(16, 16, 2, 2.5 + v, M.DARK);
    r.line(8, 14, 1, 20, M.BASE, 2); r.line(24, 14, 31, 18, M.BASE, 2);
  },
  fungo: (r, v) => {
    r.rect(12, 16, 8, 13, M.ACCENT);
    r.ellipse(16, 13, 13, 8 - v * 2, M.BASE);
    r.rect(3, 14, 26, 3, M.NONE);
    r.ellipse(16, 14, 13, 2, M.ACCENT);
    for (const [x, y] of [[9, 8], [16, 6], [22, 9], [12, 11]]) r.circle(x, y, 1.5, M.WHITE);
    eye(r, 13, 20); eye(r, 18, 20);
    r.line(14, 24, 18, 24, M.DARK);
    r.line(12, 20, 7, 25, M.ACCENT, 2); r.line(20, 20, 25, 25, M.ACCENT, 2);
  },
  esporo: (r, v) => {
    r.circle(16, 15, 8, M.BASE);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + v; r.line(16, 15, 16 + Math.cos(a) * 13, 15 + Math.sin(a) * 13, M.ACCENT); r.circle(16 + Math.cos(a) * 13, 15 + Math.sin(a) * 13, 1, M.GLOW); }
    r.circle(16, 15, 8, M.BASE);
    eye(r, 13, 14, true); eye(r, 18, 14, true);
  },
  olho: (r, v) => {
    for (let i = 0; i < 5; i++) r.line(10 + i * 3, 22, 8 + i * 4 + v * 2, 31, M.ACCENT, 2);
    r.circle(16, 14, 11, M.BASE);
    r.circle(16, 14, 7, M.WHITE);
    r.circle(17, 14, 4, M.ACCENT);
    r.circle(17, 14, 2, M.PUPIL);
    r.dot(14, 11, M.WHITE);
    for (const [x, y] of [[6, 4], [26, 4], [16, 1]]) { r.line(16, 10, x, y, M.BASE, 2); r.circle(x, y, 2, M.WHITE); r.dot(x, y, M.PUPIL); }
  },
  tomo: (r) => {
    r.poly([[4, 10], [16, 14], [28, 10], [28, 26], [16, 30], [4, 26]], M.BASE);
    r.poly([[6, 11], [16, 15], [16, 28], [6, 25]], M.WHITE);
    r.poly([[16, 15], [26, 11], [26, 25], [16, 28]], M.WHITE);
    r.line(16, 14, 16, 30, M.ACCENT);
    for (let i = 0; i < 5; i++) r.dot(8 + i * 4, 20 + (i % 2) * 2, M.BONE);
    r.ellipse(11, 6, 3, 3, M.GLOW); r.ellipse(21, 6, 3, 3, M.GLOW); r.dot(11, 6, M.PUPIL); r.dot(21, 6, M.PUPIL);
    for (let x = 7; x < 26; x += 3) r.dot(x, 24, M.DARK);
  },
  aberracao: (r, v) => {
    r.ellipse(16, 18, 12, 10, M.BASE);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI + Math.PI; r.line(16, 22, 16 + Math.cos(a) * 15, 30 + Math.sin(a) * -1, M.ACCENT, 2); }
    for (const [x, y] of [[10, 14], [17, 11], [22, 17], [13, 20]]) { r.circle(x, y, 2.5, M.WHITE); r.dot(x, y, M.PUPIL); }
    r.ellipse(19, 23, 4, 2, M.DARK);
    for (let x = 16; x < 23; x += 2) r.dot(x, 22, M.BONE);
    if (v > 0.5) r.circle(25, 9, 3, M.GLOW);
  },
  lagarto: (r, v) => {
    r.ellipse(14, 21, 9, 4, M.BASE);
    r.ellipse(24, 19, 5, 3.5, M.BASE);
    r.poly([[27, 18], [32, 20], [27, 22]], M.BASE);
    r.line(5, 21, 0, 25 + v * 3, M.BASE, 2);
    for (let x = 8; x < 22; x += 3) r.poly([[x, 18], [x + 1, 15], [x + 2, 18]], M.ACCENT);
    legs(r, [8, 18], 23, 28, 2);
    eye(r, 25, 18);
    r.line(26, 22, 31, 22, M.DARK);
  },
  dragao: (r, v) => {
    r.ellipse(13, 20, 9, 6, M.BASE);
    r.line(20, 17, 25, 8, M.BASE, 4);
    r.ellipse(27, 7, 5, 3.5, M.BASE);
    r.poly([[29, 6], [32, 8], [29, 10]], M.BASE);
    r.line(25, 4, 22, 0, M.BONE); r.line(28, 4, 27, 0, M.BONE);
    r.poly([[8, 16], [4, 2], [12, 8], [16, 2], [18, 15]], M.ACCENT);
    r.line(4, 21, 0, 28, M.BASE, 3);
    legs(r, [7, 16], 24, 30, 3);
    for (let x = 8; x < 20; x += 3) r.poly([[x, 15], [x + 1, 13], [x + 2, 15]], M.ACCENT);
    eye(r, 28, 6);
    if (v > 0.3) { r.line(32, 9, 32, 9, M.FIRE); r.dot(31, 10, M.FIRE); }
  },
  sapo: (r, v) => {
    r.ellipse(16, 21, 11, 7, M.BASE);
    r.circle(11, 13, 4, M.BASE); r.circle(21, 13, 4, M.BASE);
    eye(r, 10, 12, true); eye(r, 20, 12, true);
    r.line(9, 21, 23, 21, M.DARK);
    for (const [x, y] of [[8, 18], [14, 24], [22, 18], [18, 25]]) r.circle(x, y, 1.5 + v, M.ACCENT);
    r.ellipse(6, 27, 5, 2, M.BASE); r.ellipse(26, 27, 5, 2, M.BASE);
  },
  sereia: (r, v) => {
    r.circle(14, 8, 4, M.SKIN);
    r.poly([[10, 6], [14, 2], [18, 6], [20, 18], [8, 16]], M.HAIR);
    r.circle(14, 8, 3, M.SKIN);
    eye(r, 12, 8); eye(r, 15, 8);
    r.ellipse(14, 15, 4, 4, M.SKIN);
    r.rect(11, 13, 7, 2, M.ACCENT);
    for (let y = 18; y < 28; y++) r.ellipse(14 + (y - 18) * 0.8, y, 4.5 - (y - 18) * 0.3, 1, M.BASE);
    r.poly([[20, 26], [28, 22 + v * 2], [26, 30], [22, 29]], M.ACCENT);
    r.line(10, 14, 6, 19, M.SKIN, 2);
  },
  polvo: (r, v) => {
    r.ellipse(16, 10, 9, 9, M.BASE);
    for (let i = 0; i < 6; i++) {
      const x0 = 8 + i * 3.2;
      for (let y = 17; y < 31; y++) r.circle(x0 + Math.sin(y / 3 + i + v * 2) * 2, y, 1.6 - (y - 17) / 20, M.BASE);
    }
    for (let i = 0; i < 4; i++) r.dot(10 + i * 4, 26, M.ACCENT);
    r.ellipse(12, 5, 2, 2, M.ACCENT);
    eye(r, 12, 11, true); eye(r, 18, 11, true);
  },
  enguia: (r, v) => {
    for (let x = 1; x < 26; x++) r.ellipse(x, 18 + Math.sin(x / 4 + v * 2) * 5, 2.5, 2.5, M.BASE);
    r.ellipse(27, 14, 4, 3, M.BASE);
    for (let x = 3; x < 25; x += 4) r.dot(x, 18 + Math.sin(x / 4 + v * 2) * 5, M.GLOW);
    eye(r, 28, 13);
    r.line(29, 16, 31, 16, M.DARK);
    r.line(2, 14, 4, 12, M.GLOW); r.line(8, 11, 10, 9, M.GLOW);
  },
  tartaruga: (r) => {
    r.ellipse(14, 19, 11, 8, M.ACCENT);
    r.ellipse(14, 17, 9, 6, M.BASE);
    for (const [x, y] of [[10, 15], [16, 14], [13, 19], [19, 18]]) r.circle(x, y, 2, M.ACCENT);
    for (const [x, y] of [[8, 11], [14, 10], [20, 11]]) r.poly([[x, y], [x + 1, y - 4], [x + 2, y]], M.BONE);
    r.ellipse(26, 19, 4, 3, M.ACCENT);
    eye(r, 27, 18);
    legs(r, [6, 18], 24, 29, 3, M.ACCENT);
  },
  caranguejo: (r, v) => {
    r.ellipse(16, 20, 10, 6, M.BASE);
    for (let i = 0; i < 3; i++) { r.line(8 - i, 22, 3 - i * 2, 28, M.BASE); r.line(24 + i, 22, 29 + i * 2, 28, M.BASE); }
    r.line(8, 17, 4, 11, M.BASE, 2); r.ellipse(4, 9, 3.5, 3, M.ACCENT); r.line(2, 7, 0, 5 + v, M.ACCENT);
    r.line(24, 17, 28, 11, M.BASE, 2); r.ellipse(28, 9, 3.5, 3, M.ACCENT); r.line(30, 7, 32, 5 + v, M.ACCENT);
    r.line(13, 15, 13, 11, M.BASE); r.line(19, 15, 19, 11, M.BASE);
    r.dot(13, 10, M.EYE); r.dot(19, 10, M.EYE);
    for (let x = 10; x < 23; x += 3) r.dot(x, 18, M.ACCENT);
  },
  diabrete: (r, v) => {
    r.ellipse(16, 20, 5, 6, M.BASE);
    r.circle(16, 11, 5, M.BASE);
    r.poly([[12, 8], [10, 1], [14, 6]], M.BONE); r.poly([[20, 8], [22, 1], [18, 6]], M.BONE);
    eye(r, 13, 11); eye(r, 17, 11);
    r.line(13, 14, 19, 14, M.DARK); r.dot(15, 15, M.BONE);
    r.poly([[11, 17], [2, 12], [4, 20]], M.ACCENT); r.poly([[21, 17], [30, 12], [28, 20]], M.ACCENT);
    r.line(16, 26, 24, 30, M.BASE); r.poly([[24, 29], [27, 30], [25, 27]], M.BASE);
    r.circle(26, 18 + v * 2, 2.5, M.FIRE);
  },
  mariposa: (r, v) => {
    r.ellipse(6 + 4, 12, 9, 7, M.ACCENT); r.ellipse(22, 12, 9, 7, M.ACCENT);
    r.ellipse(9, 22, 6, 5, M.BASE); r.ellipse(23, 22, 6, 5, M.BASE);
    r.circle(9, 12, 3, M.GLOW); r.circle(23, 12, 3, M.GLOW);
    r.ellipse(16, 17, 2.5, 9, M.BASE2);
    r.line(15, 8, 12, 2 + v * 2, M.DARK); r.line(17, 8, 20, 2 + v * 2, M.DARK);
    r.dot(15, 10, M.EYE); r.dot(17, 10, M.EYE);
  },
  parasita: (r, v) => {
    r.ellipse(16, 18, 9, 6, M.BASE);
    for (let i = 0; i < 4; i++) r.line(10 + i * 4, 22, 7 + i * 5, 30, M.ACCENT, 1);
    r.ellipse(16, 16, 6, 3, M.GLOW);
    r.line(24, 16, 31, 10 + v * 3, M.ACCENT, 2); r.circle(31, 9, 1.5, M.GLOW);
    for (const x of [12, 16, 20]) { r.dot(x, 13, M.WHITE); r.dot(x, 14, M.PUPIL); }
  },
  fragmento: (r, v) => {
    r.poly([[16, 1], [24, 12], [20, 30], [11, 30], [8, 12]], M.BASE);
    r.poly([[16, 4], [20, 12], [16, 26], [12, 12]], M.ACCENT);
    r.line(16, 4, 16, 26, M.WHITE);
    r.poly([[4, 8 + v * 4], [7, 4], [8, 10]], M.BASE); r.poly([[27, 20], [30, 16], [31, 23]], M.BASE);
    r.dot(14, 14, M.EYE); r.dot(18, 14, M.EYE);
  },
  hidra: (r, v) => {
    r.ellipse(14, 23, 11, 7, M.BASE);
    for (const [hx, hy] of [[5, 7], [16, 3], [27, 8]]) {
      r.line(14, 20, hx, hy + 4, M.BASE, 4);
      r.ellipse(hx, hy + 2, 3.5, 3, M.BASE);
      r.dot(hx + 1, hy + 1, M.EYE);
      r.dot(hx + 3, hy + 3, M.BONE);
    }
    for (let x = 6; x < 22; x += 3) r.dot(x, 19, M.ACCENT);
    legs(r, [7, 18], 27, 31, 3);
    void v;
  },
  fenda: (r, v) => {
    r.poly([[16, 0], [22, 8], [19, 16], [24, 24], [16, 32], [9, 22], [13, 15], [8, 7]], M.BASE);
    r.poly([[16, 3], [19, 9], [16, 16], [20, 23], [16, 28], [12, 22], [15, 15], [12, 8]], M.DARK);
    r.line(16, 4, 16, 28, M.GLOW);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + v; r.circle(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, 1.2, M.ACCENT); }
    r.dot(15, 12, M.EYE); r.dot(17, 18, M.EYE);
  },
  coracao: (r, v) => {
    r.circle(11, 13, 7, M.BASE); r.circle(21, 13, 7, M.BASE);
    r.poly([[4, 15], [28, 15], [16, 29]], M.BASE);
    for (let i = 0; i < 6; i++) r.line(16, 18, 2 + i * 6, 31, M.ACCENT, 1);
    r.circle(16, 16, 4 + v, M.GLOW);
    for (const [x, y] of [[9, 9], [22, 10], [14, 22]]) r.circle(x, y, 1.5, M.ACCENT);
    r.dot(16, 15, M.EYE);
  },
  torreta: (r) => {
    r.poly([[8, 30], [24, 30], [20, 18], [12, 18]], M.METAL);
    r.rect(10, 12, 12, 8, M.BASE);
    r.rect(20, 14, 11, 3, M.METAL);
    r.circle(16, 15, 2, M.GLOW);
    r.line(8, 30, 4, 31, M.METAL); r.line(24, 30, 28, 31, M.METAL);
  },
  drone: (r) => {
    r.ellipse(16, 16, 6, 4, M.BASE);
    r.line(4, 12, 28, 12, M.METAL); r.ellipse(4, 11, 4, 1, M.ACCENT); r.ellipse(28, 11, 4, 1, M.ACCENT);
    r.circle(16, 17, 2, M.GLOW);
    r.line(13, 20, 11, 24, M.METAL); r.line(19, 20, 21, 24, M.METAL);
  },
  placa: (r) => {
    r.poly([[6, 6], [26, 4], [28, 26], [8, 29]], M.BASE);
    r.poly([[9, 8], [24, 7], [25, 24], [10, 26]], M.ACCENT);
    for (const [x, y] of [[8, 7], [25, 5], [26, 25], [9, 27]]) r.circle(x, y, 1, M.METAL);
    r.line(12, 12, 20, 20, M.DARK); r.line(20, 12, 15, 17, M.DARK);
  },
  casulo: (r) => {
    r.line(16, 0, 16, 5, M.WHITE);
    r.ellipse(16, 18, 8, 13, M.BASE);
    for (let y = 8; y < 30; y += 3) r.line(9, y, 23, y + 2, M.ACCENT);
    r.ellipse(16, 14, 2, 3, M.DARK); r.dot(16, 13, M.EYE);
  },
  caldeirao: (r, v) => {
    r.ellipse(16, 21, 12, 9, M.DARK);
    r.ellipse(16, 13, 11, 3, M.BASE2);
    r.ellipse(16, 13, 9, 2, M.ACCENT);
    for (let i = 0; i < 4; i++) r.circle(9 + i * 5, 9 - (i % 2) * 3 - v * 2, 1.5 + (i % 2), M.ACCENT);
    r.rect(7, 28, 3, 3, M.DARK); r.rect(22, 28, 3, 3, M.DARK);
    r.ellipse(16, 30, 9, 2, M.FIRE);
  },
  espelho: (r) => {
    r.ellipse(16, 14, 10, 13, M.GOLD);
    r.ellipse(16, 14, 8, 11, M.BASE);
    r.line(11, 6, 18, 20, M.WHITE); r.line(14, 5, 20, 15, M.WHITE);
    r.rect(13, 27, 6, 4, M.GOLD);
  },
  comporta: (r) => {
    r.rect(4, 4, 24, 26, M.WOOD);
    for (let y = 7; y < 30; y += 5) r.line(4, y, 27, y, M.DARK);
    r.rect(10, 12, 12, 12, M.DARK);
    for (let i = 0; i < 6; i++) r.line(10 + i * 2, 24, 8 + i * 3, 31, M.WATER, 2);
    r.circle(16, 18, 4, M.METAL); r.line(16, 14, 16, 22, M.DARK); r.line(12, 18, 20, 18, M.DARK);
  },
  tentaculo: (r, v) => {
    for (let y = 2; y < 31; y++) r.circle(16 + Math.sin(y / 4 + v * 3) * 5, y, 2 + (y / 31) * 4, M.BASE);
    for (let y = 6; y < 30; y += 4) r.circle(15 + Math.sin(y / 4 + v * 3) * 5, y, 1.3, M.ACCENT);
  },
  sigilo: (r) => {
    r.circle(16, 16, 12, M.BASE);
    r.circle(16, 16, 10, M.NONE);
    r.circle(16, 16, 9, M.DARK);
    r.poly([[16, 7], [24, 21], [8, 21]], M.GLOW);
    r.poly([[16, 11], [21, 19], [11, 19]], M.DARK);
    r.circle(16, 16, 2, M.GLOW);
  },
};

/** Apelidos: espécies que compartilham o corpo base. */
export const SHAPE_ALIASES: Record<string, string> = {
  coruja: 'ave', mosquito: 'vespa', gafanhoto: 'vespa', formiga: 'besouro', crocodilo: 'lagarto', sanguessuga: 'verme',
  lesma: 'slime', coral: 'flor', 'peixe-homem': 'gnoll', carnical: 'zumbi', troll: 'gigante', yeti: 'gigante', bisao: 'javali',
  cabra: 'cervo', marionete: 'armadura', tita: 'gigante', bruxa: 'humano', 'rei-gelo': 'humano', almirante: 'humano',
  imperador: 'humano', arquivista: 'humano', kraken: 'polvo', fornalha: 'golem', 'coracao-micelio': 'coracao',
};

export function drawShape(shape: string, v: number): RoleCanvas {
  const r = new RoleCanvas(32, 32);
  const fn = SHAPES[shape] ?? SHAPES[SHAPE_ALIASES[shape] ?? ''] ?? SHAPES.slime;
  fn(r, v);
  return r;
}

export function hasShape(shape: string): boolean {
  return !!(SHAPES[shape] ?? SHAPES[SHAPE_ALIASES[shape] ?? '']);
}
