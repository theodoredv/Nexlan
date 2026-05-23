
import { X, Download, Maximize, Minimize } from 'lucide-react';
import { FileItem } from '../../shared/types';
import { downloadFile } from '../utils/api';
import { getFileType } from '../utils/format';
import { useState, useRef, useEffect } from 'react';

interface FilePreviewProps {
  file: FileItem;
  onClose: () => void;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const fileType = getFileType(file.name);
  const previewUrl = `/api/files/${file.id}/preview`;
  
  // 检测是否为移动设备
  const isMobile = useRef(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  
  // 移动相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  // 大小相关状态
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: isMobile.current ? '95%' : '80%', height: isMobile.current ? '85vh' : '80vh' });
  const [isMaximized, setIsMaximized] = useState(false);
  const [originalSize, setOriginalSize] = useState({ width: isMobile.current ? '95%' : '80%', height: isMobile.current ? '85vh' : '80vh' });
  const [originalPosition, setOriginalPosition] = useState({ x: 0, y: 0 });
  
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    try {
      await downloadFile(file.id, file.name);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // 拖拽移动
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current || (e.target as HTMLElement).closest('.dialog-header')) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };


  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // 调整大小
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isMobile.current) return; // 移动端禁用调整大小
    e.stopPropagation();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  // 最大化/最小化
  const handleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
      setSize(originalSize);
      setPosition(originalPosition);
    } else {
      setOriginalSize(size);
      setOriginalPosition(position);
      setIsMaximized(true);
      setSize({ width: '98%', height: '98vh' });
      setPosition({ x: 0, y: 0 });
    }
  };

  // 处理鼠标移动
  const handleMouseMove = (e: MouseEvent) => {
    if (isMobile.current && isResizing) return;
    
    if (isDragging) {
      setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    } else if (isResizing) {
      // 计算新的大小
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // 转换当前大小为像素值
      const currentWidth = parseInt(size.width) || 80;
      const currentHeight = parseInt(size.height) || 80;
      
      // 计算新的大小
      let newWidth = currentWidth + deltaX;
      let newHeight = currentHeight + deltaY;
      
      // 限制最小大小
      newWidth = Math.max(400, newWidth);
      newHeight = Math.max(300, newHeight);
      
      // 限制最大大小
      newWidth = Math.min(window.innerWidth * 0.95, newWidth);
      newHeight = Math.min(window.innerHeight * 0.95, newHeight);
      
      setSize({ width: `${newWidth}px`, height: `${newHeight}px` });
      setStartPos({ x: e.clientX, y: e.clientY });
    }
  };

  // 全局鼠标事件监听
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, startPos, position, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderContent = () => {
    switch (fileType) {
      case 'image':
        return (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain"
          />
        );
      
      case 'video':
        return (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-full"
          >
            您的浏览器不支持视频播放
          </video>
        );
      
      case 'pdf':
        return (
          <iframe
            src={previewUrl}
            className="w-full h-full rounded-lg"
            title={file.name}
          />
        );
      
      case 'text':
        return (
          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-lg p-4 overflow-auto">
            <iframe
              src={previewUrl}
              className="w-full h-full"
              title={file.name}
            />
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700">
              <Download className="w-10 h-10 text-slate-600 dark:text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">{file.name}</p>
            <p className="text-sm text-slate-500 mb-4">不支持直接预览此文件类型</p>
            <button
              onClick={handleDownload}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载文件
            </button>
          </div>
        );
    }
  };

  if (isMobile.current) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-white font-medium text-sm truncate">{file.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="下载"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div 
        ref={dialogRef}
        className={`relative bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-300`}
        style={{
          width: size.width,
          height: size.height,
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 dialog-header">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className={`text-slate-800 dark:text-slate-200 font-semibold ${isMobile.current ? 'text-base' : 'text-lg'} truncate`}>{file.name}</h3>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="下载"
            >
              <Download className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title={isMaximized ? "恢复" : "最大化"}
            >
              {isMaximized ? <Minimize className="w-4 sm:w-5 h-4 sm:h-5" /> : <Maximize className="w-4 sm:w-5 h-4 sm:h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-3 sm:p-4 flex items-center justify-center">
          {renderContent()}
        </div>
        
        {/* 调整大小的手柄（仅桌面端） */}
        {!isMobile.current && (
          <div 
            className="absolute bottom-right-0 w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-tl-lg cursor-se-resize flex items-center justify-center"
            onMouseDown={handleResizeStart}
            style={{ cursor: isResizing ? 'se-resize' : 'se-resize' }}
          >
            <div className="w-3 h-3 border-b-2 border-r-2 border-slate-400 dark:border-slate-500" />
          </div>
        )}
      </div>
    </div>
  );
}
