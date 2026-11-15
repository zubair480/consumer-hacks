import { ConvexError } from "convex/values";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickedImage = { uri: string; width: number; height: number };

const MAX_SIDE = 1600;

export async function pickImages(source: "library" | "camera", multiple = false): Promise<PickedImage[]> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera access is needed to take a photo. You can allow it in Settings.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsMultipleSelection: multiple, selectionLimit: multiple ? 5 : 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

async function shrink(image: PickedImage): Promise<string> {
  const ctx = ImageManipulator.manipulate(image.uri);
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_SIDE) ctx.resize(image.width >= image.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return saved.uri;
}

export async function uploadImage(image: PickedImage, getUploadUrl: () => Promise<string>): Promise<string> {
  const uri = await shrink(image);
  const url = await getUploadUrl();
  const blob = await (await fetch(uri)).blob();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!res.ok) throw new Error("Upload failed. Check your connection and try again.");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) return typeof error.data === "string" ? error.data : "Something went wrong.";
  if (error instanceof Error) return error.message.replace(/^.*Uncaught (ConvexError: )?/s, "").split("\n")[0];
  return "Something went wrong.";
}

export function isValidLink(raw: string): boolean {
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return (url.protocol === "http:" || url.protocol === "https:") && /^[^.\s]+(\.[^.\s]+)+$/.test(url.hostname);
  } catch {
    return false;
  }
}
