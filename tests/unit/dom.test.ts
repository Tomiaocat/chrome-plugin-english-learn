// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyReplacements,
  collectTextNodes,
} from '../../src/infrastructure/dom/page-adapter';
import { starterWords } from '../../src/infrastructure/dictionary/starter';

afterEach(() => {
  document.body.replaceChildren();
});
describe('page preservation', () => {
  it('skips editors, code, hidden text and plugin nodes', () => {
    document.body.innerHTML =
      '<p>这个团队很好</p><textarea>团队编辑内容</textarea><div contenteditable="true">团队编辑内容</div><pre>团队代码内容</pre><p hidden>团队隐藏内容</p><span data-word-context>团队插件内容</span>';
    expect(collectTextNodes(document.body).map((n) => n.data)).toEqual([
      '这个团队很好',
    ]);
  });
  it('preserves neighboring nodes and ignores stale text', () => {
    document.body.innerHTML = '<p>团队很好<strong>原有强调</strong></p>';
    const node = document.querySelector('p')!.firstChild as Text;
    const replacement = {
      segmentId: 'a',
      start: 0,
      end: 2,
      original: '团队',
      word: starterWords.find((w) => w.english === 'team')!,
    };
    expect(
      applyReplacements(node, '旧的文本', [replacement], () => {}),
    ).toEqual([]);
    const wrappers = applyReplacements(
      node,
      '团队很好',
      [replacement],
      () => {},
    );
    expect(document.querySelector('strong')?.textContent).toBe('原有强调');
    expect(
      document.querySelector('button')?.getAttribute('aria-label'),
    ).toContain('team');
    wrappers[0]?.replaceWith(document.createTextNode('团队'));
    expect(document.querySelector('p')?.textContent).toBe('团队很好原有强调');
  });
});
