// Сжатие фото перед сохранением: основное до 1600px, превью до 320px. ARCHITECTURE.md §9.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/db';

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function resize(src: CanvasImageSource, w: number, h: number, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext('2d')!.drawImage(src, 0, 0, cw, ch);
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, width: cw, height: ch }) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  );
}

export async function compressPhoto(file: Blob) {
  const img = await decode(file);
  const main = await resize(img, img.width, img.height, 1600, 0.8);
  const thumb = await resize(img, img.width, img.height, 320, 0.7);
  return { blob: main.blob, thumb: thumb.blob, width: main.width, height: main.height };
}

/** URL для показа фото из базы; освобождается при размонтировании. */
export function usePhotoUrl(id: string | undefined, variant: 'thumb' | 'full' = 'thumb') {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let objectUrl: string | undefined;
    db.photos.get(id).then((p) => {
      if (!p || !alive) return;
      objectUrl = URL.createObjectURL(variant === 'thumb' ? p.thumb : p.blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, variant]);
  return url;
}

/** URL для ещё не сохранённого Blob. */
export function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
