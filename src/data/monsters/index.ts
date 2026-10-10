import type { BossDef, MonsterAbility, MonsterDef, MonsterTrait } from '../types.ts';
import { regionById } from '../regions.ts';
import { COMMON_SPECS } from './commons.ts';
import { FAMILIES, ROLE_STATS } from './families.ts';
import { VARIANT_SPECS, MECHANIC_INFO, type VariantMechanic } from './variants.ts';
import { BOSS_SPECS } from './bosses.ts';

export { MECHANIC_INFO, FAMILIES };

/** Converte saques genéricos para a faixa da criatura (couro cru vira pele glacial na tundra, etc.). */
const TIERED: Record<string, string[]> = {
  'couro-cru': ['couro-cru', 'couro-grosso', 'couro-escamoso', 'pele-glacial', 'couro-sombrio', 'couro-veu'],
  'lingote-cobre': ['lingote-cobre', 'lingote-ferro', 'lingote-aco', 'lingote-aco-negro', 'lingote-argenteo', 'liga-veu'],
  'lingote-ferro': ['lingote-ferro', 'lingote-ferro', 'lingote-aco', 'lingote-aco-negro', 'lingote-argenteo', 'liga-veu'],
  'minerio-ferro': ['minerio-cobre', 'minerio-ferro', 'minerio-prata', 'minerio-ferro-negro', 'minerio-argenteo', 'cristal-veu'],
  osso: ['osso', 'osso', 'osso-grande', 'osso-grande', 'osso-grande', 'osso-grande'],
  'peixe-rio': ['peixe-rio', 'truta-prateada', 'carpa-dourada', 'salmao-glacial', 'peixe-lanterna', 'peixe-veu'],
  'cogumelo-brilho': ['cogumelo-brilho', 'cogumelo-brilho', 'cogumelo-brilho', 'cogumelo-brilho', 'fungo-miceliar', 'fungo-miceliar'],
  'erva-raiz-amarga': ['erva-raiz-amarga', 'flor-sangue', 'musgo-lunar', 'flor-gelo', 'flor-cinza', 'petala-veu'],
  'fibra-casca': ['fibra-casca', 'fibra-casca', 'cortica', 'cortica', 'cortica', 'cortica'],
  'couro-grosso': ['couro-cru', 'couro-grosso', 'couro-escamoso', 'pele-glacial', 'couro-sombrio', 'couro-veu'],
};
export const tierOfLevel = (level: number) => Math.min(6, 1 + Math.floor((level - 1) / 10));
const tierize = (item: string, tier: number) => TIERED[item]?.[tier - 1] ?? item;

const ELEM_FAMILIES = new Set(['elemental']);

function adaptAbilities(list: MonsterAbility[], elem: string, family: string): MonsterAbility[] {
  if (!ELEM_FAMILIES.has(family) || elem === 'fisico') return list;
  return list.map((a) => ({
    ...a,
    effects: a.effects.map((e) => (e.k === 'dano' && (e.elem === 'fogo' || e.elem === 'fisico') ? { ...e, elem: elem as typeof e.elem } : e)),
  }));
}

function mergeAbilities(base: MonsterAbility[], extra: MonsterAbility[] = []): MonsterAbility[] {
  const ids = new Set(extra.map((a) => a.id));
  return [...base.filter((a) => !ids.has(a.id)), ...extra];
}

function buildCommons(): MonsterDef[] {
  const byRegion = new Map<string, number>();
  return COMMON_SPECS.map((s) => {
    const fam = FAMILIES[s.family];
    if (!fam) throw new Error(`Família desconhecida: ${s.family}`);
    const region = regionById.get(s.region)!;
    const idx = byRegion.get(s.region) ?? 0;
    byRegion.set(s.region, idx + 1);
    const [lo, hi] = region.levels;
    const level = lo + Math.round((idx * (hi - lo)) / 9);
    const tier = tierOfLevel(level);
    const role = ROLE_STATS[s.role];
    const drops = [
      ...fam.drops.map(([item, chance]) => ({ item: tierize(item, tier), chance, min: 1, max: chance > 0.5 ? 2 : 1 })),
      ...(s.drops ?? []).map(([item, chance]) => ({ item, chance, min: 1, max: 1 })),
      { item: region.signature, chance: 0.03, min: 1, max: 1 },
      { item: `mapa-${s.region}`, chance: 0.008, min: 1, max: 1 },
    ];
    return {
      id: s.id, name: s.name, region: s.region, family: s.family, shape: s.shape, role: s.role, level, rank: 'comum',
      habit: s.habit, colors: s.colors, elem: s.elem, weak: s.weak, resist: s.resist,
      tags: [...new Set([...fam.tags, ...(s.tags ?? [])])], traits: s.traits ?? [],
      abilities: adaptAbilities(mergeAbilities(fam.abilities, s.extra), s.elem, s.family),
      drops, tameable: s.tameable ?? fam.tameable,
      hpMult: role.hp, atkMult: role.atk, armor: role.armor, line: role.line,
      xp: Math.round(12 + level * 5),
    } satisfies MonsterDef;
  });
}

export const COMMONS: MonsterDef[] = buildCommons();
const commonById = new Map(COMMONS.map((m) => [m.id, m]));

function buildVariants(): MonsterDef[] {
  return VARIANT_SPECS.map((v) => {
    const base = commonById.get(v.base);
    if (!base) throw new Error(`Variante ${v.id} com base inexistente ${v.base}`);
    const region = regionById.get(base.region)!;
    const level = Math.min(60, base.level + 2);
    const traits = [...new Set<MonsterTrait>([...(v.traits ?? []), v.mechanic as MonsterTrait])];
    let abilities = mergeAbilities(base.abilities, v.abilities);
    if (v.mechanic === 'invocacao' && v.summon) {
      abilities = [...abilities, {
        id: 'invocar', name: 'Invocar Reforços', telegraph: '{n} chama reforços.', target: 'si', range: 'distancia',
        effects: [{ k: 'invocar', minion: v.summon, max: 2, count: 1 }], cooldown: 3, weight: 3,
      }];
    }
    if (v.mechanic === 'regeneracao') {
      abilities = [...abilities, {
        id: 'regenerar', name: 'Regenerar', telegraph: '{n} começa a fechar as feridas (fogo, sangramento ou interrupção impedem).', target: 'si', range: 'corpo',
        effects: [{ k: 'cura', power: 0, pctMax: 0.15 }], charge: 1, interruptible: true, cooldown: 3, weight: 2,
      }];
    }
    if (v.phase2) abilities = [...abilities, ...v.phase2.map((a) => ({ ...a, phase: 1 }))];
    const roleMult = base.role === 'tanque' ? 1.2 : 1;
    return {
      ...base,
      id: v.id, name: v.name, rank: 'variante', base: base.id, level, habit: v.habit,
      colors: v.colors ?? base.colors, traits, abilities, tameable: v.tameable ?? false,
      hpMult: base.hpMult * 2.0 * roleMult, atkMult: base.atkMult * 1.2, armor: base.armor * (v.mechanic === 'carapaca' ? 1.5 : 1.1),
      drops: [
        ...base.drops.map((d) => ({ ...d, chance: Math.min(1, d.chance * 1.5), max: d.max + 1 })),
        { item: region.signature, chance: 0.2, min: 1, max: 2 },
        { item: `mapa-${base.region}`, chance: 0.04, min: 1, max: 1 },
      ],
      xp: Math.round(base.xp * 3.2),
      tags: [...base.tags, `mecanica:${v.mechanic as VariantMechanic}`],
    } satisfies MonsterDef;
  });
}

export const VARIANTS: MonsterDef[] = buildVariants();

function buildBosses(): BossDef[] {
  return BOSS_SPECS.map((b) => {
    const fam = FAMILIES[b.family];
    const region = regionById.get(b.region)!;
    const tier = tierOfLevel(b.level);
    return {
      id: b.id, name: b.name, title: b.title, region: b.region, family: b.family, shape: b.shape, role: 'bruto', level: b.level,
      rank: 'chefe', habit: b.habit, colors: b.colors, elem: b.elem, weak: b.weak, resist: b.resist,
      tags: [...new Set([...(fam?.tags ?? []), ...(b.tags ?? []), 'chefe'])], traits: ['chefe'],
      abilities: b.abilities, tameable: false,
      drops: [
        { item: b.rewardItem, chance: 1, min: 1, max: 2 },
        { item: region.signature, chance: 0.8, min: 2, max: 4 },
        ...(fam?.drops ?? []).map(([item, chance]) => ({ item: tierize(item, tier), chance: Math.min(1, chance * 2), min: 2, max: 4 })),
        { item: `mapa-${b.region}`, chance: 0.15, min: 1, max: 1 },
      ],
      hpMult: b.hpMult, atkMult: b.atkMult, armor: b.armor, line: 'frente', xp: Math.round((12 + b.level * 5) * 15),
      mechanic: b.mechanic, reward: b.reward, phases: b.phases ?? [], meters: b.meters ?? [], adds: b.adds ?? [],
      partySuggested: b.partySuggested, rotation: b.rotation, start: b.start, stack: b.stack,
      recipeUnlock: b.legendary ? `lendario:${b.legendary}` : undefined,
    } satisfies BossDef;
  });
}

export const BOSSES: BossDef[] = buildBosses();
export const ALL_MONSTERS: MonsterDef[] = [...COMMONS, ...VARIANTS, ...BOSSES];
export const monsterById = new Map<string, MonsterDef>(ALL_MONSTERS.map((m) => [m.id, m]));
export const bossById = new Map<string, BossDef>(BOSSES.map((b) => [b.id, b]));
export const bossLegendary = new Map(BOSS_SPECS.filter((b) => b.legendary).map((b) => [b.id, b.legendary!]));

export function monstersOfRegion(region: string, rank?: MonsterDef['rank']): MonsterDef[] {
  return ALL_MONSTERS.filter((m) => m.region === region && (!rank || m.rank === rank));
}

/** Atributos de combate de uma criatura (base por nível × papel). */
export function monsterStats(m: MonsterDef) {
  const hp = Math.round((40 + m.level * 10) * m.hpMult);
  const atk = Math.round((6 + m.level * 0.95) * m.atkMult);
  const armor = Math.round(m.level * 3 * m.armor);
  return { hp, atk, armor };
}
