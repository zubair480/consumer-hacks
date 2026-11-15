import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { ResultRow } from "./api";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";
import { timeAgo } from "./typeMeta";

export function OutcomeRow({ row }: { row: ResultRow }) {
  return (
    <Tap testID={`outcome-${row._id}`} onPress={() => router.push({ pathname: "/result/[id]", params: { id: row.executionId } })} style={styles.row}>
      <View style={styles.icon}><Ionicons name="checkmark-done" size={18} color={colors.success} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.heading} numberOfLines={1}>{row.result.title}</Text>
        <Text style={type.caption} numberOfLines={1}>{row.itemTitle ? `${row.itemTitle} · ` : ""}{timeAgo(row.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + "1F", alignItems: "center", justifyContent: "center" },
});
