# pi-acp Improvement Plan

This improvement plan has been completed. See CHANGELOG.md for details of all changes.

## Remaining Future Work

### MEDIUM priority

- Add env var filtering/blocking in terminal spawn to prevent privilege escalation
- Remove resolved paths from error messages sent to clients (information leakage)
- Add timeout and success-path cleanup for `pendingPermissions` map in acp-extension.ts
- Replace string concatenation with array-based buffering in terminal output collection

### LOW priority

- Add upper bounds on terminal output buffer size
- Add session and terminal count limits to prevent resource exhaustion
- Use `crypto.randomUUID()` for terminal IDs instead of `Math.random()`
- Add architecture documentation about capability delegation pattern
