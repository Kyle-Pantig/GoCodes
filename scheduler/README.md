# Asset Dog Scheduler Service

A lightweight scheduler service that handles automated tasks:
- **Automated Reports**: Triggers every 5 minutes to send scheduled reports
- **Trash Cleanup**: Runs daily at midnight to permanently delete expired items from trash

## Setup

### Railway Deployment

1. Create a new service in Railway
2. Connect this folder (`scheduler/`) as the root directory
3. Add the following environment variables:
   - `FASTAPI_BASE_URL`: Your backend URL (e.g., `https://asset-dog-backend.up.railway.app`)
   - `CRON_SECRET`: The same secret used in your backend
   - `TIMEZONE`: (Optional) Timezone for midnight cleanup (default: `Asia/Manila`)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FASTAPI_BASE_URL` | Yes | The full URL to your FastAPI backend |
| `CRON_SECRET` | Yes | Secret key for authenticating cron requests |
| `TIMEZONE` | No | Timezone for midnight cleanup (default: `Asia/Manila`) |

## How It Works

### Automated Reports
1. On startup, the scheduler immediately calls the reports cron endpoint
2. Then it runs every 5 minutes
3. The cron endpoint checks for scheduled reports that are due and sends them

### Trash Cleanup
1. The scheduler checks every minute if it's midnight in the configured timezone
2. At midnight, it triggers cleanup tasks for:
   - **Deleted Assets**: Permanently deletes assets that have been in trash for 30+ days
   - **Deleted Inventory**: Permanently deletes inventory items that have been in trash for 30+ days
3. Cleanup only runs once per day (tracks last run date to prevent duplicates)

## API Endpoints

The scheduler calls these backend endpoints:

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/send-scheduled-reports` | Every 5 minutes | Process and send due automated reports |
| `/api/cron/cleanup-deleted-assets` | Daily at midnight | Permanently delete expired deleted assets |
| `/api/cron/cleanup-deleted-inventory` | Daily at midnight | Permanently delete expired deleted inventory |

### Cleanup Endpoint Parameters

Both cleanup endpoints accept an optional `retention_days` query parameter (default: 30):
- `GET /api/cron/cleanup-deleted-assets?retention_days=30`
- `GET /api/cron/cleanup-deleted-inventory?retention_days=30`

## Local Testing

```bash
cd scheduler
npm install
FASTAPI_BASE_URL=http://localhost:8000 CRON_SECRET=your-secret npm start
```

To test cleanup at a specific time:
```bash
FASTAPI_BASE_URL=http://localhost:8000 CRON_SECRET=your-secret TIMEZONE=UTC npm start
```

## Logs

The scheduler logs all activities:
- `✅ Reports Success` - Report processing completed
- `✅ Cleanup Assets Success` - Asset cleanup completed
- `✅ Cleanup Inventory Success` - Inventory cleanup completed
- `❌ Failed` - HTTP error from the backend
- `❌ Error` - Network or connection error
- `🌙 Starting midnight cleanup tasks` - Cleanup tasks triggered at midnight
