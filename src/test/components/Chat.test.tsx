import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chat } from '../../components/Chat';
import { useAppStore } from '../../store';
import { Message } from '../../../shared/types';

vi.mock('../../utils/api', () => ({
  sendMessage: vi.fn().mockResolvedValue({ id: '1', content: 'test', sender: 'me', senderId: 'dev-1', timestamp: new Date().toISOString() }),
}));

vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    isUploading: false,
    uploadProgress: {},
    handleFileUpload: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    content: 'Hello from me',
    sender: 'Me',
    senderId: 'dev-1',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'msg-2',
    content: 'Hello from other',
    sender: 'Other',
    senderId: 'dev-2',
    timestamp: new Date().toISOString(),
  },
];

describe('Chat', () => {
  beforeEach(() => {
    useAppStore.setState({
      deviceName: 'TestDevice',
      deviceId: 'dev-1',
      messages: [],
      files: [],
      networkInfo: null,
    });
  });

  it('should render empty state when no messages', () => {
    render(<Chat messages={[]} />);
    expect(screen.getByText('开始聊天吧！')).toBeInTheDocument();
  });

  it('should render messages', () => {
    render(<Chat messages={mockMessages} />);
    expect(screen.getByText('Hello from me')).toBeInTheDocument();
    expect(screen.getByText('Hello from other')).toBeInTheDocument();
  });

  it('should render sender names', () => {
    render(<Chat messages={mockMessages} />);
    expect(screen.getByText(/Me/)).toBeInTheDocument();
    expect(screen.getByText(/Other/)).toBeInTheDocument();
  });

  it('should render text input', () => {
    render(<Chat messages={[]} />);
    expect(screen.getByPlaceholderText('输入消息...')).toBeInTheDocument();
  });

  it('should show submit button when input has text', async () => {
    const user = userEvent.setup();
    render(<Chat messages={[]} />);

    const input = screen.getByPlaceholderText('输入消息...');
    await user.type(input, 'Hello');

    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton?.classList.contains('hidden')).toBe(false);
  });

  it('should show plus button when input is empty', () => {
    render(<Chat messages={[]} />);
    const plusButton = document.querySelector('button[type="button"]');
    expect(plusButton).toBeInTheDocument();
  });

  it('should call sendMessage on form submit', async () => {
    const { sendMessage } = await import('../../utils/api');
    const user = userEvent.setup();
    render(<Chat messages={[]} />);

    const input = screen.getByPlaceholderText('输入消息...');
    await user.type(input, 'Test message');

    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    await user.click(submitButton);

    expect(sendMessage).toHaveBeenCalledWith('Test message', 'TestDevice', 'dev-1');
  });

  it('should not send empty message', async () => {
    const { sendMessage } = await import('../../utils/api');
    const mockedSendMessage = vi.mocked(sendMessage);
    mockedSendMessage.mockClear();

    render(<Chat messages={[]} />);
    const form = screen.getByPlaceholderText('输入消息...').closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('should clear input after sending message', async () => {
    const user = userEvent.setup();
    render(<Chat messages={[]} />);

    const input = screen.getByPlaceholderText('输入消息...');
    await user.type(input, 'Test message');

    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    await user.click(submitButton);

    expect(input).toHaveValue('');
  });

  it('should display file input', () => {
    render(<Chat messages={[]} />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });
});
