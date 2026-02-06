/**
 * Snippet class with navigation methods
 */
export class Snippet {
  /**
   * Create a snippet instance
   * @param {object} data - Snippet data
   * @param {object} searcher - SearchMix instance for queries
   */
  constructor(data, searcher) {
    // Basic properties
    this.text = data.text;
    this.section = data.section;
    this.position = data.position;
    
    // Document metadata
    this.documentPath = data.documentPath;
    this.documentTitle = data.documentTitle;
    this.tags = data.tags || [];
    this.rank = data.rank;
    
    // Navigation properties
    this.sectionId = data.sectionId;
    this.heading = data.heading;
    this.parentId = data.parentId;
    this.childrenIds = data.childrenIds;
    this.contentCount = data.contentCount;
    
    // Store searcher reference for lazy loading
    this._searcher = searcher;
    
    // Cache for loaded data
    this._cache = {
      parent: null,
      children: null,
      content: null,
      details: null
    };
  }

  /**
   * Get parent section details
   * @returns {object|null} Parent section or null if no parent
   */
  getParent() {
    if (!this.parentId) {
      return null;
    }
    
    // Return cached if available
    if (this._cache.parent) {
      return this._cache.parent;
    }
    
    // Load and cache
    this._cache.parent = this._searcher.getHeadingById(
      this.documentPath,
      this.parentId
    );
    
    return this._cache.parent;
  }

  /**
   * Get all children sections
   * @returns {Array} Array of child sections
   */
  getChildren() {
    if (!this.childrenIds || this.childrenIds.length === 0) {
      return [];
    }
    
    // Return cached if available
    if (this._cache.children) {
      return this._cache.children;
    }
    
    // Load and cache
    this._cache.children = this.childrenIds
      .map(childId => this._searcher.getHeadingById(this.documentPath, childId))
      .filter(child => child !== null);
    
    return this._cache.children;
  }

  /**
   * Get a specific child by index
   * @param {number} index - Child index
   * @returns {object|null} Child section or null
   */
  getChild(index) {
    const children = this.getChildren();
    return children[index] || null;
  }

  /**
   * Get full content of this section
   * @returns {Array} Array of content blocks
   */
  getContent() {
    if (!this.sectionId) {
      return [];
    }
    
    // Return cached if available
    if (this._cache.content) {
      return this._cache.content;
    }
    
    // Load details to get content
    const details = this.getDetails();
    this._cache.content = details?.content || [];
    
    return this._cache.content;
  }

  /**
   * Get full details of this section
   * @returns {object|null} Section details
   */
  getDetails() {
    if (!this.sectionId) {
      return null;
    }
    
    // Return cached if available
    if (this._cache.details) {
      return this._cache.details;
    }
    
    // Load and cache
    this._cache.details = this._searcher.getHeadingById(
      this.documentPath,
      this.sectionId
    );
    
    return this._cache.details;
  }

  /**
   * Get breadcrumbs (full path from root to this section)
   * @returns {Array} Array of breadcrumb objects
   */
  getBreadcrumbs() {
    const breadcrumbs = [];
    let currentId = this.sectionId;
    
    while (currentId) {
      const details = this._searcher.getHeadingById(this.documentPath, currentId);
      if (!details) break;
      
      breadcrumbs.unshift({
        id: details.id,
        type: details.type,
        text: details.text,
        depth: details.depth
      });
      
      currentId = details.parent?.id;
    }
    
    return breadcrumbs;
  }

  /**
   * Get breadcrumb text as string
   * @param {string} separator - Separator between breadcrumbs (default: " > ")
   * @returns {string} Breadcrumb text
   */
  getBreadcrumbsText(separator = " > ") {
    return this.getBreadcrumbs()
      .map(crumb => crumb.text)
      .join(separator);
  }

  /**
   * Check if this section has a parent
   * @returns {boolean}
   */
  hasParent() {
    return this.parentId !== null && this.parentId !== undefined;
  }

  /**
   * Check if this section has children
   * @returns {boolean}
   */
  hasChildren() {
    return this.childrenIds && this.childrenIds.length > 0;
  }

  /**
   * Check if this section has content
   * @returns {boolean}
   */
  hasContent() {
    return this.contentCount && this.contentCount > 0;
  }

  /**
   * Navigate to ancestor at specific depth
   * @param {number} depth - Depth level (1 for h1, 2 for h2, etc.)
   * @returns {object|null} Ancestor section or null
   */
  getAncestorAtDepth(depth) {
    let current = this.getDetails();
    
    while (current && current.depth > depth) {
      if (!current.parent) break;
      current = this._searcher.getHeadingById(this.documentPath, current.parent.id);
    }
    
    return (current && current.depth === depth) ? current : null;
  }

  /**
   * Get siblings (sections at same level with same parent)
   * @returns {Array} Array of sibling sections (excluding this one)
   */
  getSiblings() {
    const parent = this.getParent();
    
    if (!parent || !parent.children) {
      return [];
    }
    
    // Get all children of parent, excluding this section
    return parent.children
      .filter(child => child.id !== this.sectionId)
      .map(child => this._searcher.getHeadingById(this.documentPath, child.id))
      .filter(sibling => sibling !== null);
  }

  /**
   * Get extended text around this snippet
   * For documents with structure: returns section content in markdown format
   * For documents without structure: returns text range from body
   * @param {object} options - Options
   * @param {number} options.length - Length of text to retrieve (default: 5000)
   * @param {number} options.offset - Characters to skip from start of match (default: 0)
   * @returns {string} Extended text
   */
  getText({ length = 5000, offset = 0 } = {}) {
    // If has structure and section content, return formatted content
    if (this.hasContent()) {
      const content = this.getContent();
      let markdown = '';
      
      // Add heading if exists
      if (this.heading) {
        const prefix = '#'.repeat(this.heading.depth || 1);
        markdown += `${prefix} ${this.heading.text}\n\n`;
      }
      
      // Add content blocks
      content.forEach(block => {
        if (block.type === 'paragraph') {
          markdown += `${block.text}\n\n`;
        } else if (block.type === 'list') {
          markdown += `${block.text}\n\n`;
        } else if (block.type === 'code') {
          markdown += `\`\`\`\n${block.text}\n\`\`\`\n\n`;
        } else {
          markdown += `${block.text}\n\n`;
        }
      });
      
      return markdown.trim();
    }
    
    // For documents without structure, use position directly
    // (body and body_normalized now have same length, positions align)
    if (this.documentPath && this.position !== undefined) {
      const doc = this._searcher.get(this.documentPath);
      
      if (doc && doc.body) {
        const start = Math.max(0, this.position + offset);
        const end = Math.min(doc.body.length, start + length);
        return doc.body.substring(start, end);
      }
    }
    
    // Fallback to snippet text
    return this.text;
  }

  /**
   * Convert to plain object (for JSON serialization)
   * @returns {object}
   */
  toJSON() {
    return {
      text: this.text,
      section: this.section,
      position: this.position,
      documentPath: this.documentPath,
      documentTitle: this.documentTitle,
      tags: this.tags,
      rank: this.rank,
      sectionId: this.sectionId,
      heading: this.heading,
      parentId: this.parentId,
      childrenIds: this.childrenIds,
      contentCount: this.contentCount
    };
  }

  /**
   * String representation
   * @returns {string}
   */
  toString() {
    if (this.heading) {
      return `[Snippet: ${this.heading.text} (${this.heading.type})]`;
    }
    return `[Snippet: ${this.text.substring(0, 50)}...]`;
  }
}
