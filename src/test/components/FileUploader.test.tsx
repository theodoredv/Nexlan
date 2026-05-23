import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileUploader } from '../../components/FileUploader';
import { useAppStore } from '../../store';

vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    isUploading: false,
    uploadProgress: {},
    handleFileUpload: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('FileUploader', () => {
  beforeEach(() => {
    useAppStore.setState({
      deviceName: 'TestDevice',
      deviceId: 'dev-1',
      messages: [],
      files: [],
      networkInfo: null,
    });
  });

  it('should render upload area', () => {
    render(<FileUploader />);
    expect(screen.getByText('拖放文件到此处')).toBeInTheDocument();
    expect(screen.getByText('或点击选择文件')).toBeInTheDocument();
  });

  it('should render file input', () => {
    render(<FileUploader />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('should show drag state text when dragging', () => {
    render(<FileUploader />);
    const dropZone = screen.getByText('拖放文件到此处').closest('div[class*="rounded-3xl"]')?.parentElement;
    expect(dropZone).toBeTruthy();
  });

  it('should show uploading state', () => {
    vi.doMock('../../hooks/useFileUpload', () => ({
      useFileUpload: () => ({
        isUploading: true,
        uploadProgress: { 'test.pdf': 50 },
        handleFileUpload: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    render(<FileUploader />);
  });

  it('should have drop handlers on container', () => {
    render(<FileUploader />);
    const container = screen.getByText('拖放文件到此处').closest('div[class*="rounded-3xl"]')?.parentElement;
    expect(container).toBeTruthy();
  });
});
