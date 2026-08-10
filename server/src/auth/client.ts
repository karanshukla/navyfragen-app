import { NodeOAuthClient } from "@atproto/oauth-client-node";

import { SessionStore, StateStore } from "./storage";

import type { Database } from "#/database/db";

import { env } from "#/lib/env";

const OAUTH_SCOPE =
  "atproto repo:app.bsky.feed.post repo:app.navyfragen.message blob:image/* rpc:app.bsky.actor.getProfile?aud=* rpc:app.bsky.graph.getFollows?aud=*";

export const createClient = async (db: Database) => {
  const publicUrl = env.PUBLIC_URL;
  const url = publicUrl || `http://127.0.0.1:${env.PORT}`;

  // In production the frontend addresses the API behind Caddy at /api, so the
  // redirect URI must carry that prefix; local dev is served from the root.
  const urlWithAPI = publicUrl ? `${url}/api` : url;
  const enc = encodeURIComponent;
  return new NodeOAuthClient({
    // Windows DNS often fails to resolve TXT records for custom handles.
    fallbackNameservers: ["8.8.8.8", "1.1.1.1"],
    clientMetadata: {
      client_name: "Navyfragen App",
      client_id: publicUrl
        ? `${url}/client-metadata.json`
        : `http://localhost?redirect_uri=${enc(`${urlWithAPI}/oauth/callback`)}&scope=${enc(OAUTH_SCOPE)}`,
      client_uri: url,
      redirect_uris: [`${urlWithAPI}/oauth/callback`],
      scope: OAUTH_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
    },
    stateStore: new StateStore(db),
    sessionStore: new SessionStore(db),
  });
};
