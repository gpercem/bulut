import { beforeEach, describe, expect, it } from "vitest";
import {
  PAGE_CONTEXT_CACHE_KEY,
  PAGE_CONTEXT_CACHE_VERSION,
  buildPageContextSummary,
  clearPageContextCache,
  getCachedPageContexts,
} from "./context";

describe("buildPageContextSummary", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (_index: number) => null,
      get length() {
        return Object.keys(store).length;
      },
    } as Storage;

    Object.defineProperty(globalThis, "sessionStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
    clearPageContextCache();
  });

  it("includes all expected sections", () => {
    const summary = buildPageContextSummary(
      "https://example.com/products?page=2",
      "Example Products",
      "tr",
      ["- Urunler", "- One Cikanlar"],
      ["- Sepet -> https://example.com/cart"],
      ['- [1] Button: "Odeme Yap"', '- [2] Input: "ara" (text)'],
      ["- Haftanin en cok satilan urunlerini burada bulabilirsiniz."],
    );

    expect(summary).toContain("Page:");
    expect(summary).toContain("Headings:");
    expect(summary).toContain("Content Snippets:");
    expect(summary).toContain("Links:");
    expect(summary).toContain("Interactive Elements:");
  });

  it("shows 'none' for empty sections", () => {
    const summary = buildPageContextSummary(
      "https://example.com",
      "Example",
      "tr",
      [],
      [],
      [],
      [],
    );

    expect(summary).toContain("Headings:\n- none");
    expect(summary).toContain("Links:\n- none");
    expect(summary).toContain("Interactive Elements:\n- none");
  });

  it("restores page context entries from session storage cache", () => {
    const entries = [
      {
        url: "https://example.com/a",
        summary: "A summary",
        links: ["- A"],
        interactables: ["- button #a"],
        capturedAt: 123,
        version: PAGE_CONTEXT_CACHE_VERSION,
      },
    ];
    sessionStorage.setItem(PAGE_CONTEXT_CACHE_KEY, JSON.stringify(entries));

    const restored = getCachedPageContexts();
    expect(restored).toHaveLength(1);
    expect(restored[0].url).toBe("https://example.com/a");
  });

  it("ignores cache entries with incompatible version", () => {
    const entries = [
      {
        url: "https://example.com/a",
        summary: "A summary",
        links: [],
        interactables: [],
        capturedAt: 123,
        version: PAGE_CONTEXT_CACHE_VERSION + 1,
      },
    ];
    sessionStorage.setItem(PAGE_CONTEXT_CACHE_KEY, JSON.stringify(entries));

    expect(getCachedPageContexts()).toHaveLength(0);
  });
});
