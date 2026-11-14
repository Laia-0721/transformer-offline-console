# 离线架构与打包说明

## 1. 运行架构

```text
Windows 用户
  └─ TransformerOfflineConsole.exe
      └─ Electron 主进程 (electron/main.js)
          ├─ 关闭后台联网 / DNS / 自动更新
          ├─ 加载本地 renderer/index.html
          └─ BrowserWindow
              └─ 纯静态渲染进程
                  ├─ 本地 JSON / 模拟数据引擎
                  ├─ localStorage 本地配置
                  └─ Canvas / CSS 可视化
```

应用不包含服务端。安装包内部只有 Electron 运行时与本地静态资源，没有远程接口地址。

## 2. 离线隔离措施

### 2.1 Electron 主进程

`electron/main.js` 在创建窗口之前执行：

- 关闭 Chromium 后台联网、组件更新、域名可靠性请求和崩溃上报；
- 关闭自动填充、媒体路由、优化提示等可能触发后台请求的特性；
- 设置 `host-resolver-rules` 为 `MAP * ~NOTFOUND`，阻断所有域名解析；
- 使用 `session.webRequest.onBeforeRequest` 取消全部 `http`、`https`、`ws`、`wss` 请求；
- 拒绝所有权限申请；
- 禁止新窗口、外部导航、WebView 附加；
- 渲染进程开启 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`；
- 应用没有 preload 桥接，不暴露文件系统或网络能力。

### 2.2 渲染进程

`renderer/index.html` 的 CSP 包含：

```text
default-src 'self';
connect-src 'none';
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self';
```

页面不引入 CDN、外部字体、统计脚本或远程图片。唯一的外部网络调用被 CSP 与主进程双重阻断。

## 3. 安装行为

构建配置位于 `package.json` 的 `build` 字段：

- 目标：`nsis`（安装版）与 `portable`（便携版），Windows x64；
- `oneClick: false`：使用交互式安装向导，不再双击后直接进入安装；
- 强制当前用户安装，不需要管理员权限；
- 通过 `build/installer.nsh` 增加「本机检测与安装位置」页面：
  - 从注册表读取已安装版本和安装路径；
  - 提供目录输入框与「浏览...」按钮，支持自定义安装地址；
  - 对目录执行创建和写入权限校验；
  - 修改安装路径时弹出确认，提示先移除旧版本、再安装到新路径；
- `runAfterFinish: true`：完成页提供“运行应用”选项；
- 自动创建桌面与开始菜单快捷方式；
- 安装路径与卸载信息写入 Windows 当前用户环境；
- 本地应用数据目录：`%APPDATA%\TransformerOfflineConsole`。

安装器页面的文本来自 `build/installer.nsh`。electron-builder 使用 `makensis -INPUTCHARSET UTF8` 编译，因此该文件保存为 **UTF-8（无 BOM）**，可以安全显示中文。批处理文件则单独保持 ASCII + CRLF，两者编码策略不同。

由于没有配置商业代码签名证书，安装器在部分电脑上可能触发 SmartScreen。该提示是 Windows 对未签名可执行文件的通用安全提示，不代表应用需要联网。

## 4. 构建

### 4.1 依赖

- Node.js 18+（构建机）
- Windows 10/11 x64
- 已包含：Electron 45.3.0、electron-builder 26.18.0

### 4.2 一键构建

双击仓库根目录的：

```text
build-installer.bat
```

该批处理文件特意使用：

- **纯 ASCII 内容**：不包含中文文本，避免 cmd.exe 在 GBK / UTF-8 代码页下的乱码；
- **CRLF 换行**：兼容 Windows 批处理解析；
- 自动清除 `ELECTRON_RUN_AS_NODE`，避免 Electron 以 Node 模式启动打包工具。

### 4.3 命令行构建

```bash
npm install
npm run build:win
```

或仅生成解包目录用于检查：

```bash
npm run build:dir
```

### 4.4 构建产物

```text
dist/
├─ Transformer-Offline-Console-Setup-2.0.0.exe       NSIS 安装器
├─ Transformer-Offline-Console-Portable-2.0.0.exe   便携版
├─ Transformer-Offline-Console-Setup-2.0.0.exe.blockmap
└─ win-unpacked/                                     解包后的运行目录
```

## 5. 离线验收

安装完成后可执行以下检查：

1. 断开网络或禁用网卡，启动应用；
2. 刷新页面 / 重新打开应用；
3. 进入总览、实例、监控、健康分析、告警、设置；
4. 使用模拟控制抽屉切换自动 / 手动，拖动滑杆；
5. 保存阈值，确认页面状态随阈值变化；
6. 在开发工具或 Electron 中发起 `fetch("https://example.com")`，请求应被阻断。

已验证：

- 所有页面加载请求均指向 `file://` 本地资源；
- 渲染进程外部 `fetch` 被拦截；
- 安装版在无远程服务的条件下可正常打开并刷新数据。

## 6. 卸载

在 Windows 设置 → 应用 → 已安装的应用中找到“变压器离线运维控制台”卸载。

如需一并清理本地配置，可删除：

```text
%APPDATA%\TransformerOfflineConsole
```

## 7. 已知限制

- 当前不接入真实传感器或外部采集网关；
- 当前健康度、置信度和剩余寿命为本地模拟算法；
- 安装包未签名，因此 SmartScreen 可能提示；
- 没有自动更新机制，这是完全离线设计的一部分；
- 桌面窗口最小宽度为 1180 px，低于该宽度的窗口会被系统限制。

---

返回 [项目主页](../README.md) · [GitHub 仓库](https://github.com/Laia-0721/transformer-offline-console) · [Releases](https://github.com/Laia-0721/transformer-offline-console/releases)
