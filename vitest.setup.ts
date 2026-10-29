import { vi } from "vitest"

const storageData: Record<string, unknown> = {}

export function resetMockStorage() {
  for (const key of Object.keys(storageData)) delete storageData[key]
}

;(global as any).chrome = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    lastError: undefined
  },
  storage: {
    local: {
      get: (key: string, callback: (items: Record<string, unknown>) => void) => {
        callback({ [key]: storageData[key] })
      },
      set: (items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageData, items)
        callback?.()
      }
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
}
