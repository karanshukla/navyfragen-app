/* v8 ignore start */

// In-memory store for app-password agents created during E2E testing.
// Only populated when E2E_TESTING=true; always empty in production/unit tests.
import type { Agent, AtpAgent } from "@atproto/api";

// The E2E login route builds an AtpAgent (app-password auth), while the OAuth
// path produces an Agent. Both expose the same API surface the app calls
// (getProfile, post, com.atproto.repo.*, app.bsky.*), so the store accepts
// either and callers treat the result as an Agent-compatible client.
export type E2EAgent = Agent | AtpAgent;

interface E2EEntry {
  agent: E2EAgent;
  handle: string;
}

const store = new Map<string, E2EEntry>();

export function setE2EAgent(did: string, agent: E2EAgent, handle: string): void {
  store.set(did, { agent, handle });
}

export function getE2EAgent(did: string): E2EAgent | undefined {
  return store.get(did)?.agent;
}

export function getE2EHandle(did: string): string | undefined {
  return store.get(did)?.handle;
}

export function deleteE2EAgent(did: string): void {
  store.delete(did);
}

export function hasE2EAgent(did: string): boolean {
  return store.has(did);
}

/* v8 ignore stop */
