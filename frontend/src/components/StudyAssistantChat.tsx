import { useCallback, useEffect, useRef, useState } from "react";
import { mimoChat } from "@/lib/ai";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

const STORAGE_KEY = "lv:mimo-study-chat";
const MAX_HISTORY = 50;

const SYS_PROMPT = `你是「英语学习室」的 AI 学习助手，专注河南英语学习室英语词汇与语法。要求：
1. 回答简洁、有温度，尽量 200 字以内；
2. 涉及单词时给出：中文释义 + 1 个例句 + 形近/近义辨析；
3. 可被问学习方法、语法、单词记忆、英语学习室备考建议；
4. 不知道就说不知道，不要编造。`;

function loadMsgs(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter(
          (m: any) =>
            m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function saveMsgs(list: ChatMsg[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_HISTORY)));
  } catch {}
}

export function StudyAssistantChat() {
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => loadMsgs());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { role: "user", text };
    const placeholder: ChatMsg = { role: "assistant", text: "正在思考…" };
    const base = [...msgs, userMsg];
    setMsgs([...base, placeholder]);
    setInput("");
    setLoading(true);

    const history = [
      { role: "system", content: SYS_PROMPT },
      ...base.map((m) => ({ role: m.role, content: m.text })),
    ];

    try {
      const answer = await mimoChat(history as any, { max_tokens: 2048, temperature: 0.8 });
      const finalMsgs: ChatMsg[] = [
        ...base,
        { role: "assistant", text: answer || "⚠️ AI 没有返回内容，请重试。" },
      ];
      setMsgs(finalMsgs);
      saveMsgs(finalMsgs);
    } catch (e: any) {
      const reason = (e?.message || "网络出错了，请稍后重试").toString();
      const failMsgs: ChatMsg[] = [...base, { role: "assistant", text: "⚠️ " + reason }];
      setMsgs(failMsgs);
      setInput(text); // 保留输入，方便重试
    } finally {
      setLoading(false);
    }
  }, [msgs, input, loading]);

  const clearAll = useCallback(() => {
    setMsgs([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border g-border bg-card">
      <div className="flex items-center justify-between border-b g-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold">AI 学习助手</span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">mimo</span>
        </div>
        {msgs.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            清空对话
          </button>
        )}
      </div>

      <div ref={listRef} className="h-[56vh] space-y-3 overflow-y-auto p-4 text-sm">
        {msgs.length === 0 && (
          <div className="rounded-xl g-panel px-3 py-3 text-muted-foreground">
            你好！我是你的 AI 学习助手 🤓 问单词、语法、学习方法都可以直接发。对话会自动保存在本机。
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
            {m.role === "assistant" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs">
                🤖
              </div>
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="问单词、语法、学习建议…"
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
  );
}

export default StudyAssistantChat;
