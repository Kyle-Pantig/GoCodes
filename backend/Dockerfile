FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Node.js (required for Prisma CLI)
RUN apt-get update && apt-get install -y \
    gcc \
    openssl \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (including prisma_client)
COPY . .

# Download Prisma query engine binaries for Linux (Debian)
# Ensure Prisma CLI is cached, then run generate to download binaries
# The Python generator downloads binaries to the cache directory Prisma Python expects
RUN cd /app && \
    python -c "from prisma_client.cli.prisma import ensure_cached; from prisma_client import config; import os; cache = ensure_cached(); os.makedirs(config.binary_cache_dir, exist_ok=True)" && \
    python -c "from prisma_client.cli.prisma import run; import sys; import os; schema = 'prisma/schema.prisma' if os.path.exists('prisma/schema.prisma') else ('prisma_client/schema.prisma' if os.path.exists('prisma_client/schema.prisma') else None); args = ['generate'] + ([f'--schema={schema}'] if schema else []); result = run(args); print(f'Generate exited with code {result}'); sys.exit(result)"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

