#!/bin/bash
cd "$(dirname "$0")" || exit 1
printf '\n农历日历 · 本地启动\n\n'
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '未找到 Node.js 和 npm。请先安装 Node.js 22 或更新版本：https://nodejs.org/\n'
  read -r -p '按回车键关闭窗口。' _
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  printf 'Node.js 版本过低，请安装 Node.js 22 或更新版本：https://nodejs.org/\n'
  read -r -p '按回车键关闭窗口。' _
  exit 1
fi
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  printf '正在安装项目依赖，首次运行需要联网……\n'
  if ! npm ci; then
    printf '\n依赖安装失败，请检查网络连接后重试。\n'
    read -r -p '按回车键关闭窗口。' _
    exit 1
  fi
fi
printf '\n正在启动并打开浏览器。关闭此窗口将停止服务。\n\n'
npm run dev -- --host 127.0.0.1 --open
printf '\n服务已停止。\n'
read -r -p '按回车键关闭窗口。' _
