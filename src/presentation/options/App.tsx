import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AppClient } from '../../contracts/client';
import type { Provider, Snapshot, Vocabulary } from '../../domain/model';
import s from '../styles/app.module.css';
import { DictionaryView } from './DictionaryView';

type Page = 'vocabulary' | 'review' | 'settings' | 'providers' | 'dictionary';
const titles: Record<Page, [string, string]> = {
  dictionary: [
    '遇到一个词，就认识一个词。',
    '离线查词，收藏后加入你的复习节奏。',
  ],
  vocabulary: ['把偶然遇见，变成真正记得。', '你在阅读中收集的词，都在这里。'],
  review: ['再见一面，记得更久。', '先回想，再揭晓。记不住也没关系。'],
  settings: ['找到适合你的阅读节奏。', '少量、持续，保持中文阅读的流畅。'],
  providers: [
    '让 AI，多懂一点语境。',
    '连接你自己的服务，按上下文挑选合适的词。',
  ],
};
export function OptionsApp({ client }: { client: AppClient }) {
  const [page, setPage] = useState<Page>('vocabulary');
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setData(await client.snapshot());
  }, [client]);
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message));
    const update = () => {
      void refresh().catch((e: Error) => setError(e.message));
    };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [refresh]);
  const due =
    data?.vocabulary.filter(
      (v) => v.familiarity === 'learning' && v.dueAt <= Date.now(),
    ).length ?? 0;
  return (
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.logo}>词</span>
          <div>
            <strong>词间</strong>
            <small>ENGLISH IN CONTEXT</small>
          </div>
        </div>
        <nav className={s.nav} aria-label="学习空间导航">
          {(
            [
              ['vocabulary', '▤', '我的单词本'],
              ['review', '◷', `轻量复习${due ? ` · ${due}` : ''}`],
              ['dictionary', 'Aa', '离线词典'],
              ['settings', '☷', '阅读偏好'],
              ['providers', '✧', 'AI 服务'],
            ] as const
          ).map(([id, icon, name]) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => {
                setPage(id);
                setError('');
              }}
            >
              <span>{icon}</span>
              {name}
            </button>
          ))}
        </nav>
        <div className={s.sideNote}>
          每天一点，慢慢发生。
          <br />
          本地优先 · v0.3.0
          <br />
          <small>
            {data
              ? `${data.dictionary.entries.toLocaleString()} 词离线词典 · ${data.dictionary.replacements} 个替换义项`
              : '正在读取词库…'}
          </small>
        </div>
      </aside>
      <main className={s.main}>
        <div className={s.topline}>
          <span>YOUR EVERYDAY ENGLISH</span>
          <span className={s.pill}>
            ● {data?.settings.enabled ? '阅读学习已开启' : '阅读学习已暂停'}
          </span>
        </div>
        <div className={s.heading}>
          <div>
            <h1>{titles[page][0]}</h1>
            <p>{titles[page][1]}</p>
          </div>
          {page === 'vocabulary' && (
            <button
              className={s.secondary}
              onClick={() =>
                void client
                  .exportData()
                  .catch((e: Error) => setError(e.message))
              }
            >
              导出单词本 ↗
            </button>
          )}
        </div>
        {error && (
          <p className={`${s.notice} ${s.error}`} role="alert">
            {error}
          </p>
        )}
        {!data ? (
          <p role="status">
            {error
              ? '后台暂不可用。请重新加载插件后刷新。'
              : '正在打开学习空间…'}
          </p>
        ) : (
          <>
            {page === 'dictionary' && (
              <DictionaryView
                data={data}
                client={client}
                refresh={refresh}
                onError={setError}
              />
            )}
            {page === 'vocabulary' && (
              <VocabularyView
                data={data}
                client={client}
                refresh={refresh}
                onError={setError}
              />
            )}
            {page === 'review' && (
              <ReviewView
                data={data}
                client={client}
                refresh={refresh}
                onError={setError}
              />
            )}
            {page === 'settings' && (
              <SettingsView
                data={data}
                client={client}
                refresh={refresh}
                onError={setError}
              />
            )}
            {page === 'providers' && (
              <ProvidersView
                data={data}
                client={client}
                refresh={refresh}
                onError={setError}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
type Props = {
  data: Snapshot;
  client: AppClient;
  refresh(): Promise<void>;
  onError(message: string): void;
};
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyMark}>Aa</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function VocabularyView({ data, client, refresh, onError }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [visible, setVisible] = useState(30);
  const learning = data.vocabulary.filter((v) => v.familiarity === 'learning');
  const due = learning.filter((v) => v.dueAt <= Date.now());
  const words = data.vocabulary.filter(
    (v) =>
      (filter === 'all' || v.familiarity === filter) &&
      `${v.word.english}${v.word.chinese}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function change(item: Vocabulary, value: Vocabulary['familiarity']) {
    try {
      await client.familiarity(item.id, value);
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : '操作失败');
    }
  }
  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}>
          <span>收集的词汇</span>
          <strong>{data.vocabulary.length.toString().padStart(2, '0')}</strong>
        </div>
        <div className={s.stat}>
          <span>正在学习</span>
          <strong>{learning.length.toString().padStart(2, '0')}</strong>
        </div>
        <div className={s.stat}>
          <span>等待再见面</span>
          <strong>{due.length.toString().padStart(2, '0')}</strong>
        </div>
      </div>
      <div className={s.toolbar}>
        <div className={s.tabs}>
          {[
            ['all', '全部'],
            ['learning', '学习中'],
            ['mastered', '已掌握'],
            ['ignored', '已忽略'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id!);
                setVisible(30);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className={`${s.input} ${s.search}`}
          aria-label="搜索单词"
          placeholder="搜索英文或中文…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(30);
          }}
        />
      </div>
      {!words.length ? (
        <Empty
          title={
            data.vocabulary.length
              ? '没有找到这个词'
              : '让第一个词，自然地出现。'
          }
        >
          打开一个中文网页，点击插件图标开启此网站。
          <br />
          将鼠标移到英文旁的问号上，加入你的第一个词。
        </Empty>
      ) : (
        <div className={s.wordList}>
          {words.slice(0, visible).map((item) => (
            <article key={item.id} className={s.word}>
              <div>
                <h2>{item.word.english}</h2>
                <span className={s.muted}>
                  {item.word.phonetic} · Lv. {item.word.level}
                </span>
              </div>
              <div>
                <p>
                  {item.word.pos} {item.word.meaning}
                </p>
                <p className={s.context} title={item.context}>
                  “{item.context}”
                </p>
                {/^https?:\/\//.test(item.source) && (
                  <a
                    className={s.muted}
                    href={item.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    回到遇见它的地方 ↗
                  </a>
                )}
              </div>
              <select
                className={s.select}
                aria-label={`${item.word.english} 熟悉度`}
                value={item.familiarity}
                onChange={(e) =>
                  void change(item, e.target.value as Vocabulary['familiarity'])
                }
              >
                <option value="learning">学习中</option>
                <option value="mastered">已掌握</option>
                <option value="ignored">不想学习</option>
              </select>
            </article>
          ))}
        </div>
      )}
      {words.length > visible && (
        <button
          className={s.secondary}
          onClick={() => setVisible(visible + 30)}
        >
          再显示 30 个
        </button>
      )}
    </>
  );
}
function ReviewView({ data, client, refresh, onError }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const due = data.vocabulary
    .filter((v) => v.familiarity === 'learning' && v.dueAt <= Date.now())
    .sort((a, b) => a.dueAt - b.dueAt);
  const item = due[0];
  async function answer(remembered: boolean) {
    if (!item) return;
    setBusy(true);
    try {
      await client.review(item.id, remembered);
      setRevealed(false);
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  if (!item)
    return (
      <Empty title="现在没有需要复习的词。">
        继续阅读，遇见新的表达。到期的词会在这里等你。
      </Empty>
    );
  return (
    <div className={s.review}>
      <span className={s.pill}>等待复习 · {due.length} 个词</span>
      <h2>{item.word.english}</h2>
      <span className={s.muted}>
        {item.word.phonetic} · {item.word.pos}
      </span>
      <p className={s.muted}>回想一下，它是什么意思？</p>
      {revealed ? (
        <>
          <h3>{item.word.meaning}</h3>
          {item.word.example ? (
            <p>
              {item.word.example}
              <br />
              <span className={s.muted}>{item.word.exampleZh}</span>
            </p>
          ) : (
            <p className={s.muted}>这条词典释义尚无配套例句。</p>
          )}
          <blockquote>{item.context}</blockquote>
          <div className={s.row}>
            <button
              className={s.secondary}
              disabled={busy}
              onClick={() => void answer(false)}
            >
              还没记住 · 10 分钟后
            </button>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() => void answer(true)}
            >
              记得
            </button>
          </div>
        </>
      ) : (
        <div className={s.row}>
          <button className={s.primary} onClick={() => setRevealed(true)}>
            查看释义
          </button>
        </div>
      )}
    </div>
  );
}
function SettingsView({ data, client, refresh, onError }: Props) {
  const [settings, setSettings] = useState(data.settings);
  const [site, setSite] = useState('');
  const [aiSite, setAiSite] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(next = settings) {
    setBusy(true);
    try {
      await client.saveSettings(next);
      setSettings(next);
      await refresh();
      setNotice('阅读偏好已保存');
    } catch (e) {
      onError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  async function addSite() {
    try {
      const url = new URL(site);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('请输入 http 或 https 网站地址');
      await save({
        ...settings,
        excludedSites: [...new Set([...settings.excludedSites, url.origin])],
        aiSites: settings.aiSites.filter((v) => v !== url.origin),
      });
      setSite('');
    } catch (e) {
      onError(e instanceof Error ? e.message : '无法停用网站');
    }
  }
  async function addAiSite() {
    try {
      const url = new URL(aiSite);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('请输入 http 或 https 网站地址');
      await save({
        ...settings,
        aiSites: [...new Set([...settings.aiSites, url.origin])],
      });
      setAiSite('');
    } catch (error) {
      onError(error instanceof Error ? error.message : '无法保存 AI 授权');
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('备份不得超过 5 MB');
      const count = await client.importData(await file.text());
      await refresh();
      setNotice(`已恢复 ${count} 个词；已有词条保持不变。`);
    } catch (e) {
      onError(e instanceof Error ? e.message : '备份导入失败');
    }
  }
  return (
    <>
      <section className={s.panel}>
        <h2>阅读节奏</h2>
        <p>
          按 ECDICT 词频分档：前 2000 为基础、2001–5000
          为进阶，其余为高阶；缺少有效词频时使用人工档位。每档包含更基础的词，不等同于
          CEFR。你标记的熟悉度优先影响选词。
        </p>
        <div className={s.grid}>
          <label className={s.field}>
            词汇等级
            <select
              className={s.select}
              value={settings.level}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  level: Number(e.target.value) as 1 | 2 | 3,
                })
              }
            >
              <option value="1">基础 · 词频前 2000</option>
              <option value="2">进阶 · 包含词频前 5000</option>
              <option value="3">高阶 · 包含更低频词</option>
            </select>
          </label>
          <label className={s.field}>
            每页最多不同词汇
            <input
              className={s.input}
              type="number"
              min="1"
              max="30"
              value={settings.perPage}
              onChange={(e) =>
                setSettings({ ...settings, perPage: Number(e.target.value) })
              }
            />
          </label>
          <label className={s.field}>
            每个文本片段最多替换
            <input
              className={s.input}
              type="number"
              min="1"
              max="5"
              value={settings.perSegment}
              onChange={(e) =>
                setSettings({ ...settings, perSegment: Number(e.target.value) })
              }
            />
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />
            开启网页词汇替换
          </label>
        </div>
        <button
          className={s.primary}
          disabled={busy}
          onClick={() => void save()}
        >
          保存阅读偏好
        </button>
      </section>
      <section className={s.panel}>
        <h2>停用的网站</h2>
        <p>
          默认在所有普通 HTTP/HTTPS
          网页运行。将不想替换的网站加入这里，当前页面会恢复中文；也可以在插件弹窗中单独停用。
        </p>
        <div className={s.row}>
          <input
            className={s.input}
            style={{ flex: 1 }}
            aria-label="网站地址"
            placeholder="https://example.com"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
          <button
            className={s.secondary}
            disabled={!site || busy}
            onClick={() => void addSite()}
          >
            停用此网站
          </button>
        </div>
        {settings.excludedSites.map((origin) => (
          <div className={s.site} key={origin}>
            <span className={s.code}>{origin}</span>
            <div className={s.row}>
              <button
                className={s.quiet}
                onClick={() =>
                  void save({
                    ...settings,
                    excludedSites: settings.excludedSites.filter(
                      (v) => v !== origin,
                    ),
                  })
                }
              >
                恢复默认开启
              </button>
            </div>
          </div>
        ))}
        {!settings.excludedSites.length && (
          <p>没有停用的网站，所有普通网页默认开启。</p>
        )}
      </section>
      <section className={s.panel}>
        <h2>允许 AI 分析的网站</h2>
        <p>
          默认开启只使用本地词库。只有开启 AI
          服务并单独添加到这里的网站，才允许将文段发给你配置的 AI 服务。
        </p>
        <div className={s.row}>
          <input
            className={s.input}
            style={{ flex: 1 }}
            aria-label="AI 授权网站地址"
            placeholder="https://example.com"
            value={aiSite}
            onChange={(event) => setAiSite(event.target.value)}
          />
          <button
            className={s.secondary}
            disabled={!aiSite || busy}
            onClick={() => void addAiSite()}
          >
            允许发送文段给 AI
          </button>
        </div>
        {settings.aiSites.map((origin) => (
          <div className={s.site} key={origin}>
            <span className={s.code}>{origin}</span>
            <button
              className={s.quiet}
              onClick={() =>
                void save({
                  ...settings,
                  aiSites: settings.aiSites.filter((value) => value !== origin),
                })
              }
            >
              撤销 AI 授权
            </button>
          </div>
        ))}
        {!settings.aiSites.length && <p>还没有网站获得 AI 文段授权。</p>}
      </section>
      <section className={s.panel}>
        <h2>数据留在你的浏览器</h2>
        <p>
          单词本保存在本机。卸载插件会移除本地数据，请定期导出备份。导入只补充缺失的词，不覆盖当前学习进度。Key
          不参与导出。
        </p>
        <div className={s.row}>
          <button
            className={s.secondary}
            onClick={() =>
              void client.exportData().catch((e: Error) => onError(e.message))
            }
          >
            导出学习数据
          </button>
          <label className={s.field}>
            导入备份（JSON，最多 5 MB）
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
    </>
  );
}
const presets: Record<
  string,
  Pick<Provider, 'name' | 'protocol' | 'baseUrl' | 'model'>
> = {
  deepseek: {
    name: 'DeepSeek 官方',
    protocol: 'openai-chat',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
  },
  openai: {
    name: 'OpenAI 官方',
    protocol: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  },
  anthropic: {
    name: 'Anthropic 官方',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: '',
  },
  custom: {
    name: '自定义服务',
    protocol: 'openai-chat',
    baseUrl: '',
    model: '',
  },
};
function newProvider(): Provider {
  return { id: crypto.randomUUID(), ...presets.deepseek!, rememberKey: false };
}
function ProvidersView({ data, client, refresh, onError }: Props) {
  const [form, setForm] = useState<Provider>(newProvider);
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function perform(action: 'models' | 'test' | 'save') {
    try {
      const url = new URL(form.baseUrl);
      if (url.protocol !== 'https:') throw new Error('服务地址需使用 HTTPS');
      const permission =
        action === 'save'
          ? Promise.resolve(true)
          : client.grantOrigin(url.origin);
      setBusy(true);
      setNotice('');
      onError('');
      if (!(await permission)) throw new Error('未获得接口域名权限');
      const provider = {
        ...form,
        model: form.model || (action === 'models' ? 'model-list' : ''),
      };
      if (action === 'models') {
        const result = await client.models(provider, key);
        setModels(result);
        setNotice(`已获取 ${result.length} 个模型，也可以手填模型 ID。`);
      } else if (action === 'test') {
        await client.testProvider(provider, key);
        setNotice('连接成功，词汇判断测试通过。');
      } else {
        await client.saveProvider(provider, key);
        setKey('');
        await refresh();
        setNotice('服务配置已保存。请在上方选择当前服务。');
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function updateActive(id: string, enabled = data.settings.aiEnabled) {
    try {
      await client.saveSettings({
        ...data.settings,
        activeProviderId: id || null,
        aiEnabled: enabled,
      });
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : '保存失败');
    }
  }
  return (
    <>
      <section className={s.panel}>
        <div className={`${s.row} ${s.spread}`}>
          <div>
            <h2>可选的语境增强</h2>
            <p>
              关闭时使用本地词库。开启后还需在“阅读偏好”中为网站允许发送文段。
            </p>
          </div>
          <label className={s.check}>
            <input
              aria-label="启用 AI 增强"
              type="checkbox"
              checked={data.settings.aiEnabled}
              disabled={!data.settings.activeProviderId}
              onChange={(e) =>
                void updateActive(
                  data.settings.activeProviderId ?? '',
                  e.target.checked,
                )
              }
            />
            开启 AI
          </label>
        </div>
        <label className={s.field}>
          当前服务
          <select
            className={s.select}
            value={data.settings.activeProviderId ?? ''}
            onChange={(e) => void updateActive(e.target.value)}
          >
            <option value="">未选择 · 使用本地词库</option>
            {data.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} / {p.model}
                {p.hasKey ? '' : '（需填写 Key）'}
              </option>
            ))}
          </select>
        </label>
        {data.providers.map((p) => (
          <div className={s.site} key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <div className={s.muted}>
                {p.model} ·{' '}
                {p.hasKey
                  ? p.rememberKey
                    ? 'Key 已记住'
                    : 'Key 仅本次浏览器会话'
                  : '尚无可用 Key'}
              </div>
            </div>
            <div className={s.row}>
              <button
                className={s.quiet}
                onClick={() => {
                  setForm(p);
                  setKey('');
                  setModels([]);
                  setNotice('留空 Key 保留原值；更换地址时需重新填写。');
                }}
              >
                编辑
              </button>
              <button
                className={s.quiet}
                onClick={() =>
                  void client
                    .deleteProvider(p.id)
                    .then(refresh)
                    .catch((e: Error) => onError(e.message))
                }
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className={s.panel}>
        <label className={s.field}>
          每日 AI 生成请求上限（连接测试也计入）
          <input
            className={s.input}
            type="number"
            min="1"
            max="500"
            defaultValue={data.settings.dailyAiLimit}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= 500)
                void client
                  .saveSettings({ ...data.settings, dailyAiLimit: value })
                  .then(refresh)
                  .catch((e: Error) => onError(e.message));
            }}
          />
        </label>
        <p>
          失败的生成请求也计入上限；不保证服务商未产生费用。缓存命中不计入。
        </p>
      </section>
      <section className={s.panel}>
        <div className={`${s.row} ${s.spread}`}>
          <h2>
            {data.providers.some((p) => p.id === form.id)
              ? '编辑服务'
              : '添加服务'}
          </h2>
          <button
            className={s.quiet}
            onClick={() => {
              setForm(newProvider());
              setKey('');
              setModels([]);
              setNotice('');
            }}
          >
            ＋ 新建
          </button>
        </div>
        <div className={s.grid}>
          <label className={s.field}>
            快速预设
            <select
              className={s.select}
              defaultValue="deepseek"
              onChange={(e) => {
                setForm({
                  id: crypto.randomUUID(),
                  ...presets[e.target.value]!,
                  rememberKey: false,
                });
                setKey('');
                setModels([]);
              }}
            >
              <option value="deepseek">DeepSeek 官方</option>
              <option value="openai">OpenAI 官方</option>
              <option value="anthropic">Anthropic 官方</option>
              <option value="custom">自定义兼容接口</option>
            </select>
          </label>
          <label className={s.field}>
            配置名称
            <input
              className={s.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className={s.field}>
            接口协议
            <select
              className={s.select}
              value={form.protocol}
              onChange={(e) => {
                setForm({
                  ...form,
                  protocol: e.target.value as Provider['protocol'],
                });
                setModels([]);
              }}
            >
              <option value="openai-chat">OpenAI Chat Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic">Anthropic Messages</option>
            </select>
          </label>
          <label className={s.field}>
            API Base URL
            <input
              className={s.input}
              type="url"
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => {
                setForm({ ...form, baseUrl: e.target.value });
                setModels([]);
              }}
            />
          </label>
          <label className={`${s.field} ${s.fieldWide}`}>
            API Key
            <input
              className={s.input}
              type="password"
              autoComplete="off"
              placeholder={
                data.providers.some((p) => p.id === form.id && p.hasKey)
                  ? '已保存，留空则保留'
                  : '填写你自己的 API Key'
              }
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label className={`${s.field} ${s.fieldWide}`}>
            模型 ID（可获取，也可手填）
            <div className={s.row}>
              <input
                className={s.input}
                style={{ flex: 1 }}
                list="provider-models"
                value={form.model}
                placeholder="输入或选择模型"
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
              <datalist id="provider-models">
                {models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <button
                className={s.secondary}
                disabled={busy || !form.baseUrl}
                onClick={() => void perform('models')}
              >
                获取模型
              </button>
            </div>
          </label>
        </div>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={form.rememberKey}
            onChange={(e) =>
              setForm({ ...form, rememberKey: e.target.checked })
            }
          />
          在本机记住 Key（默认仅保留本次浏览器会话）
        </label>
        <p className={s.muted}>
          请求直接发往你填写的服务。地址是路径前缀，不含 /chat/completions 或
          /messages。Key 不进入单词本导出。
        </p>
        <div className={s.row}>
          <button
            className={s.primary}
            disabled={busy || !form.model || !form.baseUrl}
            onClick={() => void perform('save')}
          >
            保存配置
          </button>
          <button
            className={s.secondary}
            disabled={busy || !form.model || !form.baseUrl}
            onClick={() => void perform('test')}
          >
            {busy ? '正在处理…' : '测试连接与选词'}
          </button>
        </div>
        {notice && (
          <p className={s.notice} role="status">
            {notice}
          </p>
        )}
      </section>
    </>
  );
}
