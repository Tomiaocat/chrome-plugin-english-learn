import type { Analysis, Replacement } from '../../domain/model';
import type { AppClient } from '../../contracts/client';

const marker = 'data-word-context';
const excluded =
  'script,style,noscript,textarea,input,select,option,pre,code,kbd,samp,svg,math,a,button,[role="button"],[role="textbox"],[contenteditable]:not([contenteditable="false"]),[data-word-context],word-context-card';
export interface WordAnchor {
  anchor: HTMLElement;
  replacement: Replacement;
  context: string;
  restore(): void;
}

export function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = node.textContent ?? '';
      if (
        !parent ||
        parent.closest(excluded) ||
        !/[\u4e00-\u9fff]/.test(text) ||
        text.length > 2000 ||
        text.trim().length < 4
      )
        return NodeFilter.FILTER_REJECT;
      if (parent.closest('[hidden],[aria-hidden="true"]'))
        return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(parent);
      return style.display === 'none' || style.visibility === 'hidden'
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  return nodes;
}

export function applyReplacements(
  node: Text,
  original: string,
  replacements: Replacement[],
  onOpen: (value: WordAnchor) => void,
  trackText?: (node: Text) => void,
): HTMLElement[] {
  if (!node.isConnected || node.data !== original) return [];
  const fragment = document.createDocumentFragment();
  const wrappers: HTMLElement[] = [];
  function appendText(value: string) {
    const text = document.createTextNode(value);
    fragment.append(text);
    trackText?.(text);
  }
  let cursor = 0;
  for (const replacement of replacements.toSorted(
    (a, b) => a.start - b.start,
  )) {
    if (
      replacement.start < cursor ||
      original.slice(replacement.start, replacement.end) !==
        replacement.original
    )
      continue;
    appendText(original.slice(cursor, replacement.start));
    const wrapper = document.createElement('span');
    wrapper.setAttribute(marker, '');
    wrapper.dataset.original = replacement.original;
    wrapper.style.cssText =
      'display:inline!important;color:inherit!important;background:transparent!important;';
    const label = document.createElement('span');
    label.textContent = replacement.word.english;
    label.style.cssText =
      'color:#126b55!important;border-bottom:1px dotted #168368!important;font:inherit!important;';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute(
      'aria-label',
      `查看 ${replacement.word.english} 的释义`,
    );
    trigger.textContent = '?';
    trigger.style.cssText =
      'all:initial!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:12px!important;height:12px!important;margin-left:2px!important;vertical-align:super!important;border-radius:50%!important;background:#e3efe7!important;color:#126b55!important;font:10px/1 sans-serif!important;cursor:pointer!important;';
    const details: WordAnchor = {
      anchor: trigger,
      replacement,
      context: original,
      restore: () =>
        wrapper.replaceWith(document.createTextNode(replacement.original)),
    };
    trigger.addEventListener('pointerenter', () => onOpen(details));
    trigger.addEventListener('focus', () => onOpen(details));
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onOpen(details);
    });
    wrapper.append(label, trigger);
    fragment.append(wrapper);
    wrappers.push(wrapper);
    cursor = replacement.end;
  }
  if (!wrappers.length) return [];
  appendText(original.slice(cursor));
  node.replaceWith(fragment);
  return wrappers;
}

export function startPageAdapter(
  client: Pick<AppClient, 'analyze'>,
  onOpen: (value: WordAnchor) => void,
) {
  let stopped = false;
  let running = false;
  let pending = false;
  let version = 0;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seen = new WeakMap<Text, string>();
  const encountered = new Set<string>();
  const wrappers = new Set<HTMLElement>();
  const observer = new MutationObserver((records) => {
    const relevant = records.some((r) => {
      const parent =
        r.target instanceof Element ? r.target : r.target.parentElement;
      if (parent?.closest(`[${marker}],word-context-card`)) return false;
      if (
        r.type === 'childList' &&
        [...r.addedNodes].length &&
        [...r.addedNodes].every(
          (n) =>
            n instanceof Element && n.matches(`[${marker}],word-context-card`),
        )
      )
        return false;
      return true;
    });
    if (relevant) schedule();
  });
  function observe() {
    if (!stopped && active)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  }
  function schedule(delay = 250) {
    if (stopped) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void scan();
    }, delay);
  }
  async function scan() {
    if (stopped || running) return;
    pending = false;
    running = true;
    const currentVersion = version;
    const nodes = collectTextNodes(document.body)
      .filter((n) => seen.get(n) !== n.data)
      .slice(0, 30);
    const segments = nodes.map((node, index) => ({
      id: String(index),
      text: node.data,
    }));
    nodes.forEach((node) => seen.set(node, node.data));
    let retryAfterMs: number | undefined;
    try {
      const analysis: Analysis = await client.analyze(segments, [
        ...encountered,
      ]);
      if (stopped || version !== currentVersion) return;
      if (analysis.retryAfterMs) {
        nodes.forEach((node) => seen.delete(node));
        retryAfterMs = analysis.retryAfterMs;
        pending = true;
        return;
      }
      observer.disconnect();
      active = analysis.active !== false;
      if (!active) return;
      for (const wrapper of wrappers)
        if (!wrapper.isConnected) wrappers.delete(wrapper);
      nodes.forEach((node, index) => {
        const text = segments[index]?.text;
        if (text === undefined) return;
        const items = analysis.replacements.filter(
          (r) => r.segmentId === String(index),
        );
        const applied = applyReplacements(
          node,
          text,
          items,
          onOpen,
          (generated) => seen.set(generated, generated.data),
        );
        applied.forEach((wrapper) => wrappers.add(wrapper));
        if (applied.length) items.forEach((r) => encountered.add(r.word.id));
      });
    } catch {
      // An updated/disabled extension can invalidate its messaging context.
    } finally {
      running = false;
      observe();
      if (!stopped && active && (pending || nodes.length === 30))
        schedule(retryAfterMs);
    }
  }
  function restore() {
    observer.disconnect();
    for (const wrapper of wrappers)
      if (wrapper.isConnected)
        wrapper.replaceWith(
          document.createTextNode(wrapper.dataset.original ?? ''),
        );
    wrappers.clear();
    encountered.clear();
    seen = new WeakMap();
  }
  observe();
  schedule();
  return {
    refresh() {
      version++;
      active = true;
      restore();
      schedule();
    },
    stop() {
      stopped = true;
      version++;
      clearTimeout(timer);
      restore();
    },
  };
}
