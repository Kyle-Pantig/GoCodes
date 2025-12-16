#!/bin/bash
set -e

echo "🔨 Building FastAPI backend..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Install Node.js if not available (needed for prisma py fetch)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    # Try to install Node.js via package manager
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y nodejs npm || echo "⚠️  Could not install Node.js"
    elif command -v yum &> /dev/null; then
        yum install -y nodejs npm || echo "⚠️  Could not install Node.js"
    else
        echo "⚠️  Cannot install Node.js automatically"
    fi
fi

# Fetch Prisma binaries if Node.js is available
if command -v node &> /dev/null; then
    echo "📥 Fetching Prisma query engine binaries..."
    # Navigate to parent directory to access prisma schema
    cd ..
    python -m prisma py fetch --schema=prisma/schema.prisma || {
        echo "⚠️  Failed to fetch binaries"
        echo "💡 Binaries should be committed to repository"
    }
    cd backend
else
    echo "⚠️  Node.js not available. Binaries must be committed to repository."
fi

echo "✅ Build complete!"

