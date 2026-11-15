import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

type MarkdownCase = { id: string; markdown: string };
const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const cases: MarkdownCase[] = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const rendered = cases.map((entry) => parse(entry.markdown));
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(rendered));
