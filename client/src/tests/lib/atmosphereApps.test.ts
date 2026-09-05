import { describe, it, expect } from "vitest";

import { withMarks, type AtmosphereAppLink } from "../../lib/atmosphereApps";

const TANGLED: AtmosphereAppLink = {
  id: "tangled",
  name: "Tangled",
  url: "https://tangled.org/alice.bsky.social",
};

const ROCKSKY: AtmosphereAppLink = {
  id: "rocksky",
  name: "Rocksky",
  url: "https://rocksky.app/profile/alice.bsky.social",
};

describe("withMarks", () => {
  it("attaches the catalog's brand mark to an app it carries", () => {
    expect(withMarks([TANGLED])[0].icon).toBeTruthy();
  });

  it("keeps an app the catalog omits, with no mark of its own", () => {
    // Rocksky reaches the page from the server's supplementary table, so the
    // catalog has no icon for it and the component supplies a neutral one.
    const [app] = withMarks([ROCKSKY]);

    expect(app.icon).toBeNull();
    expect(app.name).toBe("Rocksky");
  });

  it("passes each app's name and destination through untouched", () => {
    expect(withMarks([ROCKSKY])[0]).toMatchObject(ROCKSKY);
  });

  it("keeps the order the server sent", () => {
    expect(withMarks([TANGLED, ROCKSKY]).map((app) => app.id)).toEqual(["tangled", "rocksky"]);
  });

  it("offers nothing for an account on no other apps", () => {
    expect(withMarks([])).toEqual([]);
  });
});
