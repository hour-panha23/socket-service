#!/usr/bin/env bash
APP_ID="app_46958be0cbd7a1723c"      # ← paste your real app_id
SECRET="b01a6222c0cd4e43628a9775756419ecff45d4979bf4bc782322d326f21323002af9f" # ← paste your real secret_key
TIMESTAMP=$(date +%s)
BODY='{"event":"test.ping","payload":{"hello":"world"}}'

MESSAGE="${APP_ID}.${TIMESTAMP}.${BODY}"
SIGNATURE=$(printf '%s' "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "Timestamp: $TIMESTAMP"
echo "Signature: $SIGNATURE"
echo "---"

curl -i -X POST http://localhost:3000/notifications/emit/broadcast \
  -H "Content-Type: application/json" \
  -H "x-app-id: ${APP_ID}" \
  -H "x-timestamp: ${TIMESTAMP}" \
  -H "x-signature: ${SIGNATURE}" \
  -d "$BODY"