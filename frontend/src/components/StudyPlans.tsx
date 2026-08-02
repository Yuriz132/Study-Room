import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, CalendarCheck, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyPlans, useProgress } from '@/hooks/use-storage';
import { partStructure, getListKey } from '@/lib/words-data';
import { PLAN_TYPE_LABEL, type PlanType, type StudyPlan } from '@/lib/studyPlans';

interface StudyPlansProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** 计算计划当前完成进度 */
function computeCurrent(
  plan: StudyPlan,
  progress: Record<string, { reviewed: number; total: number }>
): number {
  if (plan.type === 'custom') return (plan.tasks ?? []).filter((t) => t.done).length;
  if (plan.type === 'units') {
    const sel = plan.selectedLists ?? [];
    if (sel.length === 0) return 0;
    // 已选 list 中 reviewed >= total 的数量
    return sel.filter((lk) => {
      const p = progress[lk];
      return p && p.total > 0 && p.reviewed >= p.total;
    }).length;
  }
  // words：累计已复习单词数
  return Object.values(progress).reduce((s, p) => s + p.reviewed, 0);
}

/** 与运行环境无关的 UUID 生成器 */
const uuid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const EMPTY_TASK = () => ({ id: uuid(), text: '' });

export function StudyPlans({ open, onOpenChange }: StudyPlansProps) {
  const { plans, addPlan, removePlan, toggleTask } = useStudyPlans();
  const { progress } = useProgress();

  const [type, setType] = useState<PlanType>('units');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(45);
  const [tasks, setTasks] = useState<{ id: string; text: string }[]>([EMPTY_TASK()]);
  // 章节选择状态：展开的 part 名集合 + 已选的 listKey 集合
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [selectedListKeys, setSelectedListKeys] = useState<Set<string>>(new Set());

  // 每次打开弹窗重置表单，并默认选中 Part One::List 1（第一章）
  useEffect(() => {
    if (open) {
      setType('units');
      setTitle('');
      setTarget(45);
      setTasks([EMPTY_TASK()]);

      const defaultPart = 'Part One';
      const defaultList = 'List 1';
      const defaultKey = getListKey(defaultPart, defaultList);
      setExpandedParts(new Set([defaultPart]));
      setSelectedListKeys(new Set([defaultKey]));
    }
  }, [open]);

  const validTasks = tasks.filter((t) => t.text.trim().length > 0);

  /** 切换 Part 展开/折叠 */
  const togglePart = (partName: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(partName)) next.delete(partName); else next.add(partName);
      return next;
    });
  };

  /** 切换单个 List 勾选 */
  const toggleList = (listKey: string) => {
    setSelectedListKeys((prev) => {
      const next = new Set(prev);
      if (next.has(listKey)) next.delete(listKey); else next.add(listKey);
      return next;
    });
  };

  /** 按 Part 全选/取消其下属所有 List */
  const togglePartAll = (partName: string, select: boolean) => {
    const part = partStructure.find((p) => p.name === partName);
    if (!part) return;
    setSelectedListKeys((prev) => {
      const next = new Set(prev);
      for (const l of part.lists) {
        const lk = getListKey(partName, l.name);
        if (select) next.add(lk); else next.delete(lk);
      }
      return next;
    });
    // 自动展开该 Part
    if (select) setExpandedParts((prev) => new Set([...prev, partName]));
  };

  /** 检查某 Part 是否全选 */
  const isPartFullySelected = (partName: string): boolean => {
    const part = partStructure.find((p) => p.name === partName);
    if (!part) return false;
    return part.lists.every((l) => selectedListKeys.has(getListKey(partName, l.name)));
  };

  const onCreate = () => {
    const selArray = Array.from(selectedListKeys);
    const plan: StudyPlan = {
      id: uuid(),
      type,
      title: title.trim() || PLAN_TYPE_LABEL[type],
      target:
        type === 'units'
          ? Math.max(1, selArray.length)
          : type === 'custom'
            ? Math.max(1, validTasks.length)
            : Math.max(1, Math.floor(target) || 1),
      selectedLists: type === 'units' ? selArray : undefined,
      tasks:
        type === 'custom'
          ? validTasks.map((t) => ({ id: t.id, text: t.text.trim(), done: false }))
          : undefined,
      createdAt: Date.now(),
    };
    addPlan(plan);
    onOpenChange(false);
  };

  // 已选数量（用于禁用判断）
  const selectedCount = selectedListKeys.size;

  return (
    <>
      <div className="liquid-glass p-5" style={{ borderRadius: 'calc(var(--radius) + 8px)' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="h-4 w-4 text-primary" />
            <span>学习计划</span>
            <span className="text-xs text-muted-foreground/70">
              选章节·设目标·追踪进度（登录后保存在云端）
            </span>
          </div>
          <button
            onClick={() => onOpenChange(true)}
            className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
          >
            <Plus className="h-4 w-4" /> 添加计划
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            还没有学习计划，点「添加计划」制定第一个目标吧～
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const current = computeCurrent(plan, progress);
              const pct = plan.target > 0 ? Math.min(100, Math.round((current / plan.target) * 100)) : 0;
              const done = current >= plan.target;

              // units 类型显示已选章节详情
              const unitDetail =
                plan.type === 'units' && plan.selectedLists
                  ? ` (${plan.selectedLists.length} 章)`
                  : '';

              return (
                <div
                  key={plan.id}
                  className="liquid-glass-shine relative rounded-xl border g-border p-4"
                >
                  <button
                    onClick={() => removePlan(plan.id)}
                    className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-destructive"
                    aria-label="删除计划"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      {PLAN_TYPE_LABEL[plan.type]}
                      {unitDetail}
                    </span>
                    {done && (
                      <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        <CalendarCheck className="h-3 w-3" /> 已完成
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-foreground">{plan.title}</div>

                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{current} / {plan.target}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full g-panel">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%`, transitionDuration: 'var(--duration-slow)' }}
                    />
                  </div>

                  {/* 自定义任务：可勾选 */}
                  {plan.type === 'custom' && plan.tasks && plan.tasks.length > 0 && (
                    <ul className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                      {plan.tasks.map((t) => (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() => toggleTask(plan.id, t.id)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className={t.done ? 'text-muted-foreground line-through' : ''}>
                              {t.text}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 章节类型：展示已选章节列表 */}
                  {plan.type === 'units' && plan.selectedLists && plan.selectedLists.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {plan.selectedLists.slice(0, 6).map((lk) => {
                        const label = lk.split('::').pop() ?? lk;
                        const isDone = (() => {
                          const p = progress[lk];
                          return p && p.total > 0 && p.reviewed >= p.total;
                        })();
                        return (
                          <span
                            key={lk}
                            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] ${
                              isDone ? 'bg-success/15 text-success' : 'g-panel text-muted-foreground'
                            }`}
                          >
                            {isDone ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                            {label}
                          </span>
                        );
                      })}
                      {plan.selectedLists.length > 6 && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/60">
                          +{plan.selectedLists.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>制定学习计划</DialogTitle>
            <DialogDescription>选择题库章节、设定单词目标或自定义任务，进度自动跟踪。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Tabs value={type} onValueChange={(v) => setType(v as PlanType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="units">完成章节</TabsTrigger>
                <TabsTrigger value="words">单词目标</TabsTrigger>
                <TabsTrigger value="custom">自定义</TabsTrigger>
              </TabsList>

              {/* Tab 1：选择词库章节（每个 List 即一章） */}
              <TabsContent value="units" className="space-y-2 pt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  每章对应一个 List，完成任意一章进度 +1。已选 <strong className="text-foreground">{selectedCount}</strong> 章。
                </p>
                <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl g-panel p-2">
                  {partStructure.map((part) => {
                    const expanded = expandedParts.has(part.name);
                    const fullySel = isPartFullySelected(part.name);
                    return (
                      <div key={part.name}>
                        {/* Part 标题行：折叠 + 全选按钮 */}
                        <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5">
                          <button
                            onClick={() => togglePart(part.name)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {part.name}
                            <span className="ml-1 text-xs text-muted-foreground">({part.lists.length} 节 · {part.total} 词)</span>
                          </span>
                          <button
                            onClick={() => togglePartAll(part.name, !fullySel)}
                            className="shrink-0 rounded-md px-2 py-0.5 text-xs transition-colors hover:g-panel"
                            title={fullySel ? '取消全选' : '全选此模块'}
                          >
                            {fullySel ? '取消' : '全选'}
                          </button>
                        </div>
                        {/* 展开的 Lists */}
                        {expanded && (
                          <div className="ml-6 mb-1 space-y-0.5">
                            {part.lists.map((list) => {
                              const lk = getListKey(part.name, list.name);
                              const checked = selectedListKeys.has(lk);
                              const prog = progress[lk];
                              const pct = prog && prog.total > 0 ? Math.round((prog.reviewed / prog.total) * 100) : 0;
                              return (
                                <label
                                  key={lk}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:g-panel"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleList(lk)}
                                    className="h-3.5 w-3.5 accent-primary"
                                  />
                                  <span className={`min-w-0 flex-1 truncate ${checked ? 'text-primary' : 'text-foreground/80'}`}>
                                    {list.name}
                                  </span>
                                  {prog && prog.reviewed > 0 && (
                                    <span className="shrink-0 text-[11px] text-muted-foreground">{pct}%</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedCount > 0 && (
                  <p className="text-center text-xs text-primary">
                    已选 {selectedCount} 章，每完成一章计划进度 +1
                  </p>
                )}
              </TabsContent>

              <TabsContent value="words" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">设定一个单词数目标，累计复习达到即完成。</p>
              </TabsContent>
              <TabsContent value="custom" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">自行添加若干子任务，勾选完成即累计进度。</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="plan-title">计划名称</Label>
              <Input
                id="plan-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`例如：${PLAN_TYPE_LABEL[type]}计划`}
              />
            </div>

            {type === 'words' && (
              <div className="space-y-1.5">
                <Label htmlFor="plan-target">目标单词数</Label>
                <div className="mb-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTarget(45)}
                    className={`rounded-full px-3 py-1 text-xs transition-all ${target === 45 ? 'bg-primary text-primary-foreground' : 'g-panel text-muted-foreground hover:g-panel'}`}
                  >📖 新学 45词</button>
                  <button
                    type="button"
                    onClick={() => setTarget(50)}
                    className={`rounded-full px-3 py-1 text-xs transition-all ${target === 50 ? 'bg-primary text-primary-foreground' : 'g-panel text-muted-foreground hover:g-panel'}`}
                  >🔄 复习 50词</button>
                </div>
                <Input
                  id="plan-target"
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </div>
            )}

            {type === 'custom' && (
              <div className="space-y-2">
                <Label>子任务</Label>
                {tasks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Input
                      value={t.text}
                      onChange={(e) => {
                        const next = tasks.slice();
                        next[i] = { ...t, text: e.target.value };
                        setTasks(next);
                      }}
                      placeholder={`任务 ${i + 1}`}
                    />
                    <button
                      onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:g-panel hover:text-destructive"
                      aria-label="删除任务"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setTasks([...tasks, EMPTY_TASK()])}
                >
                  <Plus className="h-4 w-4" /> 添加任务
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={onCreate}
              disabled={
                (type === 'units' && selectedCount === 0) ||
                (type === 'custom' && validTasks.length === 0)
              }
            >
              创建计划
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
