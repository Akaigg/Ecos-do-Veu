import { AttachmentBuilder } from 'discord.js';
import { itemById } from '../../data/items.ts';
import type { Canvas } from '../../render/canvas.ts';

export const bar = (frac: number, len = 10) => {
  const f = Math.max(0, Math.min(1, frac));
  const n = Math.round(f * len);
  return '█'.repeat(n) + '░'.repeat(len - n);
};
export const gold = (n: number) => `🪙 ${n.toLocaleString('pt-BR')}`;
export const ts = (ms: number, style: 'R' | 't' | 'f' = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
}
export const itemName = (k: string) => itemById.get(k)?.name ?? k;
export function itemList(items: Record<string, number> | [string, number][], empty = 'nada'): string {
  const entries = Array.isArray(items) ? items : Object.entries(items);
  const list = entries.filter(([, q]) => q > 0).map(([k, q]) => `${q}× ${itemName(k)}`);
  return list.length ? list.join(', ') : empty;
}
export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Anexa uma imagem gerada (sempre PNG pequeno). */
export function image(c: Canvas, name: string): { file: AttachmentBuilder; url: string } {
  return { file: new AttachmentBuilder(c.png(), { name: `${name}.png` }), url: `attachment://${name}.png` };
}
export function imageBuf(buf: Buffer, name: string): { file: AttachmentBuilder; url: string } {
  return { file: new AttachmentBuilder(buf, { name: `${name}.png` }), url: `attachment://${name}.png` };
}

export const COLORS = { main: 0x7040a0, ok: 0x4a9a5a, warn: 0xd0a040, bad: 0xc04848, info: 0x4a7ab0 } as const;
