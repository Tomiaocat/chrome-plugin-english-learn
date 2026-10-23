import type { Request } from '../../contracts/schema';

export interface Sender {
  id?: string;
  url?: string;
  tab?: { id?: number; url?: string };
  frameId?: number;
}
const contentCommands = new Set(['analyze', 'save-word', 'know-word']);
export function isTrustedPage(sender: Sender, extensionId: string): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  const url = new URL(sender.url);
  return (
    url.protocol === 'chrome-extension:' &&
    url.hostname === extensionId &&
    ['/options.html', '/popup.html'].includes(url.pathname)
  );
}
export function authorize(
  request: Request,
  sender: Sender,
  extensionId: string,
): boolean {
  if (isTrustedPage(sender, extensionId)) return request.type !== 'analyze';
  if (
    sender.id !== extensionId ||
    sender.tab?.id === undefined ||
    sender.frameId !== 0 ||
    !sender.url
  )
    return false;
  if (!/^https?:\/\//.test(sender.url)) return false;
  return contentCommands.has(request.type);
}
