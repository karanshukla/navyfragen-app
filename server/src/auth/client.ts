import { NodeOAuthClient } from "@atproto/oauth-client-node";
import type { Database } from "#/database/db";
import { env } from "#/lib/env";
import { SessionStore, StateStore } from "./storage";

export const createClient = async (db: Database) => {
  const publicUrl = env.PUBLIC_URL;
  const url = publicUrl || `http://127.0.0.1:${env.PORT}`;
  // when behind a caddy reverse proxy, dont include /api in the client metadata
  const urlWithAPI = publicUrl ? `${url}/api` : url;
  const enc = encodeURIComponent;
  return new NodeOAuthClient({
    clientMetadata: {
      client_name: "Navyfragen App",
      client_id: publicUrl
        ? `${url}/client-metadata.json`
        : `http://localhost?redirect_uri=${enc(`${urlWithAPI}/oauth/callback`)}&scope=${enc("atproto transition:generic")}`,
      client_uri: url,
      redirect_uris: [`${urlWithAPI}/oauth/callback`],
      scope: "atproto transition:generic",
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
