/*
 * 变压器离线运维控制台 · Electron 主进程
 * ------------------------------------------------------------
 * 安全边界：
 *  - 只加载安装包内的本地文件；
 *  - 禁止渲染进程发起任何 http/https/ws/wss 请求；
 *  - DNS 解析被统一禁用；
 *  - 禁止新窗口、外部导航、权限申请和 WebView。
 */
"use strict";

const path = require("path");
const { app, BrowserWindow, Menu, screen, session } = require("electron");

const APP_ID = "com.offline.transformermonitor";
const isDev = !app.isPackaged;
let mainWindow = null;

// 关闭 Chromium 的后台联网、组件更新、崩溃上报、DNS 预取等能力。
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-domain-reliability");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("disable-client-side-phishing-detection");
app.commandLine.appendSwitch("disable-sync");
app.commandLine.appendSwitch("disable-features", "MediaRouter,OptimizationHints,AutofillServerCommunication");
app.commandLine.appendSwitch("no-pings");
app.commandLine.appendSwitch("no-first-run");
app.commandLine.appendSwitch("no-default-browser-check");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");

app.setAppUserModelId(APP_ID);
app.setPath("userData", path.join(app.getPath("appData"), "TransformerOfflineConsole"));

const gotLock = app.requestSingleInstanceLock();

function installOfflineGuards() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setSpellCheckerEnabled(false);
  defaultSession.setProxy({ mode: "direct" });

  // 即使页面误引入远程资源，也会在请求发出前被拦截。
  defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_details, callback) => callback({ cancel: true })
  );
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "..", "build", "icon.ico");
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.max(1180, Math.min(1440, workArea.width - 70));
  const windowHeight = Math.max(700, Math.min(900, workArea.height - 50));

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 1180,
    minHeight: 700,
    center: true,
    show: false,
    backgroundColor: "#f2f4f7",
    title: "变压器离线运维控制台",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: isDev
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    if (target.protocol === "file:") return;
    event.preventDefault();
  });

  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    installOfflineGuards();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event, url) => {
      const current = contents.getURL();
      // 仅允许应用本身和同一文档内的 hash 路由，其余导航全部拒绝。
      if (!current || url.split("#")[0] === current.split("#")[0]) return;
      event.preventDefault();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

process.on("uncaughtException", (error) => {
  console.error("[offline-console]", error);
});
