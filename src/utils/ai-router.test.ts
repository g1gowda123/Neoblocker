import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NanoClassifier, analyzeContent } from './ai-router';
import type { ExtensionSettings } from './storage';

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

describe('analyzeContent outer error path', () => {
  const mockSettings: ExtensionSettings = {
    enableToxicity: true,
    enableBias: true,
    toxicityThreshold: 0.50,
    biasThreshold: 0.50,
    theme: "dark",
    exceptions: "",
    enableObscene: true,
    racismThreshold: 0.25,
    filterMode: "blur",
    bannedKeywords: "",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should return SAFE when analysis pipeline fails completely', async () => {
    // Force a synchronous error to be thrown inside analyzeContent
    // to trigger the outer catch block.
    // We can do this by passing a mock settings object that throws on access
    const errorSettings = new Proxy(mockSettings, {
      get(target, prop) {
        if (prop === 'exceptions') {
          throw new Error('Forced sync error');
        }
        return Reflect.get(target, prop);
      }
    });

    const text = 'This is a test text that is long enough';

    const result = await analyzeContent(text, errorSettings);

    expect(result).toEqual({ action: 'SAFE' });
    expect(console.error).toHaveBeenCalledWith("Analysis pipeline failed:", expect.any(Error));
  });
});
