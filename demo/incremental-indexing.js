import SearchMix from "../index.js";
import fs from "node:fs";

async function main() {
  console.log("=== Incremental Indexing Example (Now Automatic!) ===\n");

  const searcher = new SearchMix({ dbPath: "./db/incremental.db" });

  // Check what's already indexed
  const initialStats = searcher.getStats();
  console.log("Initial state:", initialStats);

  // First run: indexes all documents
  console.log("\n📚 First indexing...");
  const start1 = Date.now();
  await searcher.addDocument("./README.md");
  const elapsed1 = Date.now() - start1;
  
  const buffer = Buffer.from(`
# New Note

This is a quick note added on ${new Date().toISOString()}.

Testing incremental indexing with automatic change detection.
`);
  await searcher.addDocument(buffer);
  
  let stats = searcher.getStats();
  console.log(`✓ Indexed ${stats.totalDocs} documents in ${elapsed1}ms`);

  // Second run: automatically skips unchanged files (very fast!)
  console.log("\n🔍 Second indexing (should be fast - no changes)...");
  const start2 = Date.now();
  await searcher.addDocument("./README.md");
  const elapsed2 = Date.now() - start2;
  
  stats = searcher.getStats();
  console.log(`✓ Verified ${stats.totalDocs} documents in ${elapsed2}ms`);
  console.log(`⚡ ${Math.round((1 - elapsed2/elapsed1) * 100)}% faster!\n`);

  // Check if a specific document exists
  const docPath = "./README.md";
  if (searcher.hasDocument(docPath)) {
    console.log(`✓ Document exists: ${docPath}`);
  }

  // Simulate modifying a file
  const testFile = "./test-incremental.md";
  const testContent = `# Test Incremental

This file was created at ${new Date().toISOString()}.

Testing automatic change detection.
`;
  
  if (!fs.existsSync(testFile)) {
    console.log(`\n➕ Creating new test file: ${testFile}`);
    fs.writeFileSync(testFile, testContent);
    
    await searcher.addDocument(testFile);
    console.log(`✓ New file indexed automatically`);
    
    // Wait a bit to ensure different mtime
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Modify the file
    console.log(`\n✏️  Modifying ${testFile}...`);
    const modifiedContent = testContent + `\n## New Section\n\nAdded at ${new Date().toISOString()}\n`;
    fs.writeFileSync(testFile, modifiedContent);
    
    // Reindex - will detect the change automatically
    console.log(`🔄 Reindexing - change will be detected automatically...`);
    await searcher.addDocument(testFile);
    
    // Verify the change was indexed
    const results = searcher.search("New Section");
    console.log(`✓ Modified file reindexed automatically`);
    console.log(`✓ Search "New Section": ${results.totalCount} result(s) found\n`);
    
    // Clean up
    fs.unlinkSync(testFile);
    searcher.removeDocument(testFile);
    console.log(`🧹 Test file removed`);
  }

  // Final stats
  const finalStats = searcher.getStats();
  console.log("\n📊 Final state:", finalStats);

  // Search
  console.log("\n=== Search Results ===\n");
  const results = searcher.search("indexing OR searchmix", { limit: 5 });
  console.log(`Found ${results.totalCount} results:\n`);

  results.results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    if (r.snippets && r.snippets[0]) {
      console.log(`   ${r.snippets[0].section}: "${r.snippets[0].text.slice(0, 80)}..."`);
    }
  });

  searcher.close();
  console.log("\n✅ Done! Run again to see how fast it is when files haven't changed.");
}

main().catch(console.error);
