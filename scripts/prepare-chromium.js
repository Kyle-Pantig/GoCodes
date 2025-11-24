/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Only run on Vercel builds (production)
if (process.env.VERCEL || process.env.CI) {
  console.log('Preparing Chromium for Vercel deployment...');
  
  try {
    // Import chromium (build-time dependency)
    const chromium = require('@sparticuz/chromium');
    
    // Verify chromium package is available
    if (chromium && typeof chromium.executablePath === 'function') {
      // Create public directory if it doesn't exist
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // The chromium-min package will handle downloading at runtime
      // We just need to ensure the package is available
      console.log('Chromium package prepared for Vercel deployment');
    }
  } catch (error) {
    console.warn('Warning: Could not prepare Chromium:', error.message);
    console.warn('This is normal for local development. Chromium will be downloaded at runtime on Vercel.');
  }
} else {
  console.log('Skipping Chromium preparation (local development)');
}

