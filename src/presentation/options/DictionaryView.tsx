import { useRef, useState } from 'react';
import type { AppClient } from '../../contracts/client';
import type { DictionarySearch, Snapshot, Word } from '../../domain/model';
import s from '../styles/app.module.css';

export function DictionaryView({
  data,
  client,
  refresh,
  onError,
}: {
  data: Snapshot;
  client: AppClient;
  refresh(): Promise<void>;
  onError(message: string): void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DictionarySearch>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [notice, setNotice] = useState('');
  const request = useRef(0);
  const saved = new Set(data.vocabulary.map((item) => item.word.id));
  async function search(text = query) {
    const id = ++request.current;
    setQuery(text);
    setBusy(true);
    setNotice('');
    onError('');
    try {
      const next = await client.searchDictionary(text.trim());
      if (request.current === id) setResult(next);
    } catch (error) {
      if (request.current === id)
        onError(error instanceof Error ? error.message : '离线词典暂不可用');
    } finally {
      if (request.current === id) setBusy(false);
    }
  }
  async function save(word: Word) {
    setSaving(word.id);
    try {
      await client.saveWord(word.id, `离线查词：${word.english}`, '');
      await refresh();
      setNotice(`${word.english} 已加入单词本，可以开始复习。`);
    } catch (error) {
      onError(error instanceof Error ? error.message : '收藏失败');
    } finally {
      setSaving(undefined);
    }
  }
  return (
    <>
      <section className={s.panel}>
        <h2>随插件携带，断网也能查</h2>
        <p>
          内置 {data.dictionary.entries.toLocaleString()} 个英文词头；其中{' '}
          {data.dictionary.replacements}{' '}
          个精选义项带用法和双语例句，可用于网页替换。
        </p>
        <form
          className={s.row}
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) void search();
          }}
        >
          <label className={s.field} style={{ flex: 1 }}>
            查询离线词典
            <input
              className={s.input}
              maxLength={80}
              value={query}
              placeholder="输入英文词头或中文释义，例如 algorithm / 咖啡"
              onChange={(event) => {
                request.current++;
                setQuery(event.target.value);
                setResult(undefined);
                setBusy(false);
              }}
            />
          </label>
          <button
            type="submit"
            className={s.primary}
            disabled={busy || !query.trim()}
          >
            {busy ? '正在查询…' : '查词'}
          </button>
        </form>
        <p>
          英文支持精确和前缀查询，中文按释义匹配。试试：{' '}
          {['meeting', 'algorithm', '咖啡'].map((example) => (
            <button
              className={s.quiet}
              key={example}
              onClick={() => void search(example)}
            >
              {example}
            </button>
          ))}
        </p>
        <p>
          数据来源：
          <a
            href="https://github.com/skywind3000/ECDICT"
            target="_blank"
            rel="noreferrer"
          >
            ECDICT
          </a>{' '}
          ·{' '}
          <a href="licenses/ECDICT-MIT.txt" target="_blank" rel="noreferrer">
            MIT 许可
          </a>{' '}
          · 精选例句为本项目原创。查询不向外发送内容。
        </p>
      </section>
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
      {result && (
        <>
          <p role="status">
            找到 {result.total} 个词
            {result.total > 30
              ? '，显示前 30 个；可输入更完整的词缩小范围。'
              : '。'}
          </p>
          {!result.total && (
            <div className={s.empty}>
              <h2>精简词典中没有找到</h2>
              <p>试试英文原形或更短的中文释义。当前不是全部英语词汇。</p>
            </div>
          )}
          {result.words.map((word) => (
            <article
              className={s.panel}
              key={word.id}
              aria-label={`${word.english} 词典条目`}
            >
              <div className={`${s.row} ${s.spread}`}>
                <h2>
                  {word.english}{' '}
                  <span className={s.muted}>
                    {word.phonetic} · Lv. {word.level}
                  </span>
                </h2>
                <button
                  className={s.secondary}
                  disabled={saved.has(word.id) || Boolean(saving)}
                  onClick={() => void save(word)}
                >
                  {saved.has(word.id)
                    ? '已在单词本'
                    : saving === word.id
                      ? '正在收藏…'
                      : '加入学习'}
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-line', margin: '14px 0' }}>
                {word.meaning}
              </div>
              <p>{word.levelReason}</p>
              {word.source === 'curated' ? (
                <>
                  <p>{word.usage}</p>
                  <div>
                    {word.example}
                    <br />
                    <span className={s.muted}>{word.exampleZh}</span>
                  </div>
                  <p>精选替换义项 · 可在授权网页中遇见</p>
                </>
              ) : (
                <p>
                  词典词头可能包含多个含义；尚无配套例句，不自动用于网页替换。收藏后可在单词本复习。
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
