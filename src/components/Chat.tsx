
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, Plus } from 'lucide-react';
import { Message } from '../../shared/types';
import { formatTime } from '../utils/format';
import { sendMessage } from '../utils/api';
import { useAppStore } from '../store';
import { useFileUpload } from '../hooks/useFileUpload';

interface ChatProps {
  messages: Message[];
}

export function Chat({ messages }: ChatProps) {
  const [input, setInput] = useState('');
  const deviceName = useAppStore((state) => state.deviceName);
  const deviceId = useAppStore((state) => state.deviceId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMe = (messageSenderId: string) => messageSenderId === deviceId;
  const { handleFileUpload } = useFileUpload();

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim()) return;
      try {
        await sendMessage(input.trim(), deviceName, deviceId);
        setInput('');
      } catch (error) {
        console.error('Send failed:', error);
      }
    },
    [input, deviceName, deviceId]
  );

  const handleChatFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        try {
          await handleFileUpload(files, async () => {
            // 上传完成后发送文件上传通知消息
            await sendMessage(`上传了文件: ${files.map(f => f.name).join(', ')}`, deviceName, deviceId);
          });
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }
      e.target.value = '';
    },
    [deviceName, deviceId, handleFileUpload]
  );

  const handlePlusClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-700/50 dark:to-slate-800/50 flex items-center justify-center mb-4 sm:mb-6 border border-slate-300/50 dark:border-slate-700/50">
              <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-400">开始聊天吧！</p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-600 mt-2">消息将实时同步到所有设备</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${isMe(message.senderId) ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[80%] sm:max-w-[70%] ${isMe(message.senderId) ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}
            >
              <span className="text-xs text-slate-600 dark:text-slate-500 px-2 font-medium">
                {message.sender} · {formatTime(message.timestamp)}
              </span>
              <div
                className={`px-4 sm:px-5 py-3 sm:py-4 rounded-2xl shadow-lg transition-all duration-300 max-w-full overflow-hidden ${
                  isMe(message.senderId)
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-tr-sm text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 dark:from-emerald-600 dark:to-emerald-700'
                    : 'bg-gradient-to-br from-slate-100 to-slate-200 rounded-tl-sm text-slate-800 shadow-slate-200/25 hover:shadow-slate-200/40 border border-slate-200/50 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200 dark:shadow-slate-900/25 dark:hover:shadow-slate-900/40 dark:border dark:border-slate-700/50'
                }`}
              >
                <p className="whitespace-pre-wrap break-all text-sm sm:text-base leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSend} className="p-4 sm:p-5 border-t border-slate-200/50 bg-slate-50/40 dark:border-slate-700/50 dark:bg-slate-900/40 backdrop-blur-sm">
        <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleChatFileUpload}
          />
        <div className="flex gap-2 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl bg-white/60 border border-slate-200/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500/70 focus:bg-white transition-all duration-300 text-sm sm:text-base dark:bg-slate-800/60 dark:border-slate-700/50 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:bg-slate-800"
          />
          <button
            type="button"
            onClick={handlePlusClick}
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl transition-all duration-300 shadow-lg ${
              input.trim()
                ? 'hidden'
                : 'bg-gradient-to-r from-slate-200 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 font-semibold shadow-slate-200/25 hover:shadow-slate-200/40 hover:scale-105 active:scale-95 dark:from-slate-700 dark:to-slate-800 dark:hover:from-slate-600 dark:hover:to-slate-700 dark:text-white dark:shadow-slate-900/25 dark:hover:shadow-slate-900/40'
            }`}
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl transition-all duration-300 shadow-lg ${
              input.trim()
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 dark:from-emerald-600 dark:to-cyan-600 dark:hover:from-emerald-500 dark:hover:to-cyan-500'
                : 'hidden'
            }`}
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </form>
    </div>
  );
}
