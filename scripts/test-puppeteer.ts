/**
 * Test script to verify Puppeteer installation and configuration
 * Run with: npm run test:puppeteer
 */

import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('🧪 Testing Puppeteer installation...\n');

  // Check platform
  console.log(`Platform: ${process.platform}`);
  console.log(`Node version: ${process.version}\n`);

  // Get executable path
  try {
    const executablePath = puppeteer.executablePath();
    console.log(`✓ Chrome executable found: ${executablePath}\n`);
  } catch (error) {
    console.error('✗ Could not find Chrome executable');
    console.error(error);
    console.log(
      '\nTry setting PUPPETEER_EXECUTABLE_PATH in your .env file\n'
    );
    process.exit(1);
  }

  // Try launching browser
  console.log('Attempting to launch browser...');
  let browser;

  try {
    const isWindows = process.platform === 'win32';

    // Use same config as browserPool
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
    ];

    const platformArgs = isWindows
      ? [
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
        ]
      : ['--no-zygote'];

    browser = await puppeteer.launch({
      headless: true,
      args: [...baseArgs, ...platformArgs],
      timeout: 30000,
      ...(isWindows && {
        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      }),
    });

    console.log('✓ Browser launched successfully\n');

    // Try creating a page and taking a screenshot
    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('✓ Page created\n');

    console.log('Setting content...');
    await page.setContent(
      '<html><body><h1>Puppeteer Test</h1><p>This is a test page to verify Puppeteer is working correctly.</p></body></html>'
    );
    console.log('✓ Content set\n');

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('✓ Screenshot saved to test-screenshot.png\n');

    await browser.close();
    console.log('✓ Browser closed\n');

    console.log('✅ All tests passed! Puppeteer is working correctly.\n');
    console.log('You can now run the Discord bot with: npm run dev\n');
  } catch (error) {
    console.error('✗ Browser test failed:');
    console.error(error);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    console.log('\n📋 Troubleshooting tips:');
    console.log('1. Make sure you have installed dependencies: npm install');
    console.log(
      '2. On Windows, you may need to set PUPPETEER_EXECUTABLE_PATH in .env'
    );
    console.log('3. Check that your antivirus is not blocking Chrome');
    console.log('4. Try reinstalling Puppeteer: npm uninstall puppeteer && npm install puppeteer');
    console.log('\nSee WINDOWS_SETUP.md for more help\n');

    process.exit(1);
  }
}

testPuppeteer();
