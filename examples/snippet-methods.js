import SearchMix from "../index.js";

async function main() {
  console.log("=== Demo de Métodos de Snippet ===\n");

  const searcher = new SearchMix({ dbPath: "./db/snippet-methods-demo.db" });

  // Agregar documento de ejemplo
  await searcher.addDocument(Buffer.from(`
# Guía de Programación Moderna

Esta es una guía completa sobre programación moderna.

## Lenguajes de Programación

Los lenguajes son fundamentales en la programación.

### JavaScript

JavaScript es el lenguaje de la web moderna.
Es versátil y se puede usar en frontend y backend.

#### Node.js

Node.js permite ejecutar JavaScript en el servidor.
Tiene un ecosistema enorme con npm.

##### Express.js

Express es el framework web más popular.
Simplifica la creación de APIs REST.

#### React

React es la librería más popular para interfaces.
Usa componentes reutilizables y virtual DOM.

### Python

Python es excelente para ciencia de datos.
Tiene una sintaxis limpia y legible.

#### Django

Django es un framework web completo.
Incluye ORM, autenticación y más.

## Mejores Prácticas

Las mejores prácticas mejoran la calidad del código.

### Testing

El testing asegura la calidad del software.
Usa TDD cuando sea posible.

### Code Review

El code review mejora el código en equipo.
Siempre revisa antes de merge.
`), { collection: "docs" });

  console.log("✓ Documento indexado\n");

  // Búsqueda
  const results = searcher.search('javascript OR servidor', { 
    limitSnippets: 10
  });

  if (results.results.length === 0) {
    console.log("No se encontraron resultados");
    searcher.close();
    return;
  }

  const snippet = results.results.find(s => s.heading && s.heading.depth >= 3);

  if (!snippet) {
    console.log("No se encontró snippet apropiado");
    searcher.close();
    return;
  }

  console.log("=== 1. Información Básica del Snippet ===\n");
  console.log(`Texto: "${snippet.text}"`);
  console.log(`Sección: ${snippet.section}`);
  console.log(`String: ${snippet.toString()}`);
  console.log();

  // 1. Verificar disponibilidad
  console.log("=== 2. Verificar Disponibilidad ===\n");
  console.log(`¿Tiene padre? ${snippet.hasParent()}`);
  console.log(`¿Tiene hijos? ${snippet.hasChildren()}`);
  console.log(`¿Tiene contenido? ${snippet.hasContent()}`);
  console.log();

  // 2. Obtener padre
  console.log("=== 3. Navegar al Padre ===\n");
  if (snippet.hasParent()) {
    const parent = snippet.getParent();
    console.log(`Padre: ${parent.type} - "${parent.text}"`);
    console.log(`Profundidad del padre: ${parent.depth}`);
    console.log(`Bloques de contenido: ${parent.contentCount}`);
    console.log();
  }

  // 3. Obtener hijos
  console.log("=== 4. Navegar a Hijos ===\n");
  if (snippet.hasChildren()) {
    const children = snippet.getChildren();
    console.log(`Número de hijos: ${children.length}\n`);
    
    children.forEach((child, idx) => {
      console.log(`Hijo ${idx + 1}:`);
      console.log(`  ID: ${child.id}`);
      console.log(`  Tipo: ${child.type}`);
      console.log(`  Texto: "${child.text}"`);
      console.log(`  Contenido: ${child.contentCount} bloques`);
      console.log();
    });

    // Obtener un hijo específico
    const firstChild = snippet.getChild(0);
    if (firstChild) {
      console.log(`Primer hijo directo: "${firstChild.text}"`);
      console.log();
    }
  }

  // 4. Breadcrumbs
  console.log("=== 5. Breadcrumbs (Ruta Completa) ===\n");
  const breadcrumbs = snippet.getBreadcrumbs();
  console.log("Array de breadcrumbs:");
  breadcrumbs.forEach((crumb, idx) => {
    const indent = "  ".repeat(idx);
    console.log(`${indent}${crumb.depth}. [${crumb.type}] ${crumb.text}`);
  });
  console.log();
  
  console.log("Texto de breadcrumbs:");
  console.log(`  "${snippet.getBreadcrumbsText()}"`);
  console.log(`  "${snippet.getBreadcrumbsText(' → ')}"`);
  console.log();

  // 5. Contenido
  console.log("=== 6. Obtener Contenido Completo ===\n");
  if (snippet.hasContent()) {
    const content = snippet.getContent();
    console.log(`Bloques de contenido: ${content.length}\n`);
    
    content.forEach((block, idx) => {
      console.log(`Bloque ${idx + 1}:`);
      console.log(`  Tipo: ${block.type}`);
      console.log(`  Texto: ${block.text}`);
      if (block.lang) {
        console.log(`  Lenguaje: ${block.lang}`);
      }
      console.log();
    });
  }

  // 6. Detalles completos
  console.log("=== 7. Obtener Detalles Completos ===\n");
  const details = snippet.getDetails();
  console.log("Detalles completos:");
  console.log(`  ID: ${details.id}`);
  console.log(`  Tipo: ${details.type}`);
  console.log(`  Texto: ${details.text}`);
  console.log(`  Profundidad: ${details.depth}`);
  console.log(`  Bloques de contenido: ${details.contentCount}`);
  if (details.parent) {
    console.log(`  Padre: ${details.parent.text}`);
  }
  if (details.children) {
    console.log(`  Hijos: ${details.children.length}`);
  }
  console.log();

  // 7. Buscar ancestro específico
  console.log("=== 8. Buscar Ancestro por Nivel ===\n");
  const h1Ancestor = snippet.getAncestorAtDepth(1);
  if (h1Ancestor) {
    console.log(`H1 ancestro: "${h1Ancestor.text}"`);
  }
  
  const h2Ancestor = snippet.getAncestorAtDepth(2);
  if (h2Ancestor) {
    console.log(`H2 ancestro: "${h2Ancestor.text}"`);
  }
  
  const h3Ancestor = snippet.getAncestorAtDepth(3);
  if (h3Ancestor) {
    console.log(`H3 ancestro: "${h3Ancestor.text}"`);
  }
  console.log();

  // 8. Hermanos (siblings)
  console.log("=== 9. Obtener Hermanos (Siblings) ===\n");
  const siblings = snippet.getSiblings();
  if (siblings.length > 0) {
    console.log(`Hermanos encontrados: ${siblings.length}\n`);
    siblings.forEach((sibling, idx) => {
      console.log(`Hermano ${idx + 1}:`);
      console.log(`  Tipo: ${sibling.type}`);
      console.log(`  Texto: "${sibling.text}"`);
      console.log();
    });
  } else {
    console.log("No tiene hermanos al mismo nivel");
    console.log();
  }

  // 9. Serialización
  console.log("=== 10. Serialización ===\n");
  const json = snippet.toJSON();
  console.log("JSON del snippet:");
  console.log(JSON.stringify(json, null, 2));
  console.log();

  // 10. Caso de uso: Navegación interactiva
  console.log("=== 11. Caso de Uso: Navegación Interactiva ===\n");
  
  console.log(`📍 Estás en: ${snippet.heading.text} (${snippet.heading.type})\n`);
  
  console.log("Opciones de navegación:");
  
  if (snippet.hasParent()) {
    const parentNav = snippet.getParent();
    console.log(`  ↑ [Arriba] Ir a: "${parentNav.text}"`);
  } else {
    console.log(`  ↑ [Arriba] (No disponible - estás en el nivel superior)`);
  }
  
  if (snippet.hasChildren()) {
    const childrenNav = snippet.getChildren();
    console.log(`  ↓ [Abajo] ${childrenNav.length} subsecciones:`);
    childrenNav.forEach((child, idx) => {
      console.log(`     ${idx + 1}. "${child.text}"`);
    });
  } else {
    console.log(`  ↓ [Abajo] (No hay subsecciones)`);
  }
  
  const siblingsNav = snippet.getSiblings();
  if (siblingsNav.length > 0) {
    console.log(`  ← → [Lateral] ${siblingsNav.length} secciones al mismo nivel:`);
    siblingsNav.forEach((sibling, idx) => {
      console.log(`     ${idx + 1}. "${sibling.text}"`);
    });
  } else {
    console.log(`  ← → [Lateral] (No hay secciones al mismo nivel)`);
  }
  
  if (snippet.hasContent()) {
    console.log(`  📄 [Ver contenido] ${snippet.contentCount} bloques disponibles`);
  }
  console.log();

  searcher.close();
  console.log("✓ Demo completado!");
}

main().catch(console.error);
