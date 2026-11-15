import { ConvexError } from "convex/values";
import * as ImagePicker from "expo-image-picker";

export type PickedImage = { uri: string; mimeType: string };

export async function pickImage(source: "library" | "camera"): Promise<PickedImage | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera access is needed to take a photo.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

export async function uploadImage(image: PickedImage, getUploadUrl: () => Promise<string>): Promise<string> {
  const url = await getUploadUrl();
  const blob = await (await fetch(image.uri)).blob();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": image.mimeType }, body: blob });
  if (!res.ok) throw new Error("Upload failed. Check your connection and try again.");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) return typeof error.data === "string" ? error.data : "Something went wrong.";
  if (error instanceof Error) return error.message.replace(/^.*Uncaught (ConvexError: )?/s, "").split("\n")[0];
  return "Something went wrong.";
}
