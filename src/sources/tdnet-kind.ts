import type { DisclosureKind } from '../models/disclosure.ts';

/**
 * `（開示事項の経過）「X」について` のように、表題の先頭に付く殻。
 * 中身の X が本来の開示内容なので、判定の前に剥がす。
 */
const WRAPPER_PATTERN = /^[（(]開示事項の(?:経過|変更)[）)]\s*/;

/**
 * 種別の判定ルール。上から順に当てて、最初に一致したものを採る。
 * 1 つの開示が `〜及び〜` で複数の事象を兼ねることがあるため、
 * 並び順がそのまま優先順位（株価インパクトの大きい順）になる。
 */
const KIND_RULES: readonly (readonly [RegExp, DisclosureKind])[] = [
  // 訂正は `（訂正）「X」の一部訂正について` と元の表題を丸ごと抱えているため、
  // 他のどのルールより先に拾わないと中身の X に引っ張られる。
  // `（訂正・数値データ訂正）` のような派生もあるので括弧の中を緩く見る。
  [/^[（(][^）)]*訂正[^）)]*[）)]/, 'other'],

  [
    /業績予想(?:の修正|の公表|と実績値|の取り下げ)|業績予想.*差異/,
    'guidanceRevision',
  ],
  [/特別損失|減損|貸倒引当金/, 'specialLoss'],
  [/公開買付|TOB|ＴＯＢ|MBO|ＭＢＯ/, 'tenderOffer'],
  [/合併|株式交換|株式移転|会社分割|吸収分割|株式交付/, 'merger'],
  [/子会社|関係会社|関連会社|持分法適用|組織再編/, 'subsidiary'],
  [/(?:業務|資本)提携|協業/, 'alliance'],
  // 譲渡制限付株式としての新株式発行は報酬制度なので、資金調達と混ざらないよう除く
  [
    /^(?!.*譲渡制限付株式).*(?:第三者割当|新株式の?発行|募集株式|新株予約権付社債|公募|立会外分売)/,
    'equityFinance',
  ],
  [/上場廃止|監理銘柄|特設注意市場銘柄|上場維持基準/, 'listingStatus'],
  [/剰余金の配当|配当予想|復配|無配|記念配当/, 'dividend'],
  // 自己株式の「処分」は譲渡制限付株式の交付なので取得系だけに限定する
  [/自己株式の?(?:取得|消却|買付)|ToSTNeT|ＴｏＳＴＮｅＴ/, 'buyback'],
  [
    /決算(?:補足)?説明(?:資料|動画|会)|決算補足資料|説明会資料|想定質問|質疑応答|高い関心|決算の?概要|ＫＰＩ/,
    'earningsMaterial',
  ],
  // `決算短信の開示が45日を超える` のような連絡は短信そのものではないので除く
  [/決算短信(?!.*(?:お知らせ|について))/, 'earnings'],
  [/月次/, 'monthlyReport'],
  [/中期経営計画|中期計画|事業計画及び成長可能性/, 'midTermPlan'],
  [/資金の借入|借入|社債の発行|ローン|資金調達/, 'financing'],
  [/株主優待/, 'shareholderBenefit'],
  [
    /新株予約権|ストック・オプション|譲渡制限付株式|株式報酬/,
    'stockCompensation',
  ],
  [
    /(?:役員|取締役|執行役|監査役).*(?:異動|選任|辞任|候補者|就任)|人事/,
    'personnel',
  ],
  [
    /株主総会|定款|コーポレート・?ガバナンス|資本コストや株価を意識した経営/,
    'governance',
  ],
];

/**
 * @description 表題から開示種別を判定する。
 * TDnet の一覧に種別カラムが無いための苦肉の策なので、取りこぼしは前提。
 * どのルールにも当たらなければ `other` を返す。異常ではない。
 */
export function classifyTitle(title: string): DisclosureKind {
  const normalized = title.replace(WRAPPER_PATTERN, '');

  for (const [pattern, kind] of KIND_RULES) {
    if (pattern.test(normalized)) return kind;
  }

  return 'other';
}
