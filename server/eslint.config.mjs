import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tseslint from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["dist/**", "src/lexicon/**"] },

  // Node globals for all files in this server package
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  js.configs.recommended,

  // TypeScript — flat/recommended covers .ts and sets the parser
  ...tseslint.configs["flat/recommended"],

  {
    files: ["**/*.ts"],
    plugins: {
      import: fixupPluginRules(importPlugin),
    },
    rules: {
      "no-console": "warn",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  // Prettier must be last — disables formatting-related rules
  { rules: prettier.rules },
];
