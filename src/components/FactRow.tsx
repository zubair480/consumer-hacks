import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ExtractedFact } from "../shared/contracts";
import { Tap } from "./Pressable";
import { colors, radius, space } from "./tokens";

export function FactRow({ fact, index, color }: { fact: ExtractedFact; index: number; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tap testID={`fact-${index}`} accessibilityLabel={`${fact.label}: ${fact.value}`} accessibilityHint="Shows where this came from" haptic="none" onPress={() => setOpen(!open)} style={[styles.tile, { backgroundColor: color }, open && styles.open]}>
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>{fact.label}</Text>
        <Ionicons name={open ? "chevron-up" : "information-circle-outline"} size={14} color={colors.text} style={{ opacity: 0.5 }} />
      </View>
      <Text style={styles.value} numberOfLines={open ? undefined : 3}>{fact.value}</Text>
      {open ? (
        <View style={styles.evidence}>
          <Text style={styles.quote}>“{fact.evidence.quote}”</Text>
          <Text style={styles.source}>Source: {fact.evidence.source === "user_text" ? "your text" : fact.evidence.source === "image" ? "your image" : fact.evidence.source}</Text>
        </View>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  tile: { width: "47.5%", flexGrow: 1, minHeight: 92, padding: space.lg, borderRadius: radius.lg, gap: 6 },
  open: { width: "100%" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  label: { flex: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(14,14,16,0.6)" },
  value: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.text },
  evidence: { gap: 4, marginTop: 4, padding: space.md, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.6)" },
  quote: { color: colors.text, fontStyle: "italic", fontSize: 13, lineHeight: 18 },
  source: { color: "rgba(14,14,16,0.6)", fontSize: 12, fontWeight: "600" },
});
