import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MCP stdio transport', () => {
  it('negotiates, lists tools, and calls status with JSON-only stdout', async () => {
    const binary = fileURLToPath(new URL('../dist/index.js', import.meta.url));
    if (!existsSync(binary)) {
      throw new Error(`Build the CLI before running this integration test: ${binary}`);
    }
    const child = spawn(process.execPath, [binary, 'mcp'], {
      env: { ...process.env, KOTRAIN_DATA_DIR: `/tmp/kotrain-mcp-test-${process.pid}` },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines: string[] = [];
    let buffer = '';
    const response = new Promise<void>((resolveResponse, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP stdio response timeout')), 10_000);
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          lines.push(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
        }
        if (lines.length >= 3) {
          clearTimeout(timeout);
          resolveResponse();
        }
      });
      child.on('error', reject);
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1' },
      },
    })}\n`);
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    child.stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n');
    child.stdin.write('{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"kotrain_status","arguments":{}}}\n');

    try {
      await response;
      const messages = lines.map((line) => JSON.parse(line));
      expect(messages[0].result.protocolVersion).toBe('2025-06-18');
      expect(messages[1].result.tools.some((tool: { name: string }) => tool.name === 'kotrain_status')).toBe(true);
      expect(messages[2].result.content[0].text).toContain('"providers"');
    } finally {
      child.kill();
    }
  });
});
