import assert from "node:assert";
import { describe, it, beforeEach, mock } from "bun:test";

import { AtmosphereService, appLinksFor, appsPresentIn } from "../services/atmosphere-service";

const PUBLIC_PDS = "https://morel.us-east.host.bsky.network";
const TEST_DID = "did:plc:testrepo";

const mockLogger = { error: mock(), warn: mock(), info: mock(), debug: mock() };

/** A repo whose PDS answers `collections` and nothing else. */
function pdsServing(collections: string[]) {
  return mock(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ collections }),
  }));
}

function resolverPointingAt(pds: string | undefined) {
  return { did: { resolveAtprotoData: mock(async () => ({ pds })) } };
}

function serviceFor(pds: string | undefined, fetchImpl: unknown) {
  return new AtmosphereService(
    resolverPointingAt(pds),
    mockLogger as never,
    fetchImpl as typeof fetch
  );
}

describe("appsPresentIn", () => {
  it("omits a Bluesky-only client every account would match", () => {
    // Deer, Northsky and nine others declare `app.bsky.` and nothing else, so
    // matching on it would put the same row on every profile in the app.
    const apps = appsPresentIn(new Set(["app.bsky.actor.profile", "app.bsky.feed.post"]));

    assert.deepStrictEqual(apps, []);
  });

  it("finds an app that writes its own lexicon", () => {
    const apps = appsPresentIn(new Set(["app.bsky.feed.post", "sh.tangled.repo"]));

    assert.deepStrictEqual(apps, ["tangled"]);
  });

  it("counts five readers of one blog once", () => {
    // Leaflet, Offprint, Pckt, Standard Reader and Anisota Reader all render
    // the same `pub.leaflet.` records and all sit in the `standard-site` family.
    const apps = appsPresentIn(new Set(["pub.leaflet.document"]));

    assert.deepStrictEqual(apps, ["leaflet"]);
  });

  it("returns the catalog's own order for an account on several apps", () => {
    const apps = appsPresentIn(
      new Set(["sh.tangled.repo", "social.grain.photo", "pub.leaflet.document"])
    );

    assert.deepStrictEqual(apps, ["leaflet", "grain", "tangled"]);
  });

  it("finds nothing in an empty repo", () => {
    assert.deepStrictEqual(appsPresentIn(new Set()), []);
  });

  it("finds an app the Aturi catalog has never heard of", () => {
    // Rocksky writes app.rocksky.* and is in no catalog entry, so it only
    // appears through the supplementary table.
    const apps = appsPresentIn(new Set(["app.rocksky.scrobble"]));

    assert.deepStrictEqual(apps, ["rocksky"]);
  });
});

describe("appLinksFor", () => {
  const HANDLE = "alice.bsky.social";
  const DID = "did:plc:abc123";

  it("names and addresses a catalog app", () => {
    const links = appLinksFor(["tangled"], HANDLE, DID);

    assert.strictEqual(links[0].name, "Tangled");
    assert.ok(links[0].url.includes(HANDLE));
  });

  it("names and addresses an app from the supplementary table", () => {
    const links = appLinksFor(["rocksky"], HANDLE, DID);

    assert.deepStrictEqual(links, [
      { id: "rocksky", name: "Rocksky", url: `https://rocksky.app/profile/${HANDLE}` },
    ]);
  });

  it("keeps the order the repo scan produced", () => {
    const links = appLinksFor(["tangled", "rocksky"], HANDLE, DID);

    assert.deepStrictEqual(
      links.map((link) => link.id),
      ["tangled", "rocksky"]
    );
  });

  it("reaches an app that addresses a repo only by DID", () => {
    const links = appLinksFor(["grain"], HANDLE, DID);

    assert.ok(links[0].url.includes(DID));
  });

  it("drops an app that cannot address this account", () => {
    // Grain addresses a repo by DID alone, so without one there is nowhere to
    // send a reader and a mark linking nowhere is worse than no mark.
    assert.deepStrictEqual(appLinksFor(["grain"], HANDLE, undefined), []);
  });

  it("offers nothing at all for an account with no handle", () => {
    assert.deepStrictEqual(appLinksFor(["tangled"], undefined, DID), []);
  });
});

describe("AtmosphereService", () => {
  beforeEach(() => {
    mockLogger.warn.mockClear();
  });

  it("reports the apps its PDS says the repo writes", async () => {
    const service = serviceFor(PUBLIC_PDS, pdsServing(["sh.tangled.repo"]));

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), ["tangled"]);
  });

  it("asks the PDS once per repo, not once per profile view", async () => {
    const fetchImpl = pdsServing(["sh.tangled.repo"]);
    const service = serviceFor(PUBLIC_PDS, fetchImpl);

    await service.presenceFor(TEST_DID);
    await service.presenceFor(TEST_DID);

    assert.strictEqual(fetchImpl.mock.calls.length, 1);
  });

  it("answers with no apps rather than throwing when the PDS is unreachable", async () => {
    const service = serviceFor(
      PUBLIC_PDS,
      mock(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
  });

  it("stops asking an unreachable PDS on every view", async () => {
    const fetchImpl = mock(async () => {
      throw new Error("ECONNREFUSED");
    });
    const service = serviceFor(PUBLIC_PDS, fetchImpl);

    await service.presenceFor(TEST_DID);
    const afterFirst = fetchImpl.mock.calls.length;
    await service.presenceFor(TEST_DID);

    assert.strictEqual(fetchImpl.mock.calls.length, afterFirst);
  });

  it("answers with no apps when describeRepo refuses the request", async () => {
    const service = serviceFor(
      PUBLIC_PDS,
      mock(async () => ({ ok: false, status: 400, headers: { get: () => null } }))
    );

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
  });

  it("refuses to follow a redirect away from the PDS it validated", async () => {
    // A PDS on a public hostname passes isPublicPdsUrl and can then 302 the
    // request onto a private address, which is the whole check undone.
    const fetchImpl = mock(async (_url: string, _init?: RequestInit) => ({
      ok: false,
      status: 302,
      headers: { get: () => "http://169.254.169.254/latest/meta-data/" },
    }));
    const service = serviceFor(PUBLIC_PDS, fetchImpl);

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
    assert.strictEqual(fetchImpl.mock.calls[0]?.[1]?.redirect, "manual");
  });

  it("never dials a PDS that names a private address", async () => {
    const fetchImpl = pdsServing(["sh.tangled.repo"]);
    const service = serviceFor("https://navyfragen-server.railway.internal", fetchImpl);

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
    assert.strictEqual(fetchImpl.mock.calls.length, 0);
  });

  it("never dials anything for a DID document that names no PDS", async () => {
    const fetchImpl = pdsServing(["sh.tangled.repo"]);
    const service = serviceFor(undefined, fetchImpl);

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
    assert.strictEqual(fetchImpl.mock.calls.length, 0);
  });

  it("treats a describeRepo response with no collections as an empty repo", async () => {
    const service = serviceFor(
      PUBLIC_PDS,
      mock(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({}),
      }))
    );

    assert.deepStrictEqual(await service.presenceFor(TEST_DID), []);
  });

  it("asks the repo's own PDS for the repo", async () => {
    const fetchImpl = pdsServing([]);
    const service = serviceFor(`${PUBLIC_PDS}/`, fetchImpl);

    await service.presenceFor(TEST_DID);

    assert.strictEqual(
      fetchImpl.mock.calls[0]?.[0],
      `${PUBLIC_PDS}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(TEST_DID)}`
    );
  });
});
