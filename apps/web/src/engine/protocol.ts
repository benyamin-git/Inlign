export type EngineRequest = { id: number; type: "version" };

export type EngineResponse =
  { id: number; type: "version"; version: string } | { id: number; error: string };
