
import { useCallback, useState } from 'react';
import { Cloud, FileUp, X } from 'lucide-react';
import { useFileUpload } from '../hooks/useFileUpload';

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const { isUploading, uploadProgress, handleFileUpload, cancelUpload } = useFileUpload();

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      await handleFileUpload(files);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      await handleFileUpload(files);
      e.target.value = '';
    },
    [handleFileUpload]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative rounded-3xl p-8 sm:p-10 text-center transition-all duration-300 cursor-pointer overflow-hidden
        ${
          isDragging
            ? 'border-2 border-emerald-500 bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 shadow-2xl shadow-emerald-500/20'
            : 'border-2 border-slate-700/50 bg-slate-800/40 hover:border-slate-600/70 hover:bg-slate-800/60 hover:shadow-xl'
        }`}
    >
      <input
        type="file"
        multiple
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {isUploading && Object.keys(uploadProgress).length > 0 ? (
        <div className="relative z-0 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center border border-emerald-500/50">
            <Cloud className="w-8 h-8 text-emerald-400 animate-bounce" />
          </div>
          
          <div className="space-y-4 w-full max-w-md">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200 truncate">{fileName}</span>
                  <span className="text-sm font-medium text-emerald-400">{progress}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cancelUpload();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors border border-red-500/30"
          >
            <X className="w-4 h-4" />
            取消上传
          </button>
        </div>
      ) : (
        <div className="relative z-0 flex flex-col items-center gap-5">
          <div className={`relative transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}>
            <div className={`p-5 rounded-2xl transition-all duration-300
              ${
                isDragging 
                  ? 'bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-gradient-to-br from-slate-700/50 to-slate-800/50 text-slate-400 border border-slate-600/50 hover:from-slate-600/50 hover:to-slate-700/50'
              }`}
            >
              {isDragging ? (
                <Cloud className="w-12 h-12 animate-bounce" />
              ) : (
                <FileUp className="w-12 h-12" />
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-slate-200 font-semibold text-lg sm:text-xl">
              {isDragging ? '松开以上传文件' : '拖放文件到此处'}
            </p>
            <p className="text-slate-500 text-sm sm:text-base">
              或点击选择文件
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
