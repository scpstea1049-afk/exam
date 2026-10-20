# GitHub Pages 素養測驗生成器範本

GitHub Pages 提供靜態前端；Apps Script 負責安全保存 Gemini API Key 並生成測驗。前端透過隱藏的 Apps Script iframe 和 `postMessage` 溝通，不需要在瀏覽器暴露 API Key，也不使用跨站 `fetch`。

## 檔案

- `index.html`、`config.js`：GitHub Pages 網站
- `apps-script/Code.gs`：Apps Script 網頁入口、bridge 與 Gemini 後端
- `apps-script/ApiBridge.html`：Apps Script 中繼頁
- `apps-script/Index.html`：Apps Script 原生介面（保留免填 Key 版本）
- `apps-script/appsscript.json`：Apps Script 專案設定

## 一、設定並部署 Apps Script

1. 將 `apps-script/` 內的檔案放入你的 Apps Script 專案。
2. 在 Apps Script「專案設定 → 指令碼屬性」新增：

   | 屬性 | 值 |
   | --- | --- |
   | `GEMINI_API_KEY` | 管理者的 Gemini API Key |
   | `GITHUB_PAGES_ORIGIN` | `https://你的帳號.github.io` |

   `GITHUB_PAGES_ORIGIN` 只填來源網域，不包含 repository 路徑或結尾斜線。若使用自訂網域，填入該網域的 HTTPS origin。

3. 在「部署 → 管理部署」編輯網頁應用程式，選擇新版本並更新部署。保留原有 `/exec` 部署網址，或稍後一併更新 `config.js`。
4. 設定部署存取對象。若以專案擁有者身分執行，所有可使用網站的人都可能消耗該專案的 Gemini 配額。

## 二、發布 GitHub Pages

1. 建立 GitHub repository，將本資料夾根目錄的 `index.html`、`config.js`、`README.md` 和 `apps-script/` 上傳。
2. 開啟 **Settings → Pages**。
3. 在 **Build and deployment** 選 **Deploy from a branch**，來源設為 `main` 和 `/(root)`，按 **Save**。
4. 等 Pages 發布完成後，打開 GitHub 顯示的網站網址。

例如網站網址是 `https://你的帳號.github.io/測驗專案/`，Apps Script 的 `GITHUB_PAGES_ORIGIN` 應填 `https://你的帳號.github.io`。

## 三、確認前端連到正確部署

`config.js` 的 `appsScriptBridgeUrl` 預先填入你提供的 Apps Script 部署網址。若部署網址不同，請改成：

```js
appsScriptBridgeUrl: 'https://script.google.com/macros/s/你的部署ID/exec?bridge=1'
```

請勿在 `config.js` 或 GitHub repository 中放入 Gemini API Key。Key 只放在 Apps Script 的 Script Properties。

## 本機預覽

請用 HTTPS 靜態網站預覽。Apps Script bridge 只接受 `GITHUB_PAGES_ORIGIN` 設定的來源，因此直接用 `file://` 開啟不會連線。
