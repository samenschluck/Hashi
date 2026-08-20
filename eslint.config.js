import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Hinweis: Bei `no-restricted-imports` gewinnt der zuletzt passende Block.
// Deshalb steht die allgemeine Regel oben und die spezielleren stehen darunter.
export default defineConfig(
  globalIgnores(['dist', 'android', 'coverage', 'node_modules']),

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js', 'scripts/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Kein `any` — harte Regel aus den Code-Standards.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Non-Null-Assertions sind im Solver bewusst im Einsatz (Typed Arrays,
      // vorberechnete Indizes), deshalb hier kein Verbot.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      'no-bitwise': 'off',
    },
  },

  // Allgemein: native Plugins nur in src/services/.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/services/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@capacitor/*', '@capacitor-community/*'],
              message: 'Native Zugriffe laufen ausschliesslich ueber src/services/.',
            },
          ],
        },
      ],
    },
  },

  // Renderer und Eingabe arbeiten ohne React.
  {
    files: ['src/render/**/*.ts', 'src/input/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@capacitor/*', '@capacitor-community/*'],
              message: 'Native Zugriffe laufen ausschliesslich ueber src/services/.',
            },
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'Der Renderer arbeitet ohne React.',
            },
          ],
        },
      ],
    },
  },

  // src/core/ bleibt reine, plattformunabhaengige Logik.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@capacitor/*', '@capacitor-community/*'],
              message: 'src/core/ bleibt frei von nativen Abhaengigkeiten.',
            },
            {
              group: ['react', 'react-dom', 'react/*', 'zustand', 'zustand/*'],
              message: 'src/core/ bleibt frei von UI-Abhaengigkeiten.',
            },
            {
              group: ['../ui/*', '../services/*', '../state/*', '../render/*', '../input/*'],
              message: 'src/core/ darf nicht nach aussen greifen.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  {
    files: ['scripts/**/*.ts', '*.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // Hilfsskripte in reinem JavaScript: sie steuern einen Browser fern und
  // arbeiten dabei zwangslaeufig mit untypisierten Werten aus der Seite.
  // Typgestuetzte Regeln haetten hier nichts zu pruefen.
  {
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
);
