import {randomBytes} from 'node:crypto';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
const localNoncePlaceholder='__MIAGENDA_LOCAL_NONCE__';
export default defineConfig(({command}) => ({
  plugins: [react(), {
    name:'miagenda-local-csp', apply:'serve',
    transformIndexHtml: {order:'post', handler(html) {
      const nonce=randomBytes(18).toString('base64');
      return html
        .replace("script-src 'self'", "script-src 'self' 'nonce-"+localNoncePlaceholder+"'")
        .replace("style-src 'self'", "style-src 'self' 'nonce-"+localNoncePlaceholder+"'")
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*")
        .replaceAll(localNoncePlaceholder,nonce);
    }},
  }],
  html: command==='serve'?{cspNonce:localNoncePlaceholder}:undefined,
  base: '/miagenda/',
  test: { maxWorkers:4, include: ['tests/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./tests/setup.ts'], clearMocks: true },
}));
