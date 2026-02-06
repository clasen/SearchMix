import { SearchMix } from "../index.js";

console.log("=== Ejemplo: Indexar y buscar en archivos SRT ===\n");

(async () => {
  // Crear SearchMix instance
  const searchMix = new SearchMix({ dbPath: "./db/subtitles.db" });
  
  // Limpiar base de datos para empezar fresco
  searchMix.clear();

  // Indexar el archivo SRT
  console.log("📚 Indexando archivo SRT...");
  const srtPath = "./demo/srt/her2013.srt";
  await searchMix.addDocument(srtPath, { collection: "subtitles" });

  // Obtener estadísticas
  const stats = searchMix.getStats();
  console.log(`✓ Archivo indexado correctamente`);
  console.log(`  Documentos: ${stats.totalDocs}`);
  console.log(`  Colección: subtitles\n`);

  // Realizar búsquedas
  console.log("🔎 Búsquedas de ejemplo:\n");

  const searches = [
    { query: "amor", description: "Buscar 'amor'" },
    { query: "carta", description: "Buscar 'carta'" },
    { query: "Theodore", description: "Buscar 'Theodore'" },
    { query: "aniversario", description: "Buscar 'aniversario'" },
  ];

  for (const { query, description } of searches) {
    console.log(`📝 ${description}:`);
    const searchResults = searchMix.search(query, {
      limit: 3,
      limitSnippets: 1,
    });

    if (searchResults.results.length > 0) {
      console.log(
        `   ✓ Encontrado: ${searchResults.totalCount} resultado(s)`
      );
      searchResults.results.forEach((result, i) => {
        console.log(`   ${i + 1}. "${result.text.substring(0, 80)}..."`);
        if (result.heading) {
          console.log(`      Sección: ${result.heading.text}`);
        }
      });
    } else {
      console.log(`   ✗ No encontrado`);
    }
    console.log();
  }

  // Búsqueda más específica con contexto
  console.log("🎬 Búsqueda avanzada con contexto:\n");
  const advancedResults = searchMix.search("computadora", {
    limit: 5,
    limitSnippets: 5,
  });

  if (advancedResults.results.length > 0) {
    console.log(
      `Encontradas ${advancedResults.totalCount} menciones de "computadora":\n`
    );
    advancedResults.results.forEach((result, i) => {
      console.log(`${i + 1}. Escena: ${result.heading?.text || "N/A"}`);
      console.log(`   Snippet: "${result.text}"`);
      console.log();
    });
  } else {
    console.log("No se encontraron resultados para 'computadora'\n");
  }

  // Buscar por colección
  console.log("📂 Búsqueda filtrada por colección:\n");
  const collectionResults = searchMix.search("vida", {
    collection: "subtitles",
    limit: 2,
  });

  console.log(
    `Resultados en colección "subtitles": ${collectionResults.totalCount || 0}`
  );
  if (collectionResults.results.length > 0) {
    collectionResults.results.forEach((result, i) => {
      console.log(`${i + 1}. "${result.text.substring(0, 100)}..."`);
    });
  }

  searchMix.close();
  console.log("\n✅ Ejemplo completado!");
  console.log("📁 Base de datos guardada en: ./demo/subtitles.db");
})().catch((error) => {
  console.error("\n❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
