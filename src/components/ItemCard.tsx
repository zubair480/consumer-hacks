import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import type { SavedItemView as SavedItem } from "../shared/contracts";
import { Tap } from "./Pressable";
import { StatusPill } from "./StatusPill";
import { colors, radius, space, type } from "./tokens";
import { TypeChip } from "./TypeChip";
import { metaFor, timeAgo } from "./typeMeta";

export function itemTitle(item: Pick<SavedItem, "title" | "sourceUrl" | "rawText" | "imageUrl">) {
  if (item.title) return item.title;
  if (item.sourceUrl) return item.sourceUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (item.rawText) return item.rawText.slice(0, 80);
  return item.imageUrl ? "Screenshot" : "Untitled save";
}

export function ItemCard({ item, compact }: { item: SavedItem; compact?: boolean }) {
  const m = metaFor(item.primaryType);
  const ready = item.extractionStatus === "ready";
  return (
    <Tap
      testID={`item-card-${item._id}`}
      accessibilityLabel={itemTitle(item)}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })}
      style={[styles.card, compact && styles.compact]}
    >
      <View style={[styles.accent, { backgroundColor: m.color }]} />
      {compact ? (
        <View style={styles.compactBody}>
          <View style={[styles.thumb, styles.iconThumb, { backgroundColor: m.color + "22" }]}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <Ionicons name={m.icon} size={22} color={m.color} />}
          </View>
          <Text style={type.heading} numberOfLines={2}>{itemTitle(item)}</Text>
          {item.summary ? <Text style={type.caption} numberOfLines={2}>{item.summary}</Text> : null}
          <View style={styles.cta}>
            <Ionicons name="sparkles" size={13} color={m.color} />
            <Text style={[styles.ctaText, { color: m.color }]}>3 actions ready</Text>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.iconThumb, { backgroundColor: m.color + "22" }]}>
              <Ionicons name={ready ? m.icon : item.sourceUrl ? "link" : item.rawText ? "document-text" : "image"} size={22} color={m.color} />
            </View>
          )}
          <View style={styles.body}>
            <Text style={type.heading} numberOfLines={2}>{itemTitle(item)}</Text>
            {item.summary ? <Text style={type.caption} numberOfLines={2}>{item.summary}</Text> : null}
            <View style={styles.meta}>
              <StatusPill status={item.extractionStatus} />
              {item.contentTypes.slice(0, 2).map((t) => <TypeChip key={t} type={t} />)}
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, overflow: "hidden" },
  compact: { width: 230 },
  compactBody: { gap: space.sm },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  row: { flexDirection: "row", gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  iconThumb: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  body: { flex: 1, gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  time: { fontSize: 12, color: colors.textFaint },
  cta: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 2 },
  ctaText: { fontSize: 12, fontWeight: "800" },
});
