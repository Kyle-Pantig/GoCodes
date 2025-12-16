# FastAPI Backend Setup Guide

This guide explains how to set up and use FastAPI backend for improved performance in production.

## Quick Start

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Use the same `DATABASE_URL` as your Next.js app.

### 3. Run FastAPI Server

```bash
cd backend
python main.py
```

Or with auto-reload:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### 4. Enable FastAPI in Next.js

Add to your `.env.local`:

```env
NEXT_PUBLIC_USE_FASTAPI=true
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

### 5. Test the Integration

1. Start Next.js: `npm run dev`
2. Start FastAPI: `python backend/main.py`
3. Visit `http://localhost:3000/setup/locations`
4. The page should now use FastAPI backend

## API Documentation

Once FastAPI is running:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Current Implementation

### Endpoints Migrated
- ✅ `GET /api/locations` - Get all locations
- ✅ `POST /api/locations` - Create location
- ✅ `PUT /api/locations/{id}` - Update location
- ✅ `DELETE /api/locations/{id}` - Delete location

### Features
- Async database operations with connection pooling
- CORS configured for Next.js frontend
- Error handling matching Next.js API routes
- Health check endpoint

## Performance Benefits

FastAPI provides:
1. **Async I/O**: Non-blocking database operations
2. **Connection Pooling**: Efficient database connection management
3. **Lower Overhead**: Less framework overhead than Next.js API routes
4. **Better Concurrency**: Handle more concurrent requests

## Authentication

Currently, authentication is simplified for POC. In production, you should:

1. Verify Supabase JWT tokens in FastAPI
2. Extract user ID from token
3. Check permissions from database

Example implementation needed in `main.py`:
```python
from supabase import create_client, Client

async def verify_auth(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = authorization.replace("Bearer ", "")
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    try:
        user = supabase.auth.get_user(token)
        return {"user_id": user.id}
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## Production Deployment

### Option 1: Same Server
Run both Next.js and FastAPI on the same server:
- Next.js: Port 3000
- FastAPI: Port 8000
- Use Nginx as reverse proxy

### Option 2: Separate Services
- Deploy Next.js to Vercel/Netlify
- Deploy FastAPI to Railway/Render/Fly.io
- Configure CORS for production domain

### Option 3: Docker Compose
```yaml
services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
  
  fastapi:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

## Monitoring

Add logging and monitoring:
- Use `structlog` for structured logging
- Add Prometheus metrics
- Monitor database connection pool usage

## Next Steps

1. **Add Authentication**: Implement Supabase JWT verification
2. **Add More Endpoints**: Migrate other slow endpoints
3. **Add Caching**: Implement Redis caching in FastAPI
4. **Add Rate Limiting**: Protect against abuse
5. **Add Monitoring**: Track performance metrics

## Troubleshooting

### FastAPI can't connect to database
- Check `DATABASE_URL` format (should be `postgresql://...`)
- Ensure database is accessible from FastAPI server
- Check firewall rules

### CORS errors
- Verify `NEXT_PUBLIC_APP_URL` matches your frontend URL
- Check CORS middleware configuration

### Authentication errors
- Ensure Supabase token is being sent in Authorization header
- Check token expiration

## Performance Comparison

To measure performance improvement:

1. **Before (Next.js API)**:
   - Use browser DevTools Network tab
   - Measure response time for `/api/locations`

2. **After (FastAPI)**:
   - Compare response times
   - Check database query execution time
   - Monitor connection pool usage

Expected improvements:
- 20-40% faster response times for simple queries
- Better handling of concurrent requests
- Lower memory usage per request

