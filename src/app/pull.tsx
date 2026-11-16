import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { HoloBand, ScalePressable, Text } from "../components/ui";
import { useOwnedQuery, useOwnerId } from "../identity/OwnerProvider";
import { BOXES, boxFor, type BoxKey } from "../lib/boxes";
import { colors, fonts, palette } from "../theme";

const BOUNCY = { damping: 12, stiffness: 220 };
/** Thread B's convex/demo.ts (spec B4). Referenced by name so this screen builds before it lands on main. */
const pullEverythingRef = makeFunctionReference<"mutation", { ownerId: string }, unknown>("demo:pullEverything");
const SETTLED = new Set(["ready", "needs_input", "failed"]);

/** Demo flow A2: pulls everything in and shows the saves sorting into boxes. Progress comes from the owner's items. */
export default function Pull() {
  const ownerId = useOwnerId();
  const pullEverything = useMutation(pullEverythingRef);
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const [pullFailed, setPullFailed] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    pullEverything({ ownerId }).catch(() => setPullFailed(true));
  }, [ownerId, pullEverything]);

  const total = items?.length ?? 0;
  const analyzed = items?.filter((i) => SETTLED.has(i.extractionStatus)).length ?? 0;
  const done = items !== undefined && (total > 0 ? analyzed === total : pullFailed);
  const counts: Record<BoxKey, number> = { code: 0, forms: 0, events: 0, jobs: 0, learn: 0, other: 0 };
  for (const i of items ?? []) if (SETTLED.has(i.extractionStatus)) counts[boxFor(i.primaryType).key] += 1;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="pull-screen">
      <HoloBand height={140} />
      <View style={styles.content}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>Pulling it all in</Text>
          <Text style={styles.sub}>From X bookmarks, your share sheet and saved links</Text>
        </View>
        <Progress value={total ? analyzed / total : 0} />
        <View style={styles.grid}>
          {BOXES.map((b, i) => (
            <Box key={b.key} label={b.label} color={b.color} count={counts[b.key]} index={i} testID={`pull-box-${b.key}`} />
          ))}
        </View>
      </View>
      <View style={styles.bottom}>
        {done ? (
          <Animated.View entering={ZoomIn.springify().damping(BOUNCY.damping).stiffness(BOUNCY.stiffness)}>
            <ScalePressable testID="pull-see-tasks" accessibilityRole="button" accessibilityLabel="See my tasks" haptic scaleTo={0.97} onPress={() => router.replace("/")} style={styles.primary}>
              <Text style={styles.primaryText}>See my tasks</Text>
            </ScalePressable>
          </Animated.View>
        ) : (
          <Text style={[styles.sub, { textAlign: "center" }]}>{total ? `Sorting ${analyzed} of ${total}…` : "Finding your saves…"}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Progress({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(value, { duration: 400 }));
  }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${Math.round(w.value * 100)}%` }));
  return (
    <View testID="pull-progress" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={styles.track}>
      <Animated.View style={[styles.fill, a]} />
    </View>
  );
}

function Box({ label, color, count, index, testID }: { label: string; color: string; count: number; index: number; testID: string }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? 0 : -320);
  const o = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    y.set(withDelay(index * 120, withSpring(0, BOUNCY)));
    o.set(withDelay(index * 120, withTiming(1, { duration: 200 })));
  }, [index, reduce, y, o]);
  const card = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <View testID={testID} style={[styles.box, { backgroundColor: color }]}>
      <Animated.View style={[styles.mini, card]} />
      <Animated.Text key={count} entering={reduce ? undefined : FadeIn.duration(200)} style={styles.count}>
        {count}
      </Animated.Text>
      <Text style={styles.boxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 28 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.5, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: palette.text2 },
  track: { height: 8, borderRadius: 4, backgroundColor: palette.grey, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  box: { width: "47%", flexGrow: 1, height: 112, borderRadius: 22, padding: 14, justifyContent: "flex-end", overflow: "hidden" },
  mini: { position: "absolute", top: 12, right: 12, width: 60, height: 40, borderRadius: 10, backgroundColor: "#FFFFFF" },
  count: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text, fontVariant: ["tabular-nums"] },
  boxLabel: { fontFamily: fonts.extraBold, fontSize: 14, lineHeight: 18, color: colors.text },
  bottom: { paddingHorizontal: 20, paddingBottom: 8, minHeight: 64, justifyContent: "center" },
  primary: { height: 56, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.onPrimary },
});
