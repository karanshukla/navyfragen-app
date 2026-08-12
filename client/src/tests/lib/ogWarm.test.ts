import { afterEach, describe, expect, it, vi } from "vitest";

import { warmOgCard } from "../../lib/ogWarm";

describe("warmOgCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks this origin's OG service to render the shared profile", () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);

    warmOgCard("karan.bsky.social");

    expect(fetchSpy).toHaveBeenCalledWith("/og-warm/karan.bsky.social", { method: "POST" });
  });

  it("escapes a handle rather than letting it shape the path", () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);

    warmOgCard("a/b?c");

    expect(fetchSpy).toHaveBeenCalledWith("/og-warm/a%2Fb%3Fc", { method: "POST" });
  });

  it("sends nothing when there is no handle to warm", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    warmOgCard("");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("swallows a failed warm — in development nothing proxies this origin", async () => {
    const rejection = Promise.reject(new Error("404"));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => rejection)
    );

    expect(() => warmOgCard("karan.bsky.social")).not.toThrow();
    await expect(rejection.catch(() => "handled")).resolves.toBe("handled");
  });
});
