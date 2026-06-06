import { NodeOAuthClient } from "@atproto/oauth-client-node";
import type { Database } from "#/database/db";
import { env } from "#/lib/env";
import { SessionStore, StateStore } from "./storage";

export const createClient = async (db: Database) => {
  const publicUrl = env.PUBLIC_URL;
  const url = publicUrl || `http://127.0.0.1:${env.PORT}`;

  // This is a particular workaround since the client can get finnicky with URLS
  // With the caddy proxy on prod you want the /api to be appended as thats what the frontend is sending
  // But in local dev we want to use the root URL

  const urlWithAPI = publicUrl ? `${url}/api` : url;
  const enc = encodeURIComponent;
  return new NodeOAuthClient({
    // Windows DNS often fails to resolve TXT records for custom handles (e.g. fragen.navy).
    // Fallback to public resolvers so local dev works the same as prod.
    fallbackNameservers: ["8.8.8.8", "1.1.1.1"],
    clientMetadata: {
      client_name: "Navyfragen App",
      client_id: publicUrl
        ? `${url}/client-metadata.json`
        : `http://localhost?redirect_uri=${enc(`${urlWithAPI}/oauth/callback`)}&scope=${enc("atproto repo:app.bsky.feed.post repo:app.navyfragen.message blob:image/* rpc:app.bsky.actor.getProfile?aud=* rpc:app.bsky.graph.getFollows?aud=*")}`,
      client_uri: url,
      redirect_uris: [`${urlWithAPI}/oauth/callback`],
      scope: "atproto repo:app.bsky.feed.post repo:app.navyfragen.message blob:image/* rpc:app.bsky.actor.getProfile?aud=* rpc:app.bsky.graph.getFollows?aud=*",
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
