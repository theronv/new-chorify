// Shim for @clerk/clerk-react which imports react-dom (not available in React Native)
module.exports = {
  createPortal: (children) => children,
  flushSync: (fn) => fn(),
}
