import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ATTEMPT_RETENTION_MS = 1000 * 60 * 60 * 24 * 90;

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'learner',
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      correct INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id)
    );
    CREATE TABLE IF NOT EXISTS mistakes (
      learner_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      type TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 0,
      recency INTEGER NOT NULL,
      severity REAL NOT NULL,
      recovered INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (learner_id, concept, type),
      FOREIGN KEY (learner_id) REFERENCES learners(id)
    );
    CREATE TABLE IF NOT EXISTS mastery (
      learner_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      evidence TEXT NOT NULL,
      mastered INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (learner_id, lesson_id),
      FOREIGN KEY (learner_id) REFERENCES learners(id)
    );
    CREATE TABLE IF NOT EXISTS progress (
      learner_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      block_index INTEGER NOT NULL,
      unlocked_run INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (learner_id, lesson_id),
      FOREIGN KEY (learner_id) REFERENCES learners(id)
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_learner_created
      ON attempts (learner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mistakes_learner_recency
      ON mistakes (learner_id, recency DESC);
  `);
  pruneOldAttempts(db);
  return db;
}

function pruneOldAttempts(db: DatabaseSync) {
  try {
    const cutoff = Date.now() - ATTEMPT_RETENTION_MS;
    db.prepare("DELETE FROM attempts WHERE created_at < ?").run(cutoff);
  } catch {
    // Retention cleanup must never prevent the app from starting.
  }
}
