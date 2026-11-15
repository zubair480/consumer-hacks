// Composio REST helpers (no SDK). COMPOSIO_API_KEY stays on the server.

const BASE = "https://backend.composio.dev/api/v3.1";
const RETURN_URL = /^(exp|exps|zapy):\/\//i;

export const GCAL_CALLBACK_PATH = "/composio/callback";

export function authConfigId(): string {
  return process.env.COMPOSIO_GCAL_AUTH_CONFIG_ID || "ac_H2u1pFLyftFj";
}

/** Only app deep links may be redirected to. Returns null for anything else. */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 500 || !RETURN_URL.test(raw)) return null;
  try {
    new URL(raw);
    return raw;
  } catch {
    return null;
  }
}

async function composio(path: string, init?: RequestInit): Promise<any> {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("Calendar isn't set up on the server yet.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? body?.message ?? `Composio error ${res.status}`);
  return body;
}

export async function createConnectLink(userId: string, callbackUrl: string): Promise<string> {
  const body = await composio("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({ auth_config_id: authConfigId(), user_id: userId, callback_url: callbackUrl }),
  });
  if (typeof body.redirect_url !== "string") throw new Error("Composio returned no connect link.");
  return body.redirect_url;
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const q = new URLSearchParams({ user_ids: userId, toolkit_slugs: "googlecalendar", statuses: "ACTIVE" });
  const body = await composio(`/connected_accounts?${q}`);
  return Array.isArray(body.items) && body.items.length > 0;
}

export type CalendarEventArgs = {
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  timezone: string;
  durationMinutes: number;
};

/** Creates the event and returns its link, if Composio gave one. */
export async function createCalendarEvent(userId: string, e: CalendarEventArgs): Promise<string | null> {
  const body = await composio("/tools/execute/GOOGLECALENDAR_CREATE_EVENT", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      version: "latest",
      arguments: {
        summary: e.summary,
        description: e.description,
        location: e.location,
        start_datetime: e.startDateTime,
        timezone: e.timezone,
        event_duration_hour: Math.floor(e.durationMinutes / 60),
        event_duration_minutes: e.durationMinutes % 60,
        calendar_id: "primary",
        create_meeting_room: false,
      },
    }),
  });
  if (body.successful === false) throw new Error(body.error ?? "Google Calendar rejected the event. Is it connected?");
  const data = body.data ?? {};
  return data.htmlLink ?? data.response_data?.htmlLink ?? null;
}
