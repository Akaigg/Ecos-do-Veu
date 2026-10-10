import { ATTRIBUTES, ELEMENTS, type AttributeId, type MealBuff } from '../data/types.ts';
import { RACES, ORIGINS, raceById, originById, PRONOUNS, HEIGHTS, BUILDS, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, MARKS } from '../data/races.ts';
import { CLASSES, classById, nodesByClass, talentPointsForLevel } from '../data/classes/index.ts';
import { PROFESSIONS, professionById, NON_MASTER_CAP, PROFESSION_MAX_LEVEL, profXpForLevel, MASTER_SLOTS } from '../data/professions.ts';
import { REGIONS, regionById, WORK_LOCATIONS, FACTIONS, REP_PER_RANK, factionById } from '../data/regions.ts';
import { itemById } from '../data/items.ts';
import { STARTER_KIT, ECONOMY, TITLES } from '../data/social.ts';
import { VISUALS, type Slot } from '../data/equipment.ts';
import { json } from '../db/database.ts';
import { attributePointsTotal, deriveStats, xpForClassLevel, MAX_CLASS_LEVEL, type CharacterSnapshot, type DerivedStats } from '../game/stats.ts';
import { maxDurabilityFor, type EquipData } from '../game/equipment.ts';
import { addItem, addUnique, charOwner, fail, ledger, removeItem, type Game, type ItemRow, countItem } from './core.ts';

export interface Appearance {
  height: string; build: string; hair: string; hairColor: string; eyes: string; skin: number; marks: string; voice: string;
}

export interface Character {
  id: number; userId: string; name: string; race: string; raceChoice: string | null; origin: string; pronouns: string;
  appearance: Appearance; story: string; classId: string; gold: number; region: string; visited: string[]; masters: string[];
  meal: { item: string; until: number } | null; title: string | null; activePet: number | null; belt: { item: string; qty: number }[];
  settings: { posture?: 'defender' | 'atacar'; loadoutOnCombat?: string }; history: string[]; attrRespecs: number; createdAt: number;
}

export interface ClassProgress {
  classId: string; level: number; xp: number; allocated: Record<AttributeId, number>; learned: string[]; equipped: string[];
  passive: string | null; loadouts: Record<string, { skills: string[]; passive: string | null }>; respecs: number; secondary: string | null;
}

interface CharRow {
  id: number; user_id: string; name: string; race: string; race_choice: string | null; origin: string; pronouns: string; appearance: string;
  story: string; class_id: string; gold: number; region: string; visited: string; masters: string; meal: string | null; title: string | null;
  active_pet: number | null; belt: string; settings: string; history: string; attr_respecs: number; created_at: number;
}

function toCharacter(r: CharRow): Character {
  return {
    id: r.id, userId: r.user_id, name: r.name, race: r.race, raceChoice: r.race_choice, origin: r.origin, pronouns: r.pronouns,
    appearance: json(r.appearance, {} as Appearance), story: r.story, classId: r.class_id, gold: r.gold, region: r.region,
    visited: json(r.visited, ['bosque']), masters: json(r.masters, []), meal: json(r.meal, null), title: r.title, activePet: r.active_pet,
    belt: json(r.belt, []), settings: json(r.settings, {}), history: json(r.history, []), attrRespecs: r.attr_respecs, createdAt: r.created_at,
  };
}

export function getCharacterByUser(g: Game, userId: string): Character | undefined {
  const r = g.db.get<CharRow>('SELECT * FROM characters WHERE user_id = ?', userId);
  return r ? toCharacter(r) : undefined;
}
export function getCharacter(g: Game, id: number): Character | undefined {
  const r = g.db.get<CharRow>('SELECT * FROM characters WHERE id = ?', id);
  return r ? toCharacter(r) : undefined;
}
export function requireCharacter(g: Game, userId: string): Character {
  return getCharacterByUser(g, userId) ?? fail('Você ainda não tem um aventureiro. Use `/personagem criar`.');
}

export function saveCharacterJson(g: Game, c: Character, field: 'appearance' | 'visited' | 'masters' | 'meal' | 'belt' | 'settings' | 'history') {
  const value = (c as unknown as Record<string, unknown>)[field];
  g.db.run(`UPDATE characters SET ${field} = ? WHERE id = ?`, value === null ? null : JSON.stringify(value), c.id);
}

export function changeGold(g: Game, charId: number, delta: number, kind: string, ref?: string) {
  if (delta === 0) return;
  const r = g.db.run('UPDATE characters SET gold = gold + ? WHERE id = ? AND gold + ? >= 0', delta, charId, delta);
  if (r.changes === 0) fail('Ouro insuficiente.');
  ledger(g, charId, kind, delta, undefined, undefined, ref);
}

// ===================================================================== criação

export interface CreateInput {
  name: string; race: string; raceChoice?: string; origin: string; classId: string; pronouns: string;
  appearance?: Partial<Appearance>; story?: string;
}

export const NAME_RE = /^[\p{L}][\p{L}' -]{1,22}[\p{L}]$/u;

export function createCharacter(g: Game, userId: string, input: CreateInput): Character {
  return g.db.tx(() => {
    if (getCharacterByUser(g, userId)) fail('Você já tem um aventureiro. Ele é o mesmo em todos os servidores.');
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) fail('Nome inválido: use de 3 a 24 letras (espaços, hífen e apóstrofo são permitidos).');
    const race = raceById.get(input.race) ?? fail('Raça inválida.');
    const origin = originById.get(input.origin) ?? fail('Origem inválida.');
    const cls = classById.get(input.classId) ?? fail('Classe inválida.');
    let raceChoice: string | null = null;
    if (race.trait.t === 'resistencia_escolhida') {
      raceChoice = input.raceChoice && (race.trait.options as string[]).includes(input.raceChoice) ? input.raceChoice : race.trait.options[0];
    }
    if (race.trait.t === 'sentido_escolhido') {
      raceChoice = input.raceChoice && (race.trait.options as string[]).includes(input.raceChoice) ? input.raceChoice : race.trait.options[0];
    }
    const a = input.appearance ?? {};
    const appearance: Appearance = {
      height: (HEIGHTS as readonly string[]).includes(a.height ?? '') ? a.height! : 'média',
      build: (BUILDS as readonly string[]).includes(a.build ?? '') ? a.build! : 'atlética',
      hair: (HAIR_STYLES as readonly string[]).includes(a.hair ?? '') ? a.hair! : 'curto',
      hairColor: a.hairColor && HAIR_COLORS[a.hairColor] ? a.hairColor : 'castanho',
      eyes: a.eyes && EYE_COLORS[a.eyes] ? a.eyes : 'castanho',
      skin: Math.max(0, Math.min(race.skins.length - 1, a.skin ?? 0)),
      marks: (MARKS as readonly string[]).includes(a.marks ?? '') ? a.marks! : 'nenhuma',
      voice: (a.voice ?? 'serena').slice(0, 40),
    };
    const pronouns = PRONOUNS.includes(input.pronouns) ? input.pronouns : input.pronouns.slice(0, 20) || 'elu/delu';
    const belt = [{ item: 'pocao-vida-menor', qty: 3 }, { item: 'isca-simples', qty: 2 }];
    const r = g.db.run(`INSERT INTO characters (user_id, name, race, race_choice, origin, pronouns, appearance, story, class_id, gold, belt, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, userId, name, race.id, raceChoice, origin.id, pronouns, JSON.stringify(appearance),
    (input.story ?? '').slice(0, 600), cls.id, 0, JSON.stringify(belt), g.now());
    const id = r.lastInsertRowid;
    createProgress(g, id, cls.id);
    changeGold(g, id, 100 + origin.gold, 'criacao');
    // Kit inicial
    const kit = STARTER_KIT[cls.id];
    const own = charOwner(id);
    const equip = (slot: Slot, d: EquipData) => {
      d.maxDurability = d.durability = maxDurabilityFor(d);
      const rowId = addUnique(g, own, d);
      g.db.run('UPDATE items SET slot = ? WHERE id = ?', slot, rowId);
    };
    const base = (kind: EquipData['kind'], model: string, material: string, name: string, piece?: EquipData['piece']): EquipData =>
      ({ kind, model, material, tier: 1, piece, runes: [], rarity: 'comum', props: [], upgrade: 0, durability: 1, maxDurability: 1, name });
    equip('arma', base('arma', kit.weapon, kit.weaponMat, `${capital(kit.weapon)} de Iniciado`));
    if (kit.offhand) equip('secundaria', base('arma', kit.offhand[0], kit.offhand[1], `${capital(kit.offhand[0])} de Iniciado`));
    equip('torso', base('armadura', kit.armor, kit.armorMat, 'Peitoral de Iniciado', 'torso'));
    equip('pernas', base('armadura', kit.armor, kit.armorMat, 'Perneiras de Iniciado', 'pernas'));
    equip('pes', base('armadura', kit.armor, kit.armorMat, 'Botas de Iniciado', 'pes'));
    for (const [tool, mat] of [['picareta', 'lingote-bronze'], ['foice-colheita', 'lingote-bronze']] as const) {
      const d: EquipData = { kind: 'ferramenta', model: tool, material: mat, tier: 1, runes: [], rarity: 'comum', props: [], upgrade: 0, durability: 100, maxDurability: 100, name: `${tool === 'picareta' ? 'Picareta' : 'Foice'} de Bronze` };
      addUnique(g, own, d);
    }
    for (const [k, q] of [['racao', 10], ['agua', 10], ['pocao-vida-menor', 3], ['isca-simples', 2], ['petisco', 3], ...origin.items] as [string, number][]) addItem(g, own, k, q);
    if (race.id === 'forjado') addItem(g, own, 'celula-energia', 6);
    for (const loc of WORK_LOCATIONS.filter((l) => l.region === 'bosque' && l.unlock === 'inicial')) unlock(g, id, 'local', loc.id);
    unlock(g, id, 'visual', 'tunica-errante');
    if (origin.id === 'nobre-caido') unlock(g, id, 'visual', 'sobretudo-elegante');
    unlock(g, id, 'titulo', 'errante');
    g.db.run('UPDATE characters SET title = ? WHERE id = ?', 'errante', id);
    if (origin.bonus?.repStart) addRep(g, id, origin.bonus.repStart[0], origin.bonus.repStart[1]);
    ledger(g, id, 'personagem_criado', 0, undefined, undefined, undefined, { race: race.id, class: cls.id });
    return getCharacter(g, id)!;
  });
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function createProgress(g: Game, charId: number, classId: string): ClassProgress {
  const cls = classById.get(classId)!;
  const auto = nodesByClass(classId).filter((n) => n.auto).map((n) => n.id);
  const equipped = [cls.fundamento.id, ...cls.trees.map((t) => t.a1.id)];
  const allocated = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0]));
  g.db.run(`INSERT OR IGNORE INTO class_progress (character_id, class_id, allocated, learned, equipped, passive) VALUES (?,?,?,?,?,?)`,
    charId, classId, JSON.stringify(allocated), JSON.stringify(auto), JSON.stringify(equipped), cls.innate.id);
  return getProgress(g, charId, classId)!;
}

interface ProgRow { class_id: string; level: number; xp: number; allocated: string; learned: string; equipped: string; passive: string | null; loadouts: string; respecs: number; secondary: string | null }

export function getProgress(g: Game, charId: number, classId: string): ClassProgress | undefined {
  const r = g.db.get<ProgRow>('SELECT * FROM class_progress WHERE character_id = ? AND class_id = ?', charId, classId);
  if (!r) return undefined;
  return {
    classId: r.class_id, level: r.level, xp: r.xp, allocated: json(r.allocated, {} as Record<AttributeId, number>), learned: json(r.learned, []),
    equipped: json(r.equipped, []), passive: r.passive, loadouts: json(r.loadouts, {}), respecs: r.respecs, secondary: r.secondary,
  };
}
export function activeProgress(g: Game, c: Character): ClassProgress {
  return getProgress(g, c.id, c.classId) ?? createProgress(g, c.id, c.classId);
}
export function saveProgress(g: Game, charId: number, p: ClassProgress) {
  g.db.run(`UPDATE class_progress SET level=?, xp=?, allocated=?, learned=?, equipped=?, passive=?, loadouts=?, respecs=?, secondary=? WHERE character_id=? AND class_id=?`,
    p.level, p.xp, JSON.stringify(p.allocated), JSON.stringify(p.learned), JSON.stringify(p.equipped), p.passive, JSON.stringify(p.loadouts),
    p.respecs, p.secondary, charId, p.classId);
}
export function allProgress(g: Game, charId: number): ClassProgress[] {
  return g.db.all<{ class_id: string }>('SELECT class_id FROM class_progress WHERE character_id = ?', charId).map((r) => getProgress(g, charId, r.class_id)!);
}

// ===================================================================== atributos

export function unspentAttributes(p: ClassProgress): number {
  return attributePointsTotal(p.level) - ATTRIBUTES.reduce((s, a) => s + (p.allocated[a] ?? 0), 0);
}

export function allocateAttribute(g: Game, c: Character, attr: AttributeId, amount: number) {
  return g.db.tx(() => {
    if (!ATTRIBUTES.includes(attr)) fail('Atributo inválido.');
    const p = activeProgress(g, c);
    const free = unspentAttributes(p);
    if (amount < 1 || amount > free) fail(`Você tem ${free} ponto(s) para distribuir.`);
    p.allocated[attr] = (p.allocated[attr] ?? 0) + amount;
    saveProgress(g, c.id, p);
    return p;
  });
}

export function respecAttributes(g: Game, c: Character) {
  return g.db.tx(() => {
    assertSafe(g, c);
    const p = activeProgress(g, c);
    const cost = c.attrRespecs === 0 ? 0 : ECONOMY.attributeRespecCost(p.level);
    if (cost) changeGold(g, c.id, -cost, 'redistribuir_atributos');
    p.allocated = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<AttributeId, number>;
    saveProgress(g, c.id, p);
    g.db.run('UPDATE characters SET attr_respecs = attr_respecs + 1 WHERE id = ?', c.id);
    return cost;
  });
}

// ===================================================================== estado e segurança

export function activeFieldActivity(g: Game, charId: number) {
  return g.db.get<{ id: number; kind: string; ends_at: number }>("SELECT id, kind, ends_at FROM activities WHERE character_id = ? AND status = 'ativa' AND kind IN ('trabalho','exploracao','campanha')", charId);
}
export function activeCombatId(g: Game, charId: number): string | undefined {
  return g.db.get<{ id: string }>("SELECT c.id FROM combats c JOIN combat_members m ON m.combat_id = c.id WHERE m.character_id = ? AND c.status = 'ativo'", charId)?.id;
}

/** Trocas de conjunto, talentos e classe só acontecem em locais seguros, fora de atividades. */
export function assertSafe(g: Game, c: Character) {
  if (activeCombatId(g, c.id)) fail('Você está em combate. Isso só pode ser feito em um local seguro.');
  const a = activeFieldActivity(g, c.id);
  if (a?.kind === 'campanha') {
    const st = json<{ atCamp?: boolean }>(g.db.get<{ state: string }>('SELECT state FROM activities WHERE id = ?', a.id)?.state, {});
    if (st.atCamp) return;
    fail('Isso só pode ser feito em um acampamento da campanha.');
  }
  if (a) fail(`Você está em uma atividade (${a.kind}). Volte a um local seguro primeiro (\`/atividade\`).`);
}

// ===================================================================== progresso

export function addClassXp(g: Game, c: Character, amount: number): { levels: number; level: number } {
  const p = activeProgress(g, c);
  if (p.level >= MAX_CLASS_LEVEL) { p.xp = 0; saveProgress(g, c.id, p); return { levels: 0, level: p.level }; }
  p.xp += Math.max(0, Math.round(amount));
  let levels = 0;
  while (p.level < MAX_CLASS_LEVEL && p.xp >= xpForClassLevel(p.level)) {
    p.xp -= xpForClassLevel(p.level);
    p.level++;
    levels++;
  }
  if (p.level >= MAX_CLASS_LEVEL) p.xp = 0;
  saveProgress(g, c.id, p);
  return { levels, level: p.level };
}

export interface ProfProgress { professionId: string; level: number; xp: number; ranks: Record<string, number> }

export function getProf(g: Game, charId: number, prof: string): ProfProgress {
  const r = g.db.get<{ level: number; xp: number; ranks: string }>('SELECT level, xp, ranks FROM professions WHERE character_id = ? AND profession_id = ?', charId, prof);
  return { professionId: prof, level: r?.level ?? 1, xp: r?.xp ?? 0, ranks: json(r?.ranks, {}) };
}
export function allProfs(g: Game, charId: number): ProfProgress[] {
  return PROFESSIONS.map((p) => getProf(g, charId, p.id));
}
export function profCap(c: Character, prof: string): number {
  return c.masters.includes(prof) ? PROFESSION_MAX_LEVEL : NON_MASTER_CAP;
}
function saveProf(g: Game, charId: number, p: ProfProgress) {
  g.db.run(`INSERT INTO professions (character_id, profession_id, level, xp, ranks) VALUES (?,?,?,?,?)
    ON CONFLICT(character_id, profession_id) DO UPDATE SET level = excluded.level, xp = excluded.xp, ranks = excluded.ranks`,
  charId, p.professionId, p.level, p.xp, JSON.stringify(p.ranks));
}

export function addProfXp(g: Game, c: Character, prof: string, amount: number): { levels: number; level: number; capped: boolean } {
  const p = getProf(g, c.id, prof);
  const cap = profCap(c, prof);
  const origin = originById.get(c.origin);
  const kind = professionById.get(prof)?.kind;
  let mult = 1;
  if (kind === 'fabricacao') mult += origin?.bonus?.craftXp ?? 0;
  if (kind === 'coleta') mult += origin?.bonus?.gatherXp ?? 0;
  if (p.level >= cap) return { levels: 0, level: p.level, capped: true };
  p.xp += Math.round(amount * mult);
  let levels = 0;
  while (p.level < cap && p.xp >= profXpForLevel(p.level)) { p.xp -= profXpForLevel(p.level); p.level++; levels++; }
  if (p.level >= cap) p.xp = 0;
  saveProf(g, c.id, p);
  if (p.level >= 100) { if (unlock(g, c.id, 'titulo', 'mestre-artesao')) notifyUnlock(g, c, 'Título desbloqueado: Mestre Artesão'); }
  return { levels, level: p.level, capped: p.level >= cap };
}

export function rankProfession(g: Game, c: Character, prof: string, branch: string) {
  return g.db.tx(() => {
    const def = professionById.get(prof) ?? fail('Profissão inválida.');
    const b = def.branches.find((x) => x.id === branch) ?? fail('Especialização inválida.');
    const p = getProf(g, c.id, prof);
    const spent = Object.values(p.ranks).reduce((a, x) => a + x, 0);
    if (spent >= Math.floor(p.level / 10)) fail('Sem pontos de especialização (1 a cada 10 níveis).');
    if ((p.ranks[branch] ?? 0) >= b.maxRank) fail('Especialização já no máximo.');
    p.ranks[branch] = (p.ranks[branch] ?? 0) + 1;
    saveProf(g, c.id, p);
    return p;
  });
}

export function profRank(p: ProfProgress, effect: string): number {
  const def = professionById.get(p.professionId)!;
  return def.branches.filter((b) => b.effect === effect).reduce((s, b) => s + (p.ranks[b.id] ?? 0) * b.perRank, 0);
}

/** Define as especialidades de mestre. Trocar custa ouro (humanos pagam metade); a perícia acima de 50 fica guardada até voltar. */
export function setMaster(g: Game, c: Character, prof: string, replace?: string) {
  return g.db.tx(() => {
    if (!professionById.has(prof)) fail('Profissão inválida.');
    if (c.masters.includes(prof)) fail('Essa já é uma especialidade de mestre.');
    let cost = 0;
    if (c.masters.length >= MASTER_SLOTS) {
      if (!replace || !c.masters.includes(replace)) fail(`Você já tem ${MASTER_SLOTS} especialidades de mestre. Escolha qual substituir.`);
      cost = 500;
      if (raceById.get(c.race)?.trait.t === 'troca_profissao') cost = Math.round(cost * 0.5);
      changeGold(g, c.id, -cost, 'troca_mestre');
      c.masters = c.masters.filter((m) => m !== replace);
      const old = getProf(g, c.id, replace!);
      if (old.level > NON_MASTER_CAP) {
        unlock(g, c.id, 'nivel_guardado', `${replace}:${old.level}`);
        old.level = NON_MASTER_CAP; old.xp = 0;
        saveProf(g, c.id, old);
      }
    }
    c.masters.push(prof);
    const stored = g.db.get<{ key: string }>("SELECT key FROM unlocks WHERE character_id = ? AND kind = 'nivel_guardado' AND key LIKE ?", c.id, `${prof}:%`);
    if (stored) {
      const p = getProf(g, c.id, prof);
      p.level = Math.max(p.level, Number(stored.key.split(':')[1]));
      saveProf(g, c.id, p);
      g.db.run("DELETE FROM unlocks WHERE character_id = ? AND kind = 'nivel_guardado' AND key = ?", c.id, stored.key);
    }
    saveCharacterJson(g, c, 'masters');
    return cost;
  });
}

// ===================================================================== desbloqueios, reputação, bestiário

export function unlock(g: Game, charId: number, kind: string, key: string): boolean {
  return g.db.run('INSERT OR IGNORE INTO unlocks (character_id, kind, key, at) VALUES (?,?,?,?)', charId, kind, key, g.now()).changes > 0;
}
export function hasUnlock(g: Game, charId: number, kind: string, key: string): boolean {
  return !!g.db.get('SELECT 1 FROM unlocks WHERE character_id = ? AND kind = ? AND key = ?', charId, kind, key);
}
export function unlocksOf(g: Game, charId: number, kind: string): string[] {
  return g.db.all<{ key: string }>('SELECT key FROM unlocks WHERE character_id = ? AND kind = ? ORDER BY at', charId, kind).map((r) => r.key);
}
export function allUnlockSet(g: Game, charId: number): Set<string> {
  return new Set(g.db.all<{ kind: string; key: string }>('SELECT kind, key FROM unlocks WHERE character_id = ?', charId).map((r) => `${r.kind}:${r.key}`));
}
function notifyUnlock(g: Game, c: Character, text: string) { g.notify?.(c.userId, `🏅 ${text}`); }

export function getRep(g: Game, charId: number, faction: string): number {
  return g.db.get<{ value: number }>('SELECT value FROM reputation WHERE character_id = ? AND faction = ?', charId, faction)?.value ?? 0;
}
export function repRank(value: number): number { return Math.floor(value / REP_PER_RANK); }
export function addRep(g: Game, charId: number, faction: string, amount: number) {
  if (!factionById.has(faction) || !amount) return;
  const before = getRep(g, charId, faction);
  g.db.run(`INSERT INTO reputation (character_id, faction, value) VALUES (?,?,?)
    ON CONFLICT(character_id, faction) DO UPDATE SET value = value + excluded.value`, charId, faction, amount);
  const after = before + amount;
  if (repRank(after) > repRank(before)) {
    const rank = repRank(after);
    // Recompensas de reputação: visuais e receitas
    const visual = VISUALS.find((v) => v.unlock === `reputacao:${faction}:${rank}`);
    if (visual) unlock(g, charId, 'visual', visual.id);
    if (faction === 'guarda' && rank >= 3) unlock(g, charId, 'receita', 'lendario:egide-linha');
  }
}
export function allRep(g: Game, charId: number) {
  return FACTIONS.map((f) => {
    const v = getRep(g, charId, f.id);
    const rank = Math.min(f.ranks.length - 1, repRank(v));
    return { faction: f, value: v, rank, label: f.ranks[rank] };
  });
}

export function recordBestiary(g: Game, charId: number, monsterId: string, kills: number, analyzed = false) {
  g.db.run(`INSERT INTO bestiary (character_id, monster_id, kills, seen, analyzed, first_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(character_id, monster_id) DO UPDATE SET kills = kills + excluded.kills, seen = seen + 1, analyzed = MAX(analyzed, excluded.analyzed)`,
  charId, monsterId, kills, 1, analyzed ? 1 : 0, g.now());
  const total = g.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM bestiary WHERE character_id = ?', charId)?.n ?? 0;
  if (total >= 100) unlock(g, charId, 'titulo', 'enciclopedista');
}

// ===================================================================== snapshot de combate

export interface EquippedItem { row: ItemRow; slot: Slot; data: EquipData }

export function equippedItems(g: Game, charId: number): EquippedItem[] {
  return g.db.all<ItemRow>("SELECT * FROM items WHERE owner_kind = 'char' AND owner_id = ? AND slot IS NOT NULL", charId)
    .map((row) => ({ row, slot: row.slot as Slot, data: JSON.parse(row.data!) as EquipData }));
}

export function currentMeal(g: Game, c: Character): MealBuff | undefined {
  if (!c.meal || c.meal.until < g.now()) return undefined;
  const use = itemById.get(c.meal.item)?.use;
  return use?.t === 'refeicao' ? use.buff : undefined;
}

export function snapshot(g: Game, c: Character, classId = c.classId): { snap: CharacterSnapshot; derived: DerivedStats; progress: ClassProgress } {
  const progress = getProgress(g, c.id, classId) ?? createProgress(g, c.id, classId);
  const snap: CharacterSnapshot = {
    id: c.id, name: c.name, race: c.race, raceChoice: c.raceChoice ?? undefined, origin: c.origin, classId, level: progress.level,
    allocated: progress.allocated, equipment: equippedItems(g, c.id).map((e) => ({ slot: e.slot, data: e.data })),
    passive: progress.passive ?? undefined, mealBuff: currentMeal(g, c),
  };
  return { snap, derived: deriveStats(snap), progress };
}

export function talentPointsLeft(p: ClassProgress): number {
  const nodes = nodesByClass(p.classId);
  const spent = p.learned.reduce((s, id) => {
    if (id.startsWith('sec:')) return s + 2;
    const n = nodes.find((x) => x.id === id);
    return s + (n && !n.auto ? n.cost : 0);
  }, 0);
  return talentPointsForLevel(p.level) - spent;
}

// ===================================================================== viagem e refeições

export function travel(g: Game, c: Character, regionId: string): number {
  return g.db.tx(() => {
    assertSafe(g, c);
    const reg = regionById.get(regionId) ?? fail('Região desconhecida.');
    if (c.region === reg.id) fail('Você já está nessa região.');
    const p = activeProgress(g, c);
    if (p.level < reg.minLevel) fail(`A Companhia só autoriza expedições a ${reg.name} a partir do nível ${reg.minLevel}.`);
    const discount = originById.get(c.origin)?.bonus?.travel ?? 0;
    const dist = Math.abs(REGIONS.findIndex((r) => r.id === reg.id) - REGIONS.findIndex((r) => r.id === c.region));
    const cost = Math.round((reg.travelCost + dist * 5) * (1 - discount));
    if (cost > 0) changeGold(g, c.id, -cost, 'viagem', reg.id);
    g.db.run('UPDATE characters SET region = ? WHERE id = ?', reg.id, c.id);
    if (!c.visited.includes(reg.id)) {
      c.visited.push(reg.id);
      saveCharacterJson(g, c, 'visited');
      for (const loc of WORK_LOCATIONS.filter((l) => l.region === reg.id && l.unlock === 'inicial')) unlock(g, c.id, 'local', loc.id);
      if (c.visited.length >= REGIONS.length) unlock(g, c.id, 'titulo', 'cartografo');
    }
    c.region = reg.id;
    return cost;
  });
}

export function eat(g: Game, c: Character, itemKey: string): MealBuff {
  return g.db.tx(() => {
    const def = itemById.get(itemKey);
    if (!def?.use || def.use.t !== 'refeicao') fail('Isso não é uma refeição.');
    const use = def!.use as Extract<NonNullable<typeof def>['use'], { t: 'refeicao' }>;
    removeItem(g, charOwner(c.id), itemKey, 1);
    c.meal = { item: itemKey, until: g.now() + use.minutes * 60_000 };
    saveCharacterJson(g, c, 'meal');
    return use.buff;
  });
}

export function setBelt(g: Game, c: Character, belt: { item: string; qty: number }[]) {
  const clean = belt.filter((b) => itemById.get(b.item)?.use && b.qty > 0).slice(0, 4).map((b) => ({ item: b.item, qty: Math.min(5, Math.floor(b.qty)) }));
  c.belt = clean;
  saveCharacterJson(g, c, 'belt');
}

export function setTitle(g: Game, c: Character, titleId: string | null) {
  if (titleId && !hasUnlock(g, c.id, 'titulo', titleId)) fail('Você não desbloqueou esse título.');
  if (titleId && !TITLES.some((t) => t.id === titleId)) fail('Título inválido.');
  g.db.run('UPDATE characters SET title = ? WHERE id = ?', titleId, c.id);
}

export function updateAppearance(g: Game, c: Character, patch: Partial<Appearance>, story?: string, pronouns?: string) {
  const race = raceById.get(c.race)!;
  const a = { ...c.appearance };
  if (patch.height && (HEIGHTS as readonly string[]).includes(patch.height)) a.height = patch.height;
  if (patch.build && (BUILDS as readonly string[]).includes(patch.build)) a.build = patch.build;
  if (patch.hair && (HAIR_STYLES as readonly string[]).includes(patch.hair)) a.hair = patch.hair;
  if (patch.hairColor && HAIR_COLORS[patch.hairColor]) a.hairColor = patch.hairColor;
  if (patch.eyes && EYE_COLORS[patch.eyes]) a.eyes = patch.eyes;
  if (patch.skin !== undefined) a.skin = Math.max(0, Math.min(race.skins.length - 1, patch.skin));
  if (patch.marks && (MARKS as readonly string[]).includes(patch.marks)) a.marks = patch.marks;
  if (patch.voice) a.voice = patch.voice.slice(0, 40);
  c.appearance = a;
  saveCharacterJson(g, c, 'appearance');
  if (story !== undefined) g.db.run('UPDATE characters SET story = ? WHERE id = ?', story.slice(0, 600), c.id);
  if (pronouns) g.db.run('UPDATE characters SET pronouns = ? WHERE id = ?', pronouns.slice(0, 20), c.id);
}

export { RACES, ORIGINS, CLASSES, ELEMENTS, countItem };
