import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { OWNER_ID_STORAGE_KEY, type OwnerId } from "../shared/contracts";

// OWNER: Lead. Device-local identity: a UUID generated once with expo-crypto
// and kept in both a file in the app's document directory and expo-secure-store
// (localStorage on web). The file is read first, so a one-off keychain error never
// mints a new id. Unsigned simulator builds have no keychain entitlement, so
// SecureStore throws there and the file alone carries the id. Children render
// only after the id is loaded and users.ensure has created the user row.

const OWNER_ID_FILE = "afterscroll-owner-id";

async function readFromFile(): Promise<string | null> {
  try {
    const file = new File(Paths.document, OWNER_ID_FILE);
    return file.exists ? (await file.text()).trim() || null : null;
  } catch (error) {
    console.warn("Could not read ownerId file", error);
    return null;
  }
}

function writeToFile(id: OwnerId) {
  try {
    const file = new File(Paths.document, OWNER_ID_FILE);
    if (!file.exists) file.create();
    file.write(id);
  } catch (error) {
    console.warn("Could not write ownerId file", error);
  }
}

async function readFromSecureStore(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(OWNER_ID_STORAGE_KEY);
  } catch (error) {
    console.warn("SecureStore unavailable for ownerId read", error);
    return null;
  }
}

async function writeToSecureStore(id: OwnerId) {
  try {
    await SecureStore.setItemAsync(OWNER_ID_STORAGE_KEY, id);
  } catch (error) {
    console.warn("SecureStore unavailable for ownerId write", error);
  }
}

async function loadOrCreateOwnerId(): Promise<OwnerId> {
  if (Platform.OS === "web") {
    const existing = globalThis.localStorage?.getItem(OWNER_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = randomUUID();
    globalThis.localStorage?.setItem(OWNER_ID_STORAGE_KEY, id);
    return id;
  }
  const fromFile = await readFromFile();
  const fromSecureStore = fromFile ? null : await readFromSecureStore();
  const id = fromFile ?? fromSecureStore ?? randomUUID();
  if (!fromFile) writeToFile(id);
  if (!fromSecureStore) await writeToSecureStore(id);
  return id;
}

const OwnerContext = createContext<OwnerId | null>(null);

export function OwnerProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [ownerId, setOwnerId] = useState<OwnerId | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ensure = useMutation(api.users.ensure);

  useEffect(() => {
    let cancelled = false;
    loadOrCreateOwnerId()
      .then(async (id) => {
        await ensure({ ownerId: id });
        if (!cancelled) setOwnerId(id);
      })
      .catch((error) => {
        console.error("Failed to initialise owner identity", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ensure, attempt]);

  if (ownerId) return <OwnerContext.Provider value={ownerId}>{children}</OwnerContext.Provider>;
  if (failed) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32, backgroundColor: "#0B0B10" }}>
        <Text testID="owner-error" style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center" }}>
          Could not connect to AfterScroll. Check your connection and try again.
        </Text>
        <Pressable
          testID="owner-retry"
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: "#FFFFFF" }}
        >
          <Text style={{ color: "#0B0B10", fontSize: 16, fontWeight: "600" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    fallback ?? (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0B10" }}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  );
}

/** The device ownerId. Only valid under OwnerProvider. */
export function useOwnerId(): OwnerId {
  const ownerId = useContext(OwnerContext);
  if (!ownerId) throw new Error("useOwnerId must be used inside <OwnerProvider>");
  return ownerId;
}

type OwnedArgs<F extends FunctionReference<"query" | "mutation">> = Omit<FunctionArgs<F>, "ownerId">;

/** useQuery that injects ownerId. Pass "skip" to skip. */
export function useOwnedQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args: OwnedArgs<Q> | "skip",
): FunctionReturnType<Q> | undefined {
  const ownerId = useOwnerId();
  return useQuery(query, (args === "skip" ? "skip" : { ...args, ownerId }) as FunctionArgs<Q>);
}

/** useMutation that injects ownerId. */
export function useOwnedMutation<M extends FunctionReference<"mutation">>(mutation: M) {
  const ownerId = useOwnerId();
  const run = useMutation(mutation);
  return (args: OwnedArgs<M>): Promise<FunctionReturnType<M>> => run({ ...args, ownerId } as FunctionArgs<M>);
}
