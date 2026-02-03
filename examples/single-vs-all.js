import SearchMix from "../index.js";

async function main() {
  console.log("=== Comparación: Una Ocurrencia vs Todas ===\n");

  const searcher = new SearchMix({ dbPath: "./db/comparison.db" });

  // Crear documento de ejemplo con repeticiones
  const testDoc = Buffer.from(`
# JavaScript: El Lenguaje de la Web

JavaScript es el lenguaje de programación más usado en desarrollo web.

## Historia de JavaScript

JavaScript fue creado en 1995. Desde entonces, JavaScript ha evolucionado enormemente.

## Por qué usar JavaScript

1. JavaScript es versátil
2. JavaScript funciona en el navegador
3. JavaScript tiene un gran ecosistema

## JavaScript Moderno

Con ES6+, JavaScript añadió muchas funcionalidades. JavaScript ahora soporta:
- Clases
- Módulos
- Async/await

## Conclusión

JavaScript es fundamental para el desarrollo web moderno. Aprender JavaScript 
es esencial para cualquier desarrollador web. JavaScript no va a desaparecer pronto.
`);

  searcher.clear();
  await searcher.addDocument(testDoc, { collection: "tutorial" });

  console.log("📄 Documento indexado\n");
  console.log("=" .repeat(70));

  // OPCIÓN 1: Una sola ocurrencia por documento
  console.log("\n🔍 OPCIÓN 1: Una Ocurrencia por Documento\n");
  const single = searcher.search("JavaScript", { 
    allOccurrences: false,
    snippetLength: 100 
  });

  single.results.forEach(snippet => {
    console.log(`Documento: ${snippet.documentTitle}`);
    console.log(`Sección: ${snippet.section}`);
    console.log(`Snippet: "${snippet.text}"`);
  });

  console.log("\n" + "=".repeat(70));

  // OPCIÓN 2: Todas las ocurrencias (default)
  console.log("\n🔍 OPCIÓN 2: Todas las Ocurrencias (default)\n");
  const all = searcher.search("JavaScript", { 
    allOccurrences: true,
    maxOccurrences: 15,
    snippetLength: 80
  });

  console.log(`Documento: ${all.results[0]?.documentTitle || 'N/A'}`);
  console.log(`Total de ocurrencias: ${all.totalSnippets}\n`);
  
  all.results.forEach((snippet, i) => {
    console.log(`  ${i + 1}. [${snippet.section.padEnd(7)}] pos:${snippet.position.toString().padStart(4)} - "${snippet.text.slice(0, 70)}..."`);
  });

  console.log("\n" + "=".repeat(70));

  // OPCIÓN 3: Limitar a 5 ocurrencias
  console.log("\n🔍 OPCIÓN 3: Primeras 5 Ocurrencias\n");
  const limited = searcher.search("JavaScript", { 
    allOccurrences: true,
    maxOccurrences: 5
  });

  console.log(`Mostrando ${limited.totalSnippets} ocurrencias:\n`);
  limited.results.forEach((snippet, i) => {
    console.log(`${i + 1}. ${snippet.section}: "${snippet.text.slice(0, 60)}..."`);
  });

  console.log("\n" + "=".repeat(70));
  console.log("\n💡 TIP: Usa allOccurrences:true cuando necesites ver todas las menciones");
  console.log("   del término en el documento, no solo la primera.\n");

  searcher.close();
}

main().catch(console.error);
