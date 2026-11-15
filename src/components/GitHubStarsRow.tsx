import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { useOwnedQuery, useOwnerId } from "../identity/OwnerProvider";
import { Field } from "./Field";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";

// OWNER: GitHub stars import thread (ZUB-19). Import-screen row: enter a username once, then Sync.

type Notice = { tone: "success" | "error"; text: string };

function summary(created: number, duplicates: number): string {
  if (!created) return duplicates ? `You're up to date. ${duplicates} already in Zapy.` : "No starred repos found.";
  return `${created} new ${created === 1 ? "repo" : "repos"} imported${duplicates ? `, ${duplicates} already in Zapy` : ""}. Zapy is reading them now.`;
}

export function GitHubStarsRow() {
  const ownerId = useOwnerId();
  const status = useOwnedQuery(api.imports.github.status, {});
  const sync = useAction(api.imports.github.sync);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const username = draft ?? status?.username ?? "";

  const onSync = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await sync({ ownerId, username: username.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNotice({ tone: "success", text: summary(r.created, r.duplicates) });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const caption = status?.lastError ?? (status ? `@${status.username}${status.lastSyncNew != null ? ` · last sync ${status.lastSyncNew} new` : ""}` : "Import repos you star, newest first");

  return (
    <View testID="import-source-github" style={styles.row}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Ionicons name="logo-github" size={22} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>GitHub stars</Text>
          <Text style={[type.caption, status?.lastError ? { color: colors.danger } : null]} numberOfLines={2}>
            {caption}
          </Text>
        </View>
      </View>
      <View style={styles.top}>
        <Field
          testID="import-github-username"
          value={username}
          onChangeText={setDraft}
          placeholder="GitHub username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={onSync}
          editable={!busy}
          style={{ flex: 1, paddingVertical: space.sm }}
        />
        {busy ? (
          <ActivityIndicator color={colors.text} testID="import-github-syncing" />
        ) : (
          <Tap
            testID="import-github-sync"
            accessibilityRole="button"
            accessibilityLabel="Sync GitHub stars"
            disabled={!username.trim()}
            onPress={onSync}
            style={[styles.action, !username.trim() && { opacity: 0.4 }]}
          >
            <Text style={[styles.actionText, Platform.OS === "android" && styles.onAccent]}>Sync</Text>
          </Tap>
        )}
      </View>
      {notice ? (
        <Text testID="import-github-result" style={[type.caption, { color: notice.tone === "error" ? colors.danger : colors.success }]}>
          {notice.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  action: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent },
  actionText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  onAccent: { color: colors.surface },
});
