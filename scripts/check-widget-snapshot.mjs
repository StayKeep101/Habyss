#!/usr/bin/env node
// Runs the production Swift snapshot reducer in an isolated UserDefaults suite.
// Requires Xcode command-line tools; never reads the app's shared data.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const source = readFileSync(new URL('../ios/Widget/WidgetShared.swift', import.meta.url), 'utf8');
const start = source.indexOf('struct DashboardTask:');
const end = source.indexOf('// MARK: - App Intent for Interaction');
if (start < 0 || end < start) throw new Error('Could not locate the production snapshot model');
const dir = mkdtempSync(join(tmpdir(), 'habyss-widget-test-'));
try {
    const main = join(dir, 'main.swift');
    const tests = readFileSync(new URL('./tests/WidgetSnapshotChecks.swift', import.meta.url), 'utf8');
    writeFileSync(main, 'import Foundation\n' + source.slice(start, end) + tests);
    execFileSync('xcrun', ['swiftc', main, '-o', join(dir, 'check')], { stdio: 'inherit' });
    execFileSync(join(dir, 'check'), [], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }
