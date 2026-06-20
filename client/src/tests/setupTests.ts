import "@testing-library/jest-dom";

// Mantine components use ResizeObserver internally; happy-dom doesn't provide it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mantine v9 Textarea autosize uses document.fonts (FontFaceSet); happy-dom doesn't implement it.
if (!document.fonts) {
  Object.defineProperty(document, "fonts", {
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
      ready: Promise.resolve(),
    },
  });
}
