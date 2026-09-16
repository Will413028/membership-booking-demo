import "@testing-library/jest-dom/vitest";

if (!("IntersectionObserver" in globalThis)) {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class IntersectionObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  });
}

declare global {
  const test: typeof import("vitest").test;
  const expect: typeof import("vitest").expect;
}
