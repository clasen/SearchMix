import { epubToMarkdown } from "../lib/epub-to-markdown.js";
import fs from "node:fs";
import PathMix from 'pathmix';

console.log("=== Ejemplo Básico: Conversión EPUB a Markdown ===\n");

// const epubPath = "./demo/books/Epub/Flores que se abren de noche - Tomás Downey.epub";
const epubPath = PathMix.dir("books/Epub/El_sexto_mandamiento_Lawrence_Sanders.epub");
const outputPath = epubPath.replace(".epub", ".md");

console.log(`Convirtiendo: ${epubPath}`);
console.log(`Archivo de salida: ${outputPath}\n`);

// Convertir EPUB a Markdown
epubToMarkdown(epubPath)
  .then((markdown) => {
    // Guardar el markdown en un archivo
    fs.writeFileSync(outputPath, markdown, "utf-8");

    console.log("✓ Conversión completada exitosamente!");
    console.log(`\nArchivo generado: ${PathMix.dir(outputPath)}`);
    console.log(`Tamaño: ${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`Líneas: ${markdown.split("\n").length}`);
  })
  .catch((error) => {
    console.error("✗ Error en la conversión:", error.message);
  });
