/* v8 ignore start */

// In-memory store for app-password agents created during E2E testing.
// Only populated when E2E_TESTING=true; always empty in production/unit tests.
import type { Agent } from "@atproto/api";

interface E2EEntry {
  agent: Agent;
  handle: string;
}

const store = new Map<string, E2EEntry>();

export function setE2EAgent(did: string, agent: Agent, handle: string): void {
  store.set(did, { agent, handle });
}

export function getE2EAgent(did: string): Agent | undefined {
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
