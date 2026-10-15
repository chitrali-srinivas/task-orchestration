import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Portability boundary (see docs/PORTABILITY.md).
// Port-bound code must stay framework-neutral so it can move to matic-dash (Vite + React Router):
// no Next.js imports, no direct env access, no mock infrastructure. Framework access goes through
// src/platform/*; mock wiring lives only in the listed prototype-only files and in src/mocks/*.
const PORT_BOUND_FILES = [
  "src/components/ui/**",
  "src/lib/server-table/**",
  "src/lib/utils.ts",
  "src/hooks/**",
  "src/types/**",
  "src/app/layouts/engagement/**",
  "src/app/layouts/deployment/**",
  "src/app/layouts/samples/**",
  "src/components/data-inspector/**",
  "src/app/layouts/season-management/**",
  "src/app/layouts/survey-builder-simplified/**",
  "src/app/components/filter/components/**",
  "src/app/components/survey/SurveyComponents.tsx",
];
const PROTOTYPE_WIRING_FILES = ["**/data/data-source.ts", "**/data/table-config.ts", "**/data/mock-data.ts"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: PORT_BOUND_FILES,
    ignores: PROTOTYPE_WIRING_FILES,
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "next", message: "Port-bound code must not depend on Next.js. Use src/platform/* adapters." }],
        patterns: [
          { group: ["next/*"], message: "Port-bound code must not depend on Next.js. Use src/platform/* adapters (link, navigation, client-only, env)." },
          { group: ["@/mocks", "@/mocks/*"], message: "Mock infrastructure is prototype-only. Wire mocks in the feature's data/data-source.ts." },
        ],
      }],
      "no-restricted-properties": ["error", {
        object: "process", property: "env", message: "Read environment values through @/platform/env.",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
