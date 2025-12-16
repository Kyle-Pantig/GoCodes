"""
FastAPI startup script with Windows event loop fix
Use this instead of running uvicorn directly
"""
import sys
import asyncio

# Set event loop policy BEFORE importing anything that uses asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Now import and run uvicorn
import uvicorn
from main import app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        loop="asyncio"
    )

