import { setTimeout as sleep } from 'node:timers/promises';
import * as cheerio from 'cheerio';
import type { Disclosure } from '../models/disclosure.ts';
import { classifyTitle } from './tdnet-kind.ts';

const BASE_URL = 'https://www.release.tdnet.info/inbs/';
const USER_AGENT = 'tdnet-notifier/0.1';
/** TDnet への負荷を抑えるための最小リクエスト間隔 */
const MIN_REQUEST_INTERVAL_MS = 1_000;
/** 一覧ページ 1 枚あたりの件数 */
const PAGE_SIZE = 100;

const TIME_PATTERN = /^\d{2}:\d{2}$/;
/** 5 桁コード（4 桁コード + 末尾 0）。`141A0` のように英字を含むものが実在する */
const CODE_PATTERN = /^[0-9A-Z]{5}$/;
const DOCUMENT_PATTERN = /^[^/]+\.pdf$/i;
/** 上場取引所は全角 1 文字ずつ連結される。`PH`（フェニックス銘柄）だけ 2 文字 */
const MARKET_PATTERN = /PH|[東名札福]/g;

interface TdnetListPage {
  /** 一覧の対象日（JST, `YYYY-MM-DD`） */
  readonly date: string;
  readonly rows: readonly TdnetRow[];
  /** その日の全開示件数。開示ゼロの日は 0 */
  readonly totalCount: number;
  /** その日の総ページ数。開示ゼロの日は 0 */
  readonly pageCount: number;
  readonly skippedRows: readonly SkippedRow[];
}

/** 一覧の 1 行。HTML に書かれている値をそのまま持つ中間表現 */
interface TdnetRow {
  /** 開示時刻 `HH:MM`（JST）。日付は持たないので TdnetListPage.date と組み合わせる */
  readonly time: string;
  /** 5 桁の証券コード。数値ではなく文字列で扱う */
  readonly code: string;
  readonly companyName: string;
  readonly title: string;
  /** PDF のファイル名から拡張子を除いたもの。開示の一意キーになる */
  readonly originalId: string;
  /** PDF の絶対 URL */
  readonly documentUrl: string;
  /** XBRL(zip) の絶対 URL。付いていない行の方が多い */
  readonly xbrlUrl: string | null;
  /** 上場取引所を 1 つずつに分解したもの（`東札福` → `['東', '札', '福']`） */
  readonly markets: readonly string[];
  /** 履歴欄。調査時点では常に空だったため用途は未確認 */
  readonly history: string;
}

/** 想定した形に読めず捨てた行。ログに出して TDnet 側の構造変化に気づくために持つ */
interface SkippedRow {
  readonly index: number;
  readonly reason: string;
  readonly html: string;
}

/** 1 日分を通しで読んだ結果 */
interface TdnetDay {
  /** 一覧の対象日（JST, `YYYY-MM-DD`） */
  readonly date: string;
  readonly disclosures: readonly Disclosure[];
  /** その日の全開示件数。捨てた行があると disclosures.length より多くなる */
  readonly totalCount: number;
  readonly skippedRows: readonly SkippedRow[];
}

type FetchResult<T> =
  | {
      readonly status: 'ok';
      readonly value: T;
      /**
       * 次回の If-Modified-Since に渡す値。状態を持たない MVP では渡す先が
       * 無いので使わない。Phase 3 で DB に持たせる
       */
      readonly lastModified: string | null;
    }
  | { readonly status: 'notModified' }
  | { readonly status: 'notFound' };

/**
 * @description 一覧ページの HTML を素の行データに変換する。
 * 開示ゼロの日（土日祝）はテーブルごと存在しないが、これは異常ではないので
 * rows が空・totalCount が 0 の TdnetListPage を返す。
 * 公開日そのものが読めない場合だけ、構造が変わったとみなして投げる。
 */
function parseListPage(html: string): TdnetListPage {
  const $ = cheerio.load(html);

  const rawDate = $('#kaiji-date-1').text().trim();
  const matchedDate = rawDate.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!matchedDate) {
    throw new Error(`公開日を読み取れませんでした: ${JSON.stringify(rawDate)}`);
  }
  const [, year = '', month = '', day = ''] = matchedDate;
  const date = `${year}-${month}-${day}`;

  // 開示ゼロの日は .kaijiSum 自体が無い
  const totalText = $('.kaijiSum').first().text();
  const totalCount = Number(
    (totalText.match(/全\s*([\d,]+)\s*件/)?.[1] ?? '0').replace(/,/g, ''),
  );

  const rows: TdnetRow[] = [];
  const skippedRows: SkippedRow[] = [];

  for (const [index, element] of $('#main-list-table tr').toArray().entries()) {
    const $row = $(element);
    const anchor = $row.find('.kjTitle a').first();
    const href = anchor.attr('href')?.trim() ?? '';
    const time = $row.find('.kjTime').text().trim();
    const code = $row.find('.kjCode').text().trim();
    const companyName = $row.find('.kjName').text().trim();
    const title = anchor.text().trim();

    const problem = findProblem({ time, code, companyName, title, href });
    if (problem !== null) {
      skippedRows.push({ index, reason: problem, html: $.html($row) });
      continue;
    }

    const xbrlHref = $row.find('.kjXbrl a').attr('href')?.trim();

    rows.push({
      time,
      code,
      companyName,
      title,
      originalId: href.replace(/\.pdf$/i, ''),
      documentUrl: new URL(href, BASE_URL).toString(),
      xbrlUrl: xbrlHref ? new URL(xbrlHref, BASE_URL).toString() : null,
      markets: $row.find('.kjPlace').text().match(MARKET_PATTERN) ?? [],
      // 全角スペース (U+3000) も trim() の対象なので、空欄はここで空文字になる
      history: $row.find('.kjHistroy').text().trim(),
    });
  }

  return {
    date,
    rows,
    totalCount,
    pageCount: Math.ceil(totalCount / PAGE_SIZE),
    skippedRows,
  };
}

/**
 * @description 1 日分の開示をページ送りしながら全件取得し、Disclosure に変換する。
 * 新着は 1 ページ目（時刻の降順）に入るため、更新判定は 1 ページ目の
 * Last-Modified だけで足りる。
 */
export async function fetchDisclosures(
  date: string,
  options: { readonly ifModifiedSince?: string | null } = {},
): Promise<FetchResult<TdnetDay>> {
  const firstPage = await fetchListPage(date, 1, options);
  if (firstPage.status !== 'ok') return firstPage;

  const rows = [...firstPage.value.rows];
  const skippedRows = [...firstPage.value.skippedRows];

  for (let page = 2; page <= firstPage.value.pageCount; page++) {
    const nextPage = await fetchListPage(date, page);
    // 取得中に件数が減ってページが消えることもあるので、404 は打ち切り扱い
    if (nextPage.status !== 'ok') break;
    rows.push(...nextPage.value.rows);
    skippedRows.push(...nextPage.value.skippedRows);
  }

  // 日付はページ全体にしか無いので、変換は全ページ読み終えてからまとめて行う
  const pageDate = firstPage.value.date;

  return {
    status: 'ok',
    value: {
      date: pageDate,
      disclosures: dropDuplicates(rows).map((row) =>
        toDisclosure(row, pageDate),
      ),
      totalCount: firstPage.value.totalCount,
      skippedRows,
    },
    lastModified: firstPage.lastModified,
  };
}

/** @description originalId が重複した行を省く。*/
function dropDuplicates(rows: readonly TdnetRow[]): TdnetRow[] {
  const seenId = new Set<TdnetRow['originalId']>();

  return rows.filter((row) => {
    if (seenId.has(row.originalId)) return false;

    seenId.add(row.originalId);
    return true;
  });
}

/**
 * @description 一覧の 1 行を Disclosure に変換する。
 * 5 桁コード・タイムゾーンを持たない時刻・種別カラムの不在といった
 * TDnet 固有の都合はここで吸収し、外には Disclosure だけを出す。
 */
function toDisclosure(row: TdnetRow, date: string): Disclosure {
  return {
    source: 'tdnet',
    originalId: row.originalId,
    // TDnet は 4 桁コードの末尾に 0 を足した 5 桁で返すので 4 桁に戻す
    code: row.code.slice(0, 4),
    companyName: row.companyName,
    title: row.title,
    kind: classifyTitle(row.title),
    documentUrl: row.documentUrl,
    // 時刻は一覧の行に、日付はページ全体にしか無いので組み合わせる
    disclosedAt: jstToUtcIso(date, row.time),
  };
}

/**
 * @description JST の暦日 + `HH:MM` を UTC の ISO8601 文字列に変換する。
 * TDnet は時刻にタイムゾーンを書かないため、JST であることはここで補う。
 * オフセットを明示せずに `new Date()` へ渡すと実行環境のタイムゾーンで
 * 解釈され、UTC で動く GitHub Actions 上だけ 9 時間ずれるので必ず付ける。
 */
function jstToUtcIso(date: string, time: string): string {
  const jst = `${date}T${time}:00+09:00`;
  const parsed = new Date(jst);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`日時を解釈できませんでした: ${JSON.stringify(jst)}`);
  }

  return parsed.toISOString();
}

function listPageUrl(date: string, page = 1): string {
  const compactDate = date.replace(/-/g, '');
  return `${BASE_URL}I_list_${String(page).padStart(3, '0')}_${compactDate}.html`;
}

/**
 * @description 一覧ページを 1 枚取得する。
 * ifModifiedSince を渡すと、更新が無いときは 304 が返り本文の転送が起きない。
 * 保持期間（直近 31 日）を外れた日付や存在しないページ番号は 404 になる。
 */
async function fetchListPage(
  date: string,
  page = 1,
  options: { readonly ifModifiedSince?: string | null } = {},
): Promise<FetchResult<TdnetListPage>> {
  const url = listPageUrl(date, page);
  const headers: Record<string, string> = {};
  if (options.ifModifiedSince) {
    headers['If-Modified-Since'] = options.ifModifiedSince;
  }

  const response = await politeFetch(url, headers);

  if (response.status === 304) return { status: 'notModified' };
  if (response.status === 404) return { status: 'notFound' };
  if (!response.ok) {
    throw new Error(`${url} の取得に失敗しました (HTTP ${response.status})`);
  }

  return {
    status: 'ok',
    value: parseListPage(await response.text()),
    lastModified: response.headers.get('last-modified'),
  };
}

let lastRequestAt = 0;

/**
 * @description リクエスト間隔を最低 1 秒空け、User-Agent を明示して取得する。
 * 直前の時刻を見て待つだけの排他制御なので、**逐次呼び出しが前提**。
 * 並行に呼ぶと両方が同時に「待ち時間なし」と判断して間隔が守られない。
 */
async function politeFetch(
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const waitMs = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  return fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
}

function findProblem(row: {
  time: string;
  code: string;
  companyName: string;
  title: string;
  href: string;
}): string | null {
  if (!TIME_PATTERN.test(row.time)) {
    return `開示時刻が HH:MM ではありません: ${JSON.stringify(row.time)}`;
  }
  if (!CODE_PATTERN.test(row.code)) {
    return `証券コードが 5 桁ではありません: ${JSON.stringify(row.code)}`;
  }
  if (row.companyName === '') return '会社名が空です';
  if (row.title === '') return '表題が空です';
  if (!DOCUMENT_PATTERN.test(row.href)) {
    return `PDF へのリンクが読めません: ${JSON.stringify(row.href)}`;
  }
  return null;
}
