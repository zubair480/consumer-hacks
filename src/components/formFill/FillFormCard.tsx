import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { spacing } from "../../theme";
import { Button, Card, Text } from "../ui";

/** "Fill it for me" entry point on scholarship items. Hidden unless the server has its keys. */
export function FillFormCard({ item }: { item: { _id: string; contentTypes: string[]; sourceUrl?: string | null } }) {
  const itemId = item._id as Id<"savedItems">;
  const eligible = item.contentTypes.includes("scholarship") && Boolean(item.sourceUrl);
  const available = useOwnedQuery(api.formFill.available, {});
  const latest = useOwnedQuery(api.formFill.latestForItem, eligible ? { itemId } : "skip");
  const start = useOwnedMutation(api.formFill.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!eligible || available !== true) return null;

  const open = (runId: string) => router.push({ pathname: "/fill/[runId]", params: { runId } });
  const press = async () => {
    setBusy(true);
    setError(null);
    try {
      open(await start({ itemId }));
    } catch {
      setError("Couldn’t start. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card testID="fill-form-card">
      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">Fill it for me</Text>
        <Text tone="secondary">A browser agent opens the application, fills what it can from your profile, and waits for your OK. It never submits for you.</Text>
        {error ? <Text tone="danger">{error}</Text> : null}
        <Button
          testID="fill-form-button"
          title={latest ? "Open last fill" : "Fill it for me"}
          icon="document-text-outline"
          loading={busy}
          onPress={latest ? () => open(latest._id) : press}
        />
        {latest ? <Button testID="fill-form-restart" title="Start a new fill" variant="ghost" onPress={press} /> : null}
      </View>
    </Card>
  );
}
