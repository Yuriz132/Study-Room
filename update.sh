#!/usr/bin/env bash
# 升本词汇网站 - 一键更新部署脚本
# 用法: bash /opt/henan-vocab/update.sh
set -e
cd /opt/henan-vocab

echo "==> [1/4] 拉取最新代码"
git pull --ff-only

echo "==> [2/4] 前端依赖安装与构建"
cd frontend
pnpm install
pnpm rebuild esbuild @swc/core core-js-pure >/dev/null 2>&1 || true
pnpm build

echo "==> [3/4] 后端依赖安装与构建"
cd ../backend
pnpm install
pnpm build

echo "==> [4/4] 重启后端服务"
systemctl restart henan-vocab-backend.service
sleep 2
systemctl is-active henan-vocab-backend.service

echo "==> 完成! 网站已更新: http://8.210.60.126/"
