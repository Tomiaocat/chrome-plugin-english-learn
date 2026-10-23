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
    origin && snapshot?.settings.sites.includes(origin),
  );
  async function enableSite() {
    if (!origin || !snapshot) return;
    const permission = enabledHere
      ? Promise.resolve(true)
      : client.grantOrigin(origin);
    setBusy(true);
    try {
      if (!(await permission)) {
        setStatus('未获得网站权限');
        return;
      }
      await client.saveSettings({
        ...snapshot.settings,
        sites: enabledHere
          ? snapshot.settings.sites.filter((v) => v !== origin)
          : [...snapshot.settings.sites, origin],
      });
      setSnapshot(await client.snapshot());
      setStatus(enabledHere ? '已恢复中文' : '已开启，试着寻找绿色英文词');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    if (!snapshot) return;
    try {
      await client.saveSettings({
        ...snapshot.settings,
        enabled: !snapshot.settings.enabled,
      });
      setSnapshot(await client.snapshot());
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '操作失败');
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
          <span>阅读替换</span>
          <label className={s.check}>
            <input
              aria-label="启用阅读替换"
              type="checkbox"
              checked={snapshot?.settings.enabled ?? false}
              onChange={() => void toggle()}
              disabled={!snapshot}
            />
            {snapshot?.settings.enabled ? '已开启' : '已暂停'}
          </label>
        </div>
        <div className={s.code}>{origin ?? '当前页面不支持文本替换'}</div>
      </div>
      <button
        className={s.primary}
        disabled={!origin || !snapshot || busy}
        onClick={() => void enableSite()}
      >
        {enabledHere ? '在此网站停用' : '在此网站开启'}
      </button>
      <p role="status" className={s.muted}>
        {status || '只处理你主动开启的网站，默认使用本地词库。'}
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
