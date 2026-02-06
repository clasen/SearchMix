import SearchMix from "../index.js";

async function main() {
  console.log("=== Demo de Navegación Ligera (con IDs) ===\n");

  const searcher = new SearchMix({ dbPath: "./db/lightweight-demo.db" });

  // Agregar documento con estructura jerárquica
  await searcher.addDocument(Buffer.from(`
# Manual Completo de JavaScript

JavaScript es el lenguaje de programación de la web.

## Fundamentos Básicos

Los fundamentos son la base del lenguaje.

### Variables y Constantes

En JavaScript moderno usamos let y const.
Ya no se recomienda usar var.

### Tipos de Datos

JavaScript tiene tipos dinámicos.
Los tipos incluyen: number, string, boolean, object, etc.

## Características Avanzadas

JavaScript tiene muchas características poderosas.

### Async/Await

Async/await simplifica el código asíncrono.
Las promesas son la base de async/await.

#### Manejo de Errores

Usa try/catch con async/await.
Es importante capturar errores correctamente.

### Módulos ES6

Los módulos permiten organizar el código.
Usa import/export para trabajar con módulos.
`), { collection: "docs" });

  console.log("✓ Documento indexado\n");

  // 1. Búsqueda básica - Los snippets ahora son ligeros
  console.log("=== 1. Búsqueda Básica (Snippets Ligeros) ===\n");
  
  const results = searcher.search("async", { 
    limitSnippets: 5
  });

  if (results.results.length > 0) {
    console.log(`📄 ${results.results[0].documentTitle} (${results.totalSnippets} snippets)\n`);

    results.results.forEach((snippet, i) => {
      console.log(`Snippet ${i + 1}:`);
      console.log(`  Texto: "${snippet.text}"`);
      console.log(`  Sección: ${snippet.section}`);
      console.log(`  Documento: ${snippet.documentTitle}`);
      console.log(`  Rank: ${snippet.rank}`);
      
      if (snippet.heading) {
        console.log(`  Heading ID: ${snippet.heading.id}`);
        console.log(`  Heading: ${snippet.heading.text} (${snippet.heading.type})`);
      }
      
      // Referencias ligeras (solo IDs)
      if (snippet.parentId) {
        console.log(`  ⬆️  Parent ID: ${snippet.parentId} (usa getHeadingById para detalles)`);
      }
      
      if (snippet.childrenIds && snippet.childrenIds.length > 0) {
        console.log(`  ⬇️  Children IDs: ${snippet.childrenIds.join(', ')}`);
      }
      
      if (snippet.contentCount) {
        console.log(`  📝 Contenido: ${snippet.contentCount} bloques`);
      }
      
      console.log();
    });
  }

  // 2. Navegación bajo demanda - Obtener detalles cuando se necesiten
  console.log("\n=== 2. Navegación Bajo Demanda (getHeadingById) ===\n");
  
  const firstSnippet = results.results[0];
  
  if (firstSnippet && firstSnippet.heading) {
    console.log(`📍 Snippet seleccionado: "${firstSnippet.heading.text}"\n`);
    
    // Obtener detalles completos del heading actual
    const headingDetails = searcher.getHeadingById(
      firstSnippet.documentPath, 
      firstSnippet.heading.id
    );
    
    if (headingDetails) {
      console.log("Detalles completos del heading:");
      console.log(`  ID: ${headingDetails.id}`);
      console.log(`  Tipo: ${headingDetails.type}`);
      console.log(`  Texto: ${headingDetails.text}`);
      console.log(`  Profundidad: ${headingDetails.depth}`);
      console.log(`  Bloques de contenido: ${headingDetails.contentCount}`);
      
      // Navegar al padre
      if (headingDetails.parent) {
        console.log(`\n⬆️  Padre:`);
        console.log(`  ID: ${headingDetails.parent.id}`);
        console.log(`  ${headingDetails.parent.type}: "${headingDetails.parent.text}"`);
        
        // Podemos obtener más detalles del padre si queremos
        const parentDetails = searcher.getHeadingById(
          firstSnippet.documentPath,
          headingDetails.parent.id
        );
        
        if (parentDetails) {
          console.log(`  Bloques de contenido del padre: ${parentDetails.contentCount}`);
        }
      }
      
      // Navegar a los hijos
      if (headingDetails.children && headingDetails.children.length > 0) {
        console.log(`\n⬇️  Hijos (${headingDetails.children.length}):`);
        headingDetails.children.forEach(child => {
          console.log(`  - [${child.id}] ${child.type}: "${child.text}"`);
        });
      }
      
      // Ver contenido completo
      if (headingDetails.content && headingDetails.content.length > 0) {
        console.log(`\n📄 Contenido completo (${headingDetails.content.length} bloques):`);
        headingDetails.content.forEach((block, idx) => {
          console.log(`  ${idx + 1}. [${block.type}] ${block.text}`);
        });
      }
    }
  }

  // 3. Navegación Profunda - Explorar toda la jerarquía
  console.log("\n\n=== 3. Navegación Profunda ===\n");
  
  const deepSnippet = results.results.find(s => s.heading && s.heading.depth > 2);
  
  if (deepSnippet) {
    console.log(`🔍 Explorando: "${deepSnippet.heading.text}"\n`);
    
    // Construir ruta completa hacia arriba
    const breadcrumbs = [];
    let currentId = deepSnippet.heading.id;
    
    while (currentId) {
      const details = searcher.getHeadingById(deepSnippet.documentPath, currentId);
      if (!details) break;
      
      breadcrumbs.unshift(`${details.type}: "${details.text}"`);
      currentId = details.parent?.id;
    }
    
    console.log("📂 Ruta completa:");
    breadcrumbs.forEach((crumb, idx) => {
      const indent = "  ".repeat(idx);
      console.log(`${indent}${crumb}`);
    });
  }

  // 4. Comparación de Tamaños
  console.log("\n\n=== 4. Comparación de Tamaños en Memoria ===\n");
  
  const snippet = results.results[0];
  if (snippet) {
    const snippetSize = JSON.stringify(snippet).length;
    console.log(`Tamaño del snippet (ligero): ${snippetSize} bytes`);
    console.log(`  - Solo contiene: IDs, texto básico, referencias`);
    console.log(`  - NO contiene: Objetos completos de parent/children/content`);
    
    if (snippet.heading) {
      const fullDetails = searcher.getHeadingById(snippet.documentPath, snippet.heading.id);
      const fullSize = JSON.stringify(fullDetails).length;
      console.log(`\nTamaño de detalles completos: ${fullSize} bytes`);
      console.log(`  - Contiene: Todo (parent, children, content completo)`);
      console.log(`  - Se carga solo cuando se solicita`);
      
      const savings = ((1 - snippetSize / fullSize) * 100).toFixed(1);
      console.log(`\n💡 Ahorro de memoria: ${savings}% por snippet`);
    }
  }

  searcher.close();
  console.log("\n✓ Demo completado!");
}

main().catch(console.error);
