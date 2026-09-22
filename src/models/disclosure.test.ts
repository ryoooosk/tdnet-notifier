import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { securitiesCode } from './disclosure.ts';

describe('securitiesCode', () => {
  test('小文字で書かれた証券コードを大文字に正規化する', () => {
    assert.equal(securitiesCode.parse('285a'), '285A');
  });

  test('4 文字でない証券コードを検証エラーにする', () => {
    const result = securitiesCode.safeParse('699');

    assert.ok(!result.success);
    assert.ok(
      result.error.issues.some(
        (issue) => issue.message === '証券コードは半角英数字4文字です',
      ),
    );
  });

  test('記号を含む証券コードを検証エラーにする', () => {
    assert.ok(!securitiesCode.safeParse('69-4').success);
  });
});
