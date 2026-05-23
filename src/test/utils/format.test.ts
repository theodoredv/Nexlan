import { describe, it, expect } from 'vitest';
import { getFileType, formatFileSize, formatTime } from '../../utils/format';

describe('getFileType', () => {
  it('should identify image files', () => {
    expect(getFileType('photo.jpg')).toBe('image');
    expect(getFileType('photo.jpeg')).toBe('image');
    expect(getFileType('icon.png')).toBe('image');
    expect(getFileType('anim.gif')).toBe('image');
    expect(getFileType('logo.webp')).toBe('image');
    expect(getFileType('flag.svg')).toBe('image');
  });

  it('should identify video files', () => {
    expect(getFileType('movie.mp4')).toBe('video');
    expect(getFileType('clip.webm')).toBe('video');
    expect(getFileType('video.ogg')).toBe('video');
    expect(getFileType('clip.mov')).toBe('video');
    expect(getFileType('movie.mkv')).toBe('video');
  });

  it('should identify PDF files', () => {
    expect(getFileType('doc.pdf')).toBe('pdf');
  });

  it('should identify text files', () => {
    expect(getFileType('readme.txt')).toBe('text');
    expect(getFileType('doc.md')).toBe('text');
    expect(getFileType('data.json')).toBe('text');
    expect(getFileType('data.csv')).toBe('text');
    expect(getFileType('app.log')).toBe('text');
  });

  it('should return other for unknown extensions', () => {
    expect(getFileType('archive.zip')).toBe('other');
    expect(getFileType('program.exe')).toBe('other');
    expect(getFileType('data.bin')).toBe('other');
  });

  it('should handle uppercase extensions', () => {
    expect(getFileType('photo.JPG')).toBe('image');
    expect(getFileType('movie.MP4')).toBe('video');
    expect(getFileType('doc.PDF')).toBe('pdf');
  });

  it('should handle files without extension', () => {
    expect(getFileType('Makefile')).toBe('other');
  });
});

describe('formatFileSize', () => {
  it('should format 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('should format terabytes', () => {
    expect(formatFileSize(1099511627776)).toBe('1 TB');
  });
});

describe('formatTime', () => {
  it('should show only time for today', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30);
    const result = formatTime(today.toISOString());
    expect(result).toBe('14:30');
  });

  it('should prefix with 昨天 for yesterday', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    yesterday.setHours(10, 15);
    const result = formatTime(yesterday.toISOString());
    expect(result).toMatch(/^昨天/);
  });

  it('should show month and day for this year', () => {
    const now = new Date();
    const pastDate = new Date(now.getFullYear(), 0, 15, 9, 0);
    const result = formatTime(pastDate.toISOString());
    expect(result).toMatch(/1月15日/);
  });

  it('should show full date for previous years', () => {
    const result = formatTime('2023-06-15T10:30:00.000Z');
    expect(result).toMatch(/2023年/);
  });
});
