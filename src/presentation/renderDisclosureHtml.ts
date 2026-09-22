import type { Disclosure, DisclosureKind } from '../model/disclosure.ts';
import { escapeHtml } from '../utils.ts';

const kindLabel: Record<DisclosureKind, string> = {
  guidanceRevision: '業績予想修正',
  specialLoss: '特別損失',
  tenderOffer: '公開買付け',
  merger: '組織再編',
  subsidiary: '子会社異動',
  alliance: '業務提携',
  equityFinance: 'エクイティ調達',
  listingStatus: '上場区分',
  dividend: '配当',
  buyback: '自己株取得',
  earnings: '決算短信',
  earningsMaterial: '決算補足資料',
  monthlyReport: '月次',
  midTermPlan: '中期経営計画',
  financing: '資金調達',
  shareholderBenefit: '株主優待',
  stockCompensation: '新株予約権',
  personnel: '人事',
  governance: 'ガバナンス',
  other: 'その他',
};

/** disclosedAt は UTC の ISO 文字列なので、表示は JST に戻す */
const formatTime = (isoDatetime: string) =>
  new Date(isoDatetime).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });

const heading = (disclosures: readonly Disclosure[]) =>
  `ウォッチリストの開示 ${disclosures.length} 件`;

export function renderDisclosureHtml(
  disclosures: readonly Disclosure[],
): string {
  const rows = disclosures
    .map(
      (d) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;">${formatTime(d.disclosedAt)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;">${escapeHtml(d.code)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(d.companyName)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;">${kindLabel[d.kind]}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e5e5;">
          <a href="${escapeHtml(d.documentUrl)}">${escapeHtml(d.title)}</a>
        </td>
      </tr>`,
    )
    .join('');

  // doctype は文書の先頭に無いと quirks mode 扱いになるため、字下げしない
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:16px;font-family:sans-serif;color:#222;">
    <h1 style="font-size:16px;margin:0 0 12px;">${heading(disclosures)}</h1>
    <table style="border-collapse:collapse;font-size:13px;width:100%;">
      <thead>
        <tr style="text-align:left;background:#f5f5f5;">
          <th style="padding:8px;">時刻</th>
          <th style="padding:8px;">コード</th>
          <th style="padding:8px;">会社名</th>
          <th style="padding:8px;">種別</th>
          <th style="padding:8px;">表題</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </body>
</html>`;
}

/**
 * @description HTML と同じ内容のプレーンテキスト版。
 */
export function renderDisclosureText(
  disclosures: readonly Disclosure[],
): string {
  const blocks = disclosures.map(
    (d) =>
      `${formatTime(d.disclosedAt)} ${d.code} ${d.companyName} [${kindLabel[d.kind]}]\n` +
      `${d.title}\n${d.documentUrl}`,
  );

  return [heading(disclosures), ...blocks].join('\n\n');
}
