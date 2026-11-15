import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Field } from "../components/Field";
import { errorMessage, isValidLink, pickImages, uploadImage, type PickedImage } from "../components/media";
import { Tap } from "../components/Pressable";
import { colors, radius, space, type } from "../components/tokens";
import { Button, DisplayTitle, HoloBand, TypeChip } from "../components/ui";
import { useOwnedMutation } from "../identity/OwnerProvider";
import type { ContentType } from "../shared/contracts";

type Mode = "url" | "text" | "image";

const MODES: { key: Mode; label: string; icon: "link" | "document-text" | "image" }[] = [
  { key: "url", label: "Link", icon: "link" },
  { key: "text", label: "Text", icon: "document-text" },
  { key: "image", label: "Photo", icon: "image" },
];

const EXAMPLES: { key: string; label: string; type: ContentType; mode: Mode; value: string }[] = [
  { key: "github", label: "GitHub repo", type: "github_repository", mode: "url", value: "https://github.com/expo/expo" },
  {
    key: "scholarship",
    label: "Scholarship",
    type: "scholarship",
    mode: "text",
    value:
      "The Coca-Cola Scholars Program awards $20,000 to 150 high school seniors each year. Applicants must be current U.S. high school seniors with a minimum 3.0 unweighted GPA who show leadership and service in their community. Apply online at coca-colascholarsfoundation.org. Applications close January 31, 2027.",
  },
  { key: "restaurant", label: "Restaurant", type: "restaurant", mode: "url", value: "https://www.tartinebakery.com" },
];

const MIN_TEXT = 10;

export default function Capture() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useOwnedMutation(api.items.create);
  const getUploadUrl = useOwnedMutation(api.items.generateUploadUrl);

  const trimmedText = text.trim();
  const canSave = mode === "url" ? url.trim().length > 0 : mode === "text" ? trimmedText.length >= MIN_TEXT : images.length > 0;
  const saving = progress !== null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setLinkInvalid(false);
  };

  const paste = async () => {
    const value = (await Clipboard.getStringAsync().catch(() => "")).trim();
    if (!value) return setError("Your clipboard is empty.");
    if (isValidLink(value) && !/\s/.test(value)) {
      switchMode("url");
      setUrl(value);
    } else {
      switchMode("text");
      setText(value);
    }
  };

  const choose = async (source: "library" | "camera") => {
    try {
      const picked = await pickImages(source, source === "library");
      if (picked.length) {
        setImages((prev) => [...prev, ...picked].slice(0, 5));
        switchMode("image");
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = async (asText?: string) => {
    Keyboard.dismiss();
    setError(null);
    const saveMode: Mode = asText !== undefined ? "text" : mode;
    const saveText = (asText ?? text).trim();
    if (saveMode === "url" && !isValidLink(url)) {
      setLinkInvalid(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (saveMode === "text" && saveText.length < MIN_TEXT) return setError(`Add at least ${MIN_TEXT} characters.`);
    try {
      let firstId: string | null = null;
      if (saveMode === "image") {
        for (const [i, image] of images.entries()) {
          setProgress(images.length > 1 ? `Uploading ${i + 1} of ${images.length}…` : "Uploading photo…");
          const imageStorageId = (await uploadImage(image, () => getUploadUrl({}))) as Id<"_storage">;
          const id = await create({ imageStorageId });
          firstId ??= id;
        }
      } else {
        setProgress("Saving…");
        firstId = await create({ sourceUrl: saveMode === "url" ? url.trim() : undefined, rawText: saveMode === "text" ? saveText : undefined });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (images.length > 1 && saveMode === "image") router.replace("/library");
      else if (firstId) router.replace({ pathname: "/item/[id]", params: { id: firstId } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <HoloBand height={240} />
      <View style={styles.header}>
        <Tap testID="capture-close-button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Tap>
        <Tap testID="capture-header-save-button" accessibilityRole="button" accessibilityLabel="Save" disabled={!canSave || saving} onPress={() => save()} style={[styles.headerSave, (!canSave || saving) && { opacity: 0.4 }]}>
          <Text style={styles.headerSaveText}>Save</Text>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <DisplayTitle>Save something</DisplayTitle>
        <View style={styles.segment}>
          {MODES.map((m) => (
            <Tap key={m.key} testID={`capture-mode-${m.key}`} accessibilityRole="tab" accessibilityLabel={m.label} accessibilityState={{ selected: mode === m.key }} onPress={() => switchMode(m.key)} style={[styles.segmentItem, mode === m.key && styles.segmentActive]}>
              <Ionicons name={m.icon} size={16} color={mode === m.key ? colors.surface : colors.textMuted} />
              <Text style={[styles.segmentText, mode === m.key && { color: colors.surface }]}>{m.label}</Text>
            </Tap>
          ))}
        </View>

        {mode === "url" ? (
          <View style={styles.gap}>
            <Field testID="url-input" placeholder="https://github.com/…" value={url} onChangeText={(v) => { setUrl(v); setLinkInvalid(false); setError(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" keyboardAppearance="light" style={styles.inputCard} returnKeyType="done" onSubmitEditing={() => canSave && save()} />
            {linkInvalid ? (
              <View style={styles.error} testID="invalid-link-error">
                <View style={styles.row}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>That doesn’t look like a link</Text>
                </View>
                <View style={styles.row}>
                  <Tap testID="save-as-text-button" onPress={() => { setText(url); switchMode("text"); void save(url); }} style={styles.fallbackBtn}>
                    <Ionicons name="document-text" size={16} color={colors.text} />
                    <Text style={styles.fallbackText}>Save as text instead</Text>
                  </Tap>
                  <Tap testID="edit-link-button" onPress={() => setLinkInvalid(false)} style={styles.fallbackBtn}>
                    <Ionicons name="create-outline" size={16} color={colors.text} />
                    <Text style={styles.fallbackText}>Edit link</Text>
                  </Tap>
                </View>
              </View>
            ) : (
              <Text style={type.caption}>GitHub repos, scholarships, restaurants, recipes, articles, posts.</Text>
            )}
          </View>
        ) : null}

        {mode === "text" ? (
          <View style={styles.gap}>
            <Field testID="text-input" placeholder="Paste a caption, a scholarship post, a snippet of code…" value={text} onChangeText={(v) => { setText(v); setError(null); }} keyboardAppearance="light" style={[styles.inputCard, styles.inputTall]} multiline />
            <Text style={[type.caption, trimmedText.length > 0 && trimmedText.length < MIN_TEXT && { color: colors.warning }]}>
              {trimmedText.length < MIN_TEXT ? `At least ${MIN_TEXT} characters` : `${trimmedText.length} characters`}
            </Text>
          </View>
        ) : null}

        {mode === "image" ? (
          <View style={styles.gap}>
            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {images.map((img, i) => (
                  <View key={img.uri}>
                    <Image source={{ uri: img.uri }} style={styles.preview} testID={`capture-image-preview-${i}`} />
                    <Tap testID={`remove-image-button-${i}`} accessibilityLabel="Remove photo" onPress={() => setImages((p) => p.filter((_, j) => j !== i))} style={styles.remove}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </Tap>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.row}>
              <PickTile testID="pick-image-button" icon="images" label={images.length ? "Add more" : "Choose screenshots or photos"} onPress={() => choose("library")} />
              <PickTile testID="take-photo-button" icon="camera" label="Take photo" onPress={() => choose("camera")} />
            </View>
          </View>
        ) : null}

        <Tap testID="paste-button" accessibilityLabel="Paste from clipboard" onPress={paste} style={styles.paste}>
          <Ionicons name="clipboard-outline" size={16} color={colors.text} />
          <Text style={styles.pasteText}>Paste from clipboard</Text>
        </Tap>

        {error ? (
          <View style={[styles.error, styles.row]} testID="capture-error">
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.gap}>
          <Text style={type.label}>Try an example</Text>
          <View style={styles.examples}>
            {EXAMPLES.map((ex) => (
              <TypeChip
                key={ex.key}
                testID={`example-${ex.key}`}
                label={ex.label}
                type={ex.type}
                onPress={() => {
                  switchMode(ex.mode);
                  if (ex.mode === "url") setUrl(ex.value);
                  else setText(ex.value);
                }}
              />
            ))}
          </View>
        </View>

      </ScrollView>
      <View style={styles.footer}>
        <Button testID="save-button" title={progress ?? "Save"} icon="bookmark" onPress={() => save()} loading={saving} disabled={!canSave} fullWidth />
      </View>
    </SafeAreaView>
  );
}

function PickTile({ testID, icon, label, onPress }: { testID: string; icon: "images" | "camera"; label: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tile}>
      <Ionicons name={icon} size={26} color={colors.text} />
      <Text style={styles.tileText}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingVertical: space.md },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerSave: { paddingHorizontal: 18, height: 44, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.text },
  headerSaveText: { color: colors.surface, fontWeight: "700" },
  content: { padding: space.xl, gap: space.md, paddingBottom: 40 },
  gap: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border, marginTop: space.sm },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 44, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.text },
  segmentText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  inputCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: space.xl, fontSize: 16 },
  inputTall: { minHeight: 180 },
  tile: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileText: { color: colors.text, fontWeight: "600", textAlign: "center", paddingHorizontal: space.sm },
  preview: { width: 120, height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  remove: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  paste: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: space.lg, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pasteText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  error: { gap: space.sm, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.danger + "14", borderWidth: 1, borderColor: colors.danger + "44" },
  errorText: { color: colors.danger, fontWeight: "700", flex: 1 },
  fallbackBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fallbackText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
});
