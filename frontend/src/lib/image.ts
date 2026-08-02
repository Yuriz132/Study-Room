/** canvas 可直接解码压缩的 MIME 类型 */
const ACCEPT_CANVAS_TYPES = /^image\/(jpeg|jpg|png|webp|gif|bmp)$/i;

/** HEIC/HEIF 判定（优先 file.type，部分系统给的是空字符串，再兜底文件名后缀） */
function isHeic(file: File): boolean {
  return /^image\/(heic|heif)$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** 尝试把 HEIC/HEIF 转成 JPEG；失败返回 null，由调用方决定是否回退原图（动态加载 heic2any，避免主包膨胀） */
async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const mod: { default: typeof import('heic2any').default } = await import('heic2any');
    const result = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(result) ? result[0] : result;
    const name = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[compressImage] HEIC 转换失败，将尝试原图上传', e);
    return null;
  }
}

/** 兜底：直接把文件读成 dataURL（不压缩），用于压缩两次仍失败时保住图片 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * 韧性压缩：压缩失败自动重试一次，仍失败则回退为「原图 dataURL」，
 * 确保「能发出去」优先于「必须压缩」——直接针对图库/大图发送失败的痛点。
 */
export async function compressImageResilient(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  try {
    return await compressImage(file, maxDim, quality);
  } catch (e) {
    console.warn('[compressImage] 首次压缩失败，重试一次', e);
    try {
      return await compressImage(file, maxDim, quality);
    } catch (e2) {
      console.warn('[compressImage] 压缩失败，回退原图 dataURL', e2);
      return await fileToDataUrl(file);
    }
  }
}

/**
 * 前端图片压缩/转换工具
 * - JPEG/PNG/WebP/GIF/BMP：用 canvas 压缩（最长边 ≤ maxDim，质量 quality）
 * - HEIC/HEIF：先尝试 heic2any 转 JPEG，再 canvas 压缩；转换失败则回退上传原图
 * - 任何解码失败都回退原图 dataURL，确保「能发出去」优先于「必须压缩」
 */
export async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  let source = file;
  if (isHeic(file)) {
    const converted = await convertHeicToJpeg(file);
    if (converted) source = converted;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // canvas 解不了的格式直接上传原图（依赖后端支持 heic/heif 等）
      if (!ACCEPT_CANVAS_TYPES.test(source.type)) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, width, height);
          const type = source.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(type, quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(source);
  });
}
