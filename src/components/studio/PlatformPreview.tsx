import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "../tokens";
import { platformMeta } from "./platforms";

export function PlatformPreview({ platform, text, name = "You" }: { platform: string; text: string; name?: string }) {
  const m = platformMeta(platform);
  const light = platform === "linkedin";
  const fg = light ? "#191919" : "#F5F5FA";
  const sub = light ? "#666666" : "#8B8B99";
  const square = platform === "instagram" || platform === "tiktok";
  return (
    <View style={[styles.card, { backgroundColor: light ? "#FFFFFF" : "#000000", borderColor: light ? "#E0E0E0" : "#2F3336" }]} testID={`preview-card-${platform}`}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: m.color + "33" }]}><Ionicons name="person" size={18} color={m.color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: fg }]}>{name}</Text>
          <Text style={[styles.meta, { color: sub }]}>{platform === "x" || platform === "threads" ? "@you · now" : "Just now"}</Text>
        </View>
        <Ionicons name={m.icon} size={20} color={light ? m.color : fg} />
      </View>
      {square ? (
        <View style={[styles.media, { aspectRatio: platform === "tiktok" ? 9 / 12 : 1 }]}>
          <Ionicons name={platform === "tiktok" ? "play-circle" : "image-outline"} size={42} color={sub} />
          <Text style={[styles.meta, { color: sub }]}>{platform === "tiktok" ? "Your video" : "Your photo"}</Text>
        </View>
      ) : null}
      <Text style={[styles.body, { color: fg }]} selectable>{text}</Text>
      <View style={[styles.actions, { borderTopColor: light ? "#E0E0E0" : "#2F3336" }]}>
        {(platform === "linkedin" ? ["thumbs-up-outline", "chatbubble-outline", "repeat-outline", "paper-plane-outline"] : ["heart-outline", "chatbubble-outline", "repeat-outline", "share-outline"]).map((icon) => (
          <Ionicons key={icon} name={icon as "heart-outline"} size={18} color={sub} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  media: { width: "100%", borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", gap: 6 },
  body: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
});
