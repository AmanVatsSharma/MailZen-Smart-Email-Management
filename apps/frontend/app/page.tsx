export default function HomePage() {
  // This route is redirected by `frontend/_middleware.ts`.
  // Keep a tiny fallback UI in case middleware is disabled in some environments.
  return <div className="min-h-screen" />;
} 