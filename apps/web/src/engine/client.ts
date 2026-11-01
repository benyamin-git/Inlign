import type { EngineRequest, EngineResponse } from "./protocol.ts";

type PendingRequest = {
  resolve: (version: string) => void;
  reject: (reason: Error) => void;
};

export class EngineClient {
  readonly #worker: Worker;
  readonly #pending = new Map<number, PendingRequest>();
  #nextRequestId = 0;

  constructor() {
    this.#worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.#worker.addEventListener("message", (event: MessageEvent<EngineResponse>) => {
      this.#settle(event.data);
    });
  }

  version(): Promise<string> {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    const request: EngineRequest = { id, type: "version" };

    return new Promise<string>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker.postMessage(request);
    });
  }

  dispose(): void {
    this.#worker.terminate();

    const error = new Error("EngineClient has been disposed");
    for (const { reject } of this.#pending.values()) {
      reject(error);
    }
    this.#pending.clear();
  }

  #settle(response: EngineResponse): void {
    const pending = this.#pending.get(response.id);
    if (!pending) {
      return;
    }
    this.#pending.delete(response.id);

    if ("error" in response) {
      pending.reject(new Error(response.error));
      return;
    }

    pending.resolve(response.version);
  }
}
