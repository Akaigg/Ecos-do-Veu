import { CAMPAIGN_MAX_PLAYERS } from '../data/campaigns.ts';
import { fail, type Game } from './core.ts';
import { getCharacter, type Character } from './character.ts';

export interface Party { id: number; leaderId: number; mode: 'ao_vivo' | 'assincrono'; deadlineHours: number; members: { id: number; name: string; posture: 'defender' | 'atacar' }[] }

export function partyOf(g: Game, charId: number): Party | undefined {
  const m = g.db.get<{ party_id: number }>('SELECT party_id FROM party_members WHERE character_id = ?', charId);
  return m ? getParty(g, m.party_id) : undefined;
}

export function getParty(g: Game, id: number): Party | undefined {
  const p = g.db.get<{ id: number; leader_id: number; mode: string; deadline_hours: number }>('SELECT * FROM parties WHERE id = ?', id);
  if (!p) return undefined;
  const members = g.db.all<{ character_id: number; posture: string; name: string }>(
    'SELECT m.character_id, m.posture, c.name FROM party_members m JOIN characters c ON c.id = m.character_id WHERE m.party_id = ? ORDER BY m.joined_at', id,
  ).map((r) => ({ id: r.character_id, name: r.name, posture: r.posture as 'defender' | 'atacar' }));
  return { id: p.id, leaderId: p.leader_id, mode: p.mode as Party['mode'], deadlineHours: p.deadline_hours, members };
}

export function createParty(g: Game, c: Character): Party {
  return g.db.tx(() => {
    if (partyOf(g, c.id)) fail('Você já está em um grupo.');
    const id = g.db.run('INSERT INTO parties (leader_id, created_at) VALUES (?,?)', c.id, g.now()).lastInsertRowid;
    g.db.run('INSERT INTO party_members (party_id, character_id, joined_at) VALUES (?,?,?)', id, c.id, g.now());
    return getParty(g, id)!;
  });
}

export function inviteToParty(g: Game, c: Character, target: Character): Party {
  return g.db.tx(() => {
    const p = partyOf(g, c.id) ?? createParty(g, c);
    if (p.leaderId !== c.id) fail('Só quem lidera o grupo pode convidar.');
    if (p.members.length >= CAMPAIGN_MAX_PLAYERS) fail(`Grupos têm no máximo ${CAMPAIGN_MAX_PLAYERS} pessoas.`);
    if (partyOf(g, target.id)) fail(`${target.name} já está em um grupo.`);
    g.db.run('INSERT OR REPLACE INTO party_invites (party_id, character_id, at) VALUES (?,?,?)', p.id, target.id, g.now());
    return p;
  });
}

export function joinParty(g: Game, c: Character, partyId: number): Party {
  return g.db.tx(() => {
    if (partyOf(g, c.id)) fail('Você já está em um grupo.');
    if (!g.db.get('SELECT 1 FROM party_invites WHERE party_id = ? AND character_id = ?', partyId, c.id)) fail('Convite não encontrado ou expirado.');
    const p = getParty(g, partyId) ?? fail('Esse grupo não existe mais.');
    if (p!.members.length >= CAMPAIGN_MAX_PLAYERS) fail('O grupo está cheio.');
    g.db.run('DELETE FROM party_invites WHERE character_id = ?', c.id);
    g.db.run('INSERT INTO party_members (party_id, character_id, joined_at) VALUES (?,?,?)', partyId, c.id, g.now());
    return getParty(g, partyId)!;
  });
}

export function leaveParty(g: Game, c: Character) {
  return g.db.tx(() => {
    const p = partyOf(g, c.id) ?? fail('Você não está em um grupo.');
    const run = g.db.get("SELECT 1 FROM campaign_runs WHERE party_id = ? AND status IN ('ativa','pausada')", p!.id);
    if (run) fail('O grupo está em uma campanha. Saídas e substituições acontecem em acampamentos (`/campanha substituir`).');
    g.db.run('DELETE FROM party_members WHERE character_id = ?', c.id);
    const rest = getParty(g, p!.id)!;
    if (!rest.members.length) g.db.run('DELETE FROM parties WHERE id = ?', p!.id);
    else if (p!.leaderId === c.id) g.db.run('UPDATE parties SET leader_id = ? WHERE id = ?', rest.members[0].id, p!.id);
  });
}

export function setPartyMode(g: Game, c: Character, mode: Party['mode'], deadlineHours?: number) {
  const p = partyOf(g, c.id) ?? fail('Você não está em um grupo.');
  if (p!.leaderId !== c.id) fail('Só quem lidera define o ritmo.');
  const h = Math.max(1, Math.min(48, deadlineHours ?? p!.deadlineHours));
  g.db.run('UPDATE parties SET mode = ?, deadline_hours = ? WHERE id = ?', mode, h, p!.id);
}

/** Postura automática usada quando o jogador não age dentro do prazo. */
export function setPosture(g: Game, c: Character, posture: 'defender' | 'atacar') {
  g.db.run('UPDATE party_members SET posture = ? WHERE character_id = ?', posture, c.id);
  const settings = { ...c.settings, posture };
  g.db.run('UPDATE characters SET settings = ? WHERE id = ?', JSON.stringify(settings), c.id);
}

export function partyInvites(g: Game, charId: number) {
  return g.db.all<{ party_id: number; leader: string }>(
    'SELECT i.party_id, c.name AS leader FROM party_invites i JOIN parties p ON p.id = i.party_id JOIN characters c ON c.id = p.leader_id WHERE i.character_id = ?', charId);
}

export function partyCharacters(g: Game, p: Party): Character[] {
  return p.members.map((m) => getCharacter(g, m.id)!).filter(Boolean);
}
