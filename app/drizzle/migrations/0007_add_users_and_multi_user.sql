-- 0007_add_users_and_multi_user.sql
-- Adds users table and user_id columns for multi-user support

-- 1. Create users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

-- 2. Add user_id columns to existing tables
ALTER TABLE master_resume ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE job_analyses ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE analytics_summary ADD COLUMN user_id INTEGER REFERENCES users(id);

-- 3. Insert admin user from existing master_resume.email
INSERT INTO users (email, password_hash, role, created_at)
SELECT email, '$2a$10$REPLACE_THIS_WITH_HASH', 'admin', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM master_resume LIMIT 1;

-- 4. Set user_id=1 for all existing data
UPDATE master_resume SET user_id = 1;
UPDATE job_analyses SET user_id = 1;
UPDATE analytics_summary SET user_id = 1;

-- NOTE: Replace $2a$10$REPLACE_THIS_WITH_HASH with a real bcrypt hash before running migration.
