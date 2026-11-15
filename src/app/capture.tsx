import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Field } from "../components/Field";
import { GradientButton } from "../components/GradientButton";
import { errorMessage, pickImage, uploadImage, type PickedImage } from "../components/media";
import { Tap } from "../components/Pressable";
import { colors, radius, space, type } from "../components/tokens";
import { useOwnedMutation } from "../identity/OwnerProvider";

type Mode = "url" | "text" | "image";

const MODES: { key: Mode; label: string; icon: "link" | "document-text" | "image" }[] = [
  { key: "url", label: "Link", icon: "link" },
  { key: "text", label: "Text", icon: "document-text" },
  { key: "image", label: "Image", icon: "image" },
];

export default function Capture() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useOwnedMutation(api.items.create);
  const getUploadUrl = useOwnedMutation(api.items.generateUploadUrl);

  const canSave = mode === "url" ? url.trim().length > 0 : mode === "text" ? text.trim().length > 0 : image !== null;

  const paste = async () => {
    const value = (await Clipboard.getStringAsync()).trim();
    if (!value) return;
    if (/^(https?:\/\/|www\.)\S+$/i.test(value)) {
      setMode("url");
      setUrl(value);
    } else {
      setMode("text");
      setText(value);
    }
    setError(null);
  };

  const choose = async (source: "library" | "camera") => {
    try {
      const picked = await pickImage(source);
      if (picked) {
        setImage(picked);
        setMode("image");
        setError(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const imageStorageId = mode === "image" && image ? ((await uploadImage(image, () => getUploadUrl({}))) as Id<"_storage">) : undefined;
      const itemId = await create({
        sourceUrl: mode === "url" ? url.trim() : undefined,
        rawText: mode === "text" ? text.trim() : undefined,
        imageStorageId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: "/item/[id]", params: { id: itemId } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={type.title}>Save something</Text>
          <Tap testID="capture-close-button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Tap>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.segment}>
            {MODES.map((m) => (
              <Tap key={m.key} testID={`capture-mode-${m.key}`} accessibilityRole="tab" accessibilityState={{ selected: mode === m.key }} onPress={() => { setMode(m.key); setError(null); }} style={[styles.segmentItem, mode === m.key && styles.segmentActive]}>
                <Ionicons name={m.icon} size={16} color={mode === m.key ? colors.text : colors.textMuted} />
                <Text style={[styles.segmentText, mode === m.key && { color: colors.text }]}>{m.label}</Text>
              </Tap>
            ))}
          </View>

          {mode === "url" ? (
            <View style={styles.gap}>
              <Field testID="url-input" placeholder="https://github.com/…" value={url} onChangeText={(v) => { setUrl(v); setError(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" onSubmitEditing={() => canSave && save()} autoFocus />
              <Text style={type.caption}>GitHub repos, scholarships, restaurants, recipes, articles, posts.</Text>
            </View>
          ) : null}

          {mode === "text" ? (
            <View style={styles.gap}>
              <Field testID="text-input" placeholder="Paste a caption, a job post, a snippet of code…" value={text} onChangeText={(v) => { setText(v); setError(null); }} multiline autoFocus />
            </View>
          ) : null}

          {mode === "image" ? (
            <View style={styles.gap}>
              {image ? (
                <View>
                  <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" testID="capture-image-preview" />
                  <Tap testID="remove-image-button" accessibilityLabel="Remove image" onPress={() => setImage(null)} style={styles.remove}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Tap>
                </View>
              ) : (
                <View style={styles.pickRow}>
                  <PickTile testID="pick-image-button" icon="images" label="Choose screenshot or photo" onPress={() => choose("library")} />
                  <PickTile testID="take-photo-button" icon="camera" label="Take a photo" onPress={() => choose("camera")} />
                </View>
              )}
            </View>
          ) : null}

          <Tap testID="paste-button" accessibilityLabel="Paste from clipboard" onPress={paste} style={styles.paste}>
            <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
            <Text style={styles.pasteText}>Paste from clipboard</Text>
          </Tap>

          {error ? (
            <View style={styles.error} testID="capture-error">
              <View style={styles.errorHead}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
              {mode === "url" ? (
                <>
                  <Text style={type.caption}>Check the link, or save what you have another way and we’ll work with that.</Text>
                  <View style={styles.pickRow}>
                    <Tap testID="fallback-text-button" onPress={() => { setText(url); setMode("text"); setError(null); }} style={styles.fallbackBtn}>
                      <Ionicons name="document-text" size={16} color={colors.text} />
                      <Text style={styles.fallbackText}>Paste text instead</Text>
                    </Tap>
                    <Tap testID="fallback-screenshot-button" onPress={() => choose("library")} style={styles.fallbackBtn}>
                      <Ionicons name="image" size={16} color={colors.text} />
                      <Text style={styles.fallbackText}>Add a screenshot</Text>
                    </Tap>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <GradientButton testID="save-button" label="Save" icon="bookmark" onPress={save} loading={saving} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickTile({ testID, icon, label, onPress }: { testID: string; icon: "images" | "camera"; label: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tile}>
      <Ionicons name={icon} size={28} color={colors.accent} />
      <Text style={styles.tileText}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingVertical: space.md },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  content: { padding: space.xl, gap: space.lg },
  gap: { gap: space.sm },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surfaceRaised },
  segmentText: { color: colors.textMuted, fontWeight: "700" },
  pickRow: { flexDirection: "row", gap: space.md },
  tile: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.xxl, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent + "66", backgroundColor: colors.accent + "0D" },
  tileText: { color: colors.text, fontWeight: "600", textAlign: "center", paddingHorizontal: space.sm },
  preview: { width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: colors.surface },
  remove: { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  paste: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  pasteText: { color: colors.accent, fontWeight: "700" },
  error: { gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.danger + "14", borderWidth: 1, borderColor: colors.danger + "44" },
  errorHead: { flexDirection: "row", gap: 8, alignItems: "center" },
  errorText: { color: colors.danger, fontWeight: "700", flex: 1 },
  fallbackBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  fallbackText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  footer: { padding: space.xl, paddingTop: space.sm },
});
