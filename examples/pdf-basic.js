import { pdfToMarkdown } from "../lib/pdf-converter.js";
import fs from "node:fs";
import path from "node:path";

console.log("=== Ejemplo Básico: Conversión PDF a Markdown ===\n");

// const pdfPath = "./examples/docs/12_Covers.pdf";
const pdfPath = "./examples/docs/01 - Charlas con mi hemisferio derecho.pdf";
const outputPath = pdfPath.replace(".pdf", ".md");

console.log(`Convirtiendo: ${pdfPath}`);
console.log(`Archivo de salida: ${outputPath}\n`);

// Convertir PDF a Markdown
pdfToMarkdown(pdfPath)
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
