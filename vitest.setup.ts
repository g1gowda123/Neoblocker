import { vi } from 'vitest';

(global as any).chrome = {
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    sendMessage: vi.fn().mockResolvedValue(undefined)
  }
};
