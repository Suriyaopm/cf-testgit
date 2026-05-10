# CodeForensics - Release Notes

## v1.0.0

- Multi-source project onboarding: create projects from local folders, Git repositories (with PAT support), or ZIP files
- Automatic technology and platform detection from uploaded code
- AI-powered documentation generation with 8 artifact types: Legacy Business Requirements, Comprehensive As-Is Business Requirements, Executive Summary, Legacy Technical Specification, Legacy Data Inventory, System Health Assessment, Modernization Roadmap, and Forward Engineering Blueprint
- Custom Document Wizard with pre-built templates (Salesforce, IBM BPM, Java, ServiceNow) and user-saved templates
- Configurable output modes: Compact, Concise, and Comprehensive with selectable output types (documentation, code, or both)
- Full-featured document viewer with PDF, Word, HTML, and JSON export
- Mermaid diagram rendering for architecture, flow, and data structure visualizations
- Section-level feedback and AI-powered regeneration without re-running full pipeline
- Code intelligence dashboard with dependency graph, treemap, language distribution, and object type charts
- RAG-powered project chat with source citations and conversation history
- Standalone chat mode accessible via dedicated route
- Knowledge base management: upload domain documents (PDF, DOCX, XLSX, CSV, MD, JSON, YAML) with processing status tracking
- Admin dashboard with token usage analytics, cost estimation, and performance charts
- Prompt optimization via AI Developer Lifecycle (DLC) with LLM judge scoring
- Audit trail tracking with synthesizer rationale, verifier notes, and critic severities
- IDE export pipeline: export blueprints to Kiro, Cursor, GitHub Copilot, and Claude Code
- Azure AD / MSAL SSO authentication and JWT-based auth support
- Guided onboarding tour, command palette, and dark/light theme toggle
- Real-time generation progress via SSE streaming with graceful cancellation and resume
- OWASP ZAP baseline DAST scanning integrated in QA release pipeline
- Support for 100+ technologies across Mainframe, Low-Code, SAP, Oracle, Modern Stack, and Cloud platforms
