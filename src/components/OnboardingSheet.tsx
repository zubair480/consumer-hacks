import * as Haptics from "expo-haptics";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInRight, useReducedMotion } from "react-native-reanimated";
import { api } from "../../convex/_generated/api";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { INTERESTS } from "../lib/useProfile";
import { colors, fonts, palette } from "../theme";
import { InkPill, ScalePressable, Text } from "./ui";

/** First-launch 2-step sheet: name, then interests. Skip is one tap; skipping or finishing marks the profile as onboarded. */
export function OnboardingSheet({ visible }: { visible: boolean }) {
  const reduce = useReducedMotion();
  const upsert = useOwnedMutation(api.preferences.upsert);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [closed, setClosed] = useState(false);

  const finish = (args: { name?: string; interests?: string[] }) => {
    setClosed(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    upsert(args).catch(() => {});
  };

  const toggle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };

  return (
    <Modal visible={visible && !closed} transparent animationType="slide" onRequestClose={() => finish({})} statusBarTranslucent>
      <View style={styles.scrim}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet} testID="onboarding-sheet">
            <View style={styles.top}>
              <InkPill label={`Step ${step} of 2`} />
              <Pressable testID="onboarding-skip" accessibilityRole="button" accessibilityLabel="Skip" hitSlop={8} onPress={() => finish(step === 2 && name.trim() ? { name } : {})} style={styles.skip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>
            {step === 1 ? (
              <Animated.View key="1" entering={FadeIn.duration(200)} style={{ gap: 16 }}>
                <Text style={styles.title}>What should we call you?</Text>
                <TextInput
                  testID="onboarding-name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your first name"
                  placeholderTextColor="#9A9AA3"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => setStep(2)}
                  keyboardAppearance="light"
                  selectionColor={colors.primary}
                  style={styles.input}
                />
                <InkButton testID="onboarding-continue" label="Continue" onPress={() => setStep(2)} />
              </Animated.View>
            ) : (
              <Animated.View key="2" entering={reduce ? FadeIn.duration(200) : FadeInRight.duration(280)} style={{ gap: 16 }}>
                <Text style={styles.title}>What do you save most?</Text>
                <View style={styles.chips}>
                  {INTERESTS.map((i) => {
                    const on = picked.includes(i.key);
                    return (
                      <ScalePressable key={i.key} testID={`onboarding-chip-${i.key}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={i.label} scaleTo={0.95} onPress={() => toggle(i.key)} style={[styles.chip, { backgroundColor: on ? colors.primary : i.color }]}>
                        <Text style={[styles.chipText, { color: on ? colors.onPrimary : colors.text }]}>{i.label}</Text>
                      </ScalePressable>
                    );
                  })}
                </View>
                <InkButton testID="onboarding-done" label="Done" onPress={() => finish({ name: name.trim() || undefined, interests: picked })} />
              </Animated.View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function InkButton({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97} haptic onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,17,17,0.4)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 20 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { height: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.text, justifyContent: "center" },
  skipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  title: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 30, color: colors.text },
  input: { height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 20, fontFamily: fonts.medium, fontSize: 16, color: colors.text, backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center" },
  chipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  button: { height: 54, borderRadius: 999, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.onPrimary },
});
