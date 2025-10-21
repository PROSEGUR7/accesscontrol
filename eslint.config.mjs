import js from "@eslint/js"
import nextPlugin from "@next/eslint-plugin-next"
import globals from "globals"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: [
      "**/*.d.ts",
      "node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "coverage/**",
      "build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]
