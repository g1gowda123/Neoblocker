global.chrome = {
  runtime: {
    getURL: jest.fn().mockReturnValue('mock-url'),
    sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
  },
};
