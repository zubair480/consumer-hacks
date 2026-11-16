import { Platform, StyleSheet, Text as RNText, View } from "react-native";
import type { ActionResultDocument } from "../../shared/contracts";
import { fonts, palette } from "../../theme";
import { Text } from "../ui";

const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

/** Demo flow A4: run_repo results as a terminal card: each command, its output, "Hello World" in mint, then timing and step checks. */
export function TerminalCard({ doc }: { doc: ActionResultDocument }) {
  const output = doc.sections.find((s) => s.kind === "code" && s.heading === "Output");
  const steps = doc.sections.find((s) => s.kind === "steps");
  const run = doc.sections.find((s) => s.kind === "key_value");
  const lines = (output && "code" in output ? output.code : "").split("\n");
  const time = run && "rows" in run ? run.rows.find((r) => r.label === "Time")?.value : undefined;
  const stepList = steps && "steps" in steps ? steps.steps : [];
  const passed = stepList.length > 0 && stepList.every((s) => s.checked);
  return (
    <View testID="run-terminal" style={styles.card}>
      <View style={styles.dots}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <View key={c} style={[styles.dot, { backgroundColor: c }]} />
        ))}
      </View>
      {lines.map((line, i) => (
        <RNText key={i} style={[styles.line, line.startsWith("$ ") && styles.cmd, /hello world/i.test(line) && styles.hello]}>
          {line || " "}
        </RNText>
      ))}
      <View style={styles.footer}>
        <Text style={[styles.foot, { color: passed ? palette.mint : "#FFD3C2" }]}>{passed ? "✓" : "✗"} Ran{time ? ` in ${time}` : ""}</Text>
        <Text style={styles.foot}>{stepList.map((s) => `${s.title.split(":")[0]} ${s.checked ? "✓" : "✗"}`).join("  ")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111111", borderRadius: 20, padding: 16, gap: 2 },
  dots: { flexDirection: "row", gap: 6, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { fontFamily: MONO, fontSize: 13, lineHeight: 19, color: "#FFFFFF" },
  cmd: { color: "#9A9AA3" },
  hello: { color: "#111111", backgroundColor: palette.mint, alignSelf: "flex-start", paddingHorizontal: 4 },
  footer: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", gap: 4 },
  foot: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: "#FFFFFF" },
});
