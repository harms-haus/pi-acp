# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Fixed symlink escape vulnerability in `fs/write_text_file` (ENOENT parent directory bypass)
- Fixed symlink escape vulnerability in `session/load` (missing realpath check)
- Fixed memory leak in terminal error handler (ChildProcess objects not cleaned up on spawn error)
- Fixed NaN cursor handling in `session/list` pagination
- Fixed raw Error throws in path validation (now uses proper ACP error codes)
- Added `fork` capability to `initialize` response
- Deduplicated session creation logic between `sdk-factory` and `session-load`

### Changed

- Replaced all raw error code numbers with named `ACP_ERROR_CODES` constants
- Extracted `requireSession()` helper to reduce duplication across 6 handlers
- Extracted `requireTerminal()` helper to reduce duplication across 4 terminal handlers
- Extracted `assertWithinSandbox()` helper for symlink-aware path validation
- Simplified `types.ts` from 540 to 141 lines using `export * from` pattern
- Renamed `outputByteLimit` to `outputCharLimit` (measures characters, not bytes)
- Converted dynamic import to static in terminal handler
- Extracted magic numbers into named constants
- Added `cleanupConfigOptions()` to prevent memory leak on session close

### Removed

- Removed 8 unused `make*Error` factory functions from error-codes.ts
- Removed unused `typebox` dependency
- Removed dead barrel file `utils/index.ts`
- Removed unused SDK re-exports (`RequestError`, `SDK_AGENT_METHODS`, `SDK_CLIENT_METHODS`)
- Removed unused `extractTurnIdFromMessage` function

### Added

- Added JSDoc documentation to all 20+ handler functions and key utilities
- Added 5 new test files (param-validation, session-cancel, session-resume, session-load, sdk-factory)
- Raised test coverage from 68% to 98%+ (274 tests)
- Raised coverage thresholds from 50% to 90%

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
