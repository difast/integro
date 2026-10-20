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
  {
    // Общая система обращений из мессенджеров: таблицы чат-бота MAX становятся общими для всех
    // каналов (MAX, Telegram). Данные сохраняются; у каждой записи — канал и внешний идентификатор.
    // Клиент однозначно определяется парой (канал, ID пользователя в канале); имя и username для
    // связи не используются. person_id — ручная связь карточек одного человека из разных каналов.
    id: "005_chat_channels",
    sql: `
      ALTER TABLE max_clients RENAME TO chat_clients;
      ALTER TABLE chat_clients ADD COLUMN channel text NOT NULL DEFAULT 'max' CHECK (channel IN ('max', 'telegram'));
      ALTER TABLE chat_clients ALTER COLUMN channel DROP DEFAULT;
      ALTER TABLE chat_clients RENAME COLUMN max_user_id TO external_user_id;
      ALTER TABLE chat_clients DROP CONSTRAINT max_clients_max_user_id_key;
      ALTER TABLE chat_clients ADD CONSTRAINT chat_clients_channel_user_key UNIQUE (channel, external_user_id);
      ALTER TABLE chat_clients ADD COLUMN person_id uuid;
      CREATE INDEX chat_clients_person_idx ON chat_clients (person_id) WHERE person_id IS NOT NULL;
      ALTER INDEX max_clients_activity_idx RENAME TO chat_clients_activity_idx;
      ALTER INDEX max_clients_status_idx RENAME TO chat_clients_status_idx;
      ALTER INDEX max_clients_phone_digits_idx RENAME TO chat_clients_phone_digits_idx;
      CREATE INDEX chat_clients_channel_idx ON chat_clients (channel, last_seen_at DESC);

      ALTER TABLE max_events RENAME TO chat_events;
      ALTER TABLE chat_events ADD COLUMN channel text NOT NULL DEFAULT 'max' CHECK (channel IN ('max', 'telegram'));
      ALTER TABLE chat_events ALTER COLUMN channel DROP DEFAULT;
      ALTER TABLE chat_events RENAME COLUMN max_user_id TO external_user_id;
      ALTER INDEX max_events_queue_idx RENAME TO chat_events_queue_idx;

      ALTER TABLE max_messages RENAME TO chat_messages;
      -- Внешние идентификаторы сообщения: ID сообщения в канале, чат и пользователь.
      ALTER TABLE chat_messages ADD COLUMN external_message_id text CHECK (char_length(external_message_id) <= 200);
      ALTER TABLE chat_messages ADD COLUMN external_chat_id bigint;
      ALTER TABLE chat_messages ADD COLUMN external_user_id bigint;
      UPDATE chat_messages SET external_message_id = external_mid WHERE external_mid IS NOT NULL;
      ALTER INDEX max_messages_client_idx RENAME TO chat_messages_client_idx;
      ALTER INDEX max_messages_outbox_idx RENAME TO chat_messages_outbox_idx;

      ALTER TABLE max_notes RENAME TO chat_notes;
      ALTER INDEX max_notes_client_idx RENAME TO chat_notes_client_idx;

      ALTER TABLE requests RENAME COLUMN max_client_id TO chat_client_id;
      ALTER INDEX requests_max_client_idx RENAME TO requests_chat_client_idx;
      ALTER TABLE requests DROP CONSTRAINT requests_channel_check;
      ALTER TABLE requests ADD CONSTRAINT requests_channel_check CHECK (channel IN ('site', 'max', 'telegram'));
    `,
  },
  {
    // Автоматические сообщения: напоминания о незавершённой заявке и опрос после закрытия диалога.
    // reminder_stage: 0 — не отправлялось, 1 — первое, 2 — второе (последнее); сбрасывается любым
    // сообщением клиента. survey_due_at — когда отправить опрос (ставится при закрытии диалога).
    id: "006_chat_followups",
    sql: `
      ALTER TABLE chat_clients ADD COLUMN reminder_stage smallint NOT NULL DEFAULT 0 CHECK (reminder_stage BETWEEN 0 AND 2);
      ALTER TABLE chat_clients ADD COLUMN last_reminder_at timestamptz;
      ALTER TABLE chat_clients ADD COLUMN survey_due_at timestamptz;
      ALTER TABLE chat_clients ADD COLUMN survey_sent_at timestamptz;
      CREATE INDEX chat_clients_reminder_idx ON chat_clients (last_seen_at) WHERE status = 'open' AND mode = 'bot' AND reminder_stage < 2;
      CREATE INDEX chat_clients_survey_idx ON chat_clients (survey_due_at) WHERE survey_due_at IS NOT NULL;
    `,
  },
  {
    // CRM: уведомления, мониторинг, резервные копии, воронка и выручка. Существующие данные не меняются:
    // новые поля заявок получают значения по умолчанию (этап «Заявка», оплата «нет»).
    id: "007_crm_operations",
    sql: `
      -- Настройки (уведомления, сроки хранения и т. п.). Секреты здесь не хранятся.
      CREATE TABLE app_settings (
        key         text PRIMARY KEY CHECK (char_length(key) <= 100),
        value       jsonb NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      );

      -- Уведомления: одна запись на событие (dedupe_key), доставка — отдельными строками по каналам.
      CREATE TABLE notifications (
        id          bigserial PRIMARY KEY,
        type        text NOT NULL CHECK (type IN ('message', 'request_site', 'request_bot', 'needs_reply', 'send_failed', 'processing_failed', 'backup_failed', 'system')),
        channel     text NOT NULL CHECK (char_length(channel) <= 20),
        title       text NOT NULL CHECK (char_length(title) <= 200),
        body        text NOT NULL DEFAULT '' CHECK (char_length(body) <= 500),
        link        text CHECK (char_length(link) <= 300),
        dedupe_key  text NOT NULL UNIQUE CHECK (char_length(dedupe_key) <= 200),
        created_at  timestamptz NOT NULL DEFAULT now(),
        read_at     timestamptz
      );
      CREATE INDEX notifications_created_idx ON notifications (created_at DESC, id DESC);
      CREATE INDEX notifications_unread_idx ON notifications (created_at DESC) WHERE read_at IS NULL;

      CREATE TABLE push_subscriptions (
        id               bigserial PRIMARY KEY,
        endpoint         text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
        p256dh           text NOT NULL CHECK (char_length(p256dh) <= 200),
        auth             text NOT NULL CHECK (char_length(auth) <= 100),
        label            text NOT NULL DEFAULT '' CHECK (char_length(label) <= 100),
        created_at       timestamptz NOT NULL DEFAULT now(),
        last_success_at  timestamptz,
        failures         integer NOT NULL DEFAULT 0
      );

      -- Получатели служебных уведомлений в Telegram (привязаны одноразовым кодом из админки).
      CREATE TABLE notification_recipients (
        id            bigserial PRIMARY KEY,
        transport     text NOT NULL DEFAULT 'telegram' CHECK (transport IN ('telegram')),
        chat_id       bigint NOT NULL,
        display_name  text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 200),
        active        boolean NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        UNIQUE (transport, chat_id)
      );

      CREATE TABLE admin_link_codes (
        code_hash   text PRIMARY KEY,
        expires_at  timestamptz NOT NULL,
        used_at     timestamptz
      );

      CREATE TABLE notification_deliveries (
        id               bigserial PRIMARY KEY,
        notification_id  bigint NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
        transport        text NOT NULL CHECK (transport IN ('push', 'telegram')),
        target_id        bigint NOT NULL,
        status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
        attempts         integer NOT NULL DEFAULT 0,
        next_attempt_at  timestamptz NOT NULL DEFAULT now(),
        claimed_at       timestamptz,
        error            text CHECK (char_length(error) <= 300),
        sent_at          timestamptz,
        UNIQUE (notification_id, transport, target_id)
      );
      CREATE INDEX notification_deliveries_queue_idx ON notification_deliveries (next_attempt_at) WHERE status IN ('pending', 'sending');

      -- Журнал операций интеграций: ошибки, повторы, дубликаты. Без токенов, заголовков и персональных данных.
      CREATE TABLE system_events (
        id          bigserial PRIMARY KEY,
        created_at  timestamptz NOT NULL DEFAULT now(),
        channel     text NOT NULL CHECK (char_length(channel) <= 20),
        operation   text NOT NULL CHECK (char_length(operation) <= 40),
        result      text NOT NULL CHECK (result IN ('ok', 'error', 'retry', 'duplicate', 'failed')),
        ref         text CHECK (char_length(ref) <= 200),
        message     text NOT NULL DEFAULT '' CHECK (char_length(message) <= 500)
      );
      CREATE INDEX system_events_created_idx ON system_events (created_at DESC, id DESC);
      CREATE INDEX system_events_filter_idx ON system_events (channel, result, created_at DESC);

      -- Последний успех и последняя ошибка по каждой операции каждого канала (для панели «Система»).
      CREATE TABLE integration_status (
        key            text PRIMARY KEY CHECK (char_length(key) <= 60),
        last_ok_at     timestamptz,
        last_error_at  timestamptz,
        last_error     text CHECK (char_length(last_error) <= 500),
        details        jsonb,
        updated_at     timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE backup_runs (
        id           bigserial PRIMARY KEY,
        started_at   timestamptz NOT NULL DEFAULT now(),
        finished_at  timestamptz,
        status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
        trigger      text NOT NULL CHECK (trigger IN ('schedule', 'manual')),
        size_bytes   bigint,
        row_count    bigint,
        location     text CHECK (char_length(location) <= 300),
        error        text CHECK (char_length(error) <= 500)
      );
      CREATE INDEX backup_runs_started_idx ON backup_runs (started_at DESC);

      -- Повтор обработки событий с растущим интервалом.
      ALTER TABLE chat_events ADD COLUMN next_attempt_at timestamptz;

      -- Квалифицированный лид (отмечает оператор).
      ALTER TABLE chat_clients ADD COLUMN qualified_at timestamptz;

      -- Воронка, сделка, оплата, источник, ответственный.
      CREATE TABLE loss_reasons (
        id      serial PRIMARY KEY,
        title   text NOT NULL UNIQUE CHECK (char_length(title) BETWEEN 1 AND 100),
        active  boolean NOT NULL DEFAULT true,
        sort    integer NOT NULL DEFAULT 0
      );
      INSERT INTO loss_reasons (title, sort) VALUES
        ('Цена', 10), ('Клиент перестал отвечать', 20), ('Выбрал конкурента', 30),
        ('Услуга не подходит', 40), ('Не удалось связаться', 50), ('Другое', 100);

      ALTER TABLE requests DROP CONSTRAINT requests_channel_check;
      ALTER TABLE requests ADD CONSTRAINT requests_channel_check
        CHECK (channel IN ('site', 'max', 'telegram', 'whatsapp', 'avito', 'phone', 'email', 'other'));
      ALTER TABLE requests ADD COLUMN source_note text CHECK (char_length(source_note) <= 200);
      ALTER TABLE requests ADD COLUMN attribution jsonb;
      ALTER TABLE requests ADD COLUMN stage text NOT NULL DEFAULT 'request'
        CHECK (stage IN ('request', 'negotiation', 'priced', 'won', 'lost'));
      ALTER TABLE requests ADD COLUMN stage_changed_at timestamptz;
      ALTER TABLE requests ADD COLUMN loss_reason_id integer REFERENCES loss_reasons (id) ON DELETE SET NULL;
      ALTER TABLE requests ADD COLUMN loss_comment text CHECK (char_length(loss_comment) <= 500);
      ALTER TABLE requests ADD COLUMN assignee text CHECK (char_length(assignee) <= 100);
      ALTER TABLE requests ADD COLUMN deal_amount numeric(14, 2) CHECK (deal_amount >= 0);
      ALTER TABLE requests ADD COLUMN currency text NOT NULL DEFAULT 'RUB' CHECK (currency ~ '^[A-Z]{3}$');
      ALTER TABLE requests ADD COLUMN contract_date date;
      ALTER TABLE requests ADD COLUMN payment_status text NOT NULL DEFAULT 'none' CHECK (payment_status IN ('none', 'partial', 'paid'));
      ALTER TABLE requests ADD COLUMN paid_amount numeric(14, 2) CHECK (paid_amount >= 0);
      ALTER TABLE requests ADD COLUMN paid_at date;
      CREATE INDEX requests_stage_idx ON requests (stage, created_at DESC);
      CREATE INDEX requests_channel_created_idx ON requests (channel, created_at DESC);

      -- История изменений заявки: статус, этап, источник, ответственный, сумма, оплата.
      CREATE TABLE request_history (
        id          bigserial PRIMARY KEY,
        request_id  uuid NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
        field       text NOT NULL CHECK (char_length(field) <= 40),
        old_value   text CHECK (char_length(old_value) <= 300),
        new_value   text CHECK (char_length(new_value) <= 300),
        actor       text NOT NULL CHECK (actor IN ('admin', 'system', 'site', 'bot')),
        changed_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX request_history_request_idx ON request_history (request_id, changed_at);
      CREATE INDEX request_history_stage_idx ON request_history (field, new_value, request_id);
    `,
  },
];
