export interface ChatMessageModel {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface ChatSource {
  type: 'resume' | 'jd';
  chunkId: string;
  excerpt: string;
}