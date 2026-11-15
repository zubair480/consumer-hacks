import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import type { SocialDraftView } from "../../shared/socialContracts";
import { Tap } from "../Pressable";
import { Section } from "../Section";
import { colors, radius, space, type } from "../tokens";
import { timeAgo } from "../typeMeta";
import { DraftStatusPill } from "./DraftStatusPill";
import { platformMeta } from "./platforms";

function open(d: SocialDraftView) {
  const source = d.sourceSavedItemId ? { itemId: d.sourceSavedItemId } : { mediaId: d.sourceMediaId! };
  router.push({ pathname: "/studio/editor", params: { ...source, platform: d.platform } });
}

export function RecentDrafts() {
  const drafts = useOwnedQuery(api.social.drafts.listRecent, { limit: 5 });
  if (!drafts || drafts.length === 0) return null;
  return (
    <Section title="Recent drafts">
      {drafts.map((d) => {
        const m = platformMeta(d.platform);
        return (
          <Tap key={d._id} testID={`studio-recent-${d._id}`} accessibilityRole="button" accessibilityLabel={`${m.label} draft`} onPress={() => open(d)} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: m.color }]}><Ionicons name={m.icon} size={18} color={colors.text} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.body} numberOfLines={2}>{d.generationStatus === "generating" ? "Writing…" : d.draftText || "Empty draft"}</Text>
              <View style={styles.meta}>
                <DraftStatusPill status={d.generationStatus === "generating" ? "generating" : d.status} />
                <Text style={type.caption}>{timeAgo(d.updatedAt)}</Text>
              </View>
            </View>
          </Tap>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
