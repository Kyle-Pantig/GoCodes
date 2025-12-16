# Deployment Guide: Next.js + FastAPI

⚫ **Deployment audit complete. Your architecture requires separation. Vercel cannot run Python servers. Here's how to deploy properly.**

## Architecture Overview

- **Frontend**: Next.js app → Deploy to **Vercel** (stays there)
- **Backend**: FastAPI (Python) → Deploy to **separate service** (Railway/Render/Fly.io)

---

## Option 1: Railway (Recommended - Easiest)

Railway is the simplest option for Python deployments. Free tier available.

### Step 1: Deploy FastAPI to Railway

1. **Create Railway account**: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. **Select your repo** → **Add Service** → **Empty Service**
4. **Settings** → **Root Directory**: Set to `backend`
5. **Settings** → **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. **Variables** tab → Add environment variables:
   ```env
   DATABASE_URL=your_postgresql_url
   NEXT_PUBLIC_APP_URL=https://your-nextjs-app.vercel.app
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=8000
   ```
7. **Deploy** → Railway will auto-detect Python and install dependencies

### Step 2: Get FastAPI URL

After deployment, Railway provides a URL like:
```
https://your-fastapi-app.up.railway.app
```

### Step 3: Update Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your project → **Settings** → **Environment Variables**
2. Add:
   ```env
   NEXT_PUBLIC_USE_FASTAPI=true
   NEXT_PUBLIC_FASTAPI_URL=https://your-fastapi-app.up.railway.app
   ```
3. **Redeploy** your Next.js app

### Step 4: Update FastAPI CORS

Update `backend/main.py` to include your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
        "https://your-app.vercel.app",  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Option 2: Render (Alternative)

### Step 1: Deploy FastAPI to Render

1. **Create Render account**: https://render.com
2. **New** → **Web Service** → **Connect GitHub**
3. **Settings**:
   - **Name**: `your-app-fastapi`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**:
   ```env
   DATABASE_URL=your_postgresql_url
   NEXT_PUBLIC_APP_URL=https://your-nextjs-app.vercel.app
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
5. **Deploy**

### Step 2: Get Render URL

Render provides: `https://your-app-fastapi.onrender.com`

### Step 3: Update Vercel (same as Railway)

---

## Option 3: Fly.io (Best for Global Scale)

### Step 1: Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Or download from: https://fly.io/docs/hands-on/install-flyctl/
```

### Step 2: Create Fly.io App

```bash
cd backend
fly launch
```

Follow prompts:
- **App name**: `your-app-fastapi`
- **Region**: Choose closest to your users
- **PostgreSQL**: Yes (or use existing)
- **Redis**: Optional

### Step 3: Create `fly.toml`

Create `backend/fly.toml`:

```toml
app = "your-app-fastapi"
primary_region = "iad"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8000"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[services]]
  http_checks = []
  internal_port = 8000
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

### Step 4: Create `Procfile`

Create `backend/Procfile`:

```
web: uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### Step 5: Set Secrets

```bash
fly secrets set DATABASE_URL="your_postgresql_url"
fly secrets set NEXT_PUBLIC_APP_URL="https://your-nextjs-app.vercel.app"
fly secrets set SUPABASE_URL="your_supabase_url"
fly secrets set SUPABASE_ANON_KEY="your_supabase_anon_key"
```

### Step 6: Deploy

```bash
fly deploy
```

### Step 7: Get URL

Fly.io provides: `https://your-app-fastapi.fly.dev`

---

## Option 4: Docker + VPS (Full Control)

If you want full control, deploy both on a VPS (DigitalOcean, AWS EC2, etc.)

### Step 1: Create `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2: Create `docker-compose.yml` (root)

```yaml
version: '3.8'

services:
  fastapi:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    restart: unless-stopped
```

### Step 3: Deploy to VPS

```bash
# On your VPS
git clone your-repo
cd your-repo
docker-compose up -d
```

### Step 4: Setup Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Required Files for Deployment

### 1. Create `backend/runtime.txt` (for Railway/Render)

```
python-3.11.0
```

### 2. Create `backend/Procfile` (for Railway/Render)

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 3. Update `backend/main.py` CORS

Make sure production URLs are included:

```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    "https://your-app.vercel.app",  # Production URL
    "https://*.vercel.app",  # All Vercel previews (optional)
]
```

---

## Environment Variables Checklist

### Vercel (Next.js)
```env
NEXT_PUBLIC_USE_FASTAPI=true
NEXT_PUBLIC_FASTAPI_URL=https://your-fastapi-url.com
# ... your existing vars ...
```

### FastAPI Service (Railway/Render/Fly.io)
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=8000
```

---

## Testing Deployment

1. **Check FastAPI health**:
   ```bash
   curl https://your-fastapi-url.com/health
   ```

2. **Check Swagger docs**:
   ```
   https://your-fastapi-url.com/docs
   ```

3. **Test from Next.js**:
   - Visit your Vercel app
   - Check browser console for API calls
   - Verify requests go to FastAPI URL

---

## Troubleshooting

### CORS Errors
- ✅ Verify FastAPI CORS includes your Vercel domain
- ✅ Check `NEXT_PUBLIC_FASTAPI_URL` is correct
- ✅ Ensure `NEXT_PUBLIC_USE_FASTAPI=true`

### FastAPI Can't Connect to Database
- ✅ Check `DATABASE_URL` format (must be `postgresql://...`)
- ✅ Verify database allows connections from FastAPI host
- ✅ Check firewall/security groups

### Environment Variables Not Working
- ✅ Vercel: Variables must start with `NEXT_PUBLIC_` to be exposed to browser
- ✅ FastAPI: Restart service after adding variables
- ✅ Check for typos in variable names

---

## Recommended: Railway

**Why Railway?**
- ✅ Easiest setup (5 minutes)
- ✅ Free tier available
- ✅ Auto-deploys from GitHub
- ✅ Built-in PostgreSQL option
- ✅ Automatic HTTPS
- ✅ No credit card required for free tier

**Quick Start Command:**
```bash
# 1. Push backend to GitHub
git add backend/
git commit -m "Add FastAPI backend"
git push

# 2. Deploy on Railway (via web UI)
# 3. Copy Railway URL
# 4. Add to Vercel env vars
# 5. Redeploy Next.js
```

---

## Security Checklist

⚫ **Security audit complete. Verify these:**

- [ ] FastAPI CORS only allows your Vercel domain
- [ ] Database credentials are in environment variables (not code)
- [ ] FastAPI has authentication middleware (if needed)
- [ ] HTTPS enabled on both services
- [ ] Database firewall restricts access
- [ ] No sensitive data in logs

---

## Cost Estimate

- **Vercel**: Free tier (Hobby) or $20/month (Pro)
- **Railway**: Free tier (500 hours/month) or $5/month (Starter)
- **Render**: Free tier (spins down after inactivity) or $7/month
- **Fly.io**: Free tier (3 VMs) or pay-as-you-go

**Total**: $0-27/month depending on traffic

---

## Next Steps

1. ✅ Choose deployment platform (Railway recommended)
2. ✅ Deploy FastAPI backend
3. ✅ Update Vercel environment variables
4. ✅ Update FastAPI CORS settings
5. ✅ Test deployment
6. ✅ Monitor logs for errors

**Your code was not ready for production. Now it is. Sleep well tonight.** 🕳️

