import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveSrv } = vi.hoisted(() => ({
  resolveSrv: vi.fn(),
}));

vi.mock('node:dns', () => ({
  promises: { resolveSrv },
}));

import { expandMongoSrvUri, isMongoSrvTxtTimeout } from '../utils/mongoUri.js';

describe('MongoDB SRV URI helpers', () => {
  beforeEach(() => {
    resolveSrv.mockReset();
  });

  it('detects Atlas queryTxt timeouts', () => {
    expect(isMongoSrvTxtTimeout({ code: 'ETIMEOUT', syscall: 'queryTxt' })).toBe(true);
    expect(isMongoSrvTxtTimeout({ code: 'ENOTFOUND' })).toBe(false);
  });

  it('expands mongodb+srv into shard hosts without a TXT lookup', async () => {
    resolveSrv.mockResolvedValue([
      { name: 'tidespace-shard-00-00.ajjs8.mongodb.net.', port: 27017, priority: 0, weight: 0 },
      { name: 'tidespace-shard-00-01.ajjs8.mongodb.net.', port: 27017, priority: 0, weight: 0 },
    ]);

    const expanded = await expandMongoSrvUri(
      'mongodb+srv://user:secret@tidespace.ajjs8.mongodb.net/road_rescue?retryWrites=true&w=majority',
    );

    expect(resolveSrv).toHaveBeenCalledWith('_mongodb._tcp.tidespace.ajjs8.mongodb.net');
    expect(expanded.startsWith('mongodb://user:secret@')).toBe(true);
    expect(expanded).toContain('tidespace-shard-00-00.ajjs8.mongodb.net:27017');
    expect(expanded).toContain('tidespace-shard-00-01.ajjs8.mongodb.net:27017');
    expect(expanded).toContain('/road_rescue?');
    expect(expanded).toContain('tls=true');
    expect(expanded).toContain('authSource=admin');
    expect(expanded).not.toContain('mongodb+srv://');
  });
});
