import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnedMutation } from "../identity/OwnerProvider";
import type { ActionResultDocument, FactEvidence, RequirementStatus, ResultSection } from "../shared/contracts";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";
import { colors as theme, palette } from "../theme";

const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

type Toggle = (sectionIndex: number, itemIndex: number, checked: boolean) => void;

export function ResultView({ doc, resultId, accent = palette.mint }: { doc: ActionResultDocument; resultId?: Id<"actionResults">; accent?: string }) {
  const setChecklistItem = useOwnedMutation(api.items.setChecklistItem);
  const toggle: Toggle = (sectionIndex, itemIndex, checked) => {
    if (!resultId) return;
    Haptics.selectionAsync().catch(() => {});
    setChecklistItem({ resultId, sectionIndex, itemIndex, checked }).catch(() => {});
  };
  return (
    <View style={styles.wrap} testID="result-view">
      <Text style={[type.body, styles.summary]}>{doc.summary}</Text>
      {doc.warnings.length > 0 ? (
        <View style={styles.warn} testID="result-warnings">
          {doc.warnings.map((w, i) => (
            <View key={i} style={styles.row}>
              <Ionicons name="warning" size={15} color={colors.text} />
              <Text style={[type.caption, { color: colors.text, flex: 1 }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {doc.sections.map((s, i) => (
        <View key={i} style={styles.card} testID={`result-section-${i}`}>
          {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
          <Body section={s} index={i} toggle={toggle} accent={accent} />
        </View>
      ))}
      {doc.sources.length > 0 ? (
        <View style={styles.card} testID="result-sources">
          <Text style={type.label}>Sources</Text>
          {doc.sources.map((src, i) => (
            <Tap key={i} testID={`result-source-${i}`} disabled={!src.url} onPress={() => src.url && open(src.url)} style={styles.row}>
              <Ionicons name={src.url ? "link" : "document-text-outline"} size={14} color={src.url ? colors.text : colors.textMuted} />
              <Text style={[type.caption, { flex: 1, color: src.url ? colors.text : colors.textMuted, textDecorationLine: src.url ? "underline" : "none" }]} numberOfLines={1}>{src.label}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const STATUS: Record<RequirementStatus, { label: string; color: string }> = {
  met: { label: "Met", color: colors.success },
  unmet: { label: "Not met", color: colors.danger },
  unknown: { label: "Unknown", color: colors.textMuted },
};

function StatusTag({ status }: { status?: RequirementStatus }) {
  if (!status) return null;
  const s = STATUS[status];
  return <Text style={[styles.tag, { color: s.color, backgroundColor: s.color + "1F" }]}>{s.label}</Text>;
}

function Evidence({ evidence }: { evidence?: FactEvidence }) {
  if (!evidence?.quote) return null;
  return <Text style={styles.evidence}>“{evidence.quote}”</Text>;
}

function CheckRow({ testID, checked, onToggle, accent, children }: { testID: string; checked: boolean; onToggle: (v: boolean) => void; accent: string; children: React.ReactNode }) {
  const [local, setLocal] = useState<boolean | null>(null);
  const value = local ?? checked;
  return (
    <Tap testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: value }} haptic="none" onPress={() => { setLocal(!value); onToggle(!value); }} style={styles.check}>
      <View style={[styles.box, value ? { backgroundColor: accent, borderColor: accent } : null]}>{value ? <Ionicons name="checkmark" size={15} color={colors.text} /> : null}</View>
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
    </Tap>
  );
}

function Body({ section, index, toggle, accent }: { section: ResultSection; index: number; toggle: Toggle; accent: string }) {
  switch (section.kind) {
    case "text":
      return <Text style={type.body} selectable>{section.body}</Text>;
    case "list":
      return (
        <>
          {section.items.map((it, i) => (
            <View key={i} style={styles.bulletRow}><View style={styles.bullet} /><Text style={[type.body, { flex: 1 }]}>{it}</Text></View>
          ))}
        </>
      );
    case "checklist":
      return (
        <>
          {section.items.map((it, i) => (
            <CheckRow key={i} testID={`checklist-${index}-${i}`} checked={it.checked ?? it.done ?? false} accent={accent} onToggle={(v) => toggle(index, i, v)}>
              <View style={styles.row}>
                <Text style={[type.body, { flex: 1 }]}>{it.label}</Text>
                <StatusTag status={it.status} />
              </View>
              {it.detail ? <Text style={type.caption}>{it.detail}</Text> : null}
              <Evidence evidence={it.evidence} />
            </CheckRow>
          ))}
        </>
      );
    case "steps":
      return (
        <>
          {section.steps.map((st, i) => (
            <CheckRow key={i} testID={`step-${index}-${i}`} checked={st.checked ?? false} accent={accent} onToggle={(v) => toggle(index, i, v)}>
              <Text style={[type.body, { fontWeight: "700" }]}>{i + 1}. {st.title}</Text>
              {st.detail ? <Text style={type.caption}>{st.detail}</Text> : null}
              {st.code ? <Text style={styles.code} selectable>{st.code}</Text> : null}
              <Evidence evidence={st.evidence} />
            </CheckRow>
          ))}
        </>
      );
    case "key_value":
      return (
        <>
          {section.rows.map((r, i) => (
            <View key={i} style={styles.kv}>
              <Text style={[type.caption, styles.kvLabel]}>{r.label}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.row}><Text style={[type.body, { flex: 1 }]}>{r.value}</Text><StatusTag status={r.status} /></View>
                {r.detail ? <Text style={type.caption}>{r.detail}</Text> : null}
                <Evidence evidence={r.evidence} />
              </View>
            </View>
          ))}
        </>
      );
    case "links":
      return (
        <>
          {section.links.map((l, i) => (
            <Tap key={i} testID={`result-link-${index}-${i}`} onPress={() => open(l.url)} style={styles.row}>
              <Ionicons name="open-outline" size={16} color={colors.text} />
              <Text style={[type.body, { color: colors.text, flex: 1, textDecorationLine: "underline" }]} numberOfLines={1}>{l.label}</Text>
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
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  summary: { fontSize: 17, lineHeight: 24 },
  card: { gap: space.md, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.2, color: colors.text },
  warn: { gap: 6, padding: space.lg, borderRadius: radius.lg, backgroundColor: theme.warningSoft },
  box: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textFaint, alignItems: "center", justifyContent: "center", marginTop: -1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulletRow: { flexDirection: "row", gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text, marginTop: 8 },
  check: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  tag: { fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  evidence: { fontSize: 12, fontStyle: "italic", color: colors.textFaint },
  code: { fontFamily: "Menlo", fontSize: 12, color: colors.text, backgroundColor: colors.surfaceRaised, padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
  kv: { flexDirection: "row", gap: space.md },
  kvLabel: { width: 110, fontWeight: "700" },
  palette: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatchWrap: { width: 72, gap: 4 },
  swatch: { width: 72, height: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  swatchText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  swatchHex: { color: colors.textFaint, fontSize: 11 },
});
