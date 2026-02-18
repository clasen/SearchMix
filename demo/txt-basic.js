import { SearchMix } from "../index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Basic TXT file indexing and search example
 * 
 * This example demonstrates:
 * 1. Indexing plain text files
 * 2. Searching within TXT content
 * 3. Getting text file statistics
 */

async function main() {
  console.log("📝 TXT File Indexing Demo\n");

  // Initialize SearchMix
  const searchMix = new SearchMix({
    dbPath: "./db/txt-demo.db"
  });

  // Clear previous data
  searchMix.clear();

  // Example: Create a sample TXT file for testing
  const fs = await import("node:fs");
  const txtPath = path.join(__dirname, "sample-text.txt");
  
  const sampleContent = `Welcome to SearchMix

SearchMix is a lightning-fast full-text search engine that now supports plain text files!

Features:
- Full-text search with SQLite FTS5
- Support for Markdown, EPUB, PDF, SRT, and TXT files
- Accent-insensitive search
- BM25 ranking algorithm
- Fast and efficient indexing

Getting Started:
Simply add your text files to the index and start searching.
The library will automatically detect file encoding and handle the conversion.

Example Usage:
You can search for any word or phrase within your documents.
Results are ranked by relevance using the BM25 algorithm.

Conclusion:
SearchMix makes it easy to build powerful search functionality
for all your document types.`;

  fs.writeFileSync(txtPath, sampleContent, "utf-8");
  console.log("✓ Created sample text file\n");

  // Index the TXT file
  console.log("📁 Indexing TXT file...");
  await searchMix.addDocument(txtPath);
  console.log("✓ TXT file indexed\n");

  // Show statistics
  const stats = searchMix.getStats();
  console.log("📊 Index Statistics:");
  console.log(`   Total documents: ${stats.totalDocs}`);
  console.log(`   Collections: ${JSON.stringify(stats.collections)}\n`);

  // Search examples
  const searches = [
    "SearchMix",
    '"full-text search"',
    "BM25",
    "encoding"
  ];

  console.log("🔍 Search Examples:\n");

  for (const query of searches) {
    console.log(`Query: "${query}"`);
    const results = searchMix.search(query, {
      limit: 5,
      snippetLength: 100
    });

    console.log(`   Found ${results.totalSnippets} snippets in ${results.totalCount} documents`);
    
    if (results.results.length > 0) {
      results.results.slice(0, 2).forEach((snippet, i) => {
        console.log(`   ${i + 1}. ${snippet.text}`);
      });
    }
    console.log("");
  }

  // Get TXT file statistics
  const { getTXTStats } = await import("../lib/txt-to-markdown.js");
  const txtStats = getTXTStats(txtPath);
  
  console.log("📄 Text File Statistics:");
  console.log(`   Lines: ${txtStats.lines}`);
  console.log(`   Words: ${txtStats.words}`);
  console.log(`   Characters: ${txtStats.characters}`);
  console.log(`   Paragraphs: ${txtStats.paragraphs}\n`);

  // Cleanup
  fs.unlinkSync(txtPath);
  console.log("✓ Cleaned up sample file");

  // Close database
  searchMix.close();
}

main().catch(console.error);
