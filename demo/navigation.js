/**
 * navigation.js — Snippet navigation: parent, children, siblings, breadcrumbs.
 *
 * Each snippet returned by search() knows where it sits in the document
 * structure and lets you walk up/down/sideways without extra queries.
 */
import SearchMix from "../index.js";

const searcher = new SearchMix();
await searcher.addDocument("./demo/books");

const { results } = searcher.search("mediterraneo", { limit: 1, limitSnippets: 5 });

// Pick the first snippet that has heading information (i.e. lives inside a section)
const snippet = results.find(s => s.heading) ?? results[0];

if (!snippet) {
    console.log("No results.");
    searcher.close();
    process.exit(0);
}

// ── Basic info ────────────────────────────────────────────────────────────────
console.log("Document :", snippet.documentTitle || snippet.documentPath);
console.log("Section  :", snippet.heading?.text ?? "(body)");
console.log("Type     :", snippet.heading?.type ?? "–");
console.log("Level    :", snippet.heading?.depth ?? "–");

// ── Breadcrumbs ───────────────────────────────────────────────────────────────
const crumbs = snippet.getBreadcrumbsText();
if (crumbs) console.log("\nBreadcrumbs:", crumbs);

// ── Parent ────────────────────────────────────────────────────────────────────
if (snippet.hasParent()) {
    const parent = snippet.getParent();
    console.log("\nParent:", parent.text);
}

// ── Children ──────────────────────────────────────────────────────────────────
if (snippet.hasChildren()) {
    const children = snippet.getChildren();
    console.log(`\nChildren (${children.length}):`);
    children.forEach((c, i) => console.log(`  ${i + 1}. ${c.text}`));
}

// ── Siblings ──────────────────────────────────────────────────────────────────
const siblings = snippet.getSiblings();
if (siblings.length) {
    console.log(`\nSiblings (${siblings.length}):`);
    siblings.forEach((s, i) => console.log(`  ${i + 1}. ${s.text}`));
}

// ── Ancestor at a specific heading level ──────────────────────────────────────
const h1 = snippet.getAncestorAtDepth(1);
if (h1) console.log("\nH1 ancestor:", h1.text);

searcher.close();
