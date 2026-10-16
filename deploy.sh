#!/usr/bin/env bash
# ----------------------------------------------------------------------------
#  Deploy the website to SiteGround → https://arvindsmartspace.com
#  Usage (Git Bash):   ./deploy.sh
#  Needs: the "arvind-sg" host in ~/.ssh/config (SSH key: ~/.ssh/siteground_arvind)
#         and the real api/config.php on this computer (it is git-ignored).
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
[ -f api/config.php ] || { echo "api/config.php is missing — copy api/config.sample.php and fill it in."; exit 1; }

LIST="$(mktemp)"
git ls-files | grep -v -E '^(deploy/|deploy\.sh$)' > "$LIST"
echo "api/config.php" >> "$LIST"
echo "Uploading $(wc -l < "$LIST") files…"

tar -czf - -T "$LIST" | ssh arvind-sg '
  cd ~/www/arvindsmartspace.com/public_html &&
  tar -xzf - &&
  find . -type d -exec chmod 755 {} + &&
  find . -type f ! -path "./api/storage/*" -exec chmod 644 {} + &&
  chmod 600 api/config.php &&
  echo "Server now has $(find . -type f ! -path "./api/storage/*" | wc -l) site files."'
rm -f "$LIST"
echo "Done → https://arvindsmartspace.com/  (if a page looks old: SiteGround → Speed → Caching → Flush)"
