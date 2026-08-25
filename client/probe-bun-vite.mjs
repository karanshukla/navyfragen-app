// Bun-runtime canary for the client — gates the client-bun-runtime CI job.
//
// `bun run <script>` hands a node-shebang binary (vite, vitest, tsc) to Node
// whenever Node is on PATH, so a local `bun run build` proves nothing about
// the runtime the production image uses: docker/Dockerfile.client is FROM
// oven/bun, which ships no Node, so Vite there has always run under Bun by
// omission. This probe pins down the two things that implicit path rests on:
//
//   1. The runtime really is Bun — a silent Node fallback would make the rest
//      of this file, and the CI job it gates, vacuous.
//   2. The dev server boots and transforms TSX through @vitejs/plugin-react.
//      That is the one Vite surface neither the Docker build (`vite build`)
//      nor the vitest suite (its own module runner) exercises.
//
// Not shipped in any image and not part of the vitest suite — this file exists
// solely for the CI probe. Run it with `bun run probe:bun`.
import { createServer } from "vite";

// Below the 120s the CI step allows, so a stall is reported by the phase that
// stalled rather than as an unattributed step timeout.
const DEADLINE_MS = 60_000;

let phase = "startup";
const timings = [];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

// Unref'd on purpose: it must never be the reason the process stays alive,
// only the thing that reports one. A hung phase keeps the loop alive, so this
// still fires; a clean run exits before it does.
const watchdog = setTimeout(() => {
  console.error(`FAIL probe stalled in phase '${phase}' after ${DEADLINE_MS}ms`);
  process.exit(1);
}, DEADLINE_MS);
watchdog.unref?.();

async function step(name, run) {
  phase = name;
  const started = performance.now();
  const result = await run();
  timings.push(`${name}=${Math.round(performance.now() - started)}ms`);
  return result;
}

if (!process.versions.bun) {
  fail(`probe ran under Node ${process.version} — invoke it as \`bun --bun probe-bun-vite.mjs\``);
}

const server = await step("create", () =>
  createServer({
    server: { host: "127.0.0.1", port: 5199, strictPort: false },
    logLevel: "warn",
  })
);

await step("listen", () => server.listen());

const base = `http://127.0.0.1:${server.config.server.port}`;

// `Connection: close` so neither request leaves a pooled keep-alive socket
// behind: Vite's close waits for open connections to drain.
const get = (path) => fetch(`${base}${path}`, { headers: { Connection: "close" } });

const html = await step("fetch-index", async () => (await get("/")).text());
if (!html.includes('<script type="module"')) {
  fail(`dev server served no module script for /:\n${html.slice(0, 400)}`);
}

const transformed = await step("fetch-tsx", async () => {
  const res = await get("/src/pages/Login.tsx");
  if (!res.ok) fail(`dev server returned ${res.status} for /src/pages/Login.tsx`);
  return res.text();
});

// jsxDEV is what @vitejs/plugin-react's dev transform emits for JSX, so
// finding it means the plugin pipeline ran — not merely that a file was
// served back.
if (!transformed.includes("jsxDEV")) {
  fail(`Login.tsx came back untransformed (no jsxDEV):\n${transformed.slice(0, 400)}`);
}

clearTimeout(watchdog);

// Bun buffers stdout when it is not a TTY, which it never is under Actions,
// and the CI step greps this line. Awaiting the write rather than trusting
// console.log to flush is what makes the process.exit below safe.
await Bun.write(
  Bun.stdout,
  `OK bun=${process.versions.bun} vite=${server.config.command} ` +
    `dev-transform=${transformed.length}B ${timings.join(" ")}\n`
);

// The probe deliberately never calls server.close(). Under Bun on the CI
// runner that call does not resolve — #423's watchdog caught it as
// `stalled in phase 'close'` after every assertion had already passed, on a
// run whose only change was unrelated — and closeAllConnections() plus
// `Connection: close` on both fetches did not change that. Closing is not part
// of what this probe asserts either: it exists to prove the runtime is Bun and
// that the dev server transforms TSX, and `bun run dev` is likewise never
// closed, only interrupted. So the process exits once there is nothing left to
// check, and the OS reclaims the socket.
process.exit(0);
