import { useEffect, useState } from 'react';
import type { AppClient } from '../../contracts/client';
import type { Snapshot } from '../../domain/model';
import s from '../styles/app.module.css';

export function PopupApp({ client }: { client: AppClient }) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [origin, setOrigin] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([client.snapshot(), client.currentOrigin()])
      .then(([data, site]) => {
        setSnapshot(data);
        setOrigin(site);
      })
      .catch((e: Error) => setStatus(e.message));
  }, [client]);
  const enabledHere = Boolean(
    origin && snapshot && !snapshot.settings.excludedSites.includes(origin),
  );
  async function enableSite() {
    if (!origin || !snapshot) return;
    setBusy(true);
    try {
      await client.saveSettings({
        ...snapshot.settings,
        excludedSites: enabledHere
          ? [...new Set([...snapshot.settings.excludedSites, origin])]
          : snapshot.settings.excludedSites.filter((v) => v !== origin),
        aiSites: enabledHere
          ? snapshot.settings.aiSites.filter((v) => v !== origin)
          : snapshot.settings.aiSites,
      });
      setSnapshot(await client.snapshot());
      setStatus(
        enabledHere
          ? '已在此网站停用并恢复中文'
          : snapshot.settings.enabled
            ? '此网站已开启，页面会自动显示绿色英文词和问号角标'
            : '此网站已恢复默认开启；全局替换仍处于暂停',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    if (!snapshot) return;
    setBusy(true);
    try {
      await client.saveSettings({
        ...snapshot.settings,
        enabled: !snapshot.settings.enabled,
      });
      setSnapshot(await client.snapshot());
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.popup}>
      <div className={s.brand}>
        <span className={s.logo}>词</span>
        <div>
          <strong>词间</strong>
          <small>ENGLISH IN CONTEXT</small>
        </div>
      </div>
      <h1>让英语，出现在日常里。</h1>
      <p className={s.muted}>从一小段阅读开始，慢慢积累。</p>
      <div className={s.panel}>
        <div className={`${s.row} ${s.spread}`}>
          <span>全局阅读替换</span>
          <label className={s.check}>
            <input
              aria-label="启用阅读替换"
              type="checkbox"
              checked={snapshot?.settings.enabled ?? false}
              onChange={() => void toggle()}
              disabled={!snapshot || busy}
            />
            {snapshot?.settings.enabled ? '已开启' : '已暂停'}
          </label>
        </div>
        <div className={s.code}>{origin ?? '当前页面不支持文本替换'}</div>
        {origin && snapshot && (
          <p className={s.muted} aria-label="当前网站状态">
            当前网站：
            {enabledHere
              ? snapshot.settings.enabled
                ? '默认开启'
                : '随全局暂停'
              : '已停用'}
          </p>
        )}
      </div>
      <button
        className={s.primary}
        disabled={!origin || !snapshot || busy}
        onClick={() => void enableSite()}
      >
        {enabledHere ? '在此网站停用' : '在此网站开启'}
      </button>
      <p role="status" className={s.muted}>
        {status ||
          (origin && snapshot && !enabledHere
            ? '此网站在停用名单中，点击“在此网站开启”即可恢复。'
            : '默认在所有普通网页运行。不想替换的网站，可单独停用。')}
      </p>
      <div className={`${s.row} ${s.spread}`}>
        <span className={s.muted}>
          已收集 {snapshot?.vocabulary.length ?? 0} 个词
        </span>
        <button className={s.quiet} onClick={() => void client.openOptions()}>
          打开学习空间 ↗
        </button>
      </div>
    </main>
  );
}
