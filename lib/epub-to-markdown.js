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

        // Build a map of anchor IDs → heading info from the TOC
        const tocMap = buildTocMap(epub.toc || []);

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

            // Skip auto-generated "Document Outline" pages
            if (isDocumentOutline(chapterContent)) {
              continue;
            }

            // Inject proper heading tags based on TOC anchors before conversion
            const enrichedHtml = injectTocHeadings(chapterContent, tocMap);

            // Convert HTML to basic markdown
            let markdown = htmlToMarkdown(enrichedHtml);
            
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
 * Build a map of anchor IDs to heading info from the TOC
 * @param {Array} toc - TOC entries from epub.toc
 * @returns {Map<string, {title: string, level: number}>}
 */
function buildTocMap(toc) {
  const map = new Map();
  for (const entry of toc) {
    // Extract anchor ID from href (e.g., "index_split_000.html#p17" → "p17")
    const match = entry.href?.match(/#(.+)$/);
    if (match) {
      // TOC level 0 → h2, level 1 → h3, etc. (h1 is reserved for book title)
      const headingLevel = (entry.level || 0) + 2;
      map.set(match[1], {
        title: entry.title,
        level: headingLevel,
      });
    }
  }
  return map;
}

/**
 * Detect auto-generated "Document Outline" pages
 * @param {string} html - Chapter HTML content
 * @returns {boolean}
 */
function isDocumentOutline(html) {
  return /<h1[^>]*>\s*Document Outline\s*<\/h1>/i.test(html);
}

/**
 * Inject proper heading tags into HTML based on TOC anchor positions.
 * Many EPUBs use <p><b>TITLE</b></p> instead of <h1>/<h2>/<h3> tags.
 * This function finds TOC anchor points and replaces the surrounding
 * bold-in-paragraph pattern with proper heading tags.
 * @param {string} html - Chapter HTML content
 * @param {Map<string, {title: string, level: number}>} tocMap - Anchor→heading map
 * @returns {string} HTML with heading tags injected
 */
function injectTocHeadings(html, tocMap) {
  if (tocMap.size === 0) return html;

  let result = html;

  for (const [anchorId, { title, level }] of tocMap) {
    // Pattern: <a id="pXX"></a> possibly followed by another anchor,
    // then <b class="...">TITLE TEXT</b> within the same or next <p> tag.
    // We need to replace the bold text with a proper heading tag.
    
    // Match: <p...><a id="anchorId"></a> (optional extra anchors) <b...>TEXT</b></p>
    const escapedId = anchorId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(<p[^>]*>\\s*)?` +                     // optional opening <p>
      `<a\\s+id="${escapedId}"[^>]*>\\s*</a>` + // the TOC anchor
      `(?:\\s*<a\\s+id="[^"]*"[^>]*>\\s*</a>)*` + // optional extra anchors
      `\\s*<b[^>]*>([^<]*)</b>` +              // bold title text
      `(\\s*</p>)?`,                           // optional closing </p>
      "i"
    );

    result = result.replace(pattern, (match, openP, boldText) => {
      const hTag = `h${Math.min(level, 6)}`;
      return `<${hTag}>${boldText.trim()}</${hTag}>`;
    });
  }

  return result;
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
export function htmlToMarkdown(html) {
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
  // Escape literal '#' at the start of paragraph text to prevent false markdown headings
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, (match, content) => {
    const trimmed = content.trimStart();
    if (trimmed.startsWith("#")) {
      return `\\${trimmed}\n\n`;
    }
    return `${content}\n\n`;
  });
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
