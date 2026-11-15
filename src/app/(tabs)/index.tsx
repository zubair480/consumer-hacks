import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { actionsApi } from "../../components/actionsApi";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { OutcomeRow } from "../../components/OutcomeRow";
import { ItemCard } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { Section } from "../../components/Section";
import { colors, gradient, radius, space, type } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { IN_PROGRESS_EXTRACTION_STATUSES } from "../../shared/contracts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 30 });
  const ready = items?.filter((i) => i.extractionStatus === "ready") ?? [];
  const working = items?.filter((i) => IN_PROGRESS_EXTRACTION_STATUSES.includes(i.extractionStatus)).length ?? 0;
  const attention = items?.filter((i) => i.extractionStatus === "needs_input" || i.extractionStatus === "failed").length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} testID="home-screen">
        <View>
          <Text style={type.caption}>{greeting()}</Text>
          <Text style={type.display}>AfterScroll</Text>
        </View>

        <Tap testID="home-save-button" accessibilityRole="button" accessibilityLabel="Save something" haptic="medium" onPress={() => router.push("/capture")}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="add" size={30} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Save something</Text>
              <Text style={styles.heroBody}>Paste a link, text, or a screenshot. We’ll turn it into something you can do.</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </Tap>

        {items && (working > 0 || attention > 0) ? (
          <View style={styles.stats}>
            {working > 0 ? <Stat icon="sparkles" color={colors.info} label={`${working} being understood`} /> : null}
            {attention > 0 ? <Stat icon="alert-circle" color={colors.warning} label={`${attention} need you`} onPress={() => router.push("/library")} /> : null}
          </View>
        ) : null}

        {items === undefined ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
        ) : items.length === 0 ? (
          <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Save a GitHub repo, a scholarship, a restaurant, or a design you liked. AfterScroll figures out what you can do with it." />
        ) : (
          <>
            {ready.length > 0 ? (
              <Section title="Ready for you">
                <FlatList
                  horizontal
                  data={ready.slice(0, 8)}
                  keyExtractor={(i) => i._id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.md }}
                  renderItem={({ item }) => <ItemCard item={item} compact />}
                  testID="home-ready-list"
                />
              </Section>
            ) : null}
            <Boundary fallback={null}>
              <Outcomes />
            </Boundary>
            <Section
              title="Recent saves"
              right={<Tap testID="home-see-all" onPress={() => router.push("/library")}><Text style={styles.link}>See all</Text></Tap>}
            >
              {items.slice(0, 6).map((item) => <ItemCard key={item._id} item={item} />)}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Outcomes() {
  const outcomes = useOwnedQuery(actionsApi.recentOutcomes, { limit: 5 });
  if (!outcomes || outcomes.length === 0) return null;
  return (
    <Section title="Completed outcomes">
      {outcomes.map((r) => <OutcomeRow key={r._id} row={r} />)}
    </Section>
  );
}

function Stat({ icon, color, label, onPress }: { icon: "sparkles" | "alert-circle"; color: string; label: string; onPress?: () => void }) {
  return (
    <Tap testID={`home-stat-${icon}`} onPress={onPress} disabled={!onPress} style={[styles.stat, { borderColor: color + "44" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.statText, { color }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  stats: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.surface },
  statText: { fontSize: 13, fontWeight: "700" },
  link: { color: colors.accent, fontWeight: "700", fontSize: 14 },
});
