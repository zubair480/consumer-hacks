import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";

export async function copyDraftText(text: string) {
  await Clipboard.setStringAsync(text);
}

export async function shareDraftText(text: string): Promise<boolean> {
  const result = await Share.share({ message: text });
  return result.action === Share.sharedAction;
}
