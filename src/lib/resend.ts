import { Resend } from 'resend';
import { loadEnv } from '../config/env.ts';

const resend = new Resend(loadEnv().RESEND_API_KEY);

export async function sendMail(subject: string, html: string) {
  const { data, error } = await resend.emails.send({
    from: loadEnv().EMAIL_FROM,
    to: loadEnv().EMAIL_TO,
    subject,
    html,
  });

  if (error)
    throw new Error(
      `メールを送信できませんでした (${error.name}): ${error.message}`,
      // [Error:cause](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
      { cause: error },
    );

  return data;
}
