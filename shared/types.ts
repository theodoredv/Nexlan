
export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  status?: 'uploading' | 'completed' | 'cancelled';
  progress?: number;
  thumbnailPath?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  senderId: string;
  timestamp: string;
}

export interface NetworkInfo {
  ip: string;
  port: number;
  url: string;
}

export type SSEMessage =
  | Message
  | { type: 'update-sender'; senderId: string; newName: string }
  | { type: 'delete'; id: string }
  | { type: 'delete-batch'; ids: string[] };
