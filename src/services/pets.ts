import { monsterById, FAMILIES, tierOfLevel } from '../data/monsters/index.ts';
import { PET_AFFINITIES, PET_TRAITS, PET_STABLE_BASE, PET_MAX_LEVEL, PET_MISSION_DURATIONS, PET_TIER_LEVEL, PET_FOOD_PER_HOUR, petXpForLevel, petTraitById } from '../data/pets.ts';
import { REGIONS, regionById, WORK_LOCATIONS } from '../data/regions.ts';
import { itemById } from '../data/items.ts';
import { json } from '../db/database.ts';
import { Rng, randomSeed } from '../game/rng.ts';
import { addItem, charOwner, fail, ledger, removeItem, HOUR, type Game } from './core.ts';
import { changeGold, getCharacter, hasUnlock, unlock, type Character } from './character.ts';
import { contractProgress } from './contracts.ts';
import { guildOf, guildUpgradeLevel } from './guild.ts';

export interface Pet {
  id: number; characterId: number; species: string; name: string; level: number; xp: number; loyalty: number; traits: string[];
  status: 'estabulo' | 'ativo' | 'missao' | 'ferido'; mission: PetMission | null; injuredUntil: number | null; affinity: string;
}
export interface PetMission { region: string; hours: number; startedAt: number; endsAt: number; seed: number; food: number }

interface PetRow { id: number; character_id: number; species: string; name: string; level: number; xp: number; loyalty: number; traits: string; status: string; mission: string | null; injured_until: number | null }

export function speciesAffinity(monsterId: string): string {
  const m = monsterById.get(monsterId);
  const base = m?.base ? monsterById.get(m.base) : m;
  return FAMILIES[base?.family ?? '']?.petAffinity ?? 'coleta';
}

function toPet(r: PetRow): Pet {
  return {
    id: r.id, characterId: r.character_id, species: r.species, name: r.name, level: r.level, xp: r.xp, loyalty: r.loyalty,
    traits: json(r.traits, []), status: r.status as Pet['status'], mission: json(r.mission, null), injuredUntil: r.injured_until,
    affinity: speciesAffinity(r.species),
  };
}

export function listPets(g: Game, charId: number): Pet[] {
  return g.db.all<PetRow>('SELECT * FROM pets WHERE character_id = ? ORDER BY id', charId).map(toPet);
}
export function getPet(g: Game, c: Character, petId: number): Pet {
  const r = g.db.get<PetRow>('SELECT * FROM pets WHERE id = ? AND character_id = ?', petId, c.id);
  return r ? toPet(r) : fail('Pet não encontrado.');
}

export function stableCap(g: Game, c: Character): number {
  const gu = guildOf(g, c.id);
  return PET_STABLE_BASE + (gu ? guildUpgradeLevel(gu, 'estabulo') : 0);
}

/** Pet acompanhando o personagem (apoio limitado em combate). Pets feridos ou em missão não acompanham. */
export function activePet(g: Game, c: Character): Pet | undefined {
  const r = g.db.get<PetRow>("SELECT * FROM pets WHERE character_id = ? AND status = 'ativo'", c.id);
  if (!r) return undefined;
  if (r.injured_until && r.injured_until > g.now()) return undefined;
  return toPet(r);
}

export function tamePet(g: Game, c: Character, monsterId: string, level: number): Pet | null {
  if (listPets(g, c.id).length >= stableCap(g, c)) return null;
  const def = monsterById.get(monsterId)!;
  const r = new Rng(`${c.id}:${monsterId}:${g.now()}`);
  const traits = [r.pick(PET_TRAITS).id];
  if (def.rank === 'variante') {
    const second = r.pick(PET_TRAITS.filter((t) => t.id !== traits[0])).id;
    traits.push(second);
  }
  const lvl = Math.max(1, Math.min(PET_MAX_LEVEL, Math.floor(level / 2)));
  const id = g.db.run('INSERT INTO pets (character_id, species, name, level, traits, loyalty, created_at) VALUES (?,?,?,?,?,?,?)',
    c.id, monsterId, def.name, lvl, JSON.stringify(traits), def.rank === 'variante' ? 30 : 20, g.now()).lastInsertRowid;
  unlock(g, c.id, 'titulo', 'domador');
  ledger(g, c.id, 'pet_domado', 0, undefined, undefined, `pet:${id}`, { species: monsterId });
  return toPet(g.db.get<PetRow>('SELECT * FROM pets WHERE id = ?', id)!);
}

export function setActivePet(g: Game, c: Character, petId: number | null) {
  return g.db.tx(() => {
    g.db.run("UPDATE pets SET status = 'estabulo' WHERE character_id = ? AND status = 'ativo'", c.id);
    if (petId === null) return null;
    const p = getPet(g, c, petId);
    if (p.status === 'missao') fail(`${p.name} está em missão.`);
    if (p.injuredUntil && p.injuredUntil > g.now()) fail(`${p.name} está ferido e descansando.`);
    g.db.run("UPDATE pets SET status = 'ativo' WHERE id = ?", petId);
    return p;
  });
}

export function renamePet(g: Game, c: Character, petId: number, name: string) {
  const n = name.trim().slice(0, 24);
  if (n.length < 2) fail('Nome muito curto.');
  getPet(g, c, petId);
  g.db.run('UPDATE pets SET name = ? WHERE id = ?', n, petId);
}

export function releasePet(g: Game, c: Character, petId: number) {
  const p = getPet(g, c, petId);
  if (p.status === 'missao') fail('Espere a missão terminar.');
  g.db.run('DELETE FROM pets WHERE id = ?', petId);
  return p;
}

export function feedPet(g: Game, c: Character, petId: number, itemKey = 'petisco') {
  return g.db.tx(() => {
    const p = getPet(g, c, petId);
    const use = itemById.get(itemKey)?.use;
    if (!use || use.t !== 'petisco') fail('Isso não é comida de pet.');
    removeItem(g, charOwner(c.id), itemKey, 1);
    const loyalBonus = p.traits.some((t) => petTraitById.get(t)?.loyalty) ? 1.5 : 1;
    const loyalty = Math.min(100, p.loyalty + Math.round((use as { loyalty: number }).loyalty * loyalBonus));
    let injured = p.injuredUntil;
    if (injured && injured > g.now()) injured = g.now() + Math.round((injured - g.now()) * (1 - (use as { heal: number }).heal * 2));
    g.db.run('UPDATE pets SET loyalty = ?, injured_until = ?, status = CASE WHEN status = ? AND ? <= ? THEN ? ELSE status END WHERE id = ?',
      loyalty, injured, 'ferido', injured ?? 0, g.now(), 'estabulo', petId);
    return { loyalty, injuredUntil: injured };
  });
}

export function petTier(level: number): number {
  let t = 1;
  for (let i = 1; i < PET_TIER_LEVEL.length; i++) if (level >= PET_TIER_LEVEL[i]) t = i;
  return t;
}

// ---------------------------------------------------------------- missões

export function missionPreview(g: Game, c: Character, petId: number, regionId: string, hours: number) {
  const p = getPet(g, c, petId);
  const reg = regionById.get(regionId) ?? fail('Região desconhecida.');
  if (!c.visited.includes(reg!.id)) fail('Pets só fazem missões em regiões que você já visitou.');
  if (!PET_MISSION_DURATIONS.includes(hours)) fail(`Durações possíveis: ${PET_MISSION_DURATIONS.join(', ')} horas.`);
  const regionTier = tierOfLevel(reg!.levels[1]);
  const needLevel = PET_TIER_LEVEL[regionTier];
  if (p.level < needLevel) fail(`${p.name} precisa de nível ${needLevel} para missões em ${reg!.name}.`);
  const glutton = p.traits.some((t) => petTraitById.get(t)?.food);
  const food = Math.ceil(hours * PET_FOOD_PER_HOUR * (glutton ? 2 : 1));
  const speed = p.traits.reduce((s, t) => s + (petTraitById.get(t)?.speed ?? 0), 0);
  const realHours = hours * (1 - speed);
  const aff = PET_AFFINITIES[p.affinity];
  const injuryRisk = injuryChancePerHour(p, regionTier);
  return { pet: p, region: reg!, food, realHours, affinity: aff, injuryRisk: Math.min(0.9, injuryRisk * hours), regionTier };
}

function injuryChancePerHour(p: Pet, regionTier: number): number {
  const traitInj = p.traits.reduce((s, t) => s + (petTraitById.get(t)?.injury ?? 0), 0);
  const base = 0.01 + Math.max(0, regionTier - petTier(p.level)) * 0.04;
  return Math.max(0, base * (1 + traitInj));
}

export function startPetMission(g: Game, c: Character, petId: number, regionId: string, hours: number) {
  return g.db.tx(() => {
    const pv = missionPreview(g, c, petId, regionId, hours);
    if (pv.pet.status === 'missao') fail(`${pv.pet.name} já está em missão.`);
    if (pv.pet.injuredUntil && pv.pet.injuredUntil > g.now()) fail(`${pv.pet.name} está ferido.`);
    removeItem(g, charOwner(c.id), 'racao-pet', pv.food);
    const now = g.now();
    const mission: PetMission = { region: regionId, hours, startedAt: now, endsAt: now + Math.round(pv.realHours * HOUR), seed: randomSeed(), food: pv.food };
    g.db.run("UPDATE pets SET status = 'missao', mission = ? WHERE id = ?", JSON.stringify(mission), petId);
    return { ...pv, mission };
  });
}

export interface PetMissionReport { pet: Pet; items: Record<string, number>; gold: number; discovered?: string; injured: boolean; xp: number; levels: number }

export function finishPetMission(g: Game, petId: number): PetMissionReport | null {
  return g.db.tx(() => {
    const r = g.db.get<PetRow>("SELECT * FROM pets WHERE id = ? AND status = 'missao'", petId);
    if (!r) return null;
    const p = toPet(r);
    const m = p.mission!;
    const c = getCharacter(g, p.characterId)!;
    const reg = regionById.get(m.region)!;
    const regionTier = tierOfLevel(reg.levels[1]);
    const rng = new Rng(m.seed);
    const aff = PET_AFFINITIES[p.affinity];
    const yieldMult = 1 + p.traits.reduce((s, t) => s + (petTraitById.get(t)?.yield ?? 0), 0) + (p.loyalty - 50) / 200;
    const tier = Math.min(regionTier, petTier(p.level) + 1);
    const table = aff.loot[tier - 1];
    const count = Math.max(1, Math.round(m.hours * (2 + p.level * 0.15) * yieldMult));
    const items: Record<string, number> = {};
    for (let i = 0; i < count; i++) {
      const k = rng.weighted(table);
      items[k] = (items[k] ?? 0) + 1;
    }
    let gold = 0;
    let discovered: string | undefined;
    if (aff.special) {
      for (let h = 0; h < m.hours; h++) {
        if (aff.special.kind === 'ouro') gold += Math.round((8 + regionTier * 6) * yieldMult);
        if (aff.special.kind === 'mapa' && rng.chance(aff.special.chancePerHour)) items[`mapa-${reg.id}`] = (items[`mapa-${reg.id}`] ?? 0) + 1;
        if (aff.special.kind === 'descoberta' && !discovered && rng.chance(aff.special.chancePerHour)) {
          const hidden = WORK_LOCATIONS.filter((l) => l.region === reg.id && l.unlock === 'descoberta' && !hasUnlock(g, c.id, 'local', l.id));
          if (hidden.length) { discovered = rng.pick(hidden).id; unlock(g, c.id, 'local', discovered); }
        }
      }
    }
    let injured = false;
    for (let h = 0; h < m.hours; h++) if (rng.chance(injuryChancePerHour(p, regionTier))) injured = true;
    if (injured) for (const k of Object.keys(items)) items[k] = Math.ceil(items[k] / 2);
    for (const [k, q] of Object.entries(items)) addItem(g, charOwner(c.id), k, q);
    if (gold) changeGold(g, c.id, gold, 'pet_caravana', `pet:${p.id}`);
    // Experiência e lealdade
    let xp = p.xp + Math.round(m.hours * 25 * regionTier);
    let level = p.level;
    let levels = 0;
    while (level < PET_MAX_LEVEL && xp >= petXpForLevel(level)) { xp -= petXpForLevel(level); level++; levels++; }
    const loyalty = Math.min(100, p.loyalty + 2);
    g.db.run('UPDATE pets SET status = ?, mission = NULL, xp = ?, level = ?, loyalty = ?, injured_until = ? WHERE id = ?',
      injured ? 'ferido' : 'estabulo', xp, level, loyalty, injured ? g.now() + 4 * HOUR : null, p.id);
    contractProgress(g, c.id, { t: 'missao_pet' });
    ledger(g, c.id, 'pet_missao', gold, undefined, undefined, `pet:${p.id}`, { items, discovered, injured });
    return { pet: { ...p, level, loyalty }, items, gold, discovered, injured, xp: Math.round(m.hours * 25 * regionTier), levels };
  });
}

export function duePetMissions(g: Game): number[] {
  return g.db.all<{ id: number; mission: string }>("SELECT id, mission FROM pets WHERE status = 'missao'")
    .filter((r) => (json<PetMission | null>(r.mission, null)?.endsAt ?? Infinity) <= g.now()).map((r) => r.id);
}

/** Pets feridos se recuperam sozinhos com o tempo. */
export function healPets(g: Game) {
  g.db.run("UPDATE pets SET status = 'estabulo', injured_until = NULL WHERE status = 'ferido' AND injured_until <= ?", g.now());
}

export { REGIONS };
