import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const AI_SDK_MESSAGE =
  "Không import SDK AI trực tiếp. Dùng interface LLMProvider trong src/ai; chỉ src/ai/providers/** được import SDK nhà cung cấp.";
const AI_SDK_PACKAGES = ["@anthropic-ai/sdk", "@google/genai"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: AI_SDK_PACKAGES.map((name) => ({ name, message: AI_SDK_MESSAGE })),
          patterns: [
            {
              group: AI_SDK_PACKAGES.map((name) => `${name}/*`),
              message: AI_SDK_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    // The only place vendor SDKs are allowed.
    files: ["src/ai/providers/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-test/**", // build folder of the second dev server used for browser tests
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
