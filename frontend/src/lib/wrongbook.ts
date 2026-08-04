import apiClient from './api-client';

// 错题合集（后端随账号持久化，跨设备同步）
export interface WrongItem {
  id: string;
  text: string;
  imageUrl?: string;
  source: 'photo' | 'text';
  createdAt: number;
}

export interface WrongCollection {
  id: string;
  name: string;
  createdAt: number;
  items: WrongItem[];
  messages: { role: 'user' | 'assistant'; text: string; createdAt: number }[];
}

/** 列出当前用户的所有错题合集 */
export async function listCollections(): Promise<WrongCollection[]> {
  const { data } = await apiClient.get<{ collections: WrongCollection[] }>('/wrongbook');
  return data.collections || [];
}

/** 新建错题合集 */
export async function createCollection(name: string): Promise<WrongCollection> {
  const { data } = await apiClient.post<{ collection: WrongCollection }>('/wrongbook', { name });
  return data.collection;
}

/** 删除错题合集，返回剩余合集列表 */
export async function deleteCollection(id: string): Promise<WrongCollection[]> {
  const { data } = await apiClient.delete<{ collections: WrongCollection[] }>(`/wrongbook/${id}`);
  return data.collections;
}

/** 向合集添加错题（text 手动输入 / image 拍照识别），返回更新后的合集 */
export async function addItem(
  id: string,
  payload: { text?: string; image?: string },
): Promise<WrongCollection> {
  const { data } = await apiClient.post<{ collection: WrongCollection }>(
    `/wrongbook/${id}/items`,
    payload,
  );
  return data.collection;
}

/** 删除合集中的某条错题，返回更新后的合集 */
export async function removeItem(id: string, itemId: string): Promise<WrongCollection> {
  const { data } = await apiClient.delete<{ collection: WrongCollection }>(
    `/wrongbook/${id}/items/${itemId}`,
  );
  return data.collection;
}

/** 与某个合集的 AI 对话（隔离：仅基于该合集错题），返回 AI 文本 */
export async function wrongbookChat(
  id: string,
  messages: { role: 'user' | 'assistant'; text: string }[],
): Promise<string> {
  const { data } = await apiClient.post<{ content: string }>(`/wrongbook/${id}/chat`, { messages });
  return data.content || '';
}
