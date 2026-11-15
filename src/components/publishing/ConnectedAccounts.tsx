import { View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { ACCOUNT_LABELS } from "../../lib/share";
import { colors, spacing } from "../../theme";
import { Card, Divider, Skeleton, Text } from "../ui";

// OWNER: Thread J (CONS-11). Profile → Connected accounts. Booleans from the server only.

export function ConnectedAccounts() {
  const accounts = useOwnedQuery(api.publishing.jobs.connectedAccounts, {});
  return (
    <Card testID="connected-accounts">
      <Text variant="label" tone="muted">
        Connected accounts
      </Text>
      {!accounts ? (
        <View style={{ marginTop: spacing.md }}>
          <Skeleton height={120} />
        </View>
      ) : (
        accounts.map((a, i) => (
          <View key={a.platform}>
            {i > 0 ? <Divider /> : null}
            <View
              testID={`connected-account-${a.platform}`}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: spacing.md,
              }}
            >
              <Text variant="bodyStrong">{ACCOUNT_LABELS[a.platform]}</Text>
              <Text variant="caption" color={a.connected ? colors.success : colors.textMuted}>
                {a.connected ? "Connected" : "Share-sheet mode"}
              </Text>
            </View>
          </View>
        ))
      )}
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
        Share-sheet mode: you post it yourself from the app. AfterScroll never stores passwords.
      </Text>
    </Card>
  );
}
