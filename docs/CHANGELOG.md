# Changelog of Interview Coach with Microsoft Agent Framework

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-10

### Changed

- Replaced SQLite persistence with Azure Cosmos DB (NoSQL) via the EF Core Cosmos provider; local development uses the Cosmos DB emulator with Data Explorer
- Moved the shared AppHost constants, LLM resource factory, and extensions into the `InterviewCoach.AppHost.Core` project
- Switched the MarkItDown MCP client to the Streamable HTTP endpoint (`/mcp`)

### Removed

- GitHub Models provider connector
- Azure File Share persistence and the SQLite Web viewer, superseded by Azure Cosmos DB

### Fixed

- MarkItDown container ingress not being marked external when published (endpoint ordering)

## [1.0.0] - 2026-07-10

### Added

- `.vscode` tasks to launch each LLM provider mode (Microsoft Foundry, Azure OpenAI, GitHub Models, GitHub Copilot)
- Microsoft Foundry orchestration through .NET Aspire, including Azure File Share integration for persistent storage
- GitHub Models as a free provider option for local development and prototyping
- Aspire skill and Playwright CLI skill with supporting reference documentation
- NDC Sydney presentation deck under `docs/`

### Changed

- Centralized build and package configuration via `Directory.Build.props` and `Directory.Packages.props`
- Upgraded `Aspire.AppHost.Sdk` to 13.2.2 and refreshed Aspire dependencies
- Refactored the multi-agent workflow and removed the Squad assets
- Fixed the `mcp-interview-data` resource scheme
- Restricted SqliteWeb to run mode only
- Moved artifact upload path to `./samples`

### Removed

- GitHub Copilot SDK integration (temporarily removed pending updates)

### Fixed

- Session ID propagation and logging across agents and MCP clients
- Typo in the devcontainer configuration

### Documentation

- Comprehensive documentation review with Mermaid diagram conversion
- Provider setup guides for GitHub Models and Microsoft Foundry
- CONTRIBUTING, CHANGELOG, and pull request template additions

## [0.1.0] - 2026-01-22

### Added

- Initial release of Interview Coach with Microsoft Agent Framework
- Multi-agent orchestration for job interview coaching
- AI-powered interview coach agent and custom .NET expert agent
- Integration with Azure OpenAI for LLM inference
- Model Context Protocol (MCP) InterviewData server with wired MCP clients
- Web UI for interactive interview practice
- .NET Aspire AppHost for local development and deployment orchestration
- Azure deployment support via Azure Developer CLI (azd)
- Comprehensive README with setup instructions, architecture diagrams, and Code of Conduct

---

## Template for Future Releases

## [Version] - YYYY-MM-DD

### Added

- New features

### Changed

- Changes to existing functionality

### Deprecated

- Features that will be removed in upcoming releases

### Removed

- Features that have been removed

### Fixed

- Bug fixes

### Security

- Security improvements or fixes
