import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { EngineClient } from "./client.ts";
import type { EngineRequest, EngineResponse } from "./protocol.ts";

class MockWorker {
  static instances: MockWorker[] = [];

  terminated = false;
  readonly #listeners: ((event: MessageEvent<EngineResponse>) => void)[] = [];
  #requestCount = 0;

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === "message") {
      this.#listeners.push(listener);
    }
  }

  postMessage(request: EngineRequest): void {
    this.#requestCount += 1;

    // Only the first request is answered so dispose() has a pending call to reject.
    if (this.#requestCount > 1) {
      return;
    }

    const response: EngineResponse = {
      id: request.id,
      type: "version",
      version: "0.1.0",
    };

    queueMicrotask(() => {
      for (const listener of this.#listeners) {
        listener(new MessageEvent("message", { data: response }));
      }
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("version resolves with the engine version", async () => {
  const client = new EngineClient();

  await expect(client.version()).resolves.toBe("0.1.0");

  client.dispose();
});

test("dispose rejects pending calls", async () => {
  const client = new EngineClient();

  await expect(client.version()).resolves.toBe("0.1.0");

  const pending = client.version();
  client.dispose();

  await expect(pending).rejects.toThrow("EngineClient has been disposed");
});
