// Cada entrada é uma migração. Nunca altere uma migração já publicada: acrescente outra.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    race_choice TEXT,
    origin TEXT NOT NULL,
    pronouns TEXT NOT NULL,
    appearance TEXT NOT NULL,
    story TEXT NOT NULL DEFAULT '',
    class_id TEXT NOT NULL,
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    region TEXT NOT NULL DEFAULT 'bosque',
    visited TEXT NOT NULL DEFAULT '["bosque"]',
    masters TEXT NOT NULL DEFAULT '[]',
    meal TEXT,
    title TEXT,
    active_pet INTEGER,
    belt TEXT NOT NULL DEFAULT '[]',
    settings TEXT NOT NULL DEFAULT '{}',
    history TEXT NOT NULL DEFAULT '[]',
    attr_respecs INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE class_progress (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    allocated TEXT NOT NULL,
    learned TEXT NOT NULL DEFAULT '[]',
    equipped TEXT NOT NULL DEFAULT '[]',
    passive TEXT,
    loadouts TEXT NOT NULL DEFAULT '{}',
    respecs INTEGER NOT NULL DEFAULT 0,
    secondary TEXT,
    PRIMARY KEY (character_id, class_id)
  );

  CREATE TABLE professions (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    profession_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    ranks TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (character_id, profession_id)
  );

  -- Itens empilháveis (data NULL) têm uma linha por dono+chave; peças únicas têm data JSON.
  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_kind TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty >= 0),
    data TEXT,
    slot TEXT,
    bound INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX items_stack ON items(owner_kind, owner_id, item_key) WHERE data IS NULL;
  CREATE INDEX items_owner ON items(owner_kind, owner_id);
  CREATE UNIQUE INDEX items_slot ON items(owner_kind, owner_id, slot) WHERE slot IS NOT NULL;

  -- Atividades de campo: apenas uma ativa por personagem (global entre servidores).
  CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    params TEXT NOT NULL,
    reserved TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT '{}',
    seed INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    result TEXT,
    resolved_at INTEGER,
    notified INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX one_field_activity ON activities(character_id) WHERE status = 'ativa' AND kind IN ('trabalho', 'exploracao', 'campanha');
  CREATE INDEX activities_due ON activities(status, ends_at);

  CREATE TABLE craft_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    profession TEXT NOT NULL,
    spec TEXT NOT NULL,
    qty INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    notified INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX craft_due ON craft_queue(status, ends_at);

  CREATE TABLE combats (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    ref TEXT,
    state TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    deadline_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE combat_members (
    combat_id TEXT NOT NULL REFERENCES combats(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL,
    PRIMARY KEY (combat_id, character_id)
  );
  CREATE INDEX combat_members_char ON combat_members(character_id);

  CREATE TABLE pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    species TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    loyalty INTEGER NOT NULL DEFAULT 20,
    traits TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'estabulo',
    mission TEXT,
    injured_until INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX pets_owner ON pets(character_id);

  CREATE TABLE bestiary (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    monster_id TEXT NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    seen INTEGER NOT NULL DEFAULT 0,
    analyzed INTEGER NOT NULL DEFAULT 0,
    first_at INTEGER NOT NULL,
    PRIMARY KEY (character_id, monster_id)
  );

  CREATE TABLE unlocks (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (character_id, kind, key)
  );

  CREATE TABLE reputation (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    faction TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, faction)
  );

  CREATE TABLE contracts (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    template TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, week, idx)
  );

  CREATE TABLE fragments (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, key)
  );

  CREATE TABLE guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tag TEXT NOT NULL,
    leader_id INTEGER NOT NULL,
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    upgrades TEXT NOT NULL DEFAULT '{}',
    project TEXT,
    banner TEXT NOT NULL DEFAULT '{}',
    description TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE guild_members (
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
    rank TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    contributed INTEGER NOT NULL DEFAULT 0,
    withdraw_day INTEGER NOT NULL DEFAULT 0,
    withdrawn INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, character_id)
  );
  CREATE TABLE guild_invites (
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL,
    invited_by INTEGER NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, character_id)
  );
  CREATE TABLE guild_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    character_id INTEGER,
    action TEXT NOT NULL,
    item_key TEXT,
    qty INTEGER,
    gold INTEGER,
    note TEXT,
    at INTEGER NOT NULL
  );
  CREATE TABLE guild_library (
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    monster_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, monster_id)
  );

  CREATE TABLE market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    qty INTEGER NOT NULL,
    data TEXT,
    price INTEGER NOT NULL CHECK (price > 0),
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    buyer_id INTEGER,
    sold_at INTEGER
  );
  CREATE INDEX market_active ON market_listings(status, item_key);

  CREATE TABLE commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    crafter_id INTEGER,
    spec TEXT NOT NULL,
    payment INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leader_id INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'ao_vivo',
    deadline_hours INTEGER NOT NULL DEFAULT 12,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE party_members (
    party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL UNIQUE,
    posture TEXT NOT NULL DEFAULT 'defender',
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (party_id, character_id)
  );
  CREATE TABLE party_invites (
    party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (party_id, character_id)
  );

  CREATE TABLE campaign_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    party_id INTEGER,
    members TEXT NOT NULL,
    chapter INTEGER NOT NULL DEFAULT 0,
    node INTEGER NOT NULL DEFAULT 0,
    flags TEXT NOT NULL DEFAULT '[]',
    votes TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    deadline_hours INTEGER NOT NULL DEFAULT 12,
    deadline_at INTEGER,
    combat_id TEXT,
    channel_id TEXT,
    loot TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    character_id INTEGER,
    kind TEXT NOT NULL,
    gold INTEGER NOT NULL DEFAULT 0,
    item_key TEXT,
    qty INTEGER,
    ref TEXT,
    meta TEXT
  );
  CREATE INDEX ledger_char ON ledger(character_id, at);

  CREATE TABLE idempotency (
    key TEXT PRIMARY KEY,
    at INTEGER NOT NULL
  );

  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    at INTEGER NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0
  );
  `,
];
