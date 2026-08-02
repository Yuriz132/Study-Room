import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download } from "lucide-react";

/**
 * 图片灯箱：点击笔记/评论图片后全屏放大预览，支持「保存图片」下载到本地。
 * src 为图片地址（dataURL 或 http(s) URL），传 null 时不渲染。
 *
 * 设计要点：
 * - 用 createPortal 挂到 document.body，避免父级 transform 影响 fixed 定位
 * - 外层用 100dvh 应对移动端浏览器工具栏伸缩
 * - 图片区域绝对定位，图片本身用 absolute inset-0 m-auto 做最稳的垂直居中
 */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = src;
    a.download = "笔记图片.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const content = (
    <div
      className="fixed inset-0 z-[60] bg-black/95"
      style={{ height: "100dvh" }}
      onClick={onClose}
    >
      {/* 顶栏：关闭 + 保存图片 */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4">
        <button
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full g-panel text-white shadow-lg ring-1 g-ring backdrop-blur-md transition active:scale-90"
          aria-label="关闭"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-full g-panel px-4 py-2.5 text-sm text-white shadow-lg ring-1 g-ring backdrop-blur-md transition active:scale-95"
          aria-label="保存图片"
        >
          <Download className="h-4 w-4" /> 保存图片
        </button>
      </div>

      {/* 图片区域：top-14 留出顶栏，bottom-0 贴底 */}
      <div
        className="absolute inset-x-0 bottom-0 top-14"
        onClick={(e) => e.stopPropagation()}
      >
        {/* absolute inset-0 m-auto 是跨浏览器最稳的居中方式 */}
        <img
          src={src}
          alt="预览"
          className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain p-4"
          draggable={false}
          onClick={onClose}
        />
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
