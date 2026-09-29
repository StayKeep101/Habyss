#!/usr/bin/env python3
"""Verify a built physical-device .app, rather than just source entitlements."""
import pathlib
import plistlib
import subprocess
import sys

if len(sys.argv) != 2:
    sys.exit('Usage: python3 scripts/check-ios-auth.py /path/to/Habyss.app')
app = pathlib.Path(sys.argv[1])
failures = []

def check(ok, description):
    print(('ok' if ok else 'FAIL') + ' — ' + description)
    if not ok:
        failures.append(description)

try:
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    bundle = info.get('CFBundleIdentifier')
    schemes = [s for entry in info.get('CFBundleURLTypes', []) for s in entry.get('CFBundleURLSchemes', [])]
    check(bundle == 'com.habyss.app', 'Habyss bundle identifier')
    check('habyss' in schemes, 'Habyss callback URL scheme')
    signed = subprocess.run(['codesign', '-d', '--entitlements', ':-', str(app)], capture_output=True, check=True)
    entitlements = plistlib.loads(signed.stdout)
    profile = plistlib.loads(subprocess.check_output(
        ['security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')], stderr=subprocess.DEVNULL))
    for source, values in [('Signed app', entitlements), ('Provisioning profile', profile['Entitlements'])]:
        check('Default' in values.get('com.apple.developer.applesignin', []), source + ' permits Sign in with Apple')
        check(values.get('application-identifier', '').endswith('.' + bundle), source + ' matches bundle identifier')
except (OSError, ValueError, subprocess.CalledProcessError) as error:
    sys.exit(f'Could not inspect device build: {error}')
sys.exit(1 if failures else 0)
