const MAX_BYTES = 1_500_000;
const MAX_EDGE = 1600;

function isDirectlyUploadable(file: File): boolean {
  return (
    file.size <= MAX_BYTES &&
    (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')
  );
}

export async function prepareSelfieForUpload(file: File): Promise<File> {
  if (isDirectlyUploadable(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.82);
    });
    if (!blob) return file;
    return new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
