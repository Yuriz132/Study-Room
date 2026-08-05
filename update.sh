#!/usr/bin/env bash
# 升本词汇网站 - 一键更新部署脚本
# 用法: bash /opt/henan-vocab/update.sh
#
# ⚠️ 重要: 前端构建(pnpm build / vite)会占满 2 核 CPU 并触发内存交换(swap)颠簸，
#    导致 sshd / nginx 无响应(SSH 握手超时、80 端口拒绝连接)。
#    因此前端 dist 默认【不在服务器上构建】——先在本地/CI 用 `pnpm build` 生成 dist，
#    再用 tar/rsync 覆盖 frontend/dist 即可(静态资源, nginx 直接服务, 无需重启)。
#
#    若确需在服务器上构建前端, 请显式打开开关(高负载, 已降优先级):
#      BUILD_FRONTEND=1 bash /opt/henan-vocab/update.sh
#
#    任何在服务器上的构建都会用 nice -n 19 降低优先级, 并限制 Node 内存,
#    避免和同机其他服务(aegis / python / next)抢内存导致 swap 颠簸。
set -e
cd /opt/henan-vocab

# 在服务器上构建时: 限制 Node 老生代内存, 防止 swap 颠簸把 sshd/nginx 饿死
export NODE_OPTIONS="--max-old-space-size=512"

echo "==> [1/4] 拉取最新代码"
git pull --ff-only

echo "==> [2/4] 前端处理"
cd frontend
if [ "${BUILD_FRONTEND:-0}" = "1" ]; then
  echo "    (BUILD_FRONTEND=1) 在服务器上构建前端 —— 高负载, 已用 nice -n 19 降优先级"
  pnpm install
  pnpm rebuild esbuild @swc/core core-js-pure >/dev/null 2>&1 || true
  nice -n 19 pnpm build
else
  echo "    跳过前端构建: 前端 dist 应已通过【本地构建后上传】完成, 无需在服务器上构建。"
  echo "    如需在服务器构建, 请运行: BUILD_FRONTEND=1 bash /opt/henan-vocab/update.sh"
fi

echo "==> [3/4] 后端依赖安装与构建"
cd ../backend
pnpm install
nice -n 19 pnpm build

echo "==> [4/4] 重启后端服务"
systemctl restart henan-vocab-backend.service
sleep 2
systemctl is-active henan-vocab-backend.service

echo "==> 完成! 网站已更新: http://8.210.60.126/"
