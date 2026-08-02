import { apiClient, API_BASE } from './api-client';

export interface Comment {
  _id: string;
  wordId: number;
  text: string;
  author: string;
  /** 作者头像（被封禁则为 null），由后端富化 */
  authorAvatar?: string | null;
  createdAt: number;
  /** AI 判定违规被自动隐藏；普通用户看不到 */
  hidden?: boolean;
  /** 隐藏原因（违规类别 + 说明），仅管理员可见 */
  flagReason?: string;
  /** 回复目标评论 ID（顶层评论无此字段） */
  parentId?: string;
  /** 被回复者昵称 */
  replyToAuthor?: string;
  /** 附图：本站上传产生的相对路径（如 uploads/ab12....jpg），渲染时拼 API_BASE */
  images?: string[];
  /** 点赞数量（评论级点赞，抖音风格） */
  likes?: number;
  /** 当前用户是否已点赞该评论 */
  liked?: boolean;
  /** 前端乐观更新标记：true 表示发送中（尚未被服务器确认） */
  pending?: boolean;
  /** 前端乐观更新标记：true 表示发送失败（可重试，图片保留在条目内） */
  failed?: boolean;
}

/** 把评论里存储的相对图片路径拼成可访问的完整 URL（兼容 /vs 子路径、绝对 URL 与 dataURL） */
export function commentImageUrl(img: string): string {
  if (/^(https?:\/\/|data:)/.test(img)) return img;
  return `${API_BASE}/${img.replace(/^\//, '')}`;
}

/** 上传一张图片（base64 dataURL）→ 返回相对路径（如 uploads/ab12....jpg） */
export async function uploadCommentImage(dataUrl: string): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>('/comments/upload', { image: dataUrl });
  return data.url;
}

/** 读取某目标下的评论（公开，按时间升序；管理员可额外看到被隐藏的评论） */
export async function fetchComments(wordId: number): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>('/comments', { params: { wordId } });
  // 防御：后端异常/502 可能返回非数组，避免评论列表 .map 崩溃
  return Array.isArray(data) ? data : [];
}

/** 读取全站「社区动态」（跨单词，按时间倒序，最多 60 条） */
export async function fetchCommunity(): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>('/comments/community');
  return Array.isArray(data) ? data : [];
}

/** 发表一条评论（鉴权可选：登录用户显示用户名，游客显示昵称/游客）。
 *  opts.parentId / opts.replyToAuthor 用于「回复某条评论」（抖音式嵌套）；
 *  opts.images 为已上传图片的相对路径数组。 */
export async function addComment(
  wordId: number,
  text: string,
  author?: string,
  opts?: { parentId?: string; replyToAuthor?: string; images?: string[] }
): Promise<Comment> {
  const body: {
    wordId: number;
    text: string;
    author?: string;
    parentId?: string;
    replyToAuthor?: string;
    images?: string[];
  } = { wordId, text };
  if (author && author.trim()) body.author = author.trim().slice(0, 16);
  if (opts?.parentId) body.parentId = opts.parentId;
  if (opts?.replyToAuthor) body.replyToAuthor = opts.replyToAuthor.slice(0, 16);
  if (opts?.images && opts.images.length) body.images = opts.images;
  const { data } = await apiClient.post<Comment>('/comments', body);
  return data;
}

/** 删除一条评论（作者本人或管理员） */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`);
}

/** 点赞 / 取消点赞一条评论（需登录，抖音风格） */
export async function toggleCommentLike(commentId: string): Promise<{ liked: boolean; likes: number }> {
  const { data } = await apiClient.post<{ liked: boolean; likes: number }>(`/comments/${commentId}/like`);
  return data;
}

/** 取消隐藏一条被 AI 标记的评论（仅管理员） */
export async function unhideComment(commentId: string): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(`/comments/${commentId}/unhide`);
  return data;
}
