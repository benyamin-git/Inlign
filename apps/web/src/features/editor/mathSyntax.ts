/**
 * Basic math tokens for card highlighting. Presentation only: nothing here
 * parses, evaluates or crosses into the engine.
 */
export type MathToken = {
  type: "number" | "operator" | "call" | "text";
  text: string;
};

const TOKEN =
  /(\d+(?:\.\d+)?|\.\d+)|([+−*/×÷·^%=<>≤≥≠≈±()[\]{},-])|(\p{L}[\p{L}\p{N}_]*)|(\s+)|([\s\S])/gu;

/** Splits a line into number, operator, call and plain-text runs. */
export function highlightMath(text: string): MathToken[] {
  const tokens: MathToken[] = [];

  for (const match of text.matchAll(TOKEN)) {
    const [raw = "", number, operator, word] = match;
    const rest = text.slice(match.index + raw.length);
    const type: MathToken["type"] =
      number !== undefined
        ? "number"
        : operator !== undefined
          ? "operator"
          : word !== undefined && /^\s*\(/.test(rest)
            ? "call"
            : "text";
    const last = tokens[tokens.length - 1];

    if (type === "text" && last?.type === "text") {
      last.text += raw;
    } else {
      tokens.push({ type, text: raw });
    }
  }

  return tokens;
}
