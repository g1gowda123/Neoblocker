import { analyzeContent } from '../src/utils/ai-router';
import type { ExtensionSettings } from '../src/utils/storage';

// Mock chrome API which is used inside ai-router.ts
global.chrome = {
  runtime: {
    getURL: jest.fn().mockReturnValue('mock-url'),
    sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
  },
} as any;

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockRejectedValue(new Error('Mocked error')),
  env: { backends: { onnx: { wasm: {} } } }
}));

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

describe('analyzeContent', () => {
  it('should return SAFE when classifiers throw errors', async () => {
    const text = 'This is a test text that is long enough';
    const result = await analyzeContent(text, mockSettings);
    expect(result).toEqual({ action: 'SAFE' });
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

    // We expect console.error to be called with "Analysis pipeline failed:"
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await analyzeContent(text, errorSettings);

    expect(result).toEqual({ action: 'SAFE' });
    expect(consoleSpy).toHaveBeenCalledWith("Analysis pipeline failed:", expect.any(Error));

    consoleSpy.mockRestore();
  });
});
