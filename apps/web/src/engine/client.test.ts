import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { EngineClient } from "./client.ts";
import type { EngineRequest, EngineResponse, LineEvaluation } from "./protocol.ts";

function defaultResponse(request: EngineRequest): EngineResponse {
  if (request.type === "version") {
    return { id: request.id, type: "version", version: "0.1.0" };
  }

  const lines: LineEvaluation[] = request.lines.map((line) => ({
    id: line.id,
    status: "ok",
  }));
  return { id: request.id, type: "evaluate", lines };
}

class MockWorker {
  static instances: MockWorker[] = [];
  static handler: ((request: EngineRequest) => EngineResponse | undefined) | null = null;

  terminated = false;
  readonly requests: EngineRequest[] = [];
  readonly #listeners: ((event: MessageEvent<EngineResponse>) => void)[] = [];

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === "message") {
      this.#listeners.push(listener);
    }
  }

  postMessage(request: EngineRequest): void {
    this.requests.push(request);
    const response =
      MockWorker.handler === null ? defaultResponse(request) : MockWorker.handler(request);
    if (!response) {
      return;
    }
    this.emit(response);
  }

  emit(response: EngineResponse): void {
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

function getWorker(): MockWorker {
  const instance = MockWorker.instances[0];
  if (!instance) {
    throw new Error("worker was not created");
  }
  return instance;
}

beforeEach(() => {
  MockWorker.instances = [];
  MockWorker.handler = null;
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

test("evaluate resolves with line evaluations", async () => {
  const client = new EngineClient();

  await expect(client.evaluate([{ id: "a", text: "x = 1" }])).resolves.toEqual([
    { id: "a", status: "ok" },
  ]);

  client.dispose();
});

test("an engine error response rejects the call", async () => {
  MockWorker.handler = (request) => ({ id: request.id, error: "engine failed" });
  const client = new EngineClient();

  await expect(client.version()).rejects.toThrow("engine failed");

  client.dispose();
});

test("dispose rejects pending version and evaluate calls", async () => {
  MockWorker.handler = () => undefined;
  const client = new EngineClient();

  const version = client.version();
  const evaluation = client.evaluate([{ id: "a", text: "x = 1" }]);
  client.dispose();

  await expect(version).rejects.toThrow("EngineClient has been disposed");
  await expect(evaluation).rejects.toThrow("EngineClient has been disposed");
  expect(getWorker().terminated).toBe(true);
});

test("a response for an unknown id is ignored", async () => {
  MockWorker.handler = () => undefined;
  const client = new EngineClient();
  const pending = client.version();

  const worker = getWorker();
  worker.emit({ id: 999, type: "version", version: "wrong" });
  worker.emit({ id: 0, type: "version", version: "0.1.0" });

  await expect(pending).resolves.toBe("0.1.0");

  client.dispose();
});

test("evaluate calls resolve independently", async () => {
  MockWorker.handler = () => undefined;
  const client = new EngineClient();

  const first = client.evaluate([{ id: "a", text: "x = 1" }]);
  const second = client.evaluate([{ id: "b", text: "y = 2" }]);

  const worker = getWorker();
  worker.emit({ id: 1, type: "evaluate", lines: [{ id: "b", status: "incomplete" }] });
  worker.emit({ id: 0, type: "evaluate", lines: [{ id: "a", status: "ok" }] });

  await expect(first).resolves.toEqual([{ id: "a", status: "ok" }]);
  await expect(second).resolves.toEqual([{ id: "b", status: "incomplete" }]);

  client.dispose();
});

test("request ids increase", async () => {
  const client = new EngineClient();

  await client.version();
  await client.evaluate([]);

  expect(getWorker().requests.map((request) => request.id)).toEqual([0, 1]);

  client.dispose();
});
