import OpenAI from "openai";

/**
 * Provider-agnostic chat interface. Any OpenAI-compatible endpoint works:
 * OpenAI, Anthropic (via compatibility layer), DeepSeek, Groq, Ollama...
 * Switching providers is just AI_BASE_URL + AI_MODEL + AI_API_KEY.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL || undefined,
    });
  }
  return client;
}

export async function chat(
  messages: ChatMessage[],
  options: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: process.env.AI_MODEL || "gpt-4o-mini",
    messages,
    max_tokens: options.maxTokens ?? 700,
    temperature: 0.7,
    ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  return response.choices[0]?.message?.content ?? "";
}
