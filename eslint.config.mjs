import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base ESLint recommended config
  eslint.configs.recommended,

  // TypeScript ESLint recommended configs with type checking
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    name: 'pi-acp-config',
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import': importPlugin,
      'n': n,
      'unicorn': unicorn,
    },
    rules: {
      // TypeScript strict rules - errors
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-deprecated': 'off',

      // TypeScript warnings
      '@typescript-eslint/strict-boolean-expressions': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      '@typescript-eslint/require-await': 'warn',

      // Base ESLint rules
      'no-console': ['warn', { allow: ['error'] }],
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',

      // Import ordering
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Turned off rules
      'n/no-process-exit': 'off',
    },
  },

  // Allow default project for files not in tsconfig
  {
    name: 'allow-default-project',
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', '*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Test files — use test tsconfig and relaxed rules
  {
    name: 'test-files-config',
    files: ['tests/**/*.ts', 'vitest.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Ignore patterns
  {
    name: 'ignore-patterns',
    ignores: [
      'node_modules/',
      'dist/',
      '**/*.d.ts',
      'coverage/',
    ],
  }
);
