import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../scripts/validate-data.ts';
import { RACES } from '../src/data/races.ts';
import { CLASSES, TALENT_NODES, nodesByClass, talentPointsForLevel } from '../src/data/classes/index.ts';
import { PROFESSIONS } from '../src/data/professions.ts';
import { COMMONS, VARIANTS, BOSSES } from '../src/data/monsters/index.ts';
import { monsterSprite } from '../src/render/sprites/monsters.ts';
import { itemIcon } from '../src/render/sprites/icons.ts';
import { ITEMS } from '../src/data/items.ts';
import { simulateWork } from '../src/game/work.ts';
import { workLocationById } from '../src/data/regions.ts';
import { activeEvent } from '../src/data/events.ts';

test('quantidades do documento de design', () => {
  assert.equal(RACES.length, 10);
  assert.equal(CLASSES.length, 10);
  assert.equal(PROFESSIONS.length, 10);
  assert.equal(COMMONS.length, 120);
  assert.equal(VARIANTS.length, 50);
  assert.equal(BOSSES.length, 20);
  for (const c of CLASSES) {
    assert.equal(c.trees.length, 3, c.id);
    assert.equal(nodesByClass(c.id).length, 30, `${c.id}: ~30 nós`);
  }
  assert.equal(TALENT_NODES.length, 300);
});

test('pontos de talento não bastam para completar todas as árvores', () => {
  for (const c of CLASSES) {
    const all = nodesByClass(c.id).filter((n) => !n.auto && !['f1b', 'f2b'].includes(n.slot)).reduce((s, n) => s + n.cost, 0);
    assert.ok(talentPointsForLevel(60) < all, `${c.id}: ${talentPointsForLevel(60)} pontos < ${all}`);
  }
});

test('integridade de referências entre dados', () => {
  const problems = validateContent();
  assert.deepEqual(problems, []);
});

test('toda criatura e todo item têm pixel art renderizável', () => {
  for (const m of [...COMMONS, ...VARIANTS, ...BOSSES]) {
    const s = monsterSprite(m.id, { boss64: m.rank === 'chefe' });
    let filled = 0;
    for (let i = 3; i < s.data.length; i += 4) if (s.data[i] > 0) filled++;
    assert.ok(filled > 60, `${m.id} tem pixels desenhados`);
  }
  for (const it of ITEMS) {
    const png = itemIcon(it.id).png();
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length < 2000, `ícone ${it.id} é leve (${png.length} bytes)`);
  }
});

test('ordem de trabalho é determinística e respeita a primeira parada', () => {
  const loc = workLocationById.get('mina-cinzenta')!;
  const p = {
    location: loc.id, profession: 'mineracao', hours: 5, profLevel: 1, ranks: { rendimento: 0, conservacao: 0, raridade: 0, secundario: 0 },
    tools: [{ rowId: 1, name: 'Picareta', durability: 70, maxDurability: 100, tier: 1, valuable: false }],
    supplies: { racao: 6, agua: 5, celula: 0 }, perHour: { racao: 1, agua: 1, celula: 0 }, capacityKg: 45, yieldBonus: 0, wearReduction: 0,
    fatigueStartHours: 7, fatigueRate: 0.08, hazard: undefined, hazardCountered: true, discoveryBonus: 0, darkBonus: 0,
    rules: { stopBeforeBreak: true, useReserves: true, returnAt: 0.95, ignoreCommon: false, stopOnDanger: true },
  };
  const a = simulateWork(p, loc, 42), b = simulateWork(p, loc, 42);
  assert.deepEqual(a, b);
  assert.ok(a.minutes <= 300);
  assert.ok(['tempo', 'mochila', 'ferramenta', 'agua'].includes(a.stop));
  // Água para exatamente 5 horas: nunca passa disso.
  assert.ok(a.consumed.agua <= 5);
  // Interrupção no meio produz um subconjunto coerente
  const half = simulateWork(p, loc, 42, 90);
  assert.ok(half.minutes <= 90);
  assert.equal(half.stop, 'interrompido');
});

test('eventos regionais são cíclicos (voltam em semanas futuras)', () => {
  const seen = new Map<string, number>();
  for (let w = 0; w < 120; w++) {
    const ev = activeEvent('bosque', Date.UTC(2026, 0, 5) + w * 7 * 86400000);
    if (ev) seen.set(ev.id, (seen.get(ev.id) ?? 0) + 1);
  }
  for (const [, n] of seen) assert.ok(n >= 2);
  assert.ok(seen.size >= 5);
});
