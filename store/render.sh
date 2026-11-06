#!/usr/bin/env bash
# Renders the Chrome Web Store images from design/slides.html into assets/.
# Needs Google Chrome and ImageMagick (`magick`). Output: 24-bit PNG, no alpha.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT="${PORT:-8767}"
TMP="$(mktemp -d)"
# Serve the repo root over HTTP: Chrome drops the query string on file:// URLs.
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory .. >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$TMP"' EXIT
sleep 1
PAGE="http://127.0.0.1:$PORT/store/design/slides.html"
mkdir -p assets

render() { # id width height output
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1440,900 --virtual-time-budget=5000 \
    --screenshot="$TMP/$1.png" "$PAGE?$1" 2>/dev/null
  magick "$TMP/$1.png" -crop "$2x$3+0+0" +repage -background white -alpha remove -alpha off "PNG24:assets/$4"
  echo "assets/$4  $(magick identify -format '%wx%h %[channels]' "assets/$4")"
}

for i in 1 2 3 4 5; do render "s$i" 1280 800 "screenshot-$i.png"; done
render small 440 280 small-promo-tile.png
render marquee 1400 560 marquee-promo-tile.png
magick ../public/icon/128.png "PNG32:assets/store-icon-128.png"
echo "assets/store-icon-128.png  $(magick identify -format '%wx%h' assets/store-icon-128.png)"
