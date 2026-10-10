import { Canvas, hex, light, shade, mix, type RGBA } from './canvas.ts';

/**
 * Pintura por "materiais": as formas são desenhadas com papéis (corpo, detalhe, olho…)
 * e só depois recebem cor, sombra, luz e contorno. Assim todas as criaturas, itens e
 * ícones compartilham a mesma iluminação (luz vindo de cima à esquerda).
 */
export const M = {
  NONE: 0, BASE: 1, ACCENT: 2, EYE: 3, BONE: 4, DARK: 5, GLOW: 6, METAL: 7, SKIN: 8, HAIR: 9, CLOTH: 10, LEATHER: 11, WOOD: 12,
  GEM: 13, FIRE: 14, WATER: 15, LEAF: 16, PUPIL: 17, WHITE: 18, GOLD: 19, BASE2: 20,
} as const;
export type Mat = (typeof M)[keyof typeof M];

export interface Palette { [mat: number]: string | undefined }

export class RoleCanvas {
  readonly px: Uint8Array;
  /** Pixels marcados como "sem sombreamento" (ex.: olhos, brilhos). */
  readonly flat: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h);
    this.flat = new Uint8Array(w * h);
  }
  get(x: number, y: number): number {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }
  set(x: number, y: number, m: number, flat = false) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = m;
    this.flat[y * this.w + x] = flat ? 1 : 0;
  }
  rect(x: number, y: number, w: number, h: number, m: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, m: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, m);
    }
  }
  circle(cx: number, cy: number, r: number, m: number) { this.ellipse(cx, cy, r, r, m); }
  /** Linha com espessura. */
  line(x0: number, y0: number, x1: number, y1: number, m: number, t = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      if (t <= 1) this.set(x, y, m);
      else this.ellipse(x, y, t / 2, t / 2, m);
    }
  }
  poly(points: [number, number][], m: number) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        const yy = y + 0.5;
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, m);
    }
  }
  dot(x: number, y: number, m: number) { this.set(x, y, m, true); }
  /** Espelha a metade esquerda para a direita (simetria frontal). */
  mirror() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w / 2; x++) {
      const i = y * this.w + x, j = y * this.w + (this.w - 1 - x);
      if (this.px[i]) { this.px[j] = this.px[i]; this.flat[j] = this.flat[i]; }
    }
  }
  flipX(): RoleCanvas {
    const o = new RoleCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      o.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x];
      o.flat[y * this.w + (this.w - 1 - x)] = this.flat[y * this.w + x];
    }
    return o;
  }
  /** Ampliação 2× suavizada (Scale2x/EPX), usada para dar mais presença aos chefes. */
  scale2x(): RoleCanvas {
    const o = new RoleCanvas(this.w * 2, this.h * 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.get(x, y), a = this.get(x, y - 1), b = this.get(x + 1, y), c = this.get(x - 1, y), d = this.get(x, y + 1);
      const f = this.flat[y * this.w + x] === 1;
      const e0 = c === a && c !== d && a !== b ? a : p;
      const e1 = a === b && a !== c && b !== d ? b : p;
      const e2 = d === c && d !== b && c !== a ? c : p;
      const e3 = b === d && b !== a && d !== c ? d : p;
      o.set(2 * x, 2 * y, e0, f); o.set(2 * x + 1, 2 * y, e1, f); o.set(2 * x, 2 * y + 1, e2, f); o.set(2 * x + 1, 2 * y + 1, e3, f);
    }
    return o;
  }
}

export interface RenderOpts {
  outline?: string | 'auto';
  /** Intensidade de sombra e luz. */
  shadeAmt?: number;
  lightAmt?: number;
  glowOutline?: string;
}

/** Converte papéis em cores com luz de cima-esquerda, sombra embaixo-direita e contorno automático. */
export function renderRoles(rc: RoleCanvas, pal: Palette, o: RenderOpts = {}): Canvas {
  const out = new Canvas(rc.w, rc.h);
  const sAmt = o.shadeAmt ?? 0.32, lAmt = o.lightAmt ?? 0.22;
  const cache = new Map<number, RGBA>();
  const col = (m: number): RGBA => {
    let c = cache.get(m);
    if (!c) { c = hex(pal[m] ?? DEFAULT_PAL[m] ?? '#ff00ff'); cache.set(m, c); }
    return c;
  };
  for (let y = 0; y < rc.h; y++) for (let x = 0; x < rc.w; x++) {
    const m = rc.get(x, y);
    if (!m) continue;
    let c = col(m);
    if (!rc.flat[y * rc.w + x] && m !== M.GLOW && m !== M.EYE && m !== M.PUPIL) {
      const up = rc.get(x, y - 1) === m, left = rc.get(x - 1, y) === m;
      const down = rc.get(x, y + 1) === m, right = rc.get(x + 1, y) === m;
      const down2 = rc.get(x, y + 2) === m;
      if (!down || (!right && !down2)) c = shade(c, sAmt);
      else if (!up || !left) c = light(c, lAmt);
    }
    out.set(x, y, c);
  }
  if (o.outline !== undefined) {
    const solid = (x: number, y: number) => rc.get(x, y) !== 0;
    const base = o.outline === 'auto' ? undefined : hex(o.outline);
    for (let y = 0; y < rc.h; y++) for (let x = 0; x < rc.w; x++) {
      if (solid(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => solid(x + dx, y + dy));
      if (!n) continue;
      const neighbor = rc.get(x + n[0], y + n[1]);
      const oc = base ?? mix(shade(col(neighbor), 0.75), [16, 10, 24, 255], 0.5);
      out.set(x, y, oc);
    }
  }
  if (o.glowOutline) {
    const g = hex(o.glowOutline, 140);
    const snap = new Canvas(out.w, out.h);
    snap.data.set(out.data);
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
      if (snap.get(x, y)[3]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => snap.get(x + dx, y + dy)[3] > 0)) out.set(x, y, g);
    }
  }
  return out;
}

export const DEFAULT_PAL: Palette = {
  [M.EYE]: '#f4ecd0', [M.PUPIL]: '#18101c', [M.BONE]: '#e8e0c8', [M.DARK]: '#2a2030', [M.WHITE]: '#f8f4ec', [M.GLOW]: '#c080ff',
  [M.METAL]: '#9aa0aa', [M.GOLD]: '#e0b040', [M.WOOD]: '#8a5a32', [M.LEATHER]: '#8a5a3a', [M.CLOTH]: '#6a5a8a', [M.GEM]: '#60c0f0',
  [M.FIRE]: '#f08030', [M.WATER]: '#4a9ad0', [M.LEAF]: '#5aa040', [M.SKIN]: '#d9a07a', [M.HAIR]: '#5a3a22',
};
