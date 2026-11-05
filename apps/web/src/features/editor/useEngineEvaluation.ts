import { useEffect, useRef, useState } from "react";

import type { Line } from "../../data/models.ts";
import type { LineEvaluation, LineInput } from "../../engine/protocol.ts";

export const ENGINE_DEBOUNCE_MS = 120;

export type EngineEvaluator = {
  evaluate(lines: LineInput[]): Promise<LineEvaluation[]>;
};

export type LineAnnotations = Map<string, LineEvaluation>;

export function useEngineEvaluation(
  engine: EngineEvaluator | null,
  lines: Line[],
  ignoreCase = false,
): LineAnnotations {
  const [annotations, setAnnotations] = useState<LineAnnotations>(() => new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (engine === null) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    // The engine stays case-sensitive; this notebook-wide option folds names
    // at the boundary so the editor keeps the user's original spelling.
    const input = lines.map(({ id, text }) => ({
      id,
      text: ignoreCase ? text.toLowerCase() : text,
    }));
    const timer = window.setTimeout(() => {
      void engine.evaluate(input).then(
        (results) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setAnnotations(new Map(results.map((result) => [result.id, result])));
        },
        () => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setAnnotations(new Map());
        },
      );
    }, ENGINE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [engine, ignoreCase, lines]);

  return engine === null ? new Map<string, LineEvaluation>() : annotations;
}
