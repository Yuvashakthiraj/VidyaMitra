/**
 * SQLite Database Module for VidyaMitra
 * Replaces Firebase Firestore with local SQLite for easier integration
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.resolve(process.cwd(), 'vidyamitra.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
    seedAdminUser();
  }
  return db;
}

function initializeSchema() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      is_admin INTEGER DEFAULT 0,
      target_role TEXT,
      skills TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role_id TEXT,
      role_name TEXT,
      questions TEXT DEFAULT '[]',
      answers TEXT DEFAULT '[]',
      completed INTEGER DEFAULT 0,
      score REAL,
      feedback TEXT,
      outcome TEXT,
      is_practice INTEGER DEFAULT 0,
      aborted INTEGER DEFAULT 0,
      abort_reason TEXT,
      ai_detection_count INTEGER DEFAULT 0,
      start_time TEXT DEFAULT (datetime('now')),
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS practice_aptitude (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      score REAL,
      total_questions INTEGER,
      correct_answers INTEGER,
      category_performance TEXT DEFAULT '{}',
      weak_topics TEXT DEFAULT '[]',
      recommendations TEXT DEFAULT '[]',
      completed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS practice_interviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role_id TEXT,
      role_name TEXT,
      questions TEXT DEFAULT '[]',
      overall_score REAL,
      average_question_score REAL,
      strengths TEXT DEFAULT '[]',
      improvements TEXT DEFAULT '[]',
      recommendations TEXT DEFAULT '[]',
      completed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS practice_coding (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_data TEXT DEFAULT '{}',
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bot_interviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      candidate_name TEXT,
      role TEXT,
      conversation_log TEXT DEFAULT '[]',
      feedback TEXT DEFAULT '{}',
      completed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT,
      raw_text TEXT,
      parsed_data TEXT DEFAULT '{}',
      ats_score REAL,
      ats_analysis TEXT DEFAULT '{}',
      target_role TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS round1_aptitude (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT,
      user_name TEXT,
      role_id TEXT,
      role_name TEXT,
      score REAL,
      total_questions INTEGER,
      correct_answers INTEGER,
      category_performance TEXT DEFAULT '{}',
      completed_at TEXT DEFAULT (datetime('now')),
      aborted INTEGER DEFAULT 0,
      abort_reason TEXT,
      selected_for_round2 INTEGER DEFAULT 0,
      round2_email_sent INTEGER DEFAULT 0,
      round2_interview_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      role_id TEXT UNIQUE,
      is_open INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS career_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_role TEXT,
      skill_gaps TEXT DEFAULT '[]',
      training_plan TEXT DEFAULT '{}',
      roadmap_data TEXT DEFAULT '{}',
      youtube_videos TEXT DEFAULT '[]',
      pexels_images TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS resume_builds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      personal_info TEXT DEFAULT '{}',
      education TEXT DEFAULT '[]',
      experience TEXT DEFAULT '[]',
      projects TEXT DEFAULT '[]',
      skills TEXT DEFAULT '[]',
      template TEXT DEFAULT 'modern',
      ats_score REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('✅ SQLite schema initialized');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function seedAdminUser() {
  const database = db;
  const admin = database.prepare('SELECT * FROM users WHERE email = ?').get('admin@vidyamitra.com');
  if (!admin) {
    const id = crypto.randomUUID();
    const passwordHash = hashPassword('admin@123');
    database.prepare(
      'INSERT INTO users (id, email, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(id, 'admin@vidyamitra.com', passwordHash, 'Admin', 1);
    console.log('✅ Admin user seeded: admin@vidyamitra.com / admin@123');
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
