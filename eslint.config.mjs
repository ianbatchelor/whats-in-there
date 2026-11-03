import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "out/**", "ios/**", "android/**", "node_modules/**", "next-env.d.ts", "supabase/functions/**"] },
];

export default config;
