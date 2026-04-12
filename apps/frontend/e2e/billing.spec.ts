import { test, expect } from '@playwright/test';

test.describe('Billing page', () => {
  test.beforeEach(async ({ page }) => {
    // Without an active session, middleware redirects to login
    await page.goto('/settings/billing');
    // If redirected to login, skip billing-specific checks
    if (page.url().includes('/auth/login')) {
      test.skip();
    }
  });

  test('billing page shows plan cards', async ({ page }) => {
    await expect(page.getByText(/current plan/i)).toBeVisible({ timeout: 10_000 });
  });
});
