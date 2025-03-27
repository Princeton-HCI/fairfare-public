// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as svelteParser from 'svelte-eslint-parser';
import * as typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';
import eslintPluginSvelte from 'eslint-plugin-svelte';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/prettier'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptParser,
        project: './tsconfig.json',
        extraFileExtensions: ['.svelte']
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_'
        }
      ]
    }
  },
  [
    {
      languageOptions: {
        ecmaVersion: 2020,
        globals: {
          ...globals.browser,
          SupabaseRows: 'readonly',
          SupabaseInserts: 'readonly',
          SupabaseViews: 'readonly',
          SupabaseEnums: 'readonly'
        }
      }
    },
    {
      ignores: [
        '.DS_Store',
        'node_modules',
        'playwright-report',
        'build',
        '.svelte-kit',
        '.netlify',
        // Ignore environment files except for .env.example
        '.env',
        '.env.*',
        '!.env.example',
        // Ignore files for PNPM, NPM and YARN
        'pnpm-lock.yaml',
        'package-lock.json',
        'yarn.lock'
      ]
    }
  ]
);
