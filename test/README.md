# Tests

Unit tests for SearchMix using Node.js native test runner.

## Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch
```

## Test structure

### `searchmix.test.js`
Tests for the main SearchMix class:
- **Constructor**: Initialization and configuration verification
- **Indexing**: Document indexing tests from Buffer
- **Search**: Basic search, boolean operators, and specific field tests
- **Accents**: Accent-insensitive and case-insensitive search verification
- **Collections**: Collection filtering and management tests
- **Navigation**: Snippet tests with hierarchical information
- **Management**: Document CRUD tests
- **Options**: Snippet options verification (length, limits)

### `snippet.test.js`
Tests for the Snippet class:
- **Basic properties**: Basic properties and methods verification
- **Hierarchical navigation**: Parent/child navigation tests
- **Breadcrumbs**: Hierarchical path generation tests
- **Content**: Section content access verification
- **Details**: Complete details retrieval tests
- **Ancestors**: Ancestor navigation tests
- **Siblings**: Sibling retrieval tests
- **Text**: Text extraction verification

## Coverage

Tests cover the main functionalities:
- ✅ Document indexing
- ✅ Full-text search with FTS5
- ✅ Accent-insensitive search
- ✅ Collections
- ✅ Hierarchical navigation
- ✅ Document management
- ✅ Snippet API

## Notes

- Tests use a temporary database in `./test/db/`
- Test databases are in `.gitignore`
- Tests run in isolation (each suite cleans its state)
- Total: 45 tests in 18 suites
