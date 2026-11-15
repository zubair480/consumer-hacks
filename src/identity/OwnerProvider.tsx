import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { OWNER_ID_STORAGE_KEY, type OwnerId } from "../shared/contracts";

// OWNER: Lead. Device-local identity: a UUID generated once with expo-crypto
// and kept in expo-secure-store (localStorage on web). Children render only
// after the id is loaded and users.ensure has created the user row.
// Unsigned simulator builds have no keychain entitlement, so SecureStore
// throws there; the id then lives in a file in the app's document directory.

async function loadOrCreateFromFile(): Promise<OwnerId> {
  const file = new File(Paths.document, "afterscroll-owner-id");
  if (file.exists) {
    const existing = (await file.text()).trim();
    if (existing) return existing;
  }
  const id = randomUUID();
  if (!file.exists) file.create();
  file.write(id);
  return id;
}

async function loadOrCreateOwnerId(): Promise<OwnerId> {
  if (Platform.OS === "web") {
    const existing = globalThis.localStorage?.getItem(OWNER_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = randomUUID();
    globalThis.localStorage?.setItem(OWNER_ID_STORAGE_KEY, id);
    return id;
  }
  try {
    const existing = await SecureStore.getItemAsync(OWNER_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = randomUUID();
    await SecureStore.setItemAsync(OWNER_ID_STORAGE_KEY, id);
    return id;
  } catch (error) {
    console.warn("SecureStore unavailable, using file storage for ownerId", error);
    return await loadOrCreateFromFile();
  }
}

const OwnerContext = createContext<OwnerId | null>(null);

export function OwnerProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [ownerId, setOwnerId] = useState<OwnerId | null>(null);
  const ensure = useMutation(api.users.ensure);

  useEffect(() => {
    let cancelled = false;
    loadOrCreateOwnerId()
      .then(async (id) => {
        await ensure({ ownerId: id });
        if (!cancelled) setOwnerId(id);
      })
      .catch((error) => console.error("Failed to initialise owner identity", error));
    return () => {
      cancelled = true;
    };
  }, [ensure]);

  if (!ownerId) {
    return (
      fallback ?? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0B10" }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )
    );
  }
  return <OwnerContext.Provider value={ownerId}>{children}</OwnerContext.Provider>;
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
