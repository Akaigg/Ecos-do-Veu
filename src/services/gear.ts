import { RARITY_INFO, TIER_REQ_LEVEL, VISUALS, weaponModelById, toolModelById, materialByItem, type Slot } from '../data/equipment.ts';
import { itemById } from '../data/items.ts';
import { ECONOMY, SELL_RATE, SHOP_STOCK, SHOP_TOOLS } from '../data/social.ts';
import { REGIONS } from '../data/regions.ts';
import { computeEquipStats, isTwoHanded, maxDurabilityFor, slotForEquip, type EquipData } from '../game/equipment.ts';
import { addItem, addUnique, charOwner, fail, getUnique, ledger, removeItem, updateUnique, type Game, type ItemRow } from './core.ts';
import { activeProgress, assertSafe, changeGold, hasUnlock, type Character } from './character.ts';

function ownedUnique(g: Game, c: Character, rowId: number) {
  const it = getUnique(g, rowId);
  if (!it || it.owner_kind !== 'char' || it.owner_id !== c.id) fail('Item não encontrado no seu inventário.');
  return it!;
}

export function equipItem(g: Game, c: Character, rowId: number, preferSlot?: Slot): Slot {
  return g.db.tx(() => {
    assertSafe(g, c);
    const it = ownedUnique(g, c, rowId);
    const d = it.equip;
    const slots = slotForEquip(d);
    if (!slots.length) fail('Esse item não é equipável (ferramentas são escolhidas nas ordens de trabalho).');
    const p = activeProgress(g, c);
    const req = TIER_REQ_LEVEL[d.tier] ?? 1;
    if (p.level < req) fail(`Requer nível ${req} de classe.`);
    let slot = preferSlot && slots.includes(preferSlot) ? preferSlot : slots[0];
    if (slots.length > 1 && !preferSlot) {
      const free = slots.find((s) => !g.db.get("SELECT 1 FROM items WHERE owner_kind='char' AND owner_id=? AND slot=?", c.id, s));
      if (free) slot = free;
    }
    g.db.run("UPDATE items SET slot = NULL WHERE owner_kind='char' AND owner_id=? AND slot=?", c.id, slot);
    if (slot === 'arma' && isTwoHanded(d)) g.db.run("UPDATE items SET slot = NULL WHERE owner_kind='char' AND owner_id=? AND slot='secundaria'", c.id);
    if (slot === 'secundaria') {
      const main = g.db.get<ItemRow>("SELECT * FROM items WHERE owner_kind='char' AND owner_id=? AND slot='arma'", c.id);
      if (main?.data && isTwoHanded(JSON.parse(main.data))) g.db.run('UPDATE items SET slot = NULL WHERE id = ?', main.id);
    }
    g.db.run('UPDATE items SET slot = ? WHERE id = ?', slot, rowId);
    // Itens especiais se vinculam ao personagem ao serem equipados.
    if (RARITY_INFO[d.rarity].props >= 1 || d.legendary) g.db.run('UPDATE items SET bound = 1 WHERE id = ?', rowId);
    return slot;
  });
}

export function unequip(g: Game, c: Character, slot: Slot) {
  return g.db.tx(() => {
    assertSafe(g, c);
    const r = g.db.run("UPDATE items SET slot = NULL WHERE owner_kind='char' AND owner_id=? AND slot=?", c.id, slot);
    if (!r.changes) fail('Nada equipado nesse espaço.');
  });
}

/** Aparência desbloqueada aplicada sobre a peça, sem alterar atributos. */
export function setVisual(g: Game, c: Character, rowId: number, visualId: string | null, color?: string) {
  return g.db.tx(() => {
    const it = ownedUnique(g, c, rowId);
    const d = it.equip;
    d.appearance = d.appearance ?? {};
    if (visualId !== undefined) {
      if (visualId && !VISUALS.some((v) => v.id === visualId)) fail('Visual desconhecido.');
      if (visualId && !hasUnlock(g, c.id, 'visual', visualId)) fail('Você ainda não desbloqueou esse visual.');
      d.appearance.visual = visualId ?? undefined;
    }
    if (color) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) fail('Cor inválida (use #rrggbb).');
      d.appearance.color = color;
    }
    updateUnique(g, rowId, d);
    return d;
  });
}

export function repairCost(d: EquipData): number {
  return Math.ceil((d.maxDurability - d.durability) * ECONOMY.repairPerPoint(d.tier) * (d.rarity === 'lendario' ? 2 : 1));
}

export function repair(g: Game, c: Character, rowIds: number[]): number {
  return g.db.tx(() => {
    let total = 0;
    for (const id of rowIds) {
      const it = ownedUnique(g, c, id);
      const cost = repairCost(it.equip);
      if (cost <= 0) continue;
      total += cost;
      it.equip.durability = it.equip.maxDurability;
      updateUnique(g, id, it.equip);
    }
    if (total === 0) fail('Nada para reparar.');
    changeGold(g, c.id, -total, 'reparo');
    return total;
  });
}

export function damagedItems(g: Game, c: Character): { id: number; data: EquipData; cost: number }[] {
  return g.db.all<ItemRow>("SELECT * FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NOT NULL", c.id)
    .map((r) => ({ id: r.id, data: JSON.parse(r.data!) as EquipData }))
    .filter((x) => x.data.durability < x.data.maxDurability)
    .map((x) => ({ ...x, cost: repairCost(x.data) }));
}

/** Aprimoramento limitado (+5) e garantido mediante materiais — nunca destrói o item. */
export function upgradeCost(d: EquipData): { gold: number; items: [string, number][] } {
  return { gold: ECONOMY.upgradeGold(d.tier, d.upgrade), items: [[d.material, 1 + d.upgrade], ...(d.upgrade >= 3 ? [['tinta-arcana', d.upgrade - 1] as [string, number]] : [])] };
}

export function upgrade(g: Game, c: Character, rowId: number): EquipData {
  return g.db.tx(() => {
    assertSafe(g, c);
    const it = ownedUnique(g, c, rowId);
    const d = it.equip;
    if (d.kind === 'ferramenta') fail('Ferramentas não são aprimoradas — fabrique uma de faixa superior.');
    if (d.upgrade >= 5) fail('Este item já está no aprimoramento máximo (+5).');
    const cost = upgradeCost(d);
    for (const [k, q] of cost.items) removeItem(g, charOwner(c.id), k, q);
    changeGold(g, c.id, -cost.gold, 'aprimoramento', String(rowId));
    d.upgrade++;
    updateUnique(g, rowId, d);
    return d;
  });
}

export function tools(g: Game, c: Character, profession?: string): { id: number; data: EquipData }[] {
  return g.db.all<ItemRow>("SELECT * FROM items WHERE owner_kind='char' AND owner_id=? AND item_key LIKE 'ferramenta:%'", c.id)
    .map((r) => ({ id: r.id, data: JSON.parse(r.data!) as EquipData }))
    .filter((t) => !profession || toolModelById.get(t.data.model)?.profession === profession)
    .sort((a, b) => b.data.tier - a.data.tier || b.data.durability - a.data.durability);
}

// ===================================================================== loja da Companhia (catálogo)

export function shopCatalog(c: Character) {
  const idx = REGIONS.findIndex((r) => r.id === c.region);
  return {
    items: SHOP_STOCK.filter((e) => (e.minRegionIndex ?? 0) <= idx),
    tools: SHOP_TOOLS,
  };
}

export function buy(g: Game, c: Character, key: string, qty: number) {
  return g.db.tx(() => {
    const q = Math.max(1, Math.min(99, Math.floor(qty)));
    const cat = shopCatalog(c);
    const entry = cat.items.find((e) => e.item === key);
    if (entry) {
      changeGold(g, c.id, -entry.price * q, 'loja', key);
      addItem(g, charOwner(c.id), key, q);
      return { label: `${q}× ${itemById.get(key)!.name}`, cost: entry.price * q };
    }
    const tool = cat.tools.find((t) => t.tool === key);
    if (!tool) fail('Esse item não está à venda aqui.');
    changeGold(g, c.id, -tool!.price, 'loja', key);
    const m = toolModelById.get(tool!.tool)!;
    const d: EquipData = { kind: 'ferramenta', model: m.id, material: tool!.material, tier: 1, runes: [], rarity: 'comum', props: [], upgrade: 0, durability: 1, maxDurability: 1, name: `${m.name} (Companhia)` };
    d.maxDurability = d.durability = Math.round((materialByItem.get(tool!.material)?.durability ?? 100));
    addUnique(g, charOwner(c.id), d);
    return { label: d.name, cost: tool!.price };
  });
}

export function sell(g: Game, c: Character, key: string, qty: number) {
  return g.db.tx(() => {
    const def = itemById.get(key) ?? fail('Item desconhecido.');
    if (def!.untradeable) fail('Esse item não pode ser vendido.');
    const q = Math.max(1, Math.floor(qty));
    removeItem(g, charOwner(c.id), key, q);
    const gold = Math.max(1, Math.floor(def!.value * SELL_RATE * q));
    changeGold(g, c.id, gold, 'venda_npc', key);
    ledger(g, c.id, 'venda_npc_item', 0, key, -q);
    return gold;
  });
}

export function sellUnique(g: Game, c: Character, rowId: number) {
  return g.db.tx(() => {
    const it = ownedUnique(g, c, rowId);
    if (it.slot) fail('Desequipe o item antes de vendê-lo.');
    const d = it.equip;
    const base = (itemById.get(d.material)?.value ?? 5) * 4 * (1 + RARITY_INFO[d.rarity].statPct / 10);
    const gold = Math.max(1, Math.floor(base * SELL_RATE));
    g.db.run('DELETE FROM items WHERE id = ?', rowId);
    changeGold(g, c.id, gold, 'venda_npc', it.item_key);
    return gold;
  });
}

export { weaponModelById, computeEquipStats, maxDurabilityFor };
