/**
 * @description JST の今日を YYYY-MM-DD 形式で返す
 */
export const getToday = () =>
  new Date()
    .toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replaceAll('/', '-');

/** @description HTML に埋め込む文字列の特殊文字を文字実体参照へ置き換える */
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    // 正規表現に列挙した 5 文字しか渡ってこないので、キーは必ず引ける。
    // TS はインデックスアクセスを string | undefined と推論するため断言で潰す
    (c) =>
      ({
        // & 自身も実体参照の先頭文字なので、最初に置換対象へ含めておく
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );
