import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATIONS } from './migrations.ts';

export type Row = Record<string, SQLInputValue>;
export type Param = SQLInputValue | boolean | undefined;

/**
 * Banco de dados: a fonte de verdade sobre personagens, itens e atividades.
 * Todas as operações que movem recursos passam por `tx`, que é atômica
 * (BEGIN IMMEDIATE) e aninhável por savepoints.
 */
export class Db {
  readonly raw: DatabaseSync;
  private depth = 0;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate() {
    this.raw.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    const row = this.raw.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    let current = row?.version ?? 0;
    if (!row) this.raw.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
    for (const [i, sql] of MIGRATIONS.entries()) {
      const v = i + 1;
      if (v <= current) continue;
      this.raw.exec('BEGIN');
      try {
        this.raw.exec(sql);
        this.raw.prepare('UPDATE schema_version SET version = ?').run(v);
        this.raw.exec('COMMIT');
        current = v;
      } catch (e) {
        this.raw.exec('ROLLBACK');
        throw e;
      }
    }
  }

  private norm(params: Param[]): SQLInputValue[] {
    return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
  }

  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    return this.raw.prepare(sql).get(...this.norm(params)) as T | undefined;
  }

  all<T = Row>(sql: string, ...params: Param[]): T[] {
    return this.raw.prepare(sql).all(...this.norm(params)) as T[];
  }

  run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
    const r = this.raw.prepare(sql).run(...this.norm(params));
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  /** Executa `fn` atomicamente. Exceções desfazem tudo. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) {
      const sp = `sp${this.depth}`;
      this.raw.exec(`SAVEPOINT ${sp}`);
      this.depth++;
      try {
        const r = fn();
        this.raw.exec(`RELEASE ${sp}`);
        return r;
      } catch (e) {
        this.raw.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw e;
      } finally {
        this.depth--;
      }
    }
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const r = fn();
      this.raw.exec('COMMIT');
      return r;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }

  close() {
    this.raw.close();
  }
}

export const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string' || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
