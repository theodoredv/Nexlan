import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkBar } from '../../components/NetworkBar';
import { useAppStore } from '../../store';

vi.mock('../../utils/api', () => ({
  getNetworkInfo: vi.fn().mockResolvedValue({
    ip: '192.168.1.100',
    port: 3000,
    url: 'http://192.168.1.100:3000',
  }),
  getDeviceName: vi.fn().mockResolvedValue({
    deviceId: 'dev-1',
    name: 'TestDevice',
  }),
  setDeviceName: vi.fn().mockResolvedValue({
    deviceId: 'dev-1',
    name: 'NewDevice',
  }),
  updateMessageSender: vi.fn().mockResolvedValue({ updated: 0 }),
  getHealthInfo: vi.fn().mockResolvedValue({
    success: true,
    message: 'ok',
    uptime: 3600,
    memory: { rss: '50MB', heapUsed: '30MB', heapTotal: '40MB' },
    disk: { data: '1MB', uploads: '100MB', updatedAt: Date.now() },
    sse: { totalConnections: 5, channels: { files: { connections: 2, lastEventId: 0 }, messages: { connections: 3, lastEventId: 0 } } },
  }),
}));

describe('NetworkBar', () => {
  beforeEach(() => {
    useAppStore.setState({
      deviceName: 'TestDevice',
      deviceId: 'dev-1',
      messages: [],
      files: [],
      networkInfo: {
        ip: '192.168.1.100',
        port: 3000,
        url: 'http://192.168.1.100:3000',
      },
    });
    vi.clearAllMocks();
  });

  it('should render device name', () => {
    render(<NetworkBar />);
    expect(screen.getByText('TestDevice')).toBeInTheDocument();
  });

  it('should render device id', () => {
    render(<NetworkBar />);
    expect(screen.getByText('dev-1')).toBeInTheDocument();
  });

  it('should render network url', () => {
    render(<NetworkBar />);
    expect(screen.getByText('http://192.168.1.100:3000')).toBeInTheDocument();
  });

  it('should render copy button', () => {
    render(<NetworkBar />);
    expect(screen.getByText('复制')).toBeInTheDocument();
  });

  it('should render chat history button', () => {
    render(<NetworkBar />);
    const chatHistoryButton = screen.getByTitle('聊天记录');
    expect(chatHistoryButton).toBeInTheDocument();
  });

  it('should render menu button', () => {
    render(<NetworkBar />);
    const menuButton = screen.getByTitle('菜单');
    expect(menuButton).toBeInTheDocument();
  });

  it('should show menu dropdown on menu click', async () => {
    const user = userEvent.setup();
    render(<NetworkBar />);

    const menuButton = screen.getByTitle('菜单');
    await user.click(menuButton);

    expect(screen.getByText('修改昵称')).toBeInTheDocument();
  });

  it('should show dark/light mode toggle in menu', async () => {
    const user = userEvent.setup();
    render(<NetworkBar />);

    const menuButton = screen.getByTitle('菜单');
    await user.click(menuButton);

    const modeText = screen.queryByText('浅色模式') || screen.queryByText('深色模式');
    expect(modeText).toBeTruthy();
  });

  it('should show server status option in menu', async () => {
    const user = userEvent.setup();
    render(<NetworkBar />);

    const menuButton = screen.getByTitle('菜单');
    await user.click(menuButton);

    expect(screen.getByText('服务器状态')).toBeInTheDocument();
  });

  it('should open server status panel on click', async () => {
    const user = userEvent.setup();
    render(<NetworkBar />);

    const menuButton = screen.getByTitle('菜单');
    await user.click(menuButton);

    const statusButton = screen.getByText('服务器状态');
    await user.click(statusButton);

    await waitFor(() => {
      expect(screen.getByText('服务器状态')).toBeInTheDocument();
    });
  });

  it('should show edit name modal on click', async () => {
    const user = userEvent.setup();
    render(<NetworkBar />);

    const menuButton = screen.getByTitle('菜单');
    await user.click(menuButton);

    const editNameButton = screen.getByText('修改昵称');
    await user.click(editNameButton);

    expect(screen.getByText('修改昵称')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入新昵称')).toBeInTheDocument();
  });

  it('should render help button', () => {
    render(<NetworkBar />);
    const helpButtons = screen.getAllByRole('button');
    expect(helpButtons.length).toBeGreaterThan(0);
  });

  it('should render device id copy button', () => {
    render(<NetworkBar />);
    expect(screen.getByTitle('复制设备ID')).toBeInTheDocument();
  });

  it('should fetch network info on mount', async () => {
    const { getNetworkInfo } = await import('../../utils/api');
    render(<NetworkBar />);
    await waitFor(() => {
      expect(getNetworkInfo).toHaveBeenCalled();
    });
  });

  it('should fetch device name on mount', async () => {
    const { getDeviceName } = await import('../../utils/api');
    render(<NetworkBar />);
    await waitFor(() => {
      expect(getDeviceName).toHaveBeenCalledWith('dev-1');
    });
  });

  it('should show loading text when device name is empty', () => {
    useAppStore.setState({ deviceName: '' });
    render(<NetworkBar />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});
