#!/usr/bin/env node
/**
 * 谓无名知识图谱命令行助手（weiwuming-graph Skill 附带，Node 18+，无依赖）。
 *
 *   node wwm-graph.mjs login                 发起连接：打印授权链接与核对码
 *   node wwm-graph.mjs login --wait          等待用户在网页上批准（可重复运行）
 *   node wwm-graph.mjs whoami                查看当前连接的账号
 *   node wwm-graph.mjs from-word <file.docx> 把填好的 Word 模板转成图谱包并校验（-o 指定输出文件）
 *   node wwm-graph.mjs validate <file>       校验图谱包（无需登录）
 *   node wwm-graph.mjs push <file> [--write] 推送为草稿并给出预览链接（同一 slug 覆盖同一草稿）
 *   node wwm-graph.mjs submit <草稿ID>       把草稿提交审核（务必先征得用户同意）
 *   node wwm-graph.mjs status                我的草稿与投稿
 *   node wwm-graph.mjs withdraw <ID>         删除草稿 / 撤回待审稿
 *   node wwm-graph.mjs logout                撤销本机令牌
 *
 * 选项：--site <网址>（默认 https://weiwuming.cn，也可用环境变量 WEIWUMING_SITE）
 *       --client <名称>（login 时显示给用户的工具名，默认 AI 工具）
 *
 * 头像：avatarUrl 可写本地图片路径（相对 JSON 文件），或把图片放在 JSON 旁的 avatars/<nodeId>.jpg|png|webp；
 * push 时自动上传（服务器转为 256px WebP 并按内容去重），没有图片的人物若站内已有头像会自动复用。
 * --write 把替换后的站内头像地址写回 JSON 文件。
 *
 * 令牌只保存在 ~/.weiwuming/graph-agent.json（权限 600），不会打印到屏幕；
 * 它只能上传/投稿图谱，30 天过期，用户可在 /graph/submit 页面随时撤销。
 */
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const STORE_DIR = path.join(homedir(), '.weiwuming');
const STORE_FILE = path.join(STORE_DIR, 'graph-agent.json');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // --name 与单字母 -o 都视为选项
    const option = /^--(.+)$/.exec(arg) || /^-([a-zA-Z])$/.exec(arg);
    if (option) {
      const key = option[1];
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        args[key] = next;
        i++;
      } else args[key] = true;
    } else args._.push(arg);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const SITE = String(args.site || process.env.WEIWUMING_SITE || 'https://weiwuming.cn').replace(/\/$/, '');
const API = `${SITE}/api`;

/**
 * 不直接 process.exit：Windows 上 fetch 刚结束时强退会触发 libuv 断言崩溃，
 * 改为抛出 CliExit，由入口设置 exitCode 后自然退出。
 */
class CliExit extends Error {
  constructor(code) {
    super(`exit ${code}`);
    this.code = code;
  }
}

function exitWith(code) {
  throw new CliExit(code);
}

function fail(message, code = 1) {
  console.error(`✗ ${message}`);
  exitWith(code);
}

function readStore() {
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return { sites: {} };
  }
}

function writeStore(store) {
  mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
  try {
    chmodSync(STORE_FILE, 0o600);
  } catch {
    // Windows 上 chmod 无效，文件仍在用户目录下
  }
}

function siteEntry(store) {
  store.sites ||= {};
  store.sites[SITE] ||= {};
  return store.sites[SITE];
}

async function request(method, route, { body, token } = {}) {
  let response;
  try {
    response = await fetch(`${API}${route}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    fail(`无法连接 ${SITE}：${err.message}`);
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // 非 JSON 响应
  }
  return { status: response.status, ok: response.ok, data: payload.data, error: payload.error };
}

function readPackage(file) {
  if (!file) fail('请给出图谱包文件路径');
  if (!existsSync(file)) fail(`找不到文件 ${file}`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`${file} 不是合法的 JSON：${err.message}`);
  }
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PLACEHOLDER_AVATAR = `/api/graph-avatars/${'0'.repeat(64)}.webp`;

function isHostedAvatar(url) {
  return /^https:\/\//i.test(url) || url.startsWith('/graph-avatars/') || url.startsWith('/api/graph-avatars/');
}

/**
 * 处理图谱包里的头像：找出本地图片（avatarUrl 写的本地路径，或 avatars/<nodeId>.*），
 * upload=true 时上传并替换为站内地址，否则用占位地址只做校验；
 * 没有头像的人物向站内查询同一人物的已有头像并复用。直接修改 pkg。
 */
async function prepareAvatars(pkg, file, { upload, token }) {
  const nodes = Array.isArray(pkg?.nodes) ? pkg.nodes : [];
  const baseDir = path.dirname(path.resolve(file));
  const summary = { uploaded: 0, deduped: 0, matched: 0, pendingLocal: 0, problems: [] };
  const local = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const declared = typeof node.avatarUrl === 'string' ? node.avatarUrl.trim() : '';
    if (declared && isHostedAvatar(declared)) continue;
    let candidate = null;
    if (declared) {
      candidate = path.resolve(baseDir, declared);
      if (!existsSync(candidate)) {
        summary.problems.push(`${node.nodeId}: 找不到头像文件 ${declared}`);
        continue;
      }
    } else if (typeof node.nodeId === 'string') {
      candidate = IMAGE_EXTS.map((ext) => path.join(baseDir, 'avatars', `${node.nodeId}${ext}`)).find((f) => existsSync(f)) || null;
    }
    if (!candidate) continue;
    if (!IMAGE_EXTS.includes(path.extname(candidate).toLowerCase())) {
      summary.problems.push(`${node.nodeId}: 头像只支持 JPG、PNG、WebP（${path.basename(candidate)}）`);
      continue;
    }
    if (statSync(candidate).size > MAX_IMAGE_BYTES) {
      summary.problems.push(`${node.nodeId}: 头像超过 4MB（${path.basename(candidate)}）`);
      continue;
    }
    local.push({ node, file: candidate });
  }

  for (const item of local) {
    if (!upload) {
      item.node.avatarUrl = PLACEHOLDER_AVATAR;
      summary.pendingLocal += 1;
      continue;
    }
    const image = readFileSync(item.file).toString('base64');
    const result = await request('POST', '/graph-avatars', { body: { image, personName: item.node.name }, token });
    unauthorized(result);
    if (!result.ok) {
      summary.problems.push(`${item.node.nodeId}: ${result.error?.message || `头像上传失败（${result.status}）`}`);
      delete item.node.avatarUrl;
      continue;
    }
    item.node.avatarUrl = result.data.url;
    summary[result.data.reused ? 'deduped' : 'uploaded'] += 1;
  }

  const missing = nodes.filter((n) => n && typeof n === 'object' && typeof n.nodeId === 'string' && !n.avatarUrl);
  if (missing.length) {
    const people = missing.map((n) => ({ nodeId: n.nodeId, name: n.name, altNames: n.altNames, birth: n.birth }));
    const result = await request('POST', '/graph-avatars/match', { body: { people } });
    if (result.ok && result.data) {
      for (const node of missing) {
        const hit = result.data[node.nodeId];
        if (!hit) continue;
        node.avatarUrl = hit.url;
        summary.matched += 1;
      }
    }
  }
  return summary;
}

function printAvatarSummary(summary, { upload }) {
  const parts = [];
  if (summary.uploaded) parts.push(`上传 ${summary.uploaded} 张`);
  if (summary.deduped) parts.push(`${summary.deduped} 张与站内已有图片相同，直接复用`);
  if (summary.pendingLocal) parts.push(`${summary.pendingLocal} 张本地图片将在 push 时上传`);
  if (summary.matched) parts.push(`${summary.matched} 位人物复用站内已有头像`);
  if (parts.length) console.log(`头像：${parts.join('，')}`);
  if (summary.problems.length) printIssues(upload ? '头像问题' : '头像提示', summary.problems.map((m) => ({ path: 'avatar', message: m })));
}

function printIssues(title, issues = []) {
  if (!issues.length) return;
  console.log(`${title}（${issues.length}）：`);
  for (const issue of issues.slice(0, 60)) console.log(`  - ${issue.path}: ${issue.message}`);
  if (issues.length > 60) console.log(`  … 另有 ${issues.length - 60} 条`);
}

function printStats(stats) {
  if (!stats) return;
  console.log(`统计：${stats.lanes} 条泳道 · ${stats.nodes} 个节点 · ${stats.relations} 条关系 · ${stats.events} 个事件 · ${stats.yearFrom}–${stats.yearTo}`);
}

function requireToken() {
  const entry = siteEntry(readStore());
  if (!entry.token) fail(`尚未连接谓无名账号。先运行：node wwm-graph.mjs login${SITE === 'https://weiwuming.cn' ? '' : ` --site ${SITE}`}`, 4);
  return entry.token;
}

function unauthorized(result) {
  if (result.status !== 401) return;
  const store = readStore();
  delete siteEntry(store).token;
  writeStore(store);
  fail('令牌无效、已过期或已被撤销，请重新运行 login 连接账号', 4);
}

const STATUS_TEXT = { draft: '草稿', pending: '待审核', approved: '已上线', rejected: '未通过', withdrawn: '已撤回' };

const commands = {
  async login() {
    const store = readStore();
    const entry = siteEntry(store);

    if (args.wait) {
      const pending = entry.pending;
      if (!pending) fail('没有进行中的连接请求，先运行 login');
      const timeoutMs = Number(args.timeout || 240) * 1000;
      const started = Date.now();
      const interval = Math.max(2, Number(pending.interval) || 5) * 1000;
      while (Date.now() - started < timeoutMs) {
        const result = await request('POST', '/graph-agent/token', { body: { deviceCode: pending.deviceCode } });
        if (result.ok && result.data?.token) {
          entry.token = result.data.token;
          entry.username = result.data.username;
          entry.expiresAt = result.data.expiresAt;
          delete entry.pending;
          writeStore(store);
          console.log(`✓ 已连接谓无名账号：${result.data.username}（令牌有效期至 ${result.data.expiresAt.slice(0, 10)}）`);
          return;
        }
        const name = result.error?.name;
        if (name !== 'authorization_pending') {
          delete entry.pending;
          writeStore(store);
          fail(result.error?.message || `连接失败（${result.status}）`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      console.log(`… 仍在等待用户在网页上批准（核对码 ${pending.userCode}）。可再次运行：node wwm-graph.mjs login --wait`);
      exitWith(2);
    }

    if (entry.token) {
      const me = await request('GET', '/graph-agent/me', { token: entry.token });
      if (me.ok) {
        console.log(`✓ 已连接谓无名账号：${me.data.username}（有效期至 ${String(me.data.expiresAt).slice(0, 10)}）`);
        return;
      }
      delete entry.token;
    }
    if (entry.pending && new Date(entry.pending.expiresAt).getTime() > Date.now() + 30_000) {
      console.log('已有进行中的连接请求。请在浏览器打开下面的链接（需登录谓无名），核对授权码后点「允许」：');
    } else {
      const result = await request('POST', '/graph-agent/authorize', { body: { clientName: String(args.client || 'AI 工具') } });
      if (!result.ok) fail(result.error?.message || `发起连接失败（${result.status}）`);
      entry.pending = {
        deviceCode: result.data.deviceCode,
        userCode: result.data.userCode,
        url: `${SITE}${result.data.verificationPath}`,
        interval: result.data.interval,
        expiresAt: new Date(Date.now() + result.data.expiresIn * 1000).toISOString(),
      };
      writeStore(store);
      console.log('请在浏览器打开下面的链接（需登录谓无名），核对授权码后点「允许」：');
    }
    writeStore(store);
    console.log(`  ${entry.pending.url}`);
    console.log(`  授权码：${entry.pending.userCode}（10 分钟内有效）`);
    console.log('批准后运行：node wwm-graph.mjs login --wait');
  },

  async whoami() {
    const result = await request('GET', '/graph-agent/me', { token: requireToken() });
    unauthorized(result);
    if (!result.ok) fail(result.error?.message || `查询失败（${result.status}）`);
    console.log(`已连接：${result.data.username} · 工具：${result.data.clientName} · 有效期至 ${String(result.data.expiresAt).slice(0, 10)}`);
  },

  async 'from-word'() {
    const file = args._[1];
    if (!file || !/.docx$/i.test(file)) fail('请给出填好的 Word 模板（.docx）路径');
    if (!existsSync(file)) fail(`找不到文件 ${file}`);
    if (statSync(file).size > 5 * 1024 * 1024) fail('Word 文件不能超过 5MB');
    const converted = await request('POST', '/graph-submissions/convert-docx', { body: { file: readFileSync(file).toString('base64') } });
    if (!converted.ok) fail(converted.error?.message || `转换失败（${converted.status}）`);
    const { package: pkg, issues, notes } = converted.data;
    const out = String(args.o || args.out || file.replace(/.docx$/i, '.graph.json'));
    writeFileSync(out, `${JSON.stringify(pkg, null, 2)}
`);
    console.log(`已转换：${pkg.nodes.length} 位人物 · ${pkg.relations.length} 条关系 · ${pkg.events.length} 个事件 → ${out}`);
    printIssues('转换说明', notes);
    printIssues('Word 里需要修改的地方', issues);
    const checked = await request('POST', '/graph-submissions/validate', { body: pkg });
    if (checked.data) {
      console.log(checked.data.ok ? '✓ 校验通过' : `✗ 校验还有 ${checked.data.errors.length} 处错误`);
      printIssues('错误', checked.data.errors);
      printIssues('提示', checked.data.warnings);
    }
    if (issues.length || !checked.data?.ok) exitWith(1);
  },

  async validate() {
    const pkg = readPackage(args._[1]);
    const avatars = await prepareAvatars(pkg, args._[1], { upload: false });
    printAvatarSummary(avatars, { upload: false });
    const result = await request('POST', '/graph-submissions/validate', { body: pkg });
    if (!result.data) fail(result.error?.message || `校验失败（${result.status}）`);
    console.log(result.data.ok ? '✓ 校验通过' : `✗ 有 ${result.data.errors.length} 处错误需要修改`);
    printStats(result.data.stats);
    printIssues('错误', result.data.errors);
    printIssues('提示', result.data.warnings);
    if (!result.data.ok) exitWith(1);
  },

  async push() {
    const token = requireToken();
    const pkg = readPackage(args._[1]);
    const avatars = await prepareAvatars(pkg, args._[1], { upload: true, token });
    printAvatarSummary(avatars, { upload: true });
    if (args.write && (avatars.uploaded || avatars.deduped || avatars.matched)) {
      writeFileSync(args._[1], `${JSON.stringify(pkg, null, 2)}\n`);
      console.log(`已把站内头像地址写回 ${args._[1]}`);
    }
    const result = await request('POST', '/graph-submissions/drafts', { body: pkg, token });
    unauthorized(result);
    if (!result.ok) {
      console.log(`✗ ${result.error?.message || `推送失败（${result.status}）`}`);
      printIssues('错误', result.error?.details?.errors);
      exitWith(1);
    }
    const d = result.data;
    console.log(`✓ 已${d.updated ? '更新' : '保存'}草稿「${d.title}」`);
    console.log(`预览链接：${SITE}${d.previewPath}`);
    console.log(`草稿 ID：${d.id}`);
    printStats(d.stats);
    printIssues('提示', d.warnings);
    console.log('用户可在预览页直接点「提交审核」，或确认后运行：node wwm-graph.mjs submit ' + d.id);
  },

  async submit() {
    const id = args._[1];
    if (!id) fail('请给出草稿 ID（push 的输出里有）');
    const result = await request('POST', `/graph-submissions/${encodeURIComponent(id)}/submit`, { token: requireToken() });
    unauthorized(result);
    if (!result.ok) {
      console.log(`✗ ${result.error?.message || `提交失败（${result.status}）`}`);
      printIssues('错误', result.error?.details?.errors);
      exitWith(1);
    }
    console.log(`✓「${result.data.title}」已提交审核。站方审核通过后会出现在 ${SITE}/graph`);
  },

  async status() {
    const result = await request('GET', '/graph-submissions/mine', { token: requireToken() });
    unauthorized(result);
    if (!result.ok) fail(result.error?.message || `查询失败（${result.status}）`);
    if (!result.data.length) return console.log('还没有草稿或投稿。');
    for (const item of result.data) {
      const link = item.reviewStatus === 'approved' && item.publishedSlug ? `${SITE}/graph/${item.publishedSlug}` : `${SITE}${item.previewPath}`;
      console.log(`[${STATUS_TEXT[item.reviewStatus] || item.reviewStatus}] ${item.title}  /graph/${item.slug}  ID ${item.id}`);
      console.log(`    ${link}${item.reviewNote ? `\n    审核意见：${item.reviewNote}` : ''}`);
    }
  },

  async withdraw() {
    const id = args._[1];
    if (!id) fail('请给出 ID');
    const result = await request('POST', `/graph-submissions/${encodeURIComponent(id)}/withdraw`, { token: requireToken() });
    unauthorized(result);
    if (!result.ok) fail(result.error?.message || `操作失败（${result.status}）`);
    console.log(result.data.reviewStatus === 'deleted' ? `✓ 已删除草稿「${result.data.title}」` : `✓ 已撤回「${result.data.title}」`);
  },

  async logout() {
    const store = readStore();
    const entry = siteEntry(store);
    if (entry.token) await request('POST', '/graph-agent/grants/current/revoke', { token: entry.token });
    delete store.sites[SITE];
    writeStore(store);
    console.log('✓ 已撤销本机令牌并退出');
  },
};

if (!command || !commands[command]) {
  const header = readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/);
  const end = header.findIndex((line) => line.trim() === '*/');
  console.log(header.slice(2, end).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
  process.exit(command ? 1 : 0);
}
try {
  await commands[command]();
} catch (err) {
  if (!(err instanceof CliExit)) throw err;
  process.exitCode = err.code;
}
