#!/usr/bin/env bash
# Cloudflare Workers + D1 へのデプロイ（初回は npx wrangler login が必要）
set -euo pipefail
cd "$(dirname "$0")"

if ! grep -q '^\[\[d1_databases\]\]' wrangler.toml; then
  echo "== D1データベース作成 =="
  out=$(npx wrangler d1 create zensho-quiz-db)
  echo "$out"
  id=$(echo "$out" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
  [ -z "$id" ] && id=$(echo "$out" | grep -oE '[0-9a-f-]{36}' | head -1)
  cat >> wrangler.toml <<EOF

[[d1_databases]]
binding = "DB"
database_name = "zensho-quiz-db"
database_id = "$id"
EOF
  echo "== database_id: $id を wrangler.toml に追記 =="
fi

echo "== テーブル作成 =="
npx wrangler d1 execute zensho-quiz-db --remote --file schema.sql -y

echo "== デプロイ =="
npx wrangler deploy

# 先生パスワードを変えたい場合:
#   npx wrangler secret put TEACHER_PW
