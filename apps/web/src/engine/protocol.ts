export type LineInput = { id: string; text: string };
export type Suggestion = { display: string; insert: string };
export type LineStatus = "ok" | "empty" | "incomplete" | "error" | "skipped";
export type LineEvaluation = {
  id: string;
  status: LineStatus;
  suggestion?: Suggestion;
  error?: string;
};

export type EngineRequest =
  { id: number; type: "version" } | { id: number; type: "evaluate"; lines: LineInput[] };

export type EngineResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; type: "evaluate"; lines: LineEvaluation[] }
  | { id: number; error: string };
