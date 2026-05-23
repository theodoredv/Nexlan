import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store';
import { FileItem, Message, NetworkInfo } from '../../../shared/types';

const mockFile: FileItem = {
  id: 'file-1',
  name: 'test.pdf',
  size: 1024,
  type: 'application/pdf',
  uploadedAt: '2025-01-01T00:00:00.000Z',
  status: 'completed',
};

const mockFile2: FileItem = {
  id: 'file-2',
  name: 'photo.jpg',
  size: 2048,
  type: 'image/jpeg',
  uploadedAt: '2025-01-01T00:00:00.000Z',
  status: 'completed',
};

const mockMessage: Message = {
  id: 'msg-1',
  content: 'Hello',
  sender: 'Alice',
  senderId: 'dev-1',
  timestamp: '2025-01-01T00:00:00.000Z',
};

const mockMessage2: Message = {
  id: 'msg-2',
  content: 'World',
  sender: 'Bob',
  senderId: 'dev-2',
  timestamp: '2025-01-01T00:01:00.000Z',
};

const mockNetworkInfo: NetworkInfo = {
  ip: '192.168.1.100',
  port: 3000,
  url: 'http://192.168.1.100:3000',
};

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      files: [],
      messages: [],
      networkInfo: null,
      deviceName: 'TestDevice',
      deviceId: 'dev-test',
    });
  });

  describe('files', () => {
    it('should set files', () => {
      useAppStore.getState().setFiles([mockFile, mockFile2]);
      expect(useAppStore.getState().files).toEqual([mockFile, mockFile2]);
    });

    it('should set files with updater function', () => {
      useAppStore.getState().setFiles([mockFile]);
      useAppStore.getState().setFiles((prev) => [...prev, mockFile2]);
      expect(useAppStore.getState().files).toEqual([mockFile, mockFile2]);
    });

    it('should add a file', () => {
      useAppStore.getState().addFile(mockFile);
      expect(useAppStore.getState().files).toEqual([mockFile]);
    });

    it('should add file to the beginning', () => {
      useAppStore.getState().addFile(mockFile);
      useAppStore.getState().addFile(mockFile2);
      expect(useAppStore.getState().files[0]).toEqual(mockFile2);
    });

    it('should not add duplicate file by id', () => {
      useAppStore.getState().addFile(mockFile);
      useAppStore.getState().addFile(mockFile);
      expect(useAppStore.getState().files).toHaveLength(1);
    });

    it('should remove a file by id', () => {
      useAppStore.getState().addFile(mockFile);
      useAppStore.getState().addFile(mockFile2);
      useAppStore.getState().removeFile('file-1');
      expect(useAppStore.getState().files).toEqual([mockFile2]);
    });

    it('should handle removing non-existent file', () => {
      useAppStore.getState().addFile(mockFile);
      useAppStore.getState().removeFile('non-existent');
      expect(useAppStore.getState().files).toEqual([mockFile]);
    });
  });

  describe('messages', () => {
    it('should set messages', () => {
      useAppStore.getState().setMessages([mockMessage, mockMessage2]);
      expect(useAppStore.getState().messages).toEqual([mockMessage, mockMessage2]);
    });

    it('should add a message', () => {
      useAppStore.getState().addMessage(mockMessage);
      expect(useAppStore.getState().messages).toEqual([mockMessage]);
    });

    it('should add message to the end', () => {
      useAppStore.getState().addMessage(mockMessage);
      useAppStore.getState().addMessage(mockMessage2);
      expect(useAppStore.getState().messages).toEqual([mockMessage, mockMessage2]);
    });

    it('should remove a message by id', () => {
      useAppStore.getState().setMessages([mockMessage, mockMessage2]);
      useAppStore.getState().removeMessage('msg-1');
      expect(useAppStore.getState().messages).toEqual([mockMessage2]);
    });

    it('should remove messages batch', () => {
      useAppStore.getState().setMessages([mockMessage, mockMessage2]);
      useAppStore.getState().removeMessagesBatch(['msg-1', 'msg-2']);
      expect(useAppStore.getState().messages).toEqual([]);
    });

    it('should remove messages batch partially', () => {
      useAppStore.getState().setMessages([mockMessage, mockMessage2]);
      useAppStore.getState().removeMessagesBatch(['msg-1']);
      expect(useAppStore.getState().messages).toEqual([mockMessage2]);
    });

    it('should update message sender', () => {
      useAppStore.getState().setMessages([mockMessage, mockMessage2]);
      useAppStore.getState().updateMessageSender('dev-1', 'NewAlice');
      const messages = useAppStore.getState().messages;
      expect(messages.find((m) => m.id === 'msg-1')?.sender).toBe('NewAlice');
      expect(messages.find((m) => m.id === 'msg-2')?.sender).toBe('Bob');
    });
  });

  describe('networkInfo', () => {
    it('should set network info', () => {
      useAppStore.getState().setNetworkInfo(mockNetworkInfo);
      expect(useAppStore.getState().networkInfo).toEqual(mockNetworkInfo);
    });
  });

  describe('deviceName', () => {
    it('should set device name', () => {
      useAppStore.getState().setDeviceName('NewDevice');
      expect(useAppStore.getState().deviceName).toBe('NewDevice');
    });

    it('should persist device name to localStorage', () => {
      useAppStore.getState().setDeviceName('PersistedDevice');
      expect(localStorage.getItem('deviceName')).toBe('PersistedDevice');
    });
  });
});
