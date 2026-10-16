#!/usr/bin/env bash
# Сборка видео для сайта из кадров Motion Canvas (output/project/*.jpeg).
# Если в audio/ лежит voiceover.(wav|mp3|m4a|flac|ogg) — озвучка добавляется в ролик.
# Результат: ../public/video/integro.mp4, integro.webm, integro-poster.jpg
set -euo pipefail
cd "$(dirname "$0")/.."

FPS=30
FRAMES="output/project/%06d.jpeg"
OUT="../public/video"
POSTER_SECOND="${POSTER_SECOND:-22.6}"
mkdir -p "$OUT"

AUDIO=""
for ext in wav mp3 m4a flac ogg; do
  if [[ -f "audio/voiceover.$ext" ]]; then AUDIO="audio/voiceover.$ext"; break; fi
done
AUDIO_OFFSET="${AUDIO_OFFSET:-0}"

audio_in=()
audio_mp4=(-an)
audio_webm=(-an)
if [[ -n "$AUDIO" ]]; then
  echo "Озвучка: $AUDIO (сдвиг ${AUDIO_OFFSET} с)"
  audio_in=(-itsoffset "$AUDIO_OFFSET" -i "$AUDIO")
  # Нормализация громкости по EBU R128 и обрезка по длине видео.
  audio_mp4=(-map 0:v -map 1:a -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 128k -shortest)
  audio_webm=(-map 0:v -map 1:a -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a libopus -b:a 96k -shortest)
fi

echo "MP4 (H.264)…"
ffmpeg -y -loglevel error -framerate "$FPS" -i "$FRAMES" "${audio_in[@]}" \
  -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -tune animation \
  -movflags +faststart "${audio_mp4[@]}" "$OUT/integro.mp4"

echo "WebM (VP9)…"
ffmpeg -y -loglevel error -framerate "$FPS" -i "$FRAMES" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 \
  -deadline good -cpu-used 2 -pass 1 -an -f null /dev/null
ffmpeg -y -loglevel error -framerate "$FPS" -i "$FRAMES" "${audio_in[@]}" \
  -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 2 -pass 2 -pix_fmt yuv420p \
  "${audio_webm[@]}" "$OUT/integro.webm"
rm -f ffmpeg2pass-0.log

echo "Постер…"
POSTER_FRAME=$(printf "%06d" "$(python3 -c "print(round($POSTER_SECOND*$FPS))")")
ffmpeg -y -loglevel error -i "output/project/$POSTER_FRAME.jpeg" -q:v 4 "$OUT/integro-poster.jpg"

ls -lh "$OUT"
