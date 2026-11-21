/**
 * Closes a <dialog> as a browser without `closedby` does on a second Escape while busy (see
 * ModalDialog.browser.spec.ts). jsdom has no close watcher, so specs close it this way.
 */
export function closeNatively(dialog: Element): void {
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
}
