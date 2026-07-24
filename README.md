# 備標控台（Bid Prep Scheduler）

投標備標時程規劃工具。輸入案件的招標公告時間與投標截止時間，自動依公司內部備標作業流程產生完整的待辦清單／時程表，並提供清單檢視與行事曆檢視兩種操作介面。以 Next.js（App Router）+ TypeScript 打造，資料儲存在瀏覽器 `localStorage`，無需後端。

## 開始使用

```bash
npm install
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)。

## 其他指令

```bash
npm run build   # 正式環境建置
npm run start   # 啟動建置後的正式環境伺服器
npm run lint     # ESLint 檢查
npx tsc --noEmit # 型別檢查
```

詳細架構說明請見 [CLAUDE.md](./CLAUDE.md)。
