import type { ClassDef, PassiveDef, SkillDef, SkillModDef, TreeDef } from '../types.ts';
import { GUERREIRO, LADINO, MONGE, PATRULHEIRO } from './martial.ts';
import { ARTIFICE, MAGO, NECROMANTE } from './arcane.ts';
import { BARDO, CLERIGO, DRUIDA } from './divine.ts';

export const CLASSES: ClassDef[] = [GUERREIRO, LADINO, PATRULHEIRO, MAGO, CLERIGO, DRUIDA, NECROMANTE, MONGE, BARDO, ARTIFICE];
export const classById = new Map(CLASSES.map((c) => [c.id, c]));

export type NodeSlot = 'a1' | 'f1a' | 'f1b' | 'a2' | 'f2a' | 'f2b' | 'p' | 'a3' | 'm3' | 'c';
export type NodeKind = 'ativa' | 'modificador' | 'passiva' | 'culminante';

export interface TalentNode {
  id: string;
  classId: string;
  treeId: string;
  slot: NodeSlot;
  kind: NodeKind;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  reqLevel: number;
  /** Todos estes precisam estar aprendidos. */
  requiresAll: string[];
  /** Pelo menos um destes precisa estar aprendido. */
  requiresAny: string[];
  /** Bifurcação: aprender um bloqueia o outro. */
  exclusiveWith?: string;
  grants: { skill?: string; modifier?: string; passive?: string };
  /** Posição no desenho da árvore. */
  col: number;
  row: number;
  /** Nós iniciais são aprendidos automaticamente ao entrar na classe. */
  auto?: boolean;
}

/** Custos e níveis por posição na árvore (hipóteses de balanceamento, ajustáveis). */
export const NODE_RULES: Record<NodeSlot, { cost: number; level: number; col: number; row: number }> = {
  a1: { cost: 0, level: 1, col: 1, row: 0 },
  f1a: { cost: 1, level: 4, col: 0, row: 1 },
  f1b: { cost: 1, level: 4, col: 2, row: 1 },
  a2: { cost: 2, level: 8, col: 1, row: 2 },
  f2a: { cost: 1, level: 14, col: 0, row: 3 },
  f2b: { cost: 1, level: 14, col: 2, row: 3 },
  p: { cost: 2, level: 18, col: 0, row: 4 },
  a3: { cost: 2, level: 24, col: 2, row: 4 },
  m3: { cost: 1, level: 30, col: 2, row: 5 },
  c: { cost: 4, level: 40, col: 1, row: 6 },
};

/** Marcos de treinamento que concedem pontos extras. */
export const TALENT_MILESTONES = [15, 30, 45, 60];
export const SECONDARY_DISCIPLINE_LEVEL = 40;
export const SECONDARY_NODE_COST = 2;

export function talentPointsForLevel(level: number): number {
  return Math.floor(level / 2) + TALENT_MILESTONES.filter((m) => level >= m).length;
}

const nodeId = (classId: string, treeId: string, slot: NodeSlot) => `${classId}/${treeId}/${slot}`;

function buildTreeNodes(c: ClassDef, t: TreeDef): TalentNode[] {
  const id = (s: NodeSlot) => nodeId(c.id, t.id, s);
  const base = (slot: NodeSlot, kind: NodeKind, name: string, desc: string, icon: string, grants: TalentNode['grants'],
    requiresAll: string[], requiresAny: string[], exclusiveWith?: string): TalentNode => ({
    id: id(slot), classId: c.id, treeId: t.id, slot, kind, name, desc, icon,
    cost: NODE_RULES[slot].cost, reqLevel: NODE_RULES[slot].level, col: NODE_RULES[slot].col, row: NODE_RULES[slot].row,
    requiresAll, requiresAny, exclusiveWith, grants, auto: slot === 'a1',
  });
  return [
    base('a1', 'ativa', t.a1.name, t.a1.desc, t.a1.icon, { skill: t.a1.id }, [], []),
    base('f1a', 'modificador', t.f1[0].name, t.f1[0].desc, t.f1[0].icon, { modifier: t.f1[0].id }, [id('a1')], [], id('f1b')),
    base('f1b', 'modificador', t.f1[1].name, t.f1[1].desc, t.f1[1].icon, { modifier: t.f1[1].id }, [id('a1')], [], id('f1a')),
    base('a2', 'ativa', t.a2.name, t.a2.desc, t.a2.icon, { skill: t.a2.id }, [], [id('f1a'), id('f1b')]),
    base('f2a', 'modificador', t.f2[0].name, t.f2[0].desc, t.f2[0].icon, { modifier: t.f2[0].id }, [id('a2')], [], id('f2b')),
    base('f2b', 'modificador', t.f2[1].name, t.f2[1].desc, t.f2[1].icon, { modifier: t.f2[1].id }, [id('a2')], [], id('f2a')),
    base('p', 'passiva', t.p.name, t.p.desc, t.p.icon, { passive: t.p.id }, [id('a2')], []),
    base('a3', 'ativa', t.a3.name, t.a3.desc, t.a3.icon, { skill: t.a3.id }, [], [id('f2a'), id('f2b')]),
    base('m3', 'modificador', t.m3.name, t.m3.desc, t.m3.icon, { modifier: t.m3.id }, [id('a3')], []),
    base('c', 'culminante', t.c.name, t.c.desc, t.c.icon, { skill: t.c.id }, [id('a3'), id('p')], []),
  ];
}

export const TALENT_NODES: TalentNode[] = CLASSES.flatMap((c) => c.trees.flatMap((t) => buildTreeNodes(c, t)));
export const nodeById = new Map(TALENT_NODES.map((n) => [n.id, n]));
export const nodesByClass = (classId: string) => TALENT_NODES.filter((n) => n.classId === classId);

export const SKILLS = new Map<string, SkillDef & { classId: string; treeId?: string; culminant?: boolean }>();
export const MODIFIERS = new Map<string, SkillModDef & { classId: string }>();
export const PASSIVES = new Map<string, PassiveDef & { classId: string; innate?: boolean }>();

for (const c of CLASSES) {
  SKILLS.set(c.fundamento.id, { ...c.fundamento, classId: c.id });
  PASSIVES.set(c.innate.id, { ...c.innate, classId: c.id, innate: true });
  for (const t of c.trees) {
    for (const s of [t.a1, t.a2, t.a3]) SKILLS.set(s.id, { ...s, classId: c.id, treeId: t.id });
    SKILLS.set(t.c.id, { ...t.c, classId: c.id, treeId: t.id, culminant: true });
    for (const m of [...t.f1, ...t.f2, t.m3]) MODIFIERS.set(m.id, { ...m, classId: c.id });
    PASSIVES.set(t.p.id, { ...t.p, classId: c.id });
  }
}

/** Habilidades que uma disciplina secundária pode acessar: fundamento + as iniciais. */
export function secondaryAccessibleSkills(classId: string): string[] {
  const c = classById.get(classId);
  if (!c) return [];
  return [c.fundamento.id, ...c.trees.map((t) => t.a1.id)];
}
