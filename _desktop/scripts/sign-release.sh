#!/bin/sh
# Configure a real team-owned App Group and sign inside-out. No credentials are stored here.
set -eu
cd "$(dirname "$0")/.."
: "${HABYSS_TEAM_ID:?Set your Apple Developer Team ID}"
: "${HABYSS_SIGN_IDENTITY:?Set a Developer ID Application signing identity}"
export HABYSS_APP_GROUP="${HABYSS_APP_GROUP:-${HABYSS_TEAM_ID}.com.habyss.shared}"
APP="${HABYSS_APP_PATH:-$PWD/apps/desktop/src-tauri/target/release/bundle/macos/Habyss.app}"
export HABYSS_SIGN_APP="$APP"
python3 - <<'PY'
import os, pathlib, plistlib
app=pathlib.Path(os.environ['HABYSS_SIGN_APP']);group=os.environ['HABYSS_APP_GROUP']
for p in [app/'Contents/Info.plist',app/'Contents/PlugIns/HabyssWidgets.appex/Contents/Info.plist']:
 d=plistlib.loads(p.read_bytes());d['HabyssAppGroup']=group;p.write_bytes(plistlib.dumps(d))
for name,sandbox in [('host',False),('widget',True)]:
 d={'com.apple.security.application-groups':[group]}
 if sandbox:d['com.apple.security.app-sandbox']=True
 pathlib.Path(f'.build/{name}.entitlements').write_bytes(plistlib.dumps(d))
PY
codesign --force --options runtime --timestamp --entitlements .build/widget.entitlements --sign "$HABYSS_SIGN_IDENTITY" "$APP/Contents/PlugIns/HabyssWidgets.appex"
codesign --force --options runtime --timestamp --entitlements .build/host.entitlements --sign "$HABYSS_SIGN_IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
printf '%s\n' 'Signed application verified. Notarization and installed widget verification remain separate steps.'
