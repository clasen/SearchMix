import pdf2md from "@opendocsg/pdf2md";
import fs from "node:fs";

/**
 * Convert PDF file to Markdown
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Markdown content
 */
export async function pdfToMarkdown(pdfPath) {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const markdown = await pdf2md(pdfBuffer);
    return markdown
      .replace(/\n\n\n(?!#)/g, '')
      .replace(/\n(#+)/g, '\n\n$1')
      .replace(/\n\n\n/g, '\n');

  } catch (error) {
    throw new Error(`Failed to convert PDF: ${error.message}`);
  }
}
