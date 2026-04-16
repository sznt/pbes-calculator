#!/bin/bash
cd "$(dirname "$0")"
python3 deploy_vercel.py
echo ""
echo "Done — press any key to close."
read -n 1
