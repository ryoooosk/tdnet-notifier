import { loadWatchList } from '../config/watchlist.ts';
import type { Disclosure } from '../model/disclosure.ts';
import { fetchDisclosures } from '../source/tdnet.ts';

export default async function fetchWatchlistDisclosure(
  date: string,
): Promise<readonly Disclosure[]> {
  const res = await fetchDisclosures(date);

  if (res.status === 'notFound') {
    throw new Error(`${date} の一覧ページが見つかりませんでした`);
  }
  if (res.status === 'notModified') {
    console.warn('前回の取得から更新がありません。');
    return [];
  }

  const { disclosures, skippedRows } = res.value;

  // 読めずに捨てた行は TDnet 側の構造変化のサイン。
  if (skippedRows.length > 0) {
    console.warn(`読み取れなかった行が ${skippedRows.length} 件あります:`);
    for (const row of skippedRows) {
      console.warn(`  [${row.index}] ${row.reason}`);
    }
  }

  const targetCodes = loadWatchList();

  return disclosures.filter((d) => targetCodes.has(d.code));
}
