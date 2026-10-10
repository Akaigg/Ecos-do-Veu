import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, submitAction, resolveRound, validTargets, enemiesOf, byId } from '../src/game/combat/engine.ts';
import { makeHero, simulate, runAuto } from '../src/game/sim.ts';
import type { CombatContext } from '../src/game/combat/state.ts';

const ctx = (partySize = 1, kind: CombatContext['kind'] = 'exploracao'): CombatContext => ({ kind, region: 'bosque', partySize, mode: 'solo', canFlee: true, flags: [] });

test('mesma semente produz exatamente o mesmo combate', () => {
  const a = simulate([makeHero('guerreiro', 3, 1)], [{ monsterId: 'lobo-cinzento' }, { monsterId: 'lobo-cinzento' }], 99);
  const b = simulate([makeHero('guerreiro', 3, 1)], [{ monsterId: 'lobo-cinzento' }, { monsterId: 'lobo-cinzento' }], 99);
  assert.equal(a.outcome, b.outcome);
  assert.deepEqual(a.log, b.log);
});

test('inimigos mostram intenção antes de agir', () => {
  const st = createCombat({ id: 't', seed: 1, heroes: [makeHero('guerreiro', 3, 1)], enemies: [{ monsterId: 'lobo-cinzento' }], context: ctx() });
  for (const e of enemiesOf(st).filter((f) => f.kind === 'monstro')) assert.ok(e.intent, `${e.name} tem intenção visível`);
});

test('habilidade corpo a corpo exige a linha de frente', () => {
  const hero = makeHero('guerreiro', 3, 1, { line: 'tras' });
  const st = createCombat({ id: 't', seed: 1, heroes: [hero], enemies: [{ monsterId: 'lobo-cinzento' }], context: ctx() });
  const target = enemiesOf(st)[0];
  const err = submitAction(st, hero.id, { kind: 'habilidade', skillId: 'golpe-preciso', targetId: target.id });
  assert.ok(err && /frente/.test(err), String(err));
  // Mover e agir na mesma rodada é permitido.
  assert.equal(submitAction(st, hero.id, { kind: 'habilidade', skillId: 'golpe-preciso', targetId: target.id, move: true }), null);
  resolveRound(st);
  assert.equal(byId(st, hero.id)!.line, 'frente');
});

test('partes protegidas por ordem não aparecem como alvo', () => {
  const heroes = [makeHero('guerreiro', 20, 1), makeHero('mago', 20, 2, { line: 'tras' })];
  const st = createCombat({ id: 't', seed: 3, heroes, enemies: [{ monsterId: 'colosso-mina-oca' }], context: ctx(2, 'chefe') });
  const plates = enemiesOf(st).filter((f) => f.kind === 'objeto');
  assert.equal(plates.length, 3);
  const targets = validTargets(st, heroes[1], 'inimigo', false).map((f) => f.id);
  assert.ok(plates.some((p) => !targets.includes(p.id)), 'ao menos uma placa está travada pela ordem');
});

test('combate termina e não aceita ações depois do fim', () => {
  const st = runAuto(createCombat({ id: 't', seed: 5, heroes: [makeHero('patrulheiro', 5, 1)], enemies: [{ monsterId: 'lobo-cinzento' }], context: ctx() }));
  assert.ok(st.outcome);
  assert.equal(submitAction(st, 'p1', { kind: 'defender' }), 'O combate já terminou.');
});
