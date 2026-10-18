/**
 * Миграции схемы базы данных (PostgreSQL 13+).
 *
 * Применяются автоматически при первом обращении к базе (см. src/lib/db/index.ts)
 * и при запуске сервера (src/instrumentation.ts). Каждая миграция выполняется один
 * раз и записывается в таблицу schema_migrations.
 *
 * Правило: опубликованные миграции не меняются — изменения схемы добавляются
 * новой записью в конец списка.
 */
export type Migration = { id: string; sql: string };

export const migrations: Migration[] = [
  {
    id: "001_requests_and_admin",
    sql: `
      CREATE TABLE requests (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
        phone           text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
        phone_digits    text NOT NULL DEFAULT '' CHECK (char_length(phone_digits) <= 15),
        email           text NOT NULL DEFAULT '' CHECK (char_length(email) <= 120),
        service         text NOT NULL DEFAULT '' CHECK (char_length(service) <= 64),
        service_title   text NOT NULL CHECK (char_length(service_title) <= 200),
        message         text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000),
        status          text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'in_progress', 'waiting_client', 'done', 'rejected')),
        notes           text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
        source_page     text CHECK (char_length(source_page) <= 300),
        consent_revision text NOT NULL CHECK (char_length(consent_revision) <= 40),
        submission_key  uuid NOT NULL UNIQUE
      );
      CREATE INDEX requests_created_at_idx ON requests (created_at DESC, id DESC);
      CREATE INDEX requests_status_created_at_idx ON requests (status, created_at DESC);
      CREATE INDEX requests_phone_digits_idx ON requests (phone_digits);
      CREATE INDEX requests_email_lower_idx ON requests (lower(email));
      CREATE INDEX requests_name_lower_idx ON requests (lower(name));

      CREATE TABLE admin_sessions (
        token_hash  text PRIMARY KEY,
        created_at  timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL
      );
      CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at);

      CREATE TABLE admin_login_attempts (
        id            bigserial PRIMARY KEY,
        client_hash   text NOT NULL,
        attempted_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX admin_login_attempts_client_idx ON admin_login_attempts (client_hash, attempted_at);
      CREATE INDEX admin_login_attempts_time_idx ON admin_login_attempts (attempted_at);
    `,
  },
  {
    id: "002_request_context",
    sql: `
      ALTER TABLE requests ADD COLUMN context text CHECK (char_length(context) <= 300);
    `,
  },
];
