import { useCallback, useRef, useState } from 'react';
import { uploadFiles, sendMessage } from '../utils/api';
import { useAppStore } from '../store';
import { FileItem } from '../../shared/types';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const addFile = useAppStore((state) => state.addFile);
  const removeFile = useAppStore((state) => state.removeFile);
  const setFiles = useAppStore((state) => state.setFiles);
  const deviceName = useAppStore((state) => state.deviceName);
  const deviceId = useAppStore((state) => state.deviceId);

  const deviceNameRef = useRef(deviceName);
  const deviceIdRef = useRef(deviceId);
  deviceNameRef.current = deviceName;
  deviceIdRef.current = deviceId;

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleFileUpload = useCallback(
    async (files: File[], onUploadComplete?: () => void) => {
      if (files.length === 0) return;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsUploading(true);
      const tempFiles: FileItem[] = files.map((file) => ({
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'uploading',
        progress: 0,
      }));
      tempFiles.forEach((file) => addFile(file));

      try {
        await sendMessage(`开始上传文件: ${files.map(f => f.name).join(', ')}`, deviceNameRef.current, deviceIdRef.current);

        const tempFileIds = tempFiles.map(tf => tf.id);
        
        const uploadedFiles = await uploadFiles(files, (progress, fileName) => {
          setUploadProgress(prev => ({
            ...prev,
            [fileName]: progress
          }));
          
          setFiles(prevFiles => prevFiles.map(f => {
            if (tempFiles.some(tf => tf.id === f.id) && f.name === fileName) {
              return { ...f, progress };
            }
            return f;
          }));
        }, tempFileIds, abortController.signal);

        tempFiles.forEach((tempFile, index) => {
          if (uploadedFiles[index]) {
            const realFile = uploadedFiles[index];
            if (realFile.name === tempFile.name) {
              setFiles(prevFiles => prevFiles.map(f => 
                f.id === tempFile.id ? realFile : f
              ));
            } else {
              removeFile(tempFile.id);
            }
          } else {
            removeFile(tempFile.id);
          }
        });

        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          tempFiles.forEach((tempFile) => {
            setFiles(prevFiles => prevFiles.map(f => 
              f.id === tempFile.id ? { ...f, status: 'cancelled' as const } : f
            ));
          });
          setTimeout(() => {
            tempFiles.forEach((tempFile) => removeFile(tempFile.id));
          }, 1500);
          try {
            await sendMessage(`已取消上传: ${files.map(f => f.name).join(', ')}`, deviceNameRef.current, deviceIdRef.current);
          } catch (_e) { /* ignore */ }
        } else {
          console.error('Upload failed:', error);
          tempFiles.forEach((tempFile) => removeFile(tempFile.id));
          try {
            await sendMessage(`上传文件失败: ${files.map(f => f.name).join(', ')}`, deviceNameRef.current, deviceIdRef.current);
          } catch (e) {
            console.error('Failed to send error message:', e);
          }
        }
      } finally {
        setIsUploading(false);
        setUploadProgress({});
        abortControllerRef.current = null;
      }
    },
    [addFile, removeFile, setFiles]
  );

  return {
    isUploading,
    uploadProgress,
    handleFileUpload,
    cancelUpload,
  };
}
