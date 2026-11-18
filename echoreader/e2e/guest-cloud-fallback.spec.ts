import { test, expect } from '@playwright/test';

test('guest login has been removed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Continue as a guest')).toHaveCount(0);
  await expect(page.getByText('Welcome back')).toBeVisible();
  await expect(page.getByText('Create account', { exact: true }).first()).toBeVisible();
});
