import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { ContentType } from "../shared/contracts";
import { radius } from "./tokens";
import { metaFor } from "./typeMeta";

export function TypeChip({ type }: { type?: ContentType }) {
  const m = metaFor(type);
  return (
    <View style={[styles.chip, { backgroundColor: m.color + "22" }]}>
      <Ionicons name={m.icon} size={12} color={m.color} />
      <Text style={[styles.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
