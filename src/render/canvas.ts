import { encodePng } from './png.ts';
import { glyph, GLYPH_H } from './font.ts';

export type RGBA = [number, number, number, number];

export function hex(c: string, a = 255): RGBA {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}
export const toHex = (c: RGBA) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t].map(Math.round) as RGBA;
}
/** Escurece puxando levemente para o violeta (sombras frias combinam com a fantasia sombria). */
export function shade(c: RGBA, t: number): RGBA {
  return mix(c, [28, 18, 40, 255], t);
}
export function light(c: RGBA, t: number): RGBA {
  return mix(c, [255, 248, 225, 255], t);
}

export class Canvas {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg?: RGBA) {
    this.data = new Uint8Array(w * h * 4);
    if (bg) this.fill(bg);
  }

  fill(c: RGBA) {
    for (let i = 0; i < this.w * this.h; i++) this.data.set(c, i * 4);
  }

  get(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  set(x: number, y: number, c: RGBA) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c[3] === 0) return;
    const i = (y * this.w + x) * 4;
    if (c[3] === 255) { this.data.set(c, i); return; }
    const a = c[3] / 255;
    const ba = this.data[i + 3] / 255;
    const outA = a + ba * (1 - a);
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.round((c[k] * a + this.data[i + k] * ba * (1 - a)) / Math.max(outA, 1e-6));
    this.data[i + 3] = Math.round(outA * 255);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  frame(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let i = 0; i < w; i++) { this.set(x + i, y, c); this.set(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.set(x, y + j, c); this.set(x + w - 1, y + j, c); }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Copia outra tela (com transparência), opcionalmente ampliando com vizinho mais próximo. */
  blit(src: Canvas, x: number, y: number, scale = 1) {
    for (let j = 0; j < src.h * scale; j++) for (let i = 0; i < src.w * scale; i++) {
      this.set(x + i, y + j, src.get(Math.floor(i / scale), Math.floor(j / scale)));
    }
  }

  scaled(n: number): Canvas {
    const out = new Canvas(this.w * n, this.h * n);
    out.blit(this, 0, 0, n);
    return out;
  }

  /** Texto em fonte de pixel 3×5 (maiúsculas). */
  text(x: number, y: number, s: string, c: RGBA, scale = 1, shadow?: RGBA): number {
    let cx = x;
    for (const ch of s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()) {
      const gph = glyph(ch);
      for (let j = 0; j < GLYPH_H; j++) for (let i = 0; i < gph.w; i++) {
        if (!gph.rows[j][i]) continue;
        if (shadow) this.rect(cx + (i + 1) * scale, y + (j + 1) * scale, scale, scale, shadow);
        this.rect(cx + i * scale, y + j * scale, scale, scale, c);
      }
      cx += (gph.w + 1) * scale;
    }
    return cx - x;
  }

  png(): Buffer {
    return encodePng(this.w, this.h, this.data);
  }
}

export function textWidth(s: string, scale = 1): number {
  let w = 0;
  for (const ch of s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()) w += (glyph(ch).w + 1) * scale;
  return w;
}
