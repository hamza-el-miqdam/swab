/**
 * MAP-05 — the map renders fully offline from the vault. Enforced
 * structurally: nothing under src/map/** or app/(main)/** may import the
 * API client or reach for the network. (The runtime side is covered by
 * rendering the carte from the vault alone in the MAP-01/03 suites.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OFFLINE_DIRS = [
  join(__dirname, '..', 'map'),
  join(__dirname, '..', '..', 'app', '(main)'),
];

const FORBIDDEN = [
  /from\s+['"][^'"]*\/api\//u, // src/api client imports
  /require\(\s*['"][^'"]*\/api\//u,
  /\bfetch\s*\(/u,
  /XMLHttpRequest/u,
  /WebSocket/u,
];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return listSourceFiles(full);
    }
    return /\.(ts|tsx)$/u.test(name) ? [full] : [];
  });
}

describe('MAP-05 offline by construction', () => {
  const files = OFFLINE_DIRS.flatMap(listSourceFiles);

  it('found the map and (main) sources to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files.map((f) => [f] as const))(
    '%s never imports the API client or the network',
    (file) => {
      const source = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});
