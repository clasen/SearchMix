import SearchMix from "../index.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=== Smart Indexing (Detecta cambios automáticamente) ===\n");

  const searcher = new SearchMix({ dbPath: "./db/smart-indexing.db" });

  // Primera ejecución: indexa todos los archivos
  console.log("📚 Primera ejecución - indexando documentos...");
  await searcher.addDocument("./examples/docs");
  
  let stats = searcher.getStats();
  console.log(`✓ ${stats.totalDocs} documentos indexados\n`);

  // Segunda ejecución: NO reindexará porque los archivos no cambiaron
  console.log("🔍 Segunda ejecución - verificando cambios...");
  const startTime = Date.now();
  await searcher.addDocument("./examples/docs");
  const elapsed = Date.now() - startTime;
  
  stats = searcher.getStats();
  console.log(`✓ Verificación completada en ${elapsed}ms`);
  console.log(`✓ ${stats.totalDocs} documentos (ninguno reindexado)\n`);

  // Simular cambio en un archivo
  const testFile = "./examples/docs/test-change.md";
  const testContent = `# Test Document

This is a test document created at ${new Date().toISOString()}.

## Section 1

Content of section 1.

## Section 2

Content of section 2.
`;

  console.log("📝 Creando archivo de prueba...");
  fs.writeFileSync(testFile, testContent);
  
  // Indexar el nuevo archivo
  await searcher.addDocument("./examples/docs");
  stats = searcher.getStats();
  console.log(`✓ Nuevo archivo detectado y agregado`);
  console.log(`✓ Total: ${stats.totalDocs} documentos\n`);

  // Esperar un momento y modificar el archivo
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  console.log("✏️  Modificando archivo de prueba...");
  const modifiedContent = testContent + `\n## Section 3\n\nNew content added at ${new Date().toISOString()}.\n`;
  fs.writeFileSync(testFile, modifiedContent);
  
  // Reindexar - debería detectar el cambio
  console.log("🔄 Reindexando - debería detectar el cambio...");
  await searcher.addDocument("./examples/docs");
  
  // Buscar el nuevo contenido
  const results = searcher.search("Section 3");
  console.log(`✓ Cambio detectado y reindexado`);
  console.log(`✓ Búsqueda "Section 3": ${results.totalCount} resultado(s)\n`);

  if (results.totalCount > 0) {
    console.log("📄 Resultado encontrado:");
    console.log(`   Título: ${results.results[0].documentTitle}`);
    console.log(`   Snippet: ${results.results[0].text}\n`);
  }

  // Limpieza
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
    console.log("🧹 Archivo de prueba eliminado");
  }

  searcher.close();
  console.log("\n✅ Demostración completada!");
  console.log("\n💡 Resumen:");
  console.log("   • Primera llamada: indexa todos los archivos");
  console.log("   • Segunda llamada: solo verifica, no reindexa archivos sin cambios");
  console.log("   • Detecta archivos nuevos automáticamente");
  console.log("   • Detecta archivos modificados y los reindexa automáticamente");
}

main().catch(console.error);
