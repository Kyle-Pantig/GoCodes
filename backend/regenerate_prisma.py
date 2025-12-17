#!/usr/bin/env python3
"""
Regenerate Prisma Python client with Linux binary paths
"""
import sys
import os
import re
from pathlib import Path

from prisma_client.cli.prisma import ensure_cached, run

def main():
    # Ensure Prisma CLI is cached
    print("Ensuring Prisma CLI is cached...")
    ensure_cached()
    
    # Find schema file
    schema_path = None
    for path in ['prisma_client/schema.prisma', 'prisma/schema.prisma']:
        if os.path.exists(path):
            schema_path = path
            break
    
    if not schema_path:
        print('ERROR: Could not find schema.prisma')
        print('Checked paths: prisma_client/schema.prisma, prisma/schema.prisma')
        sys.exit(1)
    
    print(f'Found schema at: {schema_path}')
    
    # Read schema and fix output path
    schema_content = Path(schema_path).read_text()
    # Replace output path to be relative to current directory
    schema_content = re.sub(
        r'output\s*=\s*["\']\.\./backend/prisma_client["\']',
        'output = "prisma_client"',
        schema_content
    )
    
    # Write temporary schema
    temp_schema = Path('schema.temp.prisma')
    temp_schema.write_text(schema_content)
    print('Created temporary schema with corrected output path')
    
    # Run prisma generate
    args = ['generate', '--generator=python_client', f'--schema={temp_schema}']
    print(f'Running: prisma {" ".join(args)}')
    result = run(args)
    
    # Clean up temp schema
    temp_schema.unlink()
    
    print(f'Generate completed with exit code: {result}')
    
    if result != 0:
        print('ERROR: prisma generate failed')
        sys.exit(result)
    
    # Verify regeneration worked
    client_file = Path('prisma_client/client.py')
    if client_file.exists():
        content = client_file.read_text()
        if 'debian-openssl' in content or ('linux' in content.lower() and 'windows' not in content.lower()):
            print('SUCCESS: Client regenerated with Linux binary paths')
        else:
            print('WARNING: Checking BINARY_PATHS content...')
            match = re.search(r'BINARY_PATHS = model_parse\(BinaryPaths, ({.*?})\)', content, re.DOTALL)
            if match:
                print(f'BINARY_PATHS: {match.group(1)[:200]}...')
    
    sys.exit(0)

if __name__ == '__main__':
    main()

