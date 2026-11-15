// OWNER: Thread B+C. Shared JSON-only OpenAI helper. Call it only from Convex
// actions (it uses fetch and the server-side OPENAI_API_KEY).

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

export type LLMJsonOptions = {
  /** System prompt: role, rules, and the JSON shape to return. */
  system: string;
  /** User content: the source material or task. */
  user: string;
  /** Image URLs or data URLs (data:image/png;base64,...) for vision. */
  images?: string[];
  /** Example or description of the JSON object to return; appended to the system prompt. */
  schemaHint?: string;
  /** Upper bound on output tokens. Defaults to 4000. */
  maxOutputTokens?: number;
};

/** The model id ingestion and executors use: OPENAI_MODEL, else a small vision model. */
export function getLLMModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/**
 * Calls OpenAI in JSON mode and returns the parsed object. Throws on a missing
 * key, an HTTP error, or output that is not a JSON object.
 */
export async function callLLMJson<T = Record<string, unknown>>(options: LLMJsonOptions): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the Convex deployment");
  const system = [
    options.system,
    "Respond with a single JSON object only, no prose or markdown.",
    options.schemaHint ? `JSON shape:\n${options.schemaHint}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const user = options.images?.length
    ? [
        { type: "text", text: options.user },
        ...options.images.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : options.user;
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: getLLMModel(),
      response_format: { type: "json_object" },
      max_completion_tokens: options.maxOutputTokens ?? 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  const parsed: unknown = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("OpenAI did not return a JSON object");
  return parsed as T;
}
