import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, HardDrive, Users, Clock, Cpu, RefreshCw } from 'lucide-react';
import { getHealthInfo, type HealthInfo } from '../utils/api';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  parts.push(`${secs}秒`);
  return parts.join('');
}

interface ServerStatusProps {
  onClose: () => void;
}

export function ServerStatus({ onClose }: ServerStatusProps) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await getHealthInfo();
      setHealth(data);
    } catch {
      setError('无法获取服务器状态');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const diskUpdatedAt = health?.disk.updatedAt
    ? new Date(health.disk.updatedAt).toLocaleTimeString()
    : '-';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/50 max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-lg">服务器状态</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealth}
              disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading && !health ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={fetchHealth}
                className="mt-3 px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-400 transition-colors"
              >
                重试
              </button>
            </div>
          ) : health ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Clock className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-500 dark:text-slate-400 text-xs">运行时间</p>
                  <p className="text-slate-800 dark:text-slate-200 font-medium text-sm">{formatUptime(health.uptime)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
                  <HardDrive className="w-4 h-4 text-cyan-500" />
                  <span>磁盘占用</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">数据</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold">{health.disk.data}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                    <p className="text-slate-500 dark:text-slate-400 text-xs">上传文件</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold">{health.disk.uploads}</p>
                  </div>
                </div>
                <p className="text-slate-400 text-[10px]">更新于 {diskUpdatedAt}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
                  <Users className="w-4 h-4 text-violet-500" />
                  <span>SSE 连接数</span>
                  <span className="text-slate-400 text-xs ml-auto">总计 {health.sse.totalConnections}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(health.sse.channels).map(([name, ch]) => (
                    <div key={name} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                      <p className="text-slate-500 dark:text-slate-400 text-xs">{name}</p>
                      <p className="text-slate-800 dark:text-slate-200 font-semibold">{ch.connections}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
                  <Cpu className="w-4 h-4 text-amber-500" />
                  <span>内存使用</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">RSS</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">{health.memory.rss}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">堆使用</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">{health.memory.heapUsed}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/40">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">堆总量</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">{health.memory.heapTotal}</p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700/50">
          <p className="text-slate-400 text-[10px] text-center">每 5 秒自动刷新</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
