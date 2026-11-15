import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { actionsApi } from "../../components/actionsApi";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { ResultView } from "../../components/ResultView";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space, type } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { ACTION_LABELS } from "../../shared/contracts";

export default function ActionResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}><ScreenHeader title="Result" back /></View>
      <Boundary fallback={<View style={styles.content}><EmptyState icon="cloud-offline-outline" title="Can't load this result" body="Action results aren't available on this server yet." /></View>}>
        <Body executionId={id as Id<"actionExecutions">} />
      </Boundary>
    </SafeAreaView>
  );
}

function Body({ executionId }: { executionId: Id<"actionExecutions"> }) {
  const execution = useOwnedQuery(actionsApi.getExecution, { executionId });
  const result = useOwnedQuery(actionsApi.getResult, { executionId });
  const [copied, setCopied] = useState(false);

  if (execution === undefined) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />;
  if (execution === null) return <View style={styles.content}><EmptyState icon="help-circle-outline" title="Result not found" /></View>;

  const label = ACTION_LABELS[execution.actionType]?.title ?? "Action";
  const doc = result?.result;

  const copy = async () => {
    if (!doc) return;
    await Clipboard.setStringAsync(doc.shareText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} testID="result-screen">
      <View style={styles.gap}>
        <Text style={type.label}>{label}</Text>
        <Text style={type.display}>{doc?.title ?? label}</Text>
      </View>

      {execution.status === "queued" || execution.status === "running" ? (
        <View style={styles.state} testID="result-running">
          <ActivityIndicator color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>{execution.status === "queued" ? "Getting started…" : "Working on it…"}</Text>
            <Text style={type.caption}>Reading the source and building your result. This usually takes a few seconds.</Text>
          </View>
        </View>
      ) : null}

      {execution.status === "failed" || execution.status === "cancelled" ? (
        <View style={[styles.state, { borderColor: colors.danger + "55" }]} testID="result-failed">
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: colors.danger }]}>{execution.status === "failed" ? "This action failed" : "Cancelled"}</Text>
            {execution.error ? <Text style={type.caption}>{execution.error}</Text> : null}
            <Text style={type.caption}>Go back and run it again from the item&apos;s actions.</Text>
          </View>
        </View>
      ) : null}

      {execution.status === "awaiting_approval" ? (
        <View style={[styles.state, { borderColor: colors.warning + "55" }]} testID="result-awaiting-approval">
          <Ionicons name="hand-left" size={20} color={colors.warning} />
          <Text style={[type.caption, { flex: 1 }]}>Ready for you. Nothing has been sent; copy or share it yourself when you&apos;re happy with it.</Text>
        </View>
      ) : null}

      {doc ? (
        <>
          <ResultView doc={doc} />
          <View style={styles.buttons}>
            <GradientButton testID="copy-result-button" label={copied ? "Copied" : "Copy"} icon={copied ? "checkmark" : "copy-outline"} variant="secondary" onPress={copy} style={{ flex: 1 }} />
            <GradientButton testID="share-result-button" label="Share" icon="share-outline" onPress={() => Share.share({ message: doc.shareText, title: doc.title })} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  gap: { gap: space.sm },
  state: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttons: { flexDirection: "row", gap: space.md },
});
