/**
 * Provider-neutral types for the AI layer (design doc, section 7.3).
 * Everything outside `src/ai/providers/` must depend on these, never on a vendor SDK.
 */

export type Role = "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  /** Set when `role` is "tool": the id of the call this message answers. */
  toolCallId?: string;
}

/**
 * Simple JSON Schema subset supported by every provider.
 * Deliberately excludes `oneOf` and `$ref` because Gemini only accepts a subset.
 */
export interface JSONSchema {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  enum?: readonly (string | number)[];
  properties?: Record<string, JSONSchema>;
  required?: readonly string[];
  items?: JSONSchema;
}

export interface ToolContext {
  /** Always taken from the server session, never from tool arguments. */
  userId: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JSONSchema;
  /** `args` come from the model and are untrusted: validate them (e.g. with zod) before use. */
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ChatRequest {
  system: string;
  messages: Message[];
  tools: ToolDef[];
}

export interface ChatResult {
  message: Message;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  readonly capabilities: { promptCaching: boolean; streaming: boolean };
  chat(request: ChatRequest): Promise<ChatResult>;
}
