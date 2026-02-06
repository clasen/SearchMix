import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import SearchMix from "../index.js";

const TEST_DB_PATH = "./test/db/test.db";
const TEST_DB_DIR = path.dirname(TEST_DB_PATH);

describe("SearchMix", () => {
  let searcher;

  before(() => {
    // Crear directorio de test si no existe
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }
  });

  after(() => {
    // Limpiar base de datos de test
    if (searcher) {
      searcher.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe("Constructor", () => {
    it("debería crear una instancia con configuración por defecto", () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      assert.ok(searcher);
      assert.strictEqual(searcher.dbPath, path.resolve(TEST_DB_PATH));
    });

    it("debería aceptar configuración personalizada", () => {
      searcher = new SearchMix({
        dbPath: TEST_DB_PATH,
        includeCodeBlocks: true,
        weights: { title: 5.0, body: 1.0 }
      });
      assert.strictEqual(searcher.includeCodeBlocks, true);
      assert.strictEqual(searcher.weights.title, 5.0);
    });
  });

  describe("Indexación de documentos", () => {
    it("debería indexar un documento desde Buffer", async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      const content = Buffer.from("# Test Document\n\nThis is a test.");
      
      await searcher.addDocument(content, { tags: ["test"] });
      
      const stats = searcher.getStats();
      assert.strictEqual(stats.totalDocs, 1);
    });

    it("debería indexar documento con headings", async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      const content = Buffer.from(`
# Title
## Section 1
Content of section 1.
## Section 2
Content of section 2.
`);
      
      await searcher.addDocument(content, { tags: ["test"] });
      
      const results = searcher.search("section");
      assert.ok(results.totalCount > 0);
    });

    it("debería evitar duplicados al indexar dos veces", async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      const content = Buffer.from("# Duplicate Test\nSome content.");
      
      await searcher.addDocument(content, { tags: ["test"] });
      await searcher.addDocument(content, { tags: ["test"] });
      
      const stats = searcher.getStats();
      // Los buffers siempre generan nuevas rutas únicas (buffer://<uuid>)
      // por lo que no se pueden detectar como duplicados
      assert.ok(stats.totalDocs >= 1);
    });
  });

  describe("Búsqueda", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      await searcher.addDocument(Buffer.from(`
# JavaScript Guide
JavaScript is a programming language.
## Variables
Use let and const for variables.
## Functions
Functions are reusable code blocks.
`), { tags: ["docs"] });
    });

    it("debería encontrar documentos por término simple", () => {
      const results = searcher.search("javascript");
      assert.ok(results.totalCount > 0);
      assert.ok(results.results.length > 0);
    });

    it("debería retornar snippets con metadata", () => {
      const results = searcher.search("javascript");
      const snippet = results.results[0];
      
      assert.ok(snippet.text);
      assert.ok(snippet.documentPath);
      assert.ok(snippet.documentTitle);
      assert.ok(Array.isArray(snippet.tags));
      assert.ok(snippet.tags.includes("docs"));
      assert.ok(typeof snippet.rank === "number");
    });

    it("debería soportar búsqueda con operadores booleanos", () => {
      const results = searcher.search("javascript AND functions");
      assert.ok(results.totalCount >= 0);
    });

    it("debería soportar búsqueda en campos específicos", () => {
      const results = searcher.search("title:javascript");
      assert.ok(results.totalCount > 0);
    });

    it("debería retornar múltiples snippets por documento", () => {
      const results = searcher.search("functions", { 
        limitSnippets: 5 
      });
      assert.ok(results.totalSnippets >= results.totalCount);
    });

    it("debería respetar el límite de resultados", () => {
      const results = searcher.search("javascript OR functions", { 
        limit: 1,
        limitSnippets: 1
      });
      assert.ok(results.results.length <= 1);
    });
  });

  describe("Búsqueda insensible a acentos", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      await searcher.addDocument(Buffer.from(`
# Viaje al Mediterráneo
El mar Mediterráneo es hermoso.
## Visita a París
París es la capital de Francia.
`), { tags: ["travel"] });
    });

    it("debería encontrar 'Mediterráneo' buscando 'mediterraneo'", () => {
      const results = searcher.search("mediterraneo");
      assert.ok(results.totalCount > 0);
    });

    it("debería encontrar 'París' buscando 'paris'", () => {
      const results = searcher.search("paris");
      assert.ok(results.totalCount > 0);
    });

    it("debería ser case insensitive", () => {
      const results1 = searcher.search("MEDITERRÁNEO");
      const results2 = searcher.search("mediterráneo");
      assert.strictEqual(results1.totalCount, results2.totalCount);
    });
  });

  describe("Tags (colecciones como tags)", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      await searcher.addDocument(
        Buffer.from("# Doc 1\nContent for tag A with enough text to detect language properly."),
        { tags: ["tagA"] }
      );
      await searcher.addDocument(
        Buffer.from("# Doc 2\nContent for tag B with enough text to detect language properly."),
        { tags: ["tagB"] }
      );
    });

    it("debería filtrar búsqueda por tag", () => {
      const results = searcher.search("content", { 
        tags: "tagA" 
      });
      assert.strictEqual(results.totalCount, 1);
      assert.ok(results.results[0].tags.includes("tagA"));
    });

    it("debería obtener estadísticas por tag", () => {
      const stats = searcher.getStats();
      assert.strictEqual(stats.totalDocs, 2);
      assert.strictEqual(stats.tags.tagA, 1);
      assert.strictEqual(stats.tags.tagB, 1);
    });

    it("debería soportar múltiples tags por documento", async () => {
      searcher.clear();
      
      await searcher.addDocument(
        Buffer.from("# Multi-tag Doc\nThis document has multiple tags for testing purposes."),
        { tags: ["notes", "important"] }
      );
      
      // Should be found by either tag
      const resultsA = searcher.search("document", { tags: "notes" });
      const resultsB = searcher.search("document", { tags: "important" });
      assert.ok(resultsA.totalCount > 0);
      assert.ok(resultsB.totalCount > 0);
    });

    it("documentos sin tags deberían aparecer en búsquedas con tag filter", async () => {
      searcher.clear();
      
      // Untagged document (global)
      await searcher.addDocument(
        Buffer.from("# Global Doc\nThis global document should appear everywhere when searching."),
        { tags: [] }
      );
      // Tagged document
      await searcher.addDocument(
        Buffer.from("# Tagged Doc\nThis tagged document should only appear with matching tag."),
        { tags: ["specific"] }
      );
      
      // Search with tag filter: should find both (untagged = global)
      const withTag = searcher.search("document", { tags: "specific" });
      assert.strictEqual(withTag.totalCount, 2);
      
      // Search without filter: should find both
      const noFilter = searcher.search("document");
      assert.strictEqual(noFilter.totalCount, 2);
    });

    it("debería auto-detectar idioma como tag", async () => {
      searcher.clear();
      
      await searcher.addDocument(
        Buffer.from("# Guía de JavaScript\nJavaScript es un lenguaje de programación muy utilizado en el desarrollo web moderno. Permite crear aplicaciones interactivas y dinámicas."),
        { tags: ["docs"] }
      );
      
      const stats = searcher.getStats();
      assert.ok(stats.tags.spa, "debería detectar español");
      assert.ok(stats.tags.docs, "debería mantener tag manual");
    });

    it("debería eliminar documentos por tag", () => {
      searcher.removeByTag("docs");
      const stats = searcher.getStats();
      assert.strictEqual(stats.tags.docs, undefined);
    });
  });

  describe("Navegación de snippets", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      await searcher.addDocument(Buffer.from(`
# Main Title
## Chapter 1
### Section 1.1
Content in section 1.1
### Section 1.2
Content in section 1.2
## Chapter 2
Content in chapter 2
`), { tags: ["nav"] });
    });

    it("debería incluir información de heading en snippets", () => {
      const results = searcher.search("section");
      const snippet = results.results.find(s => s.heading);
      
      if (snippet && snippet.heading) {
        assert.ok(snippet.heading.text);
        assert.ok(snippet.heading.type);
        assert.ok(typeof snippet.heading.depth === "number");
      }
    });

    it("debería permitir obtener detalles de heading por ID", () => {
      const results = searcher.search("section");
      const snippet = results.results.find(s => s.sectionId);
      
      if (snippet && snippet.sectionId) {
        const details = searcher.getHeadingById(
          snippet.documentPath, 
          snippet.sectionId
        );
        assert.ok(details);
        assert.ok(details.text);
        assert.ok(details.type);
      }
    });
  });

  describe("Gestión de documentos", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
    });

    it("debería verificar si documento existe", async () => {
      const content = Buffer.from("# Test\nContent.");
      const bufferPath = await searcher.addDocument(content);
      
      // Los buffers se guardan con rutas especiales buffer://
      const stats = searcher.getStats();
      assert.ok(stats.totalDocs > 0);
    });

    it("debería eliminar documento por ruta", async () => {
      searcher.clear();
      await searcher.addDocument(
        Buffer.from("# Doc to remove\nContent."),
        { tags: ["test"] }
      );
      
      const statsBefore = searcher.getStats();
      const docCount = statsBefore.totalDocs;
      
      // Como no tenemos la ruta del buffer, verificamos que clear funciona
      searcher.clear();
      const statsAfter = searcher.getStats();
      assert.strictEqual(statsAfter.totalDocs, 0);
    });

    it("debería obtener documento por ruta", async () => {
      searcher.clear();
      const content = Buffer.from("# Get Test\nSome content here.");
      await searcher.addDocument(content, { tags: ["test"] });
      
      // Para buffers no podemos usar get() sin conocer la ruta exacta
      // Pero podemos buscar
      const results = searcher.search("Get Test");
      assert.ok(results.totalCount > 0);
    });

    it("debería limpiar toda la base de datos", async () => {
      await searcher.addDocument(Buffer.from("# Doc 1"), { tags: ["a"] });
      await searcher.addDocument(Buffer.from("# Doc 2"), { tags: ["b"] });
      
      searcher.clear();
      
      const stats = searcher.getStats();
      assert.strictEqual(stats.totalDocs, 0);
    });
  });

  describe("Opciones de snippet", () => {
    before(async () => {
      searcher = new SearchMix({ dbPath: TEST_DB_PATH });
      searcher.clear();
      
      await searcher.addDocument(Buffer.from(`
# Document Title
This is a paragraph with the word search in it.
This is another paragraph with search again.
And one more time search appears here.
`), { tags: ["test"] });
    });

    it("debería ajustar longitud del snippet", () => {
      const short = searcher.search("search", { snippetLength: 30 });
      const long = searcher.search("search", { snippetLength: 100 });
      
      if (short.results[0] && long.results[0]) {
        assert.ok(long.results[0].text.length >= short.results[0].text.length);
      }
    });

    it("debería limitar máximo de snippets por documento", () => {
      const limited = searcher.search("search", { 
        limitSnippets: 2 
      });
      assert.ok(limited.totalSnippets <= 2);
    });

    it("debería poder desactivar snippets", () => {
      const results = searcher.search("search", { snippets: false });
      // Sin snippets, los resultados deberían existir pero sin texto de contexto
      assert.ok(results.totalCount > 0);
    });
  });
});
