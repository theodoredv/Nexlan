import { useCallback, useRef, useState } from 'react';
import { FileText, Download, Trash2, FolderOpen, Upload } from 'lucide-react';
import { FileItem } from '../../shared/types';
import { formatFileSize, getFileType } from '../utils/format';
import { downloadFile, deleteFile as deleteFileApi } from '../utils/api';
import { useAppStore } from '../store';
import { FilePreview } from './FilePreview';
import { useFileUpload } from '../hooks/useFileUpload';

const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

export function FileList() {
  const files = useAppStore((state) => state.files);
  const removeFile = useAppStore((state) => state.removeFile);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isUploading, uploadProgress, handleFileUpload } = useFileUpload();

  const openFilePreview = (file: FileItem) => {
    if (IS_MOBILE) {
      // 移动端使用现有弹窗
      setPreviewFile(file);
    } else {
      // 桌面端使用独立窗口
      const windowFeatures = 'width=800,height=600,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes';
      window.open(`/api/files/${file.id}/preview`, '_blank', windowFeatures);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await downloadFile(file.id, file.name);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (file: FileItem) => {
    try {
      await deleteFileApi(file.id);
      // 删除成功后也从本地状态中删除文件，不依赖SSE
      removeFile(file.id);
    } catch (error) {
      console.error('Delete failed:', error);
      // 即使删除失败（例如文件不存在），也从本地状态中删除该文件
      removeFile(file.id);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      await handleFileUpload(droppedFiles);
    },
    [handleFileUpload]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      await handleFileUpload(selectedFiles);
      e.target.value = '';
    },
    [handleFileUpload]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <div className="space-y-2.5 sm:space-y-3">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
          className={`hidden lg:flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
            isDragging
              ? 'bg-emerald-500/10 border-emerald-500/50'
              : 'bg-slate-100/20 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/40 dark:hover:bg-slate-800/40 hover:border-slate-300/60 dark:hover:border-slate-600/60'
          }`}
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          {isDragging ? (
            <>
              <Upload className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-bounce" />
              <span className="text-emerald-500 dark:text-emerald-400 font-medium text-sm">松开鼠标上传文件</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400 font-medium text-sm">拖拽文件到这里或点击上传</span>
            </>
          )}
        </div>
        
        {/* 上传进度显示 - 始终显示在顶部 */}
        {isUploading && Object.keys(uploadProgress).length > 0 && (
          <div className="glass rounded-3xl p-4">
            <div className="space-y-3">
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div key={fileName}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{fileName}</span>
                    <span className="text-sm font-medium text-emerald-500 dark:text-emerald-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {files.length === 0 && !isUploading && (
          <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-slate-500">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-700/50 dark:to-slate-800/50 flex items-center justify-center mb-4 border border-slate-200/50 dark:border-slate-700/50">
              <FolderOpen className="w-8 h-8 sm:w-9 sm:h-9 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400">暂无文件</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 mt-2">上传文件后将显示在这里</p>
          </div>
        )}

        {files.map((file) => {
          const fileType = getFileType(file.name);
          const isImageOrVideo = fileType === 'image' || fileType === 'video';
          
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-slate-50/40 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 hover:border-slate-300/60 dark:hover:border-slate-600/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-all duration-300 hover:shadow-md cursor-pointer"
              onClick={() => openFilePreview(file)}
            >
              <div className="flex-shrink-0 rounded-lg overflow-hidden border border-slate-200/30 dark:border-slate-700/30 hover:border-slate-300/50 dark:hover:border-slate-600/50 transition-all duration-300">
                {isImageOrVideo ? (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 relative overflow-hidden">
                    {fileType === 'image' ? (
                      <img
                        src={`/api/files/${file.id}/preview`}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full relative">
                        <img
                          src={file.status === 'uploading' ? '' : `/api/files/${file.id}/thumbnail`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-t-2 border-t-transparent border-l-4 border-l-white border-b-2 border-b-transparent ml-1" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 p-2.5 sm:p-3 bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-700/50 dark:to-slate-800/50 hover:from-slate-100/50 hover:to-slate-200/50 dark:hover:from-slate-600/50 dark:hover:to-slate-700/50 flex items-center justify-center">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors duration-300" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 relative" onClick={(e) => e.stopPropagation()}>
                <p 
                  className={`text-slate-800 dark:text-slate-200 font-medium text-sm hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors duration-300 cursor-pointer break-all ${expandedFileId === file.id ? '' : 'truncate'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedFileId(expandedFileId === file.id ? null : file.id);
                  }}
                  onMouseEnter={() => setHoveredFileId(file.id)}
                  onMouseLeave={() => setHoveredFileId(null)}
                >
                  {file.name}
                </p>
                {expandedFileId !== file.id && hoveredFileId === file.id && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 whitespace-nowrap z-50 hidden lg:block">
                    {file.name}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 rotate-45"></div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs mt-0.5">
                  {file.status === 'uploading' ? (
                    <span className="text-emerald-500 dark:text-emerald-400">
                      上传中 {Math.round(((file.progress || 0) / 100) * file.size / (1024 * 1024))}MB/{formatFileSize(file.size)}
                    </span>
                  ) : (
                    <span className="text-slate-500">{formatFileSize(file.size)}</span>
                  )}
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                  <span className="text-slate-500">{new Date(file.uploadedAt).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleDownload(file)}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all duration-300 hover:scale-110 active:scale-95"
                  title="下载"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 hover:scale-110 active:scale-95"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </>
  );
}
