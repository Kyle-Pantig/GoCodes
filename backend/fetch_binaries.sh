#!/bin/bash
set -e

echo "📥 Fetching Prisma query engine binaries..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Cannot fetch binaries."
    echo "💡 Install Node.js or commit binaries to repository"
    exit 1
fi

# Check if we're in the backend directory
if [ ! -f "requirements.txt" ]; then
    echo "⚠️  Not in backend directory, navigating..."
    cd backend 2>/dev/null || cd "$(dirname "$0")"
fi

# Navigate to parent to access prisma schema
cd ..

# Check if prisma schema exists
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ prisma/schema.prisma not found"
    exit 1
fi

# Run prisma py fetch
echo "Running: python -m prisma py fetch --schema=prisma/schema.prisma"
python -m prisma py fetch --schema=prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo "✅ Prisma binaries fetched successfully"
    # List where binaries were downloaded
    echo "Binaries location:"
    python -c "from prisma_client import config; import os; print(os.path.join(os.path.expanduser('~'), '.cache', 'prisma-python', 'binaries'))"
else
    echo "❌ Failed to fetch binaries"
    exit 1
fi

