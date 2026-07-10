#!/usr/bin/env node
/**
 * Re-sync vendored files from an upstream DroppedNeedle checkout.
 *
 * Usage: node scripts/sync-upstream.mjs <path-to-upstream-checkout> [--write]
 *
 * Without --write it reports per-file status against the checkout's HEAD:
 *   clean-same      byte-identical, nothing to do
 *   clean-changed   unmodified here, upstream changed → auto-copied with --write
 *   modified        carries // DESKTOP: edits → shows upstream diff for manual merge
 *   missing         listed in the manifest but absent upstream (moved/deleted?)
 *
 * After syncing, update pinnedCommit in scripts/vendored-manifest.json and the
 * table in VENDORED.md in the same commit.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts/vendored-manifest.json'), 'utf8'));

const [upstreamArg, ...flags] = process.argv.slice(2);
if (!upstreamArg) {
	console.error('Usage: node scripts/sync-upstream.mjs <path-to-upstream-checkout> [--write]');
	process.exit(1);
}
const upstream = resolve(upstreamArg);
const write = flags.includes('--write');

let head = 'unknown';
try {
	head = execSync('git rev-parse HEAD', { cwd: upstream }).toString().trim();
} catch {
	// not a git checkout — proceed anyway
}
console.log(`upstream: ${upstream} @ ${head}`);
console.log(`pinned:   ${manifest.pinnedCommit}\n`);

const counts = { same: 0, changed: 0, modified: 0, missing: 0 };
for (const rel of manifest.files) {
	const up = join(upstream, manifest.pathPrefix, rel);
	const local = join(root, 'src', rel);
	const isModified = manifest.modified.includes(rel);

	if (!existsSync(up)) {
		counts.missing += 1;
		console.log(`missing        ${rel}`);
		continue;
	}
	const upBytes = readFileSync(up);
	const localBytes = existsSync(local) ? readFileSync(local) : Buffer.alloc(0);

	if (isModified) {
		counts.modified += 1;
		console.log(`modified       ${rel}  (manual merge — check upstream diff since pin)`);
		continue;
	}
	if (upBytes.equals(localBytes)) {
		counts.same += 1;
		continue;
	}
	counts.changed += 1;
	if (write) {
		copyFileSync(up, local);
		console.log(`updated        ${rel}`);
	} else {
		console.log(`clean-changed  ${rel}  (--write to update)`);
	}
}

console.log(
	`\n${counts.same} identical, ${counts.changed} ${write ? 'updated' : 'updatable'}, ` +
		`${counts.modified} carrying DESKTOP edits, ${counts.missing} missing upstream`
);
if (counts.missing > 0) process.exitCode = 2;
