import { ECONOMY } from '../data/social.ts';
import { itemById } from '../data/items.ts';
import { json } from '../db/database.ts';
import type { CraftSpec } from '../game/crafting.ts';
import type { EquipData } from '../game/equipment.ts';
import { addItem, charOwner, fail, ledger, moveItem, removeItem, HOUR, type Game, type Owner } from './core.ts';
import { changeGold, getCharacter, type Character } from './character.ts';
import { analyzeFor, queueCraft } from './crafting.ts';

const marketOwner = (id: number): Owner => ({ kind: 'market', id });
const commissionOwner = (id: number): Owner => ({ kind: 'commission', id });

export interface Listing { id: number; sellerId: number; sellerName?: string; itemKey: string; qty: number; data: EquipData | null; price: number; status: string; expiresAt: number }
interface ListingRow { id: number; seller_id: number; item_key: string; qty: number; data: string | null; price: number; status: string; expires_at: number; name?: string }
const toListing = (r: ListingRow): Listing => ({ id: r.id, sellerId: r.seller_id, sellerName: r.name, itemKey: r.item_key, qty: r.qty, data: json(r.data, null), price: r.price, status: r.status, expiresAt: r.expires_at });

export function listingLabel(l: Listing): string {
  return l.data ? l.data.name : `${l.qty}× ${itemById.get(l.itemKey)?.name ?? l.itemKey}`;
}

/** Anuncia itens. O preço é por unidade (empilháveis) ou pela peça. Taxa de anúncio sai da economia. */
export function createListing(g: Game, c: Character, what: { key: string; qty: number } | { rowId: number }, price: number): Listing {
  return g.db.tx(() => {
    if (!Number.isInteger(price) || price < 1 || price > 10_000_000) fail('Preço inválido.');
    const active = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ? AND status = 'ativo'", c.id)!.n;
    if (active >= ECONOMY.marketMaxListings) fail(`Máximo de ${ECONOMY.marketMaxListings} anúncios ativos.`);
    const now = g.now();
    let id: number;
    if ('rowId' in what) {
      const row = g.db.get<{ id: number; owner_kind: string; owner_id: number; slot: string | null; bound: number; data: string; item_key: string }>('SELECT * FROM items WHERE id = ? AND data IS NOT NULL', what.rowId);
      if (!row || row.owner_kind !== 'char' || row.owner_id !== c.id) fail('Item não encontrado no seu inventário.');
      if (row!.slot) fail('Desequipe o item antes de anunciar.');
      if (row!.bound) fail('Esse item está vinculado a você e não pode ser negociado.');
      const fee = Math.max(1, Math.round(price * ECONOMY.marketListingFee));
      changeGold(g, c.id, -fee, 'mercado_taxa_anuncio');
      id = g.db.run('INSERT INTO market_listings (seller_id, item_key, qty, data, price, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?)',
        c.id, row!.item_key, 1, row!.data, price, 'ativo', now, now + ECONOMY.marketListingHours * HOUR).lastInsertRowid;
      g.db.run("UPDATE items SET owner_kind = 'market', owner_id = ? WHERE id = ?", id, row!.id);
    } else {
      const def = itemById.get(what.key) ?? fail('Item desconhecido.');
      if (def!.untradeable) fail('Esse item não pode ser negociado.');
      const qty = Math.floor(what.qty);
      if (qty < 1) fail('Quantidade inválida.');
      const fee = Math.max(1, Math.round(price * qty * ECONOMY.marketListingFee));
      changeGold(g, c.id, -fee, 'mercado_taxa_anuncio');
      id = g.db.run('INSERT INTO market_listings (seller_id, item_key, qty, price, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?)',
        c.id, what.key, qty, price, 'ativo', now, now + ECONOMY.marketListingHours * HOUR).lastInsertRowid;
      moveItem(g, charOwner(c.id), marketOwner(id), what.key, qty);
    }
    ledger(g, c.id, 'mercado_anuncio', 0, undefined, undefined, `mk:${id}`);
    return getListing(g, id)!;
  });
}

export function getListing(g: Game, id: number): Listing | undefined {
  const r = g.db.get<ListingRow>('SELECT l.*, c.name FROM market_listings l JOIN characters c ON c.id = l.seller_id WHERE l.id = ?', id);
  return r ? toListing(r) : undefined;
}

export function searchListings(g: Game, query?: string, limit = 15): Listing[] {
  const rows = g.db.all<ListingRow>("SELECT l.*, c.name FROM market_listings l JOIN characters c ON c.id = l.seller_id WHERE l.status = 'ativo' AND l.expires_at > ? ORDER BY l.price ASC LIMIT 200", g.now());
  const q = query?.toLowerCase().trim();
  return rows.map(toListing).filter((l) => !q || listingLabel(l).toLowerCase().includes(q) || l.itemKey.includes(q)).slice(0, limit);
}

export function myListings(g: Game, charId: number): Listing[] {
  return g.db.all<ListingRow>("SELECT * FROM market_listings WHERE seller_id = ? AND status = 'ativo' ORDER BY id DESC", charId).map(toListing);
}

/** Compra atômica: o anúncio é reduzido com verificação de quantidade, impedindo duplicação por cliques repetidos. */
export function buyListing(g: Game, c: Character, listingId: number, qty?: number) {
  return g.db.tx(() => {
    const l = getListing(g, listingId) ?? fail('Anúncio não encontrado.');
    if (l!.status !== 'ativo' || l!.expiresAt <= g.now()) fail('Esse anúncio não está mais disponível.');
    if (l!.sellerId === c.id) fail('Você não pode comprar o próprio anúncio.');
    const q = l!.data ? 1 : Math.max(1, Math.min(l!.qty, Math.floor(qty ?? l!.qty)));
    const total = l!.price * q;
    const r = g.db.run("UPDATE market_listings SET qty = qty - ?, status = CASE WHEN qty - ? = 0 THEN 'vendido' ELSE status END, buyer_id = ?, sold_at = ? WHERE id = ? AND status = 'ativo' AND qty >= ?",
      q, q, c.id, g.now(), listingId, q);
    if (!r.changes) fail('Outra pessoa comprou antes de você.');
    changeGold(g, c.id, -total, 'mercado_compra', `mk:${listingId}`);
    const tax = Math.max(1, Math.round(total * ECONOMY.marketSaleTax));
    changeGold(g, l!.sellerId, total - tax, 'mercado_venda', `mk:${listingId}`);
    if (l!.data) g.db.run("UPDATE items SET owner_kind = 'char', owner_id = ? WHERE owner_kind = 'market' AND owner_id = ?", c.id, listingId);
    else moveItem(g, marketOwner(listingId), charOwner(c.id), l!.itemKey, q);
    const seller = getCharacter(g, l!.sellerId);
    if (seller) g.notify?.(seller.userId, `💰 Vendido no mercado: ${l!.data ? l!.data.name : `${q}× ${itemById.get(l!.itemKey)?.name}`} por ${total} de ouro (taxa ${tax}).`);
    return { label: l!.data ? l!.data.name : `${q}× ${itemById.get(l!.itemKey)?.name}`, total, tax };
  });
}

export function cancelListing(g: Game, c: Character, listingId: number) {
  return g.db.tx(() => {
    const l = getListing(g, listingId) ?? fail('Anúncio não encontrado.');
    if (l!.sellerId !== c.id) fail('Esse anúncio não é seu.');
    if (l!.status !== 'ativo') fail('Esse anúncio já foi encerrado.');
    returnListing(g, l!, 'cancelado');
  });
}

function returnListing(g: Game, l: Listing, status: string) {
  g.db.run('UPDATE market_listings SET status = ? WHERE id = ?', status, l.id);
  if (l.data) g.db.run("UPDATE items SET owner_kind = 'char', owner_id = ? WHERE owner_kind = 'market' AND owner_id = ?", l.sellerId, l.id);
  else if (l.qty > 0) moveItem(g, marketOwner(l.id), charOwner(l.sellerId), l.itemKey, l.qty);
}

export function expireListings(g: Game) {
  for (const r of g.db.all<ListingRow>("SELECT * FROM market_listings WHERE status = 'ativo' AND expires_at <= ?", g.now())) {
    g.db.tx(() => returnListing(g, toListing(r), 'expirado'));
  }
}

// ===================================================================== encomendas

export interface Commission { id: number; requesterId: number; requesterName?: string; crafterId: number | null; spec: CraftSpec; payment: number; status: string; note: string }
interface ComRow { id: number; requester_id: number; crafter_id: number | null; spec: string; payment: number; status: string; note: string; name?: string }
const toCom = (r: ComRow): Commission => ({ id: r.id, requesterId: r.requester_id, requesterName: r.name, crafterId: r.crafter_id, spec: JSON.parse(r.spec), payment: r.payment, status: r.status, note: r.note });

/** Quem encomenda fornece os materiais e o pagamento, que ficam guardados até a entrega. */
export function createCommission(g: Game, c: Character, spec: CraftSpec, payment: number, note = '', crafterId?: number): Commission {
  return g.db.tx(() => {
    if (spec.t === 'receita') fail('Encomendas são para equipamentos e ferramentas personalizados.');
    if (payment < 1) fail('Ofereça um pagamento.');
    const an = analyzeFor(g, c, spec);
    const structural = an.errors.filter((e) => !/nível|aprendid/i.test(e));
    if (structural.length) fail(structural.join(' '));
    const fee = Math.max(1, Math.round(payment * ECONOMY.commissionFee));
    changeGold(g, c.id, -(payment + fee), 'encomenda_reserva');
    const id = g.db.run('INSERT INTO commissions (requester_id, crafter_id, spec, payment, status, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      c.id, crafterId ?? null, JSON.stringify(spec), payment, 'aberta', note.slice(0, 200), g.now(), g.now()).lastInsertRowid;
    for (const [k, q] of an.inputs) moveItem(g, charOwner(c.id), commissionOwner(id), k, q);
    return getCommission(g, id)!;
  });
}

export function getCommission(g: Game, id: number): Commission | undefined {
  const r = g.db.get<ComRow>('SELECT m.*, c.name FROM commissions m JOIN characters c ON c.id = m.requester_id WHERE m.id = ?', id);
  return r ? toCom(r) : undefined;
}
export function openCommissions(g: Game, forCrafter?: number): Commission[] {
  return g.db.all<ComRow>("SELECT m.*, c.name FROM commissions m JOIN characters c ON c.id = m.requester_id WHERE m.status = 'aberta' AND (m.crafter_id IS NULL OR m.crafter_id = ?) ORDER BY m.payment DESC LIMIT 25", forCrafter ?? -1).map(toCom);
}
export function myCommissions(g: Game, charId: number): Commission[] {
  return g.db.all<ComRow>("SELECT * FROM commissions WHERE (requester_id = ? OR crafter_id = ?) AND status IN ('aberta','aceita') ORDER BY id DESC", charId, charId).map(toCom);
}

export function acceptCommission(g: Game, crafter: Character, id: number) {
  return g.db.tx(() => {
    const com = getCommission(g, id) ?? fail('Encomenda não encontrada.');
    if (com!.status !== 'aberta') fail('Essa encomenda não está mais aberta.');
    if (com!.requesterId === crafter.id) fail('Você não pode aceitar a própria encomenda — fabrique diretamente.');
    if (com!.crafterId && com!.crafterId !== crafter.id) fail('Essa encomenda foi direcionada a outra pessoa.');
    const r = g.db.run("UPDATE commissions SET status = 'aceita', crafter_id = ?, updated_at = ? WHERE id = ? AND status = 'aberta'", crafter.id, g.now(), id);
    if (!r.changes) fail('Outra pessoa aceitou antes.');
    const q = queueCraft(g, crafter, com!.spec, { commissionId: id, source: commissionOwner(id) });
    return { commission: com!, queue: q };
  });
}

export function cancelCommission(g: Game, c: Character, id: number) {
  return g.db.tx(() => {
    const com = getCommission(g, id) ?? fail('Encomenda não encontrada.');
    if (com!.requesterId !== c.id) fail('Essa encomenda não é sua.');
    if (com!.status !== 'aberta') fail('A encomenda já foi aceita e está sendo produzida.');
    g.db.run("UPDATE commissions SET status = 'cancelada', updated_at = ? WHERE id = ?", g.now(), id);
    for (const it of g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind = 'commission' AND owner_id = ? AND data IS NULL", id)) {
      moveItem(g, commissionOwner(id), charOwner(c.id), it.item_key, it.qty);
    }
    changeGold(g, c.id, com!.payment, 'encomenda_cancelada');
  });
}

export { addItem, removeItem };
