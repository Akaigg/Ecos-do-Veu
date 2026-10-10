import { CONTRACT_TEMPLATES, CONTRACTS_PER_WEEK, CONTRACT_MAX_STORED_WEEKS, contractTemplateById, type ContractTemplate } from '../data/social.ts';
import { Rng } from '../game/rng.ts';
import { fail, weekIndex, type Game } from './core.ts';
import { activeProgress, addClassXp, addRep, changeGold, type Character } from './character.ts';

export type ContractEvent =
  | { t: 'abate'; family: string; region: string; rank: string; count: number }
  | { t: 'coleta'; profession: string; qty: number }
  | { t: 'fabricacao'; qty: number }
  | { t: 'exploracao'; steps: number }
  | { t: 'campanha' }
  | { t: 'doma' }
  | { t: 'missao_pet' };

const target = (t: ContractTemplate) => {
  const gl = t.goal;
  return 'count' in gl ? gl.count : 'steps' in gl ? gl.steps : 1;
};

export function ensureContracts(g: Game, c: Character) {
  const week = weekIndex(g.now());
  const exists = g.db.get('SELECT 1 FROM contracts WHERE character_id = ? AND week = ?', c.id, week);
  if (exists) return;
  const level = activeProgress(g, c).level;
  const r = new Rng(`${c.id}:${week}`);
  const pool = r.shuffle(CONTRACT_TEMPLATES.filter((t) => t.minLevel <= level));
  pool.slice(0, CONTRACTS_PER_WEEK).forEach((t, i) => {
    g.db.run('INSERT INTO contracts (character_id, week, idx, template, target) VALUES (?,?,?,?,?)', c.id, week, i, t.id, target(t));
  });
  g.db.run('DELETE FROM contracts WHERE character_id = ? AND week < ?', c.id, week - CONTRACT_MAX_STORED_WEEKS + 1);
}

export interface ContractView { week: number; idx: number; template: ContractTemplate; progress: number; target: number; claimed: boolean; label: string }

export function listContracts(g: Game, c: Character): ContractView[] {
  ensureContracts(g, c);
  const week = weekIndex(g.now());
  return g.db.all<{ week: number; idx: number; template: string; progress: number; target: number; claimed: number }>(
    'SELECT * FROM contracts WHERE character_id = ? AND week > ? ORDER BY week DESC, idx', c.id, week - CONTRACT_MAX_STORED_WEEKS,
  ).map((r) => {
    const t = contractTemplateById.get(r.template)!;
    return { week: r.week, idx: r.idx, template: t, progress: r.progress, target: r.target, claimed: !!r.claimed, label: t.label.replace('{n}', String(r.target)) };
  });
}

function matches(t: ContractTemplate, e: ContractEvent): number {
  const gl = t.goal;
  switch (gl.t) {
    case 'abater_familia': return e.t === 'abate' && e.family === gl.family ? e.count : 0;
    case 'abater_regiao': return e.t === 'abate' && e.region === gl.region ? e.count : 0;
    case 'abater_variante': return e.t === 'abate' && e.rank === 'variante' ? e.count : 0;
    case 'coletar': return e.t === 'coleta' && e.profession === gl.profession ? e.qty : 0;
    case 'fabricar': return e.t === 'fabricacao' ? e.qty : 0;
    case 'explorar': return e.t === 'exploracao' ? e.steps : 0;
    case 'campanha': return e.t === 'campanha' ? 1 : 0;
    case 'domar': return e.t === 'doma' ? 1 : 0;
    case 'missao_pet': return e.t === 'missao_pet' ? 1 : 0;
  }
}

export function contractProgress(g: Game, charId: number, e: ContractEvent) {
  const week = weekIndex(g.now());
  const rows = g.db.all<{ week: number; idx: number; template: string; progress: number; target: number }>(
    'SELECT * FROM contracts WHERE character_id = ? AND claimed = 0 AND week > ? AND progress < target', charId, week - CONTRACT_MAX_STORED_WEEKS,
  );
  for (const r of rows) {
    const t = contractTemplateById.get(r.template);
    if (!t) continue;
    const add = matches(t, e);
    if (add > 0) g.db.run('UPDATE contracts SET progress = MIN(target, progress + ?) WHERE character_id = ? AND week = ? AND idx = ?', add, charId, r.week, r.idx);
  }
}

export function claimContract(g: Game, c: Character, week: number, idx: number) {
  return g.db.tx(() => {
    const r = g.db.get<{ template: string; progress: number; target: number; claimed: number }>('SELECT * FROM contracts WHERE character_id = ? AND week = ? AND idx = ?', c.id, week, idx);
    if (!r) fail('Contrato não encontrado.');
    if (r!.claimed) fail('Recompensa já recebida.');
    if (r!.progress < r!.target) fail(`Contrato incompleto (${r!.progress}/${r!.target}).`);
    const t = contractTemplateById.get(r!.template)!;
    g.db.run('UPDATE contracts SET claimed = 1 WHERE character_id = ? AND week = ? AND idx = ? AND claimed = 0', c.id, week, idx);
    changeGold(g, c.id, t.gold, 'contrato', t.id);
    addRep(g, c.id, 'companhia', t.rep);
    const lv = addClassXp(g, c, t.xp);
    return { gold: t.gold, rep: t.rep, xp: t.xp, levels: lv.levels };
  });
}
