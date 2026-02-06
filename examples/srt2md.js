import { srtToMarkdown, getSRTStats } from "../lib/srt-converter.js";
import fs from "node:fs";
import path from "node:path";

console.log("=== Ejemplo Básico: Conversión SRT a Markdown ===\n");

const srtPath = "./examples/srt/The_Social_Network.srt";
const outputPath = srtPath.replace(".srt", ".md");

console.log(`Convirtiendo: ${srtPath}`);
console.log(`Archivo de salida: ${outputPath}\n`);

// Primero, obtener estadísticas del archivo
console.log("📊 Analizando archivo SRT...\n");
try {
  const stats = getSRTStats(srtPath);
  console.log(`  Subtítulos: ${stats.subtitles}`);
  console.log(`  Duración: ${stats.durationFormatted} (${stats.duration}s)`);
  console.log(`  Escenas detectadas: ${stats.scenes}`);
  console.log(
    `  Promedio de subtítulos por escena: ${stats.averageSubtitlesPerScene}\n`
  );
} catch (error) {
  console.error("✗ Error al obtener estadísticas:", error.message);
}

// Convertir SRT a Markdown con opciones personalizadas
const options = {
  sceneGap: 10, // Pausas de 10+ segundos crean nueva escena
  includeTimestamps: true, // Incluir timestamps en el markdown
  groupDialogues: true, // Agrupar diálogos consecutivos
  inferScenes: true, // Inferir descripción de escenas
};

console.log("🎬 Convirtiendo a Markdown...\n");

srtToMarkdown(srtPath, options)
  .then((markdown) => {
    // Guardar el markdown en un archivo
    fs.writeFileSync(outputPath, markdown, "utf-8");

    console.log("✓ Conversión completada exitosamente!");
    console.log(`\nArchivo generado: ${path.basename(outputPath)}`);
    console.log(`Tamaño: ${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`Líneas: ${markdown.split("\n").length}`);

    // Mostrar preview del markdown
    console.log("\n📄 Preview (primeras 30 líneas):");
    console.log("─".repeat(60));
    const lines = markdown.split("\n").slice(0, 30);
    console.log(lines.join("\n"));
    if (markdown.split("\n").length > 30) {
      console.log("\n... (contenido truncado) ...");
    }
    console.log("─".repeat(60));
  })
  .catch((error) => {
    console.error("✗ Error en la conversión:", error.message);
  });
