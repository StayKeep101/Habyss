#!/bin/bash
# Echo's spoken notification sounds: one short line per moment (leave, start,
# time's up, the day's review) in each of Echo's four voices. Notification
# sounds must be in the app bundle and under 30 seconds; these are ~2 s each.
# Rebuild with: bash scripts/make-echo-sounds.sh  (macOS: uses `say` and `afconvert`).
# lib/echoSounds.ts names them; the files are in the Habyss target's resources.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=ios/Habyss/Sounds
mkdir -p "$OUT"
TMP=$(mktemp -d)

line() { # voice-id say-voice moment text
  say -v "$2" -o "$TMP/$1_$3.aiff" "$4"
  afconvert -f caff -d ima4 "$TMP/$1_$3.aiff" "$OUT/echo_$3_$1.caf"
}

V="Samantha (English (US))"
line normal "$V" leave "Leave now."
line normal "$V" start "Time to start."
line normal "$V" end "Time's up. On to the next."
line normal "$V" review "Your day is scored."

V="Flo (English (US))"
line friendly "$V" leave "Hey! Time to head out."
line friendly "$V" start "Okay, let's start this one!"
line friendly "$V" end "Time's up! On to the next one."
line friendly "$V" review "Your day's ready. Come see how you did!"

V="Daniel (English (UK))"
line dad_mode "$V" leave "Shoes on. We're leaving."
line dad_mode "$V" start "Start now. Not in five minutes. Now."
line dad_mode "$V" end "Time's up, champ. Next thing."
line dad_mode "$V" review "Day's over. Let's talk about it."

V="Eddy (English (US))"
line bully_mode "$V" leave "Leave. Now. Unless being late is your personality."
line bully_mode "$V" start "Start. The couch can wait."
line bully_mode "$V" end "Time's up. Next. Move."
line bully_mode "$V" review "Your score is in. Brace yourself."

V="Jester"
line goofball "$V" leave "Exit, stage left. Like, now."
line goofball "$V" start "Showtime! Let's go."
line goofball "$V" end "Time's up. Next act, please."
line goofball "$V" review "Your report card is in. Act surprised."

rm -rf "$TMP"
ls -la "$OUT"
