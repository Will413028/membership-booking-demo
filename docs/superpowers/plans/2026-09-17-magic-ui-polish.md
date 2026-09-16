# Magic UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task with verification checkpoints.

**Goal:** Upgrade the public marketing experience of the membership booking demo to a warmer, more premium visual system while preserving all booking, checkout, authentication, admin, and data behavior.

**Architecture:** Keep `shadcn/ui` and the existing Tailwind CSS token layer as the application foundation. Add a small local visual layer under `src/components/motion/` and `src/components/visual/`; use Magic UI's copy-paste patterns for restrained reveal and surface effects, and one Aceternity spotlight effect for the homepage hero. Marketing pages consume these components; forms, checkout, account, and admin flows keep their existing primitives and server boundaries.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.3, Tailwind CSS 4.3, existing `shadcn/ui` New York style, `motion`, Vitest, Testing Library, Biome, and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-membership-booking-demo-design.md`

## Global Constraints

- Preserve the existing server actions, Supabase queries, Stripe Checkout, Stripe webhook, authentication guards, RLS assumptions, and admin authorization behavior.
- Keep `components/ui/` reserved for existing shadcn primitives; product-specific visual components belong in `src/components/motion/` or `src/components/visual/`.
- Use no more than one prominent animated effect per viewport; decorative effects must be `aria-hidden` and must not carry business content.
- Respect `prefers-reduced-motion` through a root `MotionConfig reducedMotion="user"` policy and avoid animation of layout properties where opacity or transform is sufficient.
- Keep all public copy in Traditional Chinese or the existing intentional English brand labels; do not add lorem ipsum or fake testimonials.
- Do not add production credentials, Stripe payloads, user data, or generated local environment files to git.
- Each task ends with its focused test command before the next task begins.

---

### Task 1: Add the shared Motion foundation

**Files:**
- Modify: `package.json` and `pnpm-lock.yaml` through `pnpm add motion`.
- Create: `src/components/motion/motion-provider.tsx`.
- Create: `src/components/motion/reveal.tsx`.
- Create: `src/components/motion/reveal.test.tsx`.
- Modify: `src/test/setup.ts` with the minimal jsdom `IntersectionObserver` surface required by Motion's in-view observer.
- Modify: `src/app/layout.tsx` to mount the provider once around the existing application body.

**Interfaces:**
- `MotionProvider({ children }: { children: React.ReactNode }): JSX.Element` provides a site-wide `MotionConfig` with `reducedMotion="user"`.
- `Reveal({ children, className, delay }: { children: React.ReactNode; className?: string; delay?: number }): JSX.Element` renders one `motion.div` with `data-testid="reveal-surface"`, `data-reveal="true"`, and an in-view opacity/translate reveal for focused tests.

- [ ] **Step 1: Write the failing test.**

  In `src/components/motion/reveal.test.tsx`, render `Reveal` with a labelled child and assert the child is present, the wrapper exposes `data-reveal="true"`, and the optional class is preserved.

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, expect, it } from "vitest";
  import { Reveal } from "./reveal";

  describe("Reveal", () => {
    it("keeps content accessible while marking the animated surface", () => {
      render(
        <Reveal className="test-reveal">
          <p>預約你的下一堂課</p>
        </Reveal>,
      );

      expect(screen.getByText("預約你的下一堂課")).toBeInTheDocument();
      expect(screen.getByTestId("reveal-surface")).toHaveAttribute(
        "data-reveal",
        "true",
      );
      expect(screen.getByTestId("reveal-surface")).toHaveClass("test-reveal");
    });
  });
  ```

- [ ] **Step 2: Run the focused test and verify the expected red failure.**

  Run `pnpm vitest run src/components/motion/reveal.test.tsx`.

  Expected result: FAIL because `./reveal` does not exist yet, rather than a syntax or environment error.

- [ ] **Step 3: Add the dependency and minimal implementation.**

  Run `pnpm add motion`, then create the provider and reveal component. The reveal must use `motion/react`, set `initial={{ opacity: 0, y: 18 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, amount: 0.2 }}`, and a bounded `delay` transition. The provider must use `MotionConfig reducedMotion="user"` and must not add a client boundary around server data components beyond the provider itself.

- [ ] **Step 4: Run the focused test and verify green.**

  If jsdom reports `IntersectionObserver is not defined`, add only the no-op `observe`, `unobserve`, `disconnect`, and `takeRecords` methods to `src/test/setup.ts`; then run `pnpm vitest run src/components/motion/reveal.test.tsx` and expect 1 test passed.

- [ ] **Step 5: Mount the provider and run the layout regression tests.**

  Run `pnpm vitest run src/components/motion/reveal.test.tsx src/app/page.test.tsx` and expect all selected tests to pass.

- [ ] **Step 6: Commit the focused task.**

  Run `git diff --check && git commit --only -m "feat: add accessible motion foundation" -- package.json pnpm-lock.yaml src/components/motion/motion-provider.tsx src/components/motion/reveal.tsx src/components/motion/reveal.test.tsx src/test/setup.ts src/app/layout.tsx`.

### Task 2: Add restrained Magic UI and Aceternity visual primitives

**Files:**
- Create: `src/components/visual/spotlight.tsx` using the Aceternity spotlight pattern and `motion` dependency.
- Create: `src/components/visual/blur-fade.tsx` using the Magic UI blur-fade pattern.
- Create: `src/components/visual/visual-effects.test.tsx`.

**Interfaces:**
- `Spotlight({ className, fill }: { className?: string; fill?: string }): JSX.Element` renders an `aria-hidden="true"` decorative SVG/gradient layer and never owns user-facing copy.
- `BlurFade({ children, className, delay }: { children: React.ReactNode; className?: string; delay?: number }): JSX.Element` renders accessible children with a one-time opacity/blur entrance and forwards the class name.

- [ ] **Step 1: Write the failing tests.**

  Add tests that assert `Spotlight` is hidden from assistive technology and `BlurFade` keeps its child text in the document with `data-visual-effect` markers.

- [ ] **Step 2: Run `pnpm vitest run src/components/visual/visual-effects.test.tsx` and verify the imports fail because the two components are not present.**

- [ ] **Step 3: Add the minimal copy-paste implementations.**

  Use the official registry patterns as references: Magic UI's installation flow is compatible with the existing shadcn setup, and Aceternity exposes a shadcn CLI registry for the spotlight component. Keep the final files local and reviewable under `src/components/visual/`; do not add an entire third-party package or a second CSS framework. Decorative layers must be pointer-transparent and must not alter layout.

- [ ] **Step 4: Verify the focused visual tests pass.**

  Run `pnpm vitest run src/components/visual/visual-effects.test.tsx src/components/motion/reveal.test.tsx` and expect all selected tests to pass.

- [ ] **Step 5: Commit the focused task.**

  Run `git diff --check && git commit --only -m "feat: add premium visual effect primitives" -- src/components/visual/spotlight.tsx src/components/visual/blur-fade.tsx src/components/visual/visual-effects.test.tsx`.

### Task 3: Redesign the public homepage and header

**Files:**
- Modify: `src/app/page.tsx`.
- Modify: `src/components/layout/site-header.tsx`.
- Modify: `src/components/layout/site-footer.tsx` to give the footer the same brand hierarchy as the redesigned header and homepage.
- Modify: `src/app/page.test.tsx` with semantic and CTA assertions for the updated layout.

**Interfaces:**
- Continue exporting the same `HomePage`, `SiteHeader`, and `SiteFooter` components; no route or data contract changes.
- Reuse `Reveal`, `BlurFade`, and `Spotlight` without making the homepage a client component.

- [ ] **Step 1: Add or update failing assertions before changing the page.**

  Assert that the homepage still exposes a single main heading, the primary `/classes` CTA, the `/plans` CTA, and a decorative hero effect with `aria-hidden="true"`. Keep assertions semantic rather than snapshotting Tailwind class strings.

- [ ] **Step 2: Run `pnpm vitest run src/app/page.test.tsx` and confirm the new decorative/semantic assertion fails for the current page.**

- [ ] **Step 3: Implement the visual redesign.**

  Use an editorial hero with a warm paper background, an olive spotlight surface, a small eyebrow label, stronger CTA hierarchy, and an asymmetrical studio image/shape placeholder that does not require external assets. Add a restrained “today’s openings” section and a membership section with reveal timing. Keep all existing destination URLs and copy intent. Make decorative effects `aria-hidden`, keyboard navigation visible, and mobile layouts single-column with readable line lengths.

- [ ] **Step 4: Run the homepage test and verify green.**

  Run `pnpm vitest run src/app/page.test.tsx` and expect all tests in that file to pass.

- [ ] **Step 5: Commit the homepage task.**

  Run `git diff --check && git commit --only -m "feat: elevate homepage visual direction" -- src/app/page.tsx src/components/layout/site-header.tsx src/components/layout/site-footer.tsx src/app/page.test.tsx`.

### Task 4: Refine plans, classes, and public navigation surfaces

**Files:**
- Modify: `src/features/plans/components/plan-card.tsx`.
- Modify: `src/features/plans/components/plan-card.test.tsx`.
- Modify: `src/features/classes/components/class-card.tsx`.
- Modify: `src/features/classes/components/class-card.test.tsx`.
- Modify: `src/app/(marketing)/plans/page.tsx`.
- Modify: `src/app/(marketing)/classes/page.tsx`.
- Modify: `src/features/classes/components/class-filters.tsx` only for visual grouping and responsive spacing.

**Interfaces:**
- Preserve `PlanCard` checkout action props, plan pricing text, links, `ClassCard` session props, filters, and every existing `data-testid` used by tests and E2E.
- Do not move pricing, capacity, eligibility, or authentication decisions into presentation code.

- [ ] **Step 1: Add failing behavioral assertions for the new visual states.**

  Extend the existing component tests to assert the featured plan has a visible “推薦方案” label, full classes keep the existing “本堂已額滿” text, and all action links remain keyboard-visible by role/name. Do not assert implementation-only class names.

- [ ] **Step 2: Run the focused plan/class tests and verify the new assertions fail.**

  Run `pnpm vitest run src/features/plans/components/plan-card.test.tsx src/features/classes/components/class-card.test.tsx`.

- [ ] **Step 3: Implement the presentation changes.**

  Give the featured membership card a stronger border/halo and primary CTA, make the other plans visually subordinate without hiding their prices, and use small category/status chips for class metadata. Add hover/focus transitions using transform/opacity only. Style the public page headings and filter panel to match the homepage tokens. Keep loading, error, empty, full-capacity, unauthenticated, and pending-checkout states understandable without animation.

- [ ] **Step 4: Run the focused tests and verify green.**

  Run the same focused command and expect all selected tests to pass.

- [ ] **Step 5: Commit the public surface task.**

  Run `git diff --check && git commit --only -m "feat: polish public booking surfaces" -- src/features/plans/components/plan-card.tsx src/features/plans/components/plan-card.test.tsx src/features/classes/components/class-card.tsx src/features/classes/components/class-card.test.tsx 'src/app/(marketing)/plans/page.tsx' 'src/app/(marketing)/classes/page.tsx' src/features/classes/components/class-filters.tsx`.

### Task 5: Establish the final visual token and accessibility layer

**Files:**
- Modify: `src/app/globals.css`.

**Interfaces:**
- Preserve the current CSS variable names consumed by shadcn components (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, and radius tokens).
- Keep the public brand palette within the existing paper/ink/olive/sage/coral direction, adding only derived shadows, surface gradients, focus rings, selection styling, and reduced-motion defaults.

- [ ] **Step 1: Treat this as CSS configuration work, not a new function or component.** No vacuous unit test is added; acceptance is the final responsive browser smoke check plus the full unit suite in Task 6.

- [ ] **Step 2: Update the token layer.**

  Add consistent surface shadows, subtle grain/gradient utilities, hover transitions, visible `:focus-visible` treatment, `::selection`, and `@media (prefers-reduced-motion: reduce)` defaults. Avoid global transitions on every element and avoid styling that makes form controls or admin tables look like marketing cards.

- [ ] **Step 3: Verify typecheck and existing component tests.**

  Run `pnpm test` and expect the full current suite to pass with no new warnings.

- [ ] **Step 4: Commit the token task.**

  Run `git diff --check && git commit --only -m "feat: refine studio design tokens" -- src/app/globals.css src/app/layout.tsx`.

### Task 6: Full verification and deployment handoff

**Files:**
- No production files are changed in this task unless a verification command identifies a regression that belongs to one of Tasks 1–5.

- [ ] **Step 1: Run the full unit/component suite.**

  Run `pnpm test`; expected result is 0 failures and at least the baseline 155 tests plus the new visual tests.

- [ ] **Step 2: Run static checks.**

  Run `pnpm lint`; expected result is TypeScript and Biome success.

- [ ] **Step 3: Run the production build.**

  Run `pnpm build`; expected result is a successful Next.js production build with no missing `motion` or client-boundary errors.

- [ ] **Step 4: Run repository hygiene checks.**

  Run `git diff --check`, `git status --short`, and verify only intended feature commits exist on `feat/magic-ui-polish`; generated `.next`, `.vercel`, `.env.local`, and Supabase temp files remain untracked/ignored.

- [ ] **Step 5: Review the diff against the spec.**

  Confirm routes, actions, database contracts, Stripe behavior, and admin access code are unchanged except for presentation imports; confirm the homepage and public pages remain usable at mobile and desktop widths through the existing Playwright/browser smoke path when environment credentials are available.

- [ ] **Step 6: Hand off the verified branch for merge.**

  Run `git log --oneline --decorate -8` and report the branch, focused commits, test counts, lint/build results, and any hosted visual verification still requiring a browser capture. If a verification command fails, return to the owning task instead of patching production code in this final task.
