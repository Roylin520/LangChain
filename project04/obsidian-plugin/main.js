/*
 * Notes Hub Sync — 把 vault 裡的 Markdown 同步到 Notes Hub。
 *
 * 同步流程刻意做成「先比對再上傳」：
 *   1. GET  /api/sync/manifest  取得伺服器上每篇筆記的 sha256。
 *   2. 本地算同樣的 sha256，只把不一樣的檔案分批 POST /api/sync/push。
 *   3. （可選）本地已刪除的檔案，用 POST /api/sync/delete 一併清掉。
 *
 * 這是免建置外掛：直接放進 .obsidian/plugins/notes-hub-sync/ 就能啟用，不需要 npm。
 */

const { Plugin, PluginSettingTab, Setting, Notice, requestUrl, TFile } = require("obsidian");

const DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:8000",
  apiToken: "",
  syncOnSave: false,
  syncIntervalMinutes: 0,
  deleteRemoteMissing: false,
  excludeFolders: ".trash, templates"
};

const BATCH_SIZE = 50;
const SAVE_DEBOUNCE_MS = 4000;

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

module.exports = class NotesHubSyncPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.syncing = false;
    this.saveTimer = null;

    this.addRibbonIcon("upload-cloud", "同步到 Notes Hub", () => this.syncAll());

    this.addCommand({
      id: "notes-hub-sync-all",
      name: "立即同步整個 vault",
      callback: () => this.syncAll()
    });

    this.addCommand({
      id: "notes-hub-sync-current",
      name: "只同步目前這篇筆記",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) this.syncFiles([file], "已同步目前筆記");
        return true;
      }
    });

    this.addSettingTab(new NotesHubSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!this.settings.syncOnSave || !(file instanceof TFile) || file.extension !== "md") return;
        // 打字時會頻繁觸發 modify，等停手幾秒再送
        window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => this.syncFiles([file], null), SAVE_DEBOUNCE_MS);
      })
    );

    if (this.settings.syncIntervalMinutes > 0) {
      this.registerInterval(
        window.setInterval(() => this.syncAll(true), this.settings.syncIntervalMinutes * 60 * 1000)
      );
    }
  }

  onunload() {
    window.clearTimeout(this.saveTimer);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /* ---------------------------------------------------------------- HTTP */

  baseUrl() {
    return (this.settings.serverUrl || "").replace(/\/+$/, "");
  }

  async call(method, path, body) {
    if (!this.baseUrl()) throw new Error("還沒設定伺服器網址");
    if (!this.settings.apiToken) throw new Error("還沒設定 API Token");

    const resp = await requestUrl({
      url: this.baseUrl() + path,
      method,
      headers: {
        Authorization: "Bearer " + this.settings.apiToken,
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false
    });

    if (resp.status === 401) throw new Error("Token 無效或已被撤銷");
    if (resp.status >= 400) {
      let detail = "HTTP " + resp.status;
      try {
        const parsed = resp.json;
        if (parsed && parsed.detail) detail = typeof parsed.detail === "string" ? parsed.detail : detail;
      } catch (err) {
        /* 回應不是 JSON 就用預設訊息 */
      }
      throw new Error(detail);
    }
    return resp.json;
  }

  /* ---------------------------------------------------------------- 同步 */

  excludedPrefixes() {
    return (this.settings.excludeFolders || "")
      .split(",")
      .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .map((part) => part.toLowerCase());
  }

  isExcluded(path) {
    const lower = path.toLowerCase();
    return this.excludedPrefixes().some((prefix) => lower === prefix || lower.startsWith(prefix + "/"));
  }

  collectFiles() {
    return this.app.vault.getMarkdownFiles().filter((file) => !this.isExcluded(file.path));
  }

  async syncAll(silent) {
    if (this.syncing) {
      if (!silent) new Notice("Notes Hub：上一輪同步還在跑");
      return;
    }
    this.syncing = true;
    const notice = silent ? null : new Notice("Notes Hub：比對中…", 0);

    try {
      const files = this.collectFiles();
      const manifest = await this.call("GET", "/api/sync/manifest");

      const remote = new Map();
      (manifest.entries || []).forEach((entry) => remote.set(entry.path, entry.hash));

      const changed = [];
      const seen = new Set();

      for (const file of files) {
        const content = await this.app.vault.cachedRead(file);
        const hash = await sha256Hex(content);
        seen.add(file.path);
        if (remote.get(file.path) !== hash) {
          changed.push({ path: file.path, content, mtime: new Date(file.stat.mtime).toISOString() });
        }
      }

      let created = 0;
      let updated = 0;
      for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        if (notice) {
          notice.setMessage(`Notes Hub：上傳中 ${Math.min(i + batch.length, changed.length)}/${changed.length}`);
        }
        const result = await this.call("POST", "/api/sync/push", { notes: batch });
        created += result.created;
        updated += result.updated;
      }

      let deleted = 0;
      if (this.settings.deleteRemoteMissing) {
        const gone = Array.from(remote.keys()).filter((path) => !seen.has(path));
        for (let i = 0; i < gone.length; i += BATCH_SIZE) {
          await this.call("POST", "/api/sync/delete", { paths: gone.slice(i, i + BATCH_SIZE) });
        }
        deleted = gone.length;
      }

      if (notice) notice.hide();
      if (!silent || created + updated + deleted > 0) {
        new Notice(
          `Notes Hub：新增 ${created}、更新 ${updated}` +
            (deleted ? `、刪除 ${deleted}` : "") +
            `（共掃描 ${files.length} 篇）`
        );
      }
    } catch (error) {
      if (notice) notice.hide();
      new Notice("Notes Hub 同步失敗：" + error.message, 8000);
    } finally {
      this.syncing = false;
    }
  }

  async syncFiles(files, successMessage) {
    try {
      const notes = [];
      for (const file of files) {
        if (this.isExcluded(file.path)) continue;
        notes.push({
          path: file.path,
          content: await this.app.vault.cachedRead(file),
          mtime: new Date(file.stat.mtime).toISOString()
        });
      }
      if (notes.length === 0) return;

      const result = await this.call("POST", "/api/sync/push", { notes });
      if (successMessage && result.unchanged !== notes.length) new Notice(successMessage);
      else if (successMessage) new Notice("Notes Hub：內容沒變，不需要上傳");
    } catch (error) {
      new Notice("Notes Hub 同步失敗：" + error.message, 8000);
    }
  }

  async testConnection() {
    const manifest = await this.call("GET", "/api/sync/manifest");
    return manifest.count;
  }
};

class NotesHubSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Notes Hub Sync" });

    new Setting(containerEl)
      .setName("伺服器網址")
      .setDesc("例如 http://127.0.0.1:8000 或你的正式網域")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8000")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Token")
      .setDesc("在網頁版「設定 → 建立 API Token」取得，格式是 onh_…")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("onh_…")
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("測試連線")
      .setDesc("確認網址與 token 都對")
      .addButton((button) =>
        button.setButtonText("測試").onClick(async () => {
          try {
            const count = await this.plugin.testConnection();
            new Notice(`Notes Hub：連線成功，伺服器上有 ${count} 篇筆記`);
          } catch (error) {
            new Notice("Notes Hub：連線失敗 — " + error.message, 8000);
          }
        })
      );

    new Setting(containerEl)
      .setName("存檔時自動同步")
      .setDesc("停止編輯幾秒後，自動把這一篇送上去")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncOnSave).onChange(async (value) => {
          this.plugin.settings.syncOnSave = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("定時整包同步（分鐘）")
      .setDesc("0 表示關閉。改完要重新載入外掛才會生效")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
          const minutes = parseInt(value, 10);
          this.plugin.settings.syncIntervalMinutes = isNaN(minutes) || minutes < 0 ? 0 : minutes;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("同步時刪除伺服器多出來的筆記")
      .setDesc("開啟後，本地已刪掉的筆記也會從伺服器移除。關閉時伺服器只增不減，比較安全")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.deleteRemoteMissing).onChange(async (value) => {
          this.plugin.settings.deleteRemoteMissing = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("排除的資料夾")
      .setDesc("用逗號分隔，例如：.trash, templates, 私密")
      .addText((text) =>
        text.setValue(this.plugin.settings.excludeFolders).onChange(async (value) => {
          this.plugin.settings.excludeFolders = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
