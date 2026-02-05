import { PDFParse } from "pdf-parse";
import fs from "node:fs";

/**
 * Removes HTML tags and cleans text for metadata
 * @param {string} text - Text that may contain HTML or special characters
 * @returns {string} Clean text
 */
function cleanMetadata(text) {
  if (!text) return text;
  
  let clean = text.toString().trim();
  
  // Remove HTML tags if present
  clean = clean.replace(/<[^>]+>/g, "");
  
  // Decode HTML entities
  clean = clean.replace(/&nbsp;/g, " ");
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&apos;/g, "'");
  clean = clean.replace(/&lt;/g, "<");
  clean = clean.replace(/&gt;/g, ">");
  clean = clean.replace(/&amp;/g, "&");
  
  // Clean up excessive whitespace
  clean = clean.replace(/\s+/g, " ");
  clean = clean.trim();
  
  return clean;
}

/**
 * Formats a PDF date string (D:YYYYMMDDHHmmSS) to ISO date
 * @param {string} dateStr - PDF date string
 * @returns {string} ISO date string or original if parsing fails
 */
function formatPdfDate(dateStr) {
  if (!dateStr) return null;
  
  // PDF dates are in format: D:YYYYMMDDHHmmSS+HH'mm'
  const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Converts plain text from PDF to Markdown format
 * Attempts to detect structure like headings, paragraphs, lists
 * @param {string} text - Plain text from PDF
 * @returns {string} Markdown formatted text
 */
function textToMarkdown(text) {
  if (!text) return "";
  
  // First pass: clean PDF artifacts
  let cleanedText = text
    // Remove page markers
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, "")
    // Remove standalone page numbers on their own line
    .replace(/^\d+$/gm, "")
    // Join hyphenated words across line breaks (covers all cases):
    // "glo-\nbalmente", "sá-\nbado", "sá- \nbado"
    // Use explicit character class to include accented characters
    .replace(/([a-záéíóúñüA-ZÁÉÍÓÚÑÜ]+)-\s*\n\s*([a-záéíóúñüA-ZÁÉÍÓÚÑÜ]+)/g, "$1$2")
    // Join incomplete lines (line doesn't end with punctuation, next starts lowercase)
    // This catches page breaks like "Negro y\nazul"
    .replace(/([a-záéíóúñü,;])\s*\n\s*([a-záéíóúñü])/g, "$1 $2")
    // Clean up multiple blank lines (3+ -> 2)
    .replace(/\n\s*\n\s*\n+/g, "\n\n");
  
  const lines = cleanedText.split("\n");
  const markdown = [];
  let paragraphBuffer = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
    
    // Skip empty lines
    if (!line) {
      if (paragraphBuffer.length > 0) {
        markdown.push(paragraphBuffer.join(" ") + "\n");
        paragraphBuffer = [];
      }
      continue;
    }
    
    // Detect potential headings
    const isShort = line.length < 80;
    const hasUppercaseStart = /^[A-ZÁÉÍÓÚÑÜ]/.test(line);
    const nextLineIsEmpty = !nextLine;
    
    // Common patterns for main chapter titles
    const isChapterPattern = /^(Prólogo|Epílogo|Primera sesión|Segunda sesión|Tercera sesión|Cuarta sesión|Quinta sesión|Sexta sesión|Séptima sesión|Última sesión|Introducción|Conclusión|Capítulo|Chapter|Parte)/i.test(line);
    
    // Check if it's a valid heading:
    // 1. Short line with uppercase start
    // 2. Next line is empty (paragraph break)
    // 3. Doesn't end with common sentence punctuation
    // 4. Not just a few words followed by colon (like "Dijo:")
    const endsWithColon = /:$/.test(line);
    const endsWithPunctuation = /[.;,!?]$/.test(line);
    const veryShort = line.length < 50;
    const wordCount = line.split(/\s+/).length;
    
    // Stricter heading detection
    const looksLikeHeading = 
      isShort && 
      hasUppercaseStart && 
      nextLineIsEmpty && 
      !endsWithPunctuation &&
      !(endsWithColon && wordCount < 5) && // Avoid "Dijo:", "Respondió:", etc.
      wordCount >= 1 && wordCount <= 10; // Not too long, not empty
    
    if (looksLikeHeading) {
      if (paragraphBuffer.length > 0) {
        markdown.push(paragraphBuffer.join(" ") + "\n");
        paragraphBuffer = [];
      }
      
      // Determine heading level
      let level = 2; // Default to h2
      
      // Main chapter markers should be h1
      if (isChapterPattern) {
        level = 1;
      } 
      // Very short and looks important
      else if (veryShort && wordCount <= 3) {
        level = 1;
      }
      
      markdown.push(`${"#".repeat(level)} ${line}\n`);
      continue;
    }
    
    // Check for list items (lines starting with -, •, *, numbers)
    if (/^[-•*]\s/.test(line) || /^\d+[\.)]\s/.test(line)) {
      if (paragraphBuffer.length > 0) {
        markdown.push(paragraphBuffer.join(" ") + "\n");
        paragraphBuffer = [];
      }
      
      // Normalize to markdown list format
      const cleanedLine = line.replace(/^[-•*]\s/, "- ").replace(/^\d+[\.)]\s/, "- ");
      markdown.push(cleanedLine + "\n");
      continue;
    }
    
    // Regular paragraph text - accumulate lines
    paragraphBuffer.push(line);
    
    // End paragraph only if next line is empty (true paragraph break)
    if (nextLineIsEmpty || !nextLine) {
      markdown.push(paragraphBuffer.join(" ") + "\n");
      paragraphBuffer = [];
    }
  }
  
  // Flush remaining paragraph
  if (paragraphBuffer.length > 0) {
    markdown.push(paragraphBuffer.join(" ") + "\n");
  }
  
  // Final cleanup: remove excessive blank lines
  return markdown.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convert PDF file to Markdown
 * @param {string} pdfPath - Path to PDF file
 * @param {Object} options - Conversion options
 * @param {Object} options.metadata - Additional metadata to include
 * @returns {Promise<string>} Markdown content
 */
export async function pdfToMarkdown(pdfPath, options = {}) {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);
    
    // Create PDF parser instance
    const parser = new PDFParse(pdfData);
    
    // Extract metadata
    const pdfInfo = await parser.getInfo();
    const metadata = pdfInfo?.info || {};
    const numpages = pdfInfo?.numPages || 0;
    
    // Extract text content
    const textResult = await parser.getText();
    const plainText = textResult?.text || "";
    
    // Convert plain text to markdown
    const cleanedContent = textToMarkdown(plainText);
    
    // Build YAML front matter if metadata exists
    const hasMetadata = metadata.Title || metadata.Author || metadata.Subject || 
                       metadata.Creator || options.metadata;
    
    if (!hasMetadata) {
      return cleanedContent;
    }
    
    const frontMatter = ["---"];
    
    if (metadata.Title) {
      const title = cleanMetadata(metadata.Title);
      frontMatter.push(`title: "${title}"`);
    }
    
    if (metadata.Author) {
      const author = cleanMetadata(metadata.Author);
      frontMatter.push(`author: "${author}"`);
    }
    
    if (metadata.Subject) {
      const subject = cleanMetadata(metadata.Subject);
      frontMatter.push(`subject: "${subject}"`);
    }
    
    if (metadata.Creator) {
      const creator = cleanMetadata(metadata.Creator);
      frontMatter.push(`creator: "${creator}"`);
    }
    
    if (metadata.CreationDate) {
      const date = formatPdfDate(metadata.CreationDate);
      if (date) {
        frontMatter.push(`date: ${date}`);
      }
    }
    
    // Add page count
    if (numpages > 0) {
      frontMatter.push(`pages: ${numpages}`);
    }
    
    frontMatter.push(`type: pdf`);
    
    // Add any additional metadata from options
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        frontMatter.push(`${key}: ${typeof value === "string" ? `"${value}"` : value}`);
      }
    }
    
    frontMatter.push("---");
    
    return frontMatter.join("\n") + "\n\n" + cleanedContent;

  } catch (error) {
    throw new Error(`Failed to convert PDF: ${error.message}`);
  }
}
