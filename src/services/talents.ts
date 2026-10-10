import { CLASSES, classById, nodeById, nodesByClass, PASSIVES, SKILLS, SECONDARY_DISCIPLINE_LEVEL, secondaryAccessibleSkills } from '../data/classes/index.ts';
import { ECONOMY } from '../data/social.ts';
import { fail, type Game } from './core.ts';
import {
  activeProgress, assertSafe, changeGold, createProgress, getProgress, saveProgress, talentPointsLeft, type Character, type ClassProgress,
} from './character.ts';

export const MAX_EQUIPPED_SKILLS = 6;

/** Habilidades conhecidas: fundamento + nós ativos aprendidos + disciplina secundária. */
export function knownSkills(p: ClassProgress): string[] {
  const cls = classById.get(p.classId)!;
  const out = [cls.fundamento.id];
  for (const id of p.learned) {
    if (id.startsWith('sec:')) { out.push(id.slice(4)); continue; }
    const n = nodeById.get(id);
    if (n?.grants.skill) out.push(n.grants.skill);
  }
  return [...new Set(out)];
}
export function knownModifiers(p: ClassProgress): string[] {
  return p.learned.map((id) => nodeById.get(id)?.grants.modifier).filter((x): x is string => !!x);
}
export function knownPassives(p: ClassProgress): string[] {
  const cls = classById.get(p.classId)!;
  return [cls.innate.id, ...p.learned.map((id) => nodeById.get(id)?.grants.passive).filter((x): x is string => !!x)];
}

export type NodeState = 'aprendido' | 'disponivel' | 'bloqueado' | 'excluido' | 'nivel';

export function nodeState(p: ClassProgress, nodeId: string): NodeState {
  const n = nodeById.get(nodeId)!;
  if (p.learned.includes(n.id)) return 'aprendido';
  if (n.exclusiveWith && p.learned.includes(n.exclusiveWith)) return 'excluido';
  if (p.level < n.reqLevel) return 'nivel';
  if (n.requiresAll.some((r) => !p.learned.includes(r))) return 'bloqueado';
  if (n.requiresAny.length && !n.requiresAny.some((r) => p.learned.includes(r))) return 'bloqueado';
  return 'disponivel';
}

export function learnNode(g: Game, c: Character, nodeId: string): ClassProgress {
  return g.db.tx(() => {
    const p = activeProgress(g, c);
    const n = nodeById.get(nodeId);
    if (!n || n.classId !== p.classId) fail('Esse nó não pertence à sua classe atual.');
    const state = nodeState(p, nodeId);
    if (state === 'aprendido') fail('Você já aprendeu esse nó.');
    if (state === 'excluido') fail('Você escolheu o outro caminho desta bifurcação. Redistribua os talentos para trocar.');
    if (state === 'nivel') fail(`Requer nível ${n!.reqLevel} de ${classById.get(p.classId)!.name}.`);
    if (state === 'bloqueado') fail('Aprenda os nós anteriores do caminho primeiro.');
    if (talentPointsLeft(p) < n!.cost) fail(`Pontos de talento insuficientes (${talentPointsLeft(p)}/${n!.cost}).`);
    p.learned.push(n!.id);
    if (n!.grants.skill && p.equipped.length < MAX_EQUIPPED_SKILLS && !p.equipped.includes(n!.grants.skill)) p.equipped.push(n!.grants.skill);
    saveProgress(g, c.id, p);
    return p;
  });
}

/** Disciplina secundária: acesso restrito às habilidades iniciais de outra classe, usando os mesmos espaços. */
export function setSecondary(g: Game, c: Character, classId: string | null) {
  return g.db.tx(() => {
    assertSafe(g, c);
    const p = activeProgress(g, c);
    if (p.level < SECONDARY_DISCIPLINE_LEVEL) fail(`A disciplina secundária abre no nível ${SECONDARY_DISCIPLINE_LEVEL}.`);
    if (classId === p.classId) fail('Escolha uma classe diferente da atual.');
    if (classId && !classById.has(classId)) fail('Classe inválida.');
    const prevSkills = p.learned.filter((x) => x.startsWith('sec:')).map((x) => x.slice(4));
    p.learned = p.learned.filter((x) => !x.startsWith('sec:'));
    p.equipped = p.equipped.filter((s) => !prevSkills.includes(s));
    p.secondary = classId;
    saveProgress(g, c.id, p);
    return p;
  });
}

export function learnSecondarySkill(g: Game, c: Character, skillId: string) {
  return g.db.tx(() => {
    const p = activeProgress(g, c);
    if (!p.secondary) fail('Escolha uma disciplina secundária primeiro.');
    if (!secondaryAccessibleSkills(p.secondary!).includes(skillId)) fail('A disciplina secundária só dá acesso às habilidades iniciais.');
    if (p.learned.includes(`sec:${skillId}`)) fail('Já aprendida.');
    if (talentPointsLeft(p) < 2) fail('Requer 2 pontos de talento.');
    p.learned.push(`sec:${skillId}`);
    saveProgress(g, c.id, p);
    return p;
  });
}

export function equipSkills(g: Game, c: Character, skills: string[], passive?: string | null): ClassProgress {
  return g.db.tx(() => {
    assertSafe(g, c);
    const p = activeProgress(g, c);
    const known = new Set(knownSkills(p));
    const list = [...new Set(skills)];
    if (list.length > MAX_EQUIPPED_SKILLS) fail(`No máximo ${MAX_EQUIPPED_SKILLS} habilidades ativas.`);
    for (const s of list) if (!known.has(s)) fail(`Habilidade não aprendida: ${SKILLS.get(s)?.name ?? s}.`);
    p.equipped = list;
    if (passive !== undefined) {
      if (passive && !knownPassives(p).includes(passive)) fail('Passiva não aprendida.');
      p.passive = passive ?? classById.get(p.classId)!.innate.id;
    }
    saveProgress(g, c.id, p);
    return p;
  });
}

export function saveLoadout(g: Game, c: Character, name: string) {
  const p = activeProgress(g, c);
  const key = name.trim().slice(0, 24).toLowerCase();
  if (!key) fail('Dê um nome ao conjunto.');
  if (Object.keys(p.loadouts).length >= 6 && !p.loadouts[key]) fail('Máximo de 6 conjuntos salvos por classe.');
  p.loadouts[key] = { skills: [...p.equipped], passive: p.passive };
  saveProgress(g, c.id, p);
  return key;
}

export function useLoadout(g: Game, c: Character, name: string) {
  const p = activeProgress(g, c);
  const l = p.loadouts[name.toLowerCase()] ?? fail('Conjunto não encontrado.');
  return equipSkills(g, c, l.skills.filter((s) => knownSkills(p).includes(s)), l.passive);
}

/** Redistribuição de talentos: as primeiras são gratuitas, depois uma taxa moderada. */
export function respecTalents(g: Game, c: Character): number {
  return g.db.tx(() => {
    assertSafe(g, c);
    const p = activeProgress(g, c);
    const cost = p.respecs < ECONOMY.respecFree ? 0 : ECONOMY.respecCost(p.respecs, p.level);
    if (cost) changeGold(g, c.id, -cost, 'redistribuir_talentos');
    const cls = classById.get(p.classId)!;
    p.learned = nodesByClass(p.classId).filter((n) => n.auto).map((n) => n.id);
    p.equipped = [cls.fundamento.id, ...cls.trees.map((t) => t.a1.id)];
    p.passive = cls.innate.id;
    p.respecs++;
    saveProgress(g, c.id, p);
    return cost;
  });
}

export function respecCostPreview(p: ClassProgress): number {
  return p.respecs < ECONOMY.respecFree ? 0 : ECONOMY.respecCost(p.respecs, p.level);
}

/** Troca de classe no santuário: a experiência de cada classe fica guardada; profissões e história permanecem. */
export function changeClass(g: Game, c: Character, classId: string): ClassProgress {
  return g.db.tx(() => {
    assertSafe(g, c);
    if (!classById.has(classId)) fail('Classe inválida.');
    if (c.classId === classId) fail('Você já está nessa classe.');
    const existing = getProgress(g, c.id, classId);
    const cost = existing ? ECONOMY.classChangeCost : ECONOMY.classChangeCost * 2;
    changeGold(g, c.id, -cost, 'troca_classe', classId);
    const p = existing ?? createProgress(g, c.id, classId);
    g.db.run('UPDATE characters SET class_id = ? WHERE id = ?', classId, c.id);
    c.classId = classId;
    return p;
  });
}

export function describeSkill(id: string): string {
  const s = SKILLS.get(id);
  if (!s) return id;
  return `**${s.name}** — custo ${s.cost}, recarga ${s.cooldown} • ${s.range === 'corpo' ? 'corpo a corpo' : 'à distância'}\n${s.desc}`;
}
export function describePassive(id: string): string {
  const p = PASSIVES.get(id);
  return p ? `**${p.name}** — ${p.desc}` : id;
}

export { CLASSES };
