
import { create } from 'zustand';
import { FileItem, Message, NetworkInfo } from '../../shared/types';

interface AppStore {
  files: FileItem[];
  messages: Message[];
  networkInfo: NetworkInfo | null;
  deviceName: string;
  deviceId: string;
  setFiles: (files: FileItem[] | ((prevFiles: FileItem[]) => FileItem[])) => void;
  addFile: (file: FileItem) => void;
  removeFile: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageSender: (senderId: string, newName: string) => void;
  removeMessage: (id: string) => void;
  removeMessagesBatch: (ids: string[]) => void;
  setNetworkInfo: (info: NetworkInfo) => void;
  setDeviceName: (name: string) => void;
}

const getInitialDeviceId = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlDeviceId = urlParams.get('deviceId');
  
  if (urlDeviceId) {
    localStorage.setItem('deviceId', urlDeviceId);
    return urlDeviceId;
  }
  
  const saved = localStorage.getItem('deviceId');
  if (saved) {
    return saved;
  }
  
  const deviceId = 'dev-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('deviceId', deviceId);
  return deviceId;
};

const getInitialDeviceName = (): string => {
  const saved = localStorage.getItem('deviceName');
  return saved || '';
};

export const useAppStore = create<AppStore>((set) => ({
  files: [],
  messages: [],
  networkInfo: null,
  deviceName: getInitialDeviceName(),
  deviceId: getInitialDeviceId(),
  setFiles: (files) => set((state) => ({
    files: typeof files === 'function' ? files(state.files) : files
  })),
  addFile: (file) => set((state) => {
    // 检查文件是否已经存在，避免重复添加
    const exists = state.files.some(f => f.id === file.id);
    if (exists) {
      return state; // 文件已存在，不添加
    }
    return { files: [file, ...state.files] };
  }),
  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessageSender: (senderId, newName) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.senderId === senderId ? { ...msg, sender: newName } : msg
    ),
  })),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((msg) => msg.id !== id),
  })),
  removeMessagesBatch: (ids) => set((state) => ({
    messages: state.messages.filter((msg) => !ids.includes(msg.id)),
  })),
  setNetworkInfo: (info) => set({ networkInfo: info }),
  setDeviceName: (name) => {
    localStorage.setItem('deviceName', name);
    set({ deviceName: name });
  },
}));

