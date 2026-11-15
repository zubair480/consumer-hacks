import * as Clipboard from "expo-clipboard";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

// OWNER: Instagram thread (CONS-16). Instagram-ready JPEG + the no-API share-sheet fallback
// for Instagram, TikTok and YouTube. The fallback never reports Published: PublishSheet calls
// startShare (Awaiting user action) before it runs the fallback.

export type LocalImage = { uri: string; width: number; height: number };

const MAX_WIDTH = 1440;
const JPEG_QUALITY = 0.8;
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

export const CAPTION_COPIED_TOAST = "Caption copied, paste it in the app";

/** JPEG at most 1440 px wide, center-cropped into Instagram's 4:5 to 1.91:1 feed range. */
export async function toInstagramJpeg(image: LocalImage): Promise<LocalImage> {
  const ctx = ImageManipulator.manipulate(image.uri);
  const ratio = image.width / image.height;
  let { width, height } = image;
  if (ratio < MIN_RATIO) height = Math.floor(width / MIN_RATIO);
  if (ratio > MAX_RATIO) width = Math.floor(height * MAX_RATIO);
  if (width !== image.width || height !== image.height) {
    ctx.crop({ originX: Math.floor((image.width - width) / 2), originY: Math.floor((image.height - height) / 2), width, height });
  }
  if (width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const saved = await (await ctx.renderAsync()).saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Converts to an Instagram JPEG and uploads it to Convex storage; returns the storageId and the local JPEG. */
export async function uploadInstagramJpeg(
  image: LocalImage,
  getUploadUrl: () => Promise<string>,
): Promise<{ storageId: Id<"_storage">; uri: string }> {
  const jpeg = await toInstagramJpeg(image);
  const blob = await (await fetch(jpeg.uri)).blob();
  const res = await fetch(await getUploadUrl(), { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!res.ok) throw new Error("Upload failed. Check your connection and try again.");
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return { storageId, uri: jpeg.uri };
}

async function localJpeg(imageUri: string): Promise<string> {
  if (!/^https?:/i.test(imageUri)) return imageUri;
  const dir = new Directory(Paths.cache, "share");
  dir.create({ idempotent: true, intermediates: true });
  const file = await File.downloadFileAsync(imageUri, new File(dir, `afterscroll-${Date.now()}.jpg`));
  return file.uri;
}

type ToastListener = (message: string | null) => void;
const toastListeners = new Set<ToastListener>();

function showToast(message: string) {
  toastListeners.forEach((l) => l(message));
  setTimeout(() => toastListeners.forEach((l) => l(null)), 3000);
}

/** Current fallback toast message (null when hidden). Render it wherever the fallback is triggered. */
export function useMediaShareToast(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    toastListeners.add(setMessage);
    return () => {
      toastListeners.delete(setMessage);
    };
  }, []);
  return message;
}

/** Saves the JPEG locally, copies the caption, shows the toast, then opens the share sheet. */
export async function shareMediaFallback({ caption, imageUri }: { caption: string; imageUri: string }): Promise<void> {
  const fileUri = await localJpeg(imageUri);
  await Clipboard.setStringAsync(caption);
  showToast(CAPTION_COPIED_TOAST);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
  await Sharing.shareAsync(fileUri, { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: "Share to Instagram, TikTok or YouTube" });
}
