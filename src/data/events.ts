import { hashString } from '../game/rng.ts';

/**
 * Eventos regionais semanais. São cíclicos e determinísticos (região + semana): perder uma semana
 * nunca significa perder algo para sempre — o mesmo evento volta em semanas futuras.
 */
export interface RegionalEvent {
  id: string;
  name: string;
  desc: string;
  workYield?: { profession: string; pct: number };
  dropBonus?: number;
  variantWeight?: number;
  discoveryBonus?: number;
  shopDiscount?: number;
}

export const REGIONAL_EVENTS: RegionalEvent[] = [
  { id: 'migracao', name: 'Migração das Manadas', desc: 'Manadas atravessam a região: caça rende mais.', workYield: { profession: 'caca', pct: 0.2 }, dropBonus: 0.1 },
  { id: 'veio-exposto', name: 'Veios Expostos', desc: 'Um tremor expôs minério novo: mineração rende mais.', workYield: { profession: 'mineracao', pct: 0.2 } },
  { id: 'florada', name: 'Florada do Véu', desc: 'Plantas raras florescem fora de época.', workYield: { profession: 'herbalismo', pct: 0.2 }, discoveryBonus: 0.3 },
  { id: 'cardume', name: 'Cardume Prateado', desc: 'Cardumes sobem os rios.', workYield: { profession: 'pesca', pct: 0.25 } },
  { id: 'tempestade-ecos', name: 'Tempestade de Ecos', desc: 'O Véu vibra: criaturas incomuns aparecem com mais frequência e deixam mais materiais.', variantWeight: 3, dropBonus: 0.15 },
  { id: 'feira', name: 'Feira dos Errantes', desc: 'Mercadores itinerantes: a loja da Companhia dá 15% de desconto.', shopDiscount: 0.15 },
  { id: 'cartografos', name: 'Expedição dos Cartógrafos', desc: 'Os Arquivistas pagam por mapas: mais rastros e descobertas.', discoveryBonus: 0.5 },
  { id: 'derrubada', name: 'Derrubada Autorizada', desc: 'A Guarda liberou a extração de madeira antiga.', workYield: { profession: 'lenharia', pct: 0.2 } },
];

const WEEK = 7 * 24 * 3600_000;

export function activeEvent(region: string, now: number): RegionalEvent | undefined {
  const week = Math.floor((now - 4 * 24 * 3600_000) / WEEK);
  const idx = hashString(`${region}:${week}`) % (REGIONAL_EVENTS.length + 3);
  return REGIONAL_EVENTS[idx];
}
