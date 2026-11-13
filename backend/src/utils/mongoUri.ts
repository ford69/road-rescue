import { promises as dns } from 'node:dns';

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

export function isMongoSrvTxtTimeout(error: unknown): boolean {
  const err = error as { code?: string; syscall?: string; message?: string };
  if (err?.code === 'ETIMEOUT' && err?.syscall === 'queryTxt') return true;
  return typeof err?.message === 'string' && err.message.includes('queryTxt');
}

/** mongodb+srv needs a DNS TXT record. Some networks time that out while SRV still works. */
export async function expandMongoSrvUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  const parsed = new URL(uri.replace(/^mongodb\+srv:\/\//, 'https://'));
  const records = await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  if (!records.length) {
    throw new Error(`No MongoDB SRV records for ${parsed.hostname}`);
  }

  const hosts = records
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
    .map((record) => `${record.name.replace(/\.$/, '')}:${record.port || 27017}`)
    .join(',');

  const auth =
    parsed.username || parsed.password
      ? `${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@`
      : '';
  const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
  const params = new URLSearchParams(parsed.search);
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  return `mongodb://${auth}${hosts}${pathname}?${params.toString()}`;
}
