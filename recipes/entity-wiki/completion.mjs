// Reply handling for generate-wiki.mjs, in its own module so it can be tested without running the CLI.
//
// Why it exists: the page was requested with a fixed max_tokens of 2048 and whatever came back was
// saved. A page with many citations (thought ids are UUIDs, twenty-odd tokens each) reaches that
// cap at under 5,000 characters; the reply then ends mid-section with finish_reason "length", and
// was written over the previous, whole page with nothing said. Two changes:
//   - the cap comes from OB_WIKI_MAX_TOKENS (default 2048: unchanged unless set);
//   - a reply that ended on the cap is refused, so the caller keeps the page it already had.

export const DEFAULT_MAX_TOKENS = 2048;
const MIN_MAX_TOKENS = 256;
const MAX_MAX_TOKENS = 32768;

export function maxTokensFromEnv(env = process.env) {
  const raw = env.OB_WIKI_MAX_TOKENS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_MAX_TOKENS;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < MIN_MAX_TOKENS || n > MAX_MAX_TOKENS) {
    throw new Error(
      `OB_WIKI_MAX_TOKENS must be a whole number from ${MIN_MAX_TOKENS} to ${MAX_MAX_TOKENS} (got: ${raw})`,
    );
  }
  return n;
}

// The page text from a chat-completions response body, or an Error:
//   - no text at all;
//   - finish_reason "length": the output hit the cap, so the text is a page cut short.
// A provider that reports no finish_reason is taken at its word (the text is returned).
export function wikiFromCompletion(body, maxTokens) {
  const choice = body?.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error("LLM returned empty wiki");
  if (choice?.finish_reason === "length") {
    throw new Error(
      `wiki output was cut at the ${maxTokens}-token cap (finish_reason=length); the page was NOT written. ` +
        "Raise OB_WIKI_MAX_TOKENS.",
    );
  }
  return text;
}
