import * as WebBrowser from "expo-web-browser";
import { friendlyError } from "../../components/media";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Button, Card, Text } from "../../components/ui";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { colors, spacing } from "../../theme";

export default function FillApproval() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const id = runId as Id<"formFillRuns">;
  const run = useOwnedQuery(api.formFill.get, { runId: id });
  const approve = useOwnedMutation(api.formFill.approve);
  const cancel = useOwnedMutation(api.formFill.cancel);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg }}><ScreenHeader title="Fill it for me" back /></View>
      <ScrollView testID="fill-screen" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        {run === undefined ? (
          <ActivityIndicator testID="fill-loading" />
        ) : run === null ? (
          <Text variant="heading" testID="fill-gone">This save is gone.</Text>
        ) : (
          <>
            <Text variant="heading" testID="fill-status">{label(run.status)}</Text>
            {run.status === "queued" || run.status === "filling" ? (
              <>
                <Text tone="secondary">The agent is opening the form and filling it. This takes about a minute.</Text>
                <ActivityIndicator />
                <Button testID="fill-cancel" title="Cancel" variant="secondary" onPress={() => cancel({ runId: id })} />
              </>
            ) : null}
            {run.message ? <Text tone="secondary" testID="fill-message">{friendlyError(run.message, "Couldn’t open the form right now. Try again in a minute.")}</Text> : null}
            {run.status === "failed" ? <Button testID="fill-try-again" title="Try again" variant="secondary" onPress={() => router.back()} /> : null}
            {run.fields.map((f, i) => (
              <Card key={f.label + i} testID={`fill-field-${i}`}>
                <Text variant="caption" tone="secondary">{f.label}{f.state === "filled" ? "" : ` · ${f.note ?? f.state}`}</Text>
                <Text>{f.value ?? "Needs you"}</Text>
              </Card>
            ))}
            {run.screenshots.map((uri, i) => (
              <Image key={uri} testID={`fill-shot-${i}`} source={{ uri }} style={{ width: "100%", aspectRatio: 0.75, borderRadius: 12, backgroundColor: colors.surface }} resizeMode="contain" />
            ))}
            {run.status === "needs_approval" ? (
              <>
                <Text tone="secondary">Check the fields. Approving opens the live form so you can review and submit it yourself. The session closes in 8 minutes.</Text>
                <Button
                  testID="fill-approve"
                  title="Approve and open the form"
                  onPress={async () => {
                    await approve({ runId: id });
                    if (run.liveViewUrl) await WebBrowser.openBrowserAsync(run.liveViewUrl);
                  }}
                />
                <Button testID="fill-cancel" title="Cancel" variant="secondary" onPress={() => cancel({ runId: id })} />
              </>
            ) : null}
            {run.status === "approved" ? (
              <>
                {run.liveViewUrl ? <Button testID="fill-open-live" title="Open the live form" onPress={() => WebBrowser.openBrowserAsync(run.liveViewUrl!)} /> : null}
                <Button testID="fill-done" title="I’m done, close the session" variant="secondary" onPress={() => cancel({ runId: id })} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function label(status: string) {
  switch (status) {
    case "queued": return "Starting";
    case "filling": return "Filling the form";
    case "needs_approval": return "Ready for your OK";
    case "approved": return "Approved: submit it yourself";
    case "cancelled": return "Closed";
    case "expired": return "Session expired";
    case "blocked": return "Couldn’t fill this page";
    default: return "Something went wrong";
  }
}
