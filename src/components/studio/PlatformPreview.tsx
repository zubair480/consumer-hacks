import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../../theme";
import { radius, space } from "../tokens";
import { platformMeta } from "./platforms";
import { studioText } from "./studioStyles";

export function PlatformPreview({ platform, text, name = "You" }: { platform: string; text: string; name?: string }) {
  const m = platformMeta(platform);
  const square = platform === "instagram" || platform === "tiktok";
  return (
    <View style={styles.card} testID={`preview-card-${platform}`}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: m.color }]}><Ionicons name="person-outline" size={18} color={m.fg} /></View>
        <View style={{ flex: 1 }}>
          <Text style={studioText.callout}>{name}</Text>
          <Text style={studioText.footnote}>{platform === "x" || platform === "threads" ? "@you · now" : "Just now"}</Text>
        </View>
        <Ionicons name={m.icon} size={22} color={palette.ink} />
      </View>
      {square ? (
        <View style={[styles.media, { aspectRatio: platform === "tiktok" ? 9 / 12 : 1, backgroundColor: m.color }]}>
          <Ionicons name={platform === "tiktok" ? "play-circle-outline" : "image-outline"} size={28} color={m.fg} />
          <Text style={[studioText.callout, { color: m.fg }]}>{platform === "tiktok" ? "Your video" : "Your photo"}</Text>
        </View>
      ) : null}
      <Text style={studioText.body} selectable>{text}</Text>
      <View style={styles.actions}>
        {(platform === "linkedin" ? ["thumbs-up-outline", "chatbubble-outline", "repeat-outline", "paper-plane-outline"] : ["heart-outline", "chatbubble-outline", "repeat-outline", "share-outline"]).map((icon) => (
          <Ionicons key={icon} name={icon as "heart-outline"} size={18} color="#5B5B63" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, borderColor: palette.hairline, backgroundColor: palette.white, padding: space.xl, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  media: { width: "100%", borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: space.sm },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: palette.hairline, paddingTop: space.md },
});
