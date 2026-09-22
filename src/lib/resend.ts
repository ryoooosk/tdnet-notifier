import { Resend } from 'resend';
import { loadEnv } from '../config/env.ts';

interface Mail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export async function sendMail({ subject, html, text }: Mail) {
  const { RESEND_API_KEY, EMAIL_FROM, EMAIL_TO } = loadEnv();

  const { data, error } = await new Resend(RESEND_API_KEY).emails.send({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    html,
    text,
  });

  if (error)
    throw new Error(
      `メールを送信できませんでした (${error.name}): ${error.message}`,
      // [Error:cause](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
      { cause: error },
    );

  return data;
}
