const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3300');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'd:/XB/calendar-before-click.png', fullPage: false });

  const btn = page.locator('button:has-text("26")').first();
  console.log('button found:', await btn.isVisible());
  console.log('button text:', await btn.textContent());
  await btn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'd:/XB/calendar-after-click.png', fullPage: false });

  const summary = await page.locator('text=2026年7月26日').isVisible().catch(() => false);
  console.log('summary visible:', summary);

  await browser.close();
})();
