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

/**
 * Downscales a captured photo to ≤ 1280 px on its long edge and re-encodes it as JPEG.
 * The long edge is read from the decoded image itself, not from the camera's reported size,
 * which some Android devices may give before rotation (a portrait shot would end up 1280×1707).
 */
export async function preparePhoto(photo: { uri: string }): Promise<PreparedPhoto> {
  const decodeContext = ImageManipulator.manipulate(photo.uri);
  const decoded = await decodeContext.renderAsync().finally(() => decodeContext.release());
  let output = decoded;
  try {
    if (Math.max(decoded.width, decoded.height) > MAX_DIMENSION) {
      const resizeContext = ImageManipulator.manipulate(decoded);
      resizeContext.resize(decoded.width >= decoded.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
      output = await resizeContext.renderAsync().finally(() => resizeContext.release());
    }
    const saved = await output.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } finally {
    if (output !== decoded) output.release();
    decoded.release();
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
