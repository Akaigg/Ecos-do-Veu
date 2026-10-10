import { itemById } from '../data/items.ts';
import { HAZARD_INFO, type Hazard, type WorkLocation } from '../data/regions.ts';
import { Rng } from './rng.ts';

/**
 * Ordem de trabalho automática. Tudo o que influencia o resultado é congelado
 * no início (WorkParams), e a simulação é determinística pela semente: o bot pode
 * reiniciar, o jogador pode interromper, e o resultado parcial é sempre o mesmo.
 */
export interface WorkTool { rowId: number; name: string; durability: number; maxDurability: number; tier: number; valuable: boolean }

export interface WorkRules {
  /** Parar antes de a ferramenta chegar a zero. */
  stopBeforeBreak: boolean;
  /** Usar ferramentas de reserva quando a principal acabar. */
  useReserves: boolean;
  /** Voltar quando a mochila atingir esta fração (0.9 = quase cheia). */
  returnAt: number;
  /** Ignorar materiais secundários (economiza peso). */
  ignoreCommon: boolean;
  /** Encerrar a expedição diante de perigo. */
  stopOnDanger: boolean;
}

export interface WorkParams {
  location: string;
  profession: string;
  hours: number;
  profLevel: number;
  ranks: { rendimento: number; conservacao: number; raridade: number; secundario: number };
  tools: WorkTool[];
  supplies: { racao: number; agua: number; celula: number };
  /** Consumo por hora. */
  perHour: { racao: number; agua: number; celula: number };
  capacityKg: number;
  yieldBonus: number;
  wearReduction: number;
  fatigueStartHours: number;
  fatigueRate: number;
  hazard?: Hazard;
  hazardCountered: boolean;
  discoveryBonus: number;
  darkBonus: number;
  rules: WorkRules;
}

export type StopReason = 'tempo' | 'ferramenta' | 'comida' | 'agua' | 'energia' | 'mochila' | 'perigo' | 'interrompido';
export const STOP_LABEL: Record<StopReason, string> = {
  tempo: 'tempo solicitado concluído', ferramenta: 'ferramenta no limite', comida: 'comida acabou', agua: 'água acabou',
  energia: 'células de energia acabaram', mochila: 'mochila cheia', perigo: 'perigo no local', interrompido: 'interrompido pelo jogador',
};

export interface WorkEvent { minute: number; text: string }
export interface PendingChoice { id: string; text: string; options: { id: string; label: string; desc: string }[]; data: Record<string, unknown> }

export interface WorkResult {
  minutes: number;
  stop: StopReason;
  items: Record<string, number>;
  weightKg: number;
  consumed: { racao: number; agua: number; celula: number };
  wear: Record<number, number>;
  brokenTools: number[];
  xp: number;
  events: WorkEvent[];
  pending: PendingChoice[];
  lostItems: Record<string, number>;
}

const TICK = 10;
const BASE_WEAR_PER_HOUR = 12;
const DANGER_PER_HOUR = { segura: 0, moderada: 0.04, perigosa: 0.1 };

export function simulateWork(p: WorkParams, loc: WorkLocation, seed: number, untilMinutes?: number): WorkResult {
  const r = new Rng(seed);
  const res: WorkResult = {
    minutes: 0, stop: 'tempo', items: {}, weightKg: 0, consumed: { racao: 0, agua: 0, celula: 0 }, wear: {}, brokenTools: [],
    xp: 0, events: [], pending: [], lostItems: {},
  };
  const tools = p.tools.map((t) => ({ ...t }));
  let toolIdx = 0;
  const supplies = { ...p.supplies };
  const limit = Math.min(p.hours * 60, untilMinutes ?? Infinity);
  const yields = loc.yields.filter((y) => !y.minLevel || p.profLevel >= y.minLevel).filter((y) => !(p.rules.ignoreCommon && y.secondary));
  const hazardMult = p.hazard && !p.hazardCountered ? 0.7 : 1;
  const wearPerTick = (BASE_WEAR_PER_HOUR / 6) * (1 - p.ranks.conservacao / 100) * (1 - p.wearReduction) * (p.hazard === 'toxicidade' && !p.hazardCountered ? 1.2 : 1);
  const food = { racao: 0, agua: 0, celula: 0 };

  for (let minute = 0; minute < limit; minute += TICK) {
    // Suprimentos são consumidos ao início de cada hora de trabalho.
    if (minute % 60 === 0) {
      for (const k of ['racao', 'agua', 'celula'] as const) {
        const need = p.perHour[k];
        if (need <= 0) continue;
        food[k] += need;
        const whole = Math.ceil(food[k] - 1e-9);
        if (whole > supplies[k]) {
          res.stop = k === 'racao' ? 'comida' : k === 'agua' ? 'agua' : 'energia';
          res.minutes = minute;
          return finish(res, p);
        }
        res.consumed[k] = whole;
      }
    }
    // Ferramenta
    let tool = tools[toolIdx];
    if (!tool || tool.durability <= 0) {
      res.stop = 'ferramenta'; res.minutes = minute; return finish(res, p);
    }
    if (p.rules.stopBeforeBreak && tool.durability - wearPerTick <= 0) {
      if (p.rules.useReserves && tools[toolIdx + 1]) {
        toolIdx++;
        tool = tools[toolIdx];
        res.events.push({ minute, text: `Trocou para a ferramenta reserva (${tool.name}).` });
      } else { res.stop = 'ferramenta'; res.minutes = minute; return finish(res, p); }
    }
    // Produção
    const hoursIn = minute / 60;
    const fatigue = hoursIn > p.fatigueStartHours ? Math.max(0.4, 1 - (hoursIn - p.fatigueStartHours) * p.fatigueRate) : 1;
    const toolMult = 0.85 + tool.tier * 0.05;
    const skillMult = 1 + p.profLevel / 100 + p.ranks.rendimento / 100 + p.yieldBonus + p.darkBonus;
    const expected = (loc.rate / 6) * skillMult * toolMult * hazardMult * fatigue;
    let count = Math.floor(expected);
    if (r.chance(expected - count)) count++;
    for (let i = 0; i < count; i++) {
      const pick = r.weighted(yields.map((y) => [y, y.weight * (y.rare ? 1 + p.ranks.raridade / 100 : 1) * (y.secondary ? 1 + p.ranks.secundario / 100 : 1)] as const));
      const w = itemById.get(pick.item)?.weight ?? 1;
      if (res.weightKg + w > p.capacityKg * p.rules.returnAt) {
        res.stop = 'mochila'; res.minutes = minute + TICK; return finish(res, p);
      }
      res.items[pick.item] = (res.items[pick.item] ?? 0) + 1;
      res.weightKg += w;
      res.xp += pick.rare ? 12 : 4 + loc.tier;
    }
    // Desgaste
    tool.durability = Math.max(0, tool.durability - wearPerTick);
    res.wear[tool.rowId] = (res.wear[tool.rowId] ?? 0) + wearPerTick;
    if (tool.durability <= 0) {
      res.events.push({ minute, text: tool.valuable ? `${tool.name} ficou inutilizável e precisa de reparo.` : `${tool.name} quebrou.` });
      res.brokenTools.push(tool.rowId);
      if (p.rules.useReserves && tools[toolIdx + 1]) toolIdx++;
      else { res.stop = 'ferramenta'; res.minutes = minute + TICK; return finish(res, p); }
    }
    // Eventos por hora
    if ((minute + TICK) % 60 === 0) {
      const danger = DANGER_PER_HOUR[loc.danger];
      if (danger > 0 && r.chance(danger)) {
        if (p.rules.stopOnDanger) {
          res.events.push({ minute, text: 'Ameaça avistada: você recolheu tudo e voltou em segurança.' });
          res.stop = 'perigo'; res.minutes = minute + TICK; return finish(res, p);
        }
        const lossFrac = 0.1 + r.next() * 0.15;
        for (const [k, v] of Object.entries(res.items)) {
          const lost = Math.floor(v * lossFrac);
          if (lost > 0) { res.items[k] -= lost; res.lostItems[k] = (res.lostItems[k] ?? 0) + lost; res.weightKg -= lost * (itemById.get(k)?.weight ?? 1); }
        }
        tool.durability = Math.max(0, tool.durability - 10);
        res.wear[tool.rowId] = (res.wear[tool.rowId] ?? 0) + 10;
        res.events.push({ minute, text: `Um ataque no local! Você perdeu cerca de ${Math.round(lossFrac * 100)}% do que tinha coletado, mas continuou.` });
      }
      if (r.chance(0.025 * (1 + p.discoveryBonus)) && res.pending.length < 2) {
        const rare = yields.filter((y) => y.rare);
        if (rare.length) {
          const pick = r.pick(rare);
          res.pending.push({
            id: `veio-${minute}`,
            text: `Você encontrou um filão incomum de ${itemById.get(pick.item)?.name ?? pick.item}. O que fazer?`,
            options: [
              { id: 'extrair', label: 'Extrair agora', desc: 'Ganha 2–4 unidades raras, mas desgasta a ferramenta.' },
              { id: 'marcar', label: 'Marcar no mapa', desc: 'Próxima ordem neste local rende +20%.' },
            ],
            data: { item: pick.item, location: loc.id },
          });
          res.events.push({ minute, text: 'Descoberta! Uma escolha ficou pendente para quando você voltar.' });
        }
      }
    }
    res.minutes = minute + TICK;
  }
  res.stop = untilMinutes !== undefined && untilMinutes < p.hours * 60 ? 'interrompido' : 'tempo';
  return finish(res, p);
}

function finish(res: WorkResult, p: WorkParams): WorkResult {
  res.weightKg = Math.round(res.weightKg * 10) / 10;
  for (const k of Object.keys(res.wear)) res.wear[Number(k)] = Math.round(res.wear[Number(k)]);
  res.xp = Math.round(res.xp * (1 + p.yieldBonus / 2));
  for (const k of Object.keys(res.items)) if (res.items[k] <= 0) delete res.items[k];
  return res;
}

export interface WorkForecast {
  limits: { label: string; hours: number }[];
  expectedHours: number;
  stop: StopReason;
  itemsMin: number;
  itemsMax: number;
  sample: Record<string, [number, number]>;
  wearPerHour: number;
  hazardNote?: string;
}

/** Previsão mostrada antes de confirmar: limites de cada recurso e faixa de produção. */
export function forecastWork(p: WorkParams, loc: WorkLocation, seed: number): WorkForecast {
  const wearPerHour = BASE_WEAR_PER_HOUR * (1 - p.ranks.conservacao / 100) * (1 - p.wearReduction);
  const toolHours = p.tools.reduce((s, t, i) => (i === 0 || p.rules.useReserves ? s + t.durability / wearPerHour : s), 0);
  const limits = [
    { label: 'Duração solicitada', hours: p.hours },
    { label: 'Ferramenta', hours: toolHours },
    ...(p.perHour.racao > 0 ? [{ label: 'Comida', hours: p.supplies.racao / p.perHour.racao }] : []),
    ...(p.perHour.agua > 0 ? [{ label: 'Água', hours: p.supplies.agua / p.perHour.agua }] : []),
    ...(p.perHour.celula > 0 ? [{ label: 'Células de energia', hours: p.supplies.celula / p.perHour.celula }] : []),
  ];
  const runs = [0, 1, 2, 3, 4].map((i) => simulateWork(p, loc, seed + i * 7919));
  const totals = runs.map((x) => Object.values(x.items).reduce((a, b) => a + b, 0));
  const sample: Record<string, [number, number]> = {};
  for (const run of runs) for (const [k, v] of Object.entries(run.items)) {
    const cur = sample[k] ?? [Infinity, 0];
    sample[k] = [Math.min(cur[0], v), Math.max(cur[1], v)];
  }
  for (const k of Object.keys(sample)) if (runs.some((x) => !x.items[k])) sample[k][0] = 0;
  const main = runs[0];
  return {
    limits, expectedHours: main.minutes / 60, stop: main.stop, itemsMin: Math.min(...totals), itemsMax: Math.max(...totals), sample, wearPerHour,
    hazardNote: p.hazard ? `${HAZARD_INFO[p.hazard].label}: ${p.hazardCountered ? 'protegido' : `sem proteção (${HAZARD_INFO[p.hazard].desc} Contorne com ${HAZARD_INFO[p.hazard].counters}.)`}` : undefined,
  };
}
