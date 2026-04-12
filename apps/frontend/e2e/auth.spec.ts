import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder(/name@company\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  });

  test('forgot password page renders correctly', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  test('legacy /login redirect goes to /auth/login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('design-system is hidden in production', async ({ page }) => {
    if (process.env.NODE_ENV !== 'production') {
      test.skip();
    }
    const response = await page.goto('/design-system');
    expect(response?.status()).toBe(404);
  });

  test('root / redirects to /inbox (then /auth/login if not authed)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(auth\/login|inbox)/);
  });
});
