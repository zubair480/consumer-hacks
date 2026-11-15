// OWNER: D+E. Minimal JSON-only OpenAI helper for executors. Called from Convex actions only.

import { fetchWithRetry, isTimeout } from "./sources";

const OPENAI_TIMEOUT_MS = 45000;

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

export async function callJson<T>(system: string, user: string, imageUrl?: string | null): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the Convex deployment");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const content: Content = imageUrl
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : user;
  let res: Response;
  try {
    res = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
        }),
      },
      OPENAI_TIMEOUT_MS,
    );
  } catch (e) {
    if (isTimeout(e)) throw new Error("The AI took too long to respond. Please try again.");
    console.error("OpenAI request error", e);
    throw new Error("Could not reach the AI service. Please try again.");
  }
  if (!res.ok) {
    console.error("OpenAI request failed", res.status, (await res.text().catch(() => "")).slice(0, 500));
    throw new Error(
      res.status === 429
        ? "The AI service is busy right now. Please try again in a minute."
        : `The AI service returned an error (${res.status}). Please try again.`,
    );
  }
  let body: { choices?: { message?: { content?: string } }[] };
  try {
    body = (await res.json()) as typeof body;
  } catch (e) {
    throw new Error(isTimeout(e) ? "The AI took too long to respond. Please try again." : "OpenAI returned invalid JSON");
  }
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");
  try {
    return { data: JSON.parse(text) as T, model };
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
}
