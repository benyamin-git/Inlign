import { afterEach, describe, expect, it, vi } from "vitest";

import { createId } from "./id.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createId", () => {
  it("uses native randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "123e4567-e89b-42d3-a456-426614174000",
    });

    expect(createId()).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = index;
        }

        return bytes;
      },
    });

    expect(createId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});
