import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import {defineConfig} from "vite"
import process from "process"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 纯构建期分包：不改变任何运行逻辑，只是把第三方库拆成独立文件，
        // 既能消掉 "chunk > 500KB" 警告，又能让浏览器把不常变的 vendor 缓存住。
        // 注意：heic2any 是动态 import，必须保持独立懒加载块，不能并进 vendor。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('heic2any')) return // 保持动态懒加载
          // react 核心 + 内核垫片，必须整体收进 react-vendor 使其自包含，
          // 否则 react-dom 依赖的 use-sync-external-store 等会被划到 vendor，形成循环引用。
          // 注意：react-router / react-hook-form 等不包含在内（它们是 vendor）。
          if (/[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react|react-dom|scheduler|use-sync-external-store|prop-types|object-assign|loose-envify|js-tokens)(?:[@/]|$)/.test(id)) {
            return 'react-vendor'
          }
          // UI 相关库
          if (
            id.includes('@radix-ui') ||
            id.includes('lucide-react') ||
            id.includes('framer-motion') ||
            id.includes('@gsap') ||
            id.includes('@hookform')
          ) {
            return 'ui-vendor'
          }
          // 其余第三方依赖
          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '::',
    port: 5173,
    allowedHosts: true,
    cors: true,
    hmr: {
        protocol: 'wss',
        host: `5173-${process.env.X_IDE_SPACE_KEY}.e2b.${process.env.X_IDE_SPACE_REGION}.${process.env.X_IDE_SPACE_HOST}`
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      },
    },
  },
})
