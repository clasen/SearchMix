# 📑 SearchMix

A powerful JavaScript library for indexing and searching Markdown, EPUB, and PDF documents using SQLite FTS5 (Full-Text Search).

## Features

- 🚀 **Fast Full-Text Search** - Powered by SQLite FTS5 with BM25 ranking
- 🧠 **Smart Indexing** - Automatically detects new and modified files, only reindexes what changed
- 📚 **Multiple Formats** - Support for Markdown (.md), EPUB, and PDF files
- 🗂️ **Collections** - Organize documents into logical groups
- 🔗 **Method Chaining** - Fluent API for easy composition
- 💾 **Buffer Support** - Index content directly from memory
- 🎯 **Advanced Search** - FTS5 syntax with column-specific and boolean queries
- 📍 **Context Snippets** - Shows where matches occur with surrounding text
- 🔄 **No Duplicates** - Automatic duplicate detection and updating
- 🌍 **Accent & Case Insensitive** - Search "mediterraneo" to find "MEDITERRÁNEO"
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults

## Installation

```bash
npm install searchmix
```

## Quick Start

```javascript
import SearchMix from "searchmix";

// Create a new instance (uses ./db/searchmix.db by default)
const searcher = new SearchMix();

// Index documents (automatically detects new and modified files)
await searcher.addDocument("./docs");  // Index entire directory

// Call again later - only new/modified files are reindexed (very fast!)
await searcher.addDocument("./docs");

// Search - returns a flat list of snippets
const results = searcher.search("markdown");
console.log(results);
// {
//   results: [
//     Snippet { 
//       text: "...", 
//       documentPath: "...", 
//       documentTitle: "...", 
//       collection: "main",
//       rank: -2.4,
//       section: "body",
//       ...
//     }
//   ],
//   totalCount: 5,      // Total matching documents
//   totalSnippets: 8    // Total snippets found
// }

searcher.close();
```

## API Reference

### Constructor

```javascript
new SearchMix({
  dbPath = "./db/searchmix.db",
  includeCodeBlocks = false,
  weights = { title: 10.0, h1: 5.0, body: 1.0 }
} = {})
```

**Options:**

- `dbPath` (string) - Path to SQLite database file. Default: `"./db/searchmix.db"`
- `includeCodeBlocks` (boolean) - Include code blocks in body text. Default: `false`
- `weights` (object) - BM25 ranking weights for title, h1, and body. Default: `{ title: 10.0, h1: 5.0, body: 1.0 }`

### Methods

#### `addDocument(pathOrBuffer, options)`

Add document(s) to the index. Returns `this` for chaining.

**Parameters:**

- `pathOrBuffer` (string|Buffer) - Can be:
  - Path to a file (`.md`, `.markdown`, `.epub`)
  - Path to a directory (scans recursively)
  - Buffer containing Markdown content
- `options` (object)
  - `collection` (string) - Collection name. Default: `"main"`
  - `exclude` (array) - Patterns to exclude when scanning. Default: `["node_modules", ".git"]`
  - `recursive` (boolean) - Scan directories recursively. Default: `true`
  - `skipExisting` (boolean) - Skip documents already indexed. Default: `true`
  - `update` (boolean) - Update existing documents instead of skipping. Default: `false`
  - `checkModified` (boolean) - Check file modification time and reindex if changed. Default: `true`

**Smart Indexing:**

SearchMix automatically detects and handles changes:
- **New files**: Automatically added to the index
- **Modified files**: Detected by modification time and reindexed automatically
- **Unchanged files**: Skipped (fast - no reindexing needed)

This means you can safely call `addDocument()` repeatedly without worrying about duplicates or performance - it will only reindex files that have actually changed!

**Note:** PDF and EPUB files are converted asynchronously. For immediate search results, use Markdown files or wait ~2 seconds after adding PDFs/EPUBs.

**Example:**

```javascript
// First call: indexes all documents
await searcher.addDocument("./docs");

// Second call: only indexes new or modified files (very fast!)
await searcher.addDocument("./docs");

// Organize by collections
searcher
  .addDocument("./notes", { collection: "notes" })
  .addDocument("./book.epub", { collection: "books" })
  .addDocument(Buffer.from("# Note\nContent"), { collection: "quick" });

// Force update all existing documents
searcher.addDocument("./notes", { update: true });

// Disable automatic change detection
searcher.addDocument("./docs", { checkModified: false });

// Don't skip, always re-index (not recommended)
searcher.addDocument("./notes", { skipExisting: false });
```

**Smart Duplicate Handling:** 
- By default (`skipExisting: true`), documents already in the index are automatically skipped
- Set `update: true` to re-index existing documents with latest content
- Set `skipExisting: false` to always re-index (creates duplicates if path exists)

#### `search(query, options)`

Search indexed documents. Returns a **flat list of snippets** where each snippet includes both match context and document metadata.

**Parameters:**

- `query` (string) - Search query (supports FTS5 syntax)
- `options` (object)
  - `limit` (number) - Maximum documents to search. Default: `20`
  - `minScore` (number|null) - Minimum score threshold. Default: `null`
  - `collection` (string|null) - Filter by collection. Default: `null`
  - `snippets` (boolean) - Include text snippets showing where matches occur. Default: `true`
  - `snippetLength` (number) - Characters of context around matches. Default: `150`
  - `allOccurrences` (boolean) - Return all occurrences as flat list (default: `true`) or one per document. Default: `true`
  - `maxOccurrences` (number) - Maximum occurrences per document when `allOccurrences` is true. Default: `10`

**Returns:** `{ results: [Snippet, ...], totalCount: number, totalSnippets: number }`

- `results` - Array of `Snippet` objects (flat list)
- `totalCount` - Total number of matching documents
- `totalSnippets` - Total number of snippets returned

**Each Snippet includes:**

*Document metadata:*
- `documentPath` - Document path
- `documentTitle` - Document title
- `collection` - Collection name
- `rank` - BM25 relevance score

*Match context:*
- `text` - Text fragment showing the match with context
- `section` - Where found: `'title'`, `'h1'`, `'h2'`, `'h3'`, `'h4'`, `'h5'`, `'h6'`, or `'body'`
- `position` - Character position in document

*Navigation (optional):*
- `heading` - Heading details (id, type, text, depth)
- `sectionId` - Unique section ID
- `parentId` - Parent section ID reference
- `childrenIds` - Array of child section IDs
- `contentCount` - Number of content blocks

*Methods:*
- `getText()` - Get extended text around match
- `getParent()` - Navigate to parent section
- `getChildren()` - Get child sections
- `getContent()` - Get section content blocks
- `getBreadcrumbs()` - Get full hierarchy path
- And more... (see Navigable Snippets section)

**FTS5 Query Syntax:**

```javascript
// Simple search - returns flat list of snippets
const results = searcher.search("postgres backup");
console.log(`Found ${results.totalSnippets} snippets in ${results.totalCount} documents`);

results.results.forEach(snippet => {
  console.log(snippet.documentTitle);
  console.log(`Found in ${snippet.section}: "${snippet.text}"`);
  console.log(`Rank: ${snippet.rank}`);
});

// Get only one snippet per document
const single = searcher.search("postgres", { allOccurrences: false });
// Returns one snippet per matching document

// Column-specific search
searcher.search("title:searchmix");

// Boolean operators
searcher.search("markdown OR sqlite");
searcher.search("sqlite NOT backup");

// Phrase search
searcher.search('"full text search"');

// Search in specific collection
searcher.search("api", { collection: "docs" });

// Filter by relevance
searcher.search("database", { minScore: 0.5 });

// Control snippet length
searcher.search("database", { snippetLength: 200 });

// Disable snippets for faster queries
searcher.search("database", { snippets: false });
```

#### `get(path)`

Get a document by exact path.

**Parameters:**

- `path` (string) - Document path

**Returns:** Document object or `null` if not found.

```javascript
const doc = searcher.get("./docs/README.md");
// { path, title, headings, body, collection }
```

#### `getMultiple(pattern)`

Get multiple documents by glob pattern.

**Parameters:**

- `pattern` (string) - Glob pattern (e.g., `"journals/2025-05*.md"`)

**Returns:** Array of document objects.

```javascript
const docs = searcher.getMultiple("./docs/**/*.md");
```

#### `removeDocument(path)`

Remove a document from the index. Returns `this` for chaining.

```javascript
searcher.removeDocument("./old-note.md");
```

#### `removeCollection(name)`

Remove all documents in a collection. Returns `this` for chaining.

```javascript
searcher.removeCollection("temp");
```

#### `hasDocument(path)`

Check if a document exists in the index.

**Parameters:**

- `path` (string) - Document path

**Returns:** `boolean` - True if document exists

```javascript
if (!searcher.hasDocument("./README.md")) {
  searcher.addDocument("./README.md");
}
```

#### `getStats(options)`

Get statistics about indexed documents.

**Parameters:**

- `options` (object)
  - `collection` (string|null) - Get stats for specific collection. Default: `null`

**Returns:** Statistics object.

```javascript
// All collections
const stats = searcher.getStats();
// { totalDocs: 150, collections: { main: 80, notes: 50, books: 20 } }

// Specific collection
const notesStats = searcher.getStats({ collection: "notes" });
// { totalDocs: 50, collection: "notes" }
```

#### `clear()`

Clear all documents from the database.

```javascript
searcher.clear();
```

#### `close()`

Close the database connection.

```javascript
searcher.close();
```

## Usage Examples

### Basic Usage

```javascript
import SearchMix from "searchmix";

const searcher = new SearchMix();

// Add documents - automatically skips if already indexed
searcher
  .addDocument("./docs")
  .addDocument("./README.md");

// Search - returns flat list of snippets
const results = searcher.search("api documentation");
results.results.forEach(snippet => {
  console.log(`${snippet.documentTitle}`);
  console.log(`  Found in ${snippet.section}:`);
  console.log(`  "${snippet.text}"`);
});

searcher.close();
```

**Note:** Running this multiple times will only index documents once. Already indexed documents are automatically skipped for better performance.

### Using Collections

```javascript
const searcher = new SearchMix({
  dbPath: "./search.db",
  weights: { title: 15.0, headings: 5.0, body: 1.0 }
});

// Organize documents into collections
searcher
  .addDocument("~/notes", { collection: "notes" })
  .addDocument("~/library", { collection: "books" })
  .addDocument("~/work/docs", { collection: "docs" });

// Search in specific collection
const bookResults = searcher.search("javascript", { collection: "books" });

// Search across all collections
const allResults = searcher.search("javascript");

searcher.close();
```

### Working with EPUB Files

```javascript
const searcher = new SearchMix();

// Index EPUB files (automatically converted to markdown)
searcher
  .addDocument("~/library/book1.epub", { collection: "books" })
  .addDocument("~/library", { collection: "books" }); // Scans for all .epub files

// Search within books
const results = searcher.search("chapter", { collection: "books" });

searcher.close();
```

### Buffer Content

```javascript
const searcher = new SearchMix();

// Index markdown from memory
const content = Buffer.from(`
# My Note

Quick thoughts about the project.

## Ideas
- Implement feature X
- Optimize performance
`);

searcher.addDocument(content);

// Search the buffer content
const results = searcher.search("feature");

searcher.close();
```

### Advanced Search with Snippets

```javascript
const searcher = new SearchMix();

searcher.addDocument("./docs");

// Search - returns flat list of snippets (default: all occurrences)
const results = searcher.search("database");
console.log(`Found ${results.totalSnippets} snippets in ${results.totalCount} documents`);

results.results.forEach(snippet => {
  console.log(`\n${snippet.documentTitle}`);
  console.log(`Found in ${snippet.section}:`);
  console.log(`"${snippet.text}"`);
  console.log(`Relevance: ${snippet.rank}`);
});

// Search with one snippet per document
const singleResults = searcher.search("database", { 
  allOccurrences: false
});
// Returns only the first/best match per document

// Column-specific search
const titleResults = searcher.search("title:searchmix");

// Boolean operators
const orResults = searcher.search("markdown OR epub");
const notResults = searcher.search("database NOT backup");

// Phrase search
const phraseResults = searcher.search('"full text search"');

// Control snippet length
const longSnippets = searcher.search("api documentation", {
  snippetLength: 300  // More context
});

// Limit occurrences per document
const limitedResults = searcher.search("api", {
  allOccurrences: true,
  maxOccurrences: 3  // Max 3 snippets per document
});

// Disable snippets for faster queries
const fastResults = searcher.search("api", {
  snippets: false  // Only metadata
});

// Combine with options
const relevantResults = searcher.search("api documentation", {
  minScore: 0.3,
  limit: 10,
  collection: "docs",
  snippetLength: 200
});

searcher.close();
```

### Finding All Occurrences

```javascript
const searcher = new SearchMix();
searcher.addDocument("./docs");

// Find all occurrences - returns flat list of snippets (default behavior)
const results = searcher.search("javascript", { 
  allOccurrences: true,      // Default: true
  maxOccurrences: 10         // Max per document
});

console.log(`Found ${results.totalSnippets} total snippets in ${results.totalCount} documents\n`);

// Group by document if needed
const byDocument = new Map();
results.results.forEach(snippet => {
  if (!byDocument.has(snippet.documentPath)) {
    byDocument.set(snippet.documentPath, []);
  }
  byDocument.get(snippet.documentPath).push(snippet);
});

// Display grouped results
byDocument.forEach((snippets, docPath) => {
  console.log(`\n${snippets[0].documentTitle} (${snippets.length} occurrences)`);
  snippets.forEach((snippet, index) => {
    console.log(`  ${index + 1}. Found in ${snippet.section} at position ${snippet.position}:`);
    console.log(`     "${snippet.text}"\n`);
  });
});

searcher.close();
```

### Navigable Snippets (Lightweight with IDs)

Snippets include hierarchical navigation using **lightweight ID references** instead of full objects, reducing memory usage by up to 99.9%:

```javascript
const searcher = new SearchMix();
searcher.addDocument("./docs");

const results = searcher.search("async", { 
  allOccurrences: true,
  maxOccurrences: 5
});

results.results.forEach(snippet => {
  {
    console.log(`Text: "${snippet.text}"`);
    console.log(`Section: ${snippet.section}`);
    
    // Current heading information
    if (snippet.heading) {
      console.log(`Heading: ${snippet.heading.text} (${snippet.heading.type})`);
      console.log(`ID: ${snippet.heading.id}`);
    }
    
    // Lightweight references (IDs only)
    if (snippet.parentId) {
      console.log(`Parent ID: ${snippet.parentId}`);
    }
    
    if (snippet.childrenIds) {
      console.log(`Children IDs: ${snippet.childrenIds.join(', ')}`);
    }
    
    if (snippet.contentCount) {
      console.log(`Content blocks: ${snippet.contentCount}`);
    }
  }
});

searcher.close();
```

**Navigate Using Snippet Methods:**

Snippets are objects with navigation methods for easy traversal:

```javascript
const snippet = results.results[0];

// Navigate to parent (auto-loads details)
if (snippet.hasParent()) {
  const parent = snippet.getParent();
  console.log(`Parent: ${parent.text}`);
}

// Navigate to children
if (snippet.hasChildren()) {
  const children = snippet.getChildren();
  children.forEach(child => {
    console.log(`Child: ${child.text}`);
  });
}

// Get content
if (snippet.hasContent()) {
  const content = snippet.getContent();
  content.forEach(block => {
    console.log(`[${block.type}] ${block.text}`);
  });
}

// Get breadcrumbs
console.log(snippet.getBreadcrumbsText());
// "Manual > Features > Async/Await"

// Get siblings
const siblings = snippet.getSiblings();
siblings.forEach(sibling => {
  console.log(`Sibling: ${sibling.text}`);
});
```

**Snippet Methods:**

- `hasParent()` - Check if has parent section
- `hasChildren()` - Check if has child sections
- `hasContent()` - Check if has content blocks
- `getParent()` - Get parent section details
- `getChildren()` - Get all child sections
- `getChild(index)` - Get specific child by index
- `getContent()` - Get full content blocks
- `getDetails()` - Get complete section details
- `getBreadcrumbs()` - Get full hierarchy path as array
- `getBreadcrumbsText(separator)` - Get breadcrumbs as string
- `getAncestorAtDepth(depth)` - Find ancestor at specific level
- `getSiblings()` - Get sections at same level
- `toString()` - String representation
- `toJSON()` - Plain object for serialization

**Advanced: Direct Access (if needed):**

You can also use `getHeadingById()` directly:

```javascript
const details = searcher.getHeadingById(
  snippet.documentPath,
  snippet.heading.id
);
```

**Snippet Properties (Lightweight):**

- `text` - The snippet text with context
- `section` - Section type: `'title'`, `'h1'`, `'h2'`, `'h3'`, `'h4'`, `'h5'`, `'h6'`, or `'body'`
- `position` - Character position in the original text
- `documentPath` - Document path (for use with `getHeadingById`)
- `sectionId` - Unique section ID
- `heading` (optional) - Basic heading info:
  - `id` - Heading ID
  - `type` - Heading type (e.g., `'h2'`)
  - `text` - Heading text
  - `depth` - Heading level (1-6)
- `parentId` (optional) - Parent section ID reference
- `childrenIds` (optional) - Array of child section ID references
- `contentCount` (optional) - Number of content blocks

**Memory Optimization:**

For a 240-section book:
- **Before**: 1928 KB loaded per search
- **Now**: 1.74 KB loaded per search (99.9% reduction!)
- **Details loaded on-demand**: Only ~1-5 KB when calling `getHeadingById()`

**Use Cases:**

- **Memory Efficient**: Handle large documents without memory issues
- **Fast Searches**: Don't load unnecessary data upfront
- **On-Demand Navigation**: Load parent/child/content details only when needed
- **Breadcrumbs**: Build navigation paths by traversing parent IDs
- **Context Loading**: Get full section content when user clicks on a result

See `examples/lightweight-navigation.js` and `examples/LIGHTWEIGHT-NAVIGATION.md` for complete examples.

### Smart Indexing (Automatic Duplicate Prevention)

```javascript
const searcher = new SearchMix();

// By default, documents are automatically skipped if already indexed
searcher.addDocument("./docs");  // First time - indexes all files
searcher.addDocument("./docs");  // Second time - skips (already indexed)

// Force update existing documents
searcher.addDocument("./docs", { update: true });  // Re-indexes everything

// Check if specific document exists (optional, library handles this automatically)
if (!searcher.hasDocument("./new-doc.md")) {
  console.log("New document will be indexed");
}

searcher.close();
```

**Benefits:**
- No manual checking needed
- Fast re-runs (skips already indexed documents)
- Prevents accidental duplicates
- Use `update: true` when documents have changed

### Accent & Case Insensitive Search

SearchMix automatically normalizes text for searching, making searches insensitive to accents and case:

```javascript
const searcher = new SearchMix();

// Index document with accented text
const doc = Buffer.from(`
# Viajes por el Mediterráneo

## MEDITERRÁNEO I
El mar Mediterráneo es importante.

## Visita a París
París es la capital de Francia.
`);

searcher.addDocument(doc);

// All these queries will find the same results:
searcher.search("mediterraneo");    // Finds "MEDITERRÁNEO", "Mediterráneo"
searcher.search("MEDITERRÁNEO");    // Same results
searcher.search("Mediterráneo");    // Same results

searcher.search("paris");           // Finds "París"
searcher.search("París");           // Same results

// Works with field-specific search too
searcher.search("headings:mediterraneo");  // Finds headings with "MEDITERRÁNEO"

searcher.close();
```

**Benefits:**
- Search naturally without worrying about accents or case
- Especially useful for multilingual content (Spanish, French, Portuguese, etc.)
- Original formatting is preserved in results and snippets
- Works with all FTS5 query operators (AND, OR, NOT, phrases, etc.)

**Note:** If you have an existing database created before this feature, you'll need to re-index your documents to enable accent-insensitive search:

```javascript
const searcher = new SearchMix();
searcher.addDocument("./docs", { update: true });  // Re-index with new schema
```

## How It Works

SearchMix uses SQLite's FTS5 (Full-Text Search 5) extension to provide fast, efficient full-text search capabilities:

1. **Parsing** - Markdown and EPUB files are parsed to extract structured content:
   - `title` - First h1 heading
   - `headings` - All other headings (h2-h6)
   - `body` - Paragraph text (and optionally code blocks)

2. **Indexing** - Content is stored in an FTS5 virtual table with separate columns for title, headings, and body

3. **Ranking** - Search results are ranked using BM25 algorithm with configurable weights

4. **Collections** - Documents can be organized into collections for better organization and filtered searching

## Supported File Types

- **Markdown** - `.md`, `.markdown`
- **EPUB** - `.epub` (automatically converted to Markdown)
- **PDF** - `.pdf` (automatically converted to Markdown)

## Configuration

### Database Path

By default, SearchMix uses `./db/searchmix.db`. You can customize this:

```javascript
const searcher = new SearchMix({ dbPath: "./custom/path.db" });
```

### BM25 Weights

Adjust ranking weights to prioritize different parts of documents:

```javascript
const searcher = new SearchMix({
  weights: {
    title: 15.0,      // Matches in title are most important
    h1: 5.0,    // H1 are moderately important
    body: 1.0         // Body text has normal weight
  }
});
```

### Code Blocks

Include code blocks in the searchable body text:

```javascript
const searcher = new SearchMix({ includeCodeBlocks: true });
```

## Performance Tips

- Use **collections** to organize documents and narrow search scope
- Set **minScore** to filter out irrelevant results
- Use **limit** to control the number of results returned
- For large directories, consider excluding irrelevant paths with the `exclude` option

## Error Handling

```javascript
try {
  const searcher = new SearchMix();
  searcher.addDocument("./nonexistent");
} catch (error) {
  console.error("Error:", error.message);
  // "Path does not exist: ./nonexistent"
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
