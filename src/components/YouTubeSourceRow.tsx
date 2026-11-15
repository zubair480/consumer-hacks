import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../identity/OwnerProvider";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";

// OWNER: YouTube import thread (ZUB-20). The YouTube liked-videos row on the Import screen.

type Notice = { tone: "success" | "error"; text: string };

function summary(created: number, duplicates: number): string {
  if (!created) return duplicates ? `You're up to date. ${duplicates} liked ${duplicates === 1 ? "video" : "videos"} already in Zapy.` : "No liked videos found.";
  return `${created} liked ${created === 1 ? "video" : "videos"} imported${duplicates ? `, ${duplicates} already in Zapy` : ""}. Zapy is reading them now.`;
}

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function YouTubeSourceRow({ onNotice }: { onNotice: (notice: Notice | null) => void }) {
  const ownerId = useOwnerId();
  const status = useOwnedQuery(api.imports.youtube.status, {});
  const startConnect = useAction(api.imports.youtube.startConnect);
  const syncYouTube = useAction(api.imports.youtube.sync);
  const disconnect = useOwnedMutation(api.imports.connections.disconnect);
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    onNotice(null);
    try {
      const r = await syncYouTube({ ownerId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onNotice({ tone: "success", text: summary(r.created, r.duplicates) });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      onNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    onNotice(null);
    try {
      const returnUrl = Linking.createURL("import");
      const { authorizeUrl } = await startConnect({ ownerId, returnUrl });
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
      setBusy(false);
      if (result.type !== "success") return;
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.youtube === "connected") await sync();
      else onNotice({ tone: "error", text: typeof queryParams?.message === "string" ? queryParams.message : "Couldn't connect YouTube." });
    } catch (e) {
      onNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const id = "import-source-youtube";
  const line = !status.configured
    ? "Not configured: the server needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    : status.connected
      ? [status.channelTitle ?? "Connected", status.lastSyncedAt ? `synced ${ago(status.lastSyncedAt)}` : null].filter(Boolean).join(" · ")
      : "Not connected";

  return (
    <View testID={id} style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name="logo-youtube" size={22} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>YouTube liked videos</Text>
        <Text testID={`${id}-status`} style={[type.caption, status.lastError ? { color: colors.danger } : null]} numberOfLines={2}>
          {status.lastError ?? line}
        </Text>
        {status.connected ? (
          <Tap
            testID={`${id}-disconnect`}
            onPress={() => disconnect({ platform: "youtube" }).catch((e) => onNotice({ tone: "error", text: errorMessage(e) }))}
            haptic="none"
          >
            <Text style={styles.disconnect}>Disconnect</Text>
          </Tap>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : status.connected ? (
        <Tap testID={`${id}-sync`} accessibilityRole="button" accessibilityLabel="Sync YouTube liked videos" onPress={sync} style={styles.action}>
          <Text style={styles.actionText}>Sync</Text>
        </Tap>
      ) : (
        <Tap
          testID={`${id}-connect`}
          accessibilityRole="button"
          accessibilityLabel="Connect YouTube"
          disabled={!status.configured}
          onPress={connect}
          style={[styles.action, styles.connect, !status.configured && { opacity: 0.4 }]}
        >
          <Text style={styles.actionText}>Connect</Text>
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  action: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  connect: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  disconnect: { color: colors.textFaint, fontSize: 12, marginTop: space.xs },
});
