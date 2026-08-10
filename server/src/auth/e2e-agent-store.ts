/* v8 ignore start */

// Only populated when E2E_TESTING=true; always empty in production.
import type { Agent, AtpAgent } from "@atproto/api";

// App-password login yields an AtpAgent, OAuth an Agent; both expose the API
// surface this app calls, so callers treat either as an Agent-compatible client.
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
