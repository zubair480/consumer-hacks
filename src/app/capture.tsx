import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Animated, { FadeIn, FadeInRight, ZoomIn, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage, isValidLink, pickImages, uploadImage, type PickedImage } from "../components/media";
import { InkPill, ScalePressable, Text, pastelFor } from "../components/ui";
import { showToast } from "../components/ui/Toast";
import { useOwnedMutation } from "../identity/OwnerProvider";
import type { ContentType } from "../shared/contracts";
import { colors, fonts, gradients, palette } from "../theme";

type Mode = "url" | "text" | "image";

const INK2 = "#5B5B63";
const INK3 = "#9A9AA3";
const BOUNCY = { damping: 12, stiffness: 220 };
const E2 = { shadowColor: "#111111", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 };

const MODES: { key: Mode; label: string; icon: "link" | "document-text" | "image"; color: string }[] = [
  { key: "url", label: "Link", icon: "link", color: palette.lavender },
  { key: "text", label: "Text", icon: "document-text", color: palette.butter },
  { key: "image", label: "Photo", icon: "image", color: palette.mint },
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
const isMode = (m?: string): m is Mode => m === "url" || m === "text" || m === "image";

const t = (family: string, size: number, lineHeight: number, color: string = colors.text) => ({ fontFamily: family, fontSize: size, lineHeight, color });

export default function Capture() {
  const { example, mode: modeParam } = useLocalSearchParams<{ example?: string; mode?: string }>();
  const preset = EXAMPLES.find((ex) => ex.key === example);
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>(preset?.mode ?? (isMode(modeParam) ? modeParam : "url"));
  const [url, setUrl] = useState(preset?.mode === "url" ? preset.value : "");
  const [text, setText] = useState(preset?.mode === "text" ? preset.value : "");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typing = useRef<{ mode: Mode; value: string; timer: ReturnType<typeof setInterval> } | null>(null);
  const create = useOwnedMutation(api.items.create);
  const getUploadUrl = useOwnedMutation(api.items.generateUploadUrl);

  const trimmedText = text.trim();
  const canSave = mode === "url" ? url.trim().length > 0 : mode === "text" ? trimmedText.length >= MIN_TEXT : images.length > 0;
  const saving = progress !== null;

  const stopTyping = () => {
    const current = typing.current;
    if (!current) return null;
    clearInterval(current.timer);
    typing.current = null;
    if (current.mode === "url") setUrl(current.value);
    else setText(current.value);
    return current;
  };
  useEffect(() => () => {
    if (typing.current) clearInterval(typing.current.timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setLinkInvalid(false);
  };

  const selectMode = (m: Mode) => {
    if (m !== mode) Haptics.selectionAsync().catch(() => {});
    stopTyping();
    switchMode(m);
  };

  const typeExample = (ex: (typeof EXAMPLES)[number]) => {
    stopTyping();
    Haptics.selectionAsync().catch(() => {});
    switchMode(ex.mode);
    const setValue = ex.mode === "url" ? setUrl : setText;
    if (reduce) return setValue(ex.value);
    let n = 0;
    setValue("");
    const timer = setInterval(() => {
      n = Math.min(ex.value.length, n + 2);
      setValue(ex.value.slice(0, n));
      if (n >= ex.value.length && typing.current?.timer === timer) {
        clearInterval(timer);
        typing.current = null;
      }
    }, 24);
    typing.current = { mode: ex.mode, value: ex.value, timer };
  };

  const paste = async () => {
    stopTyping();
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
    const typed = stopTyping();
    const currentUrl = typed?.mode === "url" ? typed.value : url;
    const currentText = typed?.mode === "text" ? typed.value : text;
    const saveMode: Mode = asText !== undefined ? "text" : mode;
    const saveText = (asText ?? currentText).trim();
    if (saveMode === "url" && !isValidLink(currentUrl)) {
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
        setProgress("Working…");
        firstId = await create({ sourceUrl: saveMode === "url" ? currentUrl.trim() : undefined, rawText: saveMode === "text" ? saveText : undefined });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast("Saved to Zapy");
      if (images.length > 1 && saveMode === "image") router.replace("/library");
      else if (firstId) router.replace({ pathname: "/item/[id]", params: { id: firstId } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const cardEnter = reduce ? FadeIn.duration(200) : FadeInRight.duration(200).withInitialValues({ opacity: 0, transform: [{ translateX: 16 }] });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <LinearGradient pointerEvents="none" colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.holo, { opacity: gradients.holoOpacity }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0)", colors.background]} style={styles.holo} />
      <View style={styles.header}>
        <ScalePressable testID="capture-close-button" accessibilityRole="button" accessibilityLabel="Close" scaleTo={0.97} onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </ScalePressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={{ gap: 12 }}>
          <InkPill label="Save" />
          <View accessibilityRole="header" accessibilityLabel="What did you find?">
            <Text style={styles.display}>WHAT DID</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={styles.display}>YOU</Text>
              <View style={styles.marker}>
                <Text style={styles.display}>FIND?</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tiles}>
          {MODES.map((m) => (
            <ModeTile key={m.key} mode={m} selected={mode === m.key} onPress={() => selectMode(m.key)} />
          ))}
        </View>

        {mode === "url" ? (
          <Animated.View key="url" entering={cardEnter} style={styles.gap}>
            <InputCard testID="url-input" placeholder="https://github.com/…" value={url} onChangeText={(v) => { stopTyping(); setUrl(v); setLinkInvalid(false); setError(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" onSubmitEditing={() => canSave && save()} />
            {linkInvalid ? (
              <View style={styles.error} testID="invalid-link-error">
                <View style={styles.row}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>Couldn’t read this link. Paste the text instead</Text>
                </View>
                <View style={styles.row}>
                  <ScalePressable testID="save-as-text-button" scaleTo={0.97} onPress={() => { setText(url); switchMode("text"); void save(url); }} style={styles.secondary}>
                    <Ionicons name="document-text-outline" size={16} color={colors.text} />
                    <Text style={styles.secondaryText}>Save as text instead</Text>
                  </ScalePressable>
                  <ScalePressable testID="edit-link-button" scaleTo={0.97} onPress={() => setLinkInvalid(false)} style={styles.secondary}>
                    <Ionicons name="create-outline" size={16} color={colors.text} />
                    <Text style={styles.secondaryText}>Edit link</Text>
                  </ScalePressable>
                </View>
              </View>
            ) : (
              <Text style={styles.hint}>GitHub repos, scholarships, restaurants, recipes, articles, posts.</Text>
            )}
          </Animated.View>
        ) : null}

        {mode === "text" ? (
          <Animated.View key="text" entering={cardEnter} style={styles.gap}>
            <InputCard testID="text-input" placeholder="Paste a caption, a scholarship post, a snippet of code…" value={text} onChangeText={(v) => { stopTyping(); setText(v); setError(null); }} multiline tall />
            <Text style={styles.hint}>{trimmedText.length < MIN_TEXT ? `At least ${MIN_TEXT} characters` : `${trimmedText.length} characters`}</Text>
          </Animated.View>
        ) : null}

        {mode === "image" ? (
          <Animated.View key="image" entering={cardEnter} style={styles.gap}>
            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {images.map((img, i) => (
                  <View key={img.uri}>
                    <Image source={{ uri: img.uri }} style={styles.preview} testID={`capture-image-preview-${i}`} />
                    <ScalePressable testID={`remove-image-button-${i}`} accessibilityLabel="Remove photo" onPress={() => setImages((p) => p.filter((_, j) => j !== i))} style={styles.remove}>
                      <Ionicons name="close" size={16} color={colors.onPrimary} />
                    </ScalePressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.row}>
              <PickTile testID="pick-image-button" icon="images-outline" label={images.length ? "Add more" : "Choose photos"} onPress={() => choose("library")} />
              <PickTile testID="take-photo-button" icon="camera-outline" label="Take photo" onPress={() => choose("camera")} />
            </View>
          </Animated.View>
        ) : null}

        <ScalePressable testID="paste-button" accessibilityRole="button" accessibilityLabel="Paste from clipboard" scaleTo={0.97} onPress={paste} style={styles.paste}>
          <Ionicons name="clipboard-outline" size={18} color={colors.text} />
          <Text style={styles.secondaryText}>Paste from clipboard</Text>
        </ScalePressable>

        {error ? (
          <View style={[styles.error, styles.row]} testID="capture-error">
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={t(fonts.extraBold, 18, 24)}>Try an example</Text>
          <View style={styles.examples}>
            {EXAMPLES.map((ex) => (
              <ScalePressable key={ex.key} testID={`example-${ex.key}`} accessibilityRole="button" accessibilityLabel={ex.label} scaleTo={0.9} onPress={() => typeExample(ex)} style={[styles.chip, { backgroundColor: pastelFor(ex.type) }]}>
                <Text style={t(fonts.bold, 12, 16)}>{ex.label}</Text>
              </ScalePressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <SaveButton enabled={canSave} loading={saving} label={progress ?? "Save"} onPress={() => save()} />
      </View>
    </SafeAreaView>
  );
}

function ModeTile({ mode, selected, onPress }: { mode: (typeof MODES)[number]; selected: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    s.set(reduce ? withTiming(selected ? 1 : 0, { duration: 200 }) : withSpring(selected ? 1 : 0, BOUNCY));
  }, [selected, reduce, s]);
  const a = useAnimatedStyle(() => ({ opacity: 0.7 + 0.3 * Math.min(1, s.value), transform: [{ scale: reduce ? 1 : 1 + 0.03 * s.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, a]}>
      <Pressable testID={`capture-mode-${mode.key}`} accessibilityRole="tab" accessibilityLabel={mode.label} accessibilityState={{ selected }} onPress={onPress} style={[styles.tile, { backgroundColor: mode.color }, selected && styles.tileSelected]}>
        <View style={[styles.tileIcon, selected && { backgroundColor: colors.primary }]}>
          <Ionicons name={mode.icon} size={28} color={selected ? colors.onPrimary : colors.text} />
        </View>
        <Text style={t(fonts.extraBold, 14, 18)}>{mode.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function InputCard({ tall, onFocus, onBlur, ...rest }: TextInputProps & { testID: string; tall?: boolean }) {
  const f = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ borderWidth: 1 + 0.5 * f.value, borderColor: interpolateColor(f.value, [0, 1], [palette.hairline, palette.ink]), shadowOpacity: 0.06 * f.value, elevation: f.value > 0.5 ? 2 : 0 }));
  return (
    <Animated.View style={[styles.inputCard, a]}>
      <TextInput
        {...rest}
        placeholderTextColor={INK3}
        selectionColor={colors.primary}
        keyboardAppearance="light"
        textAlignVertical={tall ? "top" : "center"}
        onFocus={(e) => {
          f.set(withTiming(1, { duration: 120 }));
          onFocus?.(e);
        }}
        onBlur={(e) => {
          f.set(withTiming(0, { duration: 120 }));
          onBlur?.(e);
        }}
        style={[styles.input, tall && { minHeight: 180 }]}
      />
    </Animated.View>
  );
}

function SaveButton({ enabled, loading, label, onPress }: { enabled: boolean; loading: boolean; label: string; onPress: () => void }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(enabled ? 1 : 0.25);
  const s = useSharedValue(1);
  const press = useSharedValue(1);
  const was = useRef(enabled);
  useEffect(() => {
    o.set(withTiming(enabled ? 1 : 0.25, { duration: 200 }));
    if (enabled && !was.current && !reduce) {
      s.set(0.97);
      s.set(withSpring(1, BOUNCY));
    }
    was.current = enabled;
  }, [enabled, reduce, o, s]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value * press.value }] }));
  const live = enabled && !loading;
  return (
    <Pressable
      testID="save-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !live, busy: loading }}
      disabled={!live}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      onPressIn={() => !reduce && press.set(withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => !reduce && press.set(withSpring(1, { damping: 18, stiffness: 320 }))}
    >
      <Animated.View style={[styles.save, enabled && !loading ? styles.saveShadow : null, a]}>
        <Text style={t(fonts.bold, 15, 20, colors.onPrimary)}>{label}</Text>
        {loading ? (
          <View style={styles.saveCircle}>
            <ActivityIndicator size="small" color={colors.text} />
          </View>
        ) : enabled ? (
          <Animated.View entering={reduce ? FadeIn.duration(200) : ZoomIn.springify().damping(BOUNCY.damping).stiffness(BOUNCY.stiffness)} style={styles.saveCircle}>
            <Ionicons name="arrow-forward" size={18} color={colors.text} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function PickTile({ testID, icon, label, onPress }: { testID: string; icon: "images-outline" | "camera-outline"; label: string; onPress: () => void }) {
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97} onPress={onPress} style={styles.pick}>
      <Ionicons name={icon} size={28} color={colors.text} />
      <Text style={[t(fonts.bold, 14, 20), { textAlign: "center" }]}>{label}</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  holo: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  header: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 8 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: palette.hairline, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 28 },
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: -0.5, color: colors.text },
  marker: { backgroundColor: palette.butter, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, transform: [{ rotate: "-1.5deg" }] },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { height: 104, borderRadius: 22, padding: 12, justifyContent: "space-between", borderWidth: 2, borderColor: "transparent" },
  tileSelected: { borderColor: colors.text, ...E2 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" },
  gap: { gap: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputCard: { backgroundColor: colors.surface, borderRadius: 20, shadowColor: "#111111", shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  input: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text, paddingHorizontal: 20, paddingVertical: 16, minHeight: 56 },
  hint: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: INK2 },
  preview: { width: 120, height: 160, borderRadius: 20, backgroundColor: palette.grey },
  remove: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  pick: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderColor: palette.hairline, backgroundColor: colors.surface },
  paste: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 16, height: 44, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.text },
  secondary: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.text },
  secondaryText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  error: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: palette.hairline },
  errorText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.danger, flex: 1 },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.background },
  save: { height: 54, borderRadius: 999, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  saveShadow: { shadowColor: "#111111", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  saveCircle: { position: "absolute", right: 9, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
