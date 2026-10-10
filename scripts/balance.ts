// Relatório de balanceamento: heróis-padrão contra cada região e cada chefe.
import { CLASSES } from '../src/data/classes/index.ts';
import { COMMONS, BOSSES, VARIANTS } from '../src/data/monsters/index.ts';
import { REGIONS } from '../src/data/regions.ts';
import { makeHero, simulate } from '../src/game/sim.ts';

const args = process.argv.slice(2);
const N = Number(args[0] ?? 6);
console.log('== Solo: cada classe contra 2 comuns da região (nível médio) ==');
for (const reg of REGIONS) {
  const lvl = Math.round((reg.levels[0] + reg.levels[1]) / 2);
  const mons = COMMONS.filter((m) => m.region === reg.id);
  const row: string[] = [];
  for (const c of CLASSES) {
    let wins = 0, rounds = 0;
    for (let s = 0; s < N; s++) {
      const a = mons[(s * 3) % mons.length], b = mons[(s * 7 + 1) % mons.length];
      const st = simulate([makeHero(c.id, lvl, 1)], [{ monsterId: a.id, level: lvl }, { monsterId: b.id, level: lvl }], s + 1);
      if (st.outcome === 'vitoria') wins++;
      rounds += st.round;
    }
    row.push(`${c.id.slice(0, 5)} ${wins}/${N} r${(rounds / N).toFixed(0)}`);
  }
  console.log(reg.id.padEnd(10), row.join(' | '));
}
console.log('\n== Variantes solo (nível da variante) ==');
let vw = 0, vt = 0;
for (const v of VARIANTS) for (const c of CLASSES) { const st = simulate([makeHero(c.id, v.level + 1, 1)], [{ monsterId: v.id }], vt + 3); vt++; if (st.outcome === 'vitoria') vw++; }
console.log(`vitórias ${vw}/${vt}`);
console.log('\n== Chefes com grupo sugerido (nível do chefe +2) ==');
const party = ['guerreiro', 'clerigo', 'mago', 'patrulheiro'];
for (const b of BOSSES) {
  let wins = 0, rounds = 0;
  for (let s = 0; s < N; s++) {
    const heroes = party.slice(0, Math.max(2, b.partySuggested)).map((c, i) => makeHero(c, Math.min(60, b.level + 2), i + 1));
    const st = simulate(heroes, [{ monsterId: b.id }], s + 11, 'chefe');
    if (st.outcome === 'vitoria') wins++;
    rounds += st.round;
  }
  console.log(b.id.padEnd(22), `vitórias ${wins}/${N}`, `rodadas ~${(rounds / N).toFixed(0)}`);
}
