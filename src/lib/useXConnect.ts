import { useAction, useConvex } from "convex/react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../convex/_generated/api";
import { useOwnerId } from "../identity/OwnerProvider";

/** X OAuth: opens the authorize page and resolves whether X ended up connected, with the server's message when it didn't. */
export function useXConnect(returnPath: string) {
  const ownerId = useOwnerId();
  const convex = useConvex();
  const startXConnect = useAction(api.imports.connections.startXConnect);
  return async (): Promise<{ connected: boolean; error?: string }> => {
    const returnUrl = Linking.createURL(returnPath);
    const { authorizeUrl } = await startXConnect({ ownerId, returnUrl });
    const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
    if (result.type !== "success") {
      const fresh = await convex.query(api.imports.connections.sources, { ownerId });
      return { connected: !!fresh.find((s) => s.platform === "x")?.connected };
    }
    const { queryParams } = Linking.parse(result.url);
    if (queryParams?.x === "connected") return { connected: true };
    return { connected: false, error: typeof queryParams?.message === "string" ? queryParams.message : "Couldn't connect X." };
  };
}
