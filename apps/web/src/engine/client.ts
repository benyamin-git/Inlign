import type { EngineRequest, EngineResponse, LineEvaluation, LineInput } from "./protocol.ts";

type EngineRequestPayload = { type: "version" } | { type: "evaluate"; lines: LineInput[] };

type EngineSuccessResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; type: "evaluate"; lines: LineEvaluation[] };

type PendingRequest = {
  resolve: (response: EngineSuccessResponse) => void;
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
    return this.#request({ type: "version" }).then((response) => {
      if (response.type !== "version") {
        throw new Error("Unexpected engine response");
      }
      return response.version;
    });
  }

  evaluate(lines: LineInput[]): Promise<LineEvaluation[]> {
    return this.#request({ type: "evaluate", lines }).then((response) => {
      if (response.type !== "evaluate") {
        throw new Error("Unexpected engine response");
      }
      return response.lines;
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

  #request(payload: EngineRequestPayload): Promise<EngineSuccessResponse> {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    const request: EngineRequest = { id, ...payload };

    return new Promise<EngineSuccessResponse>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker.postMessage(request);
    });
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

    pending.resolve(response);
  }
}
