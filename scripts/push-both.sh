#!/usr/bin/env bash
set -e

echo "🚀 [雙儲存庫同步腳本] 準備同時推送最新程式碼至 2 個 GitHub 倉庫..."
echo "1️⃣ 儲存庫 A: https://github.com/poyuan0506-GH/SmartGroup.git"
echo "2️⃣ 儲存庫 B: https://github.com/arsandbox0101-smart/group.git"

# 設定 remote 或直接 push
git push https://github.com/poyuan0506-GH/SmartGroup.git main || git push origin main
git push https://github.com/arsandbox0101-smart/group.git main

echo "✅ 雙儲存庫推送完成！"
