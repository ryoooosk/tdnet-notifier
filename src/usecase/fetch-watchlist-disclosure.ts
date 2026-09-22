import { fetchDisclosures } from '../data-source/tdnet/fetch-disclosures.ts';
import { loadWatchList } from '../data-source/watchlist/load-watch-list.ts';
import type { Disclosure } from '../model/disclosure.ts';

export default async function fetchWatchlistDisclosure(
  date: string,
): Promise<{ disclosures: Disclosure[]; totalCount: number }> {
  const res = await fetchDisclosures(date);

  if (res.status === 'notFound') {
    throw new Error(`${date} の一覧ページが見つかりませんでした`);
  }
  if (res.status === 'notModified') {
    console.warn('前回の取得から更新がありません。');
    return { disclosures: [], totalCount: 0 };
  }

  const { disclosures, skippedRows, totalCount } = res.value;

  // 読めずに捨てた行は TDnet 側の構造変化のサイン。
  if (skippedRows.length > 0) {
    console.warn(`読み取れなかった行が ${skippedRows.length} 件あります:`);
    for (const row of skippedRows) {
      console.warn(`  [${row.index}] ${row.reason}`);
    }
  }

  const targetCodes = loadWatchList();

  return {
    disclosures: disclosures.filter((d) => targetCodes.has(d.code)),
    totalCount,
  };
}
