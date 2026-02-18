import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractMarkdownFields } from "./parser.js";
import { scanDirectorySync, getPathType, getFileExtension } from "./scanner.js";
import { epubToMarkdown } from "./epub-to-markdown.js";
import { pdfToMarkdown } from "./pdf-to-markdown.js";
import { srtToMarkdown } from "./srt-to-markdown.js";
import { readFileWithEncoding } from "./encoding-utils.js";
import { glob } from "glob";
import { Snippet } from "./Snippet.js";

export class SeekMix {
  /**
   * Create a new SeekMix instance
   * @param {object} options - Configuration options
   * @param {string} options.dbPath - Path to SQLite database (default: "./db/searchmix.db")
   * @param {boolean} options.includeCodeBlocks - Include code blocks in body (default: false)
   * @param {object} options.weights - BM25 weights for scoring
   */
  constructor({
    dbPath = "./db/searchmix.db",
    includeCodeBlocks = false,
    weights = { title: 10.0, h1: 9.0, h2: 7.0, h3: 5.0, h4: 3.0, h5: 2.0, h6: 1.5, body: 1.0 }
  } = {}) {
    this.dbPath = path.resolve(dbPath);
    this.includeCodeBlocks = includeCodeBlocks;
    this.weights = weights;

    // Ensure database directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(this.dbPath);
    this._initializeDatabase();
  }

  /**
   * Normalize text for search (remove accents and convert to lowercase)
   * @private
   */
  _normalizeText(text) {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Normalize search query (handle FTS5 operators and normalize terms)
   * @private
   */
  _normalizeQuery(query) {
    if (!query) return '';
    
    // Replace field prefixes to use normalized columns
    let normalized = query
      .replace(/\btitle:/gi, 'title_normalized:')
      .replace(/\bh1:/gi, 'h1_normalized:')
      .replace(/\bh2:/gi, 'h2_normalized:')
      .replace(/\bh3:/gi, 'h3_normalized:')
      .replace(/\bh4:/gi, 'h4_normalized:')
      .replace(/\bh5:/gi, 'h5_normalized:')
      .replace(/\bh6:/gi, 'h6_normalized:')
      .replace(/\bheadings:/gi, 'headings_normalized:')
      .replace(/\bbody:/gi, 'body_normalized:');
    
    // Normalize search terms while preserving FTS5 operators
    // Split by operators and quotes, normalize only the search terms
    const parts = normalized.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    
    normalized = parts.map(part => {
      // Preserve quoted strings and operators
      if (part.startsWith('"') || part.startsWith("'") || 
          /^(AND|OR|NOT|\(|\)|:)$/i.test(part) ||
          part.includes('_normalized:')) {
        return part;
      }
      
      // Check if this is a field:value pattern
      if (part.includes(':')) {
        const [field, ...valueParts] = part.split(':');
        const value = valueParts.join(':');
        return `${field}:${this._normalizeText(value)}`;
      }
      
      // Normalize regular search terms
      return this._normalizeText(part);
    }).join(' ');
    
    return normalized;
  }

  /**
   * Check if a column exists in the FTS5 table
   * @private
   */
  _columnExists(columnName) {
    try {
      // Try to select the column - if it doesn't exist, it will throw
      this.db.prepare(`SELECT ${columnName} FROM docs_fts LIMIT 1`).get();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Migrate database schema if needed
   * @private
   */
  _migrateSchema() {
    // Check if mtime column exists
    const hasMtime = this._columnExists('mtime');
    
    if (!hasMtime) {
      console.log("⚠️  Migrating database schema to add mtime column...");
      
      // Get all existing documents
      const existingDocs = this.db.prepare(`
        SELECT path, title, h1, h2, h3, h4, h5, h6, body, 
               title_normalized, h1_normalized, h2_normalized, h3_normalized, 
               h4_normalized, h5_normalized, h6_normalized, body_normalized,
               collection, structure, sections_index
        FROM docs_fts
      `).all();
      
      // Drop old table
      this.db.exec(`DROP TABLE IF EXISTS docs_fts`);
      
      // Recreate with new schema
      this.db.exec(`
        CREATE VIRTUAL TABLE docs_fts USING fts5(
          path UNINDEXED,
          title UNINDEXED,
          h1 UNINDEXED,
          h2 UNINDEXED,
          h3 UNINDEXED,
          h4 UNINDEXED,
          h5 UNINDEXED,
          h6 UNINDEXED,
          body UNINDEXED,
          title_normalized,
          h1_normalized,
          h2_normalized,
          h3_normalized,
          h4_normalized,
          h5_normalized,
          h6_normalized,
          body_normalized,
          collection UNINDEXED,
          structure UNINDEXED,
          sections_index UNINDEXED,
          mtime UNINDEXED
        );
      `);
      
      // Reinsert existing documents with null mtime
      const insertStmt = this.db.prepare(`
        INSERT INTO docs_fts (path, title, h1, h2, h3, h4, h5, h6, body,
                             title_normalized, h1_normalized, h2_normalized, h3_normalized,
                             h4_normalized, h5_normalized, h6_normalized, body_normalized,
                             collection, structure, sections_index, mtime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const doc of existingDocs) {
        // Get mtime from file if it exists
        let mtime = null;
        try {
          if (!doc.path.startsWith("buffer://") && fs.existsSync(doc.path)) {
            const stats = fs.statSync(doc.path);
            mtime = stats.mtimeMs;
          }
        } catch (error) {
          // File might not exist anymore, use null mtime
        }
        
        insertStmt.run(
          doc.path, doc.title, doc.h1, doc.h2, doc.h3, doc.h4, doc.h5, doc.h6, doc.body,
          doc.title_normalized, doc.h1_normalized, doc.h2_normalized, doc.h3_normalized,
          doc.h4_normalized, doc.h5_normalized, doc.h6_normalized, doc.body_normalized,
          doc.collection, doc.structure, doc.sections_index, mtime
        );
      }
      
      console.log(`✓ Migration complete! Migrated ${existingDocs.length} documents.`);
    }
  }

  /**
   * Initialize FTS5 table
   * @private
   */
  _initializeDatabase() {
    // Create table if it doesn't exist
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        path UNINDEXED,
        title UNINDEXED,
        h1 UNINDEXED,
        h2 UNINDEXED,
        h3 UNINDEXED,
        h4 UNINDEXED,
        h5 UNINDEXED,
        h6 UNINDEXED,
        body UNINDEXED,
        title_normalized,
        h1_normalized,
        h2_normalized,
        h3_normalized,
        h4_normalized,
        h5_normalized,
        h6_normalized,
        body_normalized,
        collection UNINDEXED,
        structure UNINDEXED,
        sections_index UNINDEXED,
        mtime UNINDEXED
      );
    `);
    
    // Check if migration is needed
    this._migrateSchema();
  }

  /**
   * Add document(s) to the index
   * @param {string|Buffer} pathOrBuffer - File path, directory path, or Buffer
   * @param {object} options - Options
   * @param {string} options.collection - Collection name (default: "main")
   * @param {string[]} options.exclude - Patterns to exclude when scanning directories
   * @param {boolean} options.recursive - Scan directories recursively (default: true)
   * @param {boolean} options.skipExisting - Skip if document already indexed (default: true)
   * @param {boolean} options.update - Update existing documents (default: false)
   * @param {boolean} options.checkModified - Check if files were modified and reindex them (default: true)
   * @returns {Promise<SeekMix>} Returns this for chaining
   */
  async addDocument(pathOrBuffer, {
    collection = "main",
    exclude = ["node_modules", ".git"],
    recursive = true,
    skipExisting = true,
    update = false,
    checkModified = true
  } = {}) {
    // Handle Buffer input (buffers are always new)
    if (Buffer.isBuffer(pathOrBuffer)) {
      const markdown = pathOrBuffer.toString("utf-8");
      const virtualPath = `buffer://${crypto.randomUUID()}`;
      this._indexMarkdown(virtualPath, markdown, collection, null);
      return this;
    }

    // Handle string path
    const targetPath = path.resolve(pathOrBuffer);
    const pathInfo = getPathType(targetPath);

    if (!pathInfo.exists) {
      throw new Error(`Path does not exist: ${pathOrBuffer}`);
    }

    if (pathInfo.isDirectory) {
      // Scan directory and index all files
      await this._indexDirectory(targetPath, collection, exclude, recursive, skipExisting, update, checkModified);
    } else if (pathInfo.isFile) {
      // Check if file needs indexing/reindexing
      if (skipExisting && !update && !checkModified && this.hasDocument(targetPath)) {
        // Skip already indexed documents
        return this;
      }
      
      // Check if file was modified
      if (checkModified && this.hasDocument(targetPath)) {
        const fileStats = fs.statSync(targetPath);
        const currentMtime = fileStats.mtimeMs;
        
        // Get stored mtime
        const storedMtime = this._getDocumentMtime(targetPath);
        
        if (storedMtime && Math.abs(currentMtime - storedMtime) < 1000) {
          // File hasn't changed (1 second tolerance for filesystem variations)
          if (skipExisting && !update) {
            return this;
          }
        }
      }
      
      // Index or reindex file
      await this._indexFile(targetPath, collection);
    }

    return this;
  }

  /**
   * Index a directory of files
   * @private
   */
  async _indexDirectory(dirPath, collection, exclude, recursive, skipExisting, update, checkModified) {
    try {
      const files = scanDirectorySync(dirPath, { exclude, recursive });
      
      // Determine which files need indexing
      const filesToIndex = [];
      
      for (const file of files) {
        const fileExists = this.hasDocument(file);
        
        if (!fileExists) {
          // New file - always index
          filesToIndex.push(file);
        } else if (update || !skipExisting) {
          // Force update/reindex
          filesToIndex.push(file);
        } else if (checkModified && fileExists) {
          // Check if file was modified
          const fileStats = fs.statSync(file);
          const currentMtime = fileStats.mtimeMs;
          const storedMtime = this._getDocumentMtime(file);
          
          if (!storedMtime || Math.abs(currentMtime - storedMtime) >= 1000) {
            // File was modified or no mtime stored (1 second tolerance)
            filesToIndex.push(file);
          }
        }
      }

      if (filesToIndex.length === 0) {
        return; // Nothing to index
      }
      
      // Process files sequentially to handle async conversions
      for (const file of filesToIndex) {
        try {
          await this._indexFile(file, collection);
        } catch (error) {
          console.warn(`Failed to index ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Get document modification time from index
   * @private
   */
  _getDocumentMtime(filePath) {
    const absolutePath = filePath.startsWith("buffer://") ? filePath : path.resolve(filePath);
    
    const result = this.db.prepare(`
      SELECT mtime FROM docs_fts WHERE path = ?
    `).get(absolutePath);
    
    return result ? result.mtime : null;
  }

  /**
   * Index a single file
   * @private
   */
  async _indexFile(filePath, collection) {
    const ext = getFileExtension(filePath);
    
    // Get file modification time for real files (not buffers)
    let mtime = null;
    if (!filePath.startsWith("buffer://") && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      mtime = stats.mtimeMs;
    }
    
    if (ext === "epub") {
      // Convert EPUB to markdown (async operation)
      try {
        const markdown = await epubToMarkdown(filePath);
        this._indexMarkdown(filePath, markdown, collection, mtime);
      } catch (error) {
        console.warn(`Failed to convert EPUB ${filePath}:`, error.message);
      }
    } else if (ext === "pdf") {
      // Convert PDF to markdown (async operation)
      try {
        const markdown = await pdfToMarkdown(filePath);
        this._indexMarkdown(filePath, markdown, collection, mtime);
      } catch (error) {
        console.warn(`Failed to convert PDF ${filePath}:`, error.message);
      }
    } else if (ext === "srt") {
      // Convert SRT to markdown (async operation)
      try {
        const markdown = await srtToMarkdown(filePath);
        this._indexMarkdown(filePath, markdown, collection, mtime);
      } catch (error) {
        console.warn(`Failed to convert SRT ${filePath}:`, error.message);
      }
    } else if (ext === "md" || ext === "markdown") {
      // Read and index markdown with automatic encoding detection
      const markdown = readFileWithEncoding(filePath);
      this._indexMarkdown(filePath, markdown, collection, mtime);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  /**
   * Index markdown content
   * @private
   */
  _indexMarkdown(filePath, markdown, collection, mtime = null) {
    const { title, h1, h2, h3, h4, h5, h6, body, structure, sectionsIndex } = extractMarkdownFields(markdown, {
      includeCodeBlocks: this.includeCodeBlocks
    });

    // body: always store original markdown (preserves formatting like _italic_)
    // body_normalized: normalize the markdown directly (keeps positions aligned)
    const bodyForStorage = markdown;

    // Normalize text for search (just lowercase + remove accents, keep markdown)
    const titleNormalized = this._normalizeText(title);
    const h1Normalized = this._normalizeText(h1);
    const h2Normalized = this._normalizeText(h2);
    const h3Normalized = this._normalizeText(h3);
    const h4Normalized = this._normalizeText(h4);
    const h5Normalized = this._normalizeText(h5);
    const h6Normalized = this._normalizeText(h6);
    const bodyNormalized = this._normalizeText(markdown);  // Normalize markdown directly

    // Serialize structure and sections index (now using IDs, no circular references)
    const structureJSON = JSON.stringify(structure);
    const sectionsIndexJSON = JSON.stringify(sectionsIndex);

    // Check if document already exists (prevent duplicates)
    const existing = this.db.prepare(`
      SELECT path FROM docs_fts WHERE path = ?
    `).get(filePath);

    if (existing) {
      // Update existing document
      this.db.prepare(`
        DELETE FROM docs_fts WHERE path = ?
      `).run(filePath);
    }

    // Insert document
    // body: markdown original if no structure, parsed text if has structure
    // body_normalized: normalized text for search
    this.db.prepare(`
      INSERT INTO docs_fts (path, title, h1, h2, h3, h4, h5, h6, body, title_normalized, h1_normalized, h2_normalized, h3_normalized, h4_normalized, h5_normalized, h6_normalized, body_normalized, collection, structure, sections_index, mtime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(filePath, title, h1, h2, h3, h4, h5, h6, bodyForStorage, titleNormalized, h1Normalized, h2Normalized, h3Normalized, h4Normalized, h5Normalized, h6Normalized, bodyNormalized, collection, structureJSON, sectionsIndexJSON, mtime);
  }

  /**
   * Remove a document from the index
   * @param {string} filePath - Document path to remove
   * @returns {SeekMix} Returns this for chaining
   */
  removeDocument(filePath) {
    const absolutePath = filePath.startsWith("buffer://") ? filePath : path.resolve(filePath);
    
    this.db.prepare(`
      DELETE FROM docs_fts WHERE path = ?
    `).run(absolutePath);

    return this;
  }

  /**
   * Remove all documents in a collection
   * @param {string} name - Collection name
   * @returns {SeekMix} Returns this for chaining
   */
  removeCollection(name) {
    this.db.prepare(`
      DELETE FROM docs_fts WHERE collection = ?
    `).run(name);

    return this;
  }

  /**
   * Search documents
   * @param {string} query - Search query (supports FTS5 syntax)
   * @param {object} options - Search options
   * @param {number} options.limit - Maximum results (default: 20)
   * @param {number|null} options.minScore - Minimum score threshold
   * @param {string|null} options.collection - Filter by collection
   * @param {boolean} options.snippets - Include text snippets (default: true)
   * @param {number} options.snippetLength - Characters around match (default: 150)
   * @param {number} options.limitSnippets - Maximum snippets per document (default: 5)
   * @param {boolean} options.count - Execute COUNT query for totalCount (default: true). Set to false for faster searches when totalCount is not needed.
   * @returns {object} Search results: { results: [Snippet, ...], totalCount: n|null, totalSnippets: m }
   */
  search(query, {
    limit = 20,
    minScore = null,
    collection = null,
    snippets = true,
    snippetLength = 150,
    limitSnippets = 5,
    count = true
  } = {}) {
    const { title: titleWeight, h1: h1Weight, h2: h2Weight, h3: h3Weight, h4: h4Weight, h5: h5Weight, h6: h6Weight, body: bodyWeight } = this.weights;

    // Normalize query for accent and case-insensitive search
    const normalizedQuery = this._normalizeQuery(query);

    let sql = `
      SELECT path, title, h1, h2, h3, h4, h5, h6, body, body_normalized, collection, structure, sections_index,
             bm25(docs_fts, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?) AS rank
      FROM docs_fts
      WHERE docs_fts MATCH ?
    `;

    const params = [titleWeight, h1Weight, h2Weight, h3Weight, h4Weight, h5Weight, h6Weight, bodyWeight, normalizedQuery];

    // Filter by collection if specified
    if (collection) {
      sql += ` AND collection = ?`;
      params.push(collection);
    }

    // Filter by minimum score if specified
    if (minScore !== null) {
      sql += ` AND bm25(docs_fts, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?) >= ?`;
      params.push(titleWeight, h1Weight, h2Weight, h3Weight, h4Weight, h5Weight, h6Weight, bodyWeight, minScore);
    }

    sql += `
      ORDER BY rank
      LIMIT ?
    `;
    params.push(limit);

    const results = this.db.prepare(sql).all(...params);

    // Extract snippets as flat list
    const allSnippets = [];

    for (const result of results) {
      // Parse structure and sections index
      let structure = [];
      let sectionsIndex = {};
      try {
        structure = result.structure ? JSON.parse(result.structure) : [];
        sectionsIndex = result.sections_index ? JSON.parse(result.sections_index) : {};
      } catch (e) {
        console.warn('Failed to parse structure:', e);
      }

      if (snippets) {
        // body and body_normalized have same positions (both are markdown, just different normalization)
        // Use body directly for extraction - positions align correctly
        const rawSnippets = this._extractAllSnippets(query, result.title, result.h1, result.h2, result.h3, result.h4, result.h5, result.h6, result.body, snippetLength, limitSnippets, structure, sectionsIndex, result.path);
        
        // Add document metadata to each snippet
        for (const rawSnippet of rawSnippets) {
          rawSnippet.documentTitle = result.title;
          rawSnippet.collection = result.collection;
          rawSnippet.rank = result.rank;
          allSnippets.push(new Snippet(rawSnippet, this));
        }
      }
    }

    // Get total count of matching documents (without limit) - skip if count: false
    let totalCount = null;
    if (count) {
      let countSql = `
        SELECT COUNT(*) as count
        FROM docs_fts
        WHERE docs_fts MATCH ?
      `;
      const countParams = [normalizedQuery];

      if (collection) {
        countSql += ` AND collection = ?`;
        countParams.push(collection);
      }

      if (minScore !== null) {
        countSql += ` AND bm25(docs_fts, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?) >= ?`;
        countParams.push(titleWeight, h1Weight, h2Weight, h3Weight, h4Weight, h5Weight, h6Weight, bodyWeight, minScore);
      }

      totalCount = this.db.prepare(countSql).get(...countParams).count;
    }

    return {
      results: allSnippets,
      totalCount,
      totalSnippets: allSnippets.length
    };
  }

  /**
   * Find section in structure tree that matches given text (now using IDs)
   * @private
   */
  _findSectionInStructure(structure, text, type, sectionsIndex = {}) {
    const normalizedSearchText = this._normalizeText(text);
    
    // Search in flat index first (faster)
    for (const sectionId in sectionsIndex) {
      const section = sectionsIndex[sectionId];
      const normalizedSectionText = this._normalizeText(section.text || '');
      
      if (section.type === type && normalizedSectionText.includes(normalizedSearchText)) {
        return section;
      }
    }
    
    return null;
  }

  /**
   * Get heading details by ID
   * @param {string} documentPath - Document path
   * @param {string} headingId - Heading ID (e.g., "s0", "s5")
   * @returns {object|null} Heading details or null if not found
   */
  getHeadingById(documentPath, headingId) {
    const absolutePath = documentPath.startsWith("buffer://") ? documentPath : path.resolve(documentPath);
    
    const result = this.db.prepare(`
      SELECT sections_index FROM docs_fts WHERE path = ?
    `).get(absolutePath);

    if (!result || !result.sections_index) {
      return null;
    }

    try {
      const sectionsIndex = JSON.parse(result.sections_index);
      const section = sectionsIndex[headingId];
      
      if (!section) {
        return null;
      }

      // Return section with resolved parent and children details
      const details = {
        id: section.id,
        type: section.type,
        text: section.text,
        depth: section.depth,
        position: section.position,
        contentCount: section.content ? section.content.length : 0
      };

      // Resolve parent
      if (section.parentId && sectionsIndex[section.parentId]) {
        const parent = sectionsIndex[section.parentId];
        details.parent = {
          id: parent.id,
          type: parent.type,
          text: parent.text,
          depth: parent.depth
        };
      }

      // Resolve children
      if (section.childrenIds && section.childrenIds.length > 0) {
        details.children = section.childrenIds
          .map(childId => sectionsIndex[childId])
          .filter(child => child)
          .map(child => ({
            id: child.id,
            type: child.type,
            text: child.text,
            depth: child.depth
          }));
      }

      // Include content if available
      if (section.content && section.content.length > 0) {
        details.content = section.content.map(block => {
          const contentBlock = {
            type: block.type,
            text: block.text
          };
          // Only include lang if it exists (for code blocks)
          if (block.lang) {
            contentBlock.lang = block.lang;
          }
          return contentBlock;
        });
      }

      return details;
    } catch (e) {
      console.warn('Failed to parse sections index:', e);
      return null;
    }
  }

  /**
   * Create navigable snippet object with hierarchy information (lightweight with IDs)
   * @private
   */
  _createNavigableSnippet(text, section, position, structure, sectionsIndex, documentPath) {
    const snippet = {
      text,
      section: section.type || section,
      position,
      documentPath  // Always store document path for getText()
    };

    // If we have structure, enhance the snippet with navigation using IDs
    if (typeof section === 'object' && section.id) {
      
      // Store section ID for reference
      snippet.sectionId = section.id;

      // Add parent ID (lightweight reference)
      if (section.parentId) {
        snippet.parentId = section.parentId;
      }

      // Add children IDs (lightweight references)
      if (section.childrenIds && section.childrenIds.length > 0) {
        snippet.childrenIds = section.childrenIds;
      }

      // Store minimal heading info (type and text for display)
      snippet.heading = {
        id: section.id,
        type: section.type,
        text: section.text,
        depth: section.depth
      };
      
      // Count content blocks (don't include full content)
      if (section.content && section.content.length > 0) {
        snippet.contentCount = section.content.length;
      }
    }

    return snippet;
  }

  /**
   * Extract all snippets showing all occurrences of search terms
   * @private
   */
  _extractAllSnippets(query, title, h1, h2, h3, h4, h5, h6, body, maxLength, limitSnippets, structure = [], sectionsIndex = {}, documentPath = '') {
    // Clean query - remove FTS5 operators and get search terms
    // Preserve * suffix for prefix matching before normalizing
    const searchTerms = query
      .replace(/title_normalized:|h1_normalized:|h2_normalized:|h3_normalized:|h4_normalized:|h5_normalized:|h6_normalized:|body_normalized:|title:|h1:|h2:|h3:|h4:|h5:|h6:|headings:|body:/gi, '')
      .replace(/AND|OR|NOT/gi, '')
      .replace(/[()]/g, '')
      .split(/\s+/)
      .filter(term => term.replace(/\*/g, '').length > 1)
      .map(term => {
        const isPrefix = term.endsWith('*');
        const cleanTerm = this._normalizeText(term.replace(/\*$/, ''));
        const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Exact word: \bterm\b | Prefix: \bterm
        const pattern = isPrefix ? `\\b${escaped}` : `\\b${escaped}\\b`;
        return { text: cleanTerm, regex: new RegExp(pattern, 'g') };
      });

    const snippets = [];
    const sections = [
      { type: 'title', text: title },
      { type: 'h1', text: h1 },
      { type: 'h2', text: h2 },
      { type: 'h3', text: h3 },
      { type: 'h4', text: h4 },
      { type: 'h5', text: h5 },
      { type: 'h6', text: h6 },
      { type: 'body', text: body }
    ];

    // Find all occurrences across all sections
    for (const section of sections) {
      if (!section.text) continue;

      const text = section.text;
      const normalizedText = this._normalizeText(text);

      // Try to find corresponding section in structure for navigation
      let structureSection = null;
      if (Object.keys(sectionsIndex).length > 0 && section.type.startsWith('h')) {
        // For headings, try to find the exact section in structure
        const headingLines = text.split('\n').filter(line => line.trim());
        for (const headingLine of headingLines) {
          structureSection = this._findSectionInStructure(structure, headingLine, section.type, sectionsIndex);
          if (structureSection) break;
        }
      }

      // Special handling for headings - split by lines and match individual headings
      if (section.type.startsWith('h')) {
        const headingLines = text.split('\n').filter(line => line.trim());
        const normalizedHeadingLines = headingLines.map(h => this._normalizeText(h));
        
        for (const termObj of searchTerms) {
          for (let i = 0; i < normalizedHeadingLines.length && snippets.length < limitSnippets; i++) {
            termObj.regex.lastIndex = 0;
            if (termObj.regex.test(normalizedHeadingLines[i])) {
              // Try to find specific section for this heading
              const specificSection = this._findSectionInStructure(structure, headingLines[i], section.type, sectionsIndex);
              
              snippets.push(this._createNavigableSnippet(
                headingLines[i],
                specificSection || section.type,
                text.indexOf(headingLines[i]),
                structure,
                sectionsIndex,
                documentPath
              ));
            }
          }
          if (snippets.length >= limitSnippets) break;
        }
      } else {
        // For title and body, use context-based snippets
        for (const termObj of searchTerms) {
          termObj.regex.lastIndex = 0;
          let match;
          
          while ((match = termObj.regex.exec(normalizedText)) !== null && snippets.length < limitSnippets) {
            const index = match.index;

            // Extract snippet with context
            const start = Math.max(0, index - Math.floor(maxLength / 2));
            const end = Math.min(text.length, start + maxLength);
            
            let snippet = text.slice(start, end).trim();
            
            // Add ellipsis if truncated
            if (start > 0) snippet = '...' + snippet;
            if (end < text.length) snippet = snippet + '...';

            // For body text, try to find which section it belongs to
            let bodySection = section.type;
            if (section.type === 'body' && structure.length > 0) {
              // Find section that contains this content
              const findContentSection = (sections) => {
                for (const sec of sections) {
                  if (sec.content && sec.content.length > 0) {
                    for (const content of sec.content) {
                      if (this._normalizeText(content.text).includes(this._normalizeText(snippet))) {
                        return sec;
                      }
                    }
                  }
                  if (sec.children && sec.children.length > 0) {
                    const found = findContentSection(sec.children);
                    if (found) return found;
                  }
                }
                return null;
              };
              
              const foundSection = findContentSection(structure);
              if (foundSection) {
                bodySection = foundSection;
              }
            }

            snippets.push(this._createNavigableSnippet(
              snippet,
              bodySection,
              index,
              structure,
              sectionsIndex,
              documentPath
            ));
          }

          if (snippets.length >= limitSnippets) break;
        }
      }

      if (snippets.length >= limitSnippets) break;
    }

    // If no snippets found, return first part of document
    if (snippets.length === 0) {
      const fallbackText = body || title || '';
      if (fallbackText.length > 0) {
        const snippet = fallbackText.slice(0, maxLength).trim() + (fallbackText.length > maxLength ? '...' : '');
        const fallbackSection = body ? 'body' : 'title';
        
        // Try to find first section in structure
        let structureSection = fallbackSection;
        if (structure.length > 0 && structure[0]) {
          structureSection = structure[0];
        }
        
        snippets.push(this._createNavigableSnippet(snippet, structureSection, 0, structure, sectionsIndex, documentPath));
      }
    }

    return snippets;
  }

  /**
   * Get a document by exact path
   * @param {string} filePath - Document path
   * @param {object} options - Options
   * @param {number} options.position - Start position in body (for large documents)
   * @param {number} options.length - Length to extract from position (default: 5000)
   * @returns {object|null} Document data or null if not found
   */
  get(filePath, { position = null, length = 5000 } = {}) {
    const absolutePath = filePath.startsWith("buffer://") ? filePath : path.resolve(filePath);
    
    // If position is specified, use substr to get only a portion
    let bodySelect = 'body';
    if (position !== null) {
      // SQLite substr is 1-indexed, JavaScript is 0-indexed
      const sqlPosition = position + 1;
      bodySelect = `substr(body, ${sqlPosition}, ${length}) as body`;
    }
    
    const result = this.db.prepare(`
      SELECT path, title, h1, h2, h3, h4, h5, h6, ${bodySelect}, collection, structure, sections_index
      FROM docs_fts
      WHERE path = ?
    `).get(absolutePath);

    if (!result) {
      return null;
    }

    // Parse structure and sections_index if available
    try {
      if (result.structure) {
        result.structure = JSON.parse(result.structure);
      }
      if (result.sections_index) {
        result.sections_index = JSON.parse(result.sections_index);
      }
    } catch (e) {
      console.warn('Failed to parse structure or sections_index:', e);
    }

    return result;
  }

  /**
   * Get multiple documents by glob pattern
   * @param {string} pattern - Glob pattern (e.g., "journals/2025-05*.md")
   * @returns {object[]} Array of matching documents
   */
  getMultiple(pattern) {
    // Get all paths from database
    const allDocs = this.db.prepare(`
      SELECT path, title, h1, h2, h3, h4, h5, h6, body, collection, structure, sections_index
      FROM docs_fts
    `).all();

    // Filter using glob pattern
    const matches = allDocs.filter(doc => {
      return glob.sync(pattern).some(match => {
        const absoluteMatch = path.resolve(match);
        return doc.path === absoluteMatch;
      });
    });

    // Parse structure and sections_index for each match
    matches.forEach(doc => {
      try {
        if (doc.structure) {
          doc.structure = JSON.parse(doc.structure);
        }
        if (doc.sections_index) {
          doc.sections_index = JSON.parse(doc.sections_index);
        }
      } catch (e) {
        console.warn('Failed to parse structure or sections_index:', e);
      }
    });

    return matches;
  }

  /**
   * Check if a document exists in the index
   * @param {string} filePath - Document path to check
   * @returns {boolean} True if document exists
   */
  hasDocument(filePath) {
    const absolutePath = filePath.startsWith("buffer://") ? filePath : path.resolve(filePath);
    
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM docs_fts
      WHERE path = ?
    `).get(absolutePath);

    return result.count > 0;
  }

  /**
   * Get statistics about indexed documents
   * @param {object} options - Options
   * @param {string|null} options.collection - Get stats for specific collection
   * @returns {object} Statistics
   */
  getStats({ collection = null } = {}) {
    if (collection) {
      // Stats for specific collection
      const { count } = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM docs_fts
        WHERE collection = ?
      `).get(collection);

      return {
        totalDocs: count,
        collection
      };
    }

    // Stats for all collections
    const { totalDocs } = this.db.prepare(`
      SELECT COUNT(*) as totalDocs
      FROM docs_fts
    `).get();

    const collectionStats = this.db.prepare(`
      SELECT collection, COUNT(*) as count
      FROM docs_fts
      GROUP BY collection
    `).all();

    const collections = {};
    for (const { collection, count } of collectionStats) {
      collections[collection] = count;
    }

    return {
      totalDocs,
      collections
    };
  }

  /**
   * Clear all documents from the database
   */
  clear() {
    this.db.prepare(`DELETE FROM docs_fts`).run();
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}
