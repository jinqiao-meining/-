const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data", "research.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    question TEXT DEFAULT '',
    sample TEXT DEFAULT '',
    data_shape TEXT DEFAULT 'panel',
    method TEXT DEFAULT 'did',
    stage TEXT DEFAULT 'design',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    size_bytes INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS research_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS variable_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    upload_id INTEGER NOT NULL,
    dependent_var TEXT DEFAULT '',
    independent_vars TEXT DEFAULT '[]',
    control_vars TEXT DEFAULT '[]',
    group_var TEXT DEFAULT '',
    time_var TEXT DEFAULT '',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(upload_id) REFERENCES uploads(id) ON DELETE CASCADE
  );
`);

module.exports = db;
