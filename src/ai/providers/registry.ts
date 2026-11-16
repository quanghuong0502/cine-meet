/**
 * Provider registry (Factory + Registry pattern, design doc section 7.3).
 *
 * Intentionally empty for now. Later sprints will:
 *  - register one adapter per provider (`anthropic.adapter.ts`, `gemini.adapter.ts`),
 *  - create providers by name from `systemSettings` (provider and model names are config, never hard-coded),
 *  - read API keys only from environment variables.
 *
 * This folder is the ONLY place allowed to import `@anthropic-ai/sdk` or `@google/genai`
 * (enforced by the `no-restricted-imports` ESLint rule).
 */
export {};
