import '@testing-library/jest-dom'

// Polyfill ResizeObserver for Recharts / other components that use it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
