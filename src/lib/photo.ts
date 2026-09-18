// ============================================================================
// Preparing a unit photo for a Firestore document.
//
// There is no Storage bucket in this project, so a photo is a base64 JPEG in
// a document, and a Firestore document is capped at 1 MiB. The arithmetic
// that keeps it under that cap is here, pure, so it can be tested; the canvas
// work that needs a browser is the thin part at the bottom.
// ============================================================================

/** The longest edge a stored photo is allowed. */
export const PHOTO_MAX_EDGE = 640;

/** JPEG quality. 0.7 is where the artefacts stop being visible at this size. */
export const PHOTO_QUALITY = 0.7;

/**
 * The ceiling, well under Firestore's 1 MiB so the rest of the document and
 * base64's own overhead have room. A photo over this is refused with a
 * message rather than left to fail as `invalid-argument` at the write.
 */
export const PHOTO_MAX_BYTES = 700_000;

/** Scales an image down to fit `maxEdge`, never up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = PHOTO_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The stored size of a data URL: its base64 payload, decoded. The prefix and
 * the padding are both small, but they are the difference between passing a
 * check and failing the write.
 */
export function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export function photoTooLarge(dataUrl: string): boolean {
  return dataUrlBytes(dataUrl) > PHOTO_MAX_BYTES;
}

/**
 * Reads a chosen file and returns a downscaled JPEG data URL. Browser only —
 * everything above this line is where the rules actually live.
 */
export async function downscaleImage(file: File): Promise<string> {
  const source = await createImageBitmap(file);
  const { width, height } = fitWithin(source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize the image.");
  context.drawImage(source, 0, 0, width, height);
  source.close();
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}
