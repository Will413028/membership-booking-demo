import "@testing-library/jest-dom/vitest";

declare global {
  const test: typeof import("vitest").test;
  const expect: typeof import("vitest").expect;
}
