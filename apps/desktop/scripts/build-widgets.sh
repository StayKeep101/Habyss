#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .build
xcodebuild -project native/widgets/HabyssWidgets.xcodeproj -scheme HabyssWidgets \
  -configuration Release -derivedDataPath .build/widgets CODE_SIGNING_ALLOWED=NO build \
  > .build/widget-build.log 2>&1 || { tail -60 .build/widget-build.log; exit 1; }
printf '%s\n' 'Widget extension built (unsigned).'
