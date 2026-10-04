// Tests for completion.mjs: the output cap and what counts as a page.
// Run:  node --test recipes/entity-wiki/test/*.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAX_TOKENS, maxTokensFromEnv, wikiFromCompletion } from "../completion.mjs";

const reply = (content, finish_reason) => ({ choices: [{ message: { content }, ...(finish_reason ? { finish_reason } : {}) }] });

test("the cap is 2048 unless OB_WIKI_MAX_TOKENS is set", () => {
  assert.equal(DEFAULT_MAX_TOKENS, 2048);
  assert.equal(maxTokensFromEnv({}), 2048);
  assert.equal(maxTokensFromEnv({ OB_WIKI_MAX_TOKENS: "" }), 2048);
  assert.equal(maxTokensFromEnv({ OB_WIKI_MAX_TOKENS: "  " }), 2048);
});

test("OB_WIKI_MAX_TOKENS sets the cap", () => {
  assert.equal(maxTokensFromEnv({ OB_WIKI_MAX_TOKENS: "4096" }), 4096);
  assert.equal(maxTokensFromEnv({ OB_WIKI_MAX_TOKENS: " 256 " }), 256);
});

test("a value that is not a whole number in range is an error, not a silent default", () => {
  for (const bad of ["0", "255", "32769", "-1", "4096.5", "lots", "4k"]) {
    assert.throws(() => maxTokensFromEnv({ OB_WIKI_MAX_TOKENS: bad }), /OB_WIKI_MAX_TOKENS must be/, bad);
  }
});

test("a whole reply is the page, trimmed", () => {
  assert.equal(wikiFromCompletion(reply("  # Page\n\n## Summary\nDone.\n", "stop"), 2048), "# Page\n\n## Summary\nDone.");
});

test("a reply with no finish_reason is taken at its word", () => {
  assert.equal(wikiFromCompletion(reply("# Page"), 2048), "# Page");
});

test("a reply cut at the cap is refused, and the error names the cap and the remedy", () => {
  assert.throws(
    () => wikiFromCompletion(reply("# Page\n\n## Open Questions\n- What is the", "length"), 2048),
    (err) => /2048-token cap/.test(err.message) && /NOT written/.test(err.message) && /OB_WIKI_MAX_TOKENS/.test(err.message),
  );
});

test("control: the same text that ended by itself is accepted", () => {
  assert.equal(wikiFromCompletion(reply("# Page\n\n## Open Questions\n- What is the", "stop"), 2048), "# Page\n\n## Open Questions\n- What is the");
});

test("an empty or missing reply is an error, as before", () => {
  for (const body of [reply(""), reply("   ", "stop"), {}, { choices: [] }, null]) {
    assert.throws(() => wikiFromCompletion(body, 2048), /empty wiki/);
  }
});
