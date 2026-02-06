import pkg from "epub2";
const { EPub } = pkg;

/**
 * Convert EPUB file to Markdown
 * @param {string} epubPath - Path to EPUB file
 * @returns {Promise<string>} Markdown content
 */
export async function epubToMarkdown(epubPath) {
  return new Promise((resolve, reject) => {
    const epub = new EPub(epubPath);

    epub.on("error", (err) => {
      reject(new Error(`Failed to parse EPUB: ${err.message}`));
    });

    epub.on("end", async () => {
      try {
        const markdownParts = [];

        // Add YAML front matter
        const metadata = epub.metadata;
        const hasMetadata =
          metadata.title || metadata.creator || metadata.description || metadata.language || metadata.publisher;
        
        if (hasMetadata) {
          const frontMatter = ["---"];
          if (metadata.title) {
            const cleanTitle = cleanHtmlFromMetadata(metadata.title);
            frontMatter.push(`title: "${cleanTitle}"`);
          }
          if (metadata.creator) {
            const cleanCreator = cleanHtmlFromMetadata(metadata.creator);
            frontMatter.push(`author: "${cleanCreator}"`);
          }
          if (metadata.language) {
            frontMatter.push(`language: ${metadata.language}`);
          }
          if (metadata.publisher) {
            const cleanPublisher = cleanHtmlFromMetadata(metadata.publisher);
            frontMatter.push(`publisher: "${cleanPublisher}"`);
          }
          if (metadata.description) {
            // Clean HTML and escape quotes in description
            const cleanDesc = cleanHtmlFromMetadata(metadata.description);
            const escapedDesc = cleanDesc.replace(/"/g, '\\"').replace(/\n/g, " ");
            frontMatter.push(`description: "${escapedDesc}"`);
          }
          frontMatter.push(`type: epub`);
          frontMatter.push("---");
          markdownParts.push(frontMatter.join("\n") + "\n\n");
        }

        // Add title as main heading
        if (metadata.title) {
          markdownParts.push(`# ${metadata.title}\n\n`);
        }

        // Process each chapter
        const flow = epub.flow || [];
        
        for (const chapter of flow) {
          try {
            const chapterContent = await new Promise((resolve, reject) => {
              epub.getChapter(chapter.id, (error, text) => {
                if (error) reject(error);
                else resolve(text);
              });
            });

            // Convert HTML to basic markdown
            let markdown = htmlToMarkdown(chapterContent);
            
            if (chapter.title) {
              const firstHeadingMatch = markdown.match(/^(?:\s*\n)*(#+)\s+(.+)/);
              const titleNorm = chapter.title.toLowerCase().replace(/[^a-z0-9]/g, "");
              const headingNorm = firstHeadingMatch
                ? firstHeadingMatch[2].toLowerCase().replace(/[^a-z0-9]/g, "")
                : "";
              // Check if title and heading share a common prefix
              const minLen = Math.min(titleNorm.length, headingNorm.length);
              const sharePrefix = minLen >= 5 && titleNorm.slice(0, minLen) === headingNorm.slice(0, minLen);
              
              if (firstHeadingMatch && sharePrefix) {
                // Replace the partial heading with the full chapter title,
                // and remove the orphaned subtitle line that follows (e.g. "(APRIL 2011)")
                const hashes = firstHeadingMatch[1];
                markdown = markdown.replace(
                  /^(?:\s*\n)*#+\s+.+(\n+\([A-Z][A-Za-z\s,0-9]+\)\n?)?/,
                  `${hashes} ${chapter.title}\n`
                );
              } else {
                // Content doesn't have a matching heading, add one
                markdownParts.push(`\n## ${chapter.title}\n`);
              }
            }
            
            markdownParts.push(markdown);
            markdownParts.push("\n");
          } catch (chapterError) {
            // Skip chapters that fail to load
            console.warn(`Failed to load chapter ${chapter.id}:`, chapterError.message);
          }
        }

        resolve(markdownParts.join("\n"));
      } catch (error) {
        reject(new Error(`Failed to convert EPUB to Markdown: ${error.message}`));
      }
    });

    epub.parse();
  });
}

/**
 * Removes HTML tags from metadata fields
 * @param {string} text - Text that may contain HTML
 * @returns {string} Clean text without HTML tags
 */
function cleanHtmlFromMetadata(text) {
  if (!text) return text;
  
  let clean = text;
  
  // Remove all HTML tags
  clean = clean.replace(/<[^>]+>/g, "");
  
  // Decode HTML entities
  clean = clean.replace(/&nbsp;/g, " ");
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&apos;/g, "'");
  clean = clean.replace(/&lt;/g, "<");
  clean = clean.replace(/&gt;/g, ">");
  // Decode numeric HTML entities
  clean = clean.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  clean = clean.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  clean = clean.replace(/&amp;/g, "&");
  
  // Remove duplicated name in brackets: "Name [Name]" → "Name"
  clean = clean.replace(/^(.+?)\s*\[\1\]$/, "$1");
  
  // Clean up excessive whitespace
  clean = clean.replace(/\s+/g, " ");
  clean = clean.trim();
  
  return clean;
}

/**
 * Basic HTML to Markdown converter
 * @param {string} html - HTML content
 * @returns {string} Markdown content
 */
function htmlToMarkdown(html) {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n");

  // Convert emphasis
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Convert links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Convert images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, "![$2]($1)");
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, "![]($1)");

  // Convert lists
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  markdown = markdown.replace(/<ul[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ul>/gi, "\n");
  markdown = markdown.replace(/<ol[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ol>/gi, "\n");

  // Convert paragraphs and line breaks
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n");

  // Convert code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n");
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, " ");
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&apos;/g, "'");
  markdown = markdown.replace(/&lt;/g, "<");
  markdown = markdown.replace(/&gt;/g, ">");
  // Decode numeric HTML entities (decimal &#NNN; and hex &#xHH;)
  markdown = markdown.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  markdown = markdown.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  markdown = markdown.replace(/&amp;/g, "&"); // Must be last to avoid double-decoding

  // Remove carriage returns
  markdown = markdown.replace(/\r/g, "");

  // Remove EPUB image references first (before link stripping)
  markdown = markdown.replace(/!\[[^\]]*\]\([^)]*\)\n*/g, "");

  // Clean internal EPUB links: [text](internal/path) → text
  markdown = markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Strip leading whitespace from each line (preserving markdown headings and list markers)
  markdown = markdown.replace(/^[ \t]+/gm, "");

  // Remove empty headings (# with no text)
  markdown = markdown.replace(/^#{1,6}\s*$/gm, "");

  // Clean up excessive whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();

  return markdown;
}
