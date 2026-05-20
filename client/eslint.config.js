import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,

  // TypeScript — flat/recommended covers .ts/.tsx and sets the parser
  ...tseslint.configs["flat/recommended"],

  // React flat config
  react.configs.flat.recommended,

  // React hooks flat config (v5+ format)
  reactHooks.configs["recommended-latest"],

  // Per-file overrides: browser globals, import plugin, project-specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: Object.fromEntries(
        Object.entries({ ...globals.browser, ...globals.es2021 }).map(
          ([k, v]) => [k.trim(), v]
        )
      ),
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "no-console": "warn",
      "react/react-in-jsx-scope": "off",
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
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  // Prettier must be last — disables formatting-related rules
  { rules: prettier.rules },
];
