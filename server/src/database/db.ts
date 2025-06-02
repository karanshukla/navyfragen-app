import SqliteDb from "better-sqlite3";
import {
  Kysely,
  Migrator,
  SqliteDialect,
  Migration,
  MigrationProvider,
  PostgresDialect, // Add PostgresDialect import
} from "kysely";
import { Pool } from "pg"; // Add pg Pool import
import { env } from "#/lib/env"; // Import env

// Types

export type DatabaseSchema = {
  status: Status;
  auth_session: AuthSession;
  auth_state: AuthState;
  message: Message; // Add message table
  user_profile: UserProfile; // Add user_profile table
  sessions: Sessions; // Express session storage
};

// Unused, to remove later
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
  tid: string; // AT Protocol TID (record key)
  message: string;
  createdAt: string;
  recipient: string; // Add recipient field for filtering
};

export type UserProfile = {
  did: string; // User's Decentralized Identifier
  createdAt: string; // Timestamp of when the user was first created
};

//Unused, to remove later
export type Sessions = {
  sid: string; // Session ID
  sess: string; // Session data (JSON)
  expire: string; // Expiration timestamp
};

type AuthStateJson = string;

type AuthSessionJson = string;

// Migrations

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
      .addColumn("recipient", "varchar", (col) => col.notNull()) // Add recipient column
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

export const createDb = (location: string): Database => {
  if (env.NODE_ENV === "production" && env.POSTGRESQL_URL) {
    return new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: env.POSTGRESQL_URL,
        }),
      }),
    });
  }
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(location),
    }),
  });
};

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
};

export type Database = Kysely<DatabaseSchema>;
