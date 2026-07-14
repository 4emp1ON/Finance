import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/finance.db';

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const UTILITY_TYPES = ['gas', 'water', 'electricity', 'garbage'] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

// Объём обязателен для всех типов, кроме "мусор".
export const UTILITY_VOLUME_REQUIRED: Record<UtilityType, boolean> = {
  gas: true,
  water: true,
  electricity: true,
  garbage: false,
};

export const UTILITY_LABELS: Record<UtilityType, string> = {
  gas: 'За газ',
  water: 'За воду',
  electricity: 'За электричество',
  garbage: 'За мусор',
};

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'pricetag',
      color TEXT NOT NULL DEFAULT '#5260ff',
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      note TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      receipt_path TEXT,
      occurred_at TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurring_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      day_of_month INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS utility_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      volume REAL,
      amount REAL,
      note TEXT,
      prev_volume REAL,
      prev_amount REAL,
      diff_volume REAL,
      diff_amount REAL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, period)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_util_period ON utility_readings(period);
  `);
}

function seed() {
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const defaultPin = process.env.DEFAULT_PIN || '1234';
    const hash = bcrypt.hashSync(defaultPin, 10);
    const insert = db.prepare('INSERT INTO users (name, pin_hash) VALUES (?, ?)');
    insert.run('Муж', hash);
    insert.run('Жена', hash);
    console.log(`[seed] Созданы пользователи "Муж" и "Жена" с PIN по умолчанию: ${defaultPin}`);
  }

  const catCount = (db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number }).c;
  if (catCount === 0) {
    const cats: [string, string, string, number][] = [
      ['Продукты', 'cart', '#2dd36f', 0],
      ['Кафе и рестораны', 'restaurant', '#ffc409', 0],
      ['Транспорт', 'car', '#3dc2ff', 0],
      ['Дом и быт', 'home', '#5260ff', 0],
      ['Здоровье', 'medkit', '#eb445a', 0],
      ['Одежда', 'shirt', '#c56cf0', 0],
      ['Развлечения', 'game-controller', '#ff6b6b', 0],
      ['Коммуналка', 'flash', '#f7b731', 1],
      ['Прочее', 'ellipsis-horizontal', '#92949c', 0],
    ];
    const insert = db.prepare(
      'INSERT INTO categories (name, icon, color, is_system) VALUES (?, ?, ?, ?)'
    );
    for (const c of cats) insert.run(...c);
    console.log('[seed] Созданы базовые категории');
  }
}

migrate();
seed();

export function utilityCategoryId(): number {
  const row = db.prepare("SELECT id FROM categories WHERE name = 'Коммуналка'").get() as
    | { id: number }
    | undefined;
  return row?.id ?? 0;
}
