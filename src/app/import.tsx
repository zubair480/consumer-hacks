import { Ionicons } from "@expo/vector-icons";
import { useAction, useConvex } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { GradientButton } from "../components/GradientButton";
import { GitHubStarsRow } from "../components/GitHubStarsRow";
import { errorMessage } from "../components/media";
import { Tap } from "../components/Pressable";
import { ScreenHeader } from "../components/ScreenHeader";
import { Skeleton } from "../components/States";
import { colors, radius, space, type } from "../components/tokens";
import { fonts } from "../theme";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../identity/OwnerProvider";

// OWNER: Import thread (CONS-19). One-tap Import: connect accounts once, then pull saved posts in.

WebBrowser.maybeCompleteAuthSession();

type Source = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.imports.connections.sources>>>[number];
type Notice = { tone: "success" | "error"; text: string };

const ICONS: Record<Source["platform"], ComponentProps<typeof Ionicons>["name"]> = {
  x: "logo-twitter",
  instagram: "logo-instagram",
  linkedin: "logo-linkedin",
};

function summary(created: number, duplicates: number, invalid: number): string {
  if (!created && invalid) return `${invalid} saved ${invalid === 1 ? "post was" : "posts were"} skipped (no valid link).`;
  if (!created) return duplicates ? `You're up to date. ${duplicates} already in Zapy.` : "No saved posts found.";
  return `${created} new ${created === 1 ? "save" : "saves"} imported${duplicates ? `, ${duplicates} already in Zapy` : ""}. Zapy is reading them now.`;
}

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export default function ImportScreen() {
  const ownerId = useOwnerId();
  const convex = useConvex();
  const sources = useOwnedQuery(api.imports.connections.sources, {});
  const startXConnect = useAction(api.imports.connections.startXConnect);
  const syncX = useAction(api.imports.connections.syncX);
  const disconnect = useOwnedMutation(api.imports.connections.disconnect);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const x = sources?.find((s) => s.platform === "x");
  const connected = sources?.filter((s) => s.connected) ?? [];

  const sync = async () => {
    setBusy("sync");
    setNotice(null);
    try {
      const r = await syncX({ ownerId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNotice({ tone: "success", text: summary(r.created, r.duplicates, r.invalid) });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const connectX = async () => {
    setBusy("connect");
    setNotice(null);
    try {
      const returnUrl = Linking.createURL("import");
      const { authorizeUrl } = await startXConnect({ ownerId, returnUrl });
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
      setBusy(null);
      if (result.type !== "success") {
        const fresh = await convex.query(api.imports.connections.sources, { ownerId });
        if (fresh.find((s) => s.platform === "x")?.connected) await sync();
        return;
      }
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.x === "connected") await sync();
      else setNotice({ tone: "error", text: typeof queryParams?.message === "string" ? queryParams.message : "Couldn't connect X." });
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} testID="import-screen" keyboardShouldPersistTaps={Platform.OS === "android" ? "handled" : undefined}>
        <ScreenHeader title="Import saves" back />
        <Text style={styles.lead}>Connect your accounts once. Zapy pulls in what you bookmark and turns each post into something you can do.</Text>

        <GradientButton
          testID="import-now-button"
          label={busy === "sync" ? "Importing…" : connected.length ? "Import now" : "Connect a source below"}
          icon="cloud-download"
          loading={busy === "sync"}
          disabled={!connected.length || busy !== null}
          onPress={sync}
        />

        {notice ? (
          <View testID="import-result" style={[styles.notice, notice.tone === "error" && styles.noticeError]}>
            <Ionicons name={notice.tone === "error" ? "alert-circle" : "checkmark-circle"} size={20} color={notice.tone === "error" ? colors.danger : colors.success} />
            <Text style={styles.noticeText}>{notice.text}</Text>
            {notice.tone === "success" ? (
              <Tap testID="import-view-library" onPress={() => router.push("/library")}>
                <Text style={styles.link}>View</Text>
              </Tap>
            ) : null}
          </View>
        ) : null}

        <Text style={type.label}>Sources</Text>
        {!sources ? (
          <Skeleton rows={3} />
        ) : (
          sources.map((s) => (
            <SourceRow
              key={s.platform}
              source={s}
              busy={s.platform === "x" ? busy : null}
              onConnect={connectX}
              onSync={sync}
              onDisconnect={() => disconnect({ platform: s.platform }).catch((e) => setNotice({ tone: "error", text: errorMessage(e) }))}
            />
          ))
        )}
        <GitHubStarsRow />

        {x && !x.configured ? (
          <Text style={styles.footnote} testID="import-x-not-configured">
            X import needs server credentials (X_CLIENT_ID). Ask the team to finish setup.
          </Text>
        ) : null}

        <Tap testID="import-paste-fallback" onPress={() => router.push("/capture")} style={styles.fallback}>
          <Ionicons name="link-outline" size={16} color={colors.textMuted} />
          <Text style={styles.fallbackText}>Or paste a link, text, or screenshot</Text>
        </Tap>
      </ScrollView>
    </SafeAreaView>
  );
}

function SourceRow({
  source,
  busy,
  onConnect,
  onSync,
  onDisconnect,
}: {
  source: Source;
  busy: "connect" | "sync" | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const id = `import-source-${source.platform}`;
  const status = source.comingSoon
    ? Platform.OS === "android"
      ? "Share a post → Send to… (HTTP Shortcuts). Set it up once from Profile → Share to Zapy."
      : "Share a post → Zapy Shortcut. Set it up once from Profile → Share to Zapy."
    : source.connected
      ? [source.username ? `@${source.username}` : "Connected", source.lastSyncedAt ? `synced ${ago(source.lastSyncedAt)}` : null].filter(Boolean).join(" · ")
      : source.configured
        ? "Not connected"
        : "Not set up yet";
  return (
    <View testID={id} style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={ICONS[source.platform]} size={22} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>{source.label}</Text>
        <Text style={[type.caption, source.lastError ? { color: colors.danger } : null]} numberOfLines={2}>
          {source.lastError ?? status}
        </Text>
        {source.connected ? (
          <Tap testID={`${id}-disconnect`} onPress={onDisconnect} haptic="none">
            <Text style={styles.disconnect}>Disconnect</Text>
          </Tap>
        ) : null}
      </View>
      {source.comingSoon ? (
        <Tap testID={`${id}-share-setup`} accessibilityRole="button" accessibilityLabel={`Set up sharing from ${source.label}`} onPress={() => router.push("/profile")} style={styles.action}>
          <Text style={styles.actionText}>Set up</Text>
        </Tap>
      ) : busy ? (
        <ActivityIndicator color={colors.text} />
      ) : source.connected ? (
        <Tap testID={`${id}-sync`} accessibilityRole="button" accessibilityLabel={`Sync ${source.label}`} onPress={onSync} style={styles.action}>
          <Text style={styles.actionText}>Sync</Text>
        </Tap>
      ) : (
        <Tap
          testID={`${id}-connect`}
          accessibilityRole="button"
          accessibilityLabel={`Connect ${source.label}`}
          disabled={!source.configured}
          onPress={onConnect}
          style={[styles.action, styles.connect, !source.configured && { opacity: 0.4 }]}
        >
          <Text style={[styles.actionText, styles.onAccent]}>Connect</Text>
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingBottom: 60 },
  lead: { ...type.body, color: colors.textMuted },
  notice: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success },
  noticeError: { borderColor: colors.danger },
  noticeText: { ...type.body, flex: 1 },
  link: { color: colors.accent, fontFamily: fonts.bold, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  action: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  connect: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  onAccent: { color: colors.surface },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  chipText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bold },
  disconnect: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.medium, marginTop: space.xs },
  footnote: { ...type.caption, color: colors.textFaint },
  fallback: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.md },
  fallbackText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.medium },
});
