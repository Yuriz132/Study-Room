import { useState, useRef, useEffect } from "react";
import { aiChat, type ChatMessage } from "@/lib/ai";

interface ChatMsg { role: "user" | "assistant"; text: string }

const AI_CHAT_KEY = "hv:ai-chat";
function loadMsgs(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      : [];
  } catch { return []; }
}
function saveMsgs(list: ChatMsg[]) {
  try { localStorage.setItem(AI_CHAT_KEY, JSON.stringify(list.slice(-20))); } catch {}
}

const SYS = `你是「升本词汇」的 AI 学习助手，专注于河南专升本英语词汇。回答简洁、有温度，200 字以内。涉及单词时给出中文释义+例句+形近词。`;

export function AIChatFAB() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => loadMsgs());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs, open, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { role: "user", text };
    const placeholder: ChatMsg = { role: "assistant", text: "正在思考…" };
    const next: ChatMsg[] = [...msgs, userMsg, placeholder];
    setMsgs(next);
    setInput("");
    setLoading(true);

    const history: ChatMessage[] = [...msgs, userMsg].map((m) => ({ role: m.role, content: m.text }));

    try {
      // 非流式：直接拿完整文本，最稳，避免 SSE 解析在部分浏览器失败
      const answer = (await aiChat([{ role: "system", content: SYS }, ...history], {
        max_tokens: 3000,
        temperature: 0.8,
      })) as string;

      const finalMsgs: ChatMsg[] = [...msgs, userMsg, { role: "assistant", text: answer || "⚠️ AI 没有返回内容，请重试。" }];
      setMsgs(finalMsgs);
      saveMsgs(finalMsgs);
    } catch (e: any) {
      const reason = (e?.message || "网络出错了，请稍后重试").toString();
      const failMsgs: ChatMsg[] = [...msgs, userMsg, { role: "assistant", text: "⚠️ " + reason }];
      setMsgs(failMsgs);
      setInput(text); // 保留输入
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-90"
        aria-label="AI 助手"
      >
        <span className="text-2xl">{open ? "✕" : "🤖"}</span>
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[70vh] w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border g-border g-surface backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b g-border px-4 py-3">
            <span className="text-lg">🤖</span>
            <span className="font-semibold">AI 学习助手</span>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div className="rounded-xl g-panel px-3 py-3 text-muted-foreground">
                你好！我是你的 AI 学习助手 🤓 问单词、学习建议都可以直接发。
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs">🤖</div>
                )}
                <div
                  className={
                    "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 " +
                    (m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "g-panel text-foreground")
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t g-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="问学习建议、查单词…"
              className="h-11 flex-1 rounded-xl g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/50"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-40"
            >
              {loading ? <span className="animate-spin">⏳</span> : "➤"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AIChatFAB;
