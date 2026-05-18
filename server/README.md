## Backend Server App for Navyfragen

The server handles the connection between the end user, their local DB, and their Bluesky data. Bluesky supports the OAuth2 flow for third party applications as found here: https://docs.bsky.app/docs/advanced-guides/oauth-client. The node package, @atproto/oauth-client-node handles of a lot of the implementatiation and can be found here: https://www.npmjs.com/package/@atproto/oauth-client-node

Essentially, Bluesky is acting as an identity provider (authentication) and secondary data store for Navyfragen. The server also posts to Bluesky directly and uploads their anonymous messages from the server to their PDS. While this is not a truly decentralized approach, there is no easy way to handle anonymous messaging in a protocol designed around account based communication. It would likely require building directly on top the AT Protocol rather than just utilising it. Originally, I planned on having a dummy account hold all the data in its PDS when a person sent a message, then have the server fetch it and deliver it to the end Bluesky user, however, I found this approach to be less secure than just having a central server. If you have any other ideas, please do open an issue!

## Architecture

Three-layer pattern: **routes → controllers → services**

- `src/routes/` — Express Router setup and validation middleware
- `src/controllers/` — Request/response handling and session checks
- `src/services/` — Business logic, database access, and AT Protocol calls

`AppContext` carries `db`, `logger`, `oauthClient`, and `resolver` and is passed through the entire stack.

## Database

Kysely ORM. SQLite in development (`:memory:` by default), PostgreSQL in production (when `POSTGRESQL_URL` is set). Schema and migrations live in `src/database/db.ts` — add new migrations as numbered keys and Kysely applies them at startup via `migrateToLatest()`.

Key tables: `message`, `user_profile`, `user_settings` (stores `imageTheme` per user), `auth_session`, `auth_state`.

## Session Management

Session management is kept intentionally thin on the server side for speed and simiplicitly. The app is constantly refreshing its session with the actual Bluesky OAuth service while the Navyfragen user is logged in, so if there are any issues, the app will log out the end user and trigger a reauthentication. In a sense, Bluesky itself is an authorization proxy. If your session is invalidated in Bluesky, its also invalidated in Navyfragen.

## AT Protocol / Lexicons

A custom lexicon `app.navyfragen.message` defines the record type for messages stored on the user's PDS. Generated TypeScript types live in `src/lexicon/` — do **not** edit these manually; regenerate with `npm run lexgen`. Avoid running `lexgen` on Windows as it can delete generated files; use WSL2.

The `#/` path alias maps to `src/` (configured in `tsconfig.json`).

## Testing

Tests use Node.js built-in `node:test` + `node:assert`. Test setup is via `src/tests/test-bootstrap.js` which sets dummy env vars. Mock the DB with chainable builder objects (see existing test files for the pattern).

```bash
npm run test        # single run
npm run test:watch  # watch mode
```

To run a single test file:
```bash
node --import ./src/tests/test-bootstrap.js --import tsx --test src/tests/message-service.test.ts
```
