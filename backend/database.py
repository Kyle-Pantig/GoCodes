"""
Database connection and Prisma client setup
"""
import sys
import os
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# Import Prisma client (generated in prisma_client subdirectory)
try:
    from prisma_client import Prisma
except ImportError:
    sys.exit(1)

# Fix Windows event loop issue
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Fix Supabase connection pooler issue
# Supabase's pooler (port 6543) uses transaction pooling which doesn't support prepared statements
# Prisma requires direct connection (port 5432) instead of pooler connection
# Convert pooler URL to direct connection URL automatically
database_url = os.getenv("DATABASE_URL", "")
if database_url and "pooler.supabase.com" in database_url:
    # Try to get direct connection URL if explicitly provided
    direct_url = os.getenv("DATABASE_URL_DIRECT")
    if direct_url:
        os.environ["DATABASE_URL"] = direct_url
    else:
        # Extract project reference from username (format: postgres.PROJECT_REF)
        # Convert pooler URL to direct connection URL
        # Format: ...@REGION.pooler.supabase.com:6543 -> ...@PROJECT_REF.supabase.co:5432
        import re
        import logging
        logger = logging.getLogger(__name__)
        # Extract project ref from username part (postgres.PROJECT_REF)
        match = re.search(r'postgres\.([^.]+)@', database_url)
        if match:
            project_ref = match.group(1)
            # Replace pooler host:port with direct connection host:port
            direct_url = re.sub(
                r'@[^@]+\.pooler\.supabase\.com:6543',
                f'@{project_ref}.supabase.co:5432',
                database_url
            )
            os.environ["DATABASE_URL"] = direct_url
            logger.info("Converted Supabase pooler URL to direct connection URL for Prisma compatibility")

# Prisma client instance
prisma = Prisma()

@asynccontextmanager
async def lifespan(app):
    """Manage Prisma client lifecycle"""
    # Startup: Connect to database
    await prisma.connect()
    
    yield
    
    # Shutdown: Disconnect from database
    await prisma.disconnect()

