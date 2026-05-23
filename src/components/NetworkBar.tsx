
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Wifi, Smartphone, Monitor, HelpCircle, MoreVertical, MessageSquare, Moon, Sun, User } from 'lucide-react';
import { getNetworkInfo, getDeviceName, setDeviceName as setDeviceNameApi, updateMessageSender } from '../utils/api';
import { useAppStore } from '../store';
import { ChatHistory } from './ChatHistory';

export function NetworkBar() {
  const networkInfo = useAppStore((state) => state.networkInfo);
  const setNetworkInfo = useAppStore((state) => state.setNetworkInfo);
  const deviceName = useAppStore((state) => state.deviceName);
  const setDeviceName = useAppStore((state) => state.setDeviceName);
  const deviceId = useAppStore((state) => state.deviceId);
  const [copied, setCopied] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(deviceName);
  const [loading, setLoading] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const info = await getNetworkInfo();
        setNetworkInfo(info);
      } catch (error) {
        console.error('Failed to get network info:', error);
      }
    }
    fetchInfo();
  }, [setNetworkInfo]);

  useEffect(() => {
    async function fetchDeviceName() {
      try {
        const result = await getDeviceName(deviceId);
        setDeviceName(result.name);
        setNewName(result.name);
      } catch (error) {
        console.error('Failed to get device name:', error);
      }
    }
    fetchDeviceName();
  }, [deviceId, setDeviceName]);

  useEffect(() => {
    if (showHelp && helpButtonRef.current) {
      const rect = helpButtonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const tooltipWidth = isMobile ? 192 : 256;
      setTooltipPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - tooltipWidth,
      });
    }
  }, [showHelp]);

  // 切换深色/浅色模式
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // 菜单按钮ref
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopy = async () => {
    if (!networkInfo) {
      return;
    }
    try {
      const urlWithDeviceId = `${networkInfo.url}?deviceId=${deviceId}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlWithDeviceId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = urlWithDeviceId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleCopyDeviceId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(deviceId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = deviceId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    } catch (error) {
      console.error('Copy device ID failed:', error);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await setDeviceNameApi(deviceId, newName.trim());
      await updateMessageSender(deviceId, newName.trim());
      setDeviceName(newName.trim());
      localStorage.setItem('deviceName', newName.trim());
      setEditingName(false);
    } catch (error) {
      console.error('Failed to save device name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setNewName(deviceName);
    setEditingName(false);
  };

  return (
    <div className="glass border-b border-slate-700/50 px-3 sm:px-6 py-2.5 sm:py-4 flex-shrink-0 relative z-40">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="p-1.5 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex-shrink-0">
              <Wifi className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Monitor className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-sm font-medium">局域网传输</span>
                <Smartphone className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400" />
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px] sm:text-sm">
                      {deviceName || '加载中...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[10px] sm:text-xs font-mono">
                      {deviceId}
                    </span>
                    <button
                      onClick={handleCopyDeviceId}
                      className="p-0.5 rounded bg-slate-200/60 text-slate-600 hover:text-slate-800 hover:bg-slate-300/60 transition-colors dark:bg-slate-800/60 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60"
                      title="复制设备ID"
                    >
                      {copiedDeviceId ? (
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      )}
                    </button>
                    <button
                      ref={helpButtonRef}
                      onMouseEnter={() => setShowHelp(true)}
                      onMouseLeave={() => setShowHelp(false)}
                      className="p-0.5 rounded bg-slate-200/60 text-slate-600 hover:text-slate-800 hover:bg-slate-300/60 transition-colors dark:bg-slate-800/60 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60"
                    >
                      <HelpCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                    {showHelp && typeof document !== 'undefined' && createPortal(
                      <div 
                        className="fixed w-48 sm:w-64 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
                        style={{ top: tooltipPosition.top, left: tooltipPosition.left, zIndex: 1000 }}
                      >
                        <p className="text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs leading-relaxed">
                          <span className="text-emerald-500 dark:text-emerald-400 font-semibold">如何跨浏览器识别为同一设备？</span>
                          <br />
                          1. 复制右侧带设备ID的链接
                          <br />
                          2. 在其他浏览器打开即可
                        </p>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0 relative z-50">
            {networkInfo && (
              <>
                <span className="text-emerald-400 font-mono text-[11px] sm:text-lg font-semibold tracking-tight truncate flex-1">
                  {networkInfo.url}
                </span>
                <button
                  onClick={handleCopy}
                  className="group flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium text-[11px] sm:text-sm transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </>
            )}
            {/* 直接的聊天记录按钮 */}
            <button
              onClick={() => setShowChatHistory(true)}
              className="p-2 rounded-xl bg-slate-200/60 text-slate-600 hover:text-slate-800 hover:bg-slate-300/60 transition-colors flex-shrink-0 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60"
              title="聊天记录"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            {/* 菜单按钮 - 标准实现 */}
            <div className="relative z-50">
              <button
                onClick={() => {
                  setShowMenu(!showMenu);
                }}
                className="p-2 rounded-xl bg-slate-200/60 text-slate-600 hover:text-slate-800 hover:bg-slate-300/60 transition-colors flex-shrink-0 relative z-50 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60"
                title="菜单"
              >
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              {/* 下拉菜单 */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden z-50">
                  <button
                    onClick={() => {
                      toggleDarkMode();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-left"
                  >
                    {darkMode ? (
                      <>
                        <Sun className="w-4 h-4 text-yellow-400" />
                        <span className="text-slate-800 dark:text-slate-200">浅色模式</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-800 dark:text-slate-200">深色模式</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditingName(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-green-500 dark:text-green-400" />
                    <span className="text-slate-800 dark:text-slate-200">修改昵称</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 昵称修改弹窗 */}
        {editingName && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/50 max-w-md w-full">
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-lg mb-4">修改昵称</h3>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-emerald-500/70 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-400 transition-colors"
                  placeholder="输入新昵称"
                  autoFocus
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveName}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {showChatHistory && createPortal(
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
            <ChatHistory onClose={() => setShowChatHistory(false)} />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

