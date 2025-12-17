"""
Database connection and Prisma client setup
"""
import sys
import os
import asyncio
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

# Download Prisma binaries if missing (for Railway/deployment)
def ensure_prisma_binaries():
    """Download Prisma query engine binaries if they don't exist"""
    try:
        from prisma_client.engine.utils import query_engine_name
        from prisma_client._config import Config
        
        config = Config.load()
        engine_name = query_engine_name()
        binary_path = Path.cwd() / engine_name
        
        # Check if binary exists locally
        if binary_path.exists():
            return
        
        # Check cache directory
        cache_path = config.binary_cache_dir / engine_name
        if cache_path.exists():
            return
        
        # Download binaries
        print("⚠️  Prisma binaries not found. Downloading...")
        # Run from project root (where prisma/schema.prisma is)
        # Railway sets working directory to /app (backend folder)
        # So we need to go up one level to find prisma/schema.prisma
        current_dir = Path.cwd()
        project_root = current_dir.parent if current_dir.name == "backend" else current_dir
        schema_path = project_root / "prisma" / "schema.prisma"
        
        # If schema not in parent, try current directory
        if not schema_path.exists():
            schema_path = current_dir / "prisma" / "schema.prisma"
            if schema_path.exists():
                project_root = current_dir
            else:
                # Last resort: try to find schema anywhere
                for parent in current_dir.parents:
                    test_path = parent / "prisma" / "schema.prisma"
                    if test_path.exists():
                        project_root = parent
                        schema_path = test_path
                        break
        
        # Run prisma py fetch from project root (no --schema flag needed)
        result = subprocess.run(
            [sys.executable, "-m", "prisma", "py", "fetch"],
            capture_output=True,
            text=True,
            cwd=project_root
        )
        if result.returncode == 0:
            print("✅ Prisma binaries downloaded successfully")
        else:
            print(f"❌ Failed to download Prisma binaries: {result.stderr}")
            raise RuntimeError("Prisma binaries not available")
    except Exception as e:
        print(f"⚠️  Warning: Could not ensure Prisma binaries: {e}")
        # Don't fail here, let Prisma handle the error with a better message

# Ensure binaries are available before importing (for Railway/Render)
if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("PORT"):
    ensure_prisma_binaries()

# Import Prisma client (generated in prisma_client subdirectory)
try:
    from prisma_client import Prisma
except ImportError:
    sys.exit(1)

# Fix Windows event loop issue
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

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

