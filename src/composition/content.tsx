import { createRoot } from 'react-dom/client';
import {
  computePosition,
  flip,
  shift,
  offset,
  autoUpdate,
} from '@floating-ui/dom';
import { browser } from 'wxt/browser';
import { appClient } from '../infrastructure/messaging/client';
import {
  startPageAdapter,
  type WordAnchor,
} from '../infrastructure/dom/page-adapter';
import { WordCard } from '../presentation/word-card/Card';

const cardCss = `:host{all:initial;position:fixed;z-index:2147483647;left:0;top:0;width:330px;max-width:calc(100vw - 24px);display:none;color:#1c2d2a;font:14px/1.6 system-ui,sans-serif;}*{box-sizing:border-box}section{background:#fffdf7;border:1px solid #d8e2d8;border-radius:16px;box-shadow:0 12px 50px #102e2426;padding:20px}header,footer{display:flex;align-items:center;gap:8px}header{justify-content:space-between}button{font:inherit;cursor:pointer;border:0;background:#edf1e8;color:#315448;border-radius:7px;padding:6px 9px}header button{background:transparent;font-size:20px;padding:0 5px}.eyebrow{font:10px/1.5 system-ui;letter-spacing:2px;color:#64776d}h2{font:600 28px/1.3 Georgia,serif;margin:12px 0 4px}small{font:12px system-ui;color:#7c887e}.phonetic{font-size:12px;color:#738176}.phonetic span{float:right}.meaning{font-size:18px;margin:14px 0 10px}.usage{padding:10px;background:#f0f3e9;border-radius:8px;font-size:12px}.example{font-size:13px}.example span{color:#788176}.primary{background:#17674f;color:white}footer{flex-wrap:wrap}.status{font-size:11px;color:#738176;margin:12px 0 0}`;

export function startContent() {
  const flag = '__wordContextRunning';
  const page = window as unknown as Record<string, unknown>;
  if (page[flag]) return () => {};
  page[flag] = true;
  const host = document.createElement('word-context-card');
  host.setAttribute('data-word-context', 'card');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = cardCss;
  const container = document.createElement('div');
  shadow.append(style, container);
  document.documentElement.append(host);
  const root = createRoot(container);
  let cleanupPosition = () => {};
  let current: WordAnchor | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    host.style.display = 'none';
    cleanupPosition();
    current = null;
  };
  function open(value: WordAnchor) {
    if (value === current) {
      clearTimeout(closeTimer);
      return;
    }
    cleanupPosition();
    clearTimeout(closeTimer);
    current = value;
    host.style.display = 'block';
    root.render(
      <WordCard
        key={crypto.randomUUID()}
        word={value.replacement.word}
        context={value.context}
        client={appClient}
        onRestore={() => {
          value.restore();
          close();
        }}
        onClose={close}
      />,
    );
    cleanupPosition = autoUpdate(value.anchor, host, () => {
      void computePosition(value.anchor, host, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(10), flip(), shift({ padding: 12 })],
      }).then(({ x, y }) => {
        host.style.left = `${x}px`;
        host.style.top = `${y}px`;
      });
    });
    value.anchor.addEventListener('pointerleave', delayClose, { once: true });
  }
  function delayClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, 350);
  }
  host.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  host.addEventListener('pointerleave', delayClose);
  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', escape);
  const adapter = startPageAdapter(appClient, open);
  const listener = (message: unknown) => {
    if (
      typeof message === 'object' &&
      message &&
      'type' in message &&
      message.type === 'settings-changed'
    ) {
      close();
      adapter.refresh();
    }
  };
  browser.runtime.onMessage.addListener(listener);
  return () => {
    adapter.stop();
    clearTimeout(closeTimer);
    close();
    root.unmount();
    host.remove();
    document.removeEventListener('keydown', escape);
    browser.runtime.onMessage.removeListener(listener);
    delete page[flag];
  };
}
