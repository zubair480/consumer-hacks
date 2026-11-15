import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { useOwnedMutation } from "../../identity/OwnerProvider";
import { errorMessage } from "../media";
import { colors, radius, spacing } from "../../theme";
import { Button, Card, Text } from "../ui";

// OWNER: Share to Zapy (CONS-22). Profile card: the token the iOS Shortcut sends to POST /save.

export const SHORTCUT_GUIDE_URL = "https://github.com/zubair480/consumer-hacks/blob/main/docs/ios-shortcut.md";
const SAVE_URL = (process.env.EXPO_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site") + "/save";

export function ShareToZapyCard() {
  const getOrCreate = useOwnedMutation(api.share.getOrCreateShareToken);
  const rotate = useOwnedMutation(api.share.rotateShareToken);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOrCreate({}).then(setToken, (e) => setStatus(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStatus(`${label} copied`);
  };

  const onRotate = async () => {
    setBusy(true);
    try {
      setToken(await rotate({}));
      setStatus("New token made. Paste it into your Shortcut; the old one no longer works.");
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card testID="share-to-zapy-card">
      <Text variant="label" tone="muted">
        Share to Zapy
      </Text>
      <Text tone="secondary" style={{ marginTop: spacing.sm }}>
        Save from any app’s share sheet (Instagram, LinkedIn, TikTok) with an iOS Shortcut. Paste this token into the Shortcut once.
      </Text>
      <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised }}>
        <Text testID="share-token-text" selectable numberOfLines={1} ellipsizeMode="middle" style={{ fontFamily: "Menlo" }}>
          {token ?? "Loading…"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <Button testID="share-token-copy" title="Copy token" icon="copy-outline" size="sm" disabled={!token} onPress={() => token && copy(token, "Token")} style={{ flex: 1 }} />
        <Button testID="share-token-rotate" title="Rotate" icon="refresh" size="sm" variant="secondary" loading={busy} disabled={!token} onPress={onRotate} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Button testID="share-url-copy" title="Copy save URL" icon="link-outline" size="sm" variant="ghost" onPress={() => copy(SAVE_URL, "Save URL")} style={{ flex: 1 }} />
        <Button testID="share-setup-guide" title="Setup guide" icon="book-outline" size="sm" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(SHORTCUT_GUIDE_URL)} style={{ flex: 1 }} />
      </View>
      {status ? (
        <Text testID="share-token-status" variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          {status}
        </Text>
      ) : null}
    </Card>
  );
}
