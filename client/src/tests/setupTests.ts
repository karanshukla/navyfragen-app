import "@testing-library/jest-dom";

// Mantine components use ResizeObserver internally; happy-dom doesn't provide it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
