#!/bin/bash
# Railway build script - generates Prisma client with Linux binaries
set -e

echo "🚀 Railway build started..."

# Install Python dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Generate Prisma Python client (from root directory to access schema)
echo "🔧 Generating Prisma Python client..."
cd ..
python -m prisma generate --schema=prisma/schema.prisma --generator=python_client

# Fetch Prisma query engine binaries for Linux (Debian)
echo "⬇️  Fetching Prisma query engine binaries..."
python -m prisma py fetch

# Find and copy the binary to backend directory (where app runs)
echo "📋 Copying query engine binary to app directory..."
BINARY_NAME="prisma-query-engine-debian-openssl-3.5.x"
CACHE_DIR="$HOME/.cache/prisma-python/binaries"
# Find the binary in cache (version may vary)
if [ -d "$CACHE_DIR" ]; then
    BINARY_PATH=$(find "$CACHE_DIR" -name "$BINARY_NAME" -type f | head -n 1)
    if [ -n "$BINARY_PATH" ] && [ -f "$BINARY_PATH" ]; then
        echo "Found binary at: $BINARY_PATH"
        cp "$BINARY_PATH" "backend/$BINARY_NAME"
        chmod +x "backend/$BINARY_NAME"
        echo "✅ Binary copied to backend directory"
    else
        echo "⚠️  Binary not found in cache, but prisma py fetch should have downloaded it"
    fi
else
    echo "⚠️  Cache directory not found"
fi

# Return to backend directory
cd backend

echo "✅ Build complete!"

