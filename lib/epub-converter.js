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

        // Add metadata as frontmatter-style header
        const metadata = epub.metadata;
        if (metadata.title) {
          markdownParts.push(`# ${metadata.title}\n`);
        }
        if (metadata.creator) {
          markdownParts.push(`**Author:** ${metadata.creator}\n`);
        }
        if (metadata.description) {
          markdownParts.push(`${metadata.description}\n`);
        }
        markdownParts.push("---\n");

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
            const markdown = htmlToMarkdown(chapterContent);
            
            // Add chapter title if available
            if (chapter.title) {
              markdownParts.push(`\n## ${chapter.title}\n`);
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
  markdown = markdown.replace(/&amp;/g, "&");

  // Clean up excessive whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();

  return markdown;
}
