// Scoped here rather than in tsconfig `types` so the Bun global doesn't leak
// into the whole project (#263). Must stay above the imports — a triple-slash
// directive after any statement is silently treated as a plain comment.
/// <reference types="bun" />

import { Kysely, SqliteDialect, PostgresDialect, Generated } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";
import { Migrator } from "kysely/migration";
import { Pool } from "pg";

import { env } from "#/lib/env";

export type DatabaseSchema = {
  status: Status;
  auth_session: AuthSession;
  auth_state: AuthState;
  message: Message;
  user_profile: UserProfile;
  sessions: Sessions;
  user_settings: UserSettings;
  push_subscription: PushSubscription;
};

/** @deprecated Dropped by migration 004; the type remains only for `down()`. */
export type Status = {
  uri: string;
  authorDid: string;
  status: string;
  createdAt: string;
  indexedAt: string;
};

export type AuthSession = {
  key: string;
  session: AuthSessionJson;
};

export type AuthState = {
  key: string;
  state: AuthStateJson;
};

export type Message = {
  tid: string;
  message: string;
  createdAt: string;
  recipient: string;
};

export type UserProfile = {
  did: string;
  createdAt: string;
};

/** Boolean columns are read/written through `lib/db-boolean`, not directly. */
export type UserSettings = {
  did: string;
  pdsSyncEnabled: number;
  imageTheme: string;
  inboxEnabled: number;
  profanityFilterEnabled: number;
  customPrompt: string | null;
  profileCardTheme: string | null;
  touchpointLocale: string | null;
  createdAt: string;
};

/** @deprecated Dropped by migration 004; the type remains only for `down()`. */
export type Sessions = {
  sid: string;
  sess: string;
  expire: string;
};

/** One row per (browser/device, account) pair — see `push_subscription_did_endpoint_unique`. */
export type PushSubscription = {
  id: Generated<number>;
  did: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

type AuthStateJson = string;

type AuthSessionJson = string;

type Migration005Schema = {
  user_profile: { did: string; createdAt: string };
  user_settings: { did: string; createdAt: string };
};

const migrations: Record<string, Migration> = {};

const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};

migrations["001"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("status")
      .addColumn("uri", "varchar", (col) => col.primaryKey())
      .addColumn("authorDid", "varchar", (col) => col.notNull())
      .addColumn("status", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addColumn("indexedAt", "varchar", (col) => col.notNull())
      .execute();
    await db.schema
      .createTable("auth_session")
      .addColumn("key", "varchar", (col) => col.primaryKey())
      .addColumn("session", "varchar", (col) => col.notNull())
      .execute();
    await db.schema
      .createTable("auth_state")
      .addColumn("key", "varchar", (col) => col.primaryKey())
      .addColumn("state", "varchar", (col) => col.notNull())
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("auth_state").execute();
    await db.schema.dropTable("auth_session").execute();
    await db.schema.dropTable("status").execute();
  },
};

migrations["002"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("message")
      .addColumn("tid", "varchar", (col) => col.primaryKey())
      .addColumn("message", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addColumn("recipient", "varchar", (col) => col.notNull())
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("message").execute();
  },
};

migrations["003"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("user_profile")
      .addColumn("did", "varchar", (col) => col.primaryKey())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("user_profile").execute();
  },
};

migrations["004"] = {
  async up(db: Kysely<unknown>) {
    await db.schema.dropTable("status").ifExists().execute();
    await db.schema.dropTable("sessions").ifExists().execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema
      .createTable("status")
      .addColumn("uri", "varchar", (col) => col.primaryKey())
      .addColumn("authorDid", "varchar", (col) => col.notNull())
      .addColumn("status", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addColumn("indexedAt", "varchar", (col) => col.notNull())
      .execute();
    await db.schema
      .createTable("sessions")
      .addColumn("sid", "varchar", (col) => col.primaryKey())
      .addColumn("sess", "varchar", (col) => col.notNull())
      .addColumn("expire", "varchar", (col) => col.notNull())
      .execute();
  },
};

migrations["005"] = {
  async up(db: Kysely<Migration005Schema>) {
    await db.schema
      .createTable("user_settings")
      .addColumn("did", "varchar", (col) => col.primaryKey())
      .addColumn("pdsSyncEnabled", "boolean", (col) => col.notNull().defaultTo(true))
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();

    await db
      .insertInto("user_settings")
      .columns(["did", "createdAt"])
      .expression((eb) =>
        eb.selectFrom("user_profile").select(["user_profile.did", "user_profile.createdAt"])
      )
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable("user_settings").ifExists().execute();
  },
};

migrations["006"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable("user_settings")
      .addColumn("imageTheme", "varchar", (col) => col.notNull().defaultTo("default"))
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable("user_settings").dropColumn("imageTheme").execute();
  },
};

migrations["007"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("push_subscription")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("did", "varchar", (col) => col.notNull())
      .addColumn("endpoint", "varchar", (col) => col.notNull().unique())
      .addColumn("p256dh", "varchar", (col) => col.notNull())
      .addColumn("auth", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();
    await db.schema
      .createIndex("push_subscription_did_idx")
      .on("push_subscription")
      .column("did")
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropIndex("push_subscription_did_idx").execute();
    await db.schema.dropTable("push_subscription").ifExists().execute();
  },
};

migrations["008"] = {
  async up(db: Kysely<unknown>) {
    // SQLite cannot ALTER a constraint, so the table is rebuilt. Existing
    // subscriptions go with it; re-enabling notifications is a one-tap fix.
    await db.schema.dropIndex("push_subscription_did_idx").ifExists().execute();
    await db.schema.dropTable("push_subscription").ifExists().execute();

    await db.schema
      .createTable("push_subscription")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("did", "varchar", (col) => col.notNull())
      .addColumn("endpoint", "varchar", (col) => col.notNull())
      .addColumn("p256dh", "varchar", (col) => col.notNull())
      .addColumn("auth", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addUniqueConstraint("push_subscription_did_endpoint_unique", ["did", "endpoint"])
      .execute();

    await db.schema
      .createIndex("push_subscription_did_idx")
      .on("push_subscription")
      .column("did")
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropIndex("push_subscription_did_idx").ifExists().execute();
    await db.schema.dropTable("push_subscription").ifExists().execute();

    await db.schema
      .createTable("push_subscription")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("did", "varchar", (col) => col.notNull())
      .addColumn("endpoint", "varchar", (col) => col.notNull().unique())
      .addColumn("p256dh", "varchar", (col) => col.notNull())
      .addColumn("auth", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();

    await db.schema
      .createIndex("push_subscription_did_idx")
      .on("push_subscription")
      .column("did")
      .execute();
  },
};

migrations["009"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable("user_settings")
      .addColumn("inboxEnabled", "boolean", (col) => col.notNull().defaultTo(true))
      .execute();
    await db.schema
      .alterTable("user_settings")
      .addColumn("profanityFilterEnabled", "boolean", (col) => col.notNull().defaultTo(false))
      .execute();
    await db.schema.alterTable("user_settings").addColumn("customPrompt", "varchar").execute();
    await db.schema.alterTable("user_settings").addColumn("profileCardTheme", "varchar").execute();
    await db.schema.alterTable("user_settings").addColumn("touchpointLocale", "varchar").execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable("user_settings").dropColumn("touchpointLocale").execute();
    await db.schema.alterTable("user_settings").dropColumn("profileCardTheme").execute();
    await db.schema.alterTable("user_settings").dropColumn("customPrompt").execute();
    await db.schema.alterTable("user_settings").dropColumn("profanityFilterEnabled").execute();
    await db.schema.alterTable("user_settings").dropColumn("inboxEnabled").execute();
  },
};

migrations["010"] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createIndex("message_recipient_idx")
      .on("message")
      .column("recipient")
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropIndex("message_recipient_idx").execute();
  },
};

// Kysely's SqliteDialect is duck-typed against this surface. bun:sqlite matches
// it apart from two deltas the adapter below bridges: no `reader` flag, and
// variadic params instead of an array.
interface KyselySqliteStatement {
  reader: boolean;
  all(parameters: ReadonlyArray<unknown>): unknown[];
  run(parameters: ReadonlyArray<unknown>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  iterate(parameters: ReadonlyArray<unknown>): IterableIterator<unknown>;
}
interface KyselySqliteDatabase {
  close(): void;
  prepare(sql: string): KyselySqliteStatement;
}

class BunSqliteStatement implements KyselySqliteStatement {
  readonly reader: boolean;
  #stmt: import("bun:sqlite").Statement;

  constructor(stmt: import("bun:sqlite").Statement) {
    this.#stmt = stmt;
    this.reader = stmt.columnNames.length > 0;
  }

  all(parameters: ReadonlyArray<unknown>) {
    return this.#stmt.all(...parameters);
  }

  run(parameters: ReadonlyArray<unknown>) {
    return this.#stmt.run(...parameters);
  }

  iterate(parameters: ReadonlyArray<unknown>) {
    return this.#stmt.iterate(...parameters);
  }
}

class BunSqliteDatabase implements KyselySqliteDatabase {
  #db: import("bun:sqlite").Database;

  constructor(db: import("bun:sqlite").Database) {
    this.#db = db;
  }

  prepare(sql: string) {
    return new BunSqliteStatement(this.#db.prepare(sql));
  }

  close() {
    this.#db.close();
  }
}

export const createDb = async (location: string): Promise<Database> => {
  if (env.POSTGRESQL_URL) {
    // statement_timeout is applied per-connection via the `options` parameter
    // (libpq's runtime options string), so every pooled connection inherits it
    // without a round-trip per checkout. An empty string leaves it unset.
    const statementTimeout = env.PG_STATEMENT_TIMEOUT_MS;
    const poolConfig: { [key: string]: unknown } = {
      connectionString: env.POSTGRESQL_URL,
      max: env.PG_POOL_MAX,
      idleTimeoutMillis: env.PG_POOL_IDLE_TIMEOUT_MS,
    };
    if (statementTimeout > 0) {
      poolConfig.options = `-c statement_timeout=${statementTimeout}`;
    }
    return new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({
        pool: new Pool(poolConfig),
      }),
    });
  }
  const { Database } = await import("bun:sqlite");
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new BunSqliteDatabase(new Database(location)),
    }),
  });
};

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
};

export type Database = Kysely<DatabaseSchema>;
