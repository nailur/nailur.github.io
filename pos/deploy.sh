#!/bin/bash
npm run build
cp -r dist/* .
echo "✅ Built and deployed!"
