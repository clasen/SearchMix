import fs from "node:fs";
import jschardet from "jschardet";
import iconv from "iconv-lite";

/**
 * Detecta el encoding de un archivo y lo lee correctamente
 * @param {string} filePath - Ruta al archivo
 * @returns {string} - Contenido del archivo en UTF-8
 */
export function readFileWithEncoding(filePath) {
  // Leer el archivo como buffer
  const buffer = fs.readFileSync(filePath);

  // Detectar el encoding
  const detected = jschardet.detect(buffer);
  let encoding = detected.encoding || "utf-8";

  // Para archivos de texto, priorizar encodings comunes
  // Si la confianza es baja o detecta windows-1251/1252, probar con encodings comunes
  const commonEncodings = ["UTF-8", "ISO-8859-1", "windows-1252"];

  if (
    detected.confidence < 0.9 ||
    encoding.toLowerCase().includes("windows-125")
  ) {
    // Probar con varios encodings comunes y verificar caracteres válidos
    for (const testEncoding of commonEncodings) {
      try {
        const testContent = iconv.decode(buffer, testEncoding);
        // Verificar si tiene caracteres comunes con acentos (español, portugués, francés, etc.)
        const accentedChars = /[áéíóúñÁÉÍÓÚÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜ¿¡]/;
        if (accentedChars.test(testContent)) {
          encoding = testEncoding;
          return testContent;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Convertir a UTF-8 si es necesario
  if (encoding.toLowerCase() === "utf-8") {
    return buffer.toString("utf-8");
  }

  // Usar iconv-lite para convertir de otros encodings a UTF-8
  try {
    return iconv.decode(buffer, encoding);
  } catch (error) {
    // Si falla la conversión, intentar con UTF-8 como fallback
    console.warn(
      `Warning: Failed to decode ${filePath} with ${encoding}, using UTF-8 fallback`
    );
    return buffer.toString("utf-8");
  }
}
