import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { errorMessage } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { ResultView } from "../../components/ResultView";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { colors, radius, space, type } from "../../components/tokens";
import { Button, pastelFor } from "../../components/ui";
import { colors as theme } from "../../theme";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { ACTION_LABELS } from "../../shared/contracts";

export default function ActionResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Boundary title="Couldn’t load this result">
        <Body executionId={id as Id<"actionExecutions">} />
      </Boundary>
    </SafeAreaView>
  );
}

function Body({ executionId }: { executionId: Id<"actionExecutions"> }) {
  const execution = useOwnedQuery(api.actions.getExecution, { executionId });
  const result = useOwnedQuery(api.actions.getResult, { executionId });
  const item = useOwnedQuery(api.items.get, execution ? { itemId: execution.itemId } : "skip");
  const [copied, setCopied] = useState(false);
  const insets = useSafeAreaInsets();
  const plainHeader = <View style={[styles.top, { paddingTop: insets.top }]}><ScreenHeader title="Result" back /></View>;

  if (execution === undefined) return <>{plainHeader}<View style={styles.content}><Skeleton rows={4} /></View></>;
  if (execution === null) {
    return (
      <View style={styles.content}>
        {plainHeader}
        <EmptyState icon="help-circle-outline" title="Result not found" body="It may have been deleted with its save.">
          <Button testID="result-go-home-button" title="Go home" variant="secondary" fullWidth onPress={() => router.replace("/")} />
        </EmptyState>
      </View>
    );
  }

  const label = ACTION_LABELS[execution.actionType]?.title ?? "Action";
  const doc = result?.result;
  const text = doc ? doc.markdown ?? doc.shareText : "";
  const at = result?.createdAt ?? execution.completedAt ?? execution.createdAt;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (e) {
      Alert.alert("Couldn’t copy", errorMessage(e));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
  };

  return (
    <>
    <ScrollView contentContainerStyle={doc ? { paddingBottom: 120 } : null} testID="result-screen">
      <View style={[styles.band, { backgroundColor: pastelFor(item?.primaryType), paddingTop: insets.top }]}>
        <ScreenHeader title="" back />
        <View style={styles.pill}><Text style={styles.pillText}>{label}</Text></View>
        <Text style={styles.display} numberOfLines={4}>{doc?.title ?? label}</Text>
        <Text style={styles.stamp} testID="result-timestamp">{new Date(at).toLocaleString()}</Text>
      </View>
      <View style={styles.content}>

      {execution.status === "queued" || execution.status === "running" ? (
        <View style={styles.state} testID="result-running">
          <ActivityIndicator color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>{execution.status === "queued" ? "Getting started…" : "Working on it…"}</Text>
            <Text style={type.caption}>Reading the source and building your result. This usually takes a few seconds; you can leave this screen.</Text>
          </View>
        </View>
      ) : null}

      {execution.status === "failed" || execution.status === "cancelled" ? (
        <View style={[styles.state, { backgroundColor: theme.dangerSoft, borderWidth: 0 }]} testID="result-failed">
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.heading, { color: colors.danger }]}>{execution.status === "failed" ? "This action failed" : "Cancelled"}</Text>
            {execution.error ? <Text style={type.caption}>{execution.error}</Text> : null}
            <Tap testID="result-retry-button" onPress={() => router.replace({ pathname: "/item/[id]/actions", params: { id: execution.itemId } })}>
              <Text style={styles.link}>Back to actions to retry</Text>
            </Tap>
          </View>
        </View>
      ) : null}

      {execution.status === "awaiting_approval" ? (
        <View style={[styles.state, { backgroundColor: theme.warningSoft, borderWidth: 0 }]} testID="result-awaiting-approval">
          <Ionicons name="hand-left" size={20} color={colors.text} />
          <Text style={[type.caption, { flex: 1 }]}>Draft ready. Nothing has been sent. Copy or share it yourself when you’re happy with it.</Text>
        </View>
      ) : null}

      {doc ? (
        <>
          <ResultView doc={doc} resultId={result?._id} accent={pastelFor(item?.primaryType)} />
          <Tap testID="result-open-item-button" onPress={() => router.push({ pathname: "/item/[id]", params: { id: execution.itemId } })} style={styles.itemLink}>
            <Ionicons name="bookmark-outline" size={16} color={colors.text} />
            <Text style={styles.link}>Open the saved item</Text>
          </Tap>
        </>
      ) : null}
      </View>
    </ScrollView>
    {doc ? (
      <View style={styles.bar}>
        <Button testID="copy-result-button" title={copied ? "Copied" : "Copy"} icon={copied ? "checkmark" : "copy-outline"} variant="secondary" onPress={copy} style={{ flex: 1 }} />
        <Button testID="share-result-button" title="Share" icon="share-outline" onPress={() => Share.share({ message: text, title: doc.title }).catch((e) => Alert.alert("Couldn’t share", errorMessage(e)))} style={{ flex: 1 }} />
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  content: { padding: space.xl, gap: space.xl },
  band: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  pill: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.text },
  display: { fontSize: 40, lineHeight: 40, fontWeight: "900", letterSpacing: -1.5, textTransform: "uppercase", color: colors.text },
  stamp: { fontSize: 13, fontWeight: "600", color: "rgba(14,14,16,0.6)" },
  gap: { gap: space.sm },
  state: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  link: { color: colors.text, fontWeight: "700", textDecorationLine: "underline" },
  itemLink: { flexDirection: "row", gap: 6, alignItems: "center", alignSelf: "center", padding: space.md },
});
