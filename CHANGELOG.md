# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2025-05-19

### Added

- ACP (Agent Client Protocol) agent transport for pi coding agent
- JSON-RPC 2.0 over stdin/stdout transport
- Session lifecycle management (new, load, resume, close, list)
- Prompt handling with streaming session updates
- Tool call permission delegation to ACP client
- File system operations (read/write) with path validation
- Terminal operations (create, output, wait, release, kill)
- Provider management (list, set, disable)
- NES (Next Edit Suggestion) stubs
- Session configuration (modes, config options)
- Comprehensive test suite with 184 tests
