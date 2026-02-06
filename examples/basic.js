import SearchMix from "../index.js";

console.log("=== Example 1: Basic Usage - Full Content ===\n");

const searcher1 = new SearchMix();

// Add documents - await ensures EPUB/PDF conversions complete
await searcher1.addDocument("./examples/docs");

// Search - returns a flat list of snippets
const results1 = searcher1.search("plato volador", {
    limit: 1,
    limitSnippets: 1,
    snippetLength: 500  // Much larger context to show full stories
});

console.log("Search results:");
console.log(`Total documents found: ${results1.totalCount}`);
console.log(`Total snippets: ${results1.totalSnippets}\n`);

results1.results.forEach((snippet, index) => {

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📄 Snippet ${index + 1}`);
    console.log(`   Document: ${snippet.documentPath}`);
    console.log(`   Title: ${snippet.documentTitle || 'N/A'}`);
    console.log(`   Tags: ${snippet.tags}`);
    console.log(`   Rank: ${snippet.rank}`);
    console.log(`${"=".repeat(80)}\n`);

    const text = snippet.getText({ length: 10000 });
    console.log('---------', text);
    
    // Show section information
    if (snippet.heading) {
        console.log(`\n📍 Section: ${snippet.heading.text}`);
        console.log(`   Type: ${snippet.heading.type}`);
        console.log(`   Level: ${snippet.heading.depth || 'N/A'}`);
    }

    // Show full breadcrumbs path
    if (snippet.sectionId) {
        const breadcrumbs = snippet.getBreadcrumbsText();
        if (breadcrumbs) {
            console.log(`\n🗂️  Path: ${breadcrumbs}`);
        }
    }

    // Show the snippet text with more context
    console.log(`\n📝 Context around match:`);
    console.log(`${"-".repeat(80)}`);
    console.log(snippet.text);
    console.log(`${"-".repeat(80)}`);

    // Try to get full section content
    if (snippet.hasContent()) {
        console.log(`\n📄 Full Section Content (${snippet.contentCount} blocks):`);
        console.log(`${"═".repeat(80)}`);

        const content = snippet.getContent();
        content.forEach((block, blockIndex) => {
            console.log(`\n[Block ${blockIndex + 1} - ${block.type}]`);
            console.log(block.text);
        });
        console.log(`\n${"═".repeat(80)}`);
    } else {
        // If no structured content, try to get details
        const details = snippet.getDetails();
        if (details && details.content && details.content.length > 0) {
            console.log(`\n📄 Section Details:`);
            console.log(`${"═".repeat(80)}`);
            details.content.forEach((block, blockIndex) => {
                console.log(`\n[${block.type}]`);
                console.log(block.text);
            });
            console.log(`\n${"═".repeat(80)}`);
        }
    }

    // Show navigation options
    console.log(`\n🧭 Navigation:`);
    if (snippet.hasParent()) {
        const parent = snippet.getParent();
        console.log(`   ⬆️  Parent: ${parent.text}`);
    }

    if (snippet.hasChildren()) {
        const children = snippet.getChildren();
        console.log(`   ⬇️  Children: ${children.length}`);
        children.forEach((child, i) => {
            console.log(`      ${i + 1}. ${child.text}`);
        });
    }

    const siblings = snippet.getSiblings();
    if (siblings.length > 0) {
        console.log(`   ↔️  Siblings: ${siblings.length}`);
        siblings.forEach((sibling, i) => {
            console.log(`      ${i + 1}. ${sibling.text}`);
        });
    }

    console.log(`\n${"=".repeat(80)}\n`);
});

// Get stats
const stats1 = searcher1.getStats();
console.log("\n📊 Stats:", stats1);

searcher1.close();

