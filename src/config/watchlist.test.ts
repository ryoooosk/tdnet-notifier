import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import z from 'zod';
import { loadWatchList } from './watchlist.ts';

/** 一時的なディレクトリの設置 */
const tempDir = mkdtempSync(join(tmpdir(), 'watchlist-test-'));
/** 全テストが終わった後に一度だけ実行される */
after(() => rmSync(tempDir, { recursive: true, force: true }));

let fixtureCount = 0;

/** 内容を一時ファイルに書き出し、そのパスを返す */
function fixture(content: string): string {
  const filePath = join(tempDir, `fixture-${fixtureCount++}.jsonc`);
  writeFileSync(filePath, content);
  return filePath;
}

function assertThrowsWith(run: () => unknown, ...fragments: string[]): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof Error);
    for (const fragment of fragments) {
      assert.ok(
        error.message.includes(fragment),
        `エラーメッセージに ${JSON.stringify(fragment)} が含まれていません: ${error.message}`,
      );
    }
    return true;
  });
}

describe('loadWatchList', () => {
  test('コメント付きの JSONC から証券コードの集合を読む', () => {
    const filePath = fixture(`{"securitiesCodes": ["1234","5678"]}`);

    assert.deepEqual(loadWatchList(filePath), new Set(['1234', '5678']));
  });

  test('小文字で書かれた証券コードを大文字に正規化する', () => {
    const filePath = fixture('{ "securitiesCodes": ["285a"] }');

    assert.deepEqual(loadWatchList(filePath), new Set(['285A']));
  });

  test('末尾のカンマを許容する', () => {
    const filePath = fixture('{ "securitiesCodes": ["6994", "3003",] }');

    assert.deepEqual(loadWatchList(filePath), new Set(['6994', '3003']));
  });

  test('重複した証券コードは 1 件に畳まれる', () => {
    const filePath = fixture('{ "securitiesCodes": ["6501", "6501"] }');

    assert.deepEqual(loadWatchList(filePath), new Set(['6501']));
  });

  test('空配列は空の集合として通る', () => {
    const filePath = fixture('{ "securitiesCodes": [] }');

    assert.equal(loadWatchList(filePath).size, 0);
  });
});

describe('loadWatchList の異常系', () => {
  test('壊れた JSONC を部分的に読まずエラーにする', () => {
    // jsonc-parser は既定だと ["6994",,"3003"] を ['6994','3003'] と読んでしまう。
    // 銘柄が黙って減るのを防げているかを見る
    const filePath = fixture('{ "securitiesCodes": ["6994",,"3003"] }');

    assertThrowsWith(
      () => loadWatchList(filePath),
      filePath,
      'JSONC として読めません',
    );
  });

  test('securitiesCodes が無ければエラーにし、ZodError を cause に残す', () => {
    const filePath = fixture('{}');

    assertThrowsWith(() => loadWatchList(filePath), filePath, '内容が不正です');
    assert.ok(
      getCause(() => loadWatchList(filePath)) instanceof z.ZodError,
      'cause に ZodError が入っていません',
    );
  });

  test('4 文字でない証券コードを検証エラーにする', () => {
    const filePath = fixture('{ "securitiesCodes": ["699"] }');

    assertThrowsWith(
      () => loadWatchList(filePath),
      '証券コードは半角英数字4文字です',
    );
  });
});

function getCause(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.cause : undefined;
  }
  assert.fail('エラーが投げられませんでした');
}
