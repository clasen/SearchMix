import SearchMix from "../index.js";

async function main() {
  console.log("=== Demo: Todas las Ocurrencias ===\n");

  const searcher = new SearchMix({ dbPath: "./db/occurrences-demo.db" });

  // Crear un documento con múltiples ocurrencias
  const docWithMultiple = Buffer.from(`
# Guía de Búsqueda

La búsqueda es una funcionalidad clave en cualquier aplicación.

## Tipos de Búsqueda

### Búsqueda Simple
La búsqueda simple permite encontrar términos exactos.

### Búsqueda Avanzada
Con búsqueda avanzada puedes usar operadores booleanos.

## Implementación

Para implementar búsqueda, necesitas:
1. Un índice de búsqueda
2. Un algoritmo de ranking
3. Una interfaz de búsqueda

La búsqueda full-text es la más común.

### Búsqueda por Proximidad
Este tipo de búsqueda encuentra términos cercanos entre sí.

## Conclusión

Una buena búsqueda mejora la experiencia del usuario.
La búsqueda debe ser rápida y precisa.
`);

  // Limpiar y recrear
  searcher.clear();
  await searcher.addDocument(docWithMultiple, { collection: "docs" });

  console.log("Documento indexado con múltiples ocurrencias de 'búsqueda'\n");

  // Ejemplo 1: Una sola ocurrencia por documento
  console.log("=== 1. Una Ocurrencia por Documento ===\n");
  const single = searcher.search("búsqueda", { limitSnippets: 1 });
  console.log(`Total snippets: ${single.totalSnippets}\n`);
  single.results.forEach((snippet, index) => {
    console.log(`Snippet ${index + 1}:`);
    console.log(`  Título: ${snippet.documentTitle}`);
    console.log(`  Sección: ${snippet.section}`);
    console.log(`  Texto: "${snippet.text}"`);
    console.log();
  });

  // Ejemplo 2: Todas las ocurrencias (comportamiento por defecto)
  console.log("\n=== 2. Todas las Ocurrencias ===\n");
  const multiple = searcher.search("búsqueda", { 
    limitSnippets: 10 
  });

  console.log(`Total documentos: ${multiple.totalCount}`);
  console.log(`Total snippets encontrados: ${multiple.totalSnippets}\n`);
  
  multiple.results.forEach((snippet, index) => {
    console.log(`  Ocurrencia ${index + 1}:`);
    console.log(`  Documento: ${snippet.documentTitle}`);
    console.log(`  Sección: ${snippet.section}`);
    console.log(`  Posición: ${snippet.position}`);
    console.log(`  Texto: "${snippet.text}"`);
    console.log();
  });

  // Ejemplo 3: Limitar ocurrencias
  console.log("=== 3. Primeras 3 Ocurrencias ===\n");
  const limited = searcher.search("búsqueda", { 
    limitSnippets: 3
  });

  console.log(`Mostrando ${limited.totalSnippets} snippets:\n`);
  limited.results.forEach((snippet, index) => {
    console.log(`${index + 1}. [${snippet.section}] "${snippet.text.slice(0, 60)}..."`);
  });

  // Ejemplo 4: Búsqueda con múltiples términos
  console.log("\n=== 4. Múltiples Términos ===\n");
  const multiTerm = searcher.search("búsqueda OR algoritmo", { 
    limitSnippets: 5
  });

  console.log(`Encontrados ${multiTerm.totalSnippets} snippets de los términos:\n`);
  multiTerm.results.forEach((snippet, index) => {
    console.log(`${index + 1}. [${snippet.section}] "${snippet.text.slice(0, 70)}..."`);
  });

  searcher.close();
  console.log("\n✓ Demo completado!");
}

main().catch(console.error);
