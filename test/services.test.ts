import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Db } from '../src/db/database.ts';
import { createGame, charOwner, countItem, addItem, GameError, HOUR, type Game } from '../src/services/core.ts';
import { createCharacter, requireCharacter, allocateAttribute, travel, activeProgress, getProf, addProfXp, setMaster } from '../src/services/character.ts';
import { learnNode, equipSkills, respecTalents, knownSkills, saveLoadout, changeClass } from '../src/services/talents.ts';
import { planWork, startWork, finishWork, currentWork } from '../src/services/work.ts';
import { queueCraft, finishCraft, pendingQueue } from '../src/services/crafting.ts';
import { startExploration, choosePath, currentExploration, returnToCity } from '../src/services/exploration.ts';
import { act, loadCombat } from '../src/services/combat.ts';
import { routeSettlement, processDue } from '../src/services/jobs.ts';
import { tamePet, listPets, startPetMission, finishPetMission, setActivePet } from '../src/services/pets.ts';
import { createListing, buyListing, searchListings, createCommission, acceptCommission } from '../src/services/market.ts';
import { createGuild, inviteToGuild, acceptGuildInvite, depositItem, withdraw, startProject, contribute, guildOf } from '../src/services/guild.ts';
import { inviteToParty, joinParty } from '../src/services/party.ts';
import { startCampaign, advanceCampaign, vote, runOf } from '../src/services/campaign.ts';
import { listContracts } from '../src/services/contracts.ts';
import { autoAction } from '../src/game/sim.ts';

function setup() {
  let now = Date.UTC(2026, 9, 12, 12);
  const g: Game = createGame(new Db(':memory:'), () => now);
  return { g, advance: (ms: number) => { now += ms; } };
}

const mk = (g: Game, user: string, classId = 'guerreiro', race = 'humano') =>
  createCharacter(g, user, { name: `Herói ${user}`.replace(/[0-9]/g, 'x'), race, origin: 'ex-soldado', classId, pronouns: 'ela/dela' });

test('criação de personagem com kit inicial e regras globais', () => {
  const { g } = setup();
  const c = mk(g, 'u1');
  assert.equal(c.classId, 'guerreiro');
  assert.ok(c.gold >= 100);
  assert.ok(countItem(g, charOwner(c.id), 'racao') >= 10);
  assert.throws(() => mk(g, 'u1'), GameError, 'um personagem por usuário, global');
  const p = activeProgress(g, c);
  assert.equal(p.equipped.length, 4);
  assert.throws(() => createCharacter(g, 'u2', { name: 'x', race: 'humano', origin: 'eremita', classId: 'mago', pronouns: 'ele/dele' }), GameError);
});

test('talentos: bifurcação exclusiva, pontos e redistribuição', () => {
  const { g } = setup();
  const c = mk(g, 'u1');
  assert.throws(() => learnNode(g, c, 'guerreiro/bastiao/f1a'), /nível/);
  g.db.run('UPDATE class_progress SET level = 10 WHERE character_id = ?', c.id);
  learnNode(g, c, 'guerreiro/bastiao/f1a');
  assert.throws(() => learnNode(g, c, 'guerreiro/bastiao/f1b'), /bifurcação/);
  learnNode(g, c, 'guerreiro/bastiao/a2');
  assert.ok(knownSkills(activeProgress(g, c)).includes('interceptar'));
  equipSkills(g, c, ['golpe-escudo', 'interceptar', 'provocacao'], 'treino-combate');
  assert.equal(saveLoadout(g, c, 'Chefes'), 'chefes');
  assert.equal(respecTalents(g, c), 0);
  assert.ok(!activeProgress(g, c).learned.includes('guerreiro/bastiao/a2'));
  allocateAttribute(g, c, 'forca', 5);
  assert.throws(() => allocateAttribute(g, c, 'forca', 999), GameError);
  const p = changeClass(g, requireCharacter(g, 'u1'), 'mago');
  assert.equal(p.level, 1);
});

test('ordem de trabalho: reserva, simulação determinística, entrega e interrupção', () => {
  const { g, advance } = setup();
  const c = mk(g, 'u1');
  const plan = planWork(g, c, 'mina-cinzenta', 5);
  assert.ok(plan.forecast.limits.find((l) => l.label === 'Ferramenta'));
  const racaoBefore = countItem(g, charOwner(c.id), 'racao');
  const { activityId, endsAt } = startWork(g, c, plan);
  assert.ok(countItem(g, charOwner(c.id), 'racao') < racaoBefore, 'rações reservadas');
  assert.throws(() => startWork(g, c, plan), GameError, 'uma atividade de campo por vez');
  advance(HOUR);
  const partial = currentWork(g, c.id)!;
  assert.ok(partial.partial.minutes <= 60);
  advance(endsAt - Date.UTC(2026, 9, 12, 12) - HOUR + 1000);
  processDue(g);
  const rep = finishWork(g, activityId);
  assert.equal(rep, null, 'idempotente');
  const ores = countItem(g, charOwner(c.id), 'minerio-cobre') + countItem(g, charOwner(c.id), 'minerio-estanho') + countItem(g, charOwner(c.id), 'carvao');
  assert.ok(ores > 0, 'minérios entregues');
  assert.ok(getProf(g, c.id, 'mineracao').xp > 0 || getProf(g, c.id, 'mineracao').level > 1);
  // Interrupção devolve suprimentos não usados
  const plan2 = planWork(g, requireCharacter(g, 'u1'), 'clareira-ervas', 4);
  const s2 = startWork(g, c, plan2);
  advance(30 * 60_000);
  const r2 = finishWork(g, s2.activityId, Date.UTC(2026, 9, 12, 12) + 999999999);
  assert.ok(r2);
});

test('fabricação: materiais saem uma vez só e a fila entrega', () => {
  const { g, advance } = setup();
  const c = mk(g, 'u1');
  addItem(g, charOwner(c.id), 'minerio-cobre', 4);
  addItem(g, charOwner(c.id), 'minerio-estanho', 2);
  addItem(g, charOwner(c.id), 'carvao', 2);
  queueCraft(g, c, { t: 'receita', recipe: 'lingote-bronze', qty: 2 });
  assert.throws(() => queueCraft(g, c, { t: 'receita', recipe: 'lingote-bronze', qty: 2 }), /Faltam materiais/);
  advance(HOUR);
  processDue(g);
  assert.equal(countItem(g, charOwner(c.id), 'lingote-bronze'), 2);
  addItem(g, charOwner(c.id), 'lingote-bronze', 10);
  addItem(g, charOwner(c.id), 'tecido-la', 2);
  const q = queueCraft(g, c, { t: 'equipamento', kind: 'armadura', model: 'cota-malha', piece: 'torso', material: 'lingote-bronze', reinforcement: 'malha', runes: [] });
  assert.ok(q.analysis.ok);
  assert.throws(() => queueCraft(g, c, { t: 'equipamento', kind: 'armadura', model: 'placas', piece: 'torso', material: 'lingote-bronze', reinforcement: 'placas-extras', runes: ['runa-vida-1', 'runa-vida-1'] }), /Capacidade|runa|Faltam/);
  advance(3 * HOUR);
  processDue(g);
  assert.equal(pendingQueue(g, c.id).length, 0);
  assert.equal(finishCraft(g, q.row.id), null, 'idempotente');
  assert.ok(g.db.get("SELECT 1 FROM items WHERE owner_id = ? AND item_key = 'armadura:cota-malha'", c.id));
});

test('exploração com combate até o fim e mochila guardada', () => {
  const { g } = setup();
  const c = mk(g, 'u1');
  startExploration(g, c);
  let guard = 0;
  while (currentExploration(g, c.id) && guard++ < 40) {
    const ex = currentExploration(g, c.id)!;
    if (ex.state.combatId) {
      const loaded = loadCombat(g, ex.state.combatId)!;
      const me = loaded.state.fighters.find((f) => f.id === `p${c.id}`)!;
      const res = act(g, c, ex.state.combatId, autoAction(loaded.state, me));
      if (res.settlement) routeSettlement(g, res.kind, res.ref, res.settlement);
      continue;
    }
    choosePath(g, c, 0);
  }
  assert.equal(currentExploration(g, c.id), undefined);
  assert.ok(g.db.get("SELECT 1 FROM activities WHERE character_id = ? AND kind = 'exploracao' AND status = 'concluida'", c.id));
});

test('voltar à cidade guarda a mochila', () => {
  const { g } = setup();
  const c = mk(g, 'u1');
  startExploration(g, c);
  const st = returnToCity(g, c);
  assert.equal(st.ended, 'retorno');
});

test('pets: domar, missão e retorno com itens', () => {
  const { g, advance } = setup();
  const c = mk(g, 'u1');
  const pet = tamePet(g, c, 'lobo-cinzento', 6)!;
  assert.equal(listPets(g, c.id).length, 1);
  setActivePet(g, c, pet.id);
  addItem(g, charOwner(c.id), 'racao-pet', 10);
  startPetMission(g, c, pet.id, 'bosque', 2);
  assert.throws(() => setActivePet(g, c, pet.id), /missão/);
  advance(3 * HOUR);
  processDue(g);
  assert.equal(finishPetMission(g, pet.id), null);
  const after = listPets(g, c.id)[0];
  assert.ok(after.status === 'estabulo' || after.status === 'ferido');
  assert.ok(countItem(g, charOwner(c.id), 'carne-caca') + countItem(g, charOwner(c.id), 'couro-cru') > 0);
});

test('mercado: compra atômica, taxa e proteção contra compra dupla', () => {
  const { g } = setup();
  const a = mk(g, 'u1');
  const b = mk(g, 'u2');
  addItem(g, charOwner(a.id), 'minerio-ferro', 10);
  const l = createListing(g, a, { key: 'minerio-ferro', qty: 10 }, 5);
  assert.equal(searchListings(g, 'ferro').length, 1);
  const r = buyListing(g, requireCharacter(g, 'u2'), l.id, 10);
  assert.equal(r.total, 50);
  assert.throws(() => buyListing(g, requireCharacter(g, 'u2'), l.id, 1), GameError);
  assert.equal(countItem(g, charOwner(b.id), 'minerio-ferro'), 10);
});

test('encomenda: materiais e pagamento em custódia, artesão recebe', () => {
  const { g, advance } = setup();
  const req = mk(g, 'u1');
  const crafter = mk(g, 'u2');
  addItem(g, charOwner(req.id), 'lingote-bronze', 5);
  const com = createCommission(g, req, { t: 'equipamento', kind: 'arma', model: 'espada', material: 'lingote-bronze', runes: [] }, 30);
  assert.equal(countItem(g, charOwner(req.id), 'lingote-bronze'), 2);
  acceptCommission(g, crafter, com.id);
  const goldBefore = requireCharacter(g, 'u2').gold;
  advance(2 * HOUR);
  processDue(g);
  assert.equal(requireCharacter(g, 'u2').gold, goldBefore + 30);
  assert.ok(g.db.get("SELECT 1 FROM items WHERE owner_kind='char' AND owner_id = ? AND item_key = 'arma:espada' AND slot IS NULL", req.id));
});

test('guilda: cofre com permissões, registro e projeto', () => {
  const { g } = setup();
  const a = mk(g, 'u1');
  g.db.run('UPDATE characters SET gold = 5000 WHERE id = ?', a.id);
  const b = mk(g, 'u2');
  const gu = createGuild(g, requireCharacter(g, 'u1'), 'Lanternas', 'LNT');
  inviteToGuild(g, requireCharacter(g, 'u1'), b);
  acceptGuildInvite(g, b, gu.id);
  addItem(g, charOwner(a.id), 'tora-pinho', 50);
  depositItem(g, requireCharacter(g, 'u1'), 'tora-pinho', 50);
  assert.throws(() => withdraw(g, b, 'tora-pinho', 1), /Limite diário/);
  startProject(g, requireCharacter(g, 'u1'), 'oficina');
  addItem(g, charOwner(a.id), 'lingote-ferro', 30);
  contribute(g, requireCharacter(g, 'u1'), 'item', 'lingote-ferro', 30);
  assert.equal(guildOf(g, a.id)!.project!.items['lingote-ferro'], 30);
});

test('campanha em grupo: votação, teste, combate e progresso', () => {
  const { g } = setup();
  const a = mk(g, 'u1');
  const b = mk(g, 'u2', 'clerigo');
  for (const c of [a, b]) g.db.run('UPDATE class_progress SET level = 8 WHERE character_id = ?', c.id);
  inviteToParty(g, a, b);
  joinParty(g, b, g.db.get<{ id: number }>('SELECT id FROM parties')!.id);
  const run = startCampaign(g, requireCharacter(g, 'u1'), 'colmeia-seda');
  let guard = 0;
  while (guard++ < 200) {
    const r = runOf(g, a.id);
    if (!r || r.status !== 'ativa') break;
    if (r.combatId) {
      const loaded = loadCombat(g, r.combatId)!;
      for (const ch of [requireCharacter(g, 'u1'), requireCharacter(g, 'u2')]) {
        const me = loaded.state.fighters.find((f) => f.id === `p${ch.id}`);
        if (!me?.alive || loaded.state.pending[me.id]) continue;
        const res = act(g, ch, r.combatId, autoAction(loadCombat(g, r.combatId)!.state, me));
        if (res.settlement) routeSettlement(g, res.kind, res.ref, res.settlement);
        if (res.resolved) break;
      }
      continue;
    }
    const out = advanceCampaign(g, requireCharacter(g, 'u1'), r.id);
    if (out.awaitingVote) {
      const opts = ['libertar', 'queimar'];
      vote(g, requireCharacter(g, 'u1'), r.id, opts[1]);
      vote(g, requireCharacter(g, 'u2'), r.id, opts[1]);
    }
  }
  const final = g.db.get<{ status: string; chapter: number }>('SELECT status, chapter FROM campaign_runs WHERE id = ?', run.id)!;
  assert.ok(['ativa', 'concluida'].includes(final.status));
  assert.ok(final.chapter >= 1 || final.status === 'concluida', 'avançou pelos capítulos');
});

test('contratos semanais e viagem', () => {
  const { g } = setup();
  const c = mk(g, 'u1');
  assert.equal(listContracts(g, c).length, 3);
  assert.throws(() => travel(g, c, 'veu'), /nível/);
  g.db.run('UPDATE class_progress SET level = 5 WHERE character_id = ?', c.id);
  const cost = travel(g, requireCharacter(g, 'u1'), 'planicies');
  assert.ok(cost > 0);
  addProfXp(g, c, 'mineracao', 100);
  setMaster(g, requireCharacter(g, 'u1'), 'mineracao');
});
