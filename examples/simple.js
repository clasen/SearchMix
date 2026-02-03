import SearchMix from "../index.js";

async function main() {
  console.log("=== Simple Example ===\n");

  const searcher = new SearchMix();

  // Add documents - await ensures EPUB/PDF conversions complete
  await searcher.addDocument("./examples/docs");

  // Search
  const results = searcher.search("Valdés");
  console.log("Search results:", JSON.stringify(results, null, 2));

  // Get stats
  const stats = searcher.getStats();
  console.log("\nStats:", stats);

  searcher.close();
  console.log("\n✓ Example completed successfully!");
}

main().catch(console.error);
