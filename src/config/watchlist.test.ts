import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { describe, test } from 'node:test';
import { loadWatchList } from './watchlist.ts';

describe('loadWatchList', () => {
  test('同梱の watchlist.jsonc から証券コードの集合を読む', () => {
    const watchList = loadWatchList();

    assert.ok(watchList.size > 0, '監視銘柄が 1 件も読めていません');
  });

  test('読んだ証券コードはすべて正準形になっている', () => {
    for (const code of loadWatchList()) {
      assert.match(code, /^[A-Z0-9]{4}$/);
    }
  });

  test('カレントディレクトリに依存せず読める', () => {
    const original = process.cwd();
    process.chdir(tmpdir());
    try {
      assert.ok(loadWatchList().size > 0);
    } finally {
      process.chdir(original);
    }
  });
});
