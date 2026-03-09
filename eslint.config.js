import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Intentional ref-sync pattern (updating ref.current during render to keep
      // latest value accessible in event handlers without re-subscribing)
      "react-hooks/refs": "off",
      // setState-in-effect pattern used intentionally for derived state sync
      "react-hooks/set-state-in-effect": "off",
      // Allow _-prefixed vars to be intentionally unused
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
  // Node.js scripts
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".next/**"],
  }
);
