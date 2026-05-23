
import { useState, useMemo } from 'react';
import { X, CheckSquare, Square, Trash2, Calendar, Search } from 'lucide-react';
import { formatTime } from '../utils/format';
import { deleteMessagesBatch } from '../utils/api';
import { useAppStore } from '../store';

interface ChatHistoryProps {
  onClose: () => void;
}

export function ChatHistory({ onClose }: ChatHistoryProps) {
  const messages = useAppStore((state) => state.messages);
  const removeMessagesBatch = useAppStore((state) => state.removeMessagesBatch);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  const filteredMessages = useMemo(() => {
    return [...messages].reverse().filter((msg) => {
      // 搜索筛选
      const matchesSearch = searchTerm === '' || 
        msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.sender.toLowerCase().includes(searchTerm.toLowerCase());

      // 日期筛选
      const msgDate = new Date(msg.timestamp);
      let matchesDate = true;
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && msgDate >= start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && msgDate <= end;
      }

      return matchesSearch && matchesDate;
    });
  }, [messages, searchTerm, startDate, endDate]);

  const allSelected = filteredMessages.length > 0 && filteredMessages.every((msg) => selectedIds.has(msg.id));

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((msg) => msg.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除 ${selectedIds.size} 条消息吗？`)) return;

    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await deleteMessagesBatch(ids);
      removeMessagesBatch(ids);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700/50" style={{ zIndex: 1001 }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-900/40 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-slate-800 dark:text-slate-200 font-semibold text-lg">聊天记录管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/20 dark:bg-slate-900/20">
          <div className="flex flex-col gap-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索消息内容或发送者..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-emerald-500/70 transition-colors"
              />
            </div>
            
            {/* 日期筛选 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-slate-600 dark:text-slate-400 text-sm">开始日期:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-emerald-500/70 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-slate-600 dark:text-slate-400 text-sm">结束日期:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-emerald-500/70 transition-colors"
                />
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 text-sm">已选 {selectedIds.size} 条</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600/60 text-slate-800 dark:text-slate-200 text-sm transition-colors flex items-center gap-1.5"
                >
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {allSelected ? '取消全选' : '全选'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={selectedIds.size === 0 || deleting}
                  className="px-3 py-1.5 rounded-lg bg-red-500 dark:bg-red-600/80 hover:bg-red-400 dark:hover:bg-red-500/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Calendar className="w-12 h-12 mb-3 text-slate-400 dark:text-slate-600" />
              <p className="text-slate-600 dark:text-slate-400">暂无消息</p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                onClick={() => toggleSelect(message.id)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedIds.has(message.id)
                    ? 'bg-emerald-500/15 border border-emerald-500/40'
                    : 'bg-slate-50/40 dark:bg-slate-800/40 border border-slate-200/30 dark:border-slate-700/30 hover:bg-slate-100/40 dark:hover:bg-slate-700/40'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(message.id);
                  }}
                  className="mt-0.5 flex-shrink-0"
                >
                  {selectedIds.has(message.id) ? (
                    <CheckSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-500 dark:text-emerald-400 text-sm font-medium">{message.sender}</span>
                    <span className="text-slate-500 text-xs">{formatTime(message.timestamp)}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed break-words">{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

