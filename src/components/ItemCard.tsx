import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import type { SavedItemView as SavedItem } from "../shared/contracts";
import { Tap } from "./Pressable";
import { StatusPill } from "./StatusPill";
import { colors, radius, space, type } from "./tokens";
import { TypeChip } from "./TypeChip";
import { metaFor, timeAgo } from "./typeMeta";

export function itemTitle(item: SavedItem) {
  if (item.title) return item.title;
  if (item.sourceUrl) return item.sourceUrl.replace(/^https?:\/\/(www\.)?/, "");
  if (item.rawText) return item.rawText.slice(0, 80);
  return item.imageUrl ? "Screenshot" : "Untitled save";
}

export function ItemCard({ item, compact }: { item: SavedItem; compact?: boolean }) {
  const m = metaFor(item.primaryType);
  return (
    <Tap
      testID={`item-card-${item._id}`}
      accessibilityLabel={itemTitle(item)}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })}
      style={[styles.card, compact && styles.compact]}
    >
      <View style={[styles.accent, { backgroundColor: m.color }]} />
      <View style={styles.row}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.iconThumb, { backgroundColor: m.color + "22" }]}>
            <Ionicons name={item.sourceUrl ? "link" : m.icon} size={22} color={m.color} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={type.heading} numberOfLines={2}>{itemTitle(item)}</Text>
          {!compact && item.summary ? <Text style={type.caption} numberOfLines={2}>{item.summary}</Text> : null}
          <View style={styles.meta}>
            {item.extractionStatus === "ready" ? <TypeChip type={item.primaryType} /> : <StatusPill status={item.extractionStatus} />}
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, overflow: "hidden" },
  compact: { width: 260 },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  row: { flexDirection: "row", gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  iconThumb: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 2 },
  time: { fontSize: 12, color: colors.textFaint },
});
