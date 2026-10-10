import { workLocationById, regionById, type WorkLocation } from '../data/regions.ts';
import { raceById, originById } from '../data/races.ts';
import { RARITY_INFO, toolModelById } from '../data/equipment.ts';
import { professionById } from '../data/professions.ts';
import { itemById } from '../data/items.ts';
import { json } from '../db/database.ts';
import { randomSeed, Rng } from '../game/rng.ts';
import { forecastWork, simulateWork, type WorkParams, type WorkResult, type WorkRules, type WorkForecast, type PendingChoice } from '../game/work.ts';
import type { EquipData } from '../game/equipment.ts';
import { addItem, charOwner, countItem, fail, getUnique, ledger, moveItem, updateUnique, MINUTE, type Game, type Owner } from './core.ts';
import {
  activeCombatId, activeFieldActivity, addProfXp, currentMeal, getProf, hasUnlock, profRank, snapshot, getCharacter, type Character,
} from './character.ts';
import { tools } from './gear.ts';
import { contractProgress } from './contracts.ts';
import { activeEvent } from '../data/events.ts';
import { addGuildWork } from './guild.ts';

export const DEFAULT_RULES: WorkRules = { stopBeforeBreak: true, useReserves: true, returnAt: 0.95, ignoreCommon: false, stopOnDanger: true };
const NATURAL = new Set(['bosque', 'planicies', 'pantano', 'montanhas', 'tundra', 'fungica']);
const actOwner = (id: number): Owner => ({ kind: 'activity', id });

export interface WorkPlan {
  location: WorkLocation;
  params: WorkParams;
  forecast: WorkForecast;
  reserve: { racao: number; agua: number; celula: number; antidoto: number; visao: number };
  needs: { racao: number; agua: number; celula: number };
  veinNote?: string;
}

export function planWork(g: Game, c: Character, locationId: string, hours: number, rules: Partial<WorkRules> = {}, toolIds?: number[]): WorkPlan {
  const loc = workLocationById.get(locationId) ?? fail('Local de trabalho desconhecido.');
  if (!hasUnlock(g, c.id, 'local', loc!.id)) fail('Você ainda não conhece esse local. Descubra-o explorando a região.');
  if (c.region !== loc!.region) fail(`Esse local fica em ${regionById.get(loc!.region)?.name}. Use \`/viajar\` primeiro.`);
  if (!professionById.has(loc!.profession)) fail('Profissão inválida.');
  const h = Math.max(1, Math.min(12, Math.round(hours)));
  const prof = getProf(g, c.id, loc!.profession);
  const minLevel = [0, 1, 12, 25, 38, 52, 66][loc!.tier];
  if (prof.level < minLevel) fail(`Requer nível ${minLevel} em ${professionById.get(loc!.profession)!.name} (você tem ${prof.level}).`);
  const { derived } = snapshot(g, c);
  const race = raceById.get(c.race)!;
  const origin = originById.get(c.origin);
  const meal = currentMeal(g, c);
  const own = charOwner(c.id);

  // Ferramentas
  let ts = tools(g, c, loc!.profession).filter((t) => t.data.durability > 0);
  if (toolIds?.length) ts = toolIds.map((id) => ts.find((t) => t.id === id)).filter((x): x is { id: number; data: EquipData } => !!x);
  if (!ts.length) fail(`Você precisa de uma ferramenta de ${toolModelById.get([...toolModelById.values()].find((m) => m.profession === loc!.profession)!.id)!.name} com durabilidade. Compre na \`/loja\` ou fabrique uma.`);
  const workTools = ts.slice(0, 3).map((t) => ({
    rowId: t.id, name: t.data.name, durability: t.data.durability, maxDurability: t.data.maxDurability, tier: t.data.tier,
    valuable: ['raro', 'epico', 'lendario'].includes(t.data.rarity),
  }));

  // Perigos ambientais
  const hazard = loc!.hazard;
  let countered = !hazard;
  const reserve = { racao: 0, agua: 0, celula: 0, antidoto: 0, visao: 0 };
  if (hazard === 'frio') countered = derived.resist.gelo >= 20 || meal?.label === 'Aquecido';
  if (hazard === 'calor') countered = derived.resist.fogo >= 20 || meal?.label === 'Refrescado';
  if (hazard === 'toxicidade') {
    countered = derived.resist.veneno >= 20;
    if (!countered && countItem(g, own, 'antidoto') > 0) { countered = true; reserve.antidoto = 1; }
  }
  if (hazard === 'escuridao') {
    countered = race.trait.t === 'penumbra';
    if (!countered && countItem(g, own, 'pocao-visao') > 0) { countered = true; reserve.visao = 1; }
  }
  if (hazard === 'altitude') countered = derived.attrs.vigor >= 25 || race.id === 'orc';

  // Consumo
  const supplyMult = 1 - (race.trait.t === 'suprimentos' ? race.trait.reduction : 0) - (origin?.bonus?.supplies ?? 0);
  const perHour = { racao: supplyMult, agua: supplyMult, celula: 0 };
  if (hazard === 'frio' && !countered) perHour.racao *= 1.5;
  if (hazard === 'calor' && !countered) perHour.agua *= 1.5;
  if (race.trait.t === 'plantas_agua' && NATURAL.has(loc!.region)) perHour.agua *= 1 - race.trait.waterReduction;
  if (race.trait.t === 'forjado') { perHour.celula = race.trait.cellPerHour; perHour.agua = 0; }
  const needs = { racao: Math.ceil(perHour.racao * h - 1e-9), agua: Math.ceil(perHour.agua * h - 1e-9), celula: Math.ceil(perHour.celula * h - 1e-9) };
  reserve.racao = Math.min(needs.racao, countItem(g, own, 'racao'));
  reserve.agua = Math.min(needs.agua, countItem(g, own, 'agua'));
  reserve.celula = Math.min(needs.celula, countItem(g, own, 'celula-energia'));

  const sense = race.trait.t === 'sentido_escolhido' ? c.raceChoice : null;
  const vigor = derived.attrs.vigor;
  let fatigueStart = 6 + vigor / 10;
  if (hazard === 'altitude' && !countered) fatigueStart -= 2;
  if (race.trait.t === 'exaustao') fatigueStart *= 1 + race.trait.reduction;
  const params: WorkParams = {
    location: loc!.id, profession: loc!.profession, hours: h, profLevel: prof.level,
    ranks: { rendimento: profRank(prof, 'rendimento'), conservacao: profRank(prof, 'conservacao'), raridade: profRank(prof, 'raridade'), secundario: profRank(prof, 'secundario') },
    tools: workTools, supplies: { racao: reserve.racao, agua: reserve.agua, celula: reserve.celula }, perHour,
    capacityKg: derived.carry,
    yieldBonus: (meal?.workYield ?? 0) + (race.trait.t === 'plantas_agua' && loc!.profession === 'herbalismo' ? race.trait.herbYield : 0)
      + (hasUnlock(g, c.id, 'bonus_local', loc!.id) ? 0.2 : 0) + (sense === 'olfato' && loc!.profession === 'caca' ? 0.1 : 0)
      + (activeEvent(loc!.region, g.now())?.workYield?.profession === loc!.profession ? activeEvent(loc!.region, g.now())!.workYield!.pct : 0),
    wearReduction: race.trait.t === 'avaliar_jazidas' ? race.trait.toolWear : 0,
    fatigueStartHours: fatigueStart, fatigueRate: race.trait.t === 'exaustao' ? 0.06 : 0.08,
    hazard, hazardCountered: countered,
    discoveryBonus: (race.trait.t === 'rastros_magicos' ? race.trait.discoveryBonus : 0) + (sense === 'visao' ? 0.2 : 0),
    darkBonus: race.trait.t === 'penumbra' && hazard === 'escuridao' ? race.trait.darkYield : 0,
    rules: { ...DEFAULT_RULES, ...rules },
  };
  const forecast = forecastWork(params, loc!, hashSeed(c.id, loc!.id));
  const veinNote = race.trait.t === 'avaliar_jazidas' && loc!.profession === 'mineracao'
    ? `Avaliação anã: jazida de faixa ${loc!.tier}, ${loc!.yields.filter((y) => y.rare).map((y) => itemById.get(y.item)?.name).join(', ') || 'sem gemas'} possíveis.` : undefined;
  return { location: loc!, params, forecast, reserve, needs, veinNote };
}

const hashSeed = (a: number, b: string) => [...b].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, a * 7919);

export function startWork(g: Game, c: Character, plan: WorkPlan): { activityId: number; endsAt: number; result: WorkResult } {
  return g.db.tx(() => {
    if (activeCombatId(g, c.id)) fail('Você está em combate.');
    if (activeFieldActivity(g, c.id)) fail('Você já tem uma atividade de campo em andamento. Veja `/atividade`.');
    const own = charOwner(c.id);
    const seed = randomSeed();
    const sim = simulateWork(plan.params, plan.location, seed);
    if (sim.minutes <= 0) fail(`A ordem terminaria imediatamente (${sim.stop}). Leve suprimentos e ferramentas.`);
    const now = g.now();
    const endsAt = now + sim.minutes * MINUTE;
    const id = g.db.run(`INSERT INTO activities (character_id, kind, status, params, reserved, seed, started_at, ends_at) VALUES (?,?,?,?,?,?,?,?)`,
      c.id, 'trabalho', 'ativa', JSON.stringify(plan.params), JSON.stringify(plan.reserve), seed, now, endsAt).lastInsertRowid;
    const ao = actOwner(id);
    if (plan.reserve.racao) moveItem(g, own, ao, 'racao', plan.reserve.racao);
    if (plan.reserve.agua) moveItem(g, own, ao, 'agua', plan.reserve.agua);
    if (plan.reserve.celula) moveItem(g, own, ao, 'celula-energia', plan.reserve.celula);
    if (plan.reserve.antidoto) moveItem(g, own, ao, 'antidoto', 1);
    if (plan.reserve.visao) moveItem(g, own, ao, 'pocao-visao', 1);
    for (const t of plan.params.tools) {
      const r = g.db.run("UPDATE items SET owner_kind = 'activity', owner_id = ? WHERE id = ? AND owner_kind = 'char' AND owner_id = ?", id, t.rowId, c.id);
      if (!r.changes) fail('Uma das ferramentas não está mais disponível.');
    }
    if (hasUnlock(g, c.id, 'bonus_local', plan.location.id)) g.db.run("DELETE FROM unlocks WHERE character_id = ? AND kind = 'bonus_local' AND key = ?", c.id, plan.location.id);
    ledger(g, c.id, 'trabalho_inicio', 0, undefined, undefined, `act:${id}`, { location: plan.location.id, hours: plan.params.hours });
    return { activityId: id, endsAt, result: sim };
  });
}

interface ActRow { id: number; character_id: number; kind: string; status: string; params: string; reserved: string; state: string; seed: number; started_at: number; ends_at: number; result: string | null }

export interface WorkReport { activityId: number; location: WorkLocation; result: WorkResult; levels: number; profLevel: number; capped: boolean; pending: PendingChoice[] }

/** Conclui (ou interrompe) uma ordem de trabalho. Idempotente: só a primeira chamada entrega materiais. */
export function finishWork(g: Game, activityId: number, interruptAt?: number): WorkReport | null {
  return g.db.tx(() => {
    const a = g.db.get<ActRow>("SELECT * FROM activities WHERE id = ? AND kind = 'trabalho'", activityId);
    if (!a || a.status !== 'ativa') return null;
    const params = JSON.parse(a.params) as WorkParams;
    const loc = workLocationById.get(params.location)!;
    const until = interruptAt !== undefined ? Math.max(0, Math.floor((interruptAt - a.started_at) / MINUTE)) : undefined;
    const res = simulateWork(params, loc, a.seed, until);
    const c = getCharacter(g, a.character_id)!;
    const own = charOwner(c.id);
    const ao = actOwner(a.id);
    // Suprimentos: consumidos saem; o resto volta
    const reserve = json(a.reserved, { racao: 0, agua: 0, celula: 0, antidoto: 0, visao: 0 });
    const back = (key: string, reserved: number, used: number) => {
      const left = reserved - Math.min(reserved, used);
      if (used > 0) g.db.run("UPDATE items SET qty = qty - ? WHERE owner_kind = 'activity' AND owner_id = ? AND item_key = ? AND data IS NULL", Math.min(reserved, used), a.id, key);
      if (left > 0) moveItem(g, ao, own, key, left);
    };
    back('racao', reserve.racao, res.consumed.racao);
    back('agua', reserve.agua, res.consumed.agua);
    back('celula-energia', reserve.celula, res.consumed.celula);
    back('antidoto', reserve.antidoto, reserve.antidoto);
    back('pocao-visao', reserve.visao, reserve.visao);
    g.db.run("DELETE FROM items WHERE owner_kind = 'activity' AND owner_id = ? AND data IS NULL", a.id);
    // Ferramentas: desgaste; comuns quebram, valiosas ficam inutilizadas
    for (const t of params.tools) {
      const it = getUnique(g, t.rowId);
      if (!it) continue;
      const d = it.equip;
      d.durability = Math.max(0, Math.round(d.durability - (res.wear[t.rowId] ?? 0)));
      const valuable = RARITY_INFO[d.rarity].props >= 1;
      if (d.durability <= 0 && !valuable) {
        g.db.run('DELETE FROM items WHERE id = ?', t.rowId);
        ledger(g, c.id, 'ferramenta_quebrou', 0, it.item_key, -1, `act:${a.id}`);
      } else {
        updateUnique(g, t.rowId, d);
        g.db.run("UPDATE items SET owner_kind = 'char', owner_id = ? WHERE id = ?", c.id, t.rowId);
      }
    }
    for (const [k, q] of Object.entries(res.items)) { addItem(g, own, k, q); ledger(g, c.id, 'coleta', 0, k, q, `act:${a.id}`); }
    const lv = addProfXp(g, c, params.profession, res.xp);
    contractProgress(g, c.id, { t: 'coleta', profession: params.profession, qty: Object.values(res.items).reduce((s, x) => s + x, 0) });
    addGuildWork(g, c.id, res.minutes / 60);
    g.db.run("UPDATE activities SET status = 'concluida', result = ?, resolved_at = ?, ends_at = ? WHERE id = ?",
      JSON.stringify(res), g.now(), a.started_at + res.minutes * MINUTE, a.id);
    return { activityId: a.id, location: loc, result: res, levels: lv.levels, profLevel: lv.level, capped: lv.capped, pending: res.pending };
  });
}

/** Escolhas importantes ficam pendentes até o retorno do jogador. */
export function resolvePending(g: Game, c: Character, activityId: number, choiceId: string, optionId: string): string {
  return g.db.tx(() => {
    const a = g.db.get<ActRow>("SELECT * FROM activities WHERE id = ? AND character_id = ? AND kind = 'trabalho'", activityId, c.id);
    if (!a || !a.result) fail('Atividade não encontrada.');
    const res = JSON.parse(a!.result!) as WorkResult;
    const p = res.pending.find((x) => x.id === choiceId) ?? fail('Essa escolha já foi feita.');
    res.pending = res.pending.filter((x) => x.id !== choiceId);
    g.db.run('UPDATE activities SET result = ? WHERE id = ?', JSON.stringify(res), a!.id);
    const data = p!.data as { item: string; location: string };
    if (optionId === 'extrair') {
      const n = new Rng(a!.seed + choiceId.length).int(2, 4);
      addItem(g, charOwner(c.id), data.item, n);
      const t = tools(g, c, workLocationById.get(data.location)?.profession)[0];
      if (t) { t.data.durability = Math.max(0, t.data.durability - 10); updateUnique(g, t.id, t.data); }
      return `Você extraiu ${n}× ${itemById.get(data.item)?.name}.`;
    }
    g.db.run('INSERT OR IGNORE INTO unlocks (character_id, kind, key, at) VALUES (?,?,?,?)', c.id, 'bonus_local', data.location, g.now());
    return 'Local marcado: sua próxima ordem ali renderá +20%.';
  });
}

export function currentWork(g: Game, charId: number): { row: ActRow; params: WorkParams; partial: WorkResult; location: WorkLocation } | undefined {
  const a = g.db.get<ActRow>("SELECT * FROM activities WHERE character_id = ? AND kind = 'trabalho' AND status = 'ativa'", charId);
  if (!a) return undefined;
  const params = JSON.parse(a.params) as WorkParams;
  const loc = workLocationById.get(params.location)!;
  const until = Math.max(0, Math.floor((g.now() - a.started_at) / MINUTE));
  return { row: a, params, partial: simulateWork(params, loc, a.seed, until), location: loc };
}

export function lastReports(g: Game, charId: number, limit = 3) {
  return g.db.all<ActRow>("SELECT * FROM activities WHERE character_id = ? AND kind = 'trabalho' AND status = 'concluida' ORDER BY resolved_at DESC LIMIT ?", charId, limit)
    .map((a) => ({ id: a.id, params: JSON.parse(a.params) as WorkParams, result: JSON.parse(a.result!) as WorkResult }));
}

export function dueWork(g: Game): number[] {
  return g.db.all<{ id: number }>("SELECT id FROM activities WHERE kind = 'trabalho' AND status = 'ativa' AND ends_at <= ?", g.now()).map((r) => r.id);
}
