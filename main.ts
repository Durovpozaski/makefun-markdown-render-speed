import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

type InputCase = { id: string; markdown: string };
const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const batch: InputCase[] = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const html: string[] = new Array(batch.length);
for (let index = 0; index < batch.length; index++) html[index] = parse(batch[index].markdown);
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
