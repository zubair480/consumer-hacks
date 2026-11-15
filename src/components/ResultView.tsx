import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnedMutation } from "../identity/OwnerProvider";
import type { ActionResultDocument, FactEvidence, RequirementStatus, ResultSection } from "../shared/contracts";
import { Tap } from "./Pressable";
import { colors, radius, space } from "./tokens";
import { fonts, palette } from "../theme";
import { CountUp, usePop } from "./Signature";
import { Text } from "./ui/Text";

const INK2 = "#5B5B63";
const type = {
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: palette.ink },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: INK2 },
  label: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" as const, color: INK2 },
};

const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

type Toggle = (sectionIndex: number, itemIndex: number, checked: boolean) => void;

export function ResultView({ doc, resultId, accent = palette.mint }: { doc: ActionResultDocument; resultId?: Id<"actionResults">; accent?: string }) {
  const setChecklistItem = useOwnedMutation(api.items.setChecklistItem);
  const toggle: Toggle = (sectionIndex, itemIndex, checked) => {
    if (!resultId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setChecklistItem({ resultId, sectionIndex, itemIndex, checked }).catch(() => {});
  };
  return (
    <View style={styles.wrap} testID="result-view">
      <Text style={[type.body, styles.summary]}>{doc.summary}</Text>
      {doc.warnings.length === 1 ? (
        <View style={styles.warn} testID="result-warnings">
          <View style={styles.row}>
            <Ionicons name="alert-circle-outline" size={18} color={palette.ink} />
            <Text style={[type.body, { flex: 1, fontFamily: fonts.bold }]}>{doc.warnings[0]}</Text>
          </View>
        </View>
      ) : doc.warnings.length > 1 ? (
        <View style={styles.notes} testID="result-warnings">
          {doc.warnings.map((w, i) => (
            <View key={i} style={styles.row}>
              <Ionicons name="alert-circle-outline" size={18} color={INK2} />
              <Text style={[type.caption, { flex: 1, paddingTop: 1 }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {doc.sections.map((s, i) => (
        <View key={i} style={styles.card} testID={`result-section-${i}`}>
          {s.heading || s.kind === "checklist" || s.kind === "steps" ? (
            <View style={styles.headRow}>
              <Text accessibilityRole="header" style={[styles.heading, { flex: 1 }]}>{s.heading ?? ""}</Text>
              {s.kind === "checklist" || s.kind === "steps" ? <Progress section={s} /> : null}
            </View>
          ) : null}
          <Body section={s} index={i} toggle={toggle} accent={accent} />
        </View>
      ))}
      {doc.sources.length > 0 ? (
        <View style={styles.card} testID="result-sources">
          <Text style={type.label}>Sources</Text>
          {doc.sources.map((src, i) => (
            <Tap key={i} testID={`result-source-${i}`} disabled={!src.url} onPress={() => src.url && open(src.url)} style={styles.row}>
              <Ionicons name={src.url ? "link" : "document-text-outline"} size={14} color={src.url ? colors.text : INK2} />
              <Text style={[type.caption, { flex: 1, color: src.url ? colors.text : INK2, textDecorationLine: src.url ? "underline" : "none" }]} numberOfLines={1}>{src.label}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const STATUS: Record<RequirementStatus, { label: string; bg: string; dot?: string }> = {
  met: { label: "Met", bg: palette.mint, dot: "#2BB673" },
  unmet: { label: "Not met", bg: palette.peach, dot: "#E5484D" },
  unknown: { label: "Unknown", bg: palette.grey },
};

function Progress({ section }: { section: ResultSection }) {
  const rows = section.kind === "checklist" ? section.items.map((it) => it.checked ?? it.done ?? false) : section.kind === "steps" ? section.steps.map((st) => st.checked ?? false) : [];
  return (
    <View style={styles.progress}>
      <CountUp value={rows.filter(Boolean).length} style={styles.progressText} />
      <Text style={styles.progressText}>/{rows.length}</Text>
    </View>
  );
}

function StatusTag({ status }: { status?: RequirementStatus }) {
  if (!status) return null;
  const s = STATUS[status];
  return (
    <View style={[styles.tag, { backgroundColor: s.bg }]}>
      {s.dot ? <View style={[styles.tagDot, { backgroundColor: s.dot }]} /> : null}
      <Text style={styles.tagText}>{s.label}</Text>
    </View>
  );
}

function Evidence({ evidence }: { evidence?: FactEvidence }) {
  if (!evidence?.quote) return null;
  return <Text style={styles.evidence}>“{evidence.quote}”</Text>;
}

function CheckRow({ testID, checked, onToggle, accent, children }: { testID: string; checked: boolean; onToggle: (v: boolean) => void; accent: string; children: React.ReactNode }) {
  const [local, setLocal] = useState<boolean | null>(null);
  const value = local ?? checked;
  const pop = usePop(value);
  return (
    <Tap testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: value }} haptic="none" onPress={() => { setLocal(!value); onToggle(!value); }} style={styles.check}>
      <Animated.View style={[styles.box, value ? { backgroundColor: accent } : null, pop]}>{value ? <Ionicons name="checkmark-sharp" size={16} color={palette.ink} /> : null}</Animated.View>
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
              <Text style={[type.body, { fontFamily: fonts.bold }]}>{i + 1}. {st.title}</Text>
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
              <Text style={[type.label, styles.kvLabel]}>{r.label}</Text>
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
  wrap: { gap: 28 },
  summary: { fontSize: 17, lineHeight: 24 },
  card: { gap: 12, padding: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: palette.ink },
  progress: { flexDirection: "row", height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.grey, alignItems: "center" },
  progressText: { fontFamily: fonts.extraBold, fontSize: 13, lineHeight: 16, color: palette.ink, fontVariant: ["tabular-nums"] },
  warn: { gap: space.sm, padding: 16, borderRadius: radius.lg, backgroundColor: palette.butter },
  notes: { gap: 8 },
  box: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: palette.ink, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletRow: { flexDirection: "row", gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text, marginTop: 8 },
  check: { flexDirection: "row", gap: space.md, alignItems: "center", minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tag: { flexDirection: "row", alignItems: "center", gap: 5, height: 24, paddingHorizontal: 10, borderRadius: 999 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: palette.ink },
  evidence: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, fontStyle: "italic", color: INK2 },
  code: { fontFamily: "Menlo", fontSize: 12, color: colors.text, backgroundColor: colors.surfaceRaised, padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
  kv: { flexDirection: "row", gap: space.md },
  kvLabel: { width: 110, paddingTop: 4 },
  palette: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatchWrap: { width: 72, gap: 4 },
  swatch: { width: 72, height: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  swatchText: { fontFamily: fonts.bold, color: colors.text, fontSize: 12 },
  swatchHex: { fontFamily: fonts.medium, color: INK2, fontSize: 11 },
});
