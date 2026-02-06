import { epubToMarkdown } from "../lib/epub-converter.js";
import fs from "node:fs";
import path from "node:path";

console.log("=== Ejemplo Básico: Conversión EPUB a Markdown ===\n");

const epubPath = "./demo/docs/Normal People -- Sally Rooney -- 2018.epub";
// const epubPath = "./demo/docs/Están aquí - J. J. Benítez.epub";
const outputPath = epubPath.replace(".epub", ".md");

console.log(`Convirtiendo: ${epubPath}`);
console.log(`Archivo de salida: ${outputPath}\n`);

// Convertir EPUB a Markdown
epubToMarkdown(epubPath)
  .then((markdown) => {
    // Guardar el markdown en un archivo
    fs.writeFileSync(outputPath, markdown, "utf-8");
    
    console.log("✓ Conversión completada exitosamente!");
    console.log(`\nArchivo generado: ${path.basename(outputPath)}`);
    console.log(`Tamaño: ${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`Líneas: ${markdown.split("\n").length}`);
  })
  .catch((error) => {
    console.error("✗ Error en la conversión:", error.message);
  });
