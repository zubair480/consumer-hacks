import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { itemTitle } from "../ItemCard";
import { Tap } from "../Pressable";
import { colors, radius, space } from "../tokens";
import { studioText } from "./studioStyles";
import { metaFor, timeAgo } from "../typeMeta";
import { pastelFor } from "../ui";
import type { SavedItemView } from "../../shared/contracts";

export function SourceRow({ item, onPress }: { item: SavedItemView; onPress: () => void }) {
  const m = metaFor(item.primaryType);
  return (
    <Tap testID={`studio-source-${item._id}`} accessibilityRole="button" accessibilityLabel={itemTitle(item)} onPress={onPress} style={styles.row}>
      <View style={[styles.thumb, { backgroundColor: pastelFor(item.primaryType) }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <Ionicons name={m.icon} size={22} color={colors.text} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[studioText.callout, { fontSize: 15 }]} numberOfLines={1}>{itemTitle(item)}</Text>
        <Text style={studioText.footnote} numberOfLines={1}>{m.label} · saved {timeAgo(item.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 72, padding: space.md, paddingRight: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
