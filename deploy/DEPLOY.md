# 公開URLを自分で立てる方法

## A. Cloudflare（推奨・無料・常時起動）

Pages版（`pages/`、pages.dev URL）とWorkers版（`worker/`、workers.dev URL）の
2つを用意。中身は同じで、使いやすい方を選んでください。

### A-0. Cloudflare Pages + Functions（pages.dev）

1. https://dash.cloudflare.com で無料アカウント作成
2. Workers & Pages → Create → Pages → 「Connect to Git」→ GitHub連携 →
   `kitan3409-source/zensyo-it` 選択
3. ビルド設定: Framework preset `None`、Root directory `pages`
   （Build command・出力ディレクトリは空欄でOK）
4. 左メニュー D1 → Create database `zensho-quiz-db`
   → Console で `worker/schema.sql` の中身を実行（テーブル作成）
5. Pages プロジェクトの Settings → Bindings → Add → D1 database
   → Variable name `DB` に `zensho-quiz-db` を割り当て
6. 再 Deploy → `https://zensyo-it.pages.dev` が公開URL

`pages/functions/` が自動で API になります（/api/answer, /api/stats）。

### A-1. Workers GitHub連携（pushで自動デプロイ）

1. https://dash.cloudflare.com で無料アカウント作成
2. Workers & Pages → Create → 「Import a repository」→ GitHub連携 →
   `kitan3409-source/zensyo-it` 選択 → ルートディレクトリ `worker`、最初は Deploy せず
3. ダッシュボード左メニュー「D1」→ Create database `zensho-quiz-db`
   → Console で `worker/schema.sql` の内容を実行（テーブル作成）
4. 作成した Worker の Settings → Bindings → Add → D1 database
   → Variable name `DB` に `zensho-quiz-db` を割り当て
5. 再 Deploy → `https://zensho-quiz.<サブドメイン>.workers.dev` が公開URL

以後、GitHubにpushするだけで自動で再デプロイされます。

### A-2. CLI（wrangler）でデプロイ

1. https://dash.cloudflare.com で無料アカウント作成
2. `cd worker && npx wrangler login`（ブラウザが開いて承認）
3. `./deploy.sh` を実行（D1作成→テーブル作成→デプロイまで自動）
4. `https://zensho-quiz.<サブドメイン>.workers.dev` が公開URL

### 共通

- 生徒用: `/`、先生用: `/teacher`（初期パスワード `sensei`）
- 先生パスワード変更: Worker の Settings → Variables → `TEACHER_PW` を追加
  （CLIの場合: `npx wrangler secret put TEACHER_PW`）
- 無料枠: Workers 10万req/日、D1 500万read/日・10万write/日 — クラス全員で使っても余裕
- データは消えません（D1は永続DB）

## B. Render（FastAPI版 `deploy/`）

## 構成

- `pyproject.toml` — 依存パッケージ定義
- `app/main.py` — FastAPI アプリ（`app` 変数）
- `app/static/` — 生徒用・先生用ページと用語データ

## Render で公開する手順

1. https://render.com でサインアップ →「New +」→「Web Service」
2. `kitan3409-source/zensyo-it` リポジトリを接続
3. 設定:
   - Root Directory: `deploy`
   - Runtime: **Python 3**
   - Build Command: `pip install .`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. 「Create Web Service」→ `https://xxxx.onrender.com` が公開URL

## URL

- 生徒用: `https://xxxx.onrender.com/`
- 先生用: `https://xxxx.onrender.com/teacher`（初期パスワード: `sensei`）

## 補足

- 先生パスワード変更: Render の Environment に `TEACHER_PW` を設定
- 無料枠ではDB（SQLite）は再起動でリセットされます。残したい場合は
  Persistent Disk（有料）を追加し、コード内 `/data` が有効になります。
- 再デプロイは GitHub に push するだけで自動反映されます。
