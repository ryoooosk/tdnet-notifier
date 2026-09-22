import { sendMail } from './lib/resend.ts';
import {
  renderDisclosureHtml,
  renderDisclosureText,
} from './presentation/renderDisclosureHtml.ts';
import fetchWatchlistDisclosure from './service/fetchWatchlistDisclosure.ts';
import { getToday } from './utils.ts';

export default async function index() {
  const today = getToday();

  const targetDisclosures = await fetchWatchlistDisclosure(today);

  if (targetDisclosures.length === 0) {
    console.log(
      `${today} はウォッチリストの開示がありません。送信を見送ります`,
    );
    return;
  }

  const sent = await sendMail({
    subject: `${today} の適時開示`,
    html: renderDisclosureHtml(targetDisclosures),
    text: renderDisclosureText(targetDisclosures),
  });

  console.log(`メールを送信しました (id: ${sent?.id})`);
}
