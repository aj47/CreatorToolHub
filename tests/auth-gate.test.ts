import { test, expect } from '@playwright/test';

test.describe('Authentication Gate', () => {
  test('should show sign-in prompt when accessing thumbnails page without authentication', async ({ page }) => {
    // Set NODE_ENV to production to disable mock authentication
    await page.addInitScript(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' }
      });
    });

    // Navigate to the thumbnails page
    await page.goto('/thumbnails');

    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');

    // Check that the auth guard is displayed
    await expect(page.locator('text=Sign in required')).toBeVisible();
    await expect(page.locator('text=You need to be signed in to create thumbnails')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();

    // Verify that the main thumbnail creation interface is not visible
    await expect(page.locator('text=AI YouTube thumbnail generator')).not.toBeVisible();
    await expect(page.locator('text=Add Video(s)')).not.toBeVisible();
  });

  test('should redirect to Google OAuth when clicking sign in button', async ({ page }) => {
    // Set NODE_ENV to production to disable mock authentication
    await page.addInitScript(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' }
      });
    });

    // Navigate to the thumbnails page
    await page.goto('/thumbnails');

    // Wait for the auth guard to appear
    await expect(page.locator('text=Sign in required')).toBeVisible();

    // Click the sign in button and expect navigation to auth endpoint
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button:has-text("Sign in with Google")')
    ]);

    // Check that we're redirected to the auth endpoint
    expect(newPage.url()).toContain('/api/auth/signin');
  });

  test('should show thumbnail creation interface when authenticated in development', async ({ page }) => {
    // Set NODE_ENV to development to enable mock authentication
    await page.addInitScript(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'development' }
      });
    });
    
    // Navigate to the thumbnails page
    await page.goto('/thumbnails');
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    
    // In development mode, should show the main interface
    await expect(page.locator('text=AI YouTube thumbnail generator')).toBeVisible();
    await expect(page.locator('text=Add Video(s)')).toBeVisible();
    
    // Should not show the auth guard
    await expect(page.locator('text=Sign in required')).not.toBeVisible();
  });

  test('should allow navigation to home page from thumbnails page', async ({ page }) => {
    // Set NODE_ENV to production to disable mock authentication
    await page.addInitScript(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' }
      });
    });

    // Navigate to the thumbnails page
    await page.goto('/thumbnails');

    // Wait for the auth guard to appear
    await expect(page.locator('text=Sign in required')).toBeVisible();
    
    // Click on the Creator Tool Hub brand link to go home
    await page.click('a:has-text("Creator Tool Hub")');
    
    // Should be on the home page
    await expect(page.url()).toContain('/');
    await expect(page.locator('text=AI-powered tools for YouTube creators')).toBeVisible();
  });

  test('should show authentication gate immediately without allowing workflow progression', async ({ page }) => {
    // Set NODE_ENV to production to disable mock authentication
    await page.addInitScript(() => {
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' }
      });
    });

    // Navigate to the thumbnails page
    await page.goto('/thumbnails');

    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Verify that the stepper navigation is not visible (blocked by auth gate)
    await expect(page.locator('[aria-label="Thumbnail creation steps"]')).not.toBeVisible();
    
    // Verify that file input controls are not visible
    await expect(page.locator('input[type="file"]')).not.toBeVisible();
    
    // Verify that template selection is not visible
    await expect(page.locator('text=Templates')).not.toBeVisible();
    
    // The auth gate should be the primary content
    await expect(page.locator('.auth-guard-prompt')).toBeVisible();
  });
});
