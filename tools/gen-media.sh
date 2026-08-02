#!/usr/bin/env bash
set -euo pipefail
OUT="$1"
# 4:5 — nunca 16:9. Ver ARQUITECTURA.md §4.6
W=1024; H=1280

# name:hue:seed
SPECS=(
  "ch01-borgo:#1B2A33:11"
  "ch02-castillo:#141A26:23"
  "ch03-noche:#101520:31"
  "ch04-encierro:#1A1613:47"
  "ch05-carta:#232019:59"
  "ch06-whitby:#1D2A2A:67"
  "ch07-demeter:#0E1720:73"
  "ch08-sonambula:#181624:83"
  "ch09-consulta:#1C1A18:97"
  "ch10-transfusion:#2A1518:101"
  "ch11-lobo:#131A18:113"
  "ch12-diagnostico:#191A22:127"
  "e-harker:#242018:137"
  "e-dracula:#1A1013:149"
  "e-mina:#1E2126:151"
  "e-lucy:#26202A:163"
  "e-seward:#1B1E1C:173"
  "e-renfield:#221C14:181"
  "e-vanhelsing:#1C1D24:191"
  "e-castillo:#12161F:193"
  "e-whitby:#1A2426:197"
  "e-demeter:#0D141B:199"
)

for spec in "${SPECS[@]}"; do
  IFS=':' read -r name tone seed <<< "$spec"
  magick -size ${W}x${H} -seed "$seed" plasma:fractal \
    -blur 0x18 -colorspace Gray -auto-level \
    -sigmoidal-contrast 7,45% \
    \( +clone -fill "$tone" -colorize 100% \) -compose Overlay -composite \
    -fill "$tone" -colorize 62% \
    \( -size ${W}x${H} -seed "$seed" xc: +noise Gaussian -colorspace Gray -attenuate 0.55 \) \
      -compose Overlay -composite \
    \( -size ${W}x${H} radial-gradient:white-black -gamma 1.6 \) -compose Multiply -composite \
    -brightness-contrast -6x8 \
    -quality 80 "$OUT/$name.webp"
  printf '%-22s %6s KB  ' "$name.webp" "$(( $(stat -c%s "$OUT/$name.webp") / 1024 ))"
  magick "$OUT/$name.webp" -resize 1x1\! -format '%[hex:p{0,0}]' info:
  echo
done
