import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { ActionResultDocument, ResultSection } from "../shared/contracts";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";

export function ResultView({ doc }: { doc: ActionResultDocument }) {
  return (
    <View style={styles.wrap} testID="result-view">
      <Text style={[type.body, styles.summary]}>{doc.summary}</Text>
      {doc.warnings.length > 0 ? (
        <View style={styles.warn} testID="result-warnings">
          {doc.warnings.map((w, i) => (
            <View key={i} style={styles.row}>
              <Ionicons name="warning" size={14} color={colors.warning} />
              <Text style={[type.caption, { color: colors.warning, flex: 1 }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {doc.sections.map((s, i) => <SectionBlock key={i} section={s} index={i} />)}
      {doc.sources.length > 0 ? (
        <View style={styles.card}>
          <Text style={type.label}>Sources</Text>
          {doc.sources.map((src, i) => (
            <Tap key={i} testID={`result-source-${i}`} disabled={!src.url} onPress={() => src.url && Linking.openURL(src.url)} style={styles.row}>
              <Ionicons name={src.url ? "link" : "document-text-outline"} size={14} color={colors.accent} />
              <Text style={[type.caption, { flex: 1, color: src.url ? colors.accent : colors.textMuted }]} numberOfLines={1}>{src.label}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SectionBlock({ section, index }: { section: ResultSection; index: number }) {
  return (
    <View style={styles.card} testID={`result-section-${index}`}>
      {section.heading ? <Text style={type.heading}>{section.heading}</Text> : null}
      <Body section={section} />
    </View>
  );
}

function Body({ section }: { section: ResultSection }) {
  switch (section.kind) {
    case "text":
      return <Text style={type.body}>{section.body}</Text>;
    case "list":
      return (
        <>
          {section.items.map((it, i) => (
            <View key={i} style={styles.row}><View style={styles.bullet} /><Text style={[type.body, { flex: 1 }]}>{it}</Text></View>
          ))}
        </>
      );
    case "checklist":
      return (
        <>
          {section.items.map((it, i) => (
            <View key={i} style={styles.check}>
              <Ionicons name={it.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={it.done ? colors.success : colors.textFaint} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.body}>{it.label}</Text>
                {it.detail ? <Text style={type.caption}>{it.detail}</Text> : null}
                {it.evidence ? <Text style={styles.evidence}>“{it.evidence.quote}”</Text> : null}
              </View>
            </View>
          ))}
        </>
      );
    case "steps":
      return (
        <>
          {section.steps.map((st, i) => (
            <View key={i} style={styles.check}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.body, { fontWeight: "700" }]}>{st.title}</Text>
                {st.detail ? <Text style={type.caption}>{st.detail}</Text> : null}
                {st.code ? <Text style={styles.code}>{st.code}</Text> : null}
              </View>
            </View>
          ))}
        </>
      );
    case "key_value":
      return (
        <>
          {section.rows.map((r, i) => (
            <View key={i} style={styles.kv}>
              <Text style={[type.caption, styles.kvLabel]}>{r.label}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.body}>{r.value}</Text>
                {r.evidence ? <Text style={styles.evidence}>“{r.evidence.quote}”</Text> : null}
              </View>
            </View>
          ))}
        </>
      );
    case "links":
      return (
        <>
          {section.links.map((l, i) => (
            <Tap key={i} testID={`result-link-${i}`} onPress={() => Linking.openURL(l.url)} style={styles.row}>
              <Ionicons name="open-outline" size={16} color={colors.accent} />
              <Text style={[type.body, { color: colors.accent, flex: 1 }]} numberOfLines={1}>{l.label}</Text>
            </Tap>
          ))}
        </>
      );
    case "code":
      return <Text style={styles.code} selectable>{section.code}</Text>;
    case "palette":
      return (
        <View style={styles.palette}>
          {section.colors.map((c, i) => (
            <View key={i} style={styles.swatchWrap}>
              <View style={[styles.swatch, { backgroundColor: c.hex }]} />
              <Text style={styles.swatchText}>{c.name ?? c.hex}</Text>
              {c.name ? <Text style={styles.swatchHex}>{c.hex}</Text> : null}
            </View>
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  summary: { fontSize: 17, lineHeight: 24 },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  warn: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.warning + "12", borderWidth: 1, borderColor: colors.warning + "44" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, alignSelf: "flex-start", marginTop: 8 },
  check: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  evidence: { fontSize: 12, fontStyle: "italic", color: colors.textFaint },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent + "33", alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.accent, fontWeight: "800", fontSize: 12 },
  code: { fontFamily: "Menlo", fontSize: 12, color: "#E2E8F0", backgroundColor: "#0A0A0F", padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
  kv: { flexDirection: "row", gap: space.md },
  kvLabel: { width: 110, fontWeight: "700" },
  palette: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatchWrap: { width: 72, gap: 4 },
  swatch: { width: 72, height: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  swatchText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  swatchHex: { color: colors.textFaint, fontSize: 11 },
});
