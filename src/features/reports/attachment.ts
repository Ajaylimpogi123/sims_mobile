import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import type { PickedFile } from '@/api/reports';

/** The API's limits (same as the website): jpg, jpeg, png or pdf, at most 5120 KB. */
export const MAX_ATTACHMENT_BYTES = 5120 * 1024;
export const ATTACHMENT_HINT = 'JPG, PNG or PDF, up to 5 MB.';

/** Photos are downscaled to this long edge (still sharp enough to read a document) and saved as JPEG. */
const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.85;

/** Laravel's wording for the same rules, so a client-side refusal reads like the server's. */
export const ATTACHMENT_ERRORS = {
  type: 'The attachment field must be a file of type: jpg, jpeg, png, pdf.',
  size: 'The attachment field must not be greater than 5120 kilobytes.',
  unreadable: "That file couldn't be read. Please choose another one.",
  camera: "The camera couldn't be opened. Close other apps that are using it and try again.",
} as const;

export type AttachmentSource = 'camera' | 'library' | 'pdf';

/** null = the user cancelled. */
export type PickOutcome = { file: PickedFile } | { error: string } | null;

type ImageMime = 'image/jpeg' | 'image/png';

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.split('?')[0]);
  return match ? match[1].toLowerCase() : '';
}

function imageMimeOf(mimeType: string | null | undefined, name: string): ImageMime | null {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'image/png') return 'image/png';
  if (mime) return null;
  const ext = extensionOf(name);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

function withExtension(name: string, extension: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '') || 'attachment';
  return `${base}.${extension}`;
}

/** "20261003-090512" in Manila time, for generated file names. */
function stamp(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 19).replace(/-/g, '').replace('T', '-').replace(/:/g, '');
}

function sizeOnDisk(uri: string): number | null {
  try {
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

/**
 * Keeps a JPEG/PNG that is already small enough; otherwise downscales it to ≤ 2048 px on its long edge
 * (read from the decoded image, not the picker's reported size) and saves it as JPEG.
 * Anything the phone can decode (HEIC, WebP…) is converted to JPEG the same way.
 */
async function prepareImage(asset: { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null }, fallbackName: string): Promise<PickOutcome> {
  const name = asset.fileName?.trim() || fallbackName;
  const mime = imageMimeOf(asset.mimeType, asset.fileName ?? asset.uri);

  let decoded;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    decoded = await context.renderAsync().finally(() => context.release());
  } catch {
    return { error: mime ? ATTACHMENT_ERRORS.unreadable : ATTACHMENT_ERRORS.type };
  }

  let output = decoded;
  try {
    const longEdge = Math.max(decoded.width, decoded.height);
    const size = asset.fileSize ?? sizeOnDisk(asset.uri);
    if (mime && longEdge <= MAX_IMAGE_EDGE && size !== null && size <= MAX_ATTACHMENT_BYTES) {
      return { file: { uri: asset.uri, name: withExtension(name, mime === 'image/png' ? 'png' : 'jpg'), mimeType: mime, size } };
    }

    if (longEdge > MAX_IMAGE_EDGE) {
      const resize = ImageManipulator.manipulate(decoded);
      resize.resize(decoded.width >= decoded.height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
      output = await resize.renderAsync().finally(() => resize.release());
    }
    const saved = await output.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    const savedSize = sizeOnDisk(saved.uri);
    if (savedSize !== null && savedSize > MAX_ATTACHMENT_BYTES) return { error: ATTACHMENT_ERRORS.size };
    return { file: { uri: saved.uri, name: withExtension(name, 'jpg'), mimeType: 'image/jpeg', size: savedSize } };
  } catch {
    return { error: ATTACHMENT_ERRORS.unreadable };
  } finally {
    if (output !== decoded) output.release();
    decoded.release();
  }
}

/** Asked when the student taps Take photo; explains and offers Settings once it can't be asked again. */
async function ensureCameraPermission(): Promise<boolean> {
  let permission = await ImagePicker.getCameraPermissionsAsync();
  if (permission.granted) return true;
  if (permission.canAskAgain) {
    permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) return true;
    if (permission.canAskAgain) return false;
  }
  Alert.alert('Camera access is off', 'To take a photo for your report, allow SIMS to use the camera in Settings.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings() },
  ]);
  return false;
}

async function fromCamera(): Promise<PickOutcome> {
  if (!(await ensureCameraPermission())) return null;
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  } catch {
    return { error: ATTACHMENT_ERRORS.camera };
  }
  if (result.canceled || !result.assets[0]) return null;
  // A camera shot has no meaningful file name; name it like "report-photo-20261003-090512.jpg".
  return prepareImage({ ...result.assets[0], fileName: null }, `report-photo-${stamp()}.jpg`);
}

/** Android's system photo picker: no storage permission needed. */
async function fromLibrary(): Promise<PickOutcome> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false });
  } catch {
    return { error: ATTACHMENT_ERRORS.unreadable };
  }
  if (result.canceled || !result.assets[0]) return null;
  return prepareImage(result.assets[0], `image-${stamp()}.jpg`);
}

/** The system file picker, PDFs only; the file is copied into the app's cache for the upload. */
async function fromDocuments(): Promise<PickOutcome> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  } catch {
    return { error: ATTACHMENT_ERRORS.unreadable };
  }
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const isPdf = (asset.mimeType ?? '').toLowerCase() === 'application/pdf' || extensionOf(asset.name) === 'pdf';
  if (!isPdf) return { error: ATTACHMENT_ERRORS.type };
  const size = asset.size ?? sizeOnDisk(asset.uri);
  if (size !== null && size > MAX_ATTACHMENT_BYTES) return { error: ATTACHMENT_ERRORS.size };
  return { file: { uri: asset.uri, name: withExtension(asset.name || `document-${stamp()}`, 'pdf'), mimeType: 'application/pdf', size } };
}

/** Takes a photo, picks an image or picks a PDF, and checks it against the API's type and size rules. */
export function pickAttachment(source: AttachmentSource): Promise<PickOutcome> {
  if (source === 'camera') return fromCamera();
  if (source === 'library') return fromLibrary();
  return fromDocuments();
}
