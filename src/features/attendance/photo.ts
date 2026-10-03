import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Linking } from 'react-native';

/** Same limits as the website's capture (useCamera.js): long edge ≤ 1280 px, JPEG quality 0.8. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Downscales a captured photo to ≤ 1280 px on its long edge and re-encodes it as JPEG. */
export async function preparePhoto(photo: { uri: string; width: number; height: number }): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  try {
    if (Math.max(photo.width, photo.height) > MAX_DIMENSION) {
      context.resize(photo.width >= photo.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
      return { uri: saved.uri, width: saved.width, height: saved.height };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Google Maps at these coordinates (the Maps app if installed, else the browser), like the website's "View map". */
export function openInMaps(latitude: number, longitude: number) {
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
}

/** "10.676543, 122.950988" */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** "Accurate to ±12 m" (website wording) */
export function formatAccuracy(accuracy: number | null): string {
  return accuracy !== null ? `Accurate to ±${Math.round(accuracy)} m` : 'Accuracy unknown';
}
