/**
 * @choi-p/dsh-backup — Web 客户端半边（无构建，直接手写）。
 *
 * 本文件是浏览器插件主体：挂载 `backupPanel` Remote 贡献，并在 Settings 的
 * Plugins 区注册「备份」标签页（`settings.plugins.tab`，id `backup`）。
 * 所有数据经 `remote.backupPanel` 命名空间往返——标签页不持有其它 RPC，
 * 也不自带除展开/预览以外的状态。
 *
 * 设计说明（无构建、零第三方依赖）：
 * - 遵循 Web shell 的 client bundle 握手：`window.__ModuleLoader__.load({ id,
 *   factory })`，factory 的 `require` 从 shell 冻结模块表解析平台模块
 *   （react、@deepseek-ai/cordis 等，由 shell 提供、插件不声明依赖）。
 * - 不使用 JSX/打包器：标签页用 `React.createElement` 手写。
 * - 不使用 zod/schemastery：typert 客户端挂载强制 strict codec（schema 需带
 *   parse()），此处内联极简形状校验器，仅做防御性检查（wire 值由宿主侧
 *   src-json 产生）。
 */

window.__ModuleLoader__.load({
  id: '@choi-p/dsh-backup',
  factory: (require) => {
    'use strict';
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    Object.defineProperty(exports, '__esModule', { value: true });

    const React = require('react');
    const { useEffect, useState } = React;
    const h = React.createElement;
    const Fragment = React.Fragment;

    /** 字典命名空间（本插件拥有）。 */
    const NS = 'settings.backupPanel';

    /** 插件名：与包名、cordis.yml 行 id、bundle id 一致。 */
    const name = '@choi-p/dsh-backup';

    /** 标签页读取的服务；`remote.backupPanel` 随本插件挂载贡献后出现。 */
    const inject = ['slots', 'locale', 'remote'];

    // ---------- 双语文案（zh 为键的源头；{n} 经 t(key, params) 替换） ----------
    const zh = {
      tab: '备份',
      loading: '正在读取备份状态…',
      error: '暂时无法读取备份状态。',
      retry: '重试',
      overview: '备份总览',
      destination: '备份目录',
      dshHome: '数据目录',
      keepDefault: '默认保留',
      copies: '份',
      autoTitle: '定时自动备份',
      autoOnEvery: '每 {n} 小时一次（已持久化，重启续跑）',
      autoOff: '未开启',
      lastAuto: '上次自动备份',
      none: '—',
      autoHoursLabel: '间隔（小时，1~720）',
      enable: '开启',
      disable: '关闭',
      backupNow: '立即备份',
      verifyAll: '校验全部',
      backupsTitle: '已有备份',
      noBackups: '暂无备份。点击「立即备份」执行首次备份。',
      name: '名称',
      size: '大小',
      time: '时间',
      actions: '操作',
      verify: '校验',
      restore: '恢复',
      restorePreviewTitle: '恢复预览（未写入）',
      restoreEntries: '共 {n} 项',
      confirmRestore: '确认恢复',
      cancel: '取消',
      restartHint: '恢复完成后请重启 dsh 使会话与配置生效。',
      sizeUnknown: '—',
      busy: '处理中…',
      download: '下载',
      githubTitle: 'GitHub 同步',
      githubRepo: '仓库',
      githubToken: 'Token',
      githubTokenSet: '已配置',
      githubTokenMissing: '未配置（https 远端需要）',
      githubLastPush: '上次推送',
      githubError: '上次错误',
      githubNotConfigured: '未配置：在下方填写仓库地址，或在 cordis.yml 的 config.githubRepo 设置。',
      githubSyncNow: '立即同步',
      githubBusy: '同步中…',
      githubRepoLabel: '仓库地址',
      save: '保存',
      clear: '清除',
      delete: '删除',
      confirmDelete: '确认删除？',
      exclude: '排除项',
      excludePlaceholder: '每行一个路径，例如：\n.cache\n*.log',
      saveConfig: '保存配置',
      effectiveDest: '当前生效：{path}',
      configHint: '修改会写入 settings.yaml 并即时生效。',
      configSource: '来源：{source}',
    };

    const en = {
      tab: 'Backup',
      loading: 'Loading backup status…',
      error: 'Failed to read backup status.',
      retry: 'Retry',
      overview: 'Overview',
      destination: 'Destination',
      dshHome: 'Data directory',
      keepDefault: 'Default keep',
      copies: 'copies',
      autoTitle: 'Scheduled auto-backup',
      autoOnEvery: 'Every {n} hours (persisted, survives restarts)',
      autoOff: 'Off',
      lastAuto: 'Last auto-backup',
      none: '—',
      autoHoursLabel: 'Interval (hours, 1–720)',
      enable: 'Enable',
      disable: 'Disable',
      backupNow: 'Back up now',
      verifyAll: 'Verify all',
      backupsTitle: 'Backups',
      noBackups: 'No backups yet. Click "Back up now" for the first one.',
      name: 'Name',
      size: 'Size',
      time: 'Time',
      actions: 'Actions',
      verify: 'Verify',
      restore: 'Restore',
      restorePreviewTitle: 'Restore preview (nothing written)',
      restoreEntries: '{n} entries',
      confirmRestore: 'Confirm restore',
      cancel: 'Cancel',
      restartHint: 'Restart dsh after restore so sessions and settings take effect.',
      sizeUnknown: '—',
      busy: 'Working…',
      download: 'Download',
      githubTitle: 'GitHub sync',
      githubRepo: 'Repository',
      githubToken: 'Token',
      githubTokenSet: 'Configured',
      githubTokenMissing: 'Missing (needed for https remotes)',
      githubLastPush: 'Last push',
      githubError: 'Last error',
      githubNotConfigured: 'Not configured: enter a repository below, or set config.githubRepo in cordis.yml.',
      githubSyncNow: 'Sync now',
      githubBusy: 'Syncing…',
      githubRepoLabel: 'Repository',
      save: 'Save',
      clear: 'Clear',
      delete: 'Delete',
      confirmDelete: 'Confirm delete?',
      exclude: 'Exclude',
      excludePlaceholder: 'One path per line, e.g.:\n.cache\n*.log',
      saveConfig: 'Save config',
      effectiveDest: 'Currently: {path}',
      configHint: 'Changes are written to settings.yaml and take effect immediately.',
      configSource: 'Source: {source}',
    };

    // ---------- 作用域样式（随 effect 生命周期注入/移除） ----------
    // 全部选择器收在 [data-dsh-backup] 之下，只引用 dsh web 的主题 token
    // （--dsw-alias-*），自动适配深浅色。
    const PANEL_CSS = `
[data-dsh-backup] {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
}
[data-dsh-backup] .dsb-status {
  margin: 0;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
}
[data-dsh-backup] .dsb-failure {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

/* ── 卡片 ─────────────────────────────────────────────── */
[data-dsh-backup] .dsb-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
[data-dsh-backup] .dsb-card:hover {
  border-color: var(--dsw-alias-label-dimmed);
}
[data-dsh-backup] .dsb-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}
[data-dsh-backup] .dsb-kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 14px;
  margin: 0;
  font-size: 13px;
}
[data-dsh-backup] .dsb-kv dt {
  color: var(--dsw-alias-label-tertiary);
}
[data-dsh-backup] .dsb-kv dd {
  margin: 0;
  min-width: 0;
  word-break: break-all;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-backup] .dsb-divider {
  height: 1px;
  background: var(--dsw-alias-border-l2);
}

/* ── 徽章 ─────────────────────────────────────────────── */
[data-dsh-backup] .dsb-badge {
  flex: none;
  border-radius: 999px;
  padding: 1px 9px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-backup] .dsb-badge[data-tone='ok'] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
[data-dsh-backup] .dsb-badge[data-tone='warn'] {
  background: color-mix(in srgb, var(--dsw-alias-label-error) 12%, transparent);
  color: var(--dsw-alias-label-error);
}

/* ── 按钮 ─────────────────────────────────────────────── */
[data-dsh-backup] button {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}
[data-dsh-backup] .dsb-btn-secondary {
  border-color: var(--dsw-alias-border-l2);
  background: none;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-backup] .dsb-btn-secondary:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-label-dimmed);
}
[data-dsh-backup] .dsb-btn-primary {
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-3);
}
[data-dsh-backup] .dsb-btn-danger {
  border-color: color-mix(in srgb, var(--dsw-alias-label-error) 45%, transparent);
  background: none;
  color: var(--dsw-alias-label-error);
}
[data-dsh-backup] button:disabled {
  opacity: 0.4;
  cursor: default;
}
[data-dsh-backup] button:focus-visible,
[data-dsh-backup] a:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}

/* ── 操作行 ───────────────────────────────────────────── */
[data-dsh-backup] .dsb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
[data-dsh-backup] .dsb-row input {
  width: 8em;
  font: inherit;
  font-size: 13px;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: inherit;
  background: var(--dsw-alias-bg-layer-2);
}
[data-dsh-backup] .dsb-row input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
[data-dsh-backup] .dsb-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
}

/* ── 备份列表（卡片行，非表格） ─────────────────────────── */
[data-dsh-backup] .dsb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
[data-dsh-backup] .dsb-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 14px;
  padding: 10px 2px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
[data-dsh-backup] .dsb-item:first-child {
  border-top: 0;
}
[data-dsh-backup] .dsb-item:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  margin: 0 -8px;
  padding-left: 10px;
  padding-right: 10px;
  border-radius: 8px;
}
[data-dsh-backup] .dsb-item-name {
  min-width: 0;
  font-size: 13px;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  word-break: break-all;
  color: var(--dsw-alias-label-primary);
}
[data-dsh-backup] .dsb-item-meta {
  font-size: 12px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}
[data-dsh-backup] .dsb-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
[data-dsh-backup] .dsb-item-actions button,
[data-dsh-backup] .dsb-item-actions a {
  padding: 3px 10px;
  font-size: 12px;
}
[data-dsh-backup] .dsb-item-actions a {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  text-decoration: none;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  line-height: 1.5;
}
[data-dsh-backup] .dsb-item-actions a:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-label-dimmed);
}
[data-dsh-backup] .dsb-empty {
  margin: 0;
  padding: 12px 0 4px;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 结果横幅 ─────────────────────────────────────────── */
[data-dsh-backup] .dsb-banner {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-3);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
[data-dsh-backup] .dsb-banner[data-ok='true'] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent);
  color: var(--dsw-alias-label-primary);
}
[data-dsh-backup] .dsb-banner[data-ok='false'] {
  border-color: color-mix(in srgb, var(--dsw-alias-label-error) 45%, transparent);
  color: var(--dsw-alias-label-error);
}

/* ── 恢复预览 ─────────────────────────────────────────── */
[data-dsh-backup] .dsb-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 13px;
}
[data-dsh-backup] .dsb-preview strong {
  font-weight: 600;
}
[data-dsh-backup] .dsb-preview ul {
  margin: 0;
  padding-left: 1.2em;
  color: var(--dsw-alias-label-secondary);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  max-height: 10em;
  overflow: auto;
}
`;

    function installPanelStyles() {
      const existing = document.querySelector('style[data-dsh-backup]');
      if (existing !== null) return () => {};
      const element = document.createElement('style');
      element.dataset.dshBackup = '';
      element.textContent = PANEL_CSS;
      document.head.append(element);
      return () => { element.remove(); };
    }

    // ---------- 极简 strict codec 校验器 ----------
    // typert 客户端挂载要求每个 codec 为 mode:'strict' 且 schema 带 parse()。
    // 不引入 zod/schemastery：wire 值由宿主侧 src-json 产生，这里只做防御性
    // 形状校验，类型不符即抛错（与平台其它 strict codec 一致）。
    function codecError(where, expected, actual) {
      throw new Error(`dsh-backup client: ${where} expected ${expected}, got ${actual}`);
    }
    const str = {
      parse(value) {
        if (typeof value !== 'string') codecError('string', 'a string', typeof value);
        return value;
      },
    };
    const num = {
      parse(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) codecError('number', 'a finite number', typeof value);
        return value;
      },
    };
    const bool = {
      parse(value) {
        if (typeof value !== 'boolean') codecError('boolean', 'a boolean', typeof value);
        return value;
      },
    };
    const nullable = (inner) => ({
      parse(value) {
        if (value === null || value === undefined) return null;
        return inner.parse(value);
      },
    });
    const optional = (inner) => ({
      parse(value) {
        if (value === undefined) return undefined;
        return inner.parse(value);
      },
    });
    const arr = (inner) => ({
      parse(value) {
        if (!Array.isArray(value)) codecError('array', 'an array', typeof value);
        return value.map((item) => inner.parse(item));
      },
    });
    const obj = (shape) => ({
      parse(value) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) codecError('object', 'an object', value === null ? 'null' : typeof value);
        const out = {};
        for (const key of Object.keys(shape)) out[key] = shape[key].parse(value[key]);
        return out;
      },
    });

    // ---------- backupPanel Remote 描述符（strict codec） ----------
    // 与宿主半边（lib/index.js 的 PANEL_INVOCATIONS，src-json）共享同一组
    // 端点；两端按同一 wire 契约工作。
    const statusSchema = obj({
      destination: str,
      dshHome: str,
      keepDefault: num,
      autoHours: num,
      lastAuto: nullable(str),
      backups: arr(obj({ name: str, size: nullable(num) })),
    });
    const backupSchema = obj({
      ok: bool,
      summary: str,
      path: str,
      sha: str,
      stale: num,
      keep: num,
    });
    const verifySchema = obj({
      ok: bool,
      summary: str,
      results: arr(obj({ name: str, ok: bool, note: str })),
    });
    const restoreSchema = obj({
      ok: bool,
      dryRun: bool,
      summary: str,
      archive: optional(nullable(str)),
      files: optional(nullable(num)),
      aside: optional(nullable(str)),
      snapshotPath: optional(nullable(str)),
      sample: optional(arr(str)),
    });
    const setAutoSchema = obj({ ok: bool, hours: num, summary: str });
    const githubStatusSchema = obj({
      repoRaw: nullable(str),
      repo: nullable(str),
      tokenSet: bool,
      syncDir: str,
      lastPush: nullable(str),
      lastError: nullable(str),
    });
    const githubSyncSchema = obj({ ok: bool, summary: str, pushed: bool, tooBig: arr(str) });
    const removeSchema = obj({ ok: bool, summary: str });
    const setGithubRepoSchema = obj({ ok: bool, repo: nullable(str), summary: str });
    const configSchema = obj({
      destination: str,
      keep: num,
      exclude: arr(str),
      source: str,
      settingsFile: optional(nullable(str)),
    });
    const setConfigSchema = obj({
      ok: bool,
      summary: str,
      mode: optional(str),
      config: optional(configSchema),
      fields: optional(arr(str)),
    });

    function strictParam(name, schema) {
      return Object.freeze({
        name,
        wire: name,
        source: 'json',
        codec: Object.freeze({ mode: 'strict', typeSymbol: `@choi-p/dsh-backup/types#${name}`, schema }),
        acceptsUndefined: true,
      });
    }

    const keepParam = strictParam('keep', optional(num));
    const selectorParam = strictParam('selector', optional(str));
    const dryRunParam = strictParam('dryRun', optional(bool));
    const hoursParam = strictParam('hours', num);
    const repoParam = strictParam('repo', optional(str));
    const configParam = strictParam('config', optional(obj({
      destination: optional(str),
      keep: optional(num),
      exclude: optional(arr(str)),
    })));

    function strictDescriptor(method, parameters, schema, cancellation) {
      return Object.freeze({
        id: `@choi-p/dsh-backup#backupPanel/${method}`,
        service: 'backupPanel',
        namespace: 'backupPanel',
        method,
        invocation: Object.freeze({ kind: 'direct' }),
        parameters: Object.freeze(parameters.map((p) => Object.freeze({ ...p, codec: Object.freeze(p.codec) }))),
        ...(cancellation ? { cancellation: Object.freeze({ parameter: 'signal' }) } : {}),
        result: Object.freeze({ mode: 'strict', typeSymbol: `@choi-p/dsh-backup/types#${method}Result`, schema }),
      });
    }

    /** `backupPanel` 的客户端 Remote 贡献（与宿主 PANEL_INVOCATIONS 同端点）。 */
    const BACKUP_REMOTE = Object.freeze({
      package: '@choi-p/dsh-backup',
      descriptors: Object.freeze([
        strictDescriptor('status', [], statusSchema, false),
        strictDescriptor('backup', [keepParam], backupSchema, true),
        strictDescriptor('verify', [selectorParam], verifySchema, true),
        strictDescriptor('restore', [selectorParam, dryRunParam], restoreSchema, true),
        strictDescriptor('setAuto', [hoursParam], setAutoSchema, false),
        strictDescriptor('githubStatus', [], githubStatusSchema, false),
        strictDescriptor('githubSyncNow', [], githubSyncSchema, true),
        strictDescriptor('deleteBackup', [selectorParam], removeSchema, true),
        strictDescriptor('setGithubRepo', [repoParam], setGithubRepoSchema, false),
        strictDescriptor('config', [], configSchema, false),
        strictDescriptor('setConfig', [configParam], setConfigSchema, false),
      ]),
    });

    function unwrap(result) {
      if (!result.ok) {
        const err = result.error;
        throw new Error(err && err.message ? `${err.code}: ${err.message}` : 'backupPanel 调用失败');
      }
      return result.value;
    }

    // ---------- 标签页组件（React.createElement，无 JSX） ----------
    /** 从归档名解析展示时间：dsh-YYYYMMDD-HHMMSSmmm → YYYY-MM-DD HH:MM:SS。 */
    function stampOf(name) {
      const m = /^dsh-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
      if (m === null) return null;
      return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
    }

    function mb(size, t) {
      if (typeof size !== 'number') return t('sizeUnknown');
      return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    /** 渲染「备份」标签页。props: { panel, t }（t 由 slot kit 注入，panel 由本插件注入）。 */
    function BackupTab({ panel, t }) {
      const [snap, setSnap] = useState(null);
      const [github, setGithub] = useState(null);
      const [config, setConfig] = useState(null);
      const [failed, setFailed] = useState(false);
      const [request, setRequest] = useState(0);
      const [busy, setBusy] = useState('');
      const [banner, setBanner] = useState(null);
      const [hoursInput, setHoursInput] = useState('');
      const [pending, setPending] = useState(null);
      const [repoInput, setRepoInput] = useState('');
      const [confirmDelete, setConfirmDelete] = useState(null);
      const [destInput, setDestInput] = useState('');
      const [keepInput, setKeepInput] = useState('');
      const [excludeInput, setExcludeInput] = useState('');

      const reload = () => { setRequest((v) => v + 1); };

      useEffect(() => {
        let current = true;
        setFailed(false);
        void Promise.all([panel.status(), panel.githubStatus(), panel.config()]).then(
          ([snapshot, gh, cfg]) => {
            if (current) {
              setSnap(snapshot);
              setGithub(gh);
              setConfig(cfg);
              setDestInput(cfg.destination || '');
              setKeepInput(String(cfg.keep ?? 7));
              setExcludeInput((cfg.exclude || []).join('\n'));
              if (gh.repoRaw !== null) setRepoInput(gh.repoRaw);
            }
          },
          () => { if (current) { setFailed(true); setSnap(null); } },
        );
        return () => { current = false; };
      }, [panel, request]);

      const run = async (id, fn) => {
        setBusy(id);
        try {
          const r = await fn();
          setBanner({ ok: r.ok !== false, text: r.summary || '' });
        } catch (err) {
          setBanner({ ok: false, text: String(err && err.message ? err.message : err) });
        } finally {
          setBusy('');
        }
      };

      const backupNow = () => { void run('backup', () => panel.backup()).then(reload); };
      const verifyAll = () => { void run('verify-all', () => panel.verify('all')).then(reload); };
      const verifyOne = (name) => { void run(`verify:${name}`, () => panel.verify(name)); };
      const setAuto = (hours) => { void run('auto', () => panel.setAuto(hours)).then(reload); };
      const syncNow = () => { void run('github-sync', () => panel.githubSyncNow()).then(reload); };
      const saveRepo = (value) => {
        setConfirmDelete(null);
        void run('github-repo', () => panel.setGithubRepo(value)).then(reload);
      };
      const deleteOne = (name) => {
        setConfirmDelete(null);
        void run(`delete:${name}`, () => panel.deleteBackup(name)).then(reload);
      };

      const saveConfig = () => {
        const keep = Number(keepInput);
        const exclude = excludeInput.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
        void run('config', () => panel.setConfig({
          destination: destInput.trim(),
          keep: Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : undefined,
          exclude,
        })).then(reload);
      };

      const previewRestore = (name) => {
        setPending(null);
        void run(`restore:${name}`, async () => {
          const r = await panel.restore(name, true);
          if (r.ok) setPending({ name, files: r.files, sample: r.sample || [] });
          return r;
        });
      };

      const confirmRestore = () => {
        const target = pending;
        setPending(null);
        void run(`restore:${target.name}`, () => panel.restore(target.name, false)).then(reload);
      };

      const downloadHref = (name) => (
        typeof window !== 'undefined' && window.location
          ? `${window.location.origin}/backup-download/${encodeURIComponent(name)}`
          : ''
      );

      const githubTone = github === null || github.repo === null
        ? undefined
        : (github.tokenSet ? 'ok' : 'warn');

      // 总览卡（snap 就绪前不构建：createElement 会立即求值 children）
      const overviewCard = snap !== null
        ? h('div', { className: 'dsb-card' },
        h('h3', { className: 'dsb-heading' },
          h('span', null, t('overview')),
          h('span', { className: 'dsb-badge', 'data-tone': snap.autoHours > 0 ? 'ok' : undefined },
            snap.autoHours > 0 ? t('autoOnEvery', { n: String(snap.autoHours) }) : t('autoOff')),
        ),
        h('dl', { className: 'dsb-kv' },
          h('dt', null, t('dshHome')),
          h('dd', null, snap.dshHome),
          h('dt', null, t('destination')),
          h('dd', null,
            h('div', { className: 'dsb-row', style: { rowGap: '6px' } },
              h('input', {
                type: 'text', value: destInput,
                onChange: (e) => setDestInput(e.target.value),
                style: { width: '24em' },
                'aria-label': t('destination'),
              }),
              h('span', { className: 'dsb-status' }, t('effectiveDest', { path: snap.destination })),
            ),
          ),
          h('dt', null, t('keepDefault')),
          h('dd', null,
            h('div', { className: 'dsb-row', style: { rowGap: '6px' } },
              h('input', {
                type: 'number', min: '1', value: keepInput,
                onChange: (e) => setKeepInput(e.target.value),
                style: { width: '6em' },
                'aria-label': t('keepDefault'),
              }),
              h('span', { className: 'dsb-status' }, t('copies')),
            ),
          ),
          h('dt', null, t('exclude')),
          h('dd', null,
            h('textarea', {
              rows: Math.max(2, (excludeInput.match(/\n/g) || []).length + 1),
              value: excludeInput,
              onChange: (e) => setExcludeInput(e.target.value),
              placeholder: t('excludePlaceholder'),
              style: {
                width: '24em', font: 'inherit', fontSize: 13, padding: '6px 10px',
                border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
                color: 'inherit', background: 'var(--dsw-alias-bg-layer-2)', resize: 'vertical',
              },
              'aria-label': t('exclude'),
            }),
            config !== null && config.source !== 'default'
              ? h('p', { className: 'dsb-status' }, t('configSource', { source: config.source }))
              : null,
          ),
          h('dt', null, t('lastAuto')),
          h('dd', null, snap.lastAuto ?? t('none')),
        ),
        h('div', { className: 'dsb-row' },
          h('button', {
            type: 'button', className: 'dsb-btn-secondary',
            disabled: busy !== '' || destInput.trim() === '',
            onClick: saveConfig,
          }, busy === 'config' ? t('busy') : t('saveConfig')),
          h('span', { className: 'dsb-status' }, t('configHint')),
        ),
        h('div', { className: 'dsb-divider' }),
        h('div', { className: 'dsb-row' },
          snap.autoHours > 0
            ? h('button', {
              type: 'button', className: 'dsb-btn-secondary',
              disabled: busy !== '', onClick: () => setAuto(0),
            }, t('disable'))
            : h(Fragment, null,
              h('label', null,
                t('autoHoursLabel'),
                h('input', {
                  type: 'number', min: '1', max: '720', value: hoursInput,
                  onChange: (e) => setHoursInput(e.target.value),
                }),
              ),
              h('button', {
                type: 'button', className: 'dsb-btn-secondary',
                disabled: busy !== '' || !(Number(hoursInput) >= 1 && Number(hoursInput) <= 720),
                onClick: () => setAuto(Math.floor(Number(hoursInput))),
              }, t('enable')),
            ),
          h('button', {
            type: 'button', className: 'dsb-btn-secondary',
            disabled: busy !== '', onClick: verifyAll,
          }, busy === 'verify-all' ? t('busy') : t('verifyAll')),
          h('button', {
            type: 'button', className: 'dsb-btn-primary',
            disabled: busy !== '', onClick: backupNow,
          }, busy === 'backup' ? t('busy') : t('backupNow')),
        ),
      )
        : null;

      // GitHub 同步卡
      const githubCard = github !== null
        ? h('div', { className: 'dsb-card' },
          h('h3', { className: 'dsb-heading' },
            h('span', null, t('githubTitle')),
            github.repo !== null
              ? h('span', { className: 'dsb-badge', 'data-tone': githubTone },
                github.tokenSet ? t('githubTokenSet') : t('githubTokenMissing'))
              : null,
          ),
          github.repo === null && repoInput === ''
            ? h('p', { className: 'dsb-status' }, t('githubNotConfigured'))
            : null,
          h('dl', { className: 'dsb-kv' },
            h('dt', null, t('githubRepo')),
            h('dd', null, github.repo ?? t('none')),
            h('dt', null, t('githubLastPush')),
            h('dd', null, github.lastPush ?? t('none')),
            github.lastError !== null
              ? h(Fragment, null,
                h('dt', null, t('githubError')),
                h('dd', null, github.lastError),
              )
              : null,
          ),
          h('div', { className: 'dsb-row' },
            h('label', null,
              t('githubRepoLabel'),
              h('input', {
                type: 'text', placeholder: 'owner/repo', value: repoInput,
                onChange: (e) => setRepoInput(e.target.value),
                style: { width: '18em' },
              }),
            ),
            h('button', {
              type: 'button', className: 'dsb-btn-secondary',
              disabled: busy !== '' || repoInput.trim() === '',
              onClick: () => saveRepo(repoInput.trim()),
            }, t('save')),
            h('button', {
              type: 'button', className: 'dsb-btn-secondary',
              disabled: busy !== '' || repoInput.trim() === '',
              onClick: () => { setRepoInput(''); saveRepo(''); },
            }, t('clear')),
            h('button', {
              type: 'button', className: 'dsb-btn-secondary',
              disabled: busy !== '', onClick: syncNow,
            }, busy === 'github-sync' ? t('githubBusy') : t('githubSyncNow')),
          ),
        )
        : null;

      // 结果横幅
      const bannerEl = banner !== null
        ? h('p', {
          className: 'dsb-banner', role: 'status',
          'data-ok': banner.ok ? 'true' : 'false',
        }, banner.text)
        : null;

      // 恢复预览（二次确认）
      const previewEl = pending !== null
        ? h('div', { className: 'dsb-preview' },
          h('strong', null,
            `${t('restorePreviewTitle')} — ${pending.name} · ${t('restoreEntries', { n: String(pending.files) })}`),
          h('ul', null, pending.sample.slice(0, 10).map((s) => h('li', { key: s }, s))),
          h('p', { className: 'dsb-status' }, t('restartHint')),
          h('div', { className: 'dsb-row' },
            h('button', {
              type: 'button', className: 'dsb-btn-danger',
              disabled: busy !== '', onClick: confirmRestore,
            }, t('confirmRestore')),
            h('button', {
              type: 'button', className: 'dsb-btn-secondary',
              disabled: busy !== '', onClick: () => setPending(null),
            }, t('cancel')),
          ),
        )
        : null;

      // 备份列表卡（同上：snap 就绪前不构建）
      const backupsCard = snap !== null
        ? h('div', { className: 'dsb-card' },
        h('h3', { className: 'dsb-heading' },
          h('span', null, t('backupsTitle')),
          h('span', { className: 'dsb-badge' }, snap.backups.length),
        ),
        snap.backups.length === 0
          ? h('p', { className: 'dsb-empty' }, t('noBackups'))
          : h('ul', { className: 'dsb-list' },
            snap.backups.map((b) => h('li', { className: 'dsb-item', key: b.name },
              h('span', { className: 'dsb-item-name', title: b.name }, b.name),
              h('span', { className: 'dsb-item-meta' }, stampOf(b.name) ?? t('sizeUnknown')),
              h('span', { className: 'dsb-item-meta' }, mb(b.size, t)),
              h('span', { className: 'dsb-item-actions' },
                h('a', { href: downloadHref(b.name), download: b.name }, t('download')),
                h('button', {
                  type: 'button', className: 'dsb-btn-secondary',
                  disabled: busy !== '', onClick: () => verifyOne(b.name),
                }, busy === `verify:${b.name}` ? t('busy') : t('verify')),
                h('button', {
                  type: 'button', className: 'dsb-btn-secondary',
                  disabled: busy !== '', onClick: () => previewRestore(b.name),
                }, busy === `restore:${b.name}` ? t('busy') : t('restore')),
                confirmDelete === b.name
                  ? h('button', {
                    type: 'button', className: 'dsb-btn-danger',
                    disabled: busy !== '', onClick: () => deleteOne(b.name),
                  }, busy === `delete:${b.name}` ? t('busy') : t('confirmDelete'))
                  : h('button', {
                    type: 'button', className: 'dsb-btn-danger',
                    disabled: busy !== '', onClick: () => setConfirmDelete(b.name),
                  }, t('delete')),
              ),
            )),
          ),
      )
        : null;

      return h('div', { 'data-dsh-backup': '', 'aria-busy': busy !== '' },
        snap === null && !failed ? h('p', { className: 'dsb-status' }, t('loading')) : null,
        failed
          ? h('div', { className: 'dsb-failure' },
            h('p', { role: 'alert' }, t('error')),
            h('button', {
              type: 'button', className: 'dsb-btn-secondary', onClick: reload,
            }, t('retry')),
          )
          : null,
        snap !== null
          ? h(Fragment, null, overviewCard, githubCard, bannerEl, previewEl, backupsCard)
          : null,
      );
    }

    // ---------- 浏览器插件主体 ----------
    /** 浏览器插件主体：字典、样式表、Remote 贡献挂载、Settings 标签页注册。 */
    async function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), '@choi-p/dsh-backup: dictionaries');
      ctx.effect(() => installPanelStyles(), '@choi-p/dsh-backup: stylesheet');

      await ctx.remote.$mount(BACKUP_REMOTE);

      ctx.inject(['remote.backupPanel'], (scope) => {
        const t = scope.locale.bind(NS);
        const ns = () => scope.remote.backupPanel;
        const panel = {
          status: async () => unwrap(await ns().status()),
          backup: async (keep) => unwrap(await ns().backup(keep)),
          verify: async (selector) => unwrap(await ns().verify(selector)),
          restore: async (selector, dryRun) => unwrap(await ns().restore(selector, dryRun)),
          setAuto: async (hours) => unwrap(await ns().setAuto(hours)),
          githubStatus: async () => unwrap(await ns().githubStatus()),
          githubSyncNow: async () => unwrap(await ns().githubSyncNow()),
          deleteBackup: async (selector) => unwrap(await ns().deleteBackup(selector)),
          setGithubRepo: async (repo) => unwrap(await ns().setGithubRepo(repo)),
          config: async () => unwrap(await ns().config()),
          setConfig: async (config) => unwrap(await ns().setConfig(config)),
        };
        scope.slots.inject('settings.plugins.tab', () => scope.slots.register({
          name: 'settings.plugins.tab',
          id: 'backup',
          order: 35,
          label: () => t('tab'),
          locale: NS,
          inject: () => ({ panel }),
        }, BackupTab));
      });
    }

    exports.NS = NS;
    exports.name = name;
    exports.inject = inject;
    exports.BACKUP_REMOTE = BACKUP_REMOTE;
    exports.apply = apply;
    return module.exports;
  },
});
