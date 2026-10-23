import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const commit = 'bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b';
const expectedHash =
  '1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf';
const input = process.argv[2] ?? '.cache/dictionary/ecdict.csv';
const buffer = await readFile(input);
const sha256 = createHash('sha256').update(buffer).digest('hex');
if (sha256 !== expectedHash)
  throw new Error(
    'ECDICT source checksum mismatch; use the pinned commit in docs/dictionary-contract.md',
  );

// RFC 4180 quoting, including embedded commas, doubled quotes and newlines.
function* parseCsv(text) {
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (character === '\n') {
        yield row;
        row = [];
      }
    } else field += character;
  }
  if (quoted) throw new Error('Unclosed CSV field');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    yield row;
  }
}
const learningSources = await Promise.all(
  ['starter', 'curated'].map((name) =>
    readFile(`src/infrastructure/dictionary/${name}.ts`, 'utf8'),
  ),
);
const learningWords = new Set(
  learningSources.flatMap((text) =>
    [...text.matchAll(/^\s*\[\s*'[^']*',\s*'([a-z]+)'/gm)].map(
      (match) => match[1],
    ),
  ),
);
if (learningWords.size < 150)
  throw new Error('Expected at least 150 curated English headwords');
const entries = [];
const frequencies = {};
const used = new Set();
let rows = 0;
for (const row of parseCsv(buffer.toString('utf8'))) {
  rows++;
  const [word, phonetic, , translation, , , , tags, bncText, frqText] = row;
  if (
    !word ||
    !/^[a-z][a-z-]{1,39}$/.test(word) ||
    !translation ||
    !/\p{Script=Han}/u.test(translation) ||
    used.has(word)
  )
    continue;
  const positive = (value) =>
    Number.isSafeInteger(Number(value)) && Number(value) > 0
      ? Number(value)
      : 0;
  const frq = positive(frqText);
  const bnc = positive(bncText);
  if (learningWords.has(word))
    frequencies[word] = [frq, bnc, (phonetic ?? '').slice(0, 98)];
  if (
    !(frq && frq <= 15000) &&
    !(bnc && bnc <= 15000) &&
    !/(^| )(zk|gk|cet4|cet6)( |$)/.test(tags ?? '') &&
    !learningWords.has(word)
  )
    continue;
  used.add(word);
  entries.push([
    word,
    (phonetic ?? '').slice(0, 98),
    translation.replaceAll('\\n', '\n').slice(0, 1000),
    frq,
    bnc,
  ]);
}
entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const data = JSON.stringify(entries) + '\n';
const metadata = {
  version: 'ecdict-core-v1',
  commit,
  sha256,
  dataSha256: createHash('sha256').update(data).digest('hex'),
  entries: entries.length,
  source: 'ECDICT / MIT',
  filter:
    'lowercase headwords; frq <= 15000 or bnc <= 15000 or zk/gk/cet4/cet6 or curated',
  frequencyCoverage: Object.keys(frequencies).length,
  curatedHeadwords: learningWords.size,
};
await mkdir('public/dictionaries', { recursive: true });
await writeFile('public/dictionaries/core.json', data);
await writeFile(
  'src/infrastructure/dictionary/metadata.json',
  JSON.stringify(metadata, null, 2) + '\n',
);
await writeFile(
  'src/infrastructure/dictionary/frequencies.json',
  JSON.stringify(
    Object.fromEntries(
      Object.entries(frequencies).sort(([a], [b]) => a.localeCompare(b)),
    ),
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    { rows, ...metadata, bytes: Buffer.byteLength(data) },
    null,
    2,
  ),
);
