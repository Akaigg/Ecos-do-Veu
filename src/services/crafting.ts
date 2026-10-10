import { QUEUE_BASE_SLOTS } from '../data/recipes.ts';
import { professionById } from '../data/professions.ts';
import { itemById } from '../data/items.ts';
import { toolModelById, materialByItem } from '../data/equipment.ts';
import { json } from '../db/database.ts';
import { analyzeSpec, rollProps, rollRarity, type CraftAnalysis, type CraftSpec } from '../game/crafting.ts';
import { maxDurabilityFor, type EquipData } from '../game/equipment.ts';
import { Rng, randomSeed } from '../game/rng.ts';
import { addItem, addUnique, charOwner, fail, ledger, removeItem, hasItems, MINUTE, type Game, type Owner } from './core.ts';
import { addProfXp, allProfs, allUnlockSet, getCharacter, getProf, profRank, changeGold, type Character } from './character.ts';
import { contractProgress } from './contracts.ts';
import { guildOf, guildUpgradeLevel } from './guild.ts';

export interface QueueRow { id: number; character_id: number; kind: string; label: string; profession: string; spec: string; qty: number; seed: number; started_at: number; ends_at: number; status: string; result: string | null }

export function queueSlots(g: Game, c: Character): number {
  const craftMaster = c.masters.some((m) => professionById.get(m)?.kind === 'fabricacao') ? 1 : 0;
  const guild = guildOf(g, c.id);
  const workshop = guild && guildUpgradeLevel(guild, 'oficina') >= 2 ? 1 : 0;
  return QUEUE_BASE_SLOTS + craftMaster + workshop;
}

export function pendingQueue(g: Game, charId: number): QueueRow[] {
  return g.db.all<QueueRow>("SELECT * FROM craft_queue WHERE character_id = ? AND status = 'fila' ORDER BY ends_at", charId);
}

export function analyzeFor(g: Game, c: Character, spec: CraftSpec): CraftAnalysis {
  const levels = Object.fromEntries(allProfs(g, c.id).map((p) => [p.professionId, p.level]));
  const first = analyzeSpec(spec, levels, allUnlockSet(g, c.id));
  if (!first.profession) return first;
  const vel = profRank(getProf(g, c.id, first.profession), 'velocidade') / 8;
  return analyzeSpec(spec, levels, allUnlockSet(g, c.id), vel);
}

export interface QueueOptions { commissionId?: number; source?: Owner }

/** Coloca uma produção na fila da oficina. Materiais saem na hora (atômico): dois cliques não fabricam duas vezes. */
export function queueCraft(g: Game, c: Character, spec: CraftSpec, opts: QueueOptions = {}): { row: QueueRow; analysis: CraftAnalysis; saved: [string, number][] } {
  return g.db.tx(() => {
    const an = analyzeFor(g, c, spec);
    if (!an.ok) fail(an.errors.join(' '));
    const queue = pendingQueue(g, c.id);
    if (queue.length >= queueSlots(g, c)) fail(`Sua fila de produção está cheia (${queue.length}/${queueSlots(g, c)}).`);
    const source = opts.source ?? charOwner(c.id);
    const missing = hasItems(g, source, an.inputs);
    if (missing.length) fail(`Faltam materiais: ${missing.join(', ')}.`);
    const seed = randomSeed();
    const r = new Rng(seed);
    const prof = getProf(g, c.id, an.profession);
    const guild = guildOf(g, c.id);
    const saveChance = (profRank(prof, 'eficiencia') + (guild ? guildUpgradeLevel(guild, 'oficina') * 4 : 0)) / 100;
    const saved: [string, number][] = [];
    for (const [k, q] of an.inputs) {
      let use = q;
      if (spec.t === 'receita' && saveChance > 0) {
        let s = 0;
        for (let i = 0; i < q; i++) if (r.chance(saveChance)) s++;
        s = Math.min(s, Math.floor(q / 2));
        use -= s;
        if (s) saved.push([k, s]);
      }
      if (use > 0) removeItem(g, source, k, use);
    }
    const start = Math.max(g.now(), ...queue.map((x) => x.ends_at));
    const qty = spec.t === 'receita' ? spec.qty : 1;
    const id = g.db.run(`INSERT INTO craft_queue (character_id, kind, label, profession, spec, qty, seed, started_at, ends_at, status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      c.id, spec.t, an.label, an.profession, JSON.stringify({ ...spec, commissionId: opts.commissionId }), qty, seed, start, start + an.minutes * MINUTE, 'fila').lastInsertRowid;
    ledger(g, c.id, 'fabricacao_fila', 0, undefined, undefined, `craft:${id}`, { inputs: an.inputs, saved });
    return { row: g.db.get<QueueRow>('SELECT * FROM craft_queue WHERE id = ?', id)!, analysis: an, saved };
  });
}

export function cancelCraft(g: Game, c: Character, queueId: number) {
  return g.db.tx(() => {
    const row = g.db.get<QueueRow>("SELECT * FROM craft_queue WHERE id = ? AND character_id = ? AND status = 'fila'", queueId, c.id) ?? fail('Produção não encontrada.');
    if (row!.started_at <= g.now()) fail('Essa produção já começou e não pode ser cancelada.');
    const spec = JSON.parse(row!.spec) as CraftSpec & { commissionId?: number };
    if (spec.commissionId) fail('Encomendas aceitas não podem ser canceladas por aqui.');
    const an = analyzeFor(g, c, spec);
    for (const [k, q] of an.inputs) addItem(g, charOwner(c.id), k, q);
    g.db.run("UPDATE craft_queue SET status = 'cancelada' WHERE id = ?", queueId);
    // Reorganiza os horários dos itens seguintes
    let t = g.now();
    for (const q of pendingQueue(g, c.id)) {
      const dur = q.ends_at - q.started_at;
      const start = Math.max(t, Math.min(q.started_at, t));
      g.db.run('UPDATE craft_queue SET started_at = ?, ends_at = ? WHERE id = ?', start, start + dur, q.id);
      t = start + dur;
    }
  });
}

export interface CraftDelivery { queueId: number; characterId: number; label: string; items: [string, number][]; unique?: EquipData; xp: number; levels: number; deliveredTo: number }

export function finishCraft(g: Game, queueId: number): CraftDelivery | null {
  return g.db.tx(() => {
    const row = g.db.get<QueueRow>("SELECT * FROM craft_queue WHERE id = ? AND status = 'fila'", queueId);
    if (!row) return null;
    const c = getCharacter(g, row.character_id)!;
    const spec = JSON.parse(row.spec) as CraftSpec & { commissionId?: number };
    const r = new Rng(row.seed + 1);
    const prof = getProf(g, c.id, row.profession);
    const commission = spec.commissionId ? g.db.get<{ id: number; requester_id: number; payment: number }>('SELECT * FROM commissions WHERE id = ?', spec.commissionId) : undefined;
    const target = commission ? commission.requester_id : c.id;
    const own = charOwner(target);
    const out: CraftDelivery = { queueId, characterId: c.id, label: row.label, items: [], xp: 0, levels: 0, deliveredTo: target };
    const levels = Object.fromEntries(allProfs(g, c.id).map((p) => [p.professionId, p.level]));
    const an = analyzeSpec(spec, levels, allUnlockSet(g, c.id));
    if (spec.t === 'receita' && an.recipe) {
      const base = an.recipe.output[1] * spec.qty;
      let extra = 0;
      const fartura = profRank(prof, 'fartura') / 100;
      for (let i = 0; i < spec.qty; i++) if (r.chance(fartura)) extra++;
      addItem(g, own, an.recipe.output[0], base + extra);
      out.items.push([an.recipe.output[0], base + extra]);
      out.xp = Math.round((5 + an.recipe.level * 0.6) * spec.qty);
    } else if (spec.t === 'ferramenta') {
      const m = toolModelById.get(spec.model)!;
      const excess = (levels[an.profession] ?? 1) - an.level;
      const rarity = rollRarity(r, excess, profRank(prof, 'qualidade') / 4, false, false);
      const mat = materialByItem.get(spec.material)!;
      const d: EquipData = { kind: 'ferramenta', model: m.id, material: spec.material, tier: mat.tier, runes: [], rarity, props: [], upgrade: 0, durability: 1, maxDurability: 1, name: `${m.name} de ${itemById.get(spec.material)?.name.replace(/^(Lingote|Tora) (de )?/, '')}`, crafter: c.name };
      d.maxDurability = d.durability = Math.round(m.baseDurability * mat.durability / 100 * (rarity === 'comum' ? 1 : rarity === 'incomum' ? 1.15 : 1.35));
      addUnique(g, own, d);
      out.unique = d;
      out.xp = 25 + mat.tier * 15;
    } else if (spec.t === 'equipamento' && an.preview) {
      const excess = (levels[an.profession] ?? 1) - an.level;
      const rarity = rollRarity(r, excess, profRank(prof, 'qualidade') / 4, !!spec.catalyst, !!spec.legendary);
      const d: EquipData = { ...an.preview, rarity, props: rollProps(r, rarity), crafter: c.name };
      d.maxDurability = d.durability = maxDurabilityFor(d);
      addUnique(g, own, d);
      out.unique = d;
      out.xp = 40 + an.tier * 25;
    }
    const lv = addProfXp(g, c, row.profession, out.xp);
    out.levels = lv.levels;
    contractProgress(g, c.id, { t: 'fabricacao', qty: row.qty });
    g.db.run("UPDATE craft_queue SET status = 'pronta', result = ? WHERE id = ?", JSON.stringify(out), queueId);
    if (commission) {
      g.db.run("UPDATE commissions SET status = 'entregue', updated_at = ? WHERE id = ?", g.now(), commission.id);
      g.db.run("DELETE FROM items WHERE owner_kind = 'commission' AND owner_id = ?", commission.id);
      changeGold(g, c.id, commission.payment, 'encomenda_pagamento', `com:${commission.id}`);
    }
    ledger(g, c.id, 'fabricacao_pronta', 0, undefined, undefined, `craft:${queueId}`, out);
    return out;
  });
}

export function dueCrafts(g: Game): number[] {
  return g.db.all<{ id: number }>("SELECT id FROM craft_queue WHERE status = 'fila' AND ends_at <= ?", g.now()).map((r) => r.id);
}

export function recentCrafts(g: Game, charId: number, limit = 5) {
  return g.db.all<QueueRow>("SELECT * FROM craft_queue WHERE character_id = ? AND status = 'pronta' ORDER BY ends_at DESC LIMIT ?", charId, limit)
    .map((r) => ({ ...r, delivery: json<CraftDelivery | null>(r.result, null) }));
}
