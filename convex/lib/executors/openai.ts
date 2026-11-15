// OWNER: D+E. Minimal JSON-only OpenAI helper for executors. Called from Convex actions only.

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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  });
  if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");
  try {
    return { data: JSON.parse(text) as T, model };
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
}
