import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Db } from '../src/db/database.ts';
import { createGame, HOUR, addItem, charOwner, type Game } from '../src/services/core.ts';
import { commands, components, dispatch } from '../src/bot/index.ts';
import { requireCharacter } from '../src/services/character.ts';

// ---------------------------------------------------------------- simulação de interações do Discord

type Payload = { content?: string; embeds?: { toJSON?: () => unknown }[]; components?: { toJSON: () => { components: { custom_id?: string; options?: { value: string }[] }[] } }[]; files?: unknown[] };
interface Captured { payloads: Payload[]; errors: string[] }

function validate(p: Payload) {
  for (const e of p.embeds ?? []) (e as { toJSON: () => unknown }).toJSON?.();
  for (const c of p.components ?? []) c.toJSON();
}

function base(userId: string, cap: Captured) {
  const send = async (p: Payload | string) => {
    const payload = typeof p === 'string' ? { content: p } : p;
    validate(payload);
    cap.payloads.push(payload);
    if (payload.content?.startsWith('⚠️')) cap.errors.push(payload.content);
    return { resource: { message: { channelId: 'canal', id: `msg${cap.payloads.length}` } } };
  };
  return {
    user: { id: userId, username: `u${userId}` }, channelId: 'canal', deferred: false, replied: false,
    isRepliable: () => true, reply: send, followUp: send, update: send, deferUpdate: async () => {}, showModal: async () => {},
    client: { channels: { fetch: async () => null }, users: { fetch: async () => ({ send: async () => {} }) } },
    message: { channelId: 'canal', id: 'painel' },
  };
}

async function slash(g: Game, userId: string, name: string, sub: string | null, opts: Record<string, unknown> = {}): Promise<Captured> {
  const cap: Captured = { payloads: [], errors: [] };
  const get = (k: string, req?: boolean) => {
    if (opts[k] === undefined && req) throw new Error(`opção obrigatória ausente no teste: ${k}`);
    return opts[k] ?? null;
  };
  const i = {
    ...base(userId, cap), commandName: name,
    isChatInputCommand: () => true, isAutocomplete: () => false, isButton: () => false, isStringSelectMenu: () => false, isModalSubmit: () => false,
    options: {
      getSubcommand: () => sub, getString: get, getInteger: get, getBoolean: get, getFocused: () => '',
      getUser: (k: string, req?: boolean) => { const v = get(k, req); return v ? { id: v, username: `u${v}` } : null; },
    },
  };
  await dispatch({ game: g }, i as never);
  return cap;
}

async function click(g: Game, userId: string, customId: string, values?: string[]): Promise<Captured> {
  const cap: Captured = { payloads: [], errors: [] };
  const i = {
    ...base(userId, cap), customId, values,
    isChatInputCommand: () => false, isAutocomplete: () => false, isButton: () => !values, isStringSelectMenu: () => !!values, isModalSubmit: () => false,
  };
  await dispatch({ game: g }, i as never);
  return cap;
}

const ids = (p: Payload) => (p.components ?? []).flatMap((r) => r.toJSON().components.map((c) => c.custom_id ?? ''));

function setup() {
  let now = Date.UTC(2026, 9, 12, 12);
  const g = createGame(new Db(':memory:'), () => now);
  return { g, advance: (ms: number) => { now += ms; } };
}

test('todos os comandos e componentes estão registrados', () => {
  assert.equal(commands.size, 22);
  for (const p of ['cb', 'ex', 'cp', 'gp', 'wk', 'fb', 'hb', 'pc', 'pt', 'ct', 'mk', 'gd']) assert.ok(components.has(p), p);
});

test('fluxo completo de um jogador pelo Discord (simulado)', async () => {
  const { g, advance } = setup();
  const U = '111';
  let r = await slash(g, U, 'personagem', 'criar', { nome: 'Lira Vale', raca: 'elfo', origem: 'eremita', classe: 'patrulheiro', pronomes: 'ela/dela', cabelo: 'trança', cor_cabelo: 'ruivo' });
  assert.deepEqual(r.errors, []);
  assert.ok(r.payloads[0].files?.length, 'ficha com retrato');
  for (const [cmd, sub, opts] of [
    ['personagem', 'ver', {}], ['habilidades', 'ver', {}], ['classe', 'ver', {}], ['profissoes', 'ver', {}], ['reputacao', null, {}],
    ['ajuda', null, {}], ['inventario', null, {}], ['inventario', null, { filtro: 'pecas' }], ['equipamento', 'ver', {}], ['loja', 'ver', {}],
    ['viajar', null, {}], ['contratos', null, {}], ['pet', 'ver', {}], ['bestiario', null, {}], ['mercado', 'buscar', {}], ['atividade', null, {}],
    ['fabricar', 'receitas', { profissao: 'alquimia' }], ['personagem', 'atributos', { atributo: 'destreza', pontos: 3 }],
    ['personagem', 'cinto', { item1: 'pocao-vida-menor', qtd1: 3, item2: 'isca-simples', qtd2: 2 }],
  ] as [string, string | null, Record<string, unknown>][]) {
    r = await slash(g, U, cmd, sub, opts);
    assert.deepEqual(r.errors, [], `${cmd} ${sub}`);
    assert.ok(r.payloads.length, `${cmd} ${sub} respondeu`);
  }

  // Ordem de trabalho: prévia → confirmar → relatório
  r = await slash(g, U, 'trabalhar', null, { atividade: 'herbalismo', local: 'clareira-ervas', duracao: 3 });
  assert.deepEqual(r.errors, []);
  const go = ids(r.payloads[0]).find((x) => x.startsWith('wk:go'))!;
  assert.ok(go);
  r = await click(g, U, go);
  assert.deepEqual(r.errors, []);
  r = await slash(g, U, 'atividade', null);
  assert.ok(r.payloads[0].embeds?.length);
  advance(4 * HOUR);
  const { processDue } = await import('../src/services/jobs.ts');
  processDue(g);

  // Fabricação com confirmação
  addItem(g, charOwner(requireCharacter(g, U).id), 'erva-folha-prata', 4);
  addItem(g, charOwner(requireCharacter(g, U).id), 'agua', 4);
  r = await slash(g, U, 'fabricar', 'receita', { receita: 'pocao-vida-menor', quantidade: 2 });
  assert.deepEqual(r.errors, []);
  r = await click(g, U, 'fb:go');
  assert.deepEqual(r.errors, []);
  r = await slash(g, U, 'fabricar', 'equipamento', { tipo: 'arma', modelo: 'arco', material: 'tora-pinho' });
  assert.deepEqual(r.errors, []);

  // Loja
  r = await slash(g, U, 'loja', 'comprar', { item: 'racao', quantidade: 5 });
  assert.deepEqual(r.errors, []);

  // Exploração com combate pelos botões
  r = await slash(g, U, 'explorar', null, {});
  assert.deepEqual(r.errors, []);
  let panel = r.payloads[0];
  let guard = 0;
  while (guard++ < 120) {
    const buttons = ids(panel);
    if (!buttons.length || buttons.includes('ex:start')) break;
    const choice = buttons.find((x) => x.startsWith('cb:sk')) ?? buttons.find((x) => x.startsWith('cb:atk')) ?? buttons.find((x) => x.startsWith('ex:go'));
    if (!choice) break;
    r = await click(g, U, choice);
    if (r.errors.length) {
      // habilidade em recarga ou sem recurso: usa ataque básico
      const atk = buttons.find((x) => x.startsWith('cb:atk'));
      if (!atk) break;
      r = await click(g, U, atk);
    }
    assert.deepEqual(r.errors, [], `clique ${choice}`);
    panel = r.payloads[r.payloads.length - 1];
  }
  assert.ok(guard > 3, 'percorreu a exploração');
  assert.ok((g.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM combats')?.n ?? 0) >= 1, 'combateu pelos botões');
  assert.ok(g.db.get("SELECT 1 FROM activities WHERE kind = 'exploracao' AND status = 'concluida'"), 'exploração concluída');
  assert.ok(g.db.get("SELECT 1 FROM activities WHERE kind = 'trabalho' AND status = 'concluida'"), 'ordem de trabalho concluída');
});

test('grupo, guilda, mercado e campanha pelo Discord (simulado)', async () => {
  const { g } = setup();
  const A = '201', B = '202';
  await slash(g, A, 'personagem', 'criar', { nome: 'Doran Ferro', raca: 'anao', origem: 'ex-soldado', classe: 'guerreiro', pronomes: 'ele/dele' });
  await slash(g, B, 'personagem', 'criar', { nome: 'Sel Brisa', raca: 'silvestre', origem: 'estudioso', classe: 'clerigo', pronomes: 'elu/delu' });
  g.db.run('UPDATE characters SET gold = 3000');
  g.db.run('UPDATE class_progress SET level = 7');
  let r = await slash(g, A, 'grupo', 'convidar', { usuario: B });
  assert.deepEqual(r.errors, []);
  const join = ids(r.payloads[0])[0];
  r = await click(g, B, join);
  assert.deepEqual(r.errors, []);
  r = await slash(g, A, 'campanha', 'iniciar', { campanha: 'colmeia-seda' });
  assert.deepEqual(r.errors, []);
  let panel = r.payloads[0];
  for (let k = 0; k < 6; k++) {
    const next = ids(panel).find((x) => x.startsWith('cp:'));
    if (!next) break;
    r = await click(g, A, next);
    assert.deepEqual(r.errors, []);
    panel = r.payloads[r.payloads.length - 1];
    if (ids(panel).includes(`cb:act:${ids(panel).find((x) => x.startsWith('cb:act'))?.split(':')[2]}`)) break;
  }
  r = await slash(g, A, 'guilda', 'criar', { nome: 'Martelo Antigo', sigla: 'MTA' });
  assert.deepEqual(r.errors, []);
  r = await slash(g, A, 'guilda', 'ver', {});
  assert.deepEqual(r.errors, []);
  assert.ok(r.payloads[0].files?.length, 'imagem da sede');
  r = await slash(g, A, 'mercado', 'vender', { item: 'racao', quantidade: 2, preco: 4 });
  assert.deepEqual(r.errors, []);
  r = await slash(g, B, 'mercado', 'buscar', {});
  assert.deepEqual(r.errors, []);
});
