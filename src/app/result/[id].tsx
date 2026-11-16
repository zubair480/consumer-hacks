import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { errorMessage, friendlyError } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { ResultView } from "../../components/ResultView";
import { TerminalCard } from "../../components/agents/TerminalCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { colors, radius, space } from "../../components/tokens";
import { BouncingDots, Shimmer, SpinRing } from "../../components/Signature";
import { Button, Doodle, InkPill, SlideUp, Text, pastelFor } from "../../components/ui";
import { fonts, palette } from "../../theme";

import { useOwnedQuery } from "../../identity/OwnerProvider";
import { ACTION_LABELS } from "../../shared/contracts";

const type = {
  heading: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: palette.ink },
  caption: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: palette.ink },
};

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
        <View pointerEvents="none" style={[styles.doodles, { top: insets.top + 52 }]}>
          <View style={{ transform: [{ rotate: "-10deg" }] }}><Doodle kind="burst" size={36} /></View>
          <View style={{ transform: [{ rotate: "8deg" }], marginTop: 20 }}><Doodle kind="star" size={32} fill={palette.white} /></View>
        </View>
        <View style={styles.pills}>
          <InkPill label="Result" />
          <View style={styles.pill}><Text style={styles.pillText}>{label}</Text></View>
        </View>
        <Text style={styles.display} numberOfLines={4} accessibilityRole="header">{doc?.title ?? label}</Text>
        <Text style={styles.stamp} testID="result-timestamp">{new Date(at).toLocaleString()}</Text>
      </View>
      <View style={styles.content}>

      {execution.status === "queued" || execution.status === "running" ? (
        <View style={[styles.state, { overflow: "hidden" }]} testID="result-running">
          <Shimmer color={pastelFor(item?.primaryType)} width={200} />
          <View style={styles.ring}><SpinRing size={22} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={type.heading}>Working…</Text><BouncingDots /></View>
            <Text style={type.caption}>Your result slides in here when it’s ready.</Text>
          </View>
        </View>
      ) : null}

      {execution.status === "failed" || execution.status === "cancelled" ? (
        <View style={[styles.state, { backgroundColor: palette.peach, borderWidth: 0 }]} testID="result-failed">
          <View style={styles.redDot} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={type.heading}>{execution.status === "failed" ? "This action failed" : "Cancelled"}</Text>
            {execution.status === "failed" ? <Text style={type.caption}>{friendlyError(execution.error, "This didn’t finish. Try again in a minute.")}</Text> : null}
            <Tap testID="result-retry-button" onPress={() => router.replace({ pathname: "/item/[id]/actions", params: { id: execution.itemId } })}>
              <Text style={styles.link}>Back to actions to retry</Text>
            </Tap>
          </View>
        </View>
      ) : null}

      {execution.status === "awaiting_approval" ? (
        <View style={[styles.state, { backgroundColor: palette.butter, borderWidth: 0 }]} testID="result-awaiting-approval">
          <Ionicons name="hand-left-outline" size={22} color={palette.ink} />
          <Text style={[type.caption, { flex: 1 }]}>Draft ready. Nothing has been sent. Copy or share it yourself when you’re happy with it.</Text>
        </View>
      ) : null}

      {doc ? (
        <SlideUp style={{ gap: 28 }}>
          {doc.actionType === "run_repo" ? <TerminalCard doc={doc} /> : null}
          <ResultView doc={doc} resultId={result?._id} accent={pastelFor(item?.primaryType)} />
          <Tap testID="result-open-item-button" onPress={() => router.push({ pathname: "/item/[id]", params: { id: execution.itemId } })} style={styles.itemLink}>
            <Ionicons name="bookmark-outline" size={16} color={colors.text} />
            <Text style={styles.link}>Open the saved item</Text>
          </Tap>
        </SlideUp>
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
  safe: { flex: 1, backgroundColor: palette.white },
  top: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 28, gap: 28 },
  band: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
  doodles: { position: "absolute", right: 20, flexDirection: "row", gap: 4 },
  pills: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pill: { height: 28, justifyContent: "center", backgroundColor: palette.white, paddingHorizontal: 12, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: palette.ink },
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -0.5, textTransform: "uppercase", color: palette.ink, paddingRight: 40 },
  stamp: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: palette.ink },
  gap: { gap: space.sm },
  state: { flexDirection: "row", alignItems: "center", gap: space.md, padding: 20, borderRadius: radius.lg, backgroundColor: palette.grey },
  ring: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5484D" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: space.md, paddingHorizontal: 20, paddingTop: space.md, paddingBottom: 32, backgroundColor: palette.white, borderTopWidth: 1, borderTopColor: colors.border },
  link: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: palette.ink, textDecorationLine: "underline" },
  itemLink: { flexDirection: "row", gap: 6, alignItems: "center", alignSelf: "center", minHeight: 44, paddingHorizontal: space.md },
});
