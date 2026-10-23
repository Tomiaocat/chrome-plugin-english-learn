import { defineContentScript } from 'wxt/utils/define-content-script';
import { startContent } from '../src/composition/content';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  registration: 'runtime',
  main(ctx) {
    const cleanup = startContent();
    ctx.onInvalidated(cleanup);
  },
});
