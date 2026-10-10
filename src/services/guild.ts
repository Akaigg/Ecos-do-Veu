import { GUILD_CREATE_COST, GUILD_BASE_MEMBERS, GUILD_MAX_MEMBERS, GUILD_RANKS, guildUpgradeById, type GuildRank } from '../data/social.ts';
import { itemById } from '../data/items.ts';
import { json } from '../db/database.ts';
import { addItem, charOwner, fail, ledger, removeItem, countItem, listItems, DAY, type Game, type Owner } from './core.ts';
import { changeGold, getCharacter, type Character } from './character.ts';

export interface Guild {
  id: number; name: string; tag: string; leaderId: number; gold: number; upgrades: Record<string, number>;
  project: GuildProject | null; banner: { color?: string; symbol?: string; color2?: string }; description: string; createdAt: number;
}
export interface GuildProject { upgrade: string; level: number; gold: number; items: Record<string, number>; work: number; need: { gold: number; items: [string, number][]; work: number } }

interface GuildRow { id: number; name: string; tag: string; leader_id: number; gold: number; upgrades: string; project: string | null; banner: string; description: string; created_at: number }
const toGuild = (r: GuildRow): Guild => ({
  id: r.id, name: r.name, tag: r.tag, leaderId: r.leader_id, gold: r.gold, upgrades: json(r.upgrades, {}), project: json(r.project, null),
  banner: json(r.banner, {}), description: r.description, createdAt: r.created_at,
});
const guildOwner = (id: number): Owner => ({ kind: 'guild', id });

export function getGuild(g: Game, id: number): Guild | undefined {
  const r = g.db.get<GuildRow>('SELECT * FROM guilds WHERE id = ?', id);
  return r ? toGuild(r) : undefined;
}
export function guildOf(g: Game, charId: number): (Guild & { rank: GuildRank }) | undefined {
  const m = g.db.get<{ guild_id: number; rank: GuildRank }>('SELECT guild_id, rank FROM guild_members WHERE character_id = ?', charId);
  if (!m) return undefined;
  const gu = getGuild(g, m.guild_id);
  return gu ? { ...gu, rank: m.rank } : undefined;
}
export const guildUpgradeLevel = (gu: Guild, id: string) => gu.upgrades[id] ?? 0;
export const memberCap = (gu: Guild) => Math.min(GUILD_MAX_MEMBERS, GUILD_BASE_MEMBERS + guildUpgradeLevel(gu, 'salao') * 10);

export function members(g: Game, guildId: number) {
  return g.db.all<{ character_id: number; rank: GuildRank; contributed: number; name: string; joined_at: number }>(
    'SELECT m.character_id, m.rank, m.contributed, m.joined_at, c.name FROM guild_members m JOIN characters c ON c.id = m.character_id WHERE m.guild_id = ? ORDER BY m.rank, c.name', guildId);
}

function log(g: Game, guildId: number, charId: number | null, action: string, extra: { item?: string; qty?: number; gold?: number; note?: string } = {}) {
  g.db.run('INSERT INTO guild_log (guild_id, character_id, action, item_key, qty, gold, note, at) VALUES (?,?,?,?,?,?,?,?)',
    guildId, charId, action, extra.item, extra.qty, extra.gold, extra.note, g.now());
}

function requireRank(g: Game, c: Character, need: (r: typeof GUILD_RANKS[GuildRank]) => boolean, msg: string) {
  const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
  if (!need(GUILD_RANKS[gu!.rank])) fail(msg);
  return gu!;
}

export function createGuild(g: Game, c: Character, name: string, tag: string): Guild {
  return g.db.tx(() => {
    if (guildOf(g, c.id)) fail('Você já pertence a uma guilda.');
    const n = name.trim();
    if (n.length < 3 || n.length > 32) fail('O nome da guilda deve ter de 3 a 32 caracteres.');
    const t = tag.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,5}$/.test(t)) fail('A sigla deve ter de 2 a 5 letras ou números.');
    if (g.db.get('SELECT 1 FROM guilds WHERE name = ?', n)) fail('Já existe uma guilda com esse nome.');
    changeGold(g, c.id, -GUILD_CREATE_COST, 'guilda_fundacao');
    const id = g.db.run('INSERT INTO guilds (name, tag, leader_id, created_at, banner) VALUES (?,?,?,?,?)', n, t, c.id, g.now(),
      JSON.stringify({ color: '#7040a0', color2: '#e0c040', symbol: 'estrela' })).lastInsertRowid;
    g.db.run('INSERT INTO guild_members (guild_id, character_id, rank, joined_at) VALUES (?,?,?,?)', id, c.id, 'lider', g.now());
    log(g, id, c.id, 'fundou', { note: n });
    return getGuild(g, id)!;
  });
}

export function inviteToGuild(g: Game, c: Character, target: Character) {
  return g.db.tx(() => {
    const gu = requireRank(g, c, (r) => r.canInvite, 'Apenas líderes e oficiais convidam.');
    if (guildOf(g, target.id)) fail(`${target.name} já pertence a uma guilda.`);
    if (members(g, gu.id).length >= memberCap(gu)) fail(`A guilda está cheia (${memberCap(gu)} membros). Melhore o Salão.`);
    g.db.run('INSERT OR REPLACE INTO guild_invites (guild_id, character_id, invited_by, at) VALUES (?,?,?,?)', gu.id, target.id, c.id, g.now());
    log(g, gu.id, c.id, 'convidou', { note: target.name });
    return gu;
  });
}

export function pendingGuildInvites(g: Game, charId: number) {
  return g.db.all<{ guild_id: number; name: string; tag: string }>('SELECT i.guild_id, g.name, g.tag FROM guild_invites i JOIN guilds g ON g.id = i.guild_id WHERE i.character_id = ?', charId);
}

export function acceptGuildInvite(g: Game, c: Character, guildId: number) {
  return g.db.tx(() => {
    if (guildOf(g, c.id)) fail('Você já pertence a uma guilda.');
    if (!g.db.get('SELECT 1 FROM guild_invites WHERE guild_id = ? AND character_id = ?', guildId, c.id)) fail('Convite não encontrado.');
    const gu = getGuild(g, guildId) ?? fail('Guilda não existe mais.');
    if (members(g, guildId).length >= memberCap(gu!)) fail('A guilda está cheia.');
    g.db.run('DELETE FROM guild_invites WHERE character_id = ?', c.id);
    g.db.run('INSERT INTO guild_members (guild_id, character_id, rank, joined_at) VALUES (?,?,?,?)', guildId, c.id, 'recruta', g.now());
    log(g, guildId, c.id, 'entrou');
    return gu!;
  });
}

export function leaveGuild(g: Game, c: Character) {
  return g.db.tx(() => {
    const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
    const list = members(g, gu!.id);
    if (gu!.rank === 'lider' && list.length > 1) fail('Transfira a liderança antes de sair (`/guilda cargo`).');
    g.db.run('DELETE FROM guild_members WHERE character_id = ?', c.id);
    log(g, gu!.id, c.id, 'saiu');
    if (list.length === 1) {
      // Último membro: o cofre volta para quem fundou.
      for (const it of listItems(g, guildOwner(gu!.id))) if (!it.data) addItem(g, charOwner(c.id), it.item_key, it.qty);
      if (gu!.gold > 0) changeGold(g, c.id, gu!.gold, 'guilda_dissolvida');
      g.db.run('DELETE FROM items WHERE owner_kind = ? AND owner_id = ?', 'guild', gu!.id);
      g.db.run('DELETE FROM guilds WHERE id = ?', gu!.id);
    }
  });
}

export function setRank(g: Game, c: Character, target: Character, rank: GuildRank) {
  return g.db.tx(() => {
    const gu = requireRank(g, c, (r) => r.canManage, 'Apenas o líder gerencia cargos.');
    const tm = guildOf(g, target.id);
    if (!tm || tm.id !== gu.id) fail('Essa pessoa não está na sua guilda.');
    if (!GUILD_RANKS[rank]) fail('Cargo inválido.');
    if (rank === 'lider') {
      g.db.run("UPDATE guild_members SET rank = 'oficial' WHERE character_id = ?", c.id);
      g.db.run('UPDATE guilds SET leader_id = ? WHERE id = ?', target.id, gu.id);
    }
    g.db.run('UPDATE guild_members SET rank = ? WHERE character_id = ?', rank, target.id);
    log(g, gu.id, c.id, 'cargo', { note: `${target.name} → ${GUILD_RANKS[rank].label}` });
  });
}

export function kick(g: Game, c: Character, target: Character) {
  return g.db.tx(() => {
    const gu = requireRank(g, c, (r) => r.canManage, 'Apenas o líder pode expulsar.');
    if (target.id === c.id) fail('Use `/guilda sair`.');
    const r = g.db.run('DELETE FROM guild_members WHERE guild_id = ? AND character_id = ?', gu.id, target.id);
    if (!r.changes) fail('Essa pessoa não está na sua guilda.');
    log(g, gu.id, c.id, 'expulsou', { note: target.name });
  });
}

// ---------------------------------------------------------------- cofre com registro

export function depositGold(g: Game, c: Character, amount: number) {
  return g.db.tx(() => {
    const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
    if (amount < 1) fail('Valor inválido.');
    changeGold(g, c.id, -amount, 'guilda_deposito', `guild:${gu!.id}`);
    g.db.run('UPDATE guilds SET gold = gold + ? WHERE id = ?', amount, gu!.id);
    g.db.run('UPDATE guild_members SET contributed = contributed + ? WHERE character_id = ?', amount, c.id);
    log(g, gu!.id, c.id, 'deposito', { gold: amount });
  });
}

export function depositItem(g: Game, c: Character, key: string, qty: number) {
  return g.db.tx(() => {
    const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
    if (itemById.get(key)?.untradeable) fail('Esse item não pode ser transferido.');
    removeItem(g, charOwner(c.id), key, qty);
    addItem(g, guildOwner(gu!.id), key, qty);
    g.db.run('UPDATE guild_members SET contributed = contributed + ? WHERE character_id = ?', Math.round((itemById.get(key)?.value ?? 1) * qty), c.id);
    log(g, gu!.id, c.id, 'deposito', { item: key, qty });
  });
}

/** Retiradas respeitam o limite diário do cargo (unidades de item; ouro conta 1 unidade a cada 10). */
export function withdraw(g: Game, c: Character, key: string | 'ouro', qty: number) {
  return g.db.tx(() => {
    const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
    const limit = GUILD_RANKS[gu!.rank].vaultWithdrawPerDay;
    const day = Math.floor(g.now() / DAY);
    const m = g.db.get<{ withdraw_day: number; withdrawn: number }>('SELECT withdraw_day, withdrawn FROM guild_members WHERE character_id = ?', c.id)!;
    const used = m.withdraw_day === day ? m.withdrawn : 0;
    const units = key === 'ouro' ? Math.ceil(qty / 10) : qty;
    if (used + units > limit) fail(`Limite diário do cargo ${GUILD_RANKS[gu!.rank].label}: ${limit === Infinity ? '∞' : limit} unidade(s) (já usou ${used}).`);
    if (key === 'ouro') {
      const r = g.db.run('UPDATE guilds SET gold = gold - ? WHERE id = ? AND gold >= ?', qty, gu!.id, qty);
      if (!r.changes) fail('O cofre não tem esse ouro.');
      changeGold(g, c.id, qty, 'guilda_retirada', `guild:${gu!.id}`);
      log(g, gu!.id, c.id, 'retirada', { gold: qty });
    } else {
      removeItem(g, guildOwner(gu!.id), key, qty);
      addItem(g, charOwner(c.id), key, qty);
      log(g, gu!.id, c.id, 'retirada', { item: key, qty });
    }
    g.db.run('UPDATE guild_members SET withdraw_day = ?, withdrawn = ? WHERE character_id = ?', day, used + units, c.id);
  });
}

export function vault(g: Game, guildId: number) { return listItems(g, guildOwner(guildId)); }
export function vaultLog(g: Game, guildId: number, limit = 15) {
  return g.db.all<{ action: string; item_key: string | null; qty: number | null; gold: number | null; note: string | null; at: number; name: string | null }>(
    'SELECT l.*, c.name FROM guild_log l LEFT JOIN characters c ON c.id = l.character_id WHERE l.guild_id = ? ORDER BY l.id DESC LIMIT ?', guildId, limit);
}

// ---------------------------------------------------------------- projetos comunitários

export function startProject(g: Game, c: Character, upgradeId: string) {
  return g.db.tx(() => {
    const gu = requireRank(g, c, (r) => r.canManage || r.canInvite, 'Apenas líder e oficiais iniciam projetos.');
    if (gu.project) fail('A guilda já tem um projeto em andamento.');
    const up = guildUpgradeById.get(upgradeId) ?? fail('Melhoria desconhecida.');
    const level = guildUpgradeLevel(gu, upgradeId) + 1;
    if (level > up!.maxLevel) fail('Essa melhoria já está no nível máximo.');
    const need = up!.cost(level);
    const project: GuildProject = { upgrade: upgradeId, level, gold: 0, items: {}, work: 0, need };
    g.db.run('UPDATE guilds SET project = ? WHERE id = ?', JSON.stringify(project), gu.id);
    log(g, gu.id, c.id, 'projeto', { note: `${up!.name} ${level}` });
    return project;
  });
}

/** Contribuições aceitam ouro, materiais ou trabalho (horas de ordens de trabalho dos membros). */
export function contributeProject(g: Game, guildId: number, charId: number, add: { gold?: number; item?: [string, number]; work?: number }) {
  const gu = getGuild(g, guildId);
  if (!gu?.project) return null;
  const p = gu.project;
  if (add.gold) {
    const r = g.db.run('UPDATE guilds SET gold = gold - ? WHERE id = ? AND gold >= ?', add.gold, guildId, add.gold);
    if (!r.changes) fail('O cofre não tem esse ouro.');
    p.gold += add.gold;
  }
  if (add.item) {
    const [k, q] = add.item;
    const needed = p.need.items.find((x) => x[0] === k);
    if (!needed) fail('Esse material não é necessário no projeto.');
    const missing = needed![1] - (p.items[k] ?? 0);
    const use = Math.min(missing, q);
    if (use <= 0) fail('Esse material já foi completado.');
    removeItem(g, charOwner(charId), k, use);
    p.items[k] = (p.items[k] ?? 0) + use;
  }
  if (add.work) p.work += add.work;
  const done = p.gold >= p.need.gold && p.work >= p.need.work && p.need.items.every(([k, q]) => (p.items[k] ?? 0) >= q);
  if (done) {
    gu.upgrades[p.upgrade] = p.level;
    g.db.run('UPDATE guilds SET upgrades = ?, project = NULL WHERE id = ?', JSON.stringify(gu.upgrades), guildId);
    log(g, guildId, null, 'melhoria_concluida', { note: `${guildUpgradeById.get(p.upgrade)?.name} ${p.level}` });
  } else g.db.run('UPDATE guilds SET project = ? WHERE id = ?', JSON.stringify(p), guildId);
  if (add.item || add.gold) log(g, guildId, charId, 'contribuiu', { item: add.item?.[0], qty: add.item?.[1], gold: add.gold });
  return { project: p, done };
}

export function contribute(g: Game, c: Character, kind: 'ouro' | 'item', key: string | undefined, qty: number) {
  return g.db.tx(() => {
    const gu = guildOf(g, c.id) ?? fail('Você não está em uma guilda.');
    if (!gu!.project) fail('Não há projeto em andamento.');
    if (kind === 'ouro') {
      changeGold(g, c.id, -qty, 'guilda_projeto', `guild:${gu!.id}`);
      g.db.run('UPDATE guilds SET gold = gold + ? WHERE id = ?', qty, gu!.id);
      g.db.run('UPDATE guild_members SET contributed = contributed + ? WHERE character_id = ?', qty, c.id);
      return contributeProject(g, gu!.id, c.id, { gold: qty });
    }
    g.db.run('UPDATE guild_members SET contributed = contributed + ? WHERE character_id = ?', Math.round((itemById.get(key!)?.value ?? 1) * qty), c.id);
    return contributeProject(g, gu!.id, c.id, { item: [key!, qty] });
  });
}

export function addGuildWork(g: Game, charId: number, hours: number) {
  const gu = guildOf(g, charId);
  if (gu?.project && hours > 0) contributeProject(g, gu.id, charId, { work: Math.round(hours) });
}

export function setBanner(g: Game, c: Character, banner: Guild['banner'], description?: string) {
  const gu = requireRank(g, c, (r) => r.canManage, 'Apenas o líder personaliza a sede.');
  g.db.run('UPDATE guilds SET banner = ?, description = COALESCE(?, description) WHERE id = ?', JSON.stringify({ ...gu.banner, ...banner }), description?.slice(0, 300), gu.id);
}

// ---------------------------------------------------------------- biblioteca de descobertas

export function shareDiscovery(g: Game, charId: number, monsterId: string) {
  const gu = guildOf(g, charId);
  if (!gu || guildUpgradeLevel(gu, 'biblioteca') < 1) return;
  g.db.run('INSERT OR IGNORE INTO guild_library (guild_id, monster_id) VALUES (?,?)', gu.id, monsterId);
}
export function libraryKnows(g: Game, charId: number, monsterId: string): boolean {
  const gu = guildOf(g, charId);
  if (!gu) return false;
  return !!g.db.get('SELECT 1 FROM guild_library WHERE guild_id = ? AND monster_id = ?', gu.id, monsterId);
}

export { countItem, getCharacter, ledger };
