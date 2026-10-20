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
  {
    // Переходы по кнопкам мессенджеров. Без персональных данных: ни IP, ни cookie, ни User-Agent.
    id: "003_messenger_clicks",
    sql: `
      CREATE TABLE messenger_clicks (
        id          bigserial PRIMARY KEY,
        created_at  timestamptz NOT NULL DEFAULT now(),
        messenger   text NOT NULL CHECK (messenger IN ('whatsapp', 'telegram', 'max')),
        placement   text NOT NULL CHECK (placement IN ('header', 'mobile_menu', 'footer', 'contacts')),
        page_path   text NOT NULL CHECK (char_length(page_path) BETWEEN 1 AND 200)
      );
      CREATE INDEX messenger_clicks_created_at_idx ON messenger_clicks (created_at);
    `,
  },
  {
    // Чат-бот MAX: клиенты (диалог с ботом у каждого пользователя один, поэтому сведения о диалоге —
    // в той же записи), сообщения, внутренние заметки и журнал входящих событий для защиты от дублей.
    id: "004_max_bot",
    sql: `
      CREATE TABLE max_clients (
        id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        max_user_id            bigint NOT NULL UNIQUE,
        chat_id                bigint,
        first_name             text NOT NULL DEFAULT '' CHECK (char_length(first_name) <= 200),
        last_name              text NOT NULL DEFAULT '' CHECK (char_length(last_name) <= 200),
        username               text CHECK (char_length(username) <= 200),
        source                 text CHECK (char_length(source) <= 200),
        phone                  text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
        phone_digits           text NOT NULL DEFAULT '' CHECK (char_length(phone_digits) <= 15),
        status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        mode                   text NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot', 'operator')),
        needs_reply            boolean NOT NULL DEFAULT false,
        bot_blocked            boolean NOT NULL DEFAULT false,
        flow_state             jsonb NOT NULL DEFAULT '{}'::jsonb,
        consent_at             timestamptz,
        consent_revision       text CHECK (char_length(consent_revision) <= 40),
        first_seen_at          timestamptz NOT NULL DEFAULT now(),
        last_seen_at           timestamptz NOT NULL DEFAULT now(),
        last_message_at        timestamptz,
        last_message_preview   text CHECK (char_length(last_message_preview) <= 300),
        last_message_direction text CHECK (last_message_direction IN ('in', 'out')),
        updated_at             timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX max_clients_activity_idx ON max_clients (last_seen_at DESC, id DESC);
      CREATE INDEX max_clients_status_idx ON max_clients (status, needs_reply, last_seen_at DESC);
      CREATE INDEX max_clients_phone_digits_idx ON max_clients (phone_digits);

      CREATE TABLE max_events (
        id            bigserial PRIMARY KEY,
        event_key     text NOT NULL UNIQUE CHECK (char_length(event_key) <= 300),
        update_type   text NOT NULL CHECK (char_length(update_type) <= 64),
        max_user_id   bigint,
        event_time    timestamptz,
        received_at   timestamptz NOT NULL DEFAULT now(),
        payload       jsonb,
        status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'ignored', 'failed')),
        attempts      integer NOT NULL DEFAULT 0,
        claimed_at    timestamptz,
        error         text CHECK (char_length(error) <= 500),
        processed_at  timestamptz
      );
      CREATE INDEX max_events_queue_idx ON max_events (status, received_at) WHERE status IN ('pending', 'processing', 'failed');

      CREATE TABLE max_messages (
        id               bigserial PRIMARY KEY,
        client_id        uuid NOT NULL REFERENCES max_clients (id) ON DELETE CASCADE,
        direction        text NOT NULL CHECK (direction IN ('in', 'out')),
        author           text NOT NULL CHECK (author IN ('client', 'bot', 'operator')),
        kind             text NOT NULL CHECK (char_length(kind) <= 32),
        text             text NOT NULL DEFAULT '' CHECK (char_length(text) <= 4000),
        attachments      jsonb,
        external_mid     text UNIQUE CHECK (char_length(external_mid) <= 200),
        event_id         bigint REFERENCES max_events (id) ON DELETE SET NULL,
        idempotency_key  uuid UNIQUE,
        status           text NOT NULL CHECK (status IN ('received', 'pending', 'sending', 'sent', 'failed', 'unknown')),
        error            text CHECK (char_length(error) <= 500),
        attempts         integer NOT NULL DEFAULT 0,
        claimed_at       timestamptz,
        event_time       timestamptz NOT NULL DEFAULT now(),
        created_at       timestamptz NOT NULL DEFAULT now(),
        sent_at          timestamptz
      );
      CREATE INDEX max_messages_client_idx ON max_messages (client_id, id DESC);
      CREATE INDEX max_messages_outbox_idx ON max_messages (status, created_at) WHERE status IN ('pending', 'sending');

      CREATE TABLE max_notes (
        id          bigserial PRIMARY KEY,
        client_id   uuid NOT NULL REFERENCES max_clients (id) ON DELETE CASCADE,
        body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX max_notes_client_idx ON max_notes (client_id, id DESC);

      -- Заявки из чат-бота хранятся в той же таблице, что и заявки с сайта.
      ALTER TABLE requests ADD COLUMN channel text NOT NULL DEFAULT 'site' CHECK (channel IN ('site', 'max'));
      ALTER TABLE requests ADD COLUMN max_client_id uuid REFERENCES max_clients (id) ON DELETE SET NULL;
      CREATE INDEX requests_max_client_idx ON requests (max_client_id) WHERE max_client_id IS NOT NULL;
    `,
  },
];
