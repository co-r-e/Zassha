import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Keep existing hydration and media URL synchronization visible as warnings
  // while adopting the newer React Compiler recommendations.
  {
    files: [
      "src/components/ThemeToggle.tsx",
      "src/components/i18n-context.tsx",
      "src/components/language-toggle.tsx",
      "src/components/upload-context.tsx",
      "src/features/analysis/parsed-result.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
];

export default eslintConfig;
