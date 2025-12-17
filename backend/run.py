"""
FastAPI startup script with Windows event loop fix
Use this instead of running uvicorn directly
Reads PORT from environment (for Railway/Render/Fly.io)
Ensures Prisma binary is available
"""
import sys
import os
import asyncio
import subprocess
from pathlib import Path

# Set event loop policy BEFORE importing anything that uses asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Ensure Prisma binary exists (for Railway/Linux deployments)
if sys.platform != 'win32':
    binary_name = "prisma-query-engine-debian-openssl-3.5.x"
    binary_path = Path.cwd() / binary_name
    cache_dir = Path.home() / ".cache" / "prisma-python" / "binaries"
    
    if not binary_path.exists():
        print(f"⚠️  Prisma binary not found at {binary_path}, checking cache...")
        
        # Try to find in cache
        if cache_dir.exists():
            cached_binary = list(cache_dir.rglob(binary_name))
            if cached_binary:
                print(f"📋 Found binary in cache: {cached_binary[0]}")
                import shutil
                shutil.copy(cached_binary[0], binary_path)
                binary_path.chmod(0o755)
                print(f"✅ Binary copied to {binary_path}")
            else:
                print("❌ Binary not found in cache, fetching...")
                try:
                    subprocess.run([sys.executable, "-m", "prisma", "py", "fetch"], check=True)
                    cached_binary = list(cache_dir.rglob(binary_name))
                    if cached_binary:
                        import shutil
                        shutil.copy(cached_binary[0], binary_path)
                        binary_path.chmod(0o755)
                        print(f"✅ Binary fetched and copied to {binary_path}")
                    else:
                        print("❌ Failed to fetch binary")
                except Exception as e:
                    print(f"❌ Error fetching binary: {e}")
        
        # Set environment variable if binary exists
        if binary_path.exists():
            os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(binary_path.absolute())
            print(f"✅ Set PRISMA_QUERY_ENGINE_BINARY={binary_path.absolute()}")

# Now import and run uvicorn
import uvicorn
from main import app

if __name__ == "__main__":
    # Read PORT from environment (Railway/Render/Fly.io set this)
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        loop="asyncio"
    )

