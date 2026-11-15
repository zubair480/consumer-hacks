import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { itemTitle } from "../ItemCard";
import { Tap } from "../Pressable";
import { colors, radius, space, type } from "../tokens";
import { metaFor, timeAgo } from "../typeMeta";
import type { SavedItemView } from "../../shared/contracts";

export function SourceRow({ item, onPress }: { item: SavedItemView; onPress: () => void }) {
  const m = metaFor(item.primaryType);
  return (
    <Tap testID={`studio-source-${item._id}`} accessibilityRole="button" accessibilityLabel={itemTitle(item)} onPress={onPress} style={styles.row}>
      <View style={[styles.thumb, { backgroundColor: m.color + "22" }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <Ionicons name={m.icon} size={22} color={m.color} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.heading} numberOfLines={1}>{itemTitle(item)}</Text>
        <Text style={type.caption} numberOfLines={1}>{m.label} · saved {timeAgo(item.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
