// Composes the repo-wide base config (../../eslint.config.mjs) and adds Node
// globals for scripts/**. Unlike apps/api and packages/db (whose lint scope
// is pure TypeScript, where typescript-eslint's recommended preset already
// turns `no-undef` off in favor of the compiler's own check), this package
// also lints scripts/generate.mjs — a plain-JS codegen script (styled after
// the root's scripts/render-agents.mjs) that uses bare Node globals
// (`process`, `console`). The root config never declares a Node globals
// environment because root-level scripts/** sits outside every turbo
// package and is never linted; ours is, since it lives under packages/ui/**.
import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
