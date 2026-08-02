import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yafei.hnvocab',
  appName: '河南专升本单词',
  // Vite 的 build 输出目录（见 vite.config.ts 的 base:'./'）
  webDir: 'dist',
  // 生产 APK 不设置 server.url，直接把 dist 打进原生包。
  // 如需本地联调可临时加：server: { url: 'http://<电脑局域网IP>:5173', cleartext: true }
  server: {
    androidScheme: 'https',
  },
};

export default config;
