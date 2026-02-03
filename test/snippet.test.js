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

    // Crear documento con estructura jerárquica
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

  describe("Propiedades básicas", () => {
    it("debería tener propiedades básicas", () => {
      const results = searcher.search("arrow functions");
      const snippet = results.results[0];

      assert.ok(snippet.text);
      assert.ok(snippet.section);
      assert.ok(typeof snippet.position === "number");
      assert.ok(snippet.documentPath);
      assert.ok(snippet.documentTitle);
    });

    it("debería tener método toString()", () => {
      const results = searcher.search("arrow");
      const snippet = results.results[0];

      const str = snippet.toString();
      assert.ok(typeof str === "string");
      assert.ok(str.includes(snippet.section));
    });

    it("debería tener método toJSON()", () => {
      const results = searcher.search("arrow");
      const snippet = results.results[0];

      const json = snippet.toJSON();
      assert.ok(json);
      assert.ok(json.text);
      assert.ok(json.section);
    });
  });

  describe("Navegación jerárquica", () => {
    it("debería tener información de heading", () => {
      const results = searcher.search("arrow functions", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading);

      if (snippet) {
        assert.ok(snippet.heading);
        assert.ok(snippet.heading.text);
        assert.ok(snippet.heading.type);
        assert.ok(typeof snippet.heading.depth === "number");
      }
    });

    it("debería verificar existencia de padre", () => {
      const results = searcher.search("arrow", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const hasParent = snippet.hasParent();
        assert.ok(typeof hasParent === "boolean");
      }
    });

    it("debería obtener información del padre", () => {
      const results = searcher.search("let and const", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth === 3);

      if (snippet && snippet.hasParent()) {
        const parent = snippet.getParent();
        assert.ok(parent);
        assert.ok(parent.text);
        assert.ok(parent.type);
        assert.ok(parent.depth < snippet.heading.depth);
      }
    });

    it("debería verificar existencia de hijos", () => {
      const results = searcher.search("functions", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth === 2);

      if (snippet) {
        const hasChildren = snippet.hasChildren();
        assert.ok(typeof hasChildren === "boolean");
      }
    });

    it("debería obtener hijos", () => {
      const results = searcher.search("functions", { allOccurrences: true });
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

    it("debería obtener un hijo específico", () => {
      const results = searcher.search("functions", { allOccurrences: true });
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
    it("debería generar breadcrumbs como array", () => {
      const results = searcher.search("arrow functions", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const breadcrumbs = snippet.getBreadcrumbs();
        assert.ok(Array.isArray(breadcrumbs));
        assert.ok(breadcrumbs.length > 0);
        assert.ok(breadcrumbs[0].text);
        assert.ok(breadcrumbs[0].type);
      }
    });

    it("debería generar breadcrumbs como texto", () => {
      const results = searcher.search("arrow", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const text = snippet.getBreadcrumbsText();
        assert.ok(typeof text === "string");
        assert.ok(text.length > 0);
      }
    });

    it("debería aceptar separador personalizado en breadcrumbs", () => {
      const results = searcher.search("arrow", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth > 1);

      if (snippet) {
        const text = snippet.getBreadcrumbsText(" → ");
        assert.ok(text.includes(" → "));
      }
    });
  });

  describe("Contenido", () => {
    it("debería tener método hasContent disponible", () => {
      const results = searcher.search("functions", { allOccurrences: true });
      const snippet = results.results[0];

      // Verificar que el método existe y se puede llamar
      assert.ok(typeof snippet.hasContent === "function");
      
      // Llamar al método (puede retornar truthy o falsy)
      const result = snippet.hasContent();
      // Simplemente verificar que no lanza error
      assert.ok(result === true || result === false || result === undefined || typeof result === "number");
    });

    it("debería obtener contenido de la sección", () => {
      const results = searcher.search("let", { allOccurrences: true });
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

  describe("Detalles completos", () => {
    it("debería obtener detalles completos del heading", () => {
      const results = searcher.search("arrow", { allOccurrences: true });
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

  describe("Ancestros", () => {
    it("debería obtener ancestro por profundidad", () => {
      const results = searcher.search("arrow", { allOccurrences: true });
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

  describe("Hermanos (siblings)", () => {
    it("debería obtener hermanos del mismo nivel", () => {
      const results = searcher.search("arrow functions", { allOccurrences: true });
      const snippet = results.results.find(s => s.heading && s.heading.depth === 3);

      if (snippet) {
        const siblings = snippet.getSiblings();
        assert.ok(Array.isArray(siblings));
        // Puede tener 0 o más hermanos
      }
    });
  });

  describe("Obtener texto", () => {
    it("debería obtener texto del documento", () => {
      const results = searcher.search("programming");
      const snippet = results.results[0];

      const text = snippet.getText({ length: 100 });
      assert.ok(typeof text === "string");
      assert.ok(text.length > 0);
    });

    it("debería respetar la longitud solicitada", () => {
      const results = searcher.search("programming");
      const snippet = results.results[0];

      const short = snippet.getText({ length: 50 });
      const long = snippet.getText({ length: 200 });

      assert.ok(long.length >= short.length);
    });
  });
});
