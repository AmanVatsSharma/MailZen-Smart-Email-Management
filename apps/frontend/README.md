1. General Development Guidelines
   Always refer to the "Plan Doc" to track progress, avoid duplicates, and maintain clarity.
   Prefer the best scalable approach—code should be modular, reusable, and easy to extend.
   Work as if it's for production—optimize for performance, maintainability, and security.
   Follow a component-driven architecture—break down UI into reusable, atomic components.
2. Workflow & Structure
   Always check the existing progress before starting new work.
   Follow a structured directory system—categorize files properly.
   Use proper comments & documentation for maintainability.
   Ensure every module is independently testable before integration.
   When a module is completed and tested, mark it as ✅ in the "Plan Doc" and move to the next task.
3. UI & Component Development Standards
   Use ShadCN UI and TailwindCSS for styling.
   Ensure fully responsive layouts and support for dark mode.
   Keep design aesthetics professional (Apple-like, minimal, smooth animations).
   Maintain consistent spacing, padding, and contrast.
   Ensure accessibility (a11y) compliance with keyboard navigation.
   Keep animations subtle and smooth using Framer Motion.
4. Code Quality & Best Practices
   Follow Next.js 14 best practices (use Server Components where needed).
   Write clean, commented, and well-documented code.
   Always prefer scalable patterns—avoid shortcuts or hacks.
   Modularize functions, hooks, and components for reuse.
   Use TypeScript strictly—define proper types for all components.
   Maintain a clear folder structure (components/, hooks/, utils/, services/).
5. Testing & Verification
   Every module must be tested before integration.
   Write unit tests and integration tests where applicable.
   Ensure API calls and state management are optimized.
   Remove redundant code—optimize wherever possible.
6. Documentation & Checkmark System
   Create dedicated documentation directories for completed modules.
   Once a module is fully built and tested, move it to the completed section.
   Mark the completed work in the "Plan Doc" before moving to the next task.
   Keep track of pending, ongoing, and completed tasks clearly.
7. Continuous Improvement & Refactoring
   Always review older code for improvements.
   Prefer lazy loading and efficient state management.
   Ensure cross-browser compatibility and responsiveness.
   Optimize performance (reduce re-renders, use server components efficiently).

---

## Running the Frontend (Nx workspace)

### Prerequisites
- Node.js (v16+ recommended)

### Environment variables
- Copy `apps/frontend/env.local.example` to `apps/frontend/.env.local` and adjust values as needed.
- If you run via Nx (`nx serve frontend`), the workspace will also auto-create `apps/frontend/.env.local` if it's missing (it never overwrites).

### Development

From the repo root:

```bash
nx serve frontend
```

Or via npm script:

```bash
npm run dev:frontend
```
