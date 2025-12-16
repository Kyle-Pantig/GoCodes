# Quick Deployment Checklist

⚫ **Deployment checklist. Follow this. Do not skip steps.**

## Pre-Deployment

- [ ] FastAPI backend tested locally
- [ ] Environment variables documented
- [ ] CORS configured correctly
- [ ] Database accessible from deployment platform

## Step 1: Deploy FastAPI Backend

### Railway (Recommended)

1. [ ] Go to https://railway.app
2. [ ] Create new project → Deploy from GitHub
3. [ ] Select your repository
4. [ ] Add service → Empty service
5. [ ] Settings → Root Directory: `backend`
6. [ ] Settings → Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. [ ] Variables → Add:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
8. [ ] Deploy
9. [ ] Copy Railway URL (e.g., `https://your-app.up.railway.app`)

### Render (Alternative)

1. [ ] Go to https://render.com
2. [ ] New → Web Service → Connect GitHub
3. [ ] Root Directory: `backend`
4. [ ] Build Command: `pip install -r requirements.txt`
5. [ ] Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. [ ] Add environment variables
7. [ ] Deploy
8. [ ] Copy Render URL

## Step 2: Update Vercel

1. [ ] Go to Vercel Dashboard → Your Project
2. [ ] Settings → Environment Variables
3. [ ] Add:
   ```
   NEXT_PUBLIC_USE_FASTAPI=true
   NEXT_PUBLIC_FASTAPI_URL=https://your-fastapi-url.com
   ```
4. [ ] Save
5. [ ] Redeploy Next.js app

## Step 3: Update FastAPI CORS

1. [ ] Update `backend/main.py` CORS origins
2. [ ] Add your Vercel production URL
3. [ ] Redeploy FastAPI

## Step 4: Test

1. [ ] Check FastAPI health: `curl https://your-fastapi-url.com/health`
2. [ ] Check Swagger docs: `https://your-fastapi-url.com/docs`
3. [ ] Visit your Vercel app
4. [ ] Check browser console for errors
5. [ ] Test API calls (e.g., locations page)

## Troubleshooting

- [ ] CORS errors? → Check FastAPI CORS origins
- [ ] 500 errors? → Check FastAPI logs
- [ ] Database errors? → Verify DATABASE_URL
- [ ] Environment variables not working? → Restart services

## Done

✅ FastAPI deployed and accessible
✅ Next.js connected to FastAPI
✅ All tests passing
✅ Production ready

**If all checked, you're ready. If not, fix it. No shortcuts.** 🕳️

