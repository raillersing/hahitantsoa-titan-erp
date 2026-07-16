import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

if (typeof window !== "undefined" && window.localStorage === undefined) {
  const store = new Map<string, string>();
  window.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length(): number { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  } as unknown as Storage;
}

beforeEach(() => {
  // The real session bootstrap sets this cookie before any unsafe request.
  document.cookie = "csrftoken=test-csrf-token; path=/";
});

afterEach(() => {
  cleanup();
});
