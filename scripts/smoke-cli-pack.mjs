import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'kotrain-cli-pack-'));
const tarballs = join(temp, 'tarballs');
const unpacked = join(temp, 'package');
const dataDir = join(temp, 'data');
const workspace = join(temp, 'workspace');
mkdirSync(tarballs);
mkdirSync(dataDir);
mkdirSync(workspace);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim();
}

function jsonCommand(args) {
  const output = run(process.execPath, [join(unpacked, 'dist/index.js'), ...args], {
    cwd: temp,
    env: { ...process.env, KOTRAIN_DATA_DIR: dataDir },
  });
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Expected JSON from ${args.join(' ')}:\n${output}`, { cause: error });
  }
}

try {
  run('npm', ['run', 'build:publish', '--workspace=apps/cli']);
  const packed = run('npm', ['pack', '--workspace=apps/cli', '--pack-destination', tarballs]);
  const tarball = join(tarballs, packed.split('\n').at(-1));
  run('tar', ['-xzf', tarball, '-C', temp]);
  const packageJson = JSON.parse(readFileSync(join(unpacked, 'package.json'), 'utf8'));
  const runTypes = join(unpacked, 'dist/run.d.ts');
  if (packageJson.bin?.kotrain !== './dist/index.js' || packageJson.bin?.nekkos !== './dist/index.js') {
    throw new Error('Packed package is missing the kotrain and nekkos bin entries.');
  }
  const packedDist = readdirSync(join(unpacked, 'dist')).sort();
  const expectedDist = ['index.d.ts', 'index.js', 'run.d.ts', 'run.js'];
  if (JSON.stringify(packedDist) !== JSON.stringify(expectedDist)) {
    throw new Error(`Packed package contains unexpected dist files: ${packedDist.join(', ')}`);
  }
  statSync(join(unpacked, 'dist/index.js'));
  statSync(runTypes);
  if (packageJson.exports?.['./run']?.types !== './dist/run.d.ts') {
    throw new Error('The ./run export does not declare dist/run.d.ts.');
  }

  run('npm', ['install', '--prefix', unpacked, '--ignore-scripts', '--no-package-lock']);
  symlinkSync('..', join(unpacked, 'node_modules/kotrain'), 'dir');
  const runImport = run(
    process.execPath,
    ['-e', "import('kotrain/run').then((m) => console.log(typeof m.runCli))"],
    { cwd: unpacked, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  if (runImport !== 'function') throw new Error(`kotrain/run import failed: ${runImport}`);
  console.log(`kotrain/run import: ${runImport}`);
  const nativeDependency = run(
    process.execPath,
    ['-e', "import('@lydell/node-pty').then(() => console.log('native node-pty: resolved'))"],
    {
      cwd: unpacked,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  console.log(nativeDependency);

  const status = jsonCommand(['status', '--json']);
  if (!Array.isArray(status.workspaces)) throw new Error('status did not return workspaces.');
  console.log(`status --json: ${JSON.stringify(status)}`);

  const added = jsonCommand(['workspace', 'add', workspace, '--json']);
  if (!added.some((item) => item.path === workspace)) {
    throw new Error('workspace add returned the wrong path.');
  }
  console.log(`workspace add: ${JSON.stringify(added)}`);
  const listed = jsonCommand(['workspace', 'list', '--json']);
  if (!listed.some((item) => item.path === workspace)) {
    throw new Error('workspace list did not contain the added workspace.');
  }
  console.log(`workspace list: ${JSON.stringify(listed)}`);

  const mcp = spawn(process.execPath, [join(unpacked, 'dist/index.js'), 'mcp'], {
    cwd: temp,
    env: { ...process.env, KOTRAIN_DATA_DIR: dataDir },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '';
  const responses = new Map();
  const waiters = new Map();
  mcp.stdout.setEncoding('utf8');
  mcp.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const waiter = waiters.get(message.id);
      if (waiter) {
        waiters.delete(message.id);
        waiter(message);
      } else {
        responses.set(message.id, message);
      }
    }
  });
  const request = (id, method, params = {}) =>
    new Promise((resolveResponse, reject) => {
      const existing = responses.get(id);
      if (existing) {
        responses.delete(id);
        resolveResponse(existing);
        return;
      }
      waiters.set(id, resolveResponse);
      mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      setTimeout(() => {
        if (waiters.delete(id)) reject(new Error(`Timed out waiting for MCP response ${id}.`));
      }, 10_000);
    });

  const initialize = await request(1, 'initialize', { protocolVersion: '2025-06-18' });
  if (initialize.result?.protocolVersion !== '2025-06-18') {
    throw new Error(`Unexpected MCP protocol version: ${initialize.result?.protocolVersion}`);
  }
  console.log(`MCP initialize: ${JSON.stringify(initialize)}`);
  mcp.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const tools = await request(2, 'tools/list');
  if (!tools.result?.tools?.some((tool) => tool.name === 'kotrain_status')) {
    throw new Error('MCP tools/list did not include kotrain_status.');
  }
  console.log(
    `MCP tools/list: ${JSON.stringify({ toolCount: tools.result.tools.length, hasKotrainStatus: true })}`,
  );
  const called = await request(3, 'tools/call', { name: 'kotrain_status', arguments: {} });
  if (!called.result?.content?.[0]?.text?.includes('"workspaces"')) {
    throw new Error('MCP kotrain_status returned no status payload.');
  }
  console.log(`MCP tools/call kotrain_status: ${JSON.stringify(called)}`);
  mcp.kill();
  console.log(`CLI package smoke test passed: ${packageJson.name}@${packageJson.version}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
