import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { DraftStatusPill } from "../../components/studio/DraftStatusPill";
import { PlatformPreview } from "../../components/studio/PlatformPreview";
import { platformMeta } from "../../components/studio/platforms";
import { colors, space, type } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";

export default function StudioPreview() {
  const { draftId, text } = useLocalSearchParams<{ draftId: string; text?: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pad}><ScreenHeader title="Preview" back /></View>
      <Boundary title="Couldn’t load the preview">
        <Body draftId={draftId as Id<"socialDrafts">} override={text} />
      </Boundary>
    </SafeAreaView>
  );
}

function Body({ draftId, override }: { draftId: Id<"socialDrafts">; override?: string }) {
  const draft = useOwnedQuery(api.social.drafts.get, { draftId });
  if (draft === undefined) return <View style={styles.pad}><Skeleton rows={2} height={200} /></View>;
  return (
    <ScrollView contentContainerStyle={styles.content} testID="studio-preview-screen">
      <View style={styles.row}>
        <Text style={type.heading}>{platformMeta(draft.platform).label}</Text>
        <DraftStatusPill status={draft.status} />
      </View>
      <PlatformPreview platform={draft.platform} text={override ?? draft.draftText} />
      <Text style={type.caption}>An approximation of how it will look. {override ? "Showing your unsaved edit." : `Version ${draft.revision}.`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 80 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
