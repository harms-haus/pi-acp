import { resolve, dirname, isAbsolute } from "node:path";

import { defineConfig, type Plugin } from "vitest/config";

/** Plugin to resolve .js imports to .ts files (ESM convention) */
function jsToTsResolver(): Plugin {
  return {
    name: "js-to-ts-resolver",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith(".") || !source.endsWith(".js")) return null;
      const tsPath = source.replace(/\.js$/, ".ts");
      if (!importer) return null;
      const absImporter = isAbsolute(importer) ? importer : resolve(process.cwd(), importer);
      return resolve(dirname(absImporter), tsPath);
    },
  };
}

export default defineConfig({
  plugins: [jsToTsResolver()],
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/acp/types.ts",
        "src/acp/methods/logout.ts",
        "src/acp/methods/nes.ts",
        "src/acp/methods/providers.ts",
        "src/acp/methods/session-fork.ts",
        "src/acp/methods/session-set-model.ts",
        "src/index.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
