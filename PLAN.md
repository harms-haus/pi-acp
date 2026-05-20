# pi-acp Improvement Plan

## Conventions

- Every step is **atomic**: after completing it, `npm run build && npm test` must pass (all 94 existing tests green).
- Each step lists exact files to create/modify, exact content changes, and a verification command.
- Steps are ordered by dependency — do not reorder.
- The plan is split into 5 phases. Phases 1–3 are infrastructure and code quality; Phase 4 is test coverage; Phase 5 is release preparation.

---

## Phase 1: Infrastructure & Tooling (no code logic changes)

### Step 1.1 — Create `.editorconfig`

**Create** `.editorconfig`

Content (identical to pi-lens):
```ini
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2
```

**Verify:** `cat .editorconfig`

---

### Step 1.2 — Install Prettier and eslint-config-prettier

Run:
```bash
npm install --save-dev prettier eslint-config-prettier
```

This adds `prettier` and `eslint-config-prettier` to `devDependencies` in `package.json` and updates `package-lock.json`.

**Verify:** `node -e "require('prettier'); console.log('ok')"`

---

### Step 1.3 — Create `.prettierrc`

**Create** `.prettierrc`

Content (identical to pi-lens):
```json
{
  "tabWidth": 2,
  "useTabs": false,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "semi": true
}
```

**Verify:** `npx prettier --check src/acp/types.ts` (should parse without error; may report formatting differences, which is expected)

---

### Step 1.4 — Add `format` and `format:check` scripts to `package.json`

**Modify** `package.json`

In the `"scripts"` section, add these two entries (insert them after the existing `"lint:fix"` line, maintaining alphabetical grouping):

```json
"format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
"format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
```

Exact replacement:

Old text:
```
    "lint:fix": "eslint . --fix",
```

New text:
```
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
```

**Verify:** `npm run format -- --check` (should parse without error)

---

### Step 1.5 — Clean up ESLint config

**Modify** `eslint.config.mjs`

Replace the entire file with:

```javascript
import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Base ESLint recommended config
  eslint.configs.recommended,

  // TypeScript ESLint recommended configs with type checking
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Prettier compatibility — disables conflicting stylistic rules
  prettierConfig,

  {
    name: "pi-acp-config",
    files: ["src/**/*.ts"],
    plugins: {
      'import': importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript strict rules — errors
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/no-deprecated": "off",

      // TypeScript warnings
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "@typescript-eslint/explicit-function-return-type": ["warn", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      "@typescript-eslint/require-await": "warn",

      // Complexity rules
      "max-depth": ["error", 5],
      "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      "complexity": ["error", 15],

      // Base ESLint rules
      "no-console": ["warn", { allow: ["error"] }],
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-duplicate-imports": "error",

      // Import ordering
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // Turned off rules
      "n/no-process-exit": "off",
    },
  },

  // Allow default project for config files not in tsconfig
  {
    name: "allow-default-project",
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.mjs", "*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Test files — relaxed rules
  {
    name: "test-files-config",
    files: ["tests/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "max-depth": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
    },
  },

  // Ignore patterns
  {
    name: "ignore-patterns",
    ignores: [
      "node_modules/",
      "dist/",
      "**/*.d.ts",
      "coverage/",
    ],
  },
);
```

Key changes from original:
1. **Kept** `eslint-plugin-import` (needed for `import/order` rule) but removed from `package.json` is NOT done — keep it.
2. Removed `n` (`eslint-plugin-n`) — only rule was `n/no-process-exit: off`, now removed.
3. Removed `unicorn` (`eslint-plugin-unicorn`) — zero configured rules.
4. Added `prettierConfig` import and spread.
5. Added `files: ["src/**/*.ts"]` to main config block.
6. Added `"max-depth"`, `"max-lines-per-function"`, `"complexity"` rules.
7. Added `max-depth`, `max-lines-per-function`, `complexity` overrides to test config.
8. Removed `"n/no-process-exit": "off"` (plugin removed).

**Modify** `package.json`

Remove these two entries from `devDependencies`:
- `"eslint-plugin-n": "^18.0.1"`
- `"eslint-plugin-unicorn": "^64.0.0"`

Run:
```bash
npm install
```

**Verify:** `npm run lint` (should complete with 13 warnings, 0 errors — same as before)

---

### Step 1.6 — Stricter `tsconfig.json`

**Modify** `tsconfig.json`

Add these four options inside `"compilerOptions"` after `"sourceMap": true`:

```json
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

**NOTE:** This step will intentionally break the build because of:
- Unused `_turnId` in `event-translator.ts` (fixed in Step 2.6)
- Unused return value in `session-load.ts` (fixed in Step 2.7)

If you want each step to compile, you must combine this step with Steps 2.6 and 2.7 as a single atomic commit.

**Decision:** Combine Steps 1.6, 2.6, and 2.7 into one atomic change. See Step 2.6+2.7+1.6 below.

---

### Step 1.6+2.6+2.7 — Combined: Stricter tsconfig + fix unused variables

#### 1.6a: Modify `tsconfig.json`

Add after `"sourceMap": true`:

```json
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

#### 2.6: Fix unused `_turnId` in `src/pi/event-translator.ts`

**Modify** `src/pi/event-translator.ts`

In the `tool_execution_start` case block (around line 99), change:

Old text:
```typescript
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _turnId = getTurnId(sessionId);
      const kind = toolNameToKind(event.toolName);
```

New text:
```typescript
      const kind = toolNameToKind(event.toolName);
```

This removes the unused `_turnId` variable and the ESLint disable comment.

#### 2.7: Fix unused return in `src/acp/methods/session-load.ts`

**Modify** `src/acp/methods/session-load.ts`

In the `replayHistory` function, change:

Old text:
```typescript
    extractTurnIdFromMessage(entry.id); // Extracted but not used in replay
```

New text:
```typescript
    void extractTurnIdFromMessage(entry.id);
```

The `void` operator explicitly discards the return value and satisfies `noUnusedLocals`.

**Verify:** `npm run build && npm test`

---

### Step 1.7 — Fix 13 ESLint `require-await` warnings

These are functions declared `async` but containing no `await`. The fix is to remove `async` keyword from functions that don't need it. However, these are method handlers registered with a type that expects `Promise<...>` return types (via `MethodHandler`), so they need to remain async-compatible. The fix is to add explicit `await Promise.resolve()` or to suppress. The cleanest fix: remove `async` and return `Promise.resolve()` or simply return synchronously where the return type permits.

**Strategy:** For functions that `throwAcpError` (which always throws), the function signature expects `Promise<T>` but never actually returns. The simplest fix: remove `async` and let TypeScript infer the return. But the `MethodHandler` type expects `Promise<unknown>`, so we need the return to be a promise.

**Better strategy:** Keep `async` but add a no-op `await` is wrong. Instead, since these are stub implementations, remove `async` and wrap the throw in a function that returns `never`. Actually, `throwAcpError` already returns `never`. A sync function that throws is assignable to `Promise<T>` via the method handler type? No — the handler expects `Promise<unknown>`.

**Final strategy:** Keep `async` on all handlers (required by the `MethodHandler` type). Instead, suppress the warning per-function using:

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
```

Wait — a better approach: The `MethodHandler` type in `protocol.ts` is:
```typescript
export type MethodHandler = (
  params: Record<string, unknown> | undefined,
  request: JsonRpcRequest,
) => Promise<unknown>;
```

We could change these stubs to not be async but return a Promise explicitly. For stubs that just throw:

```typescript
export function handleSessionFork(
  _params: Record<string, unknown> | undefined,
): Promise<ForkSessionResponse> {
  return Promise.reject(
    ((() => { throwAcpError(-32601, "Method not implemented (UNSTABLE): session/fork"); })())
  );
}
```

This is ugly. The cleanest approach that doesn't change semantics: **keep `async` and suppress the specific warning**. But 13 suppressions is a lot.

**Chosen approach:** Keep `async` and add a single `// eslint-disable-next-line require-await` comment to each function. This is the minimal, safe fix that preserves the handler interface contract.

**Files to modify (10 functions across 5 files):**

#### `src/acp/methods/authenticate.ts`

Old:
```typescript
export async function handleAuthenticate(
  _params: Record<string, unknown> | undefined,
): Promise<AuthenticateResponse> {
```

New:
```typescript
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleAuthenticate(
  _params: Record<string, unknown> | undefined,
): Promise<AuthenticateResponse> {
```

#### `src/acp/methods/initialize.ts`

Old:
```typescript
export async function handleInitialize(
  params: Record<string, unknown> | undefined,
): Promise<InitializeResponse> {
```

New:
```typescript
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleInitialize(
  params: Record<string, unknown> | undefined,
): Promise<InitializeResponse> {
```

#### `src/acp/methods/logout.ts`

Old:
```typescript
export async function handleLogout(
  _params: Record<string, unknown> | undefined,
): Promise<LogoutResponse> {
```

New:
```typescript
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleLogout(
  _params: Record<string, unknown> | undefined,
): Promise<LogoutResponse> {
```

#### `src/acp/methods/nes.ts` (3 functions)

Add `// eslint-disable-next-line @typescript-eslint/require-await` before each of:
- `handleNesStart`
- `handleNesSuggest`
- `handleNesClose`

#### `src/acp/methods/providers.ts` (2 functions needing it)

Add `// eslint-disable-next-line @typescript-eslint/require-await` before:
- `handleProvidersSet`
- `handleProvidersDisable`

Note: `handleProvidersList` also has the warning — add suppression there too.

#### `src/acp/methods/session-fork.ts`

Add `// eslint-disable-next-line @typescript-eslint/require-await` before `handleSessionFork`.

#### `src/acp/methods/session-resume.ts`

Add `// eslint-disable-next-line @typescript-eslint/require-await` before `handleSessionResume`.

#### `src/acp/methods/session-set-model.ts`

Add `// eslint-disable-next-line @typescript-eslint/require-await` before `handleSessionSetModel`.

#### `src/acp/methods/session-set-mode.ts`

Add `// eslint-disable-next-line @typescript-eslint/require-await` before `handleSessionSetMode`.

#### `src/acp/methods/session-set-config.ts`

Add `// eslint-disable-next-line @typescript-eslint/require-await` before `handleSessionSetConfigOption`.

#### Fix `strict-boolean-expressions` warning in `vitest.config.ts`

The warning is on line 13: `if (!source.startsWith(".") || !source.endsWith(".js"))`.

Change:
```typescript
    resolveId(source, importer) {
      if (!source.startsWith(".") || !source.endsWith(".js")) return null;
```

To:
```typescript
    resolveId(source, importer) {
      if (source.startsWith(".") === false || source.endsWith(".js") === false) return null;
```

**Verify:** `npm run lint` (should report 0 errors, 0 warnings)

---

### Step 1.8 — Format all files with Prettier

Run:
```bash
npm run format
```

This reformats all source files to match the new `.prettierrc`.

**Verify:** `npm run format:check` (should exit 0)

---

### Step 1.9 — Create GitHub Actions CI workflow

**Create** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci

      - name: Build
        run: npm run build

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Test with coverage
        run: npm run test:coverage
```

**Verify:** `cat .github/workflows/ci.yml`

---

### Step 1.10 — Create GitHub Actions publish workflow

**Create** `.github/workflows/publish.yml`

```yaml
name: Publish to npm

on:
  release:
    types: [published]

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
```

**Verify:** `cat .github/workflows/publish.yml`

---

### Step 1.11 — Update `package.json` for npm release

**Modify** `package.json`

Change the `"name"` field:
```json
"name": "@harms-haus/pi-acp",
```

Add these fields (after `"license"` or at the end of the top-level object, before the closing `}`):

```json
"files": ["dist/", "README.md", "LICENSE", "CHANGELOG.md"],
"publishConfig": { "access": "public" },
"author": "harms-haus",
"repository": {
  "type": "git",
  "url": "git+https://github.com/harms-haus/pi-acp.git"
},
"engines": { "node": ">=20.0.0" },
```

Add scripts:
```json
"typecheck": "tsc --noEmit",
"prepack": "npm run build",
```

Update the `"check"` script:
```json
"check": "tsc --noEmit && eslint . && prettier --check \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\" && vitest run",
```

Full scripts section after changes:
```json
"scripts": {
  "build": "tsc",
  "start": "node --import tsx src/index.ts",
  "dev": "node --watch --import tsx src/index.ts",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
  "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\"",
  "typecheck": "tsc --noEmit",
  "prepack": "npm run build",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "check": "tsc --noEmit && eslint . && prettier --check \"src/**/*.ts\" \"tests/**/*.ts\" \"*.{mjs,ts,js,json}\" && vitest run"
},
```

**Verify:** `node -e "const p = require('./package.json'); console.log(p.name, p.files, p.publishConfig)"`

---

### Step 1.12 — Create `LICENSE`

**Create** `LICENSE`

```
MIT License

Copyright (c) 2025 harms-haus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Verify:** `head -1 LICENSE`

---

### Step 1.13 — Create `CHANGELOG.md`

**Create** `CHANGELOG.md`

```markdown
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
- Comprehensive test suite with 94 tests
```

**Verify:** `head -5 CHANGELOG.md`

---

### Step 1.14 — Phase 1 verification

Run:
```bash
npm run build && npm run typecheck && npm run lint && npm run format:check && npm test
```

All must pass (0 errors from lint, 0 warnings after Step 1.7 fixes, 94 tests pass).

---

## Phase 2: Dead Code Removal & Bug Fixes

### Step 2.1 — Remove unused `hasSession` export from `pi/session-registry.ts` and barrel

**Modify** `src/pi/session-registry.ts`

Delete the entire function:
```typescript
/** Check if a session exists. */
export function hasSession(id: string): boolean {
  return sessions.has(id);
}
```

**Modify** `src/pi/index.ts`

Remove the line:
```typescript
  hasSession,
```

**Verify:** `npm run build && npm test`

---

### Step 2.2 — Remove unused `getRegisteredMethods` from `acp/protocol.ts`

**Modify** `src/acp/protocol.ts`

Delete the entire function:
```typescript
/** Get all registered agent method names. */
export function getRegisteredMethods(): string[] {
  return Array.from(handlers.keys());
}
```

**Verify:** `npm run build && npm test`

---

### Step 2.3 — Remove unused `isStdinClosed` from `transport/stdio.ts` and barrel

**Modify** `src/transport/stdio.ts`

Delete the entire function:
```typescript
/** Check if stdin has ended. */
export function isStdinClosed(): boolean {
  return stdinClosed;
}
```

**Modify** `src/transport/index.ts`

Remove the line:
```typescript
  isStdinClosed,
```

(Note: check if `isStdinClosed` is in the barrel first — it may not be.)

**Verify:** `npm run build && npm test`

---

### Step 2.4 — Remove unused `getSessionConfigOptions` from `session-set-config.ts` and barrel

**Modify** `src/acp/methods/session-set-config.ts`

Delete the entire function:
```typescript
/** Get current config options for a session. */
export function getSessionConfigOptions(sessionId: string): SessionConfigOption[] {
  return configOptions.get(sessionId) ?? [];
}
```

**Modify** `src/acp/methods/index.ts`

Change:
```typescript
export { handleSessionSetConfigOption, getSessionConfigOptions } from "./session-set-config.js";
```

To:
```typescript
export { handleSessionSetConfigOption } from "./session-set-config.js";
```

**NOTE:** The test file `tests/handlers/index.test.ts` imports `getSessionConfigOptions`. You must also update the test:

**Modify** `tests/handlers/index.test.ts`

Change the import line:
```typescript
import { handleSessionSetConfigOption, getSessionConfigOptions } from "../../src/acp/methods/session-set-config.js";
```

To:
```typescript
import { handleSessionSetConfigOption } from "../../src/acp/methods/session-set-config.js";
```

Delete the test that uses `getSessionConfigOptions` (the "sets config option value" test):

```typescript
  it("sets config option value", async () => {
    await handleSessionSetConfigOption({
      sessionId: "sess_cfg",
      configId: "thought_level",
      value: "high",
    });
    const opts = getSessionConfigOptions("sess_cfg");
    const thoughtOpt = opts.find((o) => o.id === "thought_level");
    expect(thoughtOpt).toBeDefined();
  });
```

Also remove the `getSessionConfigOptions` from the mock if present (it's not — it's imported directly).

This reduces test count from 94 to 93.

**Verify:** `npm run build && npm test` (93 tests pass)

---

### Step 2.5 — Remove unused `resolvePermission` and `requestPermissionFromClient` from `pi/acp-extension.ts` and barrel

**Analysis:** 
- `resolvePermission` is exported from `acp-extension.ts` and re-exported from `pi/index.ts`, but never called anywhere in `src/`.
- `requestPermissionFromClient` is exported from `acp-extension.ts` and re-exported from `pi/index.ts`, but never called anywhere in `src/`.
- `cancelAllPermissions` IS used in `src/acp/methods/session-cancel.ts` — do NOT delete.

**Modify** `src/pi/acp-extension.ts`

Delete the entire `resolvePermission` function:
```typescript
export function resolvePermission(toolCallId: string, outcome: RequestPermissionOutcome): void {
  const pending = pendingPermissions.get(toolCallId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve(outcome);
    pendingPermissions.delete(toolCallId);
  }
}
```

Delete the entire `requestPermissionFromClient` function (the exported async function).

**Modify** `src/pi/index.ts`

Remove the lines:
```typescript
  resolvePermission,
```
and:
```typescript
  requestPermissionFromClient,
```

Keep `cancelAllPermissions` in both files.

Also remove the unused `sendClientRequest` import in `acp-extension.ts` (if `requestPermissionFromClient` was the only user). Check: `sendClientRequest` is imported at the top of `acp-extension.ts`. After removing `requestPermissionFromClient`, the import is unused — remove it.

Also remove unused type imports: `ToolCallUpdate`, `PermissionOption`, `RequestPermissionOutcome` — check if they're still used after removing the two functions.

After removal:
- `ToolCallUpdate` — used by `requestPermissionFromClient` only → remove import
- `PermissionOption` — used by `requestPermissionFromClient` only → remove import  
- `RequestPermissionOutcome` — used by `resolvePermission`, `requestPermissionFromClient`, and `cancelAllPermissions` → keep
- `toolNameToKind` — used by `requestPermissionFromClient` only → remove import
- `kindToTitle` — used by `requestPermissionFromClient` only → remove import

The file after cleanup should contain only:
- Imports: `ExtensionAPI` from pi SDK, `RequestPermissionOutcome` from types
- The `pendingPermissions` Map
- The `cancelAllPermissions` function
- The `acpExtensionFactory` function

**Verify:** `npm run build && npm test`

---

### Step 2.6+2.7+1.6 — Already handled in Step 1.6+2.6+2.7 above.

---

### Step 2.8 — Fix `handleTerminalKill` memory leak

**Modify** `src/client-methods/terminal.ts`

In the `handleTerminalKill` function, after the `terminal.proc.kill("SIGTERM")` call (the `if (!terminal.exited)` block), add:

```typescript
  activeTerminals.delete(req.terminalId);
```

The function should match the pattern in `handleTerminalRelease` — both should delete from the map.

Current `handleTerminalKill` ending:
```typescript
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  return {};
```

New ending:
```typescript
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  activeTerminals.delete(req.terminalId);
  return {};
```

**Verify:** `npm run build && npm test`

---

### Step 2.9 — Remove unused error helper functions from `utils/error-codes.ts` and barrel

**Analysis:** The following functions are exported from `error-codes.ts` and re-exported from `utils/index.ts` but never called from `src/`:
- `makeParseError`
- `makeInvalidRequestError`
- `makeMethodNotFoundError`
- `makeInvalidParamsError`
- `makeInternalError`
- `makeAuthRequiredError`
- `makeResourceNotFoundError`

They ARE used by tests in `tests/utils/error-codes.test.ts`. So they are "test-only" exports.

**Decision:** Keep them. They are utility functions that test code imports directly. Removing them would require deleting the test, which tests the error code constants. The functions are small and well-tested.

**No changes.**

---

### Step 2.10 — Remove unused type exports from `acp/types.ts`

Remove these unused type exports (they are defined but never imported anywhere outside `types.ts`):
- `AgentMessageChunkUpdate`
- `UserMessageChunkUpdate`
- `AgentThoughtChunkUpdate`
- `ToolCallSessionUpdate`
- `ToolCallUpdateSessionUpdate`
- `PlanSessionUpdate`
- `AvailableCommandsSessionUpdate`
- `CurrentModeSessionUpdate`
- `ConfigOptionSessionUpdate`
- `SessionInfoSessionUpdate`
- `UsageSessionUpdate`
- `SessionUpdateExtended`
- `ToolKindExtended`
- `TerminalId`
- `Meta`

**Modify** `src/acp/types.ts`

Delete all lines from `// TerminalId is not exported by SDK, define locally` down to the end of `SessionUpdateExtended` (approximately lines 418–534, everything after the `export { PROTOCOL_VERSION, ... }` block and before the `// ─── Compatibility Constants` section).

Actually, let me be more precise. Delete these sections:

1. Delete the block:
```typescript
// ─── Local Type Definitions (not in SDK) ─────────────────────────────────────

// TerminalId is not exported by SDK, define locally
export type TerminalId = string;

// Meta type for backward compatibility
export type Meta = Record<string, unknown> | null;

// ToolKind with our custom "create" extension
export type ToolKindExtended = ToolKind | "create";
```

2. Delete the entire JSON-RPC envelope types section:
```typescript
// JSON-RPC 2.0 Envelope types (not exported by SDK, needed for transport layer)
export interface JsonRpcRequest { ... }
export interface JsonRpcResponse { ... }
export interface JsonRpcErrorObject { ... }
export interface JsonRpcErrorResponse { ... }
export interface JsonRpcNotification { ... }
export type JsonRpcIncoming = ...
export type JsonRpcOutgoing = ...
```

Wait — these ARE used. `JsonRpcRequest`, `JsonRpcNotification`, `JsonRpcIncoming`, `JsonRpcOutgoing` are imported in `protocol.ts`. `JsonRpcErrorObject` is imported in `protocol.ts`. These must stay.

So the only things to delete are:
1. `TerminalId` type (not imported anywhere)
2. `Meta` type (not imported anywhere)
3. `ToolKindExtended` type (not imported anywhere)
4. All 11 session update interfaces (`AgentMessageChunkUpdate` through `UsageSessionUpdate`)
5. `SessionUpdateExtended` union type

**Verify:** `npm run build && npm test`

---

### Step 2.11 — Fix `determineStopReason` fragile string matching in `session-prompt.ts`

**Modify** `src/acp/methods/session-prompt.ts`

Change the `determineStopReason` function from:

```typescript
function determineStopReason(
  state: { errorMessage?: string },
  sessionId: string,
): StopReason {
  const errorMessage = state.errorMessage;

  // Check for refusal
  if (errorMessage?.toLowerCase().includes("refusal") ?? false) {
    return "refusal";
  }

  // Check for max tokens
  if (errorMessage?.toLowerCase().includes("max_tokens") ?? false) {
    return "max_tokens";
  }

  // Check if cancelled
  if (isSessionCancelling(sessionId)) {
    return "cancelled";
  }

  // Check for max turns
  if (errorMessage?.toLowerCase().includes("max") ?? false) {
    return "max_turn_requests";
  }

  // Default: end_turn
  return "end_turn";
}
```

To:

```typescript
function determineStopReason(
  state: { errorMessage?: string },
  sessionId: string,
): StopReason {
  const errorMessage = state.errorMessage;
  const lower = errorMessage?.toLowerCase() ?? "";

  // Check for refusal
  if (lower.includes("refusal")) {
    return "refusal";
  }

  // Check for max tokens (more specific: "max_tokens" or "maxtokens")
  if (lower.includes("max_tokens") || lower.includes("maxtokens")) {
    return "max_tokens";
  }

  // Check if cancelled
  if (isSessionCancelling(sessionId)) {
    return "cancelled";
  }

  // Check for max turns — must be "max_turn" specifically, not just any "max"
  // NOTE: This string-matching approach is fragile. If the pi SDK adds structured
  // error codes in the future, this should be updated to use them instead.
  if (lower.includes("max_turn") || lower.includes("max turn")) {
    return "max_turn_requests";
  }

  // Default: end_turn
  return "end_turn";
}
```

**Verify:** `npm run build && npm test`

---

### Step 2.12 — Phase 2 verification

Run:
```bash
npm run build && npm run typecheck && npm run lint && npm test
```

---

## Phase 3: Pattern Extraction

### Step 3.1 — Extract `requireParams<T>()` helper

**Create** `src/utils/param-validation.ts`

```typescript
// Parameter validation helper — reduces boilerplate in ACP method handlers.
import { throwAcpError } from "./error-codes.js";

/**
 * Validate that params is a non-null object containing all required keys.
 * Throws ACP error -32602 (Invalid params) on failure.
 * Returns the params typed as T for convenient downstream use.
 */
export function requireParams<T>(
  params: unknown,
  keys: string[],
  typeName?: string,
): T {
  if (params === undefined || params === null || typeof params !== "object" || Array.isArray(params)) {
    throwAcpError(
      -32602,
      typeName
        ? `Invalid params: expected ${typeName}`
        : "Invalid params: expected an object",
    );
  }
  const obj = params as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in obj)) {
      throwAcpError(-32602, `Invalid params: missing '${key}'`);
    }
  }
  return params as T;
}
```

**Modify** `src/utils/index.ts`

Add the export:
```typescript
export { requireParams } from "./param-validation.js";
```

**Verify:** `npm run build` (no method handlers use it yet — just adding the utility)

---

### Step 3.2 — Refactor method handlers to use `requireParams`

Update each handler that does manual parameter validation. For each file, replace the manual `if (!params || typeof params !== "object" || !("key" in params))` pattern with `const req = requireParams<TypeName>(params, ["key1", "key2"])`.

**Files to update:**

1. `src/acp/methods/session-prompt.ts` — `requireParams<PromptRequest>(params, ["sessionId", "prompt"])`
2. `src/acp/methods/session-close.ts` — `requireParams<CloseSessionRequest>(params, ["sessionId"])`
3. `src/acp/methods/session-new.ts` — `requireParams<NewSessionRequest>(params, ["cwd"])` (keep the additional `typeof req.cwd !== "string" || req.cwd.length === 0` check)
4. `src/acp/methods/session-resume.ts` — `requireParams<ResumeSessionRequest>(params, ["sessionId"])`
5. `src/acp/methods/session-set-mode.ts` — `requireParams<SetSessionModeRequest>(params, ["sessionId", "modeId"])`
6. `src/acp/methods/session-set-config.ts` — `requireParams<SetSessionConfigOptionRequest>(params, ["sessionId", "configId", "value"])`
7. `src/acp/methods/session-load.ts` — `requireParams<LoadSessionRequest>(params, ["sessionId", "cwd"])`
8. `src/acp/methods/session-cancel.ts` — Use `requireParams` but since it's a notification (can't throw), keep the early return pattern but use the helper for clarity

Example transformation for `session-close.ts`:

Before:
```typescript
export async function handleSessionClose(
  params: Record<string, unknown> | undefined,
): Promise<CloseSessionResponse> {
  if (!params || typeof params !== "object" || !("sessionId" in params)) {
    throwAcpError(-32602, "Invalid params: sessionId is required");
  }

  const req = params as unknown as CloseSessionRequest;
```

After:
```typescript
export async function handleSessionClose(
  params: Record<string, unknown> | undefined,
): Promise<CloseSessionResponse> {
  const req = requireParams<CloseSessionRequest>(params, ["sessionId"]);
```

**Verify:** `npm run build && npm test` after each file or after all files

---

### Step 3.3 — Extract `getClientCapabilities()` into `src/acp/client-state.ts`

**Create** `src/acp/client-state.ts`

```typescript
// Shared mutable client state — initialized during the ACP handshake.
// Split out of initialize.ts to avoid cross-layer dependencies.

import type { InitializeRequest } from "./types.js";

let _clientCapabilities: InitializeRequest["clientCapabilities"] | null = null;

/** Store client capabilities (called by handleInitialize). */
export function setClientCapabilities(caps: InitializeRequest["clientCapabilities"] | null): void {
  _clientCapabilities = caps;
}

/** Retrieve the stored client capabilities. */
export function getClientCapabilities(): InitializeRequest["clientCapabilities"] | null {
  return _clientCapabilities;
}
```

**Modify** `src/acp/methods/initialize.ts`

Remove:
```typescript
let _clientCapabilities: InitializeRequest["clientCapabilities"] | null = null;

export function getClientCapabilities(): InitializeRequest["clientCapabilities"] | null {
  return _clientCapabilities;
}
```

Replace with import:
```typescript
import { setClientCapabilities, getClientCapabilities } from "../client-state.js";
```

In `handleInitialize`, change:
```typescript
  _clientCapabilities = req.clientCapabilities;
```
To:
```typescript
  setClientCapabilities(req.clientCapabilities);
```

Export `getClientCapabilities` from the barrel:

**Modify** `src/acp/methods/index.ts`

Change:
```typescript
export { handleInitialize, getClientCapabilities } from "./initialize.js";
```

To:
```typescript
export { handleInitialize } from "./initialize.js";
```

And add the client-state export. But wait — the barrel for methods shouldn't export client-state utilities. Instead, `src/client-methods/filesystem.ts` and `src/client-methods/terminal.ts` import from `../acp/methods/initialize.js`. Change them to import from `../acp/client-state.js` instead.

**Modify** `src/client-methods/filesystem.ts`

Change:
```typescript
import { getClientCapabilities } from "../acp/methods/initialize.js";
```

To:
```typescript
import { getClientCapabilities } from "../acp/client-state.js";
```

**Modify** `src/client-methods/terminal.ts`

Change:
```typescript
import { getClientCapabilities } from "../acp/methods/initialize.js";
```

To:
```typescript
import { getClientCapabilities } from "../acp/client-state.js";
```

**Verify:** `npm run build && npm test`

---

### Step 3.4 — Rewire `src/index.ts` to use barrel imports

**Modify** `src/index.ts`

Replace the individual handler imports with barrel imports:

Before:
```typescript
import {
  handleInitialize,
  handleAuthenticate,
  handleSessionNew,
  handleSessionLoad,
  handleSessionResume,
  handleSessionClose,
  handleSessionList,
  handleSessionPrompt,
  handleSessionCancel,
  handleSessionSetMode,
  handleSessionSetConfigOption,
  handleSessionFork,
  handleSessionSetModel,
  handleProvidersList,
  handleProvidersSet,
  handleProvidersDisable,
  handleLogout,
  handleNesStart,
  handleNesSuggest,
  handleNesClose,
} from "./acp/methods/index.js";
```

After:
```typescript
import {
  handleInitialize,
  handleAuthenticate,
  handleSessionNew,
  handleSessionLoad,
  handleSessionResume,
  handleSessionClose,
  handleSessionList,
  handleSessionPrompt,
  handleSessionCancel,
  handleSessionSetMode,
  handleSessionSetConfigOption,
  handleSessionFork,
  handleSessionSetModel,
  handleProvidersList,
  handleProvidersSet,
  handleProvidersDisable,
  handleLogout,
  handleNesStart,
  handleNesSuggest,
  handleNesClose,
} from "./acp/methods/index.js";
```

Wait — this is already a barrel import. The issue in the user request is that the handler imports in `src/index.ts` go through the barrel already. Let me re-read the request.

The user said: "Rewire src/index.ts to use barrel files instead of individual imports." Looking at the current `src/index.ts`, it already imports from barrel files (`./acp/methods/index.js`, `./client-methods/index.js`). So this step is already done.

Let me check if there are any other imports that could be simplified:

Current imports in `src/index.ts`:
- `from "./acp/methods/index.js"` — already barrel ✓
- `from "./acp/protocol.js"` — direct import ✓ (needed: `processMessage`, `registerHandler`)
- `from "./acp/types.js"` — direct import ✓ (needed: `AGENT_METHODS`)
- `from "./client-methods/index.js"` — already barrel ✓
- `from "./transport/index.js"` — already barrel ✓
- Dynamic import: `from "./pi/index.js"` — already barrel ✓

**No changes needed.** `src/index.ts` already uses barrel imports.

---

### Step 3.5 — Phase 3 verification

Run:
```bash
npm run build && npm run typecheck && npm run lint && npm test
```

---

## Phase 4: Test Coverage Improvement

### Step 4.1 — Add coverage threshold to `vitest.config.ts`

**Modify** `vitest.config.ts`

In the `test.coverage` section:
- Remove `src/acp/methods/**/*.ts` from `exclude`
- Remove `src/index.ts` from `exclude`  
- Add `thresholds`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  include: ["src/**/*.ts"],
  exclude: ["src/acp/types.ts"],
  thresholds: {
    statements: 50,
    branches: 50,
    functions: 50,
    lines: 50,
  },
},
```

Note: We exclude only `src/acp/types.ts` (which is purely type exports after dead code removal). The methods files and `src/index.ts` should now be covered.

**Verify:** `npm run test:coverage` (will fail if coverage < 50%, which is expected until we add tests)

---

### Step 4.2 — Tests for `src/acp/protocol.ts`

**Create** `tests/protocol.test.ts`

Tests needed:

1. **registerHandler + processMessage — valid request routed correctly**
   - Register a handler for `"test/method"`, send a valid JSON-RPC request with that method
   - Assert the handler is called with correct params
   - Assert the response is written to stdout

2. **processMessage — invalid JSON**
   - Send `"not json"`
   - Assert `writeError` called with code -32700

3. **processMessage — missing jsonrpc field**
   - Send `{ "method": "test" }`
   - Assert error response with code -32600

4. **processMessage — unknown method**
   - Send `{ "jsonrpc": "2.0", "id": 1, "method": "nonexistent" }`
   - Assert error response with code -32601

5. **processMessage — handler throws with code**
   - Register handler that throws `Object.assign(new Error("auth needed"), { code: -32000 })`
   - Assert error response with that code and message

6. **processMessage — handler throws without code**
   - Register handler that throws `new Error("boom")`
   - Assert error response with code -32603 (internal error)

7. **processMessage — notification (no id)**
   - Register handler, send notification without `id`
   - Assert handler called, no response written

8. **processMessage — unknown notification**
   - Send notification with unknown method
   - Assert no error written (silently ignored per spec)

9. **processMessage — client response (resolves pending request)**
   - Call `sendClientRequest` to create a pending request
   - Send a response JSON with matching `id` and `result`
   - Assert the promise resolves with the result

10. **processMessage — client error response (rejects pending request)**
    - Call `sendClientRequest` to create a pending request
    - Send an error response with matching `id`
    - Assert the promise rejects

11. **sendClientRequest timeout**
    - Mock `writeOutgoing`, call `sendClientRequest`, advance timers past 60000ms
    - Assert promise rejects with timeout error

12. **handleClientResponse with unknown id** (no-op)
13. **handleClientError with unknown id** (no-op)

Mocking strategy:
- Mock `../src/transport/stdio.js` — spy on `writeJson` / `writeOutgoing`
- Use `vi.useFakeTimers()` for timeout tests

**Verify:** `npx vitest run tests/protocol.test.ts` (all pass) then `npm test` (all pass)

---

### Step 4.3 — Tests for `src/pi/event-translator.ts`

**Create** `tests/event-translator.test.ts`

Tests needed for each event type:

1. **agent_start** — generates and stores a turn ID
2. **agent_end — cancelling** — resolves prompt request with "cancelled"
3. **agent_end — not cancelling** — does not write response
4. **message_update — text_delta** — sends `agent_message_chunk` notification
5. **message_update — thinking_delta** — sends `agent_thought_chunk` notification
6. **message_start — user role** — sends `user_message_chunk` notifications
7. **message_start — assistant role** — does not send user chunks
8. **message_end — assistant** — no duplicate content sent
9. **tool_execution_start** — sends `tool_call` + `tool_call_update` with status "pending" then "in_progress"
10. **tool_execution_update** — sends `tool_call_update` with partial content
11. **tool_execution_end — success** — sends `tool_call_update` with status "completed"
12. **tool_execution_end — error** — sends `tool_call_update` with status "failed"
13. **turn_start — no existing turn ID** — generates new one
14. **turn_start — existing turn ID** — keeps existing
15. **turn_end** — cleans up tool call tracking
16. **compaction_start / compaction_end** — no-ops
17. **cleanupSession** — removes tracking data
18. **message_update with no turnId** — early return (no notification sent)

Mocking:
- Mock `../src/pi/session-registry.js` for `getTurnId`, `setTurnId`, etc.
- Mock `../src/transport/stdio.js` for `writeNotification`, `writeResponse`
- Create mock `AgentSessionEvent` objects

**Verify:** `npx vitest run tests/event-translator.test.ts`

---

### Step 4.4 — Tests for `src/client-methods/filesystem.ts`

**Create** `tests/client-methods/filesystem.test.ts`

Tests needed:

1. **handleFsReadTextFile — client has capability** — delegates to `sendClientRequest`
2. **handleFsReadTextFile — missing path** — throws -32602
3. **handleFsReadTextFile — path traversal** — throws -32002
4. **handleFsReadTextFile — valid file read** — returns content
5. **handleFsReadTextFile — with line/limit** — returns sliced content
6. **handleFsWriteTextFile — client has capability** — delegates to `sendClientRequest`
7. **handleFsWriteTextFile — missing path** — throws -32602
8. **handleFsWriteTextFile — missing content** — throws -32602
9. **handleFsWriteTextFile — valid write** — creates file and returns `{}`

Mocking:
- Mock `../src/acp/client-state.js` for `getClientCapabilities`
- Mock `../src/acp/protocol.js` for `sendClientRequest`
- Mock `../src/pi/session-registry.js` for `getSession`
- Use `vi.mock("node:fs")` for file operations, or use temp directories

**Verify:** `npx vitest run tests/client-methods/filesystem.test.ts`

---

### Step 4.5 — Tests for `src/client-methods/terminal.ts`

**Create** `tests/client-methods/terminal.test.ts`

Tests needed:

1. **handleTerminalCreate — client has capability** — delegates to `sendClientRequest`
2. **handleTerminalCreate — missing command** — throws -32602
3. **handleTerminalCreate — cwd outside session scope** — throws -32002
4. **handleTerminalCreate — spawns process and returns terminalId** — returns `{ terminalId }`
5. **handleTerminalOutput — returns output and exit status**
6. **handleTerminalOutput — terminal not found** — throws -32002
7. **handleTerminalWaitForExit — already exited** — returns immediately
8. **handleTerminalWaitForExit — waits for exit** — resolves when process exits
9. **handleTerminalRelease — kills and removes** — removes from activeTerminals
10. **handleTerminalKill — kills process** — sends SIGTERM
11. **handleTerminalKill — removes from activeTerminals** (the bug fix verification)
12. **handleTerminalKill — terminal not found** — throws -32002
13. **handleTerminalOutput — missing terminalId** — throws -32602

Mocking:
- Mock `../src/acp/client-state.js` for `getClientCapabilities`
- Mock `../src/acp/protocol.js` for `sendClientRequest`
- Mock `../src/pi/session-registry.js` for `getSession`
- Use `node:child_process` mock or real `echo` command for spawn tests

**Verify:** `npx vitest run tests/client-methods/terminal.test.ts`

---

### Step 4.6 — Tests for `src/pi/acp-extension.ts`

**Create** `tests/acp-extension.test.ts`

Tests needed:

1. **acpExtensionFactory** — registers a `tool_call` event handler
2. **cancelAllPermissions** — resolves all pending with "cancelled"
3. **Permission timeout** — pending permission request times out after 30s

Mocking:
- Mock `../src/acp/protocol.js` for `sendClientRequest`
- Use `vi.useFakeTimers()` for timeout tests
- Create mock `ExtensionAPI` for `acpExtensionFactory`

**Verify:** `npx vitest run tests/acp-extension.test.ts`

---

### Step 4.7 — Tests for `src/acp/methods/session-prompt.ts`

**Create** `tests/session-prompt.test.ts`

Tests needed:

1. **determineStopReason — refusal** — returns "refusal" when errorMessage contains "refusal"
2. **determineStopReason — max_tokens** — returns "max_tokens" when errorMessage contains "max_tokens"
3. **determineStopReason — cancelled** — returns "cancelled" when session is cancelling
4. **determineStopReason — max_turn_requests** — returns "max_turn_requests" when errorMessage contains "max_turn"
5. **determineStopReason — end_turn** — returns "end_turn" as default
6. **handleSessionPrompt — missing sessionId** — throws -32602
7. **handleSessionPrompt — missing prompt** — throws -32602
8. **handleSessionPrompt — session not found** — throws -32002

Note: `determineStopReason` is not exported. Test it indirectly via `handleSessionPrompt` or extract it to a separate testable function. The cleanest approach: export `determineStopReason` for testing.

**Modify** `src/acp/methods/session-prompt.ts`

Add `export` to `determineStopReason`:
```typescript
export function determineStopReason(
```

Mocking:
- Mock `../src/pi/session-registry.js` for `getSession`, `setPromptRequestId`, `setSessionCancelling`, `isSessionCancelling`
- Mock `../src/utils/content-translation.js` for `acpBlocksToPiContent`

**Verify:** `npx vitest run tests/session-prompt.test.ts`

---

### Step 4.8 — Tests for `src/pi/session-registry.ts`

**Create** `tests/session-registry.test.ts`

Tests needed:

1. **registerSession** — returns unique session ID, stores session
2. **getSession** — returns entry for valid ID, undefined for invalid
3. **removeSession** — disposes session, removes from map
4. **listSessions** — returns all sessions, filters by cwd
5. **setTurnId / getTurnId** — stores and retrieves turn ID
6. **setPromptRequestId / getPromptRequestId** — stores and retrieves request ID
7. **setSessionCancelling / isSessionCancelling** — tracks cancellation state
8. **getSessionIds** — returns all IDs

Mocking:
- Create mock `AgentSession` objects with `dispose` method
- No module mocks needed — session-registry is pure state

**Verify:** `npx vitest run tests/session-registry.test.ts`

---

### Step 4.9 — Phase 4 verification

Run:
```bash
npm run test:coverage
```

All tests pass, coverage thresholds met (≥50% statements, branches, functions, lines).

---

## Phase 5: npm Dry Run

### Step 5.1 — Build and verify dist/

```bash
npm run build
ls -la dist/
```

Verify:
- `dist/index.js` exists and has the shebang line
- All `.js` files have corresponding `.d.ts` declarations
- No `.ts` files in dist

---

### Step 5.2 — Dry run publish

```bash
npm publish --dry-run
```

Verify:
- Package name is `@harms-haus/pi-acp`
- Only whitelisted files in tarball: `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`
- No `tests/`, `coverage/`, `src/`, config files in tarball
- `bin.pi-acp` entry resolves to `./dist/index.js`
- Package size is reasonable (< 100KB)

---

### Step 5.3 — Fix any dry run issues

If the dry run reveals issues:
- Missing files in `files` array → update `package.json`
- Unexpected files in tarball → update `.npmignore` or `files` array
- bin entry wrong → fix `package.json`

**Verify:** `npm publish --dry-run` succeeds

---

## File Change Summary

### Files Created
| File | Phase |
|------|-------|
| `.editorconfig` | 1.1 |
| `.prettierrc` | 1.3 |
| `.github/workflows/ci.yml` | 1.9 |
| `.github/workflows/publish.yml` | 1.10 |
| `LICENSE` | 1.12 |
| `CHANGELOG.md` | 1.13 |
| `src/utils/param-validation.ts` | 3.1 |
| `src/acp/client-state.ts` | 3.3 |
| `tests/protocol.test.ts` | 4.2 |
| `tests/event-translator.test.ts` | 4.3 |
| `tests/client-methods/filesystem.test.ts` | 4.4 |
| `tests/client-methods/terminal.test.ts` | 4.5 |
| `tests/acp-extension.test.ts` | 4.6 |
| `tests/session-prompt.test.ts` | 4.7 |
| `tests/session-registry.test.ts` | 4.8 |

### Files Modified
| File | Steps | Changes |
|------|-------|---------|
| `package.json` | 1.2, 1.4, 1.5, 1.11 | Add deps, scripts, metadata |
| `eslint.config.mjs` | 1.5 | Remove dead plugins, add prettier, add complexity rules |
| `tsconfig.json` | 1.6+2.6+2.7 | Add strict flags |
| `vitest.config.ts` | 1.7, 4.1 | Fix boolean expr, add thresholds |
| `src/acp/types.ts` | 2.10 | Remove unused types |
| `src/acp/protocol.ts` | 2.2 | Remove `getRegisteredMethods` |
| `src/acp/methods/initialize.ts` | 1.7, 3.3 | Add eslint disable, move client caps to client-state |
| `src/acp/methods/authenticate.ts` | 1.7 | Add eslint disable |
| `src/acp/methods/logout.ts` | 1.7 | Add eslint disable |
| `src/acp/methods/nes.ts` | 1.7 | Add eslint disable (3x) |
| `src/acp/methods/providers.ts` | 1.7 | Add eslint disable (3x) |
| `src/acp/methods/session-fork.ts` | 1.7 | Add eslint disable |
| `src/acp/methods/session-resume.ts` | 1.7 | Add eslint disable |
| `src/acp/methods/session-set-model.ts` | 1.7 | Add eslint disable |
| `src/acp/methods/session-set-mode.ts` | 1.7, 3.2 | Add eslint disable, use requireParams |
| `src/acp/methods/session-set-config.ts` | 1.7, 2.4, 3.2 | Add eslint disable, remove getSessionConfigOptions, use requireParams |
| `src/acp/methods/session-prompt.ts` | 2.11, 3.2, 4.7 | Fix determineStopReason, use requireParams, export determineStopReason |
| `src/acp/methods/session-close.ts` | 3.2 | Use requireParams |
| `src/acp/methods/session-new.ts` | 3.2 | Use requireParams |
| `src/acp/methods/session-resume.ts` | 3.2 | Use requireParams |
| `src/acp/methods/session-load.ts` | 1.6+2.6+2.7, 3.2 | Fix unused return, use requireParams |
| `src/acp/methods/session-cancel.ts` | 3.2 | Use requireParams |
| `src/acp/methods/index.ts` | 2.4 | Remove getSessionConfigOptions export |
| `src/pi/session-registry.ts` | 2.1 | Remove hasSession |
| `src/pi/index.ts` | 2.1, 2.5 | Remove hasSession, resolvePermission, requestPermissionFromClient |
| `src/pi/event-translator.ts` | 1.6+2.6+2.7 | Remove unused _turnId |
| `src/pi/acp-extension.ts` | 2.5 | Remove resolvePermission, requestPermissionFromClient, unused imports |
| `src/client-methods/terminal.ts` | 2.8, 3.3 | Fix memory leak, fix import |
| `src/client-methods/filesystem.ts` | 3.3 | Fix import |
| `src/transport/stdio.ts` | 2.3 | Remove isStdinClosed |
| `src/transport/index.ts` | 2.3 | Remove isStdinClosed export |
| `src/utils/index.ts` | 3.1 | Add requireParams export |
| `tests/handlers/index.test.ts` | 2.4 | Remove getSessionConfigOptions import + test |

### Files Deleted
None.

### Files OUT OF SCOPE
- `src/pi/sdk-factory.ts` — no changes needed
- `src/utils/content-translation.ts` — already well-tested
- `src/utils/path-validation.ts` — already well-tested
- `src/utils/turn-id.ts` — already well-tested
- `src/utils/error-codes.ts` — keep all helpers (used by tests)
- `README.md` — out of scope for this plan
- `node_modules/`, `dist/`, `coverage/` — generated
- Any `.bifrost.yaml` or assessment markdown files
