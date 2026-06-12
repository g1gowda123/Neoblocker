import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NanoClassifier } from './ai-router';

describe('NanoClassifier', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should analyze text successfully', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue('  block  ')
    };
    vi.spyOn(NanoClassifier, 'getSession').mockResolvedValue(mockSession as any);

    const result = await NanoClassifier.analyze('some bad text');
    expect(result).toBe('BLOCK');
    expect(NanoClassifier.getSession).toHaveBeenCalled();
    expect(mockSession.prompt).toHaveBeenCalledWith('some bad text');
  });

  it('should return SAFE when getSession throws an error', async () => {
    const error = new Error('Failed to create session');
    vi.spyOn(NanoClassifier, 'getSession').mockRejectedValue(error);

    const result = await NanoClassifier.analyze('some text');
    expect(result).toBe('SAFE');
    expect(console.error).toHaveBeenCalledWith('NanoClassifier error:', error);
  });

  it('should return SAFE when session.prompt throws an error', async () => {
    const error = new Error('Prompt failed');
    const mockSession = {
      prompt: vi.fn().mockRejectedValue(error)
    };
    vi.spyOn(NanoClassifier, 'getSession').mockResolvedValue(mockSession as any);

    const result = await NanoClassifier.analyze('some text');
    expect(result).toBe('SAFE');
    expect(console.error).toHaveBeenCalledWith('NanoClassifier error:', error);
  });
});
