# CodeForensics Complete Pipeline Workflow

> The definitive reference for how CodeForensics transforms raw source code into rich, AI-generated documentation.
> Organized into three architectural layers: Deterministic, Embedding, and LLM.
> Written for both technical experts and non-technical stakeholders.

```
                          DETERMINISTIC LAYER
  ┌──────────────┐    ┌─────────────────────────────────────────────┐
  │  INGESTION   │    │       ANALYSIS and INDEXING ENGINE           │
  │              │    │                                             │
  │ Upload       │    │  Scan and Classify                          │
  │  Codebase    │───>│   Scan Project / Identify Files / Skip Noise│
  │  Collaterals │    │                                             │
  │              │    │  Parser Engine                              │
  │ Select       │    │   Platform Parsers / Generic / Document     │
  │  Technology  │    │                                             │
  │  Platform    │    │  Comprehension Engine                       │
  └──────────────┘    │   Schema / Dependencies / Patterns / Facts  │
                      │                                             │
                      │  Output --> Master Index                    │
                      └──────────────┬──────────────────────────────┘
                                     │
                          EMBEDDING LAYER
                      ┌──────────────┴──────────────────────────────┐
                      │                 RAG                          │
                      │  Create Chunks --> Embeddings --> VectorStore│
                      └──────────────┬──────────────────────────────┘
                                     │
                            LLM LAYER
                      ┌──────────────┴──────────────────────────────┐
                      │         DOCUMENT GENERATION                  │
                      │  Select Docs --> RAG Retrieve --> Prompts    │
                      │  --> LLM Synthesis --> Validate --> Export   │
                      └─────────────────────────────────────────────┘
```

---

# LAYER 1: DETERMINISTIC LAYER

> Everything in this layer is rule-based, repeatable, and produces the same output for the same input every time. No AI models are involved. It is pure code analysis, parsing, and structural extraction. Think of it as the "understanding" phase: we read the code, break it apart, and build a structured map of what exists.

---

## Stage 1: Ingestion

Ingestion is the front door of the system. This is where the user brings their code and supporting materials into CodeForensics. Nothing gets analyzed yet — we are just receiving, organizing, and cataloging what was uploaded.

### Substage 1.1: Upload — Codebase and Collaterals

**What happens (plain English):**
The user creates a new project through a step-by-step wizard. They give it a name, choose what they are uploading (source code, documents, or both), and then drag-and-drop their files. The system accepts the files in batches so even massive codebases with thousands of files do not crash the browser or time out. Alongside code, users can upload "collaterals" — supplementary business documents like PDFs, Word files, Excel spreadsheets, CSVs, or Markdown notes that provide business context the code alone cannot convey.

**What happens (technical detail):**
The frontend (React/Vite on port 5173) presents a 4-step project creation wizard (NewProject.tsx). Step 1: name the project. Step 2: choose input type — Code, Documents, or Both. Step 3: batch file upload with drag-and-drop. Step 4: technology/platform selection.

Files are uploaded via the Project Management Service (Node/Express on port 3001) through `projectController.js`. The controller validates file sizes, MIME types, and batch integrity, then persists files to either local disk or Azure Blob Storage depending on the `STORAGE_BACKEND` environment variable. The project record is created in PostgreSQL with status `created`, storing the project name, input type, file paths, and creation timestamp.

For "Both" input type projects, code files and document files are tracked separately. Document files (PDF, DOCX, XLSX, CSV, Markdown, JSON, YAML) are later parsed by the Knowledge Base Document Parser (`kb_document_parser.py`) which extracts raw text from each format using format-specific libraries: PyPDF2 for PDFs, python-docx for Word, openpyxl for Excel, stdlib csv for CSVs, pyyaml for YAML, and plain file reads for Markdown and JSON.

The batch upload approach is deliberate — we chunk large uploads into manageable pieces so the browser does not hit HTTP timeout limits. Each batch gets acknowledged before the next is sent. Real-time progress is streamed to the frontend via Server-Sent Events (SSE) so the user sees exactly what is happening at every step.

**Advanced enhancement — Knowledge Base parallel pipeline:**
At any point after project creation, the user can upload additional supplementary documents to the Knowledge Base (KnowledgeBaseTab.tsx). These go through a separate ingestion pipeline: the KB Ingestion Pipeline (`kb_ingestion_pipeline.py`) extracts text, auto-categorizes the document into one of 18 categories (9 Customer Knowledge categories like Business Glossary, Business Rules Catalog, Compliance Requirements, Organizational Context, Strategic Priorities, Existing Documentation, SLAs, Stakeholder Map, Data Governance; and 9 Reference Knowledge categories like Design Patterns, Target Architecture, Platform Best Practices, Industry Reference Architecture, Migration Playbooks, Technology Standards, Anti-Pattern Library, Benchmark Data, Vendor Product Constraints), chunks the text semantically, generates embeddings, and stores them in pgvector. The auto-categorizer tries LLM classification first (confidence 1.0), falls back to user-defined category matching (confidence 0.95), and finally uses keyword heuristics (confidence 0.3-0.9). These KB chunks become additional RAG pools that enrich downstream document generation with business context that raw code cannot provide.

### Substage 1.2: Select — Technology and Platform

**What happens (plain English):**
The user tells the system what technology their code is written in — COBOL, Java, MuleSoft, Appian, SAP, Salesforce, Power Apps, Guidewire, and so on. This selection determines which specialized parser will be used to understand the code. The system also runs an automatic detection scan that guesses the platform before the user even picks it, so in most cases the right answer is already suggested.

**What happens (technical detail):**
The system supports 40+ technology platforms organized into categories:

- Enterprise: Oracle, SAP ABAP, SAP CPI, MuleSoft, ServiceNow, IBM BPM, IBM i (RPG/AS400), Mainframe (z/OS with COBOL/JCL/PL-I/HLASM/REXX/CICS/DB2/IMS/Easytrieve/Natural/SAS/FOCUS), Pega, MicroStrategy, Guidewire InsuranceSuite, Apache Struts
- Low-Code/RPA: Salesforce, Power Platform, UiPath, Mendix, Appian
- Desktop/Legacy: MS Access (VBA), MS Excel (VBA)
- Modern Web: React, Angular, Vue.js, Node.js, Next.js
- Backend: Java, Python, .NET/C#, Go
- Cloud: AWS, Azure, GCP
- Mobile: Android, iOS
- IaC: Terraform, Docker
- API/Schema: OpenAPI/Swagger, GraphQL
- Scripting: Shell/PowerShell
- Data: Jupyter Notebooks
- Specialized: Healthcare/HL7, Natural/ADABAS

Each technology maps to one or more parser modules (e.g., `mainframe` maps to `mainframe_parser` which dispatches to `cobol_parser`, `jcl_parser`, `hlasm_parser`, `pli_parser`, `rexx_parser`, `cics_parser`, `db2_parser`, `ims_parser`, `easytrieve_parser`, `sas_parser`, `focus_parser`). The mapping is defined in `supportedTechnologies.js` and mirrored in the indexing service's `_SUPPORTED_TECHNOLOGIES` list.

**Advanced enhancement — Platform Auto-Detection:**
Before the user selects anything, the Platform Detector (`platform_detector.py`) runs an automatic scan. It collects all files in the repository (excluding noise directories like node_modules, .git, __pycache__), then analyzes each file against a registry of Platform Signatures. Each signature defines: file extension patterns (e.g., `.cbl`, `.cob` for COBOL), content patterns (regex matches inside files, like `IDENTIFICATION DIVISION` for COBOL or `<mule` for MuleSoft), structural markers (directory structures like `src/main/mule/` for MuleSoft), and config file indicators (like `pom.xml` for Java or `mule-artifact.json` for MuleSoft).

The detector calculates a confidence score (0.0-1.0) for each platform based on how many signals match. It returns a `RepositoryAnalysis` containing all detected platforms sorted by confidence, a file breakdown by type, and categorized file lists (code files vs document files). Platforms below the `min_confidence` threshold (default 0.6) are filtered out. The frontend displays the top suggestion pre-selected, but the user can override it.

This auto-detection also feeds into the "additional sources" feature — a project can have multiple source paths, each potentially a different platform. The system detects platforms per-source and merges the results.

---

## Stage 2: Analysis and Indexing Engine

This is the brain of the Deterministic Layer. Once files are uploaded and the platform is selected, the Analysis and Indexing Engine takes over. It scans every file, parses the code into structured objects, builds a deep understanding of how everything connects, and produces a Master Index that becomes the foundation for everything downstream.

### Substage 2.1: Scan and Classify

#### Scan Project

**What happens (plain English):**
The system walks through every file in the uploaded codebase and figures out what each file is — source code, a configuration file, a document, a test file, or noise that should be ignored. It builds a complete inventory of the project: what languages are used, what frameworks are present, what database technology is involved, and what type of project this is (web app, API, library, batch processing system, etc.).

**What happens (technical detail):**
The Repository Scanner (`repository_scanner.py`) takes the project root path and performs a full directory traversal. For each file it encounters, it records: the file path, detected language (from extension mapping — `.py` = Python, `.java` = Java, `.cbl`/`.cob` = COBOL, etc.), content type (code, document, BRD, TRD, specification, architecture, diagram, mixed), document type if applicable (brd, trd, srs, etc.), file size, line count, and encoding.

The scanner produces a `ProjectInfo` object containing: project name, project type (web_app, api, library, documentation, requirements, mixed), detected languages list, detected frameworks list (Spring Boot, React, Express, Django, etc.), content types present, document types present, database technology (PostgreSQL, Oracle, DB2, etc.), config files found, root path, and git info (if a git repository — branch, last commit, remote URL).

The scanner also extracts git metadata when available — the current branch, last commit hash, and remote URL. This is used for incremental indexing on subsequent runs.

#### Identify File Types

**What happens (plain English):**
Every file gets classified by its content type. Source code files are tagged with their programming language. Document files (PDFs, Word docs, spreadsheets) are tagged as documents with their specific format. Configuration files (package.json, pom.xml, Dockerfile) are identified separately. This classification determines which parser will handle each file.

**What happens (technical detail):**
The scanner uses two classification methods:

1. Extension-based language detection (`_detect_language_from_path`): Maps file extensions to languages. This covers hundreds of extensions — `.py` to Python, `.java` to Java, `.cbl`/`.cob`/`.cpy` to COBOL, `.jcl`/`.proc` to JCL, `.xml` with MuleSoft markers to MuleSoft, `.pcf` to Guidewire, `.gosu` to Guidewire Gosu, and so on.

2. Content-type detection (`_detect_content_type`): For files where the extension is ambiguous, the scanner reads the first few kilobytes and looks for content markers. An XML file containing `<mule` is MuleSoft, not generic XML. A `.txt` file containing `IDENTIFICATION DIVISION` is COBOL, not plain text. A JSON file containing `"TopParent"` and `"processModelUuid"` is Appian.

Each file gets a `FileInfo` object with all its metadata. The complete list of FileInfo objects is what the Parser Engine receives as input.

#### Skip Noise

**What happens (plain English):**
Not everything in a codebase matters. Build artifacts, dependency folders, compiled binaries, IDE configuration files, and test fixtures are noise that would pollute the analysis. The system automatically skips these so the parsers only process meaningful source files.

**What happens (technical detail):**
The scanner maintains an exclusion list checked via `_should_ignore()`. Ignored patterns include:

- Dependency directories: `node_modules/`, `vendor/`, `.venv/`, `__pycache__/`, `site-packages/`
- Build output: `dist/`, `build/`, `target/`, `bin/`, `obj/`, `.class` files
- Version control: `.git/`, `.svn/`, `.hg/`
- IDE files: `.idea/`, `.vscode/` (settings only — actual config files are kept), `.DS_Store`
- Binary files: images, compiled executables, archives (detected via `_is_text_file()` which checks for null bytes in the first 8KB)
- Lock files: `package-lock.json`, `yarn.lock`, `Pipfile.lock` (too large, no semantic value)
- Generated files: `.min.js`, `.map`, `.bundle.js`

The `_is_text_file()` check is the final gate — even if a file passes the extension filter, if it contains null bytes (indicating a binary file), it gets skipped. This prevents the parsers from choking on compiled artifacts that happen to have source-like extensions.

**Advanced enhancement — Incremental Change Detection:**
Before any parsing begins, the Incremental Index Tracker (`incremental_indexer.py`) computes SHA-256 hashes for every file and compares them against a stored hash manifest. The manifest is stored either as a JSON file on disk (`.index_hashes.json`) or in PostgreSQL via `PostgresHashStore`. This produces a `ChangeSet` with four categories: new files (parse and embed), modified files (re-parse and re-embed), deleted files (remove from index), and unchanged files (skip entirely). On re-index runs, this reduces processing from O(all files) to O(changed files). The hash manifest is only committed after a successful index write — if the system crashes mid-index, the next run will re-process everything that was in flight, ensuring no data loss.

### Substage 2.2: Parser Engine

The Parser Engine is the core of code understanding. It takes the classified files from the scanner and extracts structured "code objects" — the atomic units of understanding that everything downstream depends on.

#### Platform Parsers (30+ specialized parsers)

**What happens (plain English):**
Each technology platform has its own specialized parser that knows the language intimately. The COBOL parser understands IDENTIFICATION DIVISION, DATA DIVISION, PROCEDURE DIVISION, paragraphs, PERFORM statements, COPY statements, CICS commands, and DB2 SQL. The MuleSoft parser understands flows, sub-flows, connectors, DataWeave transformations, and RAML API specs. The Appian parser understands process models, interfaces, expression rules, CDTs, record types, and integrations. Each parser extracts not just what exists, but how things connect — the dependencies between components.

**What happens (technical detail):**
The Code Indexing Pipeline (`pipeline.py`) orchestrates parsing. It receives the list of files from the scanner and dispatches each file to the appropriate parser based on the detected platform. The pipeline is initialized with `incremental=True` by default, meaning it respects the change detection from the previous substage.

Each parser produces a list of `CodeObject` instances. A CodeObject has:
- `name`: the identifier (function name, class name, COBOL paragraph name, MuleSoft flow name)
- `type`: one of 50+ CodeObjectType enum values — function, class, method, procedure, trigger, view, package, module, interface, struct, enum, variable, constant, section, requirement, document, table, api, component, worksheet, integration, configuration, paragraph (COBOL), division (COBOL), copybook, jcl_job, jcl_step, jcl_proc, transaction (CICS), bms_map, bms_mapset, cics_csd, endpoint, construct, ims_segment, ims_pcb
- `language`: the programming language
- `file_path`: where it lives in the codebase
- `line_start` / `line_end`: exact line range in the source file
- `parameters`: list of parameter definitions with names and types
- `dependencies`: list of other objects this one calls, references, or depends on — THIS IS THE KEY STRUCTURAL OUTPUT
- `docstring`: extracted documentation comments
- `code`: the raw source code of the object
- `metadata`: a flexible dict for parser-specific extras

The dependencies list is what makes the system powerful. Each parser extracts platform-specific dependency relationships:

- COBOL parser: PERFORM targets, CALL targets, COPY statements (copybook includes), EXEC CICS commands (SEND/RECEIVE/READ/WRITE/LINK/XCTL), EXEC SQL references (table names, cursor names), file I/O (SELECT/ASSIGN, READ/WRITE/REWRITE/DELETE)
- JCL parser: EXEC PGM references (which programs a job step runs), PROC references, DD statement dataset names, INCLUDE references
- MuleSoft parser: flow-ref targets (which flows call which), sub-flow references, connector dependencies (HTTP, Database, Salesforce, etc.), DataWeave import references, RAML resource references
- Appian parser: process model references (which processes call which), record type dependencies, expression rule calls, integration object references, CDT field references
- Java parser: method calls, class imports, interface implementations, annotation references, Spring bean dependencies
- Guidewire parser: PCF screen references, Gosu class inheritance, entity relationships, typelist references, workflow step transitions, rule condition references

These dependency lists form the edges of the code dependency graph that gets stored in the index and later traversed during Graph RAG expansion in the Embedding Layer.

The full parser registry includes: `cobol_parser`, `jcl_parser`, `hlasm_parser`, `pli_parser`, `rexx_parser`, `cics_parser`, `db2_parser`, `ims_parser`, `mulesoft_parser`, `appian_parser`, `powerapp_parser`, `sas_parser`, `easytrieve_parser`, `focus_parser`, `mainframe_parser` (dispatcher), `guidewire_parser`, `struts_parser`, `oracle_parser`, `apex_parser`, `sap_abap_parser`, `sap_cpi_parser`, `servicenow_parser`, `ibm_bpm_parser`, `rpg_parser`, `pega_parser`, `microstrategy_parser`, `uipath_parser`, `salesforce_parser`, `mendix_parser`, `react_parser`, `angular_parser`, `vue_parser`, `nodejs_parser`, `nextjs_parser`, `java_parser`, `python_parser`, `dotnet_parser`, `go_parser`, `cloud_platform_parser`, `android_parser`, `ios_parser`, `healthcare_parser`, `generic_parser`, `vba_parser`, `access_parser`, `excel_parser`, `terraform_parser`, `dockerfile_parser`, `openapi_parser`, `graphql_parser`, `shell_parser`, `natural_parser`, `notebook_parser`.

**Advanced enhancement — Parser Factory and Optimization Loop:**
The system includes a Parser Factory (`parser_factory/`) with an AI-assisted parser generation capability. If a new platform needs support, an LLM can generate parser code from sample files. The Optimization Loop (`optimisation_loop.py`) grades all parsers against test corpora, identifies underperformers, and suggests improvements. A Parser Registry (`parser_registry.py`) tracks parser versions, quality scores, and test coverage. The Parser Management UI (ParserManagementTab.tsx) provides a dashboard showing parser health, optimization status, and a live panel for running optimization experiments. A Platform Onboarding Wizard (`platform_onboarding.py`) provides templates and test harnesses to validate new parsers before they go live.

#### Generic Parser

**What happens (plain English):**
When the system encounters a file type it does not have a specialized parser for, the Generic Parser steps in. It uses general-purpose heuristics to extract whatever structure it can — function definitions, class declarations, import statements, and basic dependency relationships. It is less precise than a specialized parser but ensures no file is completely ignored.

**What happens (technical detail):**
The `GenericParser` (aliased as `UniversalParser` for backward compatibility) handles files that do not match any platform-specific parser. It uses regex-based extraction for common patterns across languages: function/method definitions (matching patterns like `def`, `function`, `func`, `fn`, `sub`, `proc`), class declarations, import/include/require statements, and comment blocks. It produces CodeObjects with type `construct` and best-effort dependency extraction. The generic parser is the fallback — it always runs for unrecognized file types so the index is never empty even for exotic codebases.

#### Document Parser

**What happens (plain English):**
When the project includes documents (PDFs, Word files, spreadsheets), the Document Parser extracts their text content and structures it into indexable objects. A PDF of business requirements becomes a set of requirement objects. An Excel spreadsheet of data mappings becomes table objects. This allows documents to participate in the same index and RAG pipeline as code.

**What happens (technical detail):**
The KB Document Parser (`kb_document_parser.py`) handles 7 document formats via MIME-type dispatch:
- `application/pdf` → PyPDF2 extraction (page by page, with encrypted PDF detection)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → python-docx paragraph extraction
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → openpyxl sheet-by-sheet, row-by-row extraction with pipe-delimited formatting
- `text/csv` → stdlib csv reader with pipe-delimited formatting
- `text/markdown` → plain text read
- `application/json` → pretty-printed JSON dump
- `text/yaml` / `application/x-yaml` → pyyaml safe_load and dump

Each format handler includes error handling for corrupted files, password-protected documents, and files with no extractable text. The extracted text is then chunked and embedded through the same pipeline as code objects, creating document-type CodeObjects (type `document`, `section`, `requirement`, `table`) that sit alongside code objects in the unified index.

### Substage 2.3: Comprehension Engine

The Comprehension Engine takes the raw code objects from the Parser Engine and builds higher-order understanding — how things relate, what patterns exist, what the data model looks like, and what facts can be stated with certainty about the codebase.

#### Schema Analysis

**What happens (plain English):**
The system identifies all database tables, their columns, data types, relationships (foreign keys), stored procedures, functions, triggers, and views. For a COBOL system, this means DB2 tables and IMS segments. For a Java system, this means JPA entities and SQL DDL. For MuleSoft, this means database connector configurations and DataWeave data structures. This schema map becomes a critical input for generating data-focused documentation.

**What happens (technical detail):**
The Code Indexing Pipeline builds a `SchemaInfo` object containing: tables (with columns, data types, constraints, and relationships), procedures, functions, triggers, and inter-table relationships. Schema information is extracted from multiple sources depending on the platform:

- DB2 parser extracts DDL statements (CREATE TABLE, CREATE INDEX, CREATE VIEW)
- COBOL parser extracts EXEC SQL sections and FD (File Description) entries
- IBM i parser extracts DDS physical/logical file definitions, which are converted to table schemas via `_build_table_schema_from_object()`, `_build_proc_schema_from_object()`, `_build_func_schema_from_object()`, and `_build_trigger_schema_from_object()`
- Java parser extracts JPA/Hibernate entity annotations
- Generic parser extracts SQL DDL from any `.sql` files

The schema is merged from code objects using `_merge_ibmi_schema_from_code_objects()` which deduplicates tables by name and merges column definitions from multiple sources (a table might be defined in DDS and referenced in RPG — both contribute to the complete picture).

The Master Context Generator later summarizes this schema into a compact format: `_summarize_schema_tables()` produces a condensed table inventory (up to 120 tables) with column counts and key column names, and `_build_data_dictionary_snapshot()` produces a detailed data dictionary (up to 35 tables) with full column definitions.

#### Dependency Graph

**What happens (plain English):**
The system builds a map of "who calls whom" across the entire codebase. If Program A calls Program B, and Program B reads Table C, and Table C is also written by Program D — all of those relationships are captured. This graph is what allows the system to answer questions like "what would be impacted if we changed this table?" or "trace the complete flow from this API endpoint to the database."

**What happens (technical detail):**
The Code Analyzer (`code_analyzer.py`) takes all code objects and builds a comprehensive analysis:

1. Call Graph Construction: For each code object, it extracts outgoing calls (`_extract_calls()`) using language-specific patterns — method invocations in Java, PERFORM/CALL in COBOL, flow-ref in MuleSoft. It also extracts table access patterns (`_extract_table_access()`) — SELECT/INSERT/UPDATE/DELETE in SQL, READ/WRITE/REWRITE in COBOL file I/O. These form directed edges in the call graph, stored as `CallGraphNode` objects with callers, callees, and table accesses.

2. Reverse Graph: `_build_reverse_graph()` inverts the call graph so we can answer "who calls this function?" in addition to "what does this function call?"

3. Dead Code Detection: `_detect_dead_code()` identifies code objects that have no incoming edges (nothing calls them) and are not entry points. These are candidates for removal during modernization.

4. Complexity Metrics: For each code object, `_calculate_complexity()` computes: cyclomatic complexity (number of independent paths through the code), nesting depth, cognitive complexity (a more human-centric complexity measure that weights nested conditions more heavily), lines of code, comment ratio, and an overall complexity rating (low/medium/high/critical).

5. Hotspot Detection: `_find_hotspots()` identifies the most complex code objects (complexity above a configurable threshold, default 15) — these are the riskiest areas for modernization.

6. Impact Analysis: `get_impact_analysis()` traces all transitive dependents of a given function — if you change function X, what else breaks? It follows the reverse graph recursively.

7. Call Path Tracing: `get_call_path()` finds the shortest path between any two functions in the call graph using BFS — useful for understanding how data flows from point A to point B.

The dependency graph is stored in PostgreSQL as `dependency_edges` with a foreign key to the project, and also serialized into the index JSON under `dependencies` with `graph_stats` (total nodes, total edges, average fan-out) and `circular_dependencies` detection (cycles in the call graph that indicate tightly coupled code).

#### Pattern Extraction

**What happens (plain English):**
The system identifies recurring design patterns, architectural patterns, and code smells across the codebase. It recognizes things like: "this is a batch processing system with a read-process-write pattern," or "this uses a service-oriented architecture with REST APIs," or "there are 15 instances of duplicated error handling logic that could be consolidated."

**What happens (technical detail):**
The Code Analyzer's `analyze_repository()` method produces a patterns section containing:

- Design patterns detected: singleton, factory, observer, MVC, repository, service layer, etc. — identified by structural signatures in the code (e.g., a class with a private constructor and a static getInstance method = singleton)
- Code smells: long methods (>100 lines), god classes (>20 methods), deep nesting (>5 levels), duplicated code blocks, unused imports, empty catch blocks
- Architectural patterns: monolith vs microservices (based on project structure), batch processing (JCL job chains), event-driven (message queue references), API-first (OpenAPI specs present)
- Summary statistics: total objects by type, language distribution, average complexity, test coverage indicators

The Master Context Generator enriches this with platform-specific pattern recognition via `_build_platform_signals()`. For each platform, it knows what to look for: COBOL projects get batch job chain analysis and CICS transaction flow mapping; MuleSoft projects get connector usage patterns and API policy analysis; Appian projects get process model complexity and integration point mapping. The platform focus registry (`_PLATFORM_FOCUS_REGISTRY`) maps 35+ platform identifiers to their specific analysis dimensions.

#### Fact Contracts

**What happens (plain English):**
Fact Contracts are verified, deterministic statements about the codebase that the system can make with 100% confidence because they come directly from code analysis, not AI inference. Things like: "There are exactly 47 COBOL programs," "Program CUSTMAIN calls programs CUSTVAL, CUSTUPD, and CUSTRPT," "Table CUSTOMER has 12 columns including CUST_ID (INTEGER, PRIMARY KEY)." These facts become the ground truth that the LLM must respect during document generation — the AI cannot contradict a Fact Contract.

**What happens (technical detail):**
The Master Context Generator (`master_context_generator.py` in the indexing service) builds Fact Contracts through several deterministic functions:

1. `_build_object_catalog()`: Produces a verified inventory of every code object — name, type, file path, parameter count, dependency count, and a compact behavior summary. Limited to 320 objects to fit within LLM context windows.

2. `_build_capability_map()`: Groups objects by functional capability (data access, business logic, UI, integration, batch processing) based on their type and dependency patterns. Limited to 80 entries.

3. `_build_evidence_coverage_matrix()`: Maps each code object to the document sections it should appear in, creating a traceability matrix between code and documentation.

4. `_build_fact_contract_coverage()`: Explicitly lists which facts are covered by the index and which are "known unknowns" — things the system knows it does not know (e.g., "runtime configuration values are not available from static analysis").

5. `_build_known_unknowns()`: Catalogs gaps in the analysis — external system interfaces that are referenced but not defined in the codebase, configuration values that are environment-specific, runtime behaviors that cannot be determined from static analysis.

6. `_build_object_dossiers()`: Produces detailed profiles for the most important code objects (up to 120), including their full dependency chains, table accesses, complexity metrics, and behavioral summaries.

7. `_build_table_dossiers()`: Produces detailed profiles for database tables (up to 80), including column definitions, which programs read/write them (`_table_usage_candidates()`), and relationship information.

8. `_build_flow_dossiers()`: Produces end-to-end flow traces (up to 40) showing how data moves through the system from entry point to storage.

These Fact Contracts are embedded directly into the Master Context document and become part of the RAG context during document generation. The LLM's system prompt includes explicit instructions to never contradict Fact Contract data.

### Substage 2.4: Output — Master Index

**What happens (plain English):**
Everything from the previous substages — the file inventory, the parsed code objects, the schema map, the dependency graph, the patterns, and the fact contracts — gets assembled into a single, comprehensive Master Index. This is the complete "understanding" of the codebase in a structured, machine-readable format. It is the single source of truth that feeds both the Embedding Layer (for RAG search) and the LLM Layer (for document generation).

**What happens (technical detail):**
The output is a `project_index.json` file containing:

```json
{
  "project_info": { "name", "type", "languages", "frameworks", "database", ... },
  "code_objects": [ { "name", "type", "language", "file_path", "dependencies", "code", ... }, ... ],
  "schema": { "tables", "procedures", "functions", "triggers", "relationships" },
  "dependencies": { "edges", "graph_stats", "circular_dependencies" },
  "patterns": { "design_patterns", "code_smells", "architectural_patterns", "summary" },
  "statistics": { "total_files", "total_objects", "lines_of_code", "by_language", "by_type" },
  "file_inventory": [ { "path", "language", "content_type", "size", "lines" }, ... ]
}
```

This index is saved to disk (or Azure Blob) at `{output_dir}/project_index.json`. The project status moves to `indexed`.

Immediately after the index is written, the system automatically triggers Master Context Generation. The Master Context Generator (`master_context_generator.py` in the doc-gen service) reads the raw index and synthesizes a rich, LLM-consumable narrative document (`master_context.md`) containing: component inventory, dependency graph summary, platform-specific patterns, entry points, data flows, key metrics, object dossiers, table dossiers, flow dossiers, capability map, security signals, operations signals, and the complete Fact Contract set.

The master context is validated through a "Knowledge Book v2" gate (`validate_knowledge_book_v2()`) which checks minimum quality thresholds: word count, catalog row count, narrative word count, and structural completeness. If validation fails, the pipeline stops and reports the issue — we do not proceed with bad foundational context.

The master context becomes one of the primary RAG pools (the `master_context` pool) that downstream generation draws from. The project's `master_status` moves to `completed`.

**Flow: The Master Index and Master Context feed directly into the Embedding Layer.**

---

# LAYER 2: EMBEDDING LAYER

> This layer transforms the structured Master Index into a searchable, retrievable knowledge store. It converts code and text into mathematical vectors (embeddings) that capture semantic meaning, enabling the system to find relevant context for any question — even when the exact words differ. Think of it as building a "smart search engine" over the entire codebase.

---

## Stage 3: RAG (Retrieval-Augmented Generation)

RAG is the bridge between deterministic code analysis and AI-powered document generation. It ensures the LLM never generates from imagination alone — every statement in a generated document is grounded in actual code evidence retrieved from this layer.

### Substage 3.1: Create Chunks

**What happens (plain English):**
The raw code objects from the Master Index are too large and varied to search efficiently. We break them into smaller, semantically meaningful pieces called "chunks." Each chunk represents a single logical unit — one function, one class method, one COBOL paragraph, one MuleSoft flow. The key principle is: never cut in the middle of a logical unit. A chunk should make sense on its own.

**What happens (technical detail):**
Two chunkers handle different content types:

**Semantic Code Chunker** (`SemanticCodeChunker` in `semantic_chunker.py`):
Takes each code object and produces one or more chunks. For each object, it builds a semantic header:
```
function: processOrder
Handles order processing logic
Parameters: orderId (string), items (list)
Dependencies: validateOrder, calculateTotal, sendConfirmation
```
This header is prepended to the actual code, giving the embedding model semantic context about what the code does — not just the raw syntax. The header includes the object type, name, description (from docstring), parameters, and key dependencies.

For objects within the ~500 token budget, the entire object becomes a single chunk. For larger objects, `_split_code_structurally()` splits by logical boundaries: method definitions in classes, paragraph markers in COBOL (lines matching `^[A-Z0-9-]+\.\s*$`), section headers in generic code. Each structural piece becomes a child chunk with a `parent_id` reference back to the full object (the parent chunk).

This parent-child hierarchy is critical for retrieval quality. When a search matches a child chunk (a specific COBOL paragraph), the system can expand to the parent chunk (the entire COBOL program division) to give the LLM the full surrounding context. The `expand_to_parent()` function handles this expansion at retrieval time.

Each chunk gets a `SemanticChunk` object with: `chunk_id` (deterministic, based on content hash to enable deduplication), `content` (header + code), `source` ("code" or "document"), `metadata` (file_path, object_type, name, dependencies, language, line_range), `parent_id` (if it is a child chunk), and `parent_content` (the full parent text, populated during expansion).

**Semantic Document Chunker** (`SemanticDocumentChunker` in `semantic_chunker.py`):
Handles non-code content (master context, knowledge base documents, collateral documents). It splits by document structure first (`_split_by_structure()` — finding markdown headings, horizontal rules, and major section breaks), then splits large sections into paragraphs (`_split_paragraphs()`), and finally merges small paragraphs together until they hit the token budget (`_merge_to_budget()`). This ensures each document chunk is a coherent section, not an arbitrary text fragment.

**Advanced Chunker** (`AdvancedChunker` in `advanced_rag.py`):
The indexing service uses its own chunker that wraps the semantic chunkers. `chunk_code()` takes a code object dict and produces `Chunk` objects with content, metadata, source type, and chunk type. `chunk_document()` handles document content with header-based splitting and overlap-based splitting for long sections (configurable chunk_size=1000 tokens, chunk_overlap=200 tokens). The overlap ensures that context is not lost at chunk boundaries — the end of one chunk overlaps with the beginning of the next.

**Deduplication:**
Chunk IDs are deterministic (based on content hashes), so identical code objects that appear in multiple files (e.g., a shared copybook included by many COBOL programs) produce the same chunk ID and are stored only once. This prevents 15 near-identical chunks from polluting search results.

**Namespacing:**
Each chunk ID is prefixed with the project ID (`{project_id}::{chunk_id}`) to prevent cross-project contamination. Two different projects can have identically-named functions without their chunks colliding.

### Substage 3.2: Create Embeddings

**What happens (plain English):**
Each chunk of text is converted into a vector — a list of numbers (typically 1536 dimensions) that captures the semantic meaning of that text. Two chunks about "order processing" will have similar vectors even if they use completely different words. This is what enables semantic search: instead of matching exact keywords, we match meaning.

**What happens (technical detail):**
The embedding generation is handled by the RAG Embedding Service (Python/FastAPI on port 8005) and the Hybrid Search engine (`HybridSearch` in `advanced_rag.py`).

**Vector Embedding Generation:**
We generate embeddings using Azure OpenAI's embedding model (text-embedding-ada-002 or configurable via environment variable). Each chunk's content string is sent to the embedding API, which returns a 1536-dimensional float vector. We process embeddings in batches with a progress callback so the frontend shows real-time progress ("Generating embeddings... 150/300 chunks").

After generation, we verify coverage: the number of embeddings must match the number of chunks. If there is a mismatch (some embeddings failed to generate due to API errors or rate limits), we raise an error rather than proceeding with an incomplete store. The embedding version is tied to the index version, so if the code changes and gets re-indexed, we know the embeddings are stale and need refreshing.

**TF-IDF Index (Hybrid Search):**
In parallel with vector embeddings, we build a TF-IDF (Term Frequency-Inverse Document Frequency) index across all chunks. This gives us keyword-based search alongside semantic search.

Why both? Pure semantic search excels at understanding meaning ("show me the order processing logic") but can miss exact matches ("find the variable CUST-ACCT-NUM" or "which function references DB2 SQLCODE -805"). TF-IDF catches those exact keyword matches. The hybrid approach combines both:

```
final_score = alpha * semantic_score + (1 - alpha) * tfidf_score
```

The TF-IDF engine (`_tfidf_search()` in HybridSearch) tokenizes each chunk (lowercasing, removing stop words, splitting on whitespace and punctuation), builds an inverted index mapping each token to the chunks containing it, and computes TF-IDF scores at query time. It is stored in memory for the project's search engine instance and rebuilt when the project is loaded.

**Semantic Search Initialization:**
`_try_init_semantic()` in HybridSearch connects to the pgvector-backed embedding store. It loads existing embeddings from PostgreSQL if available, or generates new ones if the store is empty. The semantic search uses cosine similarity via pgvector's `<=>` operator for efficient approximate nearest-neighbor lookup.

### Substage 3.3: Vector Store (pgvector)

**What happens (plain English):**
All the embeddings (the number-vectors representing each chunk) are stored in a specialized database that is optimized for finding "similar" vectors quickly. When we later ask "find me chunks related to error handling," the database can scan millions of vectors and return the most similar ones in milliseconds. This is the searchable knowledge base that powers all downstream AI generation.

**What happens (technical detail):**
We use PostgreSQL with the pgvector extension as our vector store. pgvector adds a `vector` column type and efficient similarity search operators to standard PostgreSQL.

**Storage schema:**
Embeddings are stored in a table with columns for: chunk_id (text, primary key), project_id (text, indexed), content (text — the chunk text), embedding (vector(1536) — the float vector), metadata (jsonb — file_path, object_type, name, dependencies, language, line_range, parent_id), source (text — "code", "document", "master_context", "knowledge_base"), and created_at (timestamp).

**Search operations:**
- Cosine similarity search: `SELECT * FROM embeddings WHERE project_id = $1 ORDER BY embedding <=> $2 LIMIT $3` — finds the N most similar chunks to a query vector
- Filtered search: adds WHERE clauses on metadata fields (e.g., only search code chunks, or only search a specific file)
- Hybrid search: combines pgvector cosine similarity with in-memory TF-IDF scores

**Multi-pool architecture:**
The vector store contains chunks from multiple sources, each forming a distinct "pool":
1. Code Index pool — chunks from parsed code objects (the primary pool)
2. Master Context pool — chunks from the synthesized master context document
3. Customer Knowledge pool — chunks from user-uploaded KB documents categorized as customer knowledge (business glossary, business rules, compliance requirements, etc.)
4. Reference Knowledge pool — chunks from user-uploaded KB documents categorized as reference knowledge (design patterns, target architecture, platform best practices, etc.)

During retrieval, each pool is searched independently with document-type-specific weights (configured in `pool_weight_config.py`):
- BRD (Business Requirements): code 30%, customer knowledge 50%, reference 20%
- TRD (Technical Reference): code 50%, customer knowledge 10%, reference 40%
- Overview/Custom/Standard: code 40%, customer knowledge 30%, reference 30%

When a pool has no content (e.g., no KB documents uploaded), its weight redistributes proportionally to the remaining pools via `redistribute_weights()`. If customer knowledge is unavailable for a BRD (weights code=0.3, customer=0.5, reference=0.2), the remaining pools total 0.5, so code becomes 0.6 and reference becomes 0.4. If both customer and reference are unavailable, code gets 1.0. The system never breaks — it leans harder on whatever context is available.

**Query Expansion:**
Before searching, the Query Expander (`QueryExpander` in `advanced_rag.py`) broadens the search terms. It generates synonyms, related concepts, and alternative phrasings. For example, "error handling" expands to include "exception", "catch", "fault tolerance", "retry logic". This broadens the search net so we do not miss relevant chunks that use different terminology.

**The complete retrieval flow at search time:**
1. Query expansion — broaden search terms
2. Semantic search — top N chunks by cosine similarity in pgvector
3. TF-IDF search — top N chunks by keyword relevance
4. Hybrid merge — combine both result sets using weighted scoring
5. Deduplication — remove near-identical chunks, keeping highest-scoring version
6. Parent expansion (optional) — expand child chunks to parent for broader context
7. Return ranked results with scores and metadata

**Advanced enhancement — Semantic Query Cache:**
The `SemanticQueryCache` (in `unified_rag_pipeline.py`) stores (query_embedding, result) pairs in memory. On a new query, it computes the embedding and checks if any cached query is within cosine distance 0.05. If so, it returns the cached result instantly, avoiding redundant embedding store lookups. This dramatically speeds up generation when multiple sections ask similar questions.

**Advanced enhancement — Section Context Cache:**
The `SectionContextCache` (`section_context_cache.py`) caches RAG chunks at the section level and partitions them to individual subsections by cosine similarity. After a single RAG call retrieves chunks for an entire section, the cache stores them and later distributes relevant subsets to each subsection based on embedding similarity between chunk embeddings and the subsection topic embedding. Chunks above a relevance threshold (default 0.3) are included, with a minimum guarantee of 3 chunks per subsection. It also caches KB chunks per section and pool combination to avoid redundant KB retrievals.

**Flow: The Vector Store feeds the LLM Layer. Every document section, blueprint section, and chat answer is grounded in chunks retrieved from this store.**

---

# LAYER 3: LLM LAYER

> This is where AI transforms structured data and retrieved context into human-readable documentation. The LLM never generates from imagination — every statement is grounded in code evidence retrieved from the Embedding Layer and constrained by Fact Contracts from the Deterministic Layer. Think of it as a highly skilled technical writer who has read every line of code and every business document, and now writes comprehensive documentation with citations.

---

## Stage 4: Document Generation (Sequential Substages)

Document Generation is the most complex stage in the entire pipeline. It orchestrates a sophisticated sequence of substages — from selecting what to generate, through retrieving the right context, building precise prompts, calling the LLM, validating the output, and finally exporting polished deliverables. Each substage builds on the previous one.

### Substage 4.1: Select Doc Types

**What happens (plain English):**
The user chooses which documents they want generated. Options include Business Requirements Document (BRD), Technical Reference Document (TRD), Data Inventory and Schema Map, System Health Assessment, Modernization Roadmap, Test Scenarios and Cases, Executive Summary, and more. They also choose a generation mode: compact (4-5 pages, quick turnaround) or comprehensive (full-length, maximum detail). The system can also recommend document types based on what it found during code analysis.

**What happens (technical detail):**
The frontend (ProjectView.tsx) presents the available document types, defined in `DOCUMENT_TEMPLATES`:

| Doc Type | Title | Category |
|----------|-------|----------|
| trd | Technical Reference Document | technical |
| legacy_business_requirements | Business Process and Requirements | business |
| legacy_technical_specification | Technical Specification | technical |
| legacy_data_inventory | Data Inventory and Schema Map | data |
| system_health_assessment | System Health and Gap Assessment | health |
| modernization_roadmap | Modernization Strategy and Roadmap | roadmap |
| comprehensive_as_is_business_requirements | Comprehensive AS-IS Business Requirements | comprehensive |
| test_documentation | Test Scenarios, Cases and Scripts | testing |
| executive_summary | Executive Summary | summary |

Users can also create Custom Documents via the Custom Document Wizard (CustomDocumentWizard.tsx) — they define a document title, description, and section specifications (each section has a name, purpose, and content requirements). The system generates a document spec (`CustomDocumentSpec`) that drives generation.

Generation modes are configured via `PipelineConfig` (`pipeline_config.py`):
- `standard_comprehensive`: full-length, maximum detail, higher token budgets per section
- `standard_concise`: medium length, balanced detail
- `standard_compact`: 4-5 pages, quick turnaround, lower token budgets
- `custom`: user-defined spec with mode-specific budgets
- `overview`: synthesis-only mode for the application overview
- `specialized`: platform-specific document configurations
- `auditor`: prompt audit mode with enhanced quality checks

The config adapts to codebase size via `adapt_to_codebase_size()` — a 50-object codebase gets different token budgets than a 5000-object codebase.

**Advanced enhancement — AI-Recommended Doc Types:**
Before generating, a Codebase Analysis Agent reads the index and determines the documentation strategy. It identifies the system type (monolith, microservices, batch processing), primary language, coverage requirements (total objects, tables, procedures), and recommends which document types to generate. If the user did not specify doc types, the AI-recommended ones are used. The analysis also determines the coverage approach (standard vs deep-dive) and stores the result for reuse on subsequent runs.

### Substage 4.2: RAG Retrieve

**What happens (plain English):**
For each section of each document, the system searches the knowledge base (built in the Embedding Layer) to find the most relevant code snippets, schema details, dependency information, and business context. It does not just do a simple keyword search — it formulates intelligent queries tailored to each section, breaks complex questions into sub-questions, searches multiple knowledge pools simultaneously, reranks results for precision, and even traverses the code dependency graph to find structurally related context that a text search would miss.

**What happens (technical detail):**
The Unified RAG Pipeline (`unified_rag_pipeline.py`) orchestrates a multi-step retrieval process for each document section:

**Step 1 — Query Formulation:**
The Section Query Formulator (`section_query_formulator.py`) takes the section name, document type, and generation mode, and produces three sets of queries — one per RAG pool:

- Code queries: targeted at the code index, focused on implementation details. Example for a "Data Model" section: "database tables, schemas, entity relationships, data types, foreign keys"
- Customer knowledge queries: targeted at uploaded KB documents, focused on business context. Example: "business data requirements, data governance policies, data quality rules"
- Reference knowledge queries: targeted at design patterns and best practices. Example: "data modeling best practices, normalization patterns, schema design standards"

The formulator generates mode-specific variants: comprehensive mode produces broader, more exploratory queries; compact mode produces focused, targeted queries. It applies scope exclusions (`_scope_exclusions()`) to prevent cross-section content bleeding — the "Security Analysis" section's queries explicitly exclude data model content. For custom documents, it enriches queries with the custom spec's description and requirements (`_custom_spec_enrichment()`). For overview-biased sections, it adds overview-specific context (`_overview_bias()`).

**Step 2 — Query Decomposition:**
The Query Decomposer (`query_decomposer.py`) breaks complex queries into atomic sub-queries. It detects complexity via heuristics: if the query has 8+ words AND contains connective words ("and", "including", "as well as", "from...to", "end-to-end"), it is complex.

For complex queries, LLM decomposition is tried first — the LLM returns a JSON array of 2-5 atomic sub-queries. If the LLM call fails, rule-based decomposition kicks in: splitting on "and"/"including"/"as well as", or splitting "from X to Y" patterns into separate source/destination/flow queries. After decomposition, a coverage validator checks whether the sub-queries collectively cover all aspects of the original query, adding up to 2 gap-filling sub-queries if needed.

Example: "explain the data flow from ingestion to storage including error handling" becomes:
1. "how is data ingested and what triggers ingestion?"
2. "what transformations happen to data after ingestion?"
3. "how is data stored and what storage format is used?"
4. "how are errors handled during data processing?"

**Step 3 — Multi-Pool Retrieval with Weighted Scoring:**
All sub-queries are sent to all three RAG pools simultaneously. Each pool is searched independently using the hybrid search engine (semantic + TF-IDF). The Section Context Cache prevents redundant retrievals — if two sections need the same query results, we serve from cache.

Results from each pool are weighted according to the document type configuration (BRD: code 30%, customer 50%, reference 20%; TRD: code 50%, customer 10%, reference 40%). When a pool is unavailable, weights redistribute proportionally via `redistribute_weights()`.

**Step 4 — Reranking:**
The raw chunks (typically 50-100 across all sub-queries and pools) go through two-stage reranking:

1. Reciprocal Rank Fusion (RRF) (`reciprocal_rank_fusion()` in `reranker.py`): Merges results from multiple sub-queries. Each sub-query produces its own ranked list, and RRF combines them: `score = sum(1 / (k + rank_i))` where k=60. Chunks appearing in multiple sub-query results get boosted.

2. Cohere Cross-Encoder Reranker (`CohereAzureReranker`): Unlike embedding-based similarity (which encodes query and chunk independently), the cross-encoder processes query and chunk together as a pair, producing a much more accurate relevance score. We keep the top 8-15 chunks after reranking. If the Cohere reranker is unavailable (network error, rate limit), `_apply_fallback()` uses RRF scores combined with TF-IDF as a degraded but functional alternative.

**Step 5 — Graph RAG Expansion:**
The Graph RAG Expander (`graph_rag_expander.py`) traverses the code dependency graph to add structurally related context that text search missed.

For each retrieved chunk, it extracts the node ID (the code object it represents) via `_extract_node_ids()`. It loads the edge cache — caller-to-callee relationships from the index — via `_load_edge_cache()`. Then `_traverse_edges()` does a BFS (breadth-first search) outward from each retrieved node, following both forward edges (callees) and reverse edges (callers). If we retrieved `processOrder()`, we follow edges to find `validateOrder()`, `calculateTotal()`, `sendConfirmation()`, and `handleOrderError()`.

Cycle detection (`_creates_cycle()`) prevents infinite traversal. Traversal depth is configurable. After expansion, `_fetch_content()` retrieves the actual content for each newly discovered node, and `_rerank()` scores the expanded set against the original query using cosine similarity (`_compute_similarity()`). Only the most relevant graph neighbors make it into the final context. Diagnostics are reported via `_report_diagnostics()`: nodes traversed, edges followed, new chunks added.

### Substage 4.3: Template Prompts

**What happens (plain English):**
The system builds a carefully crafted instruction set for the AI. This is not a simple "write about X" prompt — it is a multi-layered prompt that includes: the AI's role and persona, the specific section requirements, the retrieved code evidence, the Fact Contracts it must respect, formatting rules, word budgets, tone guidelines, scope fences (what to include and what to exclude), and any learned patterns from previous successful generations. The prompt is also audited by a team of AI critics before being sent to the LLM.

**What happens (technical detail):**
Prompt construction involves multiple builders working together:

**System Prompt Construction** (`get_mode_system_prompt()` in `generator.py`):
The system prompt establishes the AI's persona (e.g., "You are a senior enterprise architect documenting a legacy COBOL mainframe system for modernization"), the generation mode constraints (comprehensive vs compact), platform-specific context (`_get_platform_context_prompt()` — different instructions for COBOL vs MuleSoft vs Appian), and guardrails (`get_guardrails_text()` — rules like "never invent code that does not exist in the index", "always cite specific program names", "respect Fact Contract data").

**Section-Level Prompt Building** (`prompt_builder.py` and `section_prompt_builder.py`):
Each section gets a tailored prompt with:
- Scope fence (`build_scope_fence()`): explicit list of topics this section covers and does not cover, preventing content bleeding across sections
- Coverage instruction (`build_coverage_instruction()`): which code objects must be mentioned in this section
- Enhancement block (`build_enhancement_block()`): platform-specific enrichment instructions
- Word budget: dynamically computed based on generation mode, total subsections, and codebase size (`_compute_dynamic_word_budget()`)
- Tone profile (`infer_tone_profile()` in `quality_gates.py`): section-specific tone — data sections get precise/clinical tone, narrative sections get explanatory/accessible tone
- Format preference (`infer_format_preference()`): tables for data sections, prose for narrative sections, diagrams for architecture sections
- Depth multiplier (`compute_depth_multiplier()`): earlier sections get more depth (they establish context), later sections can be more concise

**RAG Context Injection:**
The retrieved chunks from Substage 4.2 are formatted into a structured context block (`_build_focused_context()`, `_format_cached_chunks()`). Each chunk is presented with its source file, object type, and relevance score. The context is organized by relevance — highest-scoring chunks first — and truncated if it exceeds the token budget while preserving structure.

**Agentic Memory Injection:**
Before calling the LLM, the system checks for learned patterns from past successful generations that apply to this (platform, doc_type) combination. Patterns are stored in PostgreSQL (or in-memory dict as fallback), keyed by platform and document type. Examples: "COBOL projects: always include PERFORM hierarchy diagram in technical spec", "MuleSoft projects: data flow section needs connector-level detail". The top 5 patterns with score >= 0.6 are injected into the system prompt as a "Learned Patterns" section.

**Advanced enhancement — 6-Phase Prompt Auditing:**
Before any LLM call, the Prompt Auditor (`prompt_auditor.py`) runs a 6-phase audit pipeline:

1. Five parallel critics — Accuracy Critic, Completeness Critic, Clarity Critic, Bias Critic, Security Critic — each independently evaluate the prompt and produce findings with severity levels (critical/high/medium/low/none)
2. Cross-examination of critic findings against each other to resolve contradictions (e.g., Completeness wants more detail while Clarity wants less verbosity)
3. Extraction of proposed changes from findings into a concrete modification list
4. Devil's advocate challenges the proposed changes to prevent over-correction
5. Synthesizer produces a patched prompt, retrying up to 5 times until reaching >= 90% confidence
6. Blind verifier independently confirms the patch improves the prompt without knowing what the critics said

Results are cached by prompt hash (SHA-256) with a TTL. The full audit trail is logged to a JSONL sidecar file and optionally synced to Azure Blob.

### Substage 4.4: LLM Synthesis

**What happens (plain English):**
The AI model receives the carefully constructed prompt — complete with its role, the section requirements, the code evidence, and all constraints — and generates the document section. If the output is not good enough, a team of AI agents (a Critic and a Reviser) debate the quality and iteratively improve it. The system also adjusts its "creativity dial" (temperature) based on how well previous attempts went — if conservative approaches are not working, it tries more creative ones.

**What happens (technical detail):**
The LLM Client (`llm_client.py`) manages all interactions with the language model (Azure OpenAI GPT-4 or configurable):

**Adaptive Temperature:**
Temperature is not static — it adapts based on quality signals (`adaptive_temperature()` in `quality_gates.py`):
- If the judge score from a previous attempt was low (0.3), temperature increases to 0.6 to encourage creative exploration
- If the judge score was high (0.9), temperature drops to 0.1 to preserve quality
- Each retry attempt adds +0.1 to temperature, hard-capped at 0.7
- Different section types get different base temperatures: data-heavy sections get lower temperatures (precision matters), narrative sections get slightly higher ones (`infer_temperature()`)

**Token Management:**
Before calling the LLM, total token count is estimated (system prompt + user prompt + RAG context). If it exceeds the model's context window, the prompt is reduced intelligently — removing low-priority RAG chunks first, then trimming verbose descriptions, keeping the structural skeleton intact. The LLM client supports adaptive timeouts based on prompt size. Retries use exponential backoff (3 attempts) on transient failures.

**Structured Output Enforcement:**
For sections requiring structured data (tables, lists, JSON), the system uses structured output parsing (`structured_output.py`) to enforce valid formats. If the LLM returns malformed JSON or broken markdown tables, a self-correction loop re-prompts with the error message.

**Continuation Handling:**
For very long sections that exceed the LLM's output token limit, the Continuation Handler (`continuation_handler.py`) detects truncated output (`_looks_truncated_output()`) and issues follow-up calls with "continue from where you left off" instructions. The continuation chunks are deduplicated (`_dedupe_continuation_chunk()`) and merged seamlessly.

**Multi-Agent Debate (Post-Generation):**
Every generated section goes through a critic/reviser loop (`MultiAgentDebate` in `multi_agent_debate.py`, up to 3 rounds):

Round 1:
1. The Critic agent receives the generated content plus the RAG context (ground truth) and evaluates it. It produces specific issues ("missing table column details", "component count contradicts Overview section") and assigns a quality score (0.0-1.0) via `_critique_with_score()`.
2. If the critic score is >= 0.9 or the critic says "APPROVED", we stop — content is good enough.
3. Otherwise, the Reviser agent receives the original content plus critic feedback and rewrites the section via `_revise()`.
4. Safety check: if the revised content is less than 30% of the original length, we reject the revision as garbage and keep the original.

Rounds 2-3: Same process on the revised content. Each round tracks the best-scoring version. After all rounds, the best-scoring version is returned. If the best score is below 0.6, the section gets a quality flag for human review.

**Confidence Calibration:**
Every section is scored by the `ConfidenceCalibrator` (`confidence_calibrator.py`) on a 0.0-1.0 composite scale with four signals:

- RAG Coverage (25-40% weight): how many chunks grounded the answer. 0 chunks = 0.0, 5+ chunks = 1.0
- Judge Score (45% weight when available): the score from multi-agent debate
- Structure (15-35% weight): word count relative to expected minimum + heading presence
- Hedging Detection (15-25% weight): scans for 20+ uncertainty phrases ("it seems", "probably", "likely", "might be", "unclear", "not available", "TBD", "N/A", etc.). Each match adds a 0.2 penalty, capped at 0.6 penalty

Section-type-specific thresholds determine the review cutoff:
- Data/schema/entity sections: 0.75 (high confidence required)
- API/endpoint sections: 0.70
- Security/compliance/migration: 0.70-0.75
- Process/workflow/architecture: 0.65
- Executive/overview/summary: 0.60

Sections below their threshold get flagged with a human-readable reason: "Score 0.52 < threshold 0.75: insufficient RAG context (2 chunks); low judge score (0.45); 3 uncertainty phrases."

### Substage 4.5: Validate and Save

**What happens (plain English):**
After all sections are generated, the system runs a battery of quality checks on the complete document. It looks for contradictions between sections, fixes formatting issues, normalizes heading numbering, removes duplicate content, validates Mermaid diagrams, and rebuilds the table of contents. Only after passing these gates is the document saved. If issues are found, they are either auto-fixed or flagged for human review.

**What happens (technical detail):**

**Cross-Section Consistency Checking** (`CrossSectionConsistencyChecker` in `quality_gates.py`):
After all sections are generated, the checker truncates each section to 1500 characters, batches them, and asks the LLM to identify contradictions. Examples: "Data Model says 15 tables but Executive Summary says 12", "Security section mentions OAuth2 but API Inventory says API keys only." Issues are deduplicated (`_deduplicate_issues()`), and simple conflicts are auto-resolved (`_auto_resolve_conflicts()`) when one section clearly has more detail. Remaining issues are flagged for human review.

**Document Normalization** (`DocumentNormalizer` in `document_normalizer.py`):
A comprehensive 16-step post-processing pipeline:
1. Parse sections and detect duplicates (same heading with similar content)
2. Normalize heading hierarchy — fix H2-to-H4 jumps without H3
3. Apply consistent numbering (1., 1.1, 1.1.1) across the document
4. Rebuild Table of Contents to match actual headings
5. Remove duplicate intro paragraphs (LLM often repeats introductory sentences)
6. Remove duplicate chunk headers (RAG context bleeding into output)
7. Remove repeated chunk intros (introductory phrases mirroring RAG context)
8. Collapse single-sentence paragraphs that add no value
9. Remove empty sections (heading with no content)
10. Limit bullet lists (cap extremely long lists, add summary)
11. Remove trailing summaries (LLM restates what was already said)
12. Remove redundant "At a Glance" blocks
13. Remove generic "Implications" subsections (filler content)
14. Strip self-references to "CodeForensics"
15. Fix fenced code blocks that are actually tables
16. Merge consecutive deep headings (H4/H5) with no content between them

**Mermaid Diagram Fixing** (`mermaid_fixer.py`):
LLM-generated Mermaid diagrams are validated and auto-repaired. Checks for syntax errors, node/edge consistency (no references to undefined nodes), and auto-fixes common LLM mistakes: missing semicolons, invalid characters in node names, malformed arrow syntax.

**Verify Loop** (`verify_loop.py`):
An optional post-generation verification step re-reads the generated document, checks it against the original requirements and RAG context, and logs verification results to a sidecar JSONL file. This creates an audit trail of what was generated and whether it met requirements.

**Save:**
The validated, normalized document is saved as markdown to disk or Azure Blob at `{output_dir}/docs/{doc_type}.md`. A metadata sidecar file records: generation timestamp, generation mode, token usage, section count, confidence scores, quality flags, and the index version used. The project status for that document type moves to `completed`.

**Advanced enhancement — Feedback Loop and Section Regeneration:**
After the user reviews a generated document, they can provide per-section feedback through the Section Reviewer UI (SectionReviewer.tsx): quality rating, accuracy flag, completeness flag, and free-text instructions. The Feedback Store (`feedback_store.py`) persists review states (pending, approved, changes_requested, regenerating, regenerated) as JSON files.

When regeneration is triggered, the Section Regenerator (`section_regenerator.py`):
1. Parses section boundaries by matching heading patterns
2. Builds a feedback-aware prompt from user instructions
3. Augments RAG queries with feedback context
4. Runs LLM self-reflection before regenerating
5. Retrieves fresh RAG context (not reusing original)
6. Generates replacement section with feedback-aware prompt
7. Runs verification loop on regenerated section (up to 3 attempts, accepting best score above 0.60 threshold)
8. Atomically splices new section into document (write to temp file, then rename)

**Advanced enhancement — AutoResearch Self-Improvement Loop:**
The AutoResearch loop (`run.py`) continuously improves prompt quality across generation runs:
1. Generate document with current prompt template
2. LLM Judge scores output (0.0-1.0) on accuracy, completeness, structure, relevance
3. If score >= 0.75: store successful pattern in Agentic Memory; store complete example in RAFT Dataset Builder for fine-tuning (exportable as JSONL)
4. Prompt Mutator generates improved prompt variant (rephrasing, adding constraints, removing ambiguity)
5. Composite Scorer combines objective metrics with LLM Judge score
6. Accept/reject mutation using simulated annealing (better scores always accepted; worse scores accepted with decreasing probability)
7. Checkpoint saved after each iteration for resume on failure

The loop terminates on: max iterations, token budget exhaustion, plateau detection (no improvement over N iterations), or consecutive zero-improvement iterations. It runs across multiple prompt adapters in round-robin order.

### Substage 4.6: Export

**What happens (plain English):**
The finished documents are delivered to the user in their preferred format — PDF with professional formatting, cover pages, and clickable table of contents; Word documents for editing; HTML for web viewing; or specialized IDE packages that developers can import directly into their coding tools (Kiro, Cursor, GitHub Copilot, Claude Code) so the AI assistant in their IDE already knows the codebase.

**What happens (technical detail):**
The Export Service (Node/Express on port 3002) handles all export operations via `exportController.js`:

**Markdown** — Direct download of the raw `.md` file.

**HTML** — Styled export (`htmlExportService.js`) with CSS, proper table formatting, syntax-highlighted code blocks, and responsive layout.

**PDF** — Sophisticated two-pass process via `MarkdownPDFGenerator` (`pdf_generator.py`):
1. Convert markdown to HTML, rendering all Mermaid diagrams to SVG using a headless Playwright browser (`render_mermaid_to_svg()`)
2. Convert pipe tables to proper HTML tables (`_convert_pre_block_pipe_tables_to_html()`, `_convert_paragraph_pipe_tables_to_html()`)
3. Apply syntax highlighting to code blocks
4. Sanitize dangerous HTML tags — script, iframe, etc. (`_sanitize_dangerous_tags()`)
5. Generate cover page with project name and generation date (`_build_cover_html()`)
6. Build Table of Contents from all headings (`_build_toc_html_with_pages()`)
7. First PDF render pass — generate PDF to determine actual page numbers
8. Extract heading-to-page-number mappings from rendered PDF (`_extract_heading_page_map_from_pdf()`)
9. Second render pass — inject actual page numbers into TOC and re-render final PDF (`_apply_static_toc_pages_to_html()`)
10. PDF generation runs as async background job with status tracking (processing/completed/failed)

**DOCX** — Async background job using python-docx for Word document generation.

**ZIP** — All documents bundled as an archive for bulk download.

**IDE Export Packages** — This is where the AI Domain Lifecycle (AI DLC) artifacts get transformed into IDE-native formats:

- Kiro (`kiroExporter.js`): Generates Kiro specs (requirements.md, design.md, tasks.md) per module, plus overview specs and agentic AI plan files. Each module from the blueprint becomes a Kiro spec folder with structured requirements, design decisions, and implementation tasks that Kiro's AI assistant can consume for guided development.

- Cursor (`cursorExporter.js`): Generates `.cursor/rules/*.mdc` files with project-specific coding rules, architecture context, and implementation guidelines derived from the blueprint.

- GitHub Copilot (`copilotExporter.js`): Generates `.github/copilot-instructions.md` with project context, coding standards, and architecture decisions.

- Claude Code (`claude_code_exporter.py`): Generates `CLAUDE.md` files with project context, domain knowledge, and coding guidelines.

- Generic (`genericExporter.js`): Generates a standard markdown export with overview, per-module documentation, and agentic AI plans — usable by any IDE or documentation system.

Each exporter takes the blueprint's units (logical business modules), bolts (integration points between modules), domain designs, and execution plans, and transforms them into the format each IDE's AI assistant understands natively. The Workflow Integrator (`workflow_integrator.py`) coordinates which artifacts go to which exporter. A developer can import the package into their IDE and immediately have AI-assisted development grounded in the actual modernization blueprint.

**Advanced enhancement — Blueprint Generation:**
Blueprints are forward-engineering modernization documents. The user selects a source platform (e.g., COBOL on z/OS) and a target platform (e.g., Java/Spring Boot on Azure). The Blueprint Generator (`blueprint_generator.py`) produces 14 sections sequentially, each referencing earlier sections via a Blueprint Cache:

1. Source Inventory — current-state analysis
2. Mapping Matrix — source-to-target component mapping
3. Target Architecture — future-state design
4. Business Rules — logic preservation rules
5. Data Migration — data movement strategy
6. API Contracts — integration specifications
7. Logic Specs — detailed per-component specifications
8. Error Handling — error strategy design
9. Task Graph — implementation phases with dependencies
10. NFRs and Operations — non-functional requirements
11. Security and Identity — authentication, authorization, encryption
12. Phasing and Cutover — rollout plan
13. Agentic AI — AI agent placement recommendations
14. Validation and Acceptance — testing strategy

Each section goes through the same pipeline: RAG retrieval, platform-specific configuration, LLM generation with audited prompts, and coverage tracking. Output: structured JSON + readable Markdown + coverage report. The blueprint feeds into the AI DLC system which maps it to Inception (what to build), Construction (units, bolts, domain designs), and Operations (execution plans) lifecycle phases.

**Advanced enhancement — RAG Chat Engine:**
The RAG Chat (port 8005, `rag_chat.py`) provides a conversational interface grounded in the project's indexed codebase. It uses the same multi-pool retrieval, hybrid search, reranking, and parent-child expansion as document generation, but in a conversational context. Features include: conversation history with full message persistence, streaming responses via SSE, citation verification (`CitationVerifier` — extracts claims from responses and verifies each against the RAG context), contextual suggested questions derived from actual codebase structure, multi-query reformulation from conversation history, and conversation export as PDF.

---

## Cross-Cutting: Observability

Throughout all three layers, the system maintains comprehensive observability:

**Structured JSON Logging** — Every log entry is JSON with: timestamp, level, service name, logger name, message, project_id, request_id, and trace_id. Makes logs searchable and correlatable across requests.

**Prometheus Metrics** — Histograms and counters for: generation duration, LLM API call latency, input/output token counts, RAG retrieval duration, chunks retrieved per query, generation error count, active generation gauge, and per-project/per-doc-type token cost tracking. All metrics have graceful no-op fallback — generation never fails because of metrics.

**OpenTelemetry Tracing** — OTLP export with spans for document generation requests, per-section RAG retrieval, LLM API calls, and KB ingestion. W3C trace context propagation for cross-service communication. Falls back to no-op spans when OTEL packages are not installed.

**Real-Time Progress** — Server-Sent Events (SSE) stream progress to the frontend at every stage: file scanning, parsing, embedding generation, section generation, quality checks, and export. The user sees exactly what is happening and can cancel at any point.

**Audit Trail** — Every generation decision is logged: which prompts were used, which RAG chunks were retrieved, what scores the critics gave, what mutations the AutoResearch loop tried, and what the final confidence scores were. This trail is persisted as JSONL sidecar files and optionally synced to Azure Blob for compliance and debugging.
