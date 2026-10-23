import { useState } from 'react';
import type { Word } from '../../domain/model';
import type { AppClient } from '../../contracts/client';

export function WordCard({
  word,
  context,
  client,
  onRestore,
  onClose,
}: {
  word: Word;
  context: string;
  client: AppClient;
  onRestore(): void;
  onClose(): void;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(mastered = false) {
    setBusy(true);
    try {
      if (mastered) await client.markKnown(word.id, context, location.href);
      else await client.saveWord(word.id, context, location.href);
      setStatus(mastered ? '已标记认识' : '已加入单词本');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label={`${word.english} 词卡`}>
      <header>
        <span className="eyebrow">词间 / IN CONTEXT</span>
        <button aria-label="关闭词卡" onClick={onClose}>
          ×
        </button>
      </header>
      <h2>
        {word.english} <small>{word.pos}</small>
      </h2>
      <div className="phonetic">
        {word.phonetic} <span title={word.levelReason}>Lv. {word.level}</span>
      </div>
      <p className="meaning">{word.meaning}</p>
      <div className="usage">{word.usage}</div>
      <p className="example">
        {word.example}
        <br />
        <span>{word.exampleZh}</span>
      </p>
      <footer>
        <button disabled={busy} className="primary" onClick={() => void save()}>
          ＋ 加入学习
        </button>
        <button disabled={busy} onClick={() => void save(true)}>
          我认识
        </button>
        <button onClick={onRestore}>恢复中文</button>
      </footer>
      <p role="status" className="status">
        {status || '原词：' + word.chinese + ' · 本地词库'}
      </p>
    </section>
  );
}
