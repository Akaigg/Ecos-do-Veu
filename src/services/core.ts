import type { Db } from '../db/database.ts';
import { itemById } from '../data/items.ts';
import type { EquipData } from '../game/equipment.ts';

/** Erro exibido ao jogador (mensagem amigável); qualquer outro erro é bug. */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}
export const fail = (msg: string): never => { throw new GameError(msg); };

export interface Game {
  db: Db;
  now(): number;
  /** Notificações para o jogador (DM). Preenchido pelo bot. */
  notify?: (userId: string, text: string) => void;
}

export function createGame(db: Db, clock: () => number = Date.now): Game {
  return { db, now: clock };
}

export const HOUR = 3600_000;
export const MINUTE = 60_000;
export const DAY = 24 * HOUR;
export const weekIndex = (ms: number) => Math.floor((ms - 4 * DAY) / (7 * DAY)); // semanas começam na segunda (UTC)

export function ledger(g: Game, characterId: number | null, kind: string, gold: number, itemKey?: string, qty?: number, ref?: string, meta?: unknown) {
  g.db.run('INSERT INTO ledger (at, character_id, kind, gold, item_key, qty, ref, meta) VALUES (?,?,?,?,?,?,?,?)',
    g.now(), characterId, kind, gold, itemKey, qty, ref, meta === undefined ? null : JSON.stringify(meta));
}

/** Garante que uma ação (ex.: clique em botão) só tenha efeito uma vez. */
export function once(g: Game, key: string): boolean {
  const r = g.db.run('INSERT OR IGNORE INTO idempotency (key, at) VALUES (?, ?)', key, g.now());
  return r.changes > 0;
}

// ===================================================================== inventário

export type OwnerKind = 'char' | 'guild' | 'market' | 'escrow' | 'activity' | 'commission';
export interface Owner { kind: OwnerKind; id: number }
export const charOwner = (id: number): Owner => ({ kind: 'char', id });

export interface ItemRow {
  id: number;
  owner_kind: OwnerKind;
  owner_id: number;
  item_key: string;
  qty: number;
  data: string | null;
  slot: string | null;
  bound: number;
  created_at: number;
}

export function countItem(g: Game, o: Owner, key: string): number {
  const r = g.db.get<{ qty: number }>('SELECT qty FROM items WHERE owner_kind = ? AND owner_id = ? AND item_key = ? AND data IS NULL', o.kind, o.id, key);
  return r?.qty ?? 0;
}

export function addItem(g: Game, o: Owner, key: string, qty: number) {
  if (qty <= 0) return;
  if (!itemById.has(key)) throw new Error(`Item inexistente: ${key}`);
  g.db.run(`INSERT INTO items (owner_kind, owner_id, item_key, qty, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(owner_kind, owner_id, item_key) WHERE data IS NULL DO UPDATE SET qty = qty + excluded.qty`, o.kind, o.id, key, qty, g.now());
}

export function removeItem(g: Game, o: Owner, key: string, qty: number) {
  if (qty <= 0) return;
  const r = g.db.run('UPDATE items SET qty = qty - ? WHERE owner_kind = ? AND owner_id = ? AND item_key = ? AND data IS NULL AND qty >= ?', qty, o.kind, o.id, key, qty);
  if (r.changes === 0) fail(`Você não tem ${qty}× ${itemById.get(key)?.name ?? key}.`);
  g.db.run('DELETE FROM items WHERE owner_kind = ? AND owner_id = ? AND item_key = ? AND data IS NULL AND qty = 0', o.kind, o.id, key);
}

export function moveItem(g: Game, from: Owner, to: Owner, key: string, qty: number) {
  removeItem(g, from, key, qty);
  addItem(g, to, key, qty);
}

export function hasItems(g: Game, o: Owner, list: [string, number][]): string[] {
  const missing: string[] = [];
  for (const [k, q] of list) {
    const have = countItem(g, o, k);
    if (have < q) missing.push(`${itemById.get(k)?.name ?? k} (${have}/${q})`);
  }
  return missing;
}

export function removeItems(g: Game, o: Owner, list: [string, number][]) {
  const missing = hasItems(g, o, list);
  if (missing.length) fail(`Materiais insuficientes: ${missing.join(', ')}.`);
  for (const [k, q] of list) removeItem(g, o, k, q);
}

export function addUnique(g: Game, o: Owner, data: EquipData, bound = false): number {
  const r = g.db.run('INSERT INTO items (owner_kind, owner_id, item_key, qty, data, bound, created_at) VALUES (?,?,?,?,?,?,?)',
    o.kind, o.id, `${data.kind}:${data.model}`, 1, JSON.stringify(data), bound ? 1 : 0, g.now());
  return r.lastInsertRowid;
}

export function getUnique(g: Game, rowId: number): (ItemRow & { equip: EquipData }) | undefined {
  const r = g.db.get<ItemRow>('SELECT * FROM items WHERE id = ? AND data IS NOT NULL', rowId);
  if (!r) return undefined;
  return { ...r, equip: JSON.parse(r.data!) as EquipData };
}

export function updateUnique(g: Game, rowId: number, data: EquipData) {
  g.db.run('UPDATE items SET data = ? WHERE id = ?', JSON.stringify(data), rowId);
}

export function listItems(g: Game, o: Owner): ItemRow[] {
  return g.db.all<ItemRow>('SELECT * FROM items WHERE owner_kind = ? AND owner_id = ? AND qty > 0 ORDER BY data IS NOT NULL, item_key', o.kind, o.id);
}

export function itemLabel(row: ItemRow): string {
  if (row.data) return (JSON.parse(row.data) as EquipData).name;
  return itemById.get(row.item_key)?.name ?? row.item_key;
}
