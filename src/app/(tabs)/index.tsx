import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { ItemCard } from "../../components/ItemCard";
import { OutcomeRow } from "../../components/OutcomeRow";
import { Tap } from "../../components/Pressable";
import { Section } from "../../components/Section";
import { Skeleton } from "../../components/States";
import { colors, gradient, radius, space, type } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const openCapture = () => router.push("/capture");

export default function Home() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} testID="home-screen">
        <View style={styles.header}>
          <View>
            <Text style={type.caption}>{greeting()}</Text>
            <Text style={type.display}>Zapy</Text>
          </View>
          <Tap testID="home-header-add-button" accessibilityLabel="Save something" haptic="medium" onPress={openCapture} style={styles.add}>
            <Ionicons name="add" size={24} color={colors.text} />
          </Tap>
        </View>

        <Tap testID="home-save-button" accessibilityRole="button" accessibilityLabel="Save something" haptic="medium" onPress={openCapture}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="add" size={30} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Save</Text>
              <Text style={styles.heroBody}>A link, some text, or a screenshot. We turn it into something you can do.</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </Tap>

        <Boundary title="Couldn’t load your saves">
          <Feed />
        </Boundary>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feed() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  if (items === undefined) return <Skeleton rows={3} />;
  if (items.length === 0) {
    return (
      <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Save a GitHub repo, a scholarship, a restaurant, or a design you liked. Zapy figures out what you can do with it.">
        <GradientButton testID="home-empty-save-button" label="Save your first thing" icon="add" onPress={openCapture} style={{ alignSelf: "stretch", marginTop: space.sm }} />
      </EmptyState>
    );
  }
  return (
    <>
      <Boundary fallback={null}>
        <ReadyAndOutcomes items={items} />
      </Boundary>
      <Section title="Recently saved" right={<Tap testID="home-see-all" onPress={() => router.push("/library")}><Text style={styles.link}>See all</Text></Tap>}>
        {items.slice(0, 10).map((item) => <ItemCard key={item._id} item={item} />)}
      </Section>
    </>
  );
}

function ReadyAndOutcomes({ items }: { items: NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>> }) {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  if (outcomes === undefined) return null;
  const acted = new Set(outcomes.map((o) => o.itemId as string));
  const ready = items.filter((i) => i.extractionStatus === "ready" && !acted.has(i._id)).slice(0, 5);
  return (
    <>
      {ready.length > 0 ? (
        <Section title="Ready for you">
          <FlatList
            testID="home-ready-list"
            horizontal
            data={ready}
            keyExtractor={(i) => i._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md }}
            renderItem={({ item }) => <ItemCard item={item} compact />}
          />
        </Section>
      ) : null}
      {outcomes.length > 0 ? (
        <Section title="Completed outcomes">
          {outcomes.slice(0, 5).map((r) => <OutcomeRow key={r._id} row={r} />)}
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  link: { color: colors.accent, fontWeight: "700", fontSize: 14 },
});
