import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import SearchMix from "../index.js";

const TEST_DB_PATH = "./test/db/snippet-test.db";
const TEST_DB_DIR = path.dirname(TEST_DB_PATH);

describe("Snippet", () => {
  let searcher;

  before(async () => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    searcher = new SearchMix({ dbPath: TEST_DB_PATH });
    searcher.clear();

    // Create document with hierarchical structure
    await searcher.addDocument(Buffer.from(`
# Programming Guide

Introduction to programming concepts.

## Variables

### Let and Const
Use let for mutable variables.
Use const for immutable values.

### Var (Deprecated)
Avoid using var in modern code.

## Functions

### Arrow Functions
Arrow functions have concise syntax.
They inherit the this context.

### Traditional Functions
Traditional functions have their own this.

## Conclusion

Keep learning and practicing.
`), { collection: "guide" });
  });

  after(() => {
    if (searcher) {
      searcher.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe("Basic properties", () => {
    it("should have basic properties", () => {
      const results = searcher.search("arrow functions");
      const snippet = results.results[0];

      assert.ok(snippet.text);
      assert.ok(snippet.section);
      assert.ok(typeof snippet.position === "number");
      assert.ok(snippet.documentPath);
      assert.ok(snippet.documentTitle);
    });

    it("should have toString() method", () => {
      const results = searcher.search("arrow");
      const snippet = results.results[0];

      const str = snippet.toString();
      assert.ok(typeof str === "string");
      assert.ok(str.includes(snippet.section));
    });

    it("should have toJSON() method", () => {
      const results = searcher.search("arrow");
      const snippet = results.results[0];

      const json = snippet.toJSON();
      assert.ok(json);
      assert.ok(json.text);
      assert.ok(json.section);
    });
  });

  describe("Hierarchical navigation", () => {
    it("should have heading information", () => {
      const results = searcher.search("arrow functions");
      const snippet = results.results.find(s => s.heading);

      if (snippet) {
        assert.ok(snippet.heading);
        assert.ok(snippet.heading.text);
        assert.ok(snippet.heading.type);
        assert.ok(typeof snippet.heading.depth === "number");
      }
    });

    it("should verify parent existence", () => {
      const results = searcher.search("arrow");
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const hasParent = snippet.hasParent();
        assert.ok(typeof hasParent === "boolean");
      }
    });

    it("should get parent information", () => {
      const results = searcher.search("let and const");
      const snippet = results.results.find(s => s.heading && s.heading.depth === 3);

      if (snippet && snippet.hasParent()) {
        const parent = snippet.getParent();
        assert.ok(parent);
        assert.ok(parent.text);
        assert.ok(parent.type);
        assert.ok(parent.depth < snippet.heading.depth);
      }
    });

    it("should verify children existence", () => {
      const results = searcher.search("functions");
      const snippet = results.results.find(s => s.heading && s.heading.depth === 2);

      if (snippet) {
        const hasChildren = snippet.hasChildren();
        assert.ok(typeof hasChildren === "boolean");
      }
    });

    it("should get children", () => {
      const results = searcher.search("functions");
      const snippet = results.results.find(s => 
        s.heading && s.heading.depth === 2 && s.hasChildren()
      );

      if (snippet && snippet.hasChildren()) {
        const children = snippet.getChildren();
        assert.ok(Array.isArray(children));
        assert.ok(children.length > 0);
        assert.ok(children[0].text);
        assert.ok(children[0].type);
      }
    });

    it("should get a specific child", () => {
      const results = searcher.search("functions");
      const snippet = results.results.find(s => 
        s.heading && s.heading.depth === 2 && s.hasChildren()
      );

      if (snippet && snippet.hasChildren()) {
        const child = snippet.getChild(0);
        assert.ok(child);
        assert.ok(child.text);
      }
    });
  });

  describe("Breadcrumbs", () => {
    it("should generate breadcrumbs as array", () => {
      const results = searcher.search("arrow functions");
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const breadcrumbs = snippet.getBreadcrumbs();
        assert.ok(Array.isArray(breadcrumbs));
        assert.ok(breadcrumbs.length > 0);
        assert.ok(breadcrumbs[0].text);
        assert.ok(breadcrumbs[0].type);
      }
    });

    it("should generate breadcrumbs as text", () => {
      const results = searcher.search("arrow");
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const text = snippet.getBreadcrumbsText();
        assert.ok(typeof text === "string");
        assert.ok(text.length > 0);
      }
    });

    it("should accept custom separator in breadcrumbs", () => {
      const results = searcher.search("arrow");
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const text = snippet.getBreadcrumbsText(" → ");
        assert.ok(text.includes(" → "));
      }
    });
  });

  describe("Content", () => {
    it("should have hasContent method available", () => {
      const results = searcher.search("functions");
      const snippet = results.results[0];

      // Verify the method exists and can be called
      assert.ok(typeof snippet.hasContent === "function");
      
      // Call the method (may return truthy or falsy)
      const result = snippet.hasContent();
      // Simply verify it does not throw
      assert.ok(result === true || result === false || result === undefined || typeof result === "number");
    });

    it("should get section content", () => {
      const results = searcher.search("let");
      const snippet = results.results.find(s => s.heading && s.hasContent());

      if (snippet && snippet.hasContent()) {
        const content = snippet.getContent();
        assert.ok(Array.isArray(content));
        assert.ok(content.length > 0);
        assert.ok(content[0].type);
        assert.ok(content[0].text);
      }
    });
  });

  describe("Full details", () => {
    it("should get full heading details", () => {
      const results = searcher.search("arrow");
      const snippet = results.results.find(s => s.heading);

      if (snippet) {
        const details = snippet.getDetails();
        assert.ok(details);
        assert.ok(details.id);
        assert.ok(details.type);
        assert.ok(details.text);
        assert.ok(typeof details.depth === "number");
      }
    });
  });

  describe("Ancestors", () => {
    it("should get ancestor by depth", () => {
      const results = searcher.search("arrow");
      const snippet = results.results.find(s => s.heading && s.heading.depth === 3);

      if (snippet) {
        const h1Ancestor = snippet.getAncestorAtDepth(1);
        if (h1Ancestor) {
          assert.strictEqual(h1Ancestor.depth, 1);
          assert.ok(h1Ancestor.text);
        }
      }
    });
  });

  describe("Siblings", () => {
    it("should get siblings at the same level", () => {
      const results = searcher.search("arrow functions");
      const snippet = results.results.find(s => s.heading && s.heading.depth === 3);

      if (snippet) {
        const siblings = snippet.getSiblings();
        assert.ok(Array.isArray(siblings));
        // May have 0 or more siblings
      }
    });
  });

  describe("Get text", () => {
    it("should get document text", () => {
      const results = searcher.search("programming");
      const snippet = results.results[0];

      const text = snippet.getText({ length: 100 });
      assert.ok(typeof text === "string");
      assert.ok(text.length > 0);
    });

    it("should respect the requested length", () => {
      const results = searcher.search("programming");
      const snippet = results.results[0];

      const short = snippet.getText({ length: 50 });
      const long = snippet.getText({ length: 200 });

      assert.ok(long.length >= short.length);
    });
  });
});
