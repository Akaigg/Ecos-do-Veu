// Exporta folhas de pré-visualização de toda a pixel art para ./out/sprites (e docs/preview com --docs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMONS, VARIANTS, BOSSES } from '../src/data/monsters/index.ts';
import { Canvas, hex } from '../src/render/canvas.ts';
import { monsterSprite } from '../src/render/sprites/monsters.ts';

const docs = process.argv.includes('--docs');
const dir = docs ? 'docs/preview' : 'out/sprites';
mkdirSync(dir, { recursive: true });

function sheet(ids: string[], cols: number, cell: number, scale: number, boss = false): Canvas {
  const rows = Math.ceil(ids.length / cols);
  const c = new Canvas(cols * cell * scale, rows * cell * scale, hex('#1a1424'));
  ids.forEach((id, i) => {
    const x = (i % cols) * cell * scale, y = Math.floor(i / cols) * cell * scale;
    if ((i + Math.floor(i / cols)) % 2) c.rect(x, y, cell * scale, cell * scale, hex('#221a2e'));
    c.blit(monsterSprite(id, { boss64: boss }), x, y, scale);
  });
  return c;
}

const outputs: [string, Canvas][] = [
  ['bestiario-comuns.png', sheet(COMMONS.map((m) => m.id), 10, 32, 2)],
  ['bestiario-variantes.png', sheet(VARIANTS.map((m) => m.id), 10, 32, 2)],
  ['bestiario-chefes.png', sheet(BOSSES.map((m) => m.id), 5, 64, 2, true)],
];
for (const [name, c] of outputs) {
  writeFileSync(join(dir, name), c.png());
  console.log(`${join(dir, name)} (${c.w}×${c.h})`);
}

// ---------------- itens, ícones de habilidade e retratos
import { ITEMS } from '../src/data/items.ts';
import { itemIcon, skillIcon, GLYPHS } from '../src/render/sprites/icons.ts';
import { renderPortrait } from '../src/render/sprites/portrait.ts';
import { RACES } from '../src/data/races.ts';
import { CLASSES } from '../src/data/classes/index.ts';
import { defaultGear } from '../src/game/sim.ts';

const items = ITEMS.filter((i) => i.kind !== 'runa' || i.id.endsWith('-2'));
const ic = new Canvas(20 * 16 * 3, Math.ceil(items.length / 20) * 16 * 3, hex('#1a1424'));
items.forEach((it, i) => ic.blit(itemIcon(it.id), (i % 20) * 48, Math.floor(i / 20) * 48, 3));
writeFileSync(join(dir, 'itens.png'), ic.png());

const glyphs = Object.keys(GLYPHS);
const gs = new Canvas(12 * 26 * 2, Math.ceil(glyphs.length / 12) * 26 * 2, hex('#1a1424'));
glyphs.forEach((gname, i) => {
  const cls = CLASSES[i % CLASSES.length];
  const kind = (['ativa', 'modificador', 'passiva', 'culminante'] as const)[i % 4];
  gs.blit(skillIcon(gname, cls.color, kind), (i % 12) * 52 + 2, Math.floor(i / 12) * 52 + 2, 2);
});
writeFileSync(join(dir, 'habilidades.png'), gs.png());

const pc = new Canvas(5 * 64 * 3, 2 * 64 * 3);
RACES.forEach((race, i) => {
  const cls = CLASSES[i];
  const looks = ['tunica', 'manto', 'sobretudo', 'couro', 'brigandina', 'malha', 'escamas', 'placas'];
  const gear = defaultGear(cls.id, 30);
  const p = renderPortrait({
    race: race.id, classId: cls.id, region: ['bosque', 'pantano', 'minas', 'tundra', 'deserto', 'montanhas', 'fungica', 'costa', 'veu', 'fendas'][i],
    appearance: { height: ['média', 'alta', 'baixa'][i % 3], build: ['atlética', 'esguia', 'robusta'][i % 3], hair: ['curto', 'longo', 'trança', 'moicano', 'coque', 'cacheado', 'raspado'][i % 7], hairColor: Object.keys({ preto: 1, ruivo: 1, loiro: 1, branco: 1, azul: 1, castanho: 1, verde: 1, violeta: 1, cinza: 1, rosa: 1 })[i], eyes: ['azul', 'verde', 'ambar', 'violeta', 'dourado'][i % 5], skin: i % 3, marks: ['nenhuma', 'cicatriz', 'tatuagem', 'pintura', 'sardas', 'runas'][i % 6] },
    equipment: gear.map((g, gi) => (g.slot === 'torso' ? { ...g, data: { ...g.data, appearance: { visual: undefined } } } : g)).map((g) => ({ slot: g.slot, data: g.data })),
  });
  void looks;
  pc.blit(p, (i % 5) * 192, Math.floor(i / 5) * 192, 3);
});
writeFileSync(join(dir, 'retratos.png'), pc.png());
console.log('itens, habilidades e retratos exportados');

// ---------------- cenas
import { skillTreeImage, itemCatalog, battleImage, worldMap, guildHall } from '../src/render/scenes.ts';
import { makeHero } from '../src/game/sim.ts';
import { createCombat, resolveRound } from '../src/game/combat/engine.ts';
import { SHOP_STOCK } from '../src/data/social.ts';
import { nodesByClass } from '../src/data/classes/index.ts';

const learned = nodesByClass('guerreiro').filter((n) => n.treeId === 'bastiao' || n.slot === 'a1' || n.slot === 'f1a').map((n) => n.id).filter((id) => !id.endsWith('f1b') && !id.endsWith('f2b'));
const states = Object.fromEntries(nodesByClass('guerreiro').map((n) => [n.id, learned.includes(n.id) ? 'aprendido' : n.id.endsWith('f1b') || n.id.endsWith('f2b') ? 'excluido' : n.reqLevel > 30 ? 'nivel' : 'disponivel'])) as Record<string, 'aprendido'>;
writeFileSync(join(dir, 'arvore-guerreiro.png'), skillTreeImage('guerreiro', learned, 30, states).png());
writeFileSync(join(dir, 'loja.png'), itemCatalog(SHOP_STOCK.map((s) => ({ item: s.item, price: s.price }))).png());
const st = createCombat({ id: 'x', seed: 5, heroes: [makeHero('guerreiro', 20, 1), makeHero('mago', 20, 2), makeHero('clerigo', 20, 3)], enemies: [{ monsterId: 'colosso-mina-oca' }], context: { kind: 'chefe', region: 'minas', partySize: 3, mode: 'ao_vivo', canFlee: false, flags: [] } });
resolveRound(st);
writeFileSync(join(dir, 'batalha.png'), battleImage(st, (f) => ({ p1: 'guerreiro', p2: 'mago', p3: 'clerigo' } as Record<string, string>)[f.id]).png());
writeFileSync(join(dir, 'mapa.png'), worldMap('pantano', ['bosque', 'planicies', 'minas', 'pantano']).png());
writeFileSync(join(dir, 'guilda.png'), guildHall('Lanternas do Véu', 'LNT', { salao: 2, oficina: 2, estabulo: 1, biblioteca: 1, cofre: 1 }, { color: '#2a5a8a', color2: '#e0c040', symbol: 'lua' }, 23).png());
console.log('cenas exportadas');
