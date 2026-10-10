import { classById, nodesByClass, type TalentNode } from '../data/classes/index.ts';
import { REGIONS, regionById } from '../data/regions.ts';
import { guildUpgradeById } from '../data/social.ts';
import type { CombatState, Fighter } from '../game/combat/state.ts';
import { Canvas, hex, light, mix, shade, textWidth, type RGBA } from './canvas.ts';
import { M, renderRoles, RoleCanvas } from './paint.ts';
import { itemIcon, skillIcon, glyphIcon } from './sprites/icons.ts';
import { monsterSprite, minionSprite } from './sprites/monsters.ts';
import { hashString } from '../game/rng.ts';

const BG = hex('#16111f');
const PANEL = hex('#221a2e');
const TEXT = hex('#efe6d2');
const MUTED = hex('#8a8094');

// ===================================================================== árvore de habilidades

export function skillTreeImage(classId: string, learned: string[], level: number, states: Record<string, 'aprendido' | 'disponivel' | 'bloqueado' | 'excluido' | 'nivel'>): Canvas {
  const cls = classById.get(classId)!;
  const cellW = 30, cellH = 30, treeW = cellW * 3 + 12;
  const c = new Canvas(treeW * 3 + 8, 7 * cellH + 34, BG);
  const nodes = nodesByClass(classId);
  cls.trees.forEach((t, ti) => {
    const ox = 6 + ti * treeW, oy = 26;
    c.rect(ox - 2, 2, treeW - 4, c.h - 4, PANEL);
    const label = t.name.toUpperCase();
    c.text(ox + Math.max(0, (treeW - 8 - textWidth(label)) / 2), 8, label, light(hex(cls.color), 0.4));
    const tn = nodes.filter((n) => n.treeId === t.id);
    const pos = (n: TalentNode) => [ox + n.col * cellW + 3 + 12, oy + n.row * cellH + 12] as const;
    // Ligações
    for (const n of tn) {
      const [x1, y1] = pos(n);
      for (const req of [...n.requiresAll, ...n.requiresAny]) {
        const p = tn.find((x) => x.id === req);
        if (!p) continue;
        const [x0, y0] = pos(p);
        const on = learned.includes(n.id) && learned.includes(p.id);
        c.line(x0, y0, x1, y1, on ? hex('#e0b040') : hex('#4a4058'));
      }
    }
    for (const n of tn) {
      const [x, y] = pos(n);
      const st = states[n.id] ?? 'bloqueado';
      const icon = skillIcon(n.icon, cls.color, n.kind, st === 'aprendido' ? 'ok' : st === 'disponivel' ? 'ok' : st === 'excluido' ? 'lock' : 'off');
      c.blit(icon, x - 12, y - 12);
      if (st === 'disponivel') c.frame(x - 13, y - 13, 26, 26, hex('#60f080'));
      if (st === 'nivel') c.text(x - 4, y + 9, String(n.reqLevel), MUTED);
      if (st === 'excluido') { c.line(x - 10, y - 10, x + 10, y + 10, hex('#c04040')); }
    }
  });
  c.text(6, c.h - 7, `NIVEL ${level}`, MUTED);
  return c.scaled(2);
}

// ===================================================================== catálogo (loja, inventário, mercado)

export interface CatalogEntry { icon: Canvas; label?: string; badge?: string; dim?: boolean; color?: string }

/** Grade compacta de ícones 16×16 ampliados 2×, numerados — imagem pequena e leve. */
export function catalogImage(entries: CatalogEntry[], cols = 8): Canvas {
  const cw = 40, ch = 46;
  const rows = Math.max(1, Math.ceil(entries.length / cols));
  const c = new Canvas(cols * cw + 4, rows * ch + 4, BG);
  entries.forEach((e, i) => {
    const x = 2 + (i % cols) * cw, y = 2 + Math.floor(i / cols) * ch;
    c.rect(x + 1, y + 1, cw - 2, ch - 2, PANEL);
    if (e.color) c.frame(x + 1, y + 1, cw - 2, ch - 2, hex(e.color));
    c.blit(e.icon, x + 4, y + 3, 2);
    if (e.dim) for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) if ((j + k) % 2 === 0) c.set(x + 4 + k, y + 3 + j, [22, 17, 31, 160]);
    const num = String(i + 1);
    c.text(x + 3, y + ch - 9, num, TEXT);
    if (e.badge) c.text(x + cw - 3 - textWidth(e.badge), y + ch - 9, e.badge, hex('#e0b040'));
  });
  return c;
}

export function itemCatalog(list: { item: string; qty?: number; price?: number; dim?: boolean }[]): Canvas {
  return catalogImage(list.map((l) => ({ icon: itemIcon(l.item), badge: l.price !== undefined ? `${l.price}` : l.qty !== undefined && l.qty > 1 ? `${l.qty > 999 ? '999+' : l.qty}` : undefined, dim: l.dim })));
}

// ===================================================================== painel de batalha

function heroMini(classId: string, alive: boolean): Canvas {
  const cls = classById.get(classId);
  const r = new RoleCanvas(16, 24);
  r.ellipse(8, 5, 4, 4, M.SKIN);
  r.rect(4, 2, 8, 2, M.HAIR);
  r.poly([[3, 9], [13, 9], [12, 19], [4, 19]], M.CLOTH);
  r.rect(4, 19, 3, 5, M.DARK); r.rect(9, 19, 3, 5, M.DARK);
  r.line(3, 10, 1, 17, M.CLOTH, 2); r.line(13, 10, 15, 16, M.CLOTH, 2);
  r.dot(6, 5, M.PUPIL); r.dot(9, 5, M.PUPIL);
  const base = hex(cls?.color ?? '#6a5a8a');
  const out = renderRoles(r, { [M.CLOTH]: alive ? cls?.color : '#4a4450', [M.SKIN]: alive ? '#d9a07a' : '#6a6070', [M.HAIR]: '#3a2a22', [M.DARK]: '#2a2030' }, { outline: 'auto' });
  void base;
  return out;
}

function hpBar(c: Canvas, x: number, y: number, w: number, frac: number, shield: number, color: RGBA) {
  c.rect(x, y, w, 3, hex('#0e0a14'));
  c.rect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, frac)))), 3, color);
  if (shield > 0) c.rect(x, y - 1, Math.min(w, Math.round(w * shield)), 1, hex('#a0d0ff'));
}

/** Cena compacta da rodada: heróis à esquerda, inimigos à direita, linhas de frente e retaguarda. */
export function battleImage(st: CombatState, classOf: (f: Fighter) => string | undefined): Canvas {
  const W = 200, H = 96;
  const c = new Canvas(W, H);
  const reg = hex(regionById.get(st.context.region)?.color ?? '#4a3a6a');
  for (let y = 0; y < H; y++) c.rect(0, y, W, 1, mix(shade(reg, 0.7), BG, y / H));
  c.rect(0, 70, W, 26, shade(reg, 0.8));
  c.line(100, 8, 100, 92, [255, 255, 255, 30]);
  const heroes = st.fighters.filter((f) => f.side === 'herois' && (f.alive || f.kind === 'jogador'));
  const enemies = st.fighters.filter((f) => f.side === 'inimigos' && f.alive);
  const place = (list: Fighter[], side: 'herois' | 'inimigos') => {
    const front = list.filter((f) => f.line === 'frente'), back = list.filter((f) => f.line === 'tras');
    const colX = side === 'herois' ? { frente: 68, tras: 22 } : { frente: 116, tras: 160 };
    for (const [line, group] of [['frente', front], ['tras', back]] as const) {
      group.slice(0, 4).forEach((f, i) => {
        const n = Math.min(4, group.length);
        const y = 10 + i * (64 / Math.max(1, n)) + (n === 1 ? 20 : 0);
        const x = colX[line] + (i % 2) * 6;
        let sprite: Canvas;
        if (f.kind === 'jogador') sprite = heroMini(classOf(f) ?? 'guerreiro', f.alive);
        else if (f.monsterId) sprite = monsterSprite(f.monsterId);
        else if (f.kind === 'pet') sprite = monsterSprite(f.tags.find((t) => t.startsWith('especie:'))?.slice(8) ?? 'lobo-cinzento');
        else sprite = minionSprite(f.object?.defId ?? f.ref);
        const big = f.rank === 'chefe';
        const s = side === 'herois' && f.kind !== 'jogador' ? sprite : sprite;
        const flipped = side === 'herois' ? s : mirror(s);
        const dx = x - (big ? 8 : 0), dy = y - (big ? 8 : 0);
        c.blit(flipped, dx, dy, 1);
        hpBar(c, dx + 2, dy - 4, big ? 40 : 28, f.hp / f.maxHp, f.shield / Math.max(1, f.maxHp), f.side === 'herois' ? hex('#60d060') : hex('#e04848'));
        if (f.intent?.charging) c.text(dx + 26, dy + 2, '!', hex('#ffd040'), 2);
      });
    }
  };
  place(heroes, 'herois');
  place(enemies, 'inimigos');
  c.text(4, H - 8, `RODADA ${st.round}`, TEXT, 1, hex('#000000'));
  return c.scaled(2);
}

function mirror(s: Canvas): Canvas {
  const o = new Canvas(s.w, s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) o.set(s.w - 1 - x, y, s.get(x, y));
  return o;
}

// ===================================================================== mapa-múndi

const TERRAIN: Record<string, [string, string]> = {
  floresta: ['#3a6a32', '#2a5026'], campo: ['#a09a50', '#8a8440'], montanha: ['#7a7a8a', '#5a5a6a'], pantano: ['#4a5a3a', '#3a4a30'],
  deserto: ['#d8c080', '#c0a868'], neve: ['#dce8f4', '#b8c8dc'], costa: ['#3a7a9a', '#2a5a7a'], ruinas: ['#a08a60', '#806a48'],
  fungos: ['#8a5aa0', '#6a4080'], vulcao: ['#8a3020', '#5a2018'], veu: ['#4a2a6a', '#2a1a40'],
};

export function worldMap(current: string, visited: string[]): Canvas {
  const T = 8, cols = 30, rows = 11;
  const c = new Canvas(cols * T, rows * T + 12, hex('#1a2a40'));
  // Mar com ondas
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if ((x * 7 + y * 13) % 29 === 0) c.set(x, y, hex('#2a4060'));
  for (const reg of REGIONS) {
    const [a, b] = TERRAIN[reg.map.terrain] ?? ['#555', '#444'];
    const seen = visited.includes(reg.id);
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
      const tx = reg.map.x + dx, ty = reg.map.y + dy;
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
      if ((Math.abs(dx - 0.5) + Math.abs(dy - 0.5)) > 2.5) continue;
      for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
        const h = hashString(`${reg.id}${tx}${ty}${px}${py}`) % 100;
        let col = hex(h < 70 ? a : b);
        if (!seen) col = mix(col, hex('#2a2434'), 0.6);
        c.set(tx * T + px, ty * T + py, col);
      }
      // detalhes de terreno
      const dxp = tx * T + 3, dyp = ty * T + 3;
      if (reg.map.terrain === 'floresta' || reg.map.terrain === 'fungos') { c.set(dxp, dyp, shade(hex(a), 0.5)); c.set(dxp + 1, dyp - 1, shade(hex(a), 0.5)); }
      if (reg.map.terrain === 'montanha' || reg.map.terrain === 'vulcao') { c.line(dxp - 2, dyp + 2, dxp, dyp - 1, light(hex(a), 0.4)); c.line(dxp, dyp - 1, dxp + 2, dyp + 2, shade(hex(a), 0.4)); }
    }
  }
  // Estradas entre regiões
  for (let i = 0; i + 1 < REGIONS.length; i++) {
    const a = REGIONS[i].map, b = REGIONS[i + 1].map;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = (a.x + (b.x - a.x) * t) * T + 4, y = (a.y + (b.y - a.y) * t) * T + 4;
      if (Math.floor(t * 50) % 2 === 0) c.set(x, y, hex('#d8c8a0'));
    }
  }
  for (const reg of REGIONS) {
    const x = reg.map.x * T + 4, y = reg.map.y * T + 4;
    const seen = visited.includes(reg.id);
    c.rect(x - 2, y - 2, 5, 5, hex('#1a1020'));
    c.rect(x - 1, y - 1, 3, 3, seen ? hex('#f0e0b0') : hex('#5a5068'));
    if (reg.id === current) {
      c.frame(x - 4, y - 4, 9, 9, hex('#ff5050'));
      c.set(x, y - 6, hex('#ff5050')); c.set(x, y - 7, hex('#ff5050'));
    }
  }
  const label = `VOCE ESTA EM: ${regionById.get(current)?.name ?? current}`;
  c.rect(0, c.h - 12, c.w, 12, hex('#120c1a'));
  c.text(4, c.h - 9, label, TEXT);
  return c.scaled(3);
}

// ===================================================================== sede da guilda

export function guildHall(name: string, tag: string, upgrades: Record<string, number>, banner: { color?: string; color2?: string; symbol?: string }, members: number): Canvas {
  const W = 160, H = 96;
  const c = new Canvas(W, H);
  for (let y = 0; y < H; y++) c.rect(0, y, W, 1, mix(hex('#2a2048'), hex('#6a4a6a'), y / H));
  for (let i = 0; i < 30; i++) c.set((i * 37) % W, (i * 17) % 40, hex('#f0e8c0', 160));
  c.rect(0, 74, W, 22, hex('#3a4a2a'));
  c.rect(0, 74, W, 2, hex('#4a6a32'));
  const salao = upgrades.salao ?? 0;
  const hallW = 50 + salao * 12, hx = 80 - hallW / 2;
  const r = new RoleCanvas(W, H);
  r.rect(hx, 46 - salao * 3, hallW, 30 + salao * 3, M.WOOD);
  r.poly([[hx - 4, 46 - salao * 3], [80, 26 - salao * 4], [hx + hallW + 4, 46 - salao * 3]], M.DARK);
  r.rect(74, 60, 12, 16, M.DARK);
  for (let i = 0; i < 2 + salao; i++) { r.rect(hx + 6 + i * 14, 54 - salao * 2, 6, 6, M.GLOW); }
  if (upgrades.oficina) { r.rect(hx - 26, 54, 22, 22, M.WOOD); r.rect(hx - 20, 40, 5, 16, M.METAL); for (let i = 0; i < upgrades.oficina; i++) r.circle(hx - 17 + i * 3, 34 - i * 5, 2 + i, M.WHITE); }
  if (upgrades.estabulo) { r.rect(hx + hallW + 4, 58, 26, 18, M.LEATHER); r.poly([[hx + hallW + 2, 58], [hx + hallW + 17, 50], [hx + hallW + 32, 58]], M.DARK); }
  if (upgrades.biblioteca) { r.rect(hx + hallW - 10, 20, 10, 30, M.METAL); r.poly([[hx + hallW - 12, 20], [hx + hallW - 5, 10], [hx + hallW + 2, 20]], M.DARK); r.rect(hx + hallW - 7, 26, 4, 5, M.GLOW); }
  if (upgrades.cofre) { r.rect(60, 66, 10, 9, M.GOLD); r.rect(64, 69, 2, 2, M.DARK); }
  if (upgrades.quadro) { r.rect(92, 64, 10, 8, M.WOOD); r.rect(93, 65, 8, 6, M.WHITE); r.line(97, 72, 97, 76, M.WOOD); }
  // Mastro e estandarte
  r.line(24, 20, 24, 76, M.WOOD, 2);
  r.poly([[25, 22], [44, 22], [44, 44], [34.5, 50], [25, 44]], M.CLOTH);
  r.poly([[27, 25], [42, 25], [42, 42], [34.5, 47], [27, 42]], M.ACCENT);
  const hall = renderRoles(r, {
    [M.WOOD]: '#7a5a3a', [M.DARK]: '#4a2a3a', [M.GLOW]: '#f0c060', [M.METAL]: '#8a8a9a', [M.WHITE]: '#c0c0c8', [M.LEATHER]: '#8a5a3a',
    [M.GOLD]: '#e0b040', [M.CLOTH]: banner.color ?? '#7040a0', [M.ACCENT]: banner.color2 ?? '#e0c040',
  }, { outline: 'auto' });
  c.blit(hall, 0, 0);
  c.blit(glyphIcon(banner.symbol ?? 'estrela', banner.color2 ?? '#e0c040'), 27, 27);
  const title = `${name.toUpperCase()} [${tag}]`;
  c.rect(0, H - 11, W, 11, hex('#120c1a'));
  c.text(4, H - 8, title, TEXT);
  c.text(W - 4 - textWidth(`${members} MEMBROS`), H - 8, `${members} MEMBROS`, MUTED);
  void guildUpgradeById;
  return c.scaled(3);
}

// ===================================================================== bestiário (grade de sprites 32×32)

export function bestiaryGrid(ids: string[], seen: Set<string>, cols = 10): Canvas {
  const cell = 34;
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  const c = new Canvas(cols * cell + 2, rows * cell + 2, BG);
  ids.forEach((id, i) => {
    const x = 1 + (i % cols) * cell, y = 1 + Math.floor(i / cols) * cell;
    c.rect(x, y, cell - 1, cell - 1, PANEL);
    const s = monsterSprite(id);
    if (seen.has(id)) c.blit(s, x + 1, y + 1);
    else for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) if (s.get(k, j)[3] > 0) c.set(x + 1 + k, y + 1 + j, hex('#3a3046'));
  });
  return c;
}
