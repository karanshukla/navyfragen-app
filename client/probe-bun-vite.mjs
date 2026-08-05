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

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!process.versions.bun) {
  fail(`probe ran under Node ${process.version} — invoke it as \`bun --bun probe-bun-vite.mjs\``);
}

const server = await createServer({
  server: { host: "127.0.0.1", port: 5199, strictPort: false },
  logLevel: "warn",
});

let transformed;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.config.server.port}`;

  const html = await (await fetch(`${base}/`)).text();
  if (!html.includes('<script type="module"')) {
    fail(`dev server served no module script for /:\n${html.slice(0, 400)}`);
  }

  const res = await fetch(`${base}/src/pages/Login.tsx`);
  if (!res.ok) fail(`dev server returned ${res.status} for /src/pages/Login.tsx`);
  transformed = await res.text();

  // jsxDEV is what @vitejs/plugin-react's dev transform emits for JSX, so
  // finding it means the plugin pipeline ran — not merely that a file was
  // served back.
  if (!transformed.includes("jsxDEV")) {
    fail(`Login.tsx came back untransformed (no jsxDEV):\n${transformed.slice(0, 400)}`);
  }
} finally {
  await server.close();
}

console.log(
  `OK bun=${process.versions.bun} vite=${server.config.command} dev-transform=${transformed.length}B`
);
