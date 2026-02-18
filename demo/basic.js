/**
 * basic.js — Minimal search example.
 * Indexes a folder and prints the top snippets for a query.
 */
import SearchMix from "../index.js";

const searcher = new SearchMix();
await searcher.addDocument("./demo/books");

const { results, totalCount, totalSnippets } = searcher.search("mediterraneo", {
    limit: 1,
    limitSnippets: 10,
});

console.log(`Found ${totalCount} docs, ${totalSnippets} snippets\n`);

for (const [i, s] of results.entries()) {
    console.log(`[${i + 1}] ${s.documentTitle || s.documentPath}`);
    console.log(`    section : ${s.heading?.text ?? "(no heading)"}`);
    console.log(`    context : ${s.getText({ length: 200, offset: -80 }).replace(/\n/g, " ")}`);
}

console.log("Stats:", searcher.getStats());
searcher.close();
