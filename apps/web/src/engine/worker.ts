import type * as EngineModule from "@inlign/engine-wasm";

import type { EngineRequest, EngineResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

// The bundler build of the engine instantiates WASM while it is imported, so
// the import is deferred: the message listener below must exist synchronously,
// before the worker's event loop starts, or early requests are lost.
const engineReady: Promise<typeof EngineModule> = import("@inlign/engine-wasm");

async function respond(request: EngineRequest): Promise<EngineResponse> {
  const engine = await engineReady;

  if (request.type === "version") {
    return { id: request.id, type: "version", version: engine.version() };
  }

  return { id: request.id, error: `Unknown request type: ${String(request.type)}` };
}

self.addEventListener("message", (event: MessageEvent<EngineRequest>) => {
  const request = event.data;

  respond(request).then(
    (response) => {
      self.postMessage(response);
    },
    (error: unknown) => {
      const response: EngineResponse = {
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    },
  );
});
