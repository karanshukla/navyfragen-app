# Navyfragen

> FOSS, AT Protocol-native anonymous Q&A. Receive questions anonymously and answer directly to your Bluesky feed.

<img width="1791" height="590" alt="Navyfragen lockup" src="https://github.com/user-attachments/assets/3ae9833a-6dbe-4b5b-bfca-b3f7455ad8bc" />

[![Tests](https://github.com/karanshukla/navyfragen-app/actions/workflows/Tests.yml/badge.svg)](https://github.com/karanshukla/navyfragen-app/actions/workflows/Tests.yml)
[![Coverage Status](https://coveralls.io/repos/github/karanshukla/navyfragen-app/badge.svg?branch=main)](https://coveralls.io/github/karanshukla/navyfragen-app?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-24-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![AT Protocol](https://img.shields.io/badge/AT%20Protocol-native-0085ff?logo=bluesky&logoColor=white)](https://atproto.com)

---

## Screenshots

<img width="983" height="734" alt="Inbox view" src="https://github.com/user-attachments/assets/ab0e4e7a-01d6-4f86-b2bc-15fc1983f431" />
<img width="995" height="749" alt="Answer view" src="https://github.com/user-attachments/assets/b3ff44d6-4f45-49b2-8ff5-ba0dbb49f81b" />
<img width="1004" height="755" alt="Image themes" src="https://github.com/user-attachments/assets/c44e65c6-ef56-4dfb-8818-28cc2451660f" />

---

## What It Does

Navyfragen lets Bluesky users receive anonymous questions via a public inbox link and post answers (optionally with a styled image card) directly to their Bluesky feed. Bluesky (AT Protocol) serves as both the identity provider (OAuth) and a secondary data store via PDS sync.

The companion [navyfragen-feed](https://github.com/karanshukla/navyfragen-feed) repo is a Bluesky custom feed generator that surfaces answered questions on the network.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Client** | React 19, Vite, TypeScript, Mantine UI v8, React Query v5, React Router v7 |
| **Server** | Bun.serve + Hono, TypeScript, Kysely ORM, AT Protocol SDK, Pino |
| **Database** | SQLite (development) · PostgreSQL (production) |
| **Auth** | AT Protocol OAuth (Bluesky as identity provider) |
| **Testing** | Vitest + Testing Library (client) · Node.js built-in test runner (server) |
| **Observability** | Pino structured logging, optional Axiom transport |

---

## Monorepo Structure

npm workspaces with two packages:

```
navyfragen-app/
├── client/        # React + Vite SPA
├── server/        # Bun.serve + Hono API
├── anubis/        # Anubis WAF config
├── caddy/         # Caddy reverse proxy config
└── docs/          # Developer notes
```

---

## Getting Started

### Prerequisites

- [Node.js 24+](https://nodejs.org)
- [Git](https://git-scm.com)
- [Bun](https://bun.sh) (package manager / installer — see [issue #250](https://github.com/karanshukla/navyfragen-app/issues/250))
- A modern web browser

> **Runtime note:** Bun is the *installer* and the **server runtime** (dev, production, and tests — #268/#288). Node remains the runtime for the client only (Vite dev/build, Vitest).

> **Windows users:** You may need the [C++ build tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required by `sharp`). WSL2 is recommended for the best experience. (`better-sqlite3` was removed in #288 when the Node code path was retired — SQLite now runs through `bun:sqlite`, which ships inside the Bun runtime and needs no native build.)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/karanshukla/navyfragen-app.git
   cd navyfragen-app
   ```

2. **Install all dependencies:**
   ```bash
   bun install
   ```

3. **Configure the server:**

   Copy the template and fill in your values:
   ```bash
   cp server/.env.template server/.env
   ```

   The only required secret with no default is `OAUTH_TOKEN_SECRET`, a 32-byte hex string used for AES-256 encryption:
   ```bash
   # Generate one with:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Start the development servers:**
   ```bash
   bun run dev
   ```

   This starts both the client (port `5173`) and the server (port `3000`) concurrently.

5. **Open the app:**

   Navigate to `http://localhost:5173`.

   > **Windows users:** Use `http://127.0.0.1:5173`. Cookies may not work correctly with `localhost` on Windows.

   > **Logging in fails?** See [Local Development: 127.0.0.1 vs localhost](#local-development-127001-vs-localhost) below — the AT Protocol OAuth flow requires `127.0.0.1`, not `localhost`, and this affects every platform, not just Windows.

---

## Image Generation

Responding to a message with an image card requires the in-house `html-to-image` service (located in `html-to-image/` at the repo root). It renders HTML in a headless Chromium browser and returns a screenshot.

`bun run dev` at the repo root starts it automatically alongside the client and server. To run it in isolation:

```bash
bun run --cwd html-to-image start
```

For Docker (e.g. in CI or the full stack), use:

```bash
bun run html-to-image
```

Set `EXPORT_HTML_URL=http://localhost:3033/` in `server/.env` (this is the default).

### Image Themes

Three themes are available when responding to a message:

| Theme | Description |
|---|---|
| `default` | NGL-style purple gradient card |
| `compressed` | Dark, compact card |
| `twitter` | X/Twitter-style post card |

Users set their preferred theme in Settings; it is stored per-user in the database.

---

## Infrastructure

### Anubis WAF (optional but recommended)

[Anubis](https://github.com/TecharoHQ/anubis) acts as a WAF to protect public-facing pages from DDoS and spam. Configuration is in [`/anubis`](anubis/).

Pair it with a [Caddy](https://caddyserver.com) reverse proxy (a sample config is in [`/caddy`](caddy/)). Route traffic as:

```
Internet → Caddy → Anubis → Vite/Client
                 → Server (API)
```

CloudFront can also be used in place of Caddy.

### Short Links

Users share a short link to their public inbox (e.g. `fragen.navy/user123` -> `navyfragen.app/profile/user123`). Any URL-prefix-preserving redirect service works, for example [`docker-redirector`](https://github.com/Intellection/docker-redirector).

Set the shortlink base URL in the frontend environment config.

---

## Development Notes

### Running Tests

```bash
# Client tests
cd client && bun run test

# Server tests
cd server && bun run test

# With coverage
cd client && bun run test:coverage
cd server && bun run test:coverage
```

Coverage target is **100%** across all v8 metrics (statements, lines, branches, functions).

### AT Protocol Lexicons

Custom lexicons live in `server/lexicons/`. Generated TypeScript types are in `server/src/lexicon/` (**do not edit them manually**). Regenerate with:

```bash
cd server && bun run lexgen
```

> **Windows users:** Run `lexgen` in WSL2. Running it natively on Windows may delete the generated files.

### Pre-commit Hook

The repo uses [Husky](https://typicode.github.io/husky/) to run checks automatically before every `git commit`. The hook runs on all platforms (macOS, Linux, Windows via Git Bash).

**What it does:**

| Step | Tool | Effect |
|---|---|---|
| Format staged files | Prettier | Auto-fixes formatting (quotes, indentation, trailing commas) |
| Lint staged files | ESLint | Auto-fixes import order, unused vars, etc. |
| Type check client | `tsc --noEmit` | Blocks commit if there are TypeScript errors |
| Type check server | `tsc --noEmit` | Blocks commit if there are TypeScript errors |

The hook is installed automatically when you run `bun install` (via the `prepare` script).

To skip it in an emergency:

```bash
git commit --no-verify -m "your message"
```

### Local Development: 127.0.0.1 vs localhost

AT Protocol's OAuth implementation follows [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) loopback rules: a local client's `redirect_uri` must use the IP literal `127.0.0.1`, not the hostname `localhost`. `server/src/auth/client.ts` already hardcodes the OAuth `redirect_uri` to `http://127.0.0.1:<PORT>` for local dev, so if the server itself is bound to `localhost` instead of `127.0.0.1`, the OAuth callback silently fails — `localhost` and `127.0.0.1` can resolve to different addresses (`::1` vs `127.0.0.1`), so the server ends up listening on one while the callback hits the other.

Cookies are also host-specific: a session cookie set for `127.0.0.1` will not be sent by the browser to `localhost`, even though both point at the same machine. So every layer needs to agree on `127.0.0.1`:

1. **`server/.env`:**
   ```bash
   HOST="127.0.0.1"
   CLIENT_URL="http://127.0.0.1:5173"
   ```
2. **`client/.env`** (create if it doesn't exist):
   ```bash
   VITE_API_URL=http://127.0.0.1:8080
   ```
3. **Browser:** open the app at `http://127.0.0.1:5173`, not `http://localhost:5173`.

This applies on every platform. Windows has an additional wrinkle on top: cookie `SameSite` handling differs between `127.0.0.1` and `localhost`, so Windows users should use `127.0.0.1` even when not debugging OAuth specifically.
