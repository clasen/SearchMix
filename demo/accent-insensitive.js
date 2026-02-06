import { SearchMix } from "../index.js";

async function demo() {
  console.log("🔍 SearchMix - Búsqueda insensible a acentos y mayúsculas\n");

  // Create instance
  const searchmix = new SearchMix({
    dbPath: "./db/accent-test.db"
  });

  // Clear any existing data
  searchmix.clear();

  // Add test document with accented text
  const testDoc = `# Viajes por el Mediterráneo

## MEDITERRÁNEO I

El mar Mediterráneo es uno de los mares más importantes del mundo.

## Mediterráneo II

Las civilizaciones mediterráneas han influido en la historia.

## Visita a París

París es la capital de Francia.

## CIUDAD DE MÉXICO

La Ciudad de México es la capital de México.
`;

  await searchmix.addDocument(Buffer.from(testDoc), {
    collection: "test"
  });

  console.log("✅ Documento de prueba indexado\n");

  // Test 1: Search without accents for text with accents
  console.log("📝 Test 1: Buscar 'mediterraneo' (sin acento)");
  const results1 = searchmix.search("mediterraneo", { limit: 5 });
  console.log(`Documentos encontrados: ${results1.totalCount}`);
  console.log(`Snippets encontrados: ${results1.totalSnippets}`);
  results1.results.forEach((snippet, i) => {
    console.log(`\n${i + 1}. Rank: ${snippet.rank.toFixed(2)}`);
    console.log(`   Título: ${snippet.documentTitle}`);
    console.log(`   [${snippet.section}] ${snippet.text}`);
  });

  // Test 2: Search with accents
  console.log("\n📝 Test 2: Buscar 'MEDITERRÁNEO' (con acento y mayúsculas)");
  const results2 = searchmix.search("MEDITERRÁNEO", { limit: 5 });
  console.log(`Documentos encontrados: ${results2.totalCount}`);
  console.log(`Snippets encontrados: ${results2.totalSnippets}`);
  results2.results.forEach((snippet, i) => {
    console.log(`\n${i + 1}. Rank: ${snippet.rank.toFixed(2)}`);
    console.log(`   Título: ${snippet.documentTitle}`);
    console.log(`   [${snippet.section}] ${snippet.text}`);
  });

  // Test 3: Search for "paris" (lowercase) to find "París" (with accent and capital)
  console.log("\n📝 Test 3: Buscar 'paris' (sin acento, minúsculas)");
  const results3 = searchmix.search("paris", { limit: 5 });
  console.log(`Documentos encontrados: ${results3.totalCount}`);
  console.log(`Snippets encontrados: ${results3.totalSnippets}`);
  results3.results.forEach((snippet, i) => {
    console.log(`\n${i + 1}. Rank: ${snippet.rank.toFixed(2)}`);
    console.log(`   Título: ${snippet.documentTitle}`);
    console.log(`   [${snippet.section}] ${snippet.text}`);
  });

  // Test 4: Search for "mexico" to find "MÉXICO"
  console.log("\n📝 Test 4: Buscar 'mexico' (sin acento, minúsculas)");
  const results4 = searchmix.search("mexico", { limit: 5 });
  console.log(`Documentos encontrados: ${results4.totalCount}`);
  console.log(`Snippets encontrados: ${results4.totalSnippets}`);
  results4.results.forEach((snippet, i) => {
    console.log(`\n${i + 1}. Rank: ${snippet.rank.toFixed(2)}`);
    console.log(`   Título: ${snippet.documentTitle}`);
    console.log(`   [${snippet.section}] ${snippet.text}`);
  });

  // Test 5: Search only in headings
  console.log("\n📝 Test 5: Buscar 'mediterraneo' solo en headings");
  const results5 = searchmix.search("headings:mediterraneo", { limit: 5 });
  console.log(`Documentos encontrados: ${results5.totalCount}`);
  console.log(`Snippets encontrados: ${results5.totalSnippets}`);
  results5.results.forEach((snippet, i) => {
    console.log(`\n${i + 1}. Rank: ${snippet.rank.toFixed(2)}`);
    console.log(`   Título: ${snippet.documentTitle}`);
    console.log(`   [${snippet.section}] ${snippet.text}`);
  });

  // Close database
  searchmix.close();
  
  console.log("\n✅ Demo completada");
}

demo().catch(console.error);
