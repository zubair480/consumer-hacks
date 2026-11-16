import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Animated, { FadeInRight, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useCalendarConnect } from "../components/agents/CalendarAgent";
import { ZapMark } from "../components/brand/ZapMark";
import { errorMessage } from "../components/media";
import { HoloBand, ScalePressable, Text } from "../components/ui";
import { showToast } from "../components/ui/Toast";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../identity/OwnerProvider";
import { colors, fonts, palette } from "../theme";

type Key = "name" | "educationLevel" | "fieldOfStudy" | "country" | "citizenship" | "gpa" | "city";
type Question = { key: Key; title: string; placeholder?: string; chips?: string[]; optional?: boolean; input?: TextInputProps };

const QUESTIONS: Question[] = [
  { key: "name", title: "What’s your name?", placeholder: "Your name", input: { autoCapitalize: "words", textContentType: "name", autoComplete: "name" } },
  { key: "educationLevel", title: "Where are you in school?", chips: ["High school", "Undergraduate", "Graduate", "Not a student"] },
  { key: "fieldOfStudy", title: "What are you studying?", placeholder: "e.g. Computer Science", input: { autoCapitalize: "words" } },
  { key: "country", title: "Which country do you live in?", placeholder: "e.g. United States", input: { autoCapitalize: "words", textContentType: "countryName" } },
  { key: "citizenship", title: "What’s your citizenship?", placeholder: "e.g. United States", input: { autoCapitalize: "words" } },
  { key: "gpa", title: "What’s your GPA?", placeholder: "e.g. 3.6", optional: true, input: { keyboardType: "decimal-pad" } },
  { key: "city", title: "Which city?", placeholder: "e.g. San Francisco", optional: true, input: { autoCapitalize: "words", textContentType: "addressCity" } },
];
const ACCOUNT = QUESTIONS.length + 1;
const CALENDAR = QUESTIONS.length + 2;
const TOTAL = CALENDAR;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

/** First-launch flow: Start, one question per screen, Complete your account, Connect your calendar, then /pull. */
export default function Welcome() {
  const reduce = useReducedMotion();
  const profile = useOwnedQuery(api.preferences.get, {});
  const upsert = useOwnedMutation(api.preferences.upsert);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<Key, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setAnswers((a) => {
      const next = { ...a };
      for (const q of QUESTIONS) if (next[q.key] === undefined && profile[q.key] != null) next[q.key] = String(profile[q.key]);
      return next;
    });
  }, [profile]);

  const go = (to: number) => {
    setError(null);
    setStep(to);
  };

  const save = (args: Parameters<typeof upsert>[0]) => upsert(args).catch((e) => showToast(errorMessage(e)));

  if (step === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="welcome-screen">
        <HoloBand height={140} />
        <View style={styles.center}>
          <ZapMark size={96} />
          <Text style={styles.wordmark}>Zapy</Text>
          <Text style={styles.sub}>Your saves, done.</Text>
        </View>
        <View style={styles.bottom}>
          <InkButton
            testID="onboarding-start"
            label="Start"
            onPress={() => {
              save({});
              go(1);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const q = step <= QUESTIONS.length ? QUESTIONS[step - 1] : undefined;
  const value = q ? (answers[q.key] ?? "") : "";

  const next = () => {
    if (!q) return;
    const text = value.trim();
    if (q.key === "gpa") {
      const gpa = Number(text);
      if (!text || Number.isNaN(gpa) || gpa < 0 || gpa > 10) return setError("Enter a GPA between 0 and 10.");
      save({ gpa });
    } else {
      if (!text) return;
      save({ [q.key]: text });
    }
    go(step + 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID={`onboarding-step-${step}`}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.top}>
          <Pressable testID="onboarding-back" accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => go(step - 1)} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View testID="onboarding-progress" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: TOTAL, now: step }} style={styles.track}>
            <View style={[styles.fill, { width: `${(step / TOTAL) * 100}%` }]} />
          </View>
          <Text style={styles.count}>
            {step} of {TOTAL}
          </Text>
        </View>
        <Animated.View key={step} entering={reduce ? undefined : FadeInRight.duration(220)} style={{ flex: 1 }}>
          {q ? (
            <>
              <View style={styles.body}>
                <Text style={styles.title}>{q.title}</Text>
                {q.chips ? (
                  <View style={styles.chips}>
                    {q.chips.map((c) => {
                      const on = value === c;
                      return (
                        <ScalePressable key={c} testID={`onboarding-chip-${slug(c)}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={c} haptic scaleTo={0.96} onPress={() => setAnswers((a) => ({ ...a, [q.key]: c }))} style={[styles.chip, on && styles.chipOn]}>
                          <Text style={[styles.chipText, on && { color: colors.onPrimary }]}>{c}</Text>
                        </ScalePressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    key={q.key}
                    testID="onboarding-input"
                    autoFocus
                    value={value}
                    onChangeText={(t) => {
                      setError(null);
                      setAnswers((a) => ({ ...a, [q.key]: t }));
                    }}
                    placeholder={q.placeholder}
                    placeholderTextColor="#9A9AA3"
                    returnKeyType="next"
                    onSubmitEditing={next}
                    style={styles.input}
                    {...q.input}
                  />
                )}
                {error ? (
                  <Text testID="onboarding-error" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                {q.optional ? (
                  <Pressable testID="onboarding-skip" accessibilityRole="button" accessibilityLabel="Skip" hitSlop={8} onPress={() => go(step + 1)} style={styles.skip}>
                    <Text style={styles.skipText}>Skip</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.bottom}>
                <InkButton testID="onboarding-next" label="Next" disabled={!value.trim()} onPress={next} />
              </View>
            </>
          ) : step === ACCOUNT ? (
            <AccountStep onDone={() => go(CALENDAR)} />
          ) : (
            <CalendarStep onDone={() => router.replace("/pull")} />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const ownerId = useOwnerId();
  const profile = useOwnedQuery(api.preferences.get, {});
  const github = useOwnedQuery(api.imports.github.status, {});
  const sources = useOwnedQuery(api.imports.connections.sources, {});
  const upsert = useOwnedMutation(api.preferences.upsert);
  const startXConnect = useAction(api.imports.connections.startXConnect);
  const syncGitHub = useAction(api.imports.github.sync);
  const [draft, setDraft] = useState<{ email?: string; phone?: string; github?: string }>({});
  const [busy, setBusy] = useState<"x" | "continue" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const x = sources?.find((s) => s.platform === "x");
  const email = draft.email ?? profile?.email ?? "";
  const phone = draft.phone ?? profile?.phone ?? "";
  const username = draft.github ?? github?.username ?? "";

  const connectX = async () => {
    setBusy("x");
    setNote(null);
    try {
      const returnUrl = Linking.createURL("welcome");
      const { authorizeUrl } = await startXConnect({ ownerId, returnUrl });
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
      if (result.type === "success") {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.x !== "connected") setNote(typeof queryParams?.message === "string" ? queryParams.message : "Couldn't connect X.");
      }
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const proceed = async () => {
    setBusy("continue");
    setNote(null);
    try {
      await upsert({ email, phone });
      const name = username.trim();
      if (name && name !== github?.username) await syncGitHub({ ownerId, username: name });
      onDone();
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete your account</Text>
        <TextInput testID="account-email" value={email} onChangeText={(t) => setDraft((d) => ({ ...d, email: t }))} placeholder="Email" placeholderTextColor="#9A9AA3" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" style={styles.field} />
        <TextInput testID="account-phone" value={phone} onChangeText={(t) => setDraft((d) => ({ ...d, phone: t }))} placeholder="Phone number" placeholderTextColor="#9A9AA3" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" style={styles.field} />
        <ScalePressable testID="account-connect-x" accessibilityRole="button" accessibilityLabel={x?.connected ? "X connected" : "Connect X"} haptic scaleTo={0.97} disabled={!x?.configured || x.connected || busy !== null} onPress={connectX} style={[styles.outline, x?.connected && styles.outlineDone]}>
          {busy === "x" ? <ActivityIndicator color={colors.text} /> : <Ionicons name="logo-x" size={18} color={colors.text} />}
          <Text style={styles.outlineText}>{x?.connected ? "X connected ✓" : x && !x.configured ? "X isn’t available yet" : "Connect X"}</Text>
        </ScalePressable>
        <View style={styles.inputRow}>
          <Ionicons name="logo-github" size={20} color={colors.text} />
          <TextInput testID="account-github" value={username} onChangeText={(t) => setDraft((d) => ({ ...d, github: t }))} placeholder="GitHub username" placeholderTextColor="#9A9AA3" autoCapitalize="none" autoCorrect={false} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 17, color: colors.text }} />
        </View>
        {note ? (
          <Text testID="account-note" style={styles.error}>
            {note}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.bottom}>
        <InkButton testID="account-continue" label="Continue" busy={busy === "continue"} disabled={busy !== null} onPress={proceed} />
      </View>
    </>
  );
}

function CalendarStep({ onDone }: { onDone: () => void }) {
  const { configured, connected, busy, note, connect } = useCalendarConnect("welcome");
  return (
    <>
      <View style={styles.body}>
        <Text style={styles.title}>Connect your calendar</Text>
        <Text style={styles.sub2}>Zapy adds events you save to your Google Calendar, after you approve them.</Text>
        <ScalePressable testID="calendar-connect" accessibilityRole="button" accessibilityLabel={connected ? "Calendar connected" : "Connect Google Calendar"} haptic scaleTo={0.97} disabled={!configured || !!connected || busy} onPress={connect} style={[styles.outline, connected && styles.outlineDone]}>
          {busy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="calendar-outline" size={18} color={colors.text} />}
          <Text style={styles.outlineText}>{connected ? "Calendar connected ✓" : configured === false ? "Calendar isn’t available yet" : "Connect Google Calendar"}</Text>
        </ScalePressable>
        {note ? (
          <Text testID="calendar-note" style={styles.error}>
            {note}
          </Text>
        ) : null}
      </View>
      <View style={styles.bottom}>
        {connected ? (
          <InkButton testID="calendar-skip" label="Continue" onPress={onDone} />
        ) : (
          <Pressable testID="calendar-skip" accessibilityRole="button" accessibilityLabel="Not now" hitSlop={8} onPress={onDone} style={styles.skip}>
            <Text style={styles.skipText}>Not now</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

function InkButton({ testID, label, onPress, disabled, busy }: { testID: string; label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} haptic scaleTo={0.97} disabled={disabled} onPress={onPress} style={[styles.ink, disabled && !busy && { opacity: 0.35 }]}>
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.inkText}>{label}</Text>}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 20 },
  wordmark: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: -1, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 24, color: palette.text2, textAlign: "center" },
  sub2: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: palette.text2 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingTop: 8 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.grey, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: palette.ink },
  count: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: palette.text2, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "right", paddingRight: 8 },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 32, gap: 20 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.5, color: colors.text },
  input: { height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 20, fontFamily: fonts.medium, fontSize: 20, color: colors.text, backgroundColor: colors.surface },
  field: { height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 20, fontFamily: fonts.medium, fontSize: 17, color: colors.text, backgroundColor: colors.surface },
  inputRow: { height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface },
  chips: { gap: 10 },
  chip: { height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: colors.text, paddingHorizontal: 20, justifyContent: "center", backgroundColor: colors.surface },
  chipOn: { backgroundColor: palette.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.text },
  outline: { height: 56, borderRadius: 999, borderWidth: 1.5, borderColor: colors.text, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.surface },
  outlineDone: { backgroundColor: palette.mint, borderColor: palette.mint },
  outlineText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  error: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.danger },
  skip: { height: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text, textDecorationLine: "underline" },
  bottom: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8, minHeight: 72, justifyContent: "center" },
  ink: { height: 56, borderRadius: 999, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  inkText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.onPrimary },
});
