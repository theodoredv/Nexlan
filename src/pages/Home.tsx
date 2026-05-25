import { useEffect, useState } from 'react';
import { FileList } from '../components/FileList';
import { Chat } from '../components/Chat';
import { NetworkBar } from '../components/NetworkBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getFiles, getMessages, subscribeToMessages, subscribeToFiles } from '../utils/api';
import { useAppStore } from '../store';
import { MessageSquare, FileText } from 'lucide-react';
import { Message } from '../../shared/types';

const uploadedChunksMap: { [key: string]: Set<number> } = {};

function cleanupUploadedChunks(fileId: string) {
  delete uploadedChunksMap[fileId];
}

export function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const messages = useAppStore(function (state) {
    return state.messages;
  });
  const setFiles = useAppStore(function (state) {
    return state.setFiles;
  });
  const setMessages = useAppStore(function (state) {
    return state.setMessages;
  });
  const addMessage = useAppStore(function (state) {
    return state.addMessage;
  });
  const updateMessageSender = useAppStore(function (state) {
    return state.updateMessageSender;
  });
  const addFile = useAppStore(function (state) {
    return state.addFile;
  });
  const removeFile = useAppStore(function (state) {
    return state.removeFile;
  });
  const removeMessage = useAppStore(function (state) {
    return state.removeMessage;
  });
  const removeMessagesBatch = useAppStore(function (state) {
    return state.removeMessagesBatch;
  });
  
  useEffect(function () {
    async function fetchData() {
      try {
        const [filesData, messagesData] = await Promise.all([getFiles(), getMessages()]);
        setFiles(filesData);
        setMessages(messagesData);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    }
    fetchData();

    const unsubscribeMessages = subscribeToMessages(function (data) {
      if ('type' in data && data.type === 'update-sender') {
        updateMessageSender(data.senderId, data.newName);
      } else if ('type' in data && data.type === 'delete') {
        removeMessage(data.id);
      } else if ('type' in data && data.type === 'delete-batch') {
        removeMessagesBatch(data.ids);
      } else {
        addMessage(data as Message);
      }
    }, function onReconnect() {
      getMessages().then(setMessages).catch(function (e) { console.error('Reconnect fetch messages failed:', e); });
    });

    const unsubscribeFiles = subscribeToFiles(
      function (uploadedFiles) {
        uploadedFiles.forEach(function (file) {
          cleanupUploadedChunks(file.id);
          setFiles(prevFiles => {
            const tempFile = prevFiles.find(f => f.name === file.name && f.status === 'uploading');
            if (tempFile) {
              return prevFiles.map(f => 
                f.id === tempFile.id ? file : f
              );
            } else {
              const exists = prevFiles.some(f => f.id === file.id);
              if (!exists) {
                return [file, ...prevFiles];
              }
              return prevFiles;
            }
          });
        });
      },
      function (fileId) {
        cleanupUploadedChunks(fileId);
        removeFile(fileId);
      },
      function (uploadingFiles) {
        uploadingFiles.forEach(function (file) {
          addFile(file);
          uploadedChunksMap[file.id] = new Set();
        });
      },
      function (fileId, chunkIndex, totalChunks) {
        if (!uploadedChunksMap[fileId]) {
          uploadedChunksMap[fileId] = new Set();
        }
        uploadedChunksMap[fileId].add(chunkIndex);
        const progress = Math.round((uploadedChunksMap[fileId].size / totalChunks) * 100);

        setTimeout(function () {
          setFiles(function (prevFiles) {
            return prevFiles.map(function (file) {
              if (file.id === fileId) {
                return { ...file, progress };
              }
              return file;
            });
          });
        }, 0);
      },
      function onReconnect() {
        getFiles().then(setFiles).catch(function (e) { console.error('Reconnect fetch files failed:', e); });
      }
    );

    return function () {
      unsubscribeMessages();
      unsubscribeFiles();
    };
  }, [setFiles, setMessages, addMessage, updateMessageSender, addFile, removeFile, removeMessage, removeMessagesBatch]);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <NetworkBar />
      
      <div className="lg:hidden flex border-b border-slate-200/50 bg-slate-50/40 dark:border-slate-700/50 dark:bg-slate-900/40 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 sm:py-4 flex items-center justify-center gap-1.5 transition-all duration-300 ${
            activeTab === 'chat'
              ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 border-b-2 border-transparent'
          }`}
        >
          <MessageSquare className="w-4.5 h-4.5" />
          <span className="text-sm font-medium">聊天</span>
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2.5 sm:py-4 flex items-center justify-center gap-1.5 transition-all duration-300 ${
            activeTab === 'files'
              ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 border-b-2 border-transparent'
          }`}
        >
          <FileText className="w-4.5 h-4.5" />
          <span className="text-sm font-medium">文件</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 h-full flex flex-col">
          {/* 桌面端布局 */}
          <div className="hidden lg:block h-full">
            <div className="flex flex-row gap-4 lg:gap-6 h-full">
              <div className="flex-1 w-1/2 flex flex-col min-h-0">
                <div className="flex-1 glass rounded-3xl p-4 sm:p-5 lg:p-6 overflow-hidden flex flex-col min-h-0">
                  <h2 className="text-slate-200 font-semibold text-base sm:text-lg mb-4 flex items-center gap-2 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    文件列表
                  </h2>
                  <div className="flex-1 overflow-y-auto pr-1">
                    <ErrorBoundary>
                      <FileList />
                    </ErrorBoundary>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 w-1/2 flex flex-col min-h-0">
                <div className="glass rounded-3xl overflow-hidden min-h-0 flex flex-col h-full">
                  <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 border-b border-slate-700/50 bg-slate-900/30 flex-shrink-0">
                    <h2 className="text-slate-200 font-semibold text-base sm:text-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      实时聊天
                    </h2>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ErrorBoundary>
                      <Chat messages={messages} />
                    </ErrorBoundary>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 移动端布局 */}
          <div className="lg:hidden h-full">
            {activeTab === 'chat' ? (
            <div className="glass rounded-3xl overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-hidden">
                <ErrorBoundary>
                  <Chat messages={messages} />
                </ErrorBoundary>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-4 sm:p-5 lg:p-6 overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-y-auto pr-1">
                <ErrorBoundary>
                  <FileList />
                </ErrorBoundary>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
