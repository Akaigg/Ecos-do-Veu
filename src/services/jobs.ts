import { itemById } from '../data/items.ts';
import { STOP_LABEL } from '../game/work.ts';
import type { Game } from './core.ts';
import { getCharacter } from './character.ts';
import { dueWork, finishWork } from './work.ts';
import { dueCrafts, finishCraft } from './crafting.ts';
import { duePetMissions, finishPetMission, healPets } from './pets.ts';
import { expireListings } from './market.ts';
import { expireExplorations, onExplorationCombat } from './exploration.ts';
import { dueVotes, getRun, resolveVote, onCampaignCombat } from './campaign.ts';
import { deliverLoot, forceResolve, type ActResult, type CombatSettlement } from './combat.ts';

/** Encaminha o fim de um combate para quem o iniciou (exploração, campanha ou chefe direto). */
export function routeSettlement(g: Game, kind: string, ref: string | null, s: CombatSettlement): string[] {
  if (kind === 'exploracao' && ref?.startsWith('act:')) return onExplorationCombat(g, Number(ref.slice(4)), s)?.text ?? [];
  if (kind === 'campanha' && ref?.startsWith('run:')) return onCampaignCombat(g, Number(ref.slice(4)), s)?.text ?? [];
  g.db.tx(() => deliverLoot(g, s));
  return [];
}

const list = (items: Record<string, number>) => Object.entries(items).map(([k, q]) => `${q}× ${itemById.get(k)?.name ?? k}`).join(', ') || 'nada';

export interface JobEvents { combatsUpdated: ActResult[]; runsUpdated: number[] }

/**
 * Processo de tarefas: conclui atividades vencidas mesmo que o bot tenha reiniciado.
 * Nada é simulado "a cada segundo": as ordens já sabem quando terminam.
 */
export function processDue(g: Game): JobEvents {
  const ev: JobEvents = { combatsUpdated: [], runsUpdated: [] };
  const notify = (charId: number, text: string) => {
    const c = getCharacter(g, charId);
    if (c) g.notify?.(c.userId, text);
  };
  for (const id of dueWork(g)) {
    const r = finishWork(g, id);
    if (!r) continue;
    const charId = g.db.get<{ character_id: number }>('SELECT character_id FROM activities WHERE id = ?', id)!.character_id;
    notify(charId, `⛏️ **Ordem de trabalho concluída** em ${r.location.name} (${STOP_LABEL[r.result.stop]}, ${Math.round(r.result.minutes / 6) / 10}h).\nProdução: ${list(r.result.items)}.\n+${r.result.xp} XP de profissão${r.levels ? ` • nível ${r.profLevel}!` : ''}${r.pending.length ? '\n⚠️ Há uma escolha pendente: use `/atividade`.' : ''}`);
  }
  for (const id of dueCrafts(g)) {
    const r = finishCraft(g, id);
    if (!r) continue;
    notify(r.characterId, `🔨 **Produção pronta:** ${r.label}${r.unique ? ` (${r.unique.rarity})` : ''}. +${r.xp} XP de profissão.`);
    if (r.deliveredTo !== r.characterId) notify(r.deliveredTo, `📦 Sua encomenda chegou: ${r.unique?.name ?? r.label}.`);
  }
  for (const id of duePetMissions(g)) {
    const r = finishPetMission(g, id);
    if (!r) continue;
    notify(r.pet.characterId, `🐾 **${r.pet.name} voltou da missão!** Trouxe: ${list(r.items)}${r.gold ? ` e ${r.gold} de ouro` : ''}.${r.discovered ? ' Descobriu um novo local de trabalho!' : ''}${r.injured ? ' Voltou ferido e precisa descansar.' : ''}`);
  }
  healPets(g);
  expireListings(g);
  expireExplorations(g);
  // Combates assíncronos com prazo vencido
  for (const row of g.db.all<{ id: string }>("SELECT id FROM combats WHERE status = 'ativo' AND deadline_at IS NOT NULL AND deadline_at <= ?", g.now())) {
    const res = forceResolve(g, row.id);
    if (!res) continue;
    if (res.settlement) res.log.push(...routeSettlement(g, res.kind, res.ref, res.settlement));
    ev.combatsUpdated.push(res);
  }
  for (const id of dueVotes(g)) {
    const run = getRun(g, id);
    if (!run) continue;
    g.db.tx(() => resolveVote(g, run));
    ev.runsUpdated.push(id);
  }
  return ev;
}
