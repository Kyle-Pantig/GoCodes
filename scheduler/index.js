/**
 * Asset Dog Scheduler Service
 * 
 * Runs multiple scheduled tasks:
 * - Every 5 minutes: Trigger automated reports
 * - Every day at midnight: Cleanup expired deleted assets and inventory
 * 
 * Deploy this as a separate Railway service.
 * 
 * Required Environment Variables:
 * - FASTAPI_BASE_URL: The backend API URL (e.g., https://asset-dog-backend.up.railway.app)
 * - CRON_SECRET: Secret key for authenticating cron requests
 * - TIMEZONE: Timezone for midnight cleanup (default: Asia/Manila)
 */

const fetch = require('node-fetch');

// Configuration
const REPORTS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const CLEANUP_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute if it's midnight
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Manila';

// Track last cleanup run to prevent duplicate runs
let lastCleanupDate = null;

// Validate environment variables
if (!FASTAPI_BASE_URL) {
  console.error('❌ ERROR: FASTAPI_BASE_URL environment variable is not set');
  process.exit(1);
}

if (!CRON_SECRET) {
  console.error('❌ ERROR: CRON_SECRET environment variable is not set');
  process.exit(1);
}

// Endpoints
const REPORTS_ENDPOINT = `${FASTAPI_BASE_URL}/api/cron/send-scheduled-reports`;
const CLEANUP_ASSETS_ENDPOINT = `${FASTAPI_BASE_URL}/api/cron/cleanup-deleted-assets`;
const CLEANUP_INVENTORY_ENDPOINT = `${FASTAPI_BASE_URL}/api/cron/cleanup-deleted-inventory`;

console.log('🚀 Asset Dog Scheduler Started');
console.log(`📍 Reports endpoint: ${REPORTS_ENDPOINT}`);
console.log(`📍 Cleanup assets endpoint: ${CLEANUP_ASSETS_ENDPOINT}`);
console.log(`📍 Cleanup inventory endpoint: ${CLEANUP_INVENTORY_ENDPOINT}`);
console.log(`⏰ Reports interval: ${REPORTS_INTERVAL_MS / 1000 / 60} minutes`);
console.log(`🕛 Cleanup schedule: Daily at midnight (${TIMEZONE})`);
console.log('-------------------------------------------');

/**
 * Get current date string in the configured timezone
 */
function getCurrentDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get current hour in the configured timezone
 */
function getCurrentHour() {
  return parseInt(new Date().toLocaleString('en-US', { 
    timeZone: TIMEZONE, 
    hour: 'numeric', 
    hour12: false 
  }));
}

/**
 * Call the cron endpoint to process scheduled reports
 */
async function triggerScheduledReports() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔄 Triggering scheduled reports...`);

  try {
    const response = await fetch(REPORTS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for report generation
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${timestamp}] ✅ Reports Success:`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[${timestamp}] ❌ Reports Failed (${response.status}):`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Reports Error:`, error.message);
  }
}

/**
 * Call the cleanup endpoint for deleted assets
 */
async function triggerCleanupAssets() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🗑️ Triggering cleanup of deleted assets...`);

  try {
    const response = await fetch(CLEANUP_ASSETS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${timestamp}] ✅ Cleanup Assets Success:`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[${timestamp}] ❌ Cleanup Assets Failed (${response.status}):`, JSON.stringify(data, null, 2));
    }
    return response.ok;
  } catch (error) {
    console.error(`[${timestamp}] ❌ Cleanup Assets Error:`, error.message);
    return false;
  }
}

/**
 * Call the cleanup endpoint for deleted inventory
 */
async function triggerCleanupInventory() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🗑️ Triggering cleanup of deleted inventory...`);

  try {
    const response = await fetch(CLEANUP_INVENTORY_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${timestamp}] ✅ Cleanup Inventory Success:`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[${timestamp}] ❌ Cleanup Inventory Failed (${response.status}):`, JSON.stringify(data, null, 2));
    }
    return response.ok;
  } catch (error) {
    console.error(`[${timestamp}] ❌ Cleanup Inventory Error:`, error.message);
    return false;
  }
}

/**
 * Run all cleanup tasks
 */
async function runCleanupTasks() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🌙 Starting midnight cleanup tasks...`);
  console.log('-------------------------------------------');
  
  await triggerCleanupAssets();
  await triggerCleanupInventory();
  
  console.log('-------------------------------------------');
  console.log(`[${timestamp}] ✅ Midnight cleanup tasks completed`);
}

/**
 * Check if it's midnight and run cleanup tasks
 */
async function checkAndRunCleanup() {
  const currentHour = getCurrentHour();
  const currentDate = getCurrentDateString();
  
  // Run cleanup at midnight (hour 0) and only once per day
  if (currentHour === 0 && lastCleanupDate !== currentDate) {
    lastCleanupDate = currentDate;
    await runCleanupTasks();
  }
}

// Run reports immediately on startup
triggerScheduledReports();

// Then run reports every 5 minutes
setInterval(triggerScheduledReports, REPORTS_INTERVAL_MS);

// Check for midnight cleanup every minute
setInterval(checkAndRunCleanup, CLEANUP_CHECK_INTERVAL_MS);

// Also check immediately on startup (in case server started at midnight)
checkAndRunCleanup();

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

console.log('✅ Scheduler is running. Press Ctrl+C to stop.');

