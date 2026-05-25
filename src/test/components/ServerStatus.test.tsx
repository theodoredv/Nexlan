import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerStatus } from '../../components/ServerStatus';

vi.mock('../../utils/api', () => ({
  getHealthInfo: vi.fn().mockResolvedValue({
    success: true,
    message: 'ok',
    uptime: 3661,
    memory: { rss: '50MB', heapUsed: '30MB', heapTotal: '40MB' },
    disk: { data: '1MB', uploads: '100MB', updatedAt: 1700000000000 },
    sse: { totalConnections: 5, channels: { files: { connections: 2, lastEventId: 0 }, messages: { connections: 3, lastEventId: 0 } } },
  }),
}));

describe('ServerStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render server status title', async () => {
    render(<ServerStatus onClose={vi.fn()} />);
    expect(screen.getByText('服务器状态')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<ServerStatus onClose={vi.fn()} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should display uptime after loading', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('1时1分1秒')).toBeInTheDocument();
    });
  });

  it('should display disk usage after loading', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('1MB')).toBeInTheDocument();
      expect(screen.getByText('100MB')).toBeInTheDocument();
    });
  });

  it('should display SSE connection counts', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should display memory info', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('50MB').length).toBeGreaterThan(0);
      expect(screen.getAllByText('30MB').length).toBeGreaterThan(0);
      expect(screen.getAllByText('40MB').length).toBeGreaterThan(0);
    });
  });

  it('should call onClose when backdrop clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(<ServerStatus onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('1MB')).toBeInTheDocument();
    });

    const backdrop = container.firstChild as HTMLElement;
    if (backdrop) {
      await userEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should show error state when fetch fails', async () => {
    const { getHealthInfo } = await import('../../utils/api');
    vi.mocked(getHealthInfo).mockRejectedValueOnce(new Error('Network error'));

    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('无法获取服务器状态')).toBeInTheDocument();
    });

    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('should refresh data on retry button click', async () => {
    const { getHealthInfo } = await import('../../utils/api');
    vi.mocked(getHealthInfo).mockRejectedValueOnce(new Error('Network error'));

    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('重试')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('重试'));

    await waitFor(() => {
      expect(getHealthInfo).toHaveBeenCalledTimes(2);
    });
  });

  it('should show auto refresh hint text', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('每 5 秒自动刷新')).toBeInTheDocument();
    });
  });

  it('should have refresh button', async () => {
    render(<ServerStatus onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTitle('刷新')).toBeInTheDocument();
    });
  });
});
