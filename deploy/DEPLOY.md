# 公開URLを自分で立てる方法（Render 推奨）

Devinのデプロイ基盤が使えない場合の代替手順。Render の無料枠で動きます。

## 構成

- `pyproject.toml` — 依存パッケージ定義
- `app/main.py` — FastAPI アプリ（`app` 変数）
- `app/static/` — 生徒用・先生用ページと用語データ

## Render で公開する手順

1. GitHubで新規リポジトリを作成（public or private）
2. この `deploy/` フォルダの中身をすべてアップロード
   （GitHubの「Add file → Upload files」でOK、gitコマンド不要）
3. https://render.com でサインアップ →「New +」→「Web Service」
4. 作成したリポジトリを接続
5. 設定:
   - Runtime: **Python 3**
   - Build Command: `pip install .`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. 「Create Web Service」→ `https://xxxx.onrender.com` が公開URL

## URL

- 生徒用: `https://xxxx.onrender.com/`
- 先生用: `https://xxxx.onrender.com/teacher`（初期パスワード: `sensei`）

## 補足

- 先生パスワード変更: Render の Environment に `TEACHER_PW` を設定
- 無料枠ではDB（SQLite）は再起動でリセットされます。残したい場合は
  Persistent Disk（有料）を追加し、コード内 `/data` が有効になります。
- 再デプロイは GitHub に push するだけで自動反映されます。
