import SearchMix from "../index.js";

async function main() {
  console.log("=== Demo de Snippets Navegables ===\n");

  const searcher = new SearchMix({ dbPath: "./db/navigable-demo.db" });

  // Agregar documento con estructura jerárquica clara
  console.log("Preparando documento con estructura jerárquica...\n");

  await searcher.addDocument(Buffer.from(`
# Guía Completa de Bases de Datos

Esta es una guía sobre diferentes tipos de bases de datos.

## Bases de Datos Relacionales

Las bases de datos relacionales organizan la información en tablas.

### MySQL

MySQL es una base de datos relacional muy popular en aplicaciones web.
Es conocida por su velocidad y confiabilidad.

### PostgreSQL

PostgreSQL es más avanzado y soporta características como JSON.
Es ideal para aplicaciones empresariales complejas.

## Bases de Datos NoSQL

Las bases de datos NoSQL son más flexibles en su estructura.

### MongoDB

MongoDB almacena datos en formato JSON/BSON.
Es perfecto para aplicaciones que necesitan escalabilidad horizontal.

### Redis

Redis es una base de datos en memoria ultrarrápida.
Se usa principalmente como caché o para datos temporales.

## Conclusión

Elegir la base de datos correcta depende de tus necesidades específicas.
Considera factores como escalabilidad, consistencia y facilidad de uso.
`), { collection: "docs" });

  // Búsqueda que retorna todos los snippets
  console.log("=== Búsqueda: 'base de datos' ===\n");
  const results = searcher.search("base de datos", { 
    limit: 5,
    allOccurrences: true,
    maxOccurrences: 10
  });

  // Agrupar por documento
  const byDocument = new Map();
  results.results.forEach(snippet => {
    if (!byDocument.has(snippet.documentPath)) {
      byDocument.set(snippet.documentPath, {
        title: snippet.documentTitle,
        snippets: []
      });
    }
    byDocument.get(snippet.documentPath).snippets.push(snippet);
  });

  byDocument.forEach((doc, path) => {
    console.log(`\n📄 Documento: ${doc.title}`);
    console.log(`   Occurrencias: ${doc.snippets.length}\n`);

    doc.snippets.forEach((snippet, i) => {
      console.log(`   Snippet ${i + 1}:`);
      console.log(`   ├─ Texto: "${snippet.text}"`);
      console.log(`   ├─ Sección: ${snippet.section}`);
      console.log(`   ├─ Posición: ${snippet.position}`);

      // Información del heading actual (si existe)
      if (snippet.heading) {
        console.log(`   │`);
        console.log(`   ├─ 📍 Heading Actual:`);
        console.log(`   │  ├─ Tipo: ${snippet.heading.type}`);
        console.log(`   │  ├─ Texto: "${snippet.heading.text}"`);
        console.log(`   │  └─ Nivel: ${snippet.heading.depth}`);
      }

      // Información del padre (si existe) - usar método
      if (snippet.hasParent()) {
        const parent = snippet.getParent();
        if (parent) {
          console.log(`   │`);
          console.log(`   ├─ ⬆️  Padre:`);
          console.log(`   │  ├─ Tipo: ${parent.type}`);
          console.log(`   │  ├─ Texto: "${parent.text}"`);
          console.log(`   │  └─ Nivel: ${parent.depth}`);
        }
      }

      // Información de hijos (si existen) - usar método
      if (snippet.hasChildren()) {
        const children = snippet.getChildren();
        console.log(`   │`);
        console.log(`   ├─ ⬇️  Hijos (${children.length}):`);
        children.forEach((child, cidx) => {
          const isLast = cidx === children.length - 1;
          const prefix = isLast ? '   │  └─' : '   │  ├─';
          console.log(`${prefix} ${child.type}: "${child.text}"`);
        });
      }

      // Contenido dentro de esta sección (si existe) - usar método
      if (snippet.hasContent()) {
        const content = snippet.getContent();
        console.log(`   │`);
        console.log(`   ├─ 📝 Contenido en esta sección (${content.length} bloques):`);
        content.forEach((block, bidx) => {
          const isLast = bidx === content.length - 1;
          const prefix = isLast ? '   │  └─' : '   │  ├─';
          const preview = block.text.substring(0, 60) + (block.text.length > 60 ? '...' : '');
          console.log(`${prefix} ${block.type}: "${preview}"`);
        });
      }

      console.log(`   └─`);
    });
  });

  // Ejemplo de navegación programática
  console.log("\n\n=== Ejemplo de Navegación Programática ===\n");
  
  if (results.results.length > 0) {
    const snippet = results.results.find(s => s.heading && s.heading.type === 'h3');
    
    if (snippet) {
      console.log("📍 Snippet seleccionado:");
      console.log(`   Heading: ${snippet.heading.text} (${snippet.heading.type})`);
      
      if (snippet.hasParent()) {
        const parent = snippet.getParent();
        if (parent) {
          console.log(`\n⬆️  Navegando al padre:`);
          console.log(`   ${parent.text} (${parent.type})`);
          
          // En una app real, podrías buscar más info del padre aquí
        }
      }
      
      if (snippet.hasChildren()) {
        const children = snippet.getChildren();
        console.log(`\n⬇️  Navegando a hijos:`);
        children.forEach(child => {
          console.log(`   - ${child.text} (${child.type})`);
        });
      }
      
      if (snippet.hasContent()) {
        const content = snippet.getContent();
        console.log(`\n📝 Contenido del snippet:`);
        content.forEach((block, idx) => {
          console.log(`   ${idx + 1}. [${block.type}] ${block.text}`);
        });
      }
    }
  }

  searcher.close();
  console.log("\n✓ Demo completado!");
}

main().catch(console.error);
