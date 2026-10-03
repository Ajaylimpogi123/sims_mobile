import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { ApiError, MESSAGES } from '@/api/errors';
import { apiPathFromUrl } from '@/api/images';

/**
 * Protected files (report attachments) downloaded with the Bearer token so they can be opened in
 * another app. They live in the app's cache under one folder that is deleted whenever a session
 * ends or starts (AuthProvider), like the image cache.
 */
const ROOT_NAME = 'protected-downloads';
const DOWNLOAD_TIMEOUT_MS = 60_000;
/** Android Intent.FLAG_GRANT_READ_URI_PERMISSION: lets the viewer app read our content:// URI. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

const rootDirectory = () => new Directory(Paths.cache, ROOT_NAME);

/** Short stable folder name per URL (the URL's ?v= changes when the file is replaced). */
function folderName(path: string): string {
  let hash = 5381;
  for (let i = 0; i < path.length; i += 1) hash = ((hash * 33) ^ path.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

/** A file name that's safe on Android's file system, keeping the extension the viewer needs. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, '_').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'attachment';
  return cleaned.length > 120 ? cleaned.slice(cleaned.length - 120) : cleaned;
}

/**
 * Downloads a protected /api/v1 file through the api client (configured server only, Bearer token,
 * 401 ends the session) into the cache, or returns the copy already there. Rejects with an ApiError.
 */
export async function downloadProtectedFile(url: string, name: string): Promise<File> {
  const path = apiPathFromUrl(url);
  if (!path) throw new ApiError({ kind: 'not_found', message: MESSAGES.notFound });

  const folder = new Directory(rootDirectory(), folderName(path));
  const file = new File(folder, safeFileName(name));
  if (file.exists && file.size > 0) return file;

  const { data } = await api.get<ArrayBuffer>(path, { responseType: 'arraybuffer', timeout: DOWNLOAD_TIMEOUT_MS });
  try {
    folder.create({ intermediates: true, idempotent: true });
    file.create({ overwrite: true });
    file.write(new Uint8Array(data));
    return file;
  } catch {
    try {
      if (file.exists) file.delete();
    } catch {
      // Nothing more to clean up.
    }
    throw new ApiError({ kind: 'unknown', message: "Couldn't save the file on this phone. Free up some space and try again." });
  }
}

/** The system share sheet (Save to Files, Drive, Messenger, a PDF viewer…). */
export async function shareFile(file: File, mimeType: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError({ kind: 'unknown', message: 'Sharing is not available on this phone.' });
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}

/**
 * Opens a downloaded file in the phone's viewer for its type (Android: an ACTION_VIEW intent with
 * read access to our content:// URI). With no viewer installed, falls back to the share sheet.
 * Doesn't wait for the viewer to close.
 */
export function openFile(file: File, mimeType: string, title: string, onError: (message: string) => void): void {
  const fallback = () =>
    shareFile(file, mimeType, title).catch((error: unknown) =>
      onError(error instanceof ApiError ? error.message : `No app on this phone can open this file.`),
    );

  if (Platform.OS !== 'android') {
    void fallback();
    return;
  }
  IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    type: mimeType,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  }).catch(() => void fallback());
}

/** Deletes every downloaded protected file. Never throws. */
export function clearDownloadedFiles(): void {
  try {
    const root = rootDirectory();
    if (root.exists) root.delete();
  } catch {
    // Cache folder is cleared by the OS eventually anyway.
  }
}
