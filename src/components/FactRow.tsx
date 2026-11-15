import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ExtractedFact } from "../shared/contracts";
import { Tap } from "./Pressable";
import { colors, space, type } from "./tokens";

export function FactRow({ fact, index }: { fact: ExtractedFact; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Tap testID={`fact-${index}`} accessibilityLabel={`${fact.label}: ${fact.value}`} accessibilityHint="Shows where this came from" haptic="none" onPress={() => setOpen(!open)} style={styles.row}>
      <View style={styles.line}>
        <Text style={[type.caption, styles.label]}>{fact.label}</Text>
        <Text style={[type.body, { flex: 1 }]}>{fact.value}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textFaint} />
      </View>
      {open ? (
        <View style={styles.evidence}>
          <Text style={styles.quote}>“{fact.evidence.quote}”</Text>
          <Text style={type.caption}>Source: {fact.evidence.source === "user_text" ? "your text" : fact.evidence.source === "image" ? "your image" : fact.evidence.source}</Text>
        </View>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: space.sm },
  line: { flexDirection: "row", alignItems: "center", gap: space.md },
  label: { width: 100, fontWeight: "700" },
  evidence: { marginLeft: 112, gap: 4, borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: space.md },
  quote: { color: colors.textMuted, fontStyle: "italic", fontSize: 13, lineHeight: 18 },
});
