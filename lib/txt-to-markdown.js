import { readFileWithEncoding } from "./encoding-utils.js";

/**
 * Converts a plain text file to Markdown format
 * @param {string} txtPath - Path to the TXT file
 * @param {Object} options - Conversion options
 * @param {boolean} options.preserveLineBreaks - Preserve all line breaks (default: true)
 * @param {boolean} options.wrapInCodeBlock - Wrap content in code block (default: false)
 * @param {string} options.title - Optional title for the document
 * @param {Object} options.metadata - Additional metadata to include in YAML front matter
 * @returns {Promise<string>} - Markdown content
 */
export async function txtToMarkdown(txtPath, options = {}) {
  try {
    const {
      preserveLineBreaks = true,
      wrapInCodeBlock = false,
      title = null,
      metadata = {}
    } = options;

    const txtContent = readFileWithEncoding(txtPath);

    if (!txtContent || txtContent.trim().length === 0) {
      throw new Error("Text file is empty");
    }

    let markdown = "";

    // Add YAML front matter if there's metadata
    const hasMetadata = title || Object.keys(metadata).length > 0;
    if (hasMetadata) {
      const frontMatter = ["---"];
      if (title) {
        frontMatter.push(`title: "${title}"`);
      }
      frontMatter.push(`type: text`);
      // Add any additional metadata fields
      for (const [key, value] of Object.entries(metadata)) {
        frontMatter.push(`${key}: ${typeof value === "string" ? `"${value}"` : value}`);
      }
      frontMatter.push("---");
      markdown += frontMatter.join("\n") + "\n\n";
    }

    // Add title as heading if provided
    if (title) {
      markdown += `# ${title}\n\n`;
    }

    // Wrap in code block if requested
    if (wrapInCodeBlock) {
      markdown += "```\n" + txtContent + "\n```";
    } else {
      // Convert plain text to markdown-friendly format
      if (preserveLineBreaks) {
        // Keep original formatting
        markdown += txtContent;
      } else {
        // Normalize line breaks - convert double line breaks to paragraphs
        const paragraphs = txtContent.split(/\n\s*\n/);
        markdown += paragraphs
          .map(p => p.replace(/\n/g, " ").trim())
          .filter(p => p.length > 0)
          .join("\n\n");
      }
    }

    return markdown;
  } catch (error) {
    throw new Error(`Error converting TXT: ${error.message}`);
  }
}

/**
 * Gets statistics from a TXT file
 * @param {string} txtPath - Path to the TXT file
 * @returns {Object} - File statistics
 */
export function getTXTStats(txtPath) {
  const txtContent = readFileWithEncoding(txtPath);

  if (!txtContent || txtContent.trim().length === 0) {
    return {
      lines: 0,
      words: 0,
      characters: 0,
      paragraphs: 0
    };
  }

  const lines = txtContent.split("\n").length;
  const words = txtContent.trim().split(/\s+/).length;
  const characters = txtContent.length;
  const paragraphs = txtContent.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  return {
    lines,
    words,
    characters,
    paragraphs
  };
}
