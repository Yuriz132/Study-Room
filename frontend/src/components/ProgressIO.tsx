import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportProgress, importProgress } from '@/lib/progress-io';

/** 学习进度备份：导出为 JSON 文件，或从文件导入恢复（跨浏览器转移进度） */
export function ProgressIO() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onExport = () => {
    setError(null);
    setMsg(null);
    exportProgress();
    setMsg('已导出学习进度文件，可保存到别处');
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMsg(null);
    try {
      await importProgress(file);
      setMsg('导入成功，正在刷新页面…');
      // 进度由 hooks 在初始化时从 localStorage 读取，刷新即可生效
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setError('导入失败：请选择本应用导出的进度文件');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      className="liquid-glass p-5"
      style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <span>学习进度备份</span>
        <span className="text-xs text-muted-foreground/70">
          进度存在本浏览器，可导出保存，换浏览器后导入恢复
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onExport}
          className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
        >
          <Download className="h-4 w-4" /> 导出进度
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
        >
          <Upload className="h-4 w-4" /> 导入进度
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
        />
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {msg && !error && <p className="mt-2 text-xs text-success">{msg}</p>}
    </div>
  );
}
