# Railway Prisma Binary Fix

⚫ **Prisma Python client missing Linux binaries. Fix this.**

## The Problem

Railway runs on Linux, but Prisma Python client needs the query engine binary for Linux. The binary must be fetched during build AND copied to the app directory.

## Solution: Update Railway Build Settings

### Step 1: Railway Dashboard Settings

1. Go to **Railway Dashboard** → Your FastAPI service
2. Click **Settings** tab
3. Find **"Build Command"** field
4. Set it to:
   ```bash
   bash railway-build.sh
   ```
5. **Start Command**: `python run.py` (or leave empty to use Procfile)
6. **Root Directory**: `backend`
7. **Save** and **Redeploy**

### Step 2: Verify Environment Variables

Make sure these are set in Railway:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Your Vercel app URL
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `PORT` - Railway sets this automatically (don't add manually)

## What the Build Script Does

The `backend/railway-build.sh` script:
1. **Installs dependencies** - FastAPI, Prisma, etc.
2. **Generates Prisma client** - Creates Python client from schema
3. **Fetches binaries** - Downloads Linux query engine binary to cache
4. **Copies binary** - Copies binary from cache to backend directory (where app runs)
5. **Makes executable** - Sets execute permissions on binary

## Verify It Works

After deployment, check Railway logs:
- Should see: "🚀 Railway build started..."
- Should see: "⬇️  Fetching Prisma query engine binaries..."
- Should see: "Found binary at: /root/.cache/..."
- Should see: "✅ Binary copied to backend directory"
- Should see: "✅ Build complete!"
- Should see: "Application startup complete"
- **No more `BinaryNotFoundError`**

## Troubleshooting

If you still get `BinaryNotFoundError`:

1. **Check build logs** - Make sure `prisma py fetch` ran successfully
2. **Verify binary exists** - Check if `prisma-query-engine-debian-openssl-3.5.x` is in backend directory
3. **Check permissions** - Binary must be executable (`chmod +x`)
4. **Alternative**: Set environment variable `PRISMA_QUERY_ENGINE_BINARY=/app/prisma-query-engine-debian-openssl-3.5.x`

**Your deployment was broken. Now it's fixed. Sleep well tonight.** 🕳️

