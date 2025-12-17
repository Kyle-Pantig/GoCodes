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

# Fetch Prisma query engine binaries for Linux (Debian)
# This must run after copying prisma_client so the CLI is available
# Prisma Python uses Node.js CLI under the hood, so Node.js must be installed
RUN cd /app && python -c "import sys; sys.argv = ['prisma', 'py', 'fetch']; from prisma_client.cli.cli import main; main(['py', 'fetch'])"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

