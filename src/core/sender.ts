/**
 * Options and popup pages are extension pages. The options page lives in a
 * normal tab, so `sender.tab` being present does not make a sender a content
 * script. The URL origin plus extension id is the reliable check.
 */
export function isExtensionPageSender(
  sender: { id?: string; url?: string },
  runtimeId: string,
  extensionBase: string,
): boolean {
  const url = sender.url ?? '';
  return sender.id === runtimeId && extensionBase.length > 0 && url.startsWith(extensionBase);
}
