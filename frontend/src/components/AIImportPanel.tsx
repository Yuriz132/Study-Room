import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, X, Check, Sparkles, Pencil } from 'lucide-react';
import { aiExtractWordsFromImage, type ExtractedWord } from '@/lib/ai';
import type { CustomWord } from '@/types/word';

interface AIImportPanelProps {
  onImport: (words: CustomWord[]) => void;
  /** 自动触发文件选择器（用于"图片一键导入"快捷入口） */
  autoOpen?: boolean;
}

type Stage = 'idle' | 'loading' | 'preview' | 'extracting';

/** 压缩图片到合理大小（最长边 1600px，JPEG 0.85） */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) {
          height = Math.round((height * max) / width);
          width = max;
        } else {
          width = Math.round((width * max) / height);
          height = max;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function AIImportPanel({ onImport, autoOpen }: AIImportPanelProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [imgData, setImgData] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [editable, setEditable] = useState<ExtractedWord[]>([]);
  const [errMsg, setErrMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStage('idle');
    setImgData(null);
    setHint('');
    setEditable([]);
    setErrMsg('');
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  // autoOpen=true 时自动弹出文件选择器（仅一次）
  useEffect(() => {
    if (autoOpen && stage === 'idle') {
      const t = setTimeout(() => fileRef.current?.click(), 100);
      return () => clearTimeout(t);
    }
  }, [autoOpen, stage]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setErrMsg('');
    setStage('loading');
    try {
      const data = await compressImage(file);
      setImgData(data);
      setStage('extracting');
      const res = await aiExtractWordsFromImage({ imageDataUrl: data, hint: hint.trim() || undefined });
      if (!res.words.length) {
        setErrMsg(`未识别到英文单词。${res.raw ? '（原始：' + res.raw.slice(0, 100) + '）' : '试试：1) 图片清晰度 2) 调整角度 3) 添加提示'}`);
      }
      setEditable(res.words);
      setStage('preview');
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message || e?.message || '网络错误';
      setErrMsg(`AI 识别失败：${detail.slice(0, 200)}`);
      setStage('preview');   // 保留图片预览，用户可看到状态
    }
  };

  const updateWord = (i: number, patch: Partial<ExtractedWord>) => {
    setEditable((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  };

  const removeWord = (i: number) => {
    setEditable((prev) => prev.filter((_, idx) => idx !== i));
  };

  const doImport = () => {
    const valid = editable
      .filter((w) => w.word.trim() && w.meaning.trim())
      .map((w) => ({
        word: w.word.trim(),
        phonetic: w.phonetic?.trim() || undefined,
        meaning: w.meaning.trim(),
      }));
    if (valid.length === 0) return;
    onImport(valid);
    reset();
  };

  return (
    <div className="liquid-glass mb-3 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        AI 智能导入
        <span className="text-xs font-normal text-muted-foreground/70">拍照/上传图片，AI 自动整理单词并补充中文</span>
      </div>

      {stage === 'idle' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
            <button
              onClick={() => fileRef.current?.click()}
              className="liquid-glass liquid-glass-shine flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs text-primary transition-all active:scale-95"
            >
              <Upload className="h-3.5 w-3.5" /> 上传图片
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="liquid-glass liquid-glass-shine flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs text-primary transition-all active:scale-95"
            >
              <Camera className="h-3.5 w-3.5" /> 拍照识别
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="可选：图片描述提示（例：六级高频词）"
            className="liquid-glass h-9 w-full rounded-lg g-panel px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      )}

      {(stage === 'loading' || stage === 'extracting') && (
        <div className="flex items-center gap-2 rounded-xl g-panel px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {stage === 'loading' ? '正在处理图片…' : 'AI 正在识别单词…（通常 5-15 秒）'}
        </div>
      )}

      {stage === 'preview' && imgData && (
        <div className="space-y-3">
          {/* 图片预览 */}
          <div className="relative">
            <img src={imgData} alt="预览" className="max-h-40 w-full rounded-lg object-contain g-panel" />
            <button
              onClick={reset}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-black/80"
              aria-label="重新上传"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}

          {/* 识别结果 */}
          {editable.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                AI 识别到 <span className="text-primary">{editable.length}</span> 个词，可编辑后导入：
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {editable.map((w, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-1 rounded-lg g-panel px-2 py-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        value={w.word}
                        onChange={(e) => updateWord(i, { word: e.target.value })}
                        className="h-7 rounded g-panel px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <input
                        value={w.meaning}
                        onChange={(e) => updateWord(i, { meaning: e.target.value })}
                        className="h-7 rounded g-panel px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <input
                      value={w.phonetic || ''}
                      onChange={(e) => updateWord(i, { phonetic: e.target.value })}
                      placeholder="音标"
                      className="h-7 w-20 rounded g-panel px-1.5 text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => removeWord(i)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:g-panel hover:text-destructive"
                      aria-label="删除该词"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={doImport}
                  disabled={editable.filter((w) => w.word.trim() && w.meaning.trim()).length === 0}
                  className="liquid-glass-accent liquid-glass liquid-glass-shine flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-primary transition-all active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
                >
                  <Check className="h-4 w-4" /> 导入 {editable.filter((w) => w.word.trim() && w.meaning.trim()).length} 个词
                </button>
                <button
                  onClick={reset}
                  className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all hover:text-foreground active:scale-95"
                >
                  <Pencil className="h-4 w-4" /> 重选
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={reset}
              className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all hover:text-foreground active:scale-95"
            >
              <Pencil className="h-4 w-4" /> 重新选择
            </button>
          )}
        </div>
      )}
    </div>
  );
}
