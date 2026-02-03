import fs from "node:fs";
import { readFileWithEncoding } from "./encoding-utils.js";

/**
 * Convierte un timestamp SRT (HH:MM:SS,mmm) a segundos
 * @param {string} timestamp - Timestamp en formato SRT
 * @returns {number} - Tiempo en segundos
 */
function timestampToSeconds(timestamp) {
  const [time, ms] = timestamp.split(",");
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 1000;
}

/**
 * Convierte segundos a formato legible (HH:MM:SS o MM:SS)
 * @param {number} seconds - Tiempo en segundos
 * @returns {string} - Tiempo formateado
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Convierte tags HTML comunes en SRT a formato Markdown
 * @param {string} text - Texto con tags HTML
 * @returns {string} - Texto con formato Markdown
 */
function htmlToMarkdown(text) {
  if (!text) return text;

  let result = text;

  // Convertir itálicas: <i>texto</i> → *texto*
  result = result.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  
  // Convertir negritas: <b>texto</b> → **texto**
  result = result.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  
  // Convertir subrayado: <u>texto</u> → _texto_ (usando énfasis)
  result = result.replace(/<u>(.*?)<\/u>/gi, "_$1_");
  
  // Convertir strong: <strong>texto</strong> → **texto**
  result = result.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  
  // Convertir em: <em>texto</em> → *texto*
  result = result.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  
  // Eliminar tags de font (generalmente solo cambian color/tamaño)
  result = result.replace(/<\/?font[^>]*>/gi, "");
  
  // Convertir <br> y <br/> a saltos de línea
  result = result.replace(/<br\s*\/?>/gi, "\n");
  
  // Eliminar otros tags HTML no soportados
  result = result.replace(/<\/?[^>]+(>|$)/g, "");

  return result.trim();
}

/**
 * Parsea un archivo SRT y retorna un array de subtítulos
 * @param {string} srtContent - Contenido del archivo SRT
 * @returns {Array} - Array de objetos con los subtítulos
 */
function parseSRT(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );

    if (!timeMatch) continue;

    const startTime = timestampToSeconds(timeMatch[1]);
    const endTime = timestampToSeconds(timeMatch[2]);
    const rawText = lines.slice(2).join("\n").trim();
    const text = htmlToMarkdown(rawText);

    subtitles.push({
      index,
      startTime,
      endTime,
      text,
      timestamp: timeMatch[1],
    });
  }

  return subtitles;
}

/**
 * Agrupa subtítulos en escenas basándose en pausas en el tiempo
 * @param {Array} subtitles - Array de subtítulos
 * @param {number} sceneGap - Segundos de pausa para considerar nueva escena
 * @returns {Array} - Array de escenas
 */
function groupIntoScenes(subtitles, sceneGap = 5) {
  if (subtitles.length === 0) return [];

  const scenes = [];
  let currentScene = {
    startTime: subtitles[0].startTime,
    endTime: subtitles[0].endTime,
    subtitles: [subtitles[0]],
  };

  for (let i = 1; i < subtitles.length; i++) {
    const prev = subtitles[i - 1];
    const current = subtitles[i];
    const gap = current.startTime - prev.endTime;

    // Si hay una pausa significativa, empezar nueva escena
    if (gap > sceneGap) {
      scenes.push(currentScene);
      currentScene = {
        startTime: current.startTime,
        endTime: current.endTime,
        subtitles: [current],
      };
    } else {
      // Continuar en la misma escena
      currentScene.endTime = current.endTime;
      currentScene.subtitles.push(current);
    }
  }

  // Agregar la última escena
  scenes.push(currentScene);
  return scenes;
}

/**
 * Infiere una descripción de escena basándose en el contenido
 * @param {Array} subtitles - Array de subtítulos de la escena
 * @returns {string} - Descripción inferida
 */
function inferSceneDescription(subtitles) {
  if (subtitles.length === 0) return "Escena";

  const firstText = subtitles[0].text.toLowerCase();
  const textSample = subtitles
    .slice(0, 3)
    .map((s) => s.text)
    .join(" ")
    .toLowerCase();

  // Detectar patrones comunes
  if (
    firstText.includes("título") ||
    firstText.includes("presentación") ||
    textSample.length < 20
  ) {
    return "Apertura";
  }

  if (
    textSample.includes("fin") ||
    textSample.includes("créditos") ||
    textSample.includes("the end")
  ) {
    return "Cierre";
  }

  // Detectar si es diálogo o narración
  const dialogPatterns = [
    ":",
    "¿",
    "?",
    "dijo",
    "preguntó",
    "respondió",
    "gritó",
  ];
  const hasDialog = dialogPatterns.some((pattern) =>
    textSample.includes(pattern)
  );

  if (hasDialog) {
    return "Diálogo";
  }

  if (subtitles.length > 15) {
    return "Conversación extensa";
  }

  return "Escena";
}

/**
 * Agrupa subtítulos consecutivos del mismo hablante en diálogos
 * @param {Array} subtitles - Array de subtítulos
 * @returns {Array} - Array de diálogos agrupados
 */
function groupDialogues(subtitles) {
  if (subtitles.length === 0) return [];

  const dialogues = [];
  let currentDialogue = {
    text: subtitles[0].text,
    startTime: subtitles[0].startTime,
    endTime: subtitles[0].endTime,
    lines: [subtitles[0].text],
  };

  for (let i = 1; i < subtitles.length; i++) {
    const prev = subtitles[i - 1];
    const current = subtitles[i];
    const gap = current.startTime - prev.endTime;

    // Agrupar si la pausa es corta (menos de 2 segundos)
    if (gap < 2) {
      currentDialogue.text += " " + current.text;
      currentDialogue.endTime = current.endTime;
      currentDialogue.lines.push(current.text);
    } else {
      // Nuevo diálogo
      dialogues.push(currentDialogue);
      currentDialogue = {
        text: current.text,
        startTime: current.startTime,
        endTime: current.endTime,
        lines: [current.text],
      };
    }
  }

  // Agregar el último diálogo
  dialogues.push(currentDialogue);
  return dialogues;
}

/**
 * Convierte escenas a formato Markdown
 * @param {Array} scenes - Array de escenas
 * @param {Object} options - Opciones de conversión
 * @returns {string} - Contenido en Markdown
 */
function scenesToMarkdown(scenes, options = {}) {
  const {
    includeTimestamps = true,
    groupDialogues: shouldGroupDialogues = true,
    inferScenes = true,
  } = options;

  let markdown = "# Transcripción\n\n";

  scenes.forEach((scene, index) => {
    const sceneNumber = index + 1;
    const startFormatted = formatTime(scene.startTime);
    const endFormatted = formatTime(scene.endTime);
    const duration = Math.round(scene.endTime - scene.startTime);

    // Título de escena
    let sceneTitle = `## Escena ${sceneNumber}`;

    if (inferScenes) {
      const description = inferSceneDescription(scene.subtitles);
      sceneTitle += `: ${description}`;
    }

    markdown += `${sceneTitle}\n\n`;

    if (includeTimestamps) {
      markdown += `**Tiempo**: ${startFormatted} → ${endFormatted} _(${duration}s)_\n\n`;
    }

    // Procesar diálogos
    if (shouldGroupDialogues) {
      const dialogues = groupDialogues(scene.subtitles);
      dialogues.forEach((dialogue) => {
        const time = formatTime(dialogue.startTime);
        markdown += `### ${time}\n\n${dialogue.text}\n\n`;
      });
    } else {
      // Mostrar cada subtítulo individualmente
      scene.subtitles.forEach((subtitle) => {
        const time = formatTime(subtitle.startTime);
        markdown += `### ${time}\n\n${subtitle.text}\n\n`;
      });
    }

    markdown += "---\n\n";
  });

  return markdown;
}

/**
 * Convierte un archivo SRT a Markdown
 * @param {string} srtPath - Ruta al archivo SRT
 * @param {Object} options - Opciones de conversión
 * @returns {Promise<string>} - Contenido en Markdown
 */
export async function srtToMarkdown(srtPath, options = {}) {
  try {
    const srtContent = readFileWithEncoding(srtPath);
    const subtitles = parseSRT(srtContent);

    if (subtitles.length === 0) {
      throw new Error("No se encontraron subtítulos válidos en el archivo");
    }

    const sceneGap = options.sceneGap || 10;
    const scenes = groupIntoScenes(subtitles, sceneGap);
    const markdown = scenesToMarkdown(scenes, options);

    return markdown;
  } catch (error) {
    throw new Error(`Error al convertir SRT: ${error.message}`);
  }
}

/**
 * Obtiene estadísticas de un archivo SRT
 * @param {string} srtPath - Ruta al archivo SRT
 * @returns {Object} - Estadísticas del archivo
 */
export function getSRTStats(srtPath) {
  const srtContent = readFileWithEncoding(srtPath);
  const subtitles = parseSRT(srtContent);

  if (subtitles.length === 0) {
    return {
      subtitles: 0,
      duration: 0,
      scenes: 0,
    };
  }

  const duration = subtitles[subtitles.length - 1].endTime;
  const scenes = groupIntoScenes(subtitles, 5);

  return {
    subtitles: subtitles.length,
    duration: Math.round(duration),
    durationFormatted: formatTime(duration),
    scenes: scenes.length,
    averageSubtitlesPerScene: (subtitles.length / scenes.length).toFixed(1),
  };
}
