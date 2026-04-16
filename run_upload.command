#!/bin/bash
cd "$(dirname "$0")"
echo "=== Uploading index.html to GitHub ==="
python3 upload_index.py
echo "=== Done ==="
read -p "Press Enter to close..."
