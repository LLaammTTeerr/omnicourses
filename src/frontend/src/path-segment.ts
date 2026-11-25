/**
 * One path segment of an API address, from a value the user typed or an ID. A segment of only dots would be
 * resolved by the browser as a relative path ("." this folder, ".." the one above), so the request would reach
 * another address; a trailing space keeps it one segment, and the API then refuses it as a value or answers 404.
 */
export const segment = (value: string): string => {
  const encoded = encodeURIComponent(value);
  return /^\.+$/.test(encoded) ? `${encoded}%20` : encoded;
};
