// Simulador de combates para testes e balanceamento: cria heróis-padrão e joga com uma IA simples.
import { classById, nodesByClass } from '../data/classes/index.ts';
import { ATTRIBUTES, type AttributeId } from '../data/types.ts';
import { ARMOR_MODELS, MATERIALS, WEAPON_MODELS, type PieceSlot, type Slot } from '../data/equipment.ts';
import { deriveStats, attributePointsTotal, type CharacterSnapshot } from './stats.ts';
import { maxDurabilityFor, type EquipData } from './equipment.ts';
import { buildPlayerFighter } from './combat/build.ts';
import { createCombat, resolveRound, submitAction, skillUsable, validTargets, byId } from './combat/engine.ts';
import type { CombatState, Fighter, PlayerAction } from './combat/state.ts';
import { tierOfLevel } from '../data/monsters/index.ts';

export function defaultAllocation(classId: string, level: number): Record<AttributeId, number> {
  const cls = classById.get(classId)!;
  const total = attributePointsTotal(level);
  const weights = { ...Object.fromEntries(ATTRIBUTES.map((a) => [a, 0.3])), ...cls.suggested } as Record<AttributeId, number>;
  weights.vigor = Math.max(weights.vigor, 1.2);
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const out = Object.fromEntries(ATTRIBUTES.map((a) => [a, Math.floor((total * weights[a]) / sum)])) as Record<AttributeId, number>;
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  const main = Object.entries(cls.suggested).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0] as AttributeId;
  out[main] += left;
  left = 0;
  return out;
}

function matFor(family: string, tier: number): string {
  const m = MATERIALS.filter((x) => x.family === family && x.tier <= tier).sort((a, b) => b.tier - a.tier)[0];
  return m?.item ?? 'lingote-bronze';
}

export function defaultGear(classId: string, level: number): { slot: Slot; data: EquipData }[] {
  const cls = classById.get(classId)!;
  const tier = tierOfLevel(level);
  const armorModel = cls.armorTraining === 'pesada' ? 'placas' : cls.armorTraining === 'media' ? 'brigandina' : (['mago', 'necromante', 'bardo'].includes(classId) ? 'vestes-runicas' : 'couro');
  const am = ARMOR_MODELS.find((m) => m.id === armorModel)!;
  const gear: { slot: Slot; data: EquipData }[] = [];
  const mk = (kind: EquipData['kind'], model: string, material: string, piece?: EquipData['piece']): EquipData => {
    const d: EquipData = { kind, model, material, tier, piece, runes: [], rarity: 'incomum', props: [], upgrade: 0, durability: 100, maxDurability: 100, name: model };
    d.maxDurability = d.durability = maxDurabilityFor(d);
    return d;
  };
  for (const p of ['torso', 'pernas', 'cabeca', 'maos', 'pes'] as PieceSlot[]) gear.push({ slot: p, data: mk('armadura', am.id, matFor(am.families[0], tier), p) });
  const weapon = WEAPON_MODELS.find((w) => w.id === cls.weapons[0])!;
  gear.push({ slot: weapon.offhand ? 'secundaria' : 'arma', data: mk('arma', weapon.id, matFor(weapon.families[0], tier)) });
  const off = cls.weapons.map((w) => WEAPON_MODELS.find((x) => x.id === w)!).find((w) => w.offhand);
  if (off && weapon.hands === 1) gear.push({ slot: 'secundaria', data: mk('arma', off.id, matFor(off.families[0], tier)) });
  return gear;
}

/** Herói-padrão: aprende os nós até o nível e equipa 6 habilidades. */
export function makeHero(classId: string, level: number, id: number, opts: { trees?: number[]; line?: 'frente' | 'tras' } = {}): Fighter {
  const cls = classById.get(classId)!;
  const nodes = nodesByClass(classId).filter((n) => n.reqLevel <= level);
  const learned = new Set<string>();
  const order = opts.trees ?? [0, 1, 2];
  for (const ti of order) {
    const tid = cls.trees[ti].id;
    for (const n of nodes.filter((x) => x.treeId === tid)) {
      if (n.exclusiveWith && learned.has(n.exclusiveWith)) continue;
      learned.add(n.id);
    }
  }
  const skills: string[] = [];
  const mods: string[] = [];
  for (const n of [...learned].map((x) => nodes.find((y) => y.id === x)!)) {
    if (n.grants.skill) skills.push(n.grants.skill);
    if (n.grants.modifier) mods.push(n.grants.modifier);
  }
  const culminants = skills.filter((s) => nodes.some((n) => n.grants.skill === s && n.kind === 'culminante'));
  const ordered = [...culminants, ...skills.filter((s) => !culminants.includes(s)).reverse(), cls.fundamento.id];
  const equipped = [...new Set(ordered)].slice(0, 6);
  const passive = nodes.find((n) => n.kind === 'passiva' && learned.has(n.id))?.grants.passive;
  const snap: CharacterSnapshot = {
    id, name: `${cls.name} ${id}`, race: 'humano', origin: 'ex-soldado', classId, level,
    allocated: defaultAllocation(classId, level), equipment: defaultGear(classId, level), passive,
  };
  const derived = deriveStats(snap);
  const back = ['mago', 'clerigo', 'necromante', 'bardo', 'patrulheiro', 'artifice', 'druida'].includes(classId);
  return buildPlayerFighter({
    characterId: id, name: snap.name, classId, level, derived, skills: equipped, modifiers: mods,
    belt: [{ item: 'pocao-vida-comum', qty: 2 }], line: opts.line ?? (back ? 'tras' : 'frente'),
  });
}

/** IA simples usada nos testes (e como piloto automático opcional). */
export function autoAction(st: CombatState, h: Fighter): PlayerAction {
  const allies = st.fighters.filter((f) => f.alive && f.side === h.side && f.kind === 'jogador');
  const hurt = [...allies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const usable = h.skills.filter((s) => !skillUsable(st, h, s));
  const isHeal = (s: Fighter['skills'][number]) => ['aliado', 'todos_aliados', 'si'].includes(s.target) && s.effects.some((e) => e.k === 'cura' || e.k === 'escudo');
  if (hurt && hurt.hp / hurt.maxHp < 0.5) {
    const hs = usable.find(isHeal);
    if (hs) return { kind: 'habilidade', skillId: hs.id, targetId: hurt.id };
    if (hurt.id === h.id && h.belt?.some((b) => b.qty > 0) && h.potionCd === 0) return { kind: 'item', itemId: h.belt.find((b) => b.qty > 0)!.item };
  }
  const melee = (h.weapon?.range ?? 'corpo') === 'corpo' && !h.weapon?.reach;
  const targets = validTargets(st, h, 'inimigo', false).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const charging = targets.find((t) => t.intent?.charging && t.intent.interruptible);
  if (charging) {
    const intr = usable.find((s) => s.effects.some((e) => e.k === 'interromper'));
    if (intr) return { kind: 'habilidade', skillId: intr.id, targetId: charging.id };
  }
  const KEY_ROLES = ['protetor', 'placa', 'casulo', 'sigilo', 'comporta', 'campo', 'espelho'];
  const target = targets.find((t) => t.object && KEY_ROLES.includes(t.object.role)) ?? targets.find((t) => t.kind !== 'objeto') ?? targets[0];
  const score = (s: Fighter['skills'][number]): number => {
    let v = 0;
    for (const e of s.effects) {
      if (e.k === 'dano') {
        let d = e.power + (e.weapon ?? 0) * (h.weapon?.damage ?? 0);
        for (const [a, k] of Object.entries(e.scale ?? {})) d += (h.attrs[a as keyof Fighter['attrs']] ?? 0) * (k ?? 0);
        const mult = (e.hits ?? 1) * (s.target === 'todos_inimigos' || s.target === 'linha_inimiga' || e.on === 'inimigos' ? Math.min(3, targets.length) : 1);
        v += d * mult;
      } else if (e.k === 'invocar') {
        const owned = st.fighters.filter((f) => f.alive && f.ownerId === h.id).length;
        v += owned >= e.max ? -100 : 60;
      } else if (e.k === 'status') {
        const already = st.fighters.some((f) => f.alive && f.statuses.some((x) => x.id === e.id && x.dur > 1));
        v += already ? -5 : 15;
      } else if (e.k === 'comandar') {
        v += st.fighters.some((f) => f.alive && f.ownerId === h.id) ? 40 : -100;
      } else if (e.k === 'cura' || e.k === 'escudo') v += hurt && hurt.hp / hurt.maxHp < 0.8 ? 20 : -10;
      else v += 3;
    }
    return v;
  };
  const ranked = usable.map((s) => [s, score(s)] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (ranked.length) {
    const s = ranked[0][0];
    const tid = s.target === 'aliado' ? hurt?.id : target?.id;
    return { kind: 'habilidade', skillId: s.id, targetId: tid };
  }
  if (melee && h.line === 'tras') return { kind: 'mover' };
  return { kind: 'atacar', targetId: target?.id };
}

export function runAuto(st: CombatState, maxRounds = 60): CombatState {
  while (!st.outcome && st.round <= maxRounds) {
    for (const h of st.fighters.filter((f) => f.alive && f.kind === 'jogador')) {
      const a = autoAction(st, h);
      if (submitAction(st, h.id, a)) submitAction(st, h.id, { kind: 'defender' });
    }
    resolveRound(st);
  }
  return st;
}

export function simulate(heroes: Fighter[], enemies: { monsterId: string; level?: number }[], seed = 1, kind: 'exploracao' | 'chefe' = 'exploracao') {
  const st = createCombat({ id: 'sim', seed, heroes, enemies, context: { kind, region: 'bosque', partySize: heroes.length, mode: 'solo', canFlee: false, flags: [] } });
  return runAuto(st);
}

export { byId };
