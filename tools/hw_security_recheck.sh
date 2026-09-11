#!/bin/zsh
# Read-only re-check of the disclosed items the developers say are fixed. Sends only GET/HEAD
# requests with no body and no credentials, the same as a browser opening the URL. Prints one
# line per check; nothing is written anywhere. Run it yourself and paste the output to Claude.
set -u
echo "== S3 bucket listing (want: 403 AccessDenied on every bucket; 200 + ListBucketResult = still open)"
for b in hyperwolf-website-assets hemp-website-assets stilo-assets hyperdrives3bucket hyperdriver-signatures hyperwolf-s3-backups-prod; do
  code=$(curl -s -m 15 -o /tmp/hw_b.xml -w "%{http_code}" "https://$b.s3.amazonaws.com/")
  echo "  $b -> $code $(grep -o '<ListBucketResult\|<Code>[A-Za-z]*</Code>' /tmp/hw_b.xml | head -1)"
done; rm -f /tmp/hw_b.xml
echo
echo "== CORS (want: no Access-Control-Allow-Origin, or one that is NOT * and NOT evil.example)"
for h in https://api.hyperwolf.prod.ths.agency https://distribution-backend.js.thcs.in https://hyperwolf.prod.ths.agency https://admin.hyperwolf.com http://hyperdrive.hyperwolf.com; do
  echo "  $h: $(curl -s -m 15 -o /dev/null -D - -H 'Origin: https://evil.example' "$h/" | grep -i 'access-control-allow-origin\|^HTTP' | tr '\r\n' '  ')"
done
echo
echo "== Unauthenticated reads that should now be 401/403 (want: 401 or 403; 200 = still open)"
for u in \
  "https://api.hyperwolf.prod.ths.agency/api/v1/admin/products" \
  "https://api.hyperwolf.prod.ths.agency/api/v1/admin/orders" \
  "https://api.hyperwolf.prod.ths.agency/api/v1/admin/users" \
  "https://api.hyperwolf.prod.ths.agency/api/v1/ledgergreen/webhook" \
  "http://hyperdrive.hyperwolf.com/api/v1/fleet/recommend" \
  "https://distribution-backend.js.thcs.in/api/v1/distribution" ; do
  code=$(curl -s -m 15 -o /tmp/hw_r.json -w "%{http_code}" "$u")
  leak=$(grep -o -i '"password"\|"token"\|"accessToken"\|"refreshToken"' /tmp/hw_r.json | sort -u | tr '\n' ' ')
  echo "  $code  $u ${leak:+  <-- response contains: $leak}"
done; rm -f /tmp/hw_r.json
echo
echo "== Public product read: must not carry password/token fields (want: 200 with no field names listed)"
code=$(curl -s -m 15 -o /tmp/hw_p.json -w "%{http_code}" "https://api.hyperwolf.prod.ths.agency/api/v1/products?limit=1")
echo "  $code  $(grep -o -i '"password"\|"token"\|"accessToken"\|"apiKey"' /tmp/hw_p.json | sort -u | tr '\n' ' ')"; rm -f /tmp/hw_p.json
echo
echo "done: $(date '+%Y-%m-%d %H:%M')"
