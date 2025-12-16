"""
Database connection and Prisma client setup
"""
import sys
import os
import asyncio
from contextlib import asynccontextmanager

# Import Prisma client (generated in prisma_client subdirectory)
try:
    from prisma_client import Prisma
except ImportError as e:
    print(f"ERROR: Failed to import Prisma client: {e}")
    print("Make sure Prisma Python client is generated:")
    print("  cd .. && python -m prisma generate --schema=prisma/schema.prisma")
    sys.exit(1)

# Fix Windows event loop issue
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Prisma client instance
prisma = Prisma()

@asynccontextmanager
async def lifespan(app):
    """Manage Prisma client lifecycle"""
    # Check DATABASE_URL is set
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    
    # Startup: Connect to database
    try:
        print(f"Connecting to database...")
        await prisma.connect()
        print("✅ Database connected successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        raise
    
    yield
    
    # Shutdown: Disconnect from database
    try:
        await prisma.disconnect()
        print("✅ Database disconnected")
    except Exception as e:
        print(f"⚠️  Error disconnecting from database: {e}")

