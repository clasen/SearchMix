import SearchMix from "../index.js";

async function main() {
  console.log("=== Navegación Avanzada de Snippets ===\n");

  const searcher = new SearchMix({ dbPath: "./db/snippet-nav-demo.db" });

  await searcher.addDocument(Buffer.from(`
# Manual de JavaScript Moderno

JavaScript es el lenguaje de la web moderna.

## Fundamentos

Los fundamentos son esenciales para dominar JavaScript.

### Variables

En JavaScript moderno usamos let y const para declarar variables.
Ya no se recomienda usar var en código nuevo.

### Funciones

Las funciones son bloques de código reutilizables.
Existen funciones tradicionales y arrow functions.

#### Arrow Functions

Las arrow functions tienen sintaxis compacta.
Son especialmente útiles para callbacks.

#### Funciones Tradicionales

Las funciones tradicionales tienen su propio this.
Son necesarias en algunos casos específicos.

### Objetos

Los objetos son colecciones de propiedades.
Se pueden crear con notación literal o con constructores.

## Características Avanzadas

JavaScript tiene muchas características poderosas.

### Async/Await

Async/await simplifica el manejo de promesas.
Hace el código asíncrono más legible.

### Destructuring

El destructuring permite extraer valores de arrays y objetos.
Es una característica muy conveniente de ES6.

## Conclusiones

JavaScript continúa evolucionando con nuevas características.
Es importante mantenerse actualizado con el estándar.
`), { collection: "docs" });

  // Búsqueda específica
  console.log("=== Búsqueda: 'arrow functions' ===\n");
  const results = searcher.search("arrow functions", { 
    limit: 3,
    allOccurrences: true,
    maxOccurrences: 5
  });

  if (results.results.length > 0) {
    console.log(`📄 Documento: ${results.results[0].documentTitle}\n`);
    console.log(`📊 Total snippets: ${results.totalSnippets}\n`);

    results.results.forEach((snippet, i) => {
      console.log(`\n━━━ Snippet ${i + 1} ━━━`);
      console.log(`Texto: "${snippet.text}"\n`);

      if (snippet.heading) {
        console.log(`📍 Estás en:`);
        console.log(`   ${snippet.heading.type.toUpperCase()}: "${snippet.heading.text}"`);
        console.log(`   Nivel de profundidad: ${snippet.heading.depth}\n`);

        // Mostrar ruta completa hacia arriba
        if (snippet.parent) {
          console.log(`📂 Ruta jerárquica:`);
          let currentLevel = snippet.heading.depth;
          
          console.log(`   ${'  '.repeat(currentLevel - 1)}└─ ${snippet.heading.text} (${snippet.heading.type})`);
          
          if (snippet.parent) {
            console.log(`   ${'  '.repeat(snippet.parent.depth - 1)}└─ ${snippet.parent.text} (${snippet.parent.type})`);
          }
        }

        // Mostrar subsecciones disponibles
        if (snippet.children && snippet.children.length > 0) {
          console.log(`\n📑 Subsecciones disponibles:`);
          snippet.children.forEach((child, idx) => {
            console.log(`   ${idx + 1}. ${child.text} (${child.type})`);
          });
        }

        // Mostrar contenido disponible
        if (snippet.content && snippet.content.length > 0) {
          console.log(`\n📄 Contenido en esta sección:`);
          snippet.content.forEach((block, idx) => {
            console.log(`   ${idx + 1}. ${block.text}`);
          });
        }
      }
    });
  }

  // Ejemplo: Buscar y navegar a través de la jerarquía
  console.log("\n\n=== Ejemplo: Exploración de Jerarquía ===\n");
  
  const exploreResults = searcher.search("promesas", { 
    allOccurrences: true,
    maxOccurrences: 3
  });

  if (exploreResults.results.length > 0) {
    exploreResults.results.forEach(snippet => {
      if (snippet.heading) {
        console.log(`✨ Encontrado en: ${snippet.heading.text}`);
        
        // Simular navegación hacia arriba
        if (snippet.parent) {
          console.log(`   ↑ Sección padre: ${snippet.parent.text}`);
          console.log(`     Puedes navegar aquí para ver el contexto más amplio`);
        }
        
        // Simular navegación hacia abajo
        if (snippet.children && snippet.children.length > 0) {
          console.log(`   ↓ Secciones relacionadas:`);
          snippet.children.forEach(child => {
            console.log(`     - ${child.text}`);
          });
        }
        
        // Simular navegación al contenido
        if (snippet.content && snippet.content.length > 0) {
          console.log(`   → Contenido completo disponible (${snippet.content.length} bloques)`);
        }
        
        console.log();
      }
    });
  }

  // Ejemplo: Construir índice de navegación
  console.log("\n=== Ejemplo: Construir Índice de Navegación ===\n");
  
  const indexResults = searcher.search("javascript OR funciones OR async", { 
    limit: 10,
    allOccurrences: true,
    maxOccurrences: 20
  });

  // Agrupar snippets por sección
  const sections = new Map();
  
  indexResults.results.forEach(snippet => {
    if (snippet.heading) {
      const key = `${snippet.heading.type}:${snippet.heading.text}`;
      if (!sections.has(key)) {
        sections.set(key, {
          heading: snippet.heading,
          parent: snippet.parentId,
          children: snippet.childrenIds || [],
          contentCount: snippet.contentCount || 0,
          occurrences: 1
        });
      } else {
        sections.get(key).occurrences++;
      }
    }
  });

  console.log("📚 Índice de secciones encontradas:\n");
  
  sections.forEach((info, key) => {
    const indent = '  '.repeat(info.heading.depth - 1);
    console.log(`${indent}${info.heading.type.toUpperCase()}: ${info.heading.text}`);
    console.log(`${indent}├─ Menciones: ${info.occurrences}`);
    console.log(`${indent}├─ Bloques de contenido: ${info.contentCount}`);
    console.log(`${indent}└─ Subsecciones: ${info.children.length}`);
    
    if (info.children.length > 0 && info.children.length <= 3) {
      info.children.forEach(child => {
        console.log(`${indent}   └─ ${child.text}`);
      });
    }
    console.log();
  });

  searcher.close();
  console.log("✓ Demo completado!");
}

main().catch(console.error);
