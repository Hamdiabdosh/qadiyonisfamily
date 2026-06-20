type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Wadeh API rejects OpenAI catalog names like gpt-4o-mini — use auto-routing instead. */
const LEGACY_MODEL_ALIASES = new Set(["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "gpt-4", "gpt-4.1"]);

const LLM_TIMEOUT_MS = 45_000;
const MAX_SYSTEM_CHARS = 24_000;

function resolveModel(): string {
  const configured = process.env.LLM_MODEL?.trim();
  if (!configured || LEGACY_MODEL_ALIASES.has(configured)) return "auto";
  return configured;
}

export function getLlmConfig() {
  return {
    apiKey: process.env.LLM_API_KEY?.trim() ?? "",
    baseUrl: (process.env.LLM_API_BASE_URL ?? "https://wadehapi.gitify.site/v1").replace(/\/$/, ""),
    model: resolveModel(),
  };
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmConfig().apiKey);
}

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m, i) => {
    if (m.role !== "system" || i !== 0) return m;
    if (m.content.length <= MAX_SYSTEM_CHARS) return m;
    return {
      ...m,
      content: `${m.content.slice(0, MAX_SYSTEM_CHARS)}\n\n[Context truncated for length.]`,
    };
  });
}

function extractContent(data: {
  choices?: Array<{ message?: { content?: string | null }; text?: string }>;
}): string {
  const choice = data.choices?.[0];
  const fromMessage = choice?.message?.content?.trim();
  if (fromMessage) return fromMessage;
  const fromText = choice?.text?.trim();
  if (fromText) return fromText;
  return "";
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) {
    throw new Error("AI assistant is not configured on the server (LLM_API_KEY missing).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: trimMessages(messages),
        temperature: 0.4,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `LLM request failed (${response.status})`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null }; text?: string }>;
    };
    const content = extractContent(data);
    if (!content) throw new Error("Empty response from AI assistant.");
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LLM request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
