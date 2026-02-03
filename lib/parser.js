import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";

/**
 * Recursively extract text from a node and its children
 * @param {object} node - AST node
 * @returns {string} Extracted text
 */
function extractTextFromNode(node) {
  if (!node) return "";
  
  // Direct text node
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value || "";
  }
  
  // Node with children (emphasis, strong, link, etc.)
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(child => extractTextFromNode(child)).join("");
  }
  
  return "";
}

/**
 * Extract structured fields from Markdown content
 * @param {string} markdown - Markdown content to parse
 * @param {object} options - Parser options
 * @param {boolean} options.includeCodeBlocks - Whether to include code blocks in body
 * @returns {object} Extracted fields: { title, h1, h2, h3, h4, h5, h6, body, structure }
 */
export function extractMarkdownFields(markdown, { includeCodeBlocks = false } = {}) {
  const tree = unified().use(remarkParse).parse(markdown);

  let title = "";
  const h1 = [];
  const h2 = [];
  const h3 = [];
  const h4 = [];
  const h5 = [];
  const h6 = [];
  const bodyParts = [];

  // Structure to maintain document hierarchy
  const structure = [];
  const stack = []; // Stack to track current heading hierarchy
  const sectionsIndex = {}; // Flat index of all sections by ID
  let currentSection = null;
  let sectionIdCounter = 0; // Counter for unique IDs

  visit(tree, (node, index, parent) => {
    // Extract headings
    if (node.type === "heading") {
      const text = (node.children || [])
        .map(child => extractTextFromNode(child))
        .join("")
        .trim();

      if (!text) return;

      // Create section object with unique ID
      const sectionId = `s${sectionIdCounter++}`;
      const section = {
        id: sectionId,
        type: `h${node.depth}`,
        depth: node.depth,
        text: text,
        content: [],
        childrenIds: [], // Store IDs instead of objects
        parentId: null,  // Store ID instead of object
        position: {
          start: node.position?.start,
          end: node.position?.end
        }
      };
      
      // Add to flat index for quick lookup
      sectionsIndex[sectionId] = section;

      if (node.depth === 1 && !title) {
        title = text;
      } else {
        // Add to appropriate heading level array
        switch (node.depth) {
          case 1: h1.push(text); break;
          case 2: h2.push(text); break;
          case 3: h3.push(text); break;
          case 4: h4.push(text); break;
          case 5: h5.push(text); break;
          case 6: h6.push(text); break;
        }
      }

      // Update hierarchy
      // Pop sections from stack that are at same or deeper level
      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      // Set parent relationship using IDs
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        section.parentId = parent.id;
        parent.childrenIds.push(section.id);
      } else {
        // Top-level section
        structure.push(section);
      }

      // Push current section to stack
      stack.push(section);
      currentSection = section;

      return;
    }

    // Collect paragraph text for body
    if (node.type === "paragraph") {
      const text = (node.children || [])
        .map(child => extractTextFromNode(child))
        .join("")
        .trim();
      
      if (text) {
        bodyParts.push(text);
        
        // Add to current section's content
        if (currentSection) {
          currentSection.content.push({
            type: "paragraph",
            text: text,
            position: {
              start: node.position?.start,
              end: node.position?.end
            }
          });
        } else {
          // Content before any heading
          const orphanId = `s${sectionIdCounter++}`;
          const orphanContent = {
            id: orphanId,
            type: "body",
            depth: 0,
            text: null,
            content: [{
              type: "paragraph",
              text: text,
              position: {
                start: node.position?.start,
                end: node.position?.end
              }
            }],
            childrenIds: [],
            parentId: null
          };
          structure.push(orphanContent);
          sectionsIndex[orphanId] = orphanContent;
        }
      }
    }

    // Optionally include code blocks
    if (includeCodeBlocks && node.type === "code") {
      const text = node.value?.trim();
      if (text) {
        bodyParts.push(text);
        
        // Add to current section's content
        if (currentSection) {
          currentSection.content.push({
            type: "code",
            text: text,
            lang: node.lang,
            position: {
              start: node.position?.start,
              end: node.position?.end
            }
          });
        }
      }
    }
  });

  return {
    title,
    h1: h1.join("\n"),
    h2: h2.join("\n"),
    h3: h3.join("\n"),
    h4: h4.join("\n"),
    h5: h5.join("\n"),
    h6: h6.join("\n"),
    body: bodyParts.join("\n\n"),
    structure, // Document hierarchical structure (tree)
    sectionsIndex, // Flat index of all sections by ID
  };
}
