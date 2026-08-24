export function parseMongoUri(uri: string): { host: string; database: string } {
  const hostMatch = uri.match(/@([^/?]+)/);
  const databaseMatch =
    uri.match(/\.mongodb\.net\/([^?]+)/) ??
    uri.match(/\.net\/([^?]+)/) ??
    uri.match(/:\d+\/([^?]+)/);

  return {
    host: hostMatch?.[1] ?? 'unknown',
    database: databaseMatch?.[1] ?? 'unknown',
  };
}
