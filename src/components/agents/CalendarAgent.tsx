import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../../identity/OwnerProvider";
import { errorMessage } from "../media";
import { spacing } from "../../theme";
import { Button, Card, Text } from "../ui";
import { Field } from "../Field";

// OWNER: Agent mode 2 (ZUB-36). Both pieces render nothing unless Composio is configured on the server.

export function CalendarConnectRow() {
  const ownerId = useOwnerId();
  const configured = useOwnedQuery(api.agents.calendar.configured, {});
  const startConnect = useAction(api.agents.calendar.startConnect);
  const status = useAction(api.agents.calendar.connectionStatus);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (configured) status({ ownerId }).then((s) => setConnected(s.connected), () => {});
  }, [configured, ownerId, status]);

  if (!configured) return null;

  const connect = async () => {
    setBusy(true);
    setNote(null);
    try {
      const returnUrl = Linking.createURL("profile");
      const { redirectUrl } = await startConnect({ ownerId, returnUrl });
      const result = await WebBrowser.openAuthSessionAsync(redirectUrl, returnUrl);
      if (result.type === "success") {
        const ok = Linking.parse(result.url).queryParams?.gcal === "connected";
        setConnected(ok);
        setNote(ok ? null : "Google Calendar wasn't connected.");
      }
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card testID="calendar-connect-card">
      <Text variant="label" tone="muted">Google Calendar</Text>
      <Text tone="secondary" style={{ marginTop: spacing.sm }}>
        {connected ? "Connected. Events you approve are added to your primary calendar." : "Connect so Zapy can add saved events to your calendar after you approve them."}
      </Text>
      <Button testID="calendar-connect-button" title={connected ? "Reconnect Google Calendar" : "Connect Google Calendar"} icon="calendar-outline" size="sm" variant="secondary" loading={busy} onPress={connect} style={{ marginTop: spacing.md }} />
      {note ? <Text testID="calendar-connect-note" variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{note}</Text> : null}
    </Card>
  );
}

export function CalendarAgentCard({ itemId, primaryType }: { itemId: Id<"savedItems">; primaryType?: string }) {
  const configured = useOwnedQuery(api.agents.calendar.configured, {});
  const job = useOwnedQuery(api.agents.calendar.latestForItem, { itemId });
  const prepare = useOwnedMutation(api.agents.calendar.prepare);
  const updateProposal = useOwnedMutation(api.agents.calendar.updateProposal);
  const approve = useOwnedMutation(api.agents.calendar.approve);
  const cancel = useOwnedMutation(api.agents.calendar.cancel);
  const retry = useOwnedMutation(api.agents.calendar.retry);
  const [edit, setEdit] = useState<{ summary?: string; location?: string; startDateTime?: string }>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!configured || primaryType !== "event") return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const active = job && job.status !== "cancelled" ? job : null;
  const p = active?.proposal;

  return (
    <Card testID="calendar-agent-card">
      <Text variant="label" tone="muted">Add to my calendar</Text>
      {!active || !p ? (
        <Button testID="calendar-prepare" title="Draft calendar event" icon="calendar-outline" size="sm" variant="secondary" loading={busy} onPress={() => run(() => prepare({ itemId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))} style={{ marginTop: spacing.md }} />
      ) : active.status === "needs_approval" ? (
        <View testID="calendar-proposal" style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Field testID="calendar-summary" value={edit.summary ?? p.summary} onChangeText={(summary) => setEdit((e) => ({ ...e, summary }))} placeholder="Title" />
          <Field testID="calendar-location" value={edit.location ?? p.location} onChangeText={(location) => setEdit((e) => ({ ...e, location }))} placeholder="Location" />
          <Field testID="calendar-start" value={edit.startDateTime ?? p.startDateTime} onChangeText={(startDateTime) => setEdit((e) => ({ ...e, startDateTime }))} placeholder="YYYY-MM-DDTHH:MM:SS" autoCapitalize="characters" autoCorrect={false} />
          {!(edit.startDateTime ?? p.startDateTime) ? <Text variant="caption" tone="muted">The save didn’t say when this happens. Fill in the start (for example 2026-12-01T18:00:00).</Text> : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="calendar-approve" title="Approve" icon="checkmark" size="sm" loading={busy} onPress={() => run(async () => { await updateProposal({ jobId: active._id as Id<"agentJobs">, proposal: { ...p, ...edit } }); setEdit({}); await approve({ jobId: active._id as Id<"agentJobs"> }); })} style={{ flex: 1 }} />
            <Button testID="calendar-cancel" title="Cancel" size="sm" variant="ghost" disabled={busy} onPress={() => run(() => cancel({ jobId: active._id as Id<"agentJobs"> }))} style={{ flex: 1 }} />
          </View>
        </View>
      ) : active.status === "running" || active.status === "queued" ? (
        <View style={{ marginTop: spacing.md }}>
          <Text tone="secondary">Adding to your calendar…</Text>
          <Button testID="calendar-cancel" title="Cancel" size="sm" variant="ghost" onPress={() => run(() => cancel({ jobId: active._id as Id<"agentJobs"> }))} style={{ marginTop: spacing.sm }} />
        </View>
      ) : active.status === "completed" ? (
        <View style={{ marginTop: spacing.md }}>
          <Text tone="secondary">Added to Google Calendar ✓</Text>
          <Button testID="calendar-open-event" title="Open in Calendar" icon="open-outline" size="sm" variant="secondary" onPress={() => active.resultUrl && WebBrowser.openBrowserAsync(active.resultUrl).catch(() => {})} style={{ marginTop: spacing.sm }} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Text testID="calendar-error" tone="secondary">{active.error ?? "That didn't work."}</Text>
          <Button testID="calendar-retry" title="Try again" icon="refresh" size="sm" variant="secondary" loading={busy} onPress={() => run(() => retry({ jobId: active._id as Id<"agentJobs"> }))} style={{ marginTop: spacing.sm }} />
        </View>
      )}
      {note ? <Text testID="calendar-note" variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{note}</Text> : null}
    </Card>
  );
}
