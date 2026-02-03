import SearchMix from "../index.js";

async function main() {
  console.log("=== Navegación Simple con Métodos de Snippet ===\n");

  const searcher = new SearchMix({ dbPath: "./db/simple-nav.db" });

  // Agregar documento
  await searcher.addDocument(Buffer.from(`
# Tutorial de JavaScript

## Variables

### let y const

Use let para variables que cambiarán.
Use const para valores constantes.

### var (deprecated)

No use var en código moderno.
Tiene problemas de scope.

## Funciones

### Arrow Functions

Las arrow functions son más concisas.
Heredan el this del contexto.

### Funciones Tradicionales

Las funciones tradicionales tienen su propio this.
Son necesarias en algunos casos.
`), { collection: "docs" });

  // Búsqueda
  const results = searcher.search("arrow functions", { allOccurrences: true });

  if (results.results.length === 0) {
    console.log("No se encontraron resultados");
    searcher.close();
    return;
  }

  // Obtener un snippet con heading
  const snippet = results.results.find(s => s.heading);

  if (!snippet) {
    console.log("No se encontró snippet con heading");
    searcher.close();
    return;
  }

  console.log("📍 Snippet encontrado:", snippet.heading.text);
  console.log();

  // 1. USO SIMPLE: Verificar antes de acceder
  console.log("=== Verificación ===");
  console.log("¿Tiene padre?", snippet.hasParent());
  console.log("¿Tiene hijos?", snippet.hasChildren());
  console.log("¿Tiene contenido?", snippet.hasContent());
  console.log();

  // 2. Navegar al padre
  if (snippet.hasParent()) {
    console.log("=== Padre ===");
    const parent = snippet.getParent();
    console.log(`Padre: ${parent.text}`);
    console.log();
  }

  // 3. Ver hijos
  if (snippet.hasChildren()) {
    console.log("=== Hijos ===");
    const children = snippet.getChildren();
    children.forEach((child, i) => {
      console.log(`${i + 1}. ${child.text}`);
    });
    console.log();
  }

  // 4. Breadcrumbs
  console.log("=== Ruta Completa ===");
  console.log(snippet.getBreadcrumbsText());
  console.log();

  // 5. Contenido
  if (snippet.hasContent()) {
    console.log("=== Contenido ===");
    const content = snippet.getContent();
    content.forEach(block => {
      console.log(`[${block.type}] ${block.text}`);
    });
    console.log();
  }

  // 6. Hermanos
  console.log("=== Secciones al Mismo Nivel ===");
  const siblings = snippet.getSiblings();
  if (siblings.length > 0) {
    siblings.forEach((sibling, i) => {
      console.log(`${i + 1}. ${sibling.text}`);
    });
  } else {
    console.log("(No hay hermanos)");
  }
  console.log();

  // 7. Comparación: Antes vs Ahora
  console.log("=== Comparación de API ===\n");

  console.log("❌ ANTES (sin métodos):");
  console.log("  const parent = searcher.getHeadingById(snippet.documentPath, snippet.parentId);");
  console.log("  console.log(parent.text);\n");

  console.log("✅ AHORA (con métodos):");
  console.log("  const parent = snippet.getParent();");
  console.log("  console.log(parent.text);\n");

  console.log("💡 Beneficio: Más simple, más legible, menos código!");

  searcher.close();
  console.log("\n✓ Demo completado!");
}

main().catch(console.error);
