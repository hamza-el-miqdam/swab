// Repo-wide ESLint base (flat config). apps/api and packages/db resolve this
// file via ESLint's ancestor lookup (`eslint .` from the package dir);
// apps/mobile composes it with the Expo preset in its own eslint.config.mjs.
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/*.d.ts",
      ".claude/**",
      ".github/**",
      "blueprints/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // Type-aware linting off each package's own tsconfig (strict TS ethos).
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ["error", "smart"],
      // G3: structured pino logging only — console never ships.
      "no-console": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // Plain JS (babel/jest configs, scripts) — no type information available.
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // CommonJS is the norm for RN/jest config files and shims.
    files: ["**/*.{js,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/tests/**", "**/__tests__/**", "**/*.test.*", "**/test/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
      // Test fakes implement Promise-returning interfaces without awaiting.
      "@typescript-eslint/require-await": "off",
      // jest.resetModules() + require() is the idiomatic fresh-module pattern.
      "@typescript-eslint/no-require-imports": "off",
      // jest mocks are any-typed by design; the unsafe-* family drowns tests in noise.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  // Last: disable rules that would fight Prettier (Prettier stays the formatter).
  prettier,
);
