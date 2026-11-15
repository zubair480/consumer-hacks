import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { EmptyState } from "../../components/EmptyState";
import { itemTitle } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusPill } from "../../components/StatusPill";
import { colors, radius, space, type } from "../../components/tokens";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { useOwnedQuery } from "../../identity/OwnerProvider";

export default function Activity() {
  const items = useOwnedQuery(api.items.list, { limit: 100 });
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}><ScreenHeader title="Activity" /></View>
      {items === undefined ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          testID="activity-list"
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="pulse" title="No activity yet" body="Saves, analysis, and finished actions show up here." />}
          renderItem={({ item, index }) => {
            const m = metaFor(item.primaryType);
            return (
              <Tap testID={`activity-${item._id}`} onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: m.color + "26", borderColor: m.color }]}>
                    <Ionicons name={m.icon} size={14} color={m.color} />
                  </View>
                  {index < items.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.body}>
                  <Text style={type.caption}>Saved · {timeAgo(item.createdAt)}</Text>
                  <Text style={type.heading} numberOfLines={2}>{itemTitle(item)}</Text>
                  <StatusPill status={item.extractionStatus} />
                </View>
              </Tap>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  list: { padding: space.xl, paddingBottom: 60 },
  row: { flexDirection: "row", gap: space.md },
  rail: { alignItems: "center", width: 30 },
  node: { width: 30, height: 30, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  body: { flex: 1, gap: 6, paddingBottom: space.xl },
});
