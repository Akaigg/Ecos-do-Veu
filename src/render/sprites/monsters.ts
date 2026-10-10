import { monsterById } from '../../data/monsters/index.ts';
import { enemyObjectById, minionById } from '../../data/minions.ts';
import type { Element, MonsterDef } from '../../data/types.ts';
import { Canvas, hex, toHex, light, shade, mix } from '../canvas.ts';
import { M, renderRoles, RoleCanvas, type Palette } from '../paint.ts';
import { drawShape } from './creatures.ts';
import { hashString } from '../../game/rng.ts';

export const ELEMENT_GLOW: Record<Element, string> = {
  fisico: '#f0e8c0', fogo: '#ffb030', gelo: '#a0f0ff', raio: '#fff060', veneno: '#a0f040', sombra: '#c070ff', luz: '#fff8c0', arcano: '#e090ff', natureza: '#80f080',
};

function paletteFor(m: Pick<MonsterDef, 'colors' | 'elem'>): Palette {
  const base = hex(m.colors[0]);
  const acc = hex(m.colors[1]);
  return {
    [M.BASE]: m.colors[0], [M.ACCENT]: m.colors[1], [M.BASE2]: toHex(light(base, 0.3)),
    [M.EYE]: ELEMENT_GLOW[m.elem], [M.GLOW]: ELEMENT_GLOW[m.elem],
    [M.SKIN]: toHex(mix(base, hex('#d9a07a'), 0.5)), [M.HAIR]: toHex(shade(acc, 0.2)),
    [M.DARK]: toHex(shade(base, 0.7)),
  };
}

/** Adornos das variantes: deixam claro, à primeira vista, qual mecânica a criatura tem. */
function variantOverlay(r: RoleCanvas, mechanic: string) {
  switch (mechanic) {
    case 'lideranca': r.poly([[3, 6], [3, 1], [5, 3], [7, 0], [9, 3], [11, 1], [11, 6]], M.GOLD); r.dot(7, 4, M.GEM); break;
    case 'carapaca': for (const [x, y] of [[8, 12], [13, 10], [18, 11]]) r.poly([[x, y], [x + 4, y - 2], [x + 6, y + 2], [x + 2, y + 3]], M.METAL); break;
    case 'caca': r.line(2, 2, 7, 7, M.BONE); r.line(7, 2, 2, 7, M.BONE); break;
    case 'instabilidade': for (const [x, y] of [[4, 4], [27, 6], [6, 26], [28, 25]]) r.dot(x, y, M.GLOW); break;
    case 'drenagem': for (const x of [4, 7]) { r.line(x, 2, x, 6, M.FIRE); r.dot(x, 7, M.FIRE); } break;
    case 'regeneracao': r.poly([[2, 6], [6, 1], [7, 6]], M.LEAF); r.poly([[6, 6], [10, 3], [9, 7]], M.LEAF); break;
    case 'controle': r.circle(5, 5, 3, M.GLOW); r.circle(5, 5, 1, M.PUPIL); break;
    case 'protecao': r.poly([[2, 1], [9, 1], [9, 5], [5.5, 9], [2, 5]], M.METAL); r.line(5, 2, 5, 7, M.GOLD); break;
    case 'transformacao': r.circle(5, 5, 3, M.FIRE); r.circle(6, 4, 2, M.WATER); break;
    case 'invocacao': for (const [x, y] of [[3, 3], [7, 2], [5, 6]]) r.dot(x, y, M.GLOW); r.circle(5, 4, 1, M.GLOW); break;
  }
}

const BOSS_EXTRAS: Record<string, (r: RoleCanvas) => void> = {
  'bruxa-brejo': (r) => { r.poly([[18, 4], [46, 4], [34, -10], [30, -10]], M.DARK); r.poly([[12, 8], [52, 8], [50, 4], [14, 4]], M.DARK); },
  'rei-sob-gelo': (r) => { for (let i = 0; i < 5; i++) r.poly([[20 + i * 6, 8], [22 + i * 6, 0], [24 + i * 6, 8]], M.WATER); },
  'almirante-afogado': (r) => { r.poly([[12, 8], [52, 8], [44, 0], [20, 0]], M.DARK); r.circle(32, 4, 2, M.GOLD); },
  'imperador-sem-rosto': (r) => { r.ellipse(32, 17, 9, 9, M.WHITE); for (let i = 0; i < 5; i++) r.poly([[20 + i * 6, 6], [22 + i * 6, -2], [24 + i * 6, 6]], M.GOLD); },
  'arquivista-proibido': (r) => { r.poly([[2, 40], [14, 36], [14, 52], [2, 56]], M.ACCENT); r.line(8, 38, 8, 54, M.WHITE); },
  'rei-goblin': (r) => { r.poly([[20, 2], [44, 2], [42, 10], [22, 10]], M.METAL); r.line(32, 0, 32, 2, M.METAL); },
  'presa-raiz': (r) => { r.line(40, 20, 50, 4, M.LEAF, 2); r.line(30, 18, 34, 6, M.LEAF, 2); },
};

const cache = new Map<string, Canvas>();

/** Sprite pequeno (32×32) para miniaturas; chefes ganham versão 64×64 com mais detalhes. */
export function monsterSprite(id: string, opts: { boss64?: boolean } = {}): Canvas {
  const key = `${id}:${opts.boss64 ? 64 : 32}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = monsterById.get(id);
  if (!m) return new Canvas(32, 32);
  const v = (hashString(m.id) % 1000) / 1000;
  let r = drawShape(m.shape, v);
  if (m.rank === 'variante') {
    const mech = m.tags.find((t) => t.startsWith('mecanica:'))?.slice(9);
    if (mech) variantOverlay(r, mech);
  }
  const pal = paletteFor(m);
  let glowOutline: string | undefined;
  if (m.rank === 'chefe') {
    if (opts.boss64) {
      r = r.scale2x();
      BOSS_EXTRAS[m.id]?.(r);
      // Coroa de chefe
      r.poly([[50, 12], [50, 4], [53, 8], [56, 2], [59, 8], [62, 4], [62, 12]], M.GOLD);
      r.dot(56, 9, M.GEM);
    } else r.poly([[24, 6], [24, 1], [26, 3], [28, 0], [30, 3], [31, 1], [31, 6]], M.GOLD);
    glowOutline = ELEMENT_GLOW[m.elem];
  }
  const out = renderRoles(r, { ...pal, [M.GEM]: '#f04060' }, { outline: 'auto', glowOutline });
  cache.set(key, out);
  return out;
}

/** Miniatura ampliada pronta para o Discord (pixels nítidos). */
export function monsterThumb(id: string, scale = 3): Buffer {
  const m = monsterById.get(id);
  const big = m?.rank === 'chefe';
  const sprite = monsterSprite(id, { boss64: big });
  return sprite.scaled(big ? Math.max(1, Math.round(scale / 1.5)) : scale).png();
}

export { hex };

/** Sprite de lacaios e partes de chefes (placas, casulos, caldeirões…). */
export function minionSprite(id: string): Canvas {
  const key = `min:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = minionById.get(id) ?? enemyObjectById.get(id);
  if (!def) return monsterSprite('slime-verde');
  const r = drawShape(def.shape, 0.5);
  const out = renderRoles(r, paletteFor({ colors: def.colors, elem: 'arcano' }), { outline: 'auto' });
  cache.set(key, out);
  return out;
}
