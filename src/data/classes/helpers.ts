import type {
  AttrScale, DamageEffect, Element, HealEffect, PassiveDef, PassiveHook, ShieldEffect, SkillDef,
  SkillModDef, StatusEffect, StatusId, TargetKind, Effect, Range, TreeDef,
} from '../types.ts';

export const dmg = (power: number, scale: AttrScale, elem: Element = 'fisico', extra: Partial<DamageEffect> = {}): DamageEffect =>
  ({ k: 'dano', power, scale, elem, ...extra });
export const st = (id: StatusId, dur: number, extra: Partial<StatusEffect> = {}): StatusEffect =>
  ({ k: 'status', id, dur, ...extra });
export const heal = (power: number, scale: AttrScale, extra: Partial<HealEffect> = {}): HealEffect =>
  ({ k: 'cura', power, scale, ...extra });
export const shield = (power: number, scale: AttrScale, dur: number, extra: Partial<ShieldEffect> = {}): ShieldEffect =>
  ({ k: 'escudo', power, scale, dur, ...extra });

interface SkillOpts {
  cost: number; cd: number; range?: Range; target: TargetKind; effects: Effect[]; icon: string;
  anyLine?: boolean; tags?: string[];
}
export function skill(id: string, name: string, desc: string, o: SkillOpts): SkillDef {
  return {
    id, name, desc, cost: o.cost, cooldown: o.cd, range: o.range ?? 'corpo', target: o.target,
    effects: o.effects, icon: o.icon, anyLine: o.anyLine, tags: o.tags,
  };
}

export function mod(id: string, name: string, skillId: string, desc: string, o: Omit<SkillModDef, 'id' | 'name' | 'skill' | 'desc'>): SkillModDef {
  return { id, name, skill: skillId, desc, ...o };
}

export function passive(id: string, name: string, desc: string, hooks: PassiveHook[], icon: string): PassiveDef {
  return { id, name, desc, hooks, icon };
}

export function tree(t: TreeDef): TreeDef {
  return t;
}
