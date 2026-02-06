import SearchMix from "../index.js";

async function main() {
  console.log("=== Demo de Snippets ===\n");

  const searcher = new SearchMix({ dbPath: "./db/snippets-demo.db" });

  // Agregar algunos documentos de ejemplo
  console.log("Preparando documentos...\n");

  await searcher.addDocument(Buffer.from(`
# Guía de SQLite

SQLite es una base de datos embebida muy popular.

## Full-Text Search

SQLite incluye la extensión FTS5 que permite hacer búsquedas de texto completo. 
Esta extensión usa el algoritmo BM25 para rankear los resultados por relevancia.

## Ventajas

- No requiere servidor
- Muy rápido para búsquedas
- Perfecto para aplicaciones móviles y desktop
`), { collection: "docs" });
  
  await searcher.addDocument(Buffer.from(`
# Tutorial de JavaScript

JavaScript es el lenguaje de programación más popular para web.

## Características

- Dinámico y flexible
- Soporta programación funcional
- Gran ecosistema de librerías

## Node.js

Node.js permite ejecutar JavaScript en el servidor, lo que ha revolucionado 
el desarrollo web moderno.
`), { collection: "docs" });
  
  await searcher.addDocument("./README.md", { collection: "readme" });

  // Ejemplo 1: Búsqueda simple - retorna lista plana de snippets
  console.log("=== 1. Búsqueda: 'búsqueda' ===\n");
  const results1 = searcher.search("búsqueda", { limit: 5, limitSnippets: 1 });
  
  results1.results.forEach((snippet, i) => {
    console.log(`${i + 1}. ${snippet.documentTitle}`);
    console.log(`   Encontrado en: ${snippet.section}`);
    console.log(`   Snippet: "${snippet.text}"\n`);
  });

  // Ejemplo 2: Búsqueda en título
  console.log("=== 2. Búsqueda en título: 'title:JavaScript' ===\n");
  const results2 = searcher.search("title:JavaScript", { limitSnippets: 1 });
  
  results2.results.forEach((snippet, i) => {
    console.log(`${i + 1}. ${snippet.documentTitle}`);
    console.log(`   Sección: ${snippet.section}`);
    console.log(`   Snippet: "${snippet.text}"\n`);
  });

  // Ejemplo 3: Búsqueda con contexto más largo
  console.log("=== 3. Búsqueda con snippet largo: 'FTS5' ===\n");
  const results3 = searcher.search("FTS5", { 
    snippetLength: 200,
    limitSnippets: 1 
  });
  
  results3.results.forEach((snippet, i) => {
    console.log(`${i + 1}. ${snippet.documentTitle}`);
    console.log(`   Snippet: "${snippet.text}"\n`);
  });

  // Ejemplo 4: Búsqueda sin snippets
  console.log("=== 4. Búsqueda sin snippets: 'programación' ===\n");
  const results4 = searcher.search("programación", { snippets: false });
  
  console.log("Resultados (solo metadatos):");
  results4.results.forEach((snippet, i) => {
    console.log(`${i + 1}. ${snippet.documentTitle} - Score: ${snippet.rank}`);
  });

  searcher.close();
  console.log("\n✓ Demo completado!");
}

main().catch(console.error);
