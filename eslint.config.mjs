import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // CommonJS scripts and test files legitimately use require() and loose mocks.
  {
    files: ["scripts/**/*.js", "jest.env.js", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // third‑party assets and minified code
    "public/**/*.min.js",
    "public/emulatorjs/**",
  ]),
]);

export default eslintConfig;
