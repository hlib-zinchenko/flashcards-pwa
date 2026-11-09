import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { USAGE_URL } from '../src/lib/usage';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('Content-Security-Policy in index.html', () => {
  it('comes before any script, so it covers them', () => {
    expect(csp).not.toBe('');
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });

  it('allows the inline theme script by its hash', () => {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256').update(inline[0]).digest('base64');
    expect(directive('script-src'), `put 'sha256-${hash}' in script-src`).toContain(`'sha256-${hash}'`);
  });

  it('runs no code from elsewhere and sends nothing elsewhere but the usage count', () => {
    expect(directive('script-src')).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
    // The one host it may talk to: the daily usage counter (src/lib/usage.ts), once it's deployed.
    const usage = USAGE_URL ? ` ${new URL(USAGE_URL).origin}` : '';
    expect(directive('connect-src')).toBe(`connect-src 'self'${usage}`);
    expect(directive('object-src')).toBe("object-src 'none'");
  });
});
