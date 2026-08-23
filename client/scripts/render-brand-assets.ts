// Renders public/sitemap.xml, public/client-metadata.json, and
// public/summary.html from the repo-root brand.json (and OAUTH_SCOPE from
// server/src/lib/contracts.ts, the frozen constant client-metadata.json's
// scope must match byte-for-byte). Committed like opengraph-service's
// generated brand.go — Tests.yml's client job reruns this script and fails on
// drift, so the Docker build never has to run it and never needs server/src
// in its build context.
//
// Run with `bun scripts/render-brand-assets.ts` from client/.
import brand from "../../brand.json";
import { OAUTH_SCOPE } from "../../server/src/lib/contracts";

const { appName, appDomain } = brand;
const origin = `https://${appDomain}`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>2025-05-30</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

const clientMetadataJson =
  JSON.stringify(
    {
      client_name: `${appName} App`,
      client_id: `${origin}/client-metadata.json`,
      client_uri: origin,
      redirect_uris: [`${origin}/api/oauth/callback`],
      scope: OAUTH_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
    },
    null,
    2,
  ) + "\n";

const summaryHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Summary</title>
  </head>

  <body>
    <h1>${appName} App Summary</h1>
    <p>This page provides a brief summary of the ${appName} application.</p>
    <p>${appName} is a platform for asking and answering questions on Bluesky.</p>
    <p>
      The application is built with a modern tech stack, featuring a React-based client and a
      Node.js/Express server.
    </p>
  </body>
</html>
`;

const publicDir = new URL("../public/", import.meta.url);
const sitemapPath = Bun.fileURLToPath(new URL("sitemap.xml", publicDir));
const clientMetadataPath = Bun.fileURLToPath(new URL("client-metadata.json", publicDir));
const summaryPath = Bun.fileURLToPath(new URL("summary.html", publicDir));

await Bun.write(sitemapPath, sitemapXml);
await Bun.write(clientMetadataPath, clientMetadataJson);
await Bun.write(summaryPath, summaryHtml);

// JSON.stringify always breaks arrays onto multiple lines; prettier collapses
// short ones back to the repo's house style, so run it rather than
// hand-formatting the template above.
await Bun.$`bunx --bun prettier --write ${clientMetadataPath}`.quiet();
