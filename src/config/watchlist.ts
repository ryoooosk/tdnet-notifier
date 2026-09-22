import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import z from 'zod';
import { type Disclosure, securitiesCode } from '../models/disclosure.ts';

const watchListSchema = z.object({
  securitiesCodes: z.array(securitiesCode),
});

export function loadWatchList(): ReadonlySet<Disclosure['code']> {
  const filePath = join(import.meta.dirname, 'watchlist.jsonc');
  const source = readFileSync(filePath, 'utf8');

  const errors: ParseError[] = [];
  const rawWatchList = parse(source, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${printParseErrorCode(e.error)} (offset ${e.offset})`)
      .join(', ');
    throw new Error(`${filePath} を JSONC として読めません: ${details}`);
  }

  const watchList = watchListSchema.safeParse(rawWatchList);
  if (!watchList.success) {
    throw new Error(
      `${filePath} の内容が不正です:\n${z.prettifyError(watchList.error)}`,
      { cause: watchList.error },
    );
  }

  return new Set(watchList.data.securitiesCodes);
}
