// Verifica a integridade do conteúdo: referências a itens, habilidades, criaturas, receitas e locais.
import { fileURLToPath } from 'node:url';
import { itemById, ITEMS } from '../src/data/items.ts';
import { CLASSES, SKILLS, MODIFIERS, PASSIVES, TALENT_NODES, nodeById } from '../src/data/classes/index.ts';
import { ALL_MONSTERS, monsterById } from '../src/data/monsters/index.ts';
import { RECIPES } from '../src/data/recipes.ts';
import { WORK_LOCATIONS, REGIONS, regionById } from '../src/data/regions.ts';
import { CAMPAIGNS } from '../src/data/campaigns.ts';
import { PET_AFFINITIES } from '../src/data/pets.ts';
import { MATERIALS, REINFORCEMENTS, LININGS, FINISHES } from '../src/data/equipment.ts';
import { minionById, enemyObjectById, FIELDS } from '../src/data/minions.ts';
import { SHOP_STOCK, STARTER_KIT, CONTRACT_TEMPLATES } from '../src/data/social.ts';
import { RARE_DISCOVERIES } from '../src/data/exploration.ts';
import { ICONS, GLYPHS } from '../src/render/sprites/icons.ts';
import { hasShape } from '../src/render/sprites/creatures.ts';
import type { Effect } from '../src/data/types.ts';

export function validateContent(): string[] {
  const p: string[] = [];
  const item = (id: string, where: string) => { if (!itemById.has(id)) p.push(`${where}: item inexistente ${id}`); };
  const ids = new Set<string>();
  for (const it of ITEMS) {
    if (ids.has(it.id)) p.push(`item duplicado ${it.id}`);
    ids.add(it.id);
    if (!ICONS[it.icon]) p.push(`item ${it.id}: ícone sem desenho ${it.icon}`);
  }
  const effects = (list: Effect[], where: string) => {
    for (const e of list) {
      if (e.k === 'invocar' && !e.minion.startsWith('$') && !minionById.has(e.minion) && !enemyObjectById.has(e.minion) && !monsterById.has(e.minion)) p.push(`${where}: invocação desconhecida ${e.minion}`);
      if (e.k === 'campo' && !FIELDS.some((f) => f.id === e.id)) p.push(`${where}: campo desconhecido ${e.id}`);
    }
  };
  for (const c of CLASSES) {
    for (const s of [c.fundamento, ...c.trees.flatMap((t) => [t.a1, t.a2, t.a3, t.c])]) {
      effects(s.effects, `habilidade ${s.id}`);
      if (!GLYPHS[s.icon]) p.push(`habilidade ${s.id}: símbolo sem desenho ${s.icon}`);
    }
    for (const t of c.trees) {
      for (const m of [...t.f1, ...t.f2, t.m3]) {
        if (!SKILLS.has(m.skill)) p.push(`modificador ${m.id}: habilidade ${m.skill} não existe`);
        const sk = SKILLS.get(m.skill);
        for (const pt of m.patch ?? []) if (sk && !sk.effects[pt.index]) p.push(`modificador ${m.id}: índice ${pt.index} inexistente`);
        if (!GLYPHS[m.icon]) p.push(`modificador ${m.id}: símbolo ${m.icon}`);
      }
      if (!GLYPHS[t.p.icon]) p.push(`passiva ${t.p.id}: símbolo ${t.p.icon}`);
    }
    for (const w of c.weapons) if (!STARTER_KIT[c.id]) p.push(`classe ${c.id} sem kit inicial`), void w;
  }
  if (SKILLS.size !== 130 || MODIFIERS.size !== 150 || PASSIVES.size !== 40) p.push(`contagem de habilidades inesperada ${SKILLS.size}/${MODIFIERS.size}/${PASSIVES.size}`);
  for (const n of TALENT_NODES) for (const r of [...n.requiresAll, ...n.requiresAny]) if (!nodeById.has(r)) p.push(`nó ${n.id}: requisito ${r}`);
  const mids = new Set<string>();
  for (const m of ALL_MONSTERS) {
    if (mids.has(m.id)) p.push(`criatura duplicada ${m.id}`);
    mids.add(m.id);
    if (!regionById.has(m.region)) p.push(`${m.id}: região ${m.region}`);
    if (!hasShape(m.shape)) p.push(`${m.id}: forma sem desenho ${m.shape}`);
    for (const d of m.drops) item(d.item, `saque de ${m.id}`);
    for (const a of m.abilities) effects(a.effects, `${m.id}/${a.id}`);
    if (!m.abilities.some((a) => a.id === 'basico') && m.rank !== 'chefe') p.push(`${m.id}: sem ataque básico`);
  }
  for (const b of ALL_MONSTERS.filter((m) => m.rank === 'chefe')) {
    const boss = b as typeof b & { rotation?: string[]; start?: string[] };
    for (const r of boss.rotation ?? []) if (!b.abilities.some((a) => a.id === r)) p.push(`chefe ${b.id}: rotação cita ${r}`);
    for (const s of boss.start ?? []) if (!enemyObjectById.has(s)) p.push(`chefe ${b.id}: parte ${s}`);
  }
  for (const r of RECIPES) { for (const [k] of r.inputs) item(k, `receita ${r.id}`); item(r.output[0], `receita ${r.id}`); }
  for (const l of WORK_LOCATIONS) { if (!regionById.has(l.region)) p.push(`local ${l.id}: região`); for (const y of l.yields) item(y.item, `local ${l.id}`); }
  for (const reg of REGIONS) item(reg.signature, `região ${reg.id}`);
  for (const c of CAMPAIGNS) {
    if (!monsterById.has(c.boss)) p.push(`campanha ${c.id}: chefe ${c.boss}`);
    item(c.fragmentReward.key, `campanha ${c.id}`);
    for (const ch of c.chapters) for (const n of ch.nodes) {
      if (n.t === 'combate') for (const e of n.enemies) if (!monsterById.has(e)) p.push(`campanha ${c.id}: criatura ${e}`);
      if (n.t === 'chefe' && !monsterById.has(n.boss)) p.push(`campanha ${c.id}: chefe ${n.boss}`);
      if (n.t === 'recompensa') for (const [k] of n.items) item(k, `campanha ${c.id}`);
      if (n.t === 'teste') for (const [k] of n.success.items ?? []) item(k, `campanha ${c.id}`);
    }
  }
  for (const a of Object.values(PET_AFFINITIES)) for (const tier of a.loot) for (const [k] of tier) item(k, `pet ${a.id}`);
  for (const m of MATERIALS) item(m.item, 'material');
  for (const x of [...REINFORCEMENTS, ...LININGS, ...FINISHES]) for (const [k] of x.items) if (k !== '$metal') item(k, `camada ${x.id}`);
  for (const s of SHOP_STOCK) item(s.item, 'loja');
  for (const d of RARE_DISCOVERIES) for (const [k] of d.reward.items ?? []) item(k, `descoberta ${d.id}`);
  if (CONTRACT_TEMPLATES.length < 6) p.push('poucos contratos');
  return p;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = validateContent();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`✅ Conteúdo válido: ${ITEMS.length} itens, ${SKILLS.size} habilidades, ${MODIFIERS.size} modificadores, ${PASSIVES.size} passivas, ${ALL_MONSTERS.length} criaturas, ${RECIPES.length} receitas, ${WORK_LOCATIONS.length} locais, ${CAMPAIGNS.length} campanhas.`);
}
