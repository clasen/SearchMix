/**
 * get-text.js — Two modes of getText().
 *
 * Section mode  getText()                     → full section (heading + content blocks)
 * Range mode    getText({ length, offset })   → raw body slice around the match position
 */
import SearchMix from "../index.js";

const searcher = new SearchMix();
await searcher.addDocument("./demo/books");

const { results } = searcher.search("mediterraneo", { limit: 1, limitSnippets: 1 });

const snippet = results[0];
if (!snippet) {
    console.log("No results.");
    searcher.close();
    process.exit(0);
}

console.log("Document :", snippet.documentTitle || snippet.documentPath);
console.log("Section  :", snippet.heading?.text ?? "(body)");
console.log("Position :", snippet.position, "\n");

// ── Section mode (default) ────────────────────────────────────────────────────
// Returns the full content of the section the snippet belongs to,
// rendered as markdown (heading + paragraphs/lists/code blocks).
// Ignores length/offset — always the whole section.
console.log("=== Section mode: getText() ===\n");
console.log(snippet.getText());

// ── Range mode ────────────────────────────────────────────────────────────────
// Extracts a fixed-length window from the raw body around the match position.
// offset shifts the start: negative = go back, positive = go forward.
// Always honours length and offset regardless of document structure.
console.log("\n=== Range mode: getText({ length: 600, offset: -200 }) ===\n");
console.log(snippet.getText({ length: 600, offset: -200 }));

console.log("\n=== Range mode: getText({ length: 300, offset: 0 }) ===\n");
console.log(snippet.getText({ length: 300, offset: 0 }));

searcher.close();
