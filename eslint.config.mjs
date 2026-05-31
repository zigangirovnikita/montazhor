import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", ".pnpm-store/**", ".venv/**", "node_modules/**", "storage/**", "hyperframes-library/**"]
  },
  ...nextVitals,
  ...nextTs
];

export default config;
