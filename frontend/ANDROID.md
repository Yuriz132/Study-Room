# 河南专升本单词 · 安卓 APK 构建与安装说明

把现有 React + Vite 网站用 **Capacitor 8** 包成了真正的安卓原生 App（WebView 壳 + 原生构建），可直接安装到手机使用，数据与你现在的网站共用同一个后端。

## 一、交付文件（在 /workspace）

| 文件 | 说明 |
|------|------|
| `河南专升本单词-v1.0-release.apk` | **正式签名 APK**（推荐分发安装），已用 release-key 签名 |
| `河南专升本单词-v1.0-debug.apk` | 调试版 APK（同样可安装，签名是 debug 密钥） |

> App 名称：河南专升本单词　包名：`com.yafei.hnvocab`　版本：1.0

## 二、安装到手机

**方式 A（最简单）**：把 `.apk` 文件通过微信/数据线传到安卓手机 → 用文件管理器点击 → 按提示「允许安装未知来源应用」→ 完成。
**方式 B（adb）**：手机开启 USB 调试，电脑执行
```bash
adb install 河南专升本单词-v1.0-release.apk
```

## 三、技术架构

- 前端仍是原来的 React 19 + Vite 7，`pnpm build` 产出 `dist/`。
- `capacitor.config.ts` 把 `webDir` 指向 `dist`，`cap add android` 生成 `frontend/android/` 原生工程。
- `cap sync android` 把 `dist/` 拷贝进 `android/app/src/main/assets/public`，由安卓 WebView 加载。
- 网络请求：`src/lib/api-client.ts` 支持 `VITE_API_BASE_URL` 环境变量。网页版用相对路径 `/api`（由 nginx 转发）；APK 打包时注入真实后端地址 `http://8.210.60.126`。
- 发音（有道 `dictvoice`）、AI 对话（Agnes）均走 HTTPS，在 WebView 中正常。
- 启动图标：渐变底色（靛蓝→天蓝）+ 白色「词」字，已生成各密度资源。

## 四、后端地址说明（重要）

APK 里后端写死为 `http://8.210.60.126`（服务器 IP，HTTP）。
安卓 9+ 默认禁止明文 HTTP，因此已在 `AndroidManifest.xml` 开启
`android:usesCleartextTraffic="true"`，保证 App 能直接访问该 IP。

如果你有 Cloudflare 公网域名（HTTPS），**强烈建议改成域名**（更安全、无需明文权限）：
见下方「更换后端域名」。

## 五、如何在本机重新构建（如需自己出包）

环境要求：Node 22+、**JDK 21**（Capacitor 8 原生模块要求）、Android SDK
（cmdline-tools + `platforms;android-36` + `build-tools;36.0.0` + `platform-tools`）。

```bash
cd frontend
# 1) 安装依赖（已含 @capacitor/core/cli/android）
pnpm install

# 2) 构建前端并注入后端地址
VITE_API_BASE_URL=http://8.210.60.126 pnpm build

# 3) 同步 Web 资源到安卓工程
pnpm cap sync android

# 4) 用 Android Studio 打开 android/ 点运行，或用命令行编译：
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk-21
cd android
./gradlew assembleDebug        # 调试包
./gradlew assembleRelease      # 正式签名包（需 keystore.properties，见下）
```

本环境编译时遇到两个坑（已绕过，记录备查）：
- 系统 `/root/.gradle/init.gradle` 有语法错误（缺引号 + `mavelCentral` 笔误），会让所有 Gradle 构建失败。本环境用独立的 `GRADLE_USER_HOME` 隔离解决，不影响全局。
- 系统默认 JDK 是 20，但 Capacitor 8 需要 **JDK 21**，已单独安装 Temurin JDK 21 用于编译。

## 六、更换后端域名

1. 修改打包命令里的地址，例如改用你的 HTTPS 域名：
   ```bash
   VITE_API_BASE_URL=https://你的域名 pnpm build
   pnpm cap sync android
   ```
2. 若改为 HTTPS 域名，建议同时去掉 `android/app/src/main/AndroidManifest.xml` 里的
   `android:usesCleartextTraffic="true"`（更规范）。
3. 重新 `./gradlew assembleRelease`。

## 七、Release 签名

签名配置在 `android/app/build.gradle` 的 `signingConfigs.release`，读取
`android/app/keystore.properties`（已被 `.gitignore` 忽略，不会上传）：

```
storeFile=release-key.jks
storePassword=henanvocab123
keyAlias=hnvocab
keyPassword=henanvocab123
```

密钥库文件 `android/app/release-key.jks` 同样被 `.gitignore` 忽略。
**请自行备份该 keystore 与密码**——以后升级 App 必须用同一个密钥签名，否则无法覆盖安装。

## 八、已知事项 / 后续可优化

- 当前为 Capacitor WebView 方案（非完全原生），单词本、复习、AI 等功能与网站一致。
- 图标已自定义，可进一步按品牌细化。
- 推送通知、离线缓存等未接入（当前依赖联网访问后端）。
- `不背单词` 风格升级（例句、SRS 复习、每日目标）的前端改动已包含在工程中，可继续推进。
