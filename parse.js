const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const punctuation = /[!"#$%&'()*+,-.\/:;<=>?@[\\\]^_`{|}~]/;
const unicodePunctuation = /[\p{P}\p{S}]/u;
const refs = new Map();

function decodeEntity(raw) {
  const body = raw.slice(1, -1);
  if (body[0] === '#') {
    const hex = body[1] === 'x' || body[1] === 'X';
    let n = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!n || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) n = 0xfffd;
    return String.fromCodePoint(n);
  }
  return entityNames[body] ?? raw;
}
function htmlText(s) {
  return s.replace(/&(?:#(?:[xX][\da-fA-F]{1,6}|\d{1,7})|[A-Za-z][A-Za-z\d]{1,31});|[&<>"']/g, x => {
    if (x[0] === '&' && x.endsWith(';')) return x[1] === '#' ? esc(decodeEntity(x)) : x;
    return x === '&' ? '&amp;' : x === '<' ? '&lt;' : x === '>' ? '&gt;' : x === '"' ? '&quot;' : '&#39;';
  });
}
function decodeForUrl(s) {
  return s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').replace(/&(?:#(?:[xX][\da-fA-F]{1,6}|\d{1,7})|[A-Za-z][A-Za-z\d]{1,31});/g, x => decodeEntity(x));
}
function url(s, markdownEscapes = false) {
  const decoded = markdownEscapes ? s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1') : s;
  const escaped = decoded.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, (_m, c) => '%5C' + c);
  return esc(encodeURI(escaped).replace(/%25/gi, '%')).replace(/&amp;([A-Za-z][A-Za-z\d]{0,31};)/g, '&$1');
}
function inline(s, inLink = false) {
  let out = '', i = 0;
  const plain = (x) => htmlText(x);
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '\n') { out += '<br>'; i += 2; while (s[i] === ' ') i++; continue; }
    if (c === '\\' && i + 1 < s.length && punctuation.test(s[i + 1])) { out += plain(s[i + 1]); i += 2; continue; }
    if (c === '\n') { let p = i; while (p > 0 && s[p - 1] === ' ') p--; const count = i - p; if (count >= 2) { out = out.slice(0, out.length - count); out += '<br>'; i++; while (s[i] === ' ') i++; } else { out += '\n'; i++; } continue; }
    if (c === '`') {
      let n = 1; while (s[i + n] === '`') n++;
      const mark = '`'.repeat(n); let end = i + n, found = -1;
      while ((end = s.indexOf(mark, end)) >= 0) { let run = end + n; while (s[run] === '`') run++; if (run - end === n) { found = end; break; } end = run; }
      if (found >= 0) { let value = s.slice(i + n, found).replace(/\n/g, ' '); if (/^ .* $/.test(value) && /[^ ]/.test(value)) value = value.slice(1, -1); out += '<code>' + esc(value) + '</code>'; i = found + n; continue; }
    }
    if (c === '<') {
      const end = s.indexOf('>', i + 1);
      if (end > i) {
        const v = s.slice(i + 1, end), mail = /^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(v);
        if (/^[A-Za-z][A-Za-z0-9.+-]{1,31}:[^ <>]*$/.test(v)) { out += `<a href="${url(v)}">${plain(v)}</a>`; i = end + 1; continue; }
        if (mail) { out += `<a href="mailto:${url(v)}">${plain(v)}</a>`; i = end + 1; continue; }
    if (/^\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:\s|\/?>)/i.test(v)) { out += '&lt;' + s.slice(i + 1, end) + '&gt;'; i = end + 1; continue; }
        if (!v.includes('\\') && (/^\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>|$)/.test(v) || /^!--/.test(v) || /^\?[\s\S]*\?$/.test(v))) { out += s.slice(i, end + 1); i = end + 1; continue; }
      }
    }
    if ((!inLink && c === '[') || (c === '!' && s[i + 1] === '[')) {
      const image = c === '!'; const start = i + (image ? 2 : 1); let depth = 1, close = start;
      for (; close < s.length; close++) { if (s[close] === '\\') { close++; continue; } if (s[close] === '[') depth++; else if (s[close] === ']' && --depth === 0) break; }
      if (close < s.length) {
        const labelText = s.slice(start, close); let j = close + 1, dest = null, title = '', after = j;
        if (s[j] === '(') {
          j++; while (s[j] === ' ' || s[j] === '\n' || s[j] === '\t') j++;
        if (s[j] === '<') { const z = s.indexOf('>', j + 1); if (z >= 0 && !/[\n\\]/.test(s.slice(j + 1, z))) { dest = s.slice(j + 1, z); j = z + 1; } }
          else { const ds = j; let par = 0; while (j < s.length && !/[ \t\n]/.test(s[j])) { if (s[j] === '\\') j++; else if (s[j] === '(') par++; else if (s[j] === ')') { if (!par) break; par--; } j++; } if (par === 0) dest = s.slice(ds, j); }
          if (dest !== null) { while (s[j] === ' ' || s[j] === '\n' || s[j] === '\t') j++; if (s[j] === '"' || s[j] === "'" || s[j] === '(') { const q = s[j] === '(' ? ')' : s[j]; let z = j + 1; while (z < s.length) { if (s[z] === '\\') { z += 2; continue; } if (s[z] === q) break; z++; } if (z < s.length) { title = s.slice(j + 1, z).replace(/\\([!\"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1'); j = z + 1; while (s[j] === ' ' || s[j] === '\n' || s[j] === '\t') j++; } } if (s[j] === ')') { after = j + 1; } else dest = null; }
        } else {
          let label = labelText;
          if (s[j] === '[') { const z = s.indexOf(']', j + 1); if (z >= 0) { if (z > j + 1) label = s.slice(j + 1, z); after = z + 1; } }
          const def = refs.get(label.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').normalize('NFKC').toLowerCase().replace(/[\u00df]/g, 'ss').replace(/[ \t\n]+/g, ' '));
          if (def) { dest = def.href; title = def.title; }
        }
        if (dest !== null && !(labelText.lastIndexOf('<') > labelText.lastIndexOf('>'))) { const body = image ? plain(labelText) : inline(labelText, true); const href = url(dest, true); let alt = image ? inline(labelText).replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/g, '$1').replace(/<[^>]*>/g, '') : ''; out += image ? `<img src="${href}" alt="${alt}"${title ? ` title="${plain(title)}"` : ''}>` : `<a href="${href}"${title ? ` title="${plain(title)}"` : ''}>${body}</a>`; i = after; continue; }
      }
    }
    if (c === '&') {
      const m = /^&(?:#(?:[xX][\da-fA-F]{1,6}|\d{1,7})|[A-Za-z][A-Za-z\d]{0,31});/.exec(s.slice(i));
        if (m) { out += m[0][1] === '#' ? esc(decodeEntity(m[0])) : m[0]; i += m[0].length; continue; }
      out += '&amp;'; i++; continue;
    }
    if ((c === 'w' && /^www\.[A-Za-z0-9][^\s<>]*/i.test(s.slice(i))) || (/[A-Za-z]/.test(c) && /^(?:https?:\/\/|ftp:\/\/)/i.test(s.slice(i)))) {
      const m = /^(?:www\.[A-Za-z0-9]|https?:\/\/[A-Za-z0-9]|ftp:\/\/[A-Za-z0-9])[^\s<>]*/i.exec(s.slice(i));
      if (m) {
        let v = m[0].replace(/[.,:;!?*_~]+$/, '');
        while (v.endsWith(')') && (v.match(/\)/g)||[]).length > (v.match(/\(/g)||[]).length) v = v.slice(0,-1);
        if (/^(?:www\.)?[A-Za-z0-9][^\s]*\.[A-Za-z]{2,}(?:\/|$)/i.test(v)) { const href = /^www\./i.test(v) ? 'http://' + v : v; out += `<a href="${url(href)}">${plain(v)}</a>`; i += v.length; continue; }
      }
    }
    if (c === '@' || /[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]/.test(c)) {
      const m = /^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/.exec(s.slice(i));
      if (m && (i === 0 || /[\s(]/.test(s[i-1]))) { const v = m[0]; out += `<a href="mailto:${url(v)}">${plain(v)}</a>`; i += v.length; continue; }
    }
    if (c === '*' || c === '_') {
      let n = 1; while (s[i + n] === c) n++; const run = n;
      let a = i === 0 ? '\n' : s[i - 1], b = i + n === s.length ? '\n' : s[i + n];
      const left = !/[\s\u00a0]/.test(b) && (!unicodePunctuation.test(b) || /[\s\u00a0]/.test(a) || unicodePunctuation.test(a));
      const right = !/[\s\u00a0]/.test(a) && (!unicodePunctuation.test(a) || /[\s\u00a0]/.test(b) || unicodePunctuation.test(b));
      if (c === '_' && /[\p{L}\p{N}]/u.test(a) && /[\p{L}\p{N}]/u.test(b)) { out += c.repeat(n); i += n; continue; }
      const close = c === '*' ? right : right && !left;
      if (left) {
        let found = -1, k = i + n, nested = 0;
        while (k < s.length) { if (s[k] === '\\') { k += 2; continue; } if (s[k] === c) { let m = 1; while (s[k + m] === c) m++; const x = k === 0 ? '\n' : s[k - 1], y = k + m === s.length ? '\n' : s[k + m]; const cl = !/[\s\u00a0]/.test(x) && (!unicodePunctuation.test(x) || /[\s\u00a0]/.test(y) || unicodePunctuation.test(y)); const op = !/[\s\u00a0]/.test(y) && (!unicodePunctuation.test(y) || /[\s\u00a0]/.test(x) || unicodePunctuation.test(x)); if (op && (m === 1 || (c === '_' && m === 2))) nested++; if (cl && (c !== '_' || !/[\p{L}\p{N}]/u.test(y))) { if (run === 1 && c === '*' && m >= 2) { k += m; continue; } if (nested) nested--; else if (run >= 3 ? m >= 3 : true) { found = k; break; } } k += m; } else k++; }
        if (found > i + n) { const end = found; const m = (() => { let q = 1; while (s[end + q] === c) q++; return q; })(); const use = Math.min(run, m) >= 3 ? 3 : Math.min(run, m) >= 2 ? 2 : 1; const shared = c === '*' && run === 2 && m >= 3; const inner = inline(s.slice(i + use, end) + (shared ? '*' : ''), inLink); out += use === 3 ? `<em><strong>${inner}</strong></em>` : use === 2 ? `<strong>${inner}</strong>` : `<em>${inner}</em>`; i = end + use + (shared ? 1 : 0); continue; }
      }
      out += c; i++; continue;
    }
    if (c === '~') { let run = 1; while (s[i + run] === '~') run++; if (run <= 2) { const mark = '~'.repeat(run); let e = i + run; while ((e = s.indexOf(mark, e)) >= 0) { let tail = e + run; while (s[tail] === '~') tail++; if (tail - e === run && e > i + run && !/[\s\u00a0]/.test(s[e - 1]) && !/[\s\u00a0]/.test(s[i + run])) { out += '<del>' + inline(s.slice(i + run, e), inLink) + '</del>'; i = tail; break; } e = tail; } if (i >= s.length || s[i] !== '~') continue; } }
    out += c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : c; i++;
  }
  return out;
}

const blank = (s) => /^[ \t]*$/.test(s);
const heading = (s) => /^( {0,3})(#{1,6})(?:[ \t]+|$)(.*)$/.exec(s);
const fence = (s) => /^( {0,3})(`{3,}|~{3,})([^\n]*)$/.exec(s);
const list = (s) => /^( {0,3})([*+-]|\d{1,9}[.)])(?:[ \t]+(.*)|[ \t]*)$/.exec(s);
function collectDefinitions(lines) {
  const kept = [];
  let fenceChar = '', fenceSize = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = fence(line);
    if (fenceChar) { kept.push(line); if (new RegExp('^ {0,3}' + fenceChar + '{' + fenceSize + ',}[ \\t]*$').test(line)) fenceChar = ''; continue; }
    if (f) { fenceChar = f[2][0]; fenceSize = f[2].length; kept.push(line); continue; }
    const quote = /^( {0,3}> ?)(.*)$/.exec(line);
    const content = quote ? quote[2] : line;
    if (kept.length && !blank(kept[kept.length - 1]) && !quote && !heading(kept[kept.length - 1]) && !fence(kept[kept.length - 1]) && !/^ {0,3}(?:>|[*+-]|\d+[.)])/.test(kept[kept.length - 1])) { kept.push(line); continue; }
    const m = /^ {0,3}\[((?:\\.|[^\]])+)\]:[ \t]*(.*)$/.exec(content);
    if (!m) { kept.push(line); continue; }
    let tail = m[2], j = i + 1;
    if (!tail && j < lines.length && !blank(lines[j])) tail = lines[j++].trim();
    let dest = '', title = '', valid = false;
    if (tail[0] === '<') { const e = tail.indexOf('>'); if (e >= 0 && (!tail[e + 1] || /\s/.test(tail[e + 1]))) { dest = tail.slice(1, e); tail = tail.slice(e + 1).trim(); valid = true; } }
    else { let k = 0, depth = 0; while (k < tail.length && !/\s/.test(tail[k])) { if (tail[k] === '\\') k++; else if (tail[k] === '(') depth++; else if (tail[k] === ')' && depth) depth--; k++; } dest = tail.slice(0, k); tail = tail.slice(k).trim(); }
    if (!valid) valid = !!dest;
    if (!tail && j < lines.length && !blank(lines[j]) && /^[ \t]*["'(]/.test(lines[j])) tail = lines[j++].trim();
    if (tail && (tail[0] === '"' || tail[0] === "'" || tail[0] === '(') && !tail.slice(1).includes(tail[0] === '(' ? ')' : tail[0])) {
      const qchar = tail[0] === '(' ? ')' : tail[0]; let pieces = [tail];
      while (j < lines.length && !blank(lines[j]) && !pieces.join('\n').slice(1).includes(qchar)) pieces.push(lines[j++]);
      tail = pieces.join('\n');
    }
    let titleRemainder = '';
    if (tail && (tail[0] === '"' || tail[0] === "'" || tail[0] === '(')) { const close = tail[0] === '(' ? ')' : tail[0]; const e = tail.lastIndexOf(close); if (e > 0) { title = tail.slice(1, e).replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1'); titleRemainder = tail.slice(e + 1).trim(); } }
    if (valid && (!tail || !/^['"(]/.test(tail) || (!!title && !titleRemainder))) { const key = m[1].replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').normalize('NFKC').toLowerCase().replace(/[\u00df]/g, 'ss').replace(/[ \t\n]+/g, ' '); if (!refs.has(key)) refs.set(key, { href: dest, title }); if (quote) kept.push(quote[1].trimEnd()); i = j - 1; }
    else kept.push(line);
  }
  return kept;
}
function parseBlocks(markdown, root = false) {
  if (root) refs.clear();
  let src = String(markdown).replace(/\r\n?/g, '\n').replace(/\0/g, '\uFFFD');
  let lines = root ? collectDefinitions(src.split('\n')) : src.split('\n');
  const out = [];
  const listMatch = (s) => /^( {0,3})([*+-]|(\d{1,9})([.)]))(?:([ \t]+)(.*)|[ \t]*)$/.exec(s);
  const indent = (s) => (s.match(/^ */) || [''])[0].length;
  const hr = (s) => /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(s);
  const htmlStart = (s) => {
    if (!/^ {0,3}</.test(s)) return null;
    const t = s.slice(s.indexOf('<')); const tl = t.toLowerCase();
    if (/^<(script|pre|style|textarea|title|xmp|iframe|noembed|noframes|plaintext)(?:\s|>|\/|$)/i.test(t)) return ['tag', RegExp.$1];
    if (/^<!--/.test(t)) return ['comment'];
    if (/^<\?/.test(t)) return ['pi'];
    if (/^<![A-Z]/.test(s)) return ['decl'];
    if (/^<!\[cdata\[/i.test(t)) return ['cdata'];
    if (/^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>)/.test(t) && (t.match(/</g)||[]).length <= 1) return ['type7'];
    if (/^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>)/.test(tl)) return ['blank'];
    return null;
  };
  const isInterrupt = (s, paragraph = false) => {
    if (heading(s) || fence(s) || /^ {0,3}>/.test(s) || hr(s) || htmlStart(s)) return true;
    const lm = listMatch(s);
    return !!lm && (!paragraph || (!!lm[6] && !blank(lm[6]) && (!lm[3] || Number(lm[3]) === 1))); 
  };
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (blank(line)) { i++; continue; }
    const f = fence(line);
    if (f && (f[2][0] !== '`' || !f[3].includes('`'))) {
      const body = []; const ch = f[2][0], size = f[2].length; i++;
      while (i < lines.length && !new RegExp('^ {0,3}' + (ch === '`' ? '`' : '~') + '{' + size + ',}[ \\t]*$').test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      while (body.length && blank(body[body.length - 1])) body.pop();
      const fenceIndent = f[1].length;
      for (let k = 0; k < body.length; k++) body[k] = body[k].replace(new RegExp('^ {0,' + fenceIndent + '}'), '');
      const info = f[3].trim().split(/[ \t]/)[0];
      const code = body.join('\n');
      out.push('<pre><code' + (info ? ` class="language-${esc(info)}"` : '') + '>' + esc(code) + (code ? '\n' : '') + '</code></pre>\n'); continue;
    }
    const h = heading(line);
    if (h) { const text = h[3].replace(/[ \t]+#+[ \t]*$/, '').trim(); out.push(`<h${h[2].length}>${inline(text)}</h${h[2].length}>\n`); i++; continue; }
    if (hr(line)) { out.push('<hr>\n'); i++; continue; }
    if (/^ {0,3}>/.test(line)) {
      const quote = []; let blanks = 0;
      while (i < lines.length) {
        const m = /^( {0,3})>(?: ?)(.*)$/.exec(lines[i]);
        if (m) { quote.push(m[2]); i++; blanks = 0; continue; }
        if (blank(lines[i])) { quote.push(''); i++; blanks++; if (blanks === 2) break; continue; }
        if (blanks || /^ {0,3}(?:#{1,6}(?:\s|$)|(?:`{3,}|~{3,}))/.test(lines[i])) break;
        if (isInterrupt(lines[i], false) && !listMatch(lines[i])) break;
        quote.push(lines[i++]);
      }
      out.push('<blockquote>\n' + parseBlocks(quote.join('\n')) + '</blockquote>\n'); continue;
    }
    const lm = listMatch(line);
    if (lm) {
      const marker = lm[2], ordered = !!lm[3], delim = lm[4] || '', tag = ordered ? 'ol' : 'ul';
      const startNum = ordered ? Number(lm[3]) : 1;
      const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
      const baseIndent = lm[1].length;
      out.push(`<${tag}${startAttr}>\n`);
      let loose = false, items = [];
      while (i < lines.length) {
        const first = listMatch(lines[i]);
        if (!first || first[1].length > baseIndent + 3 || (!!first[3] !== ordered) || (!ordered && first[2] !== marker) || (ordered && first[4] !== delim)) break;
        let body = [first[6] || ''];
        const markerWidth = first[2].length;
        const spaces = first[5] ? first[5].length : 1;
        const contentIndent = baseIndent + markerWidth + (spaces > 4 ? 1 : spaces);
        i++;
        let blankBefore = false;
        while (i < lines.length) {
          if (blank(lines[i])) {
            let j = i; while (j < lines.length && blank(lines[j])) j++;
            const next = j < lines.length ? listMatch(lines[j]) : null;
            if (next && next[1].length <= baseIndent && (!!next[3] === ordered) && (!ordered ? next[2] === marker : next[4] === delim)) { body.push(''); loose = true; i = j; break; }
            if (j < lines.length && indent(lines[j]) >= contentIndent) { if (body.length && !blank(body[body.length - 1])) loose = true; body.push(''); i++; continue; }
            i = j; break;
          }
          const next = listMatch(lines[i]);
          if (next && next[1].length <= baseIndent) break;
          const leading = indent(lines[i]);
          if (leading >= contentIndent) { body.push(lines[i].slice(Math.min(contentIndent, leading))); i++; continue; }
          if (isInterrupt(lines[i], false)) break;
          body.push(lines[i++]);
        }
        items.push(body);
      }
      if (loose) for (const item of items) if (item.length) item._loose = true;
      for (const item of items) {
        while (item.length && blank(item[0])) item.shift();
        while (item.length && blank(item[item.length - 1])) item.pop();
        const task = /^\[([ xX])\][ \t]+/.exec(item[0] || '');
        if (task) item[0] = item[0].slice(task[0].length);
        const html = parseBlocks(item.join('\n'));
        let content = html;
        if (!item._loose && !loose) content = content.replace(/^<p>([\s\S]*?)<\/p>\n/, '$1');
        const checkbox = task ? `<input${task[1] === ' ' ? '' : ' checked=""'} disabled="" type="checkbox"> ` : '';
        const blockContent = content.replace(/\n$/, '');
        const closesBlock = /<\/(?:blockquote|ul|ol|pre|table|div|h[1-6])>$/i.test(blockContent);
        out.push('<li>' + checkbox + blockContent + (((item._loose || loose) || closesBlock) && blockContent ? '\n' : '') + '</li>\n');
      }
      out.push(`</${tag}>\n`); continue;
    }
    const hs = htmlStart(line);
    if (hs) {
      const block = [line]; i++;
      const endRe = hs[0] === 'tag' ? new RegExp('</' + hs[1] + '\\s*>', 'i') : hs[0] === 'comment' ? /-->/ : hs[0] === 'pi' ? /\?>/ : hs[0] === 'cdata' ? /\]\]>/ : null;
      while (i < lines.length) {
        const previous = block.join('\n');
        if (endRe && endRe.test(previous)) break;
        if (hs[0] === 'blank' && blank(lines[i])) break;
        if (hs[0] === 'type7' && blank(lines[i])) break;
        block.push(lines[i++]);
        if (hs[0] === 'blank' && i < lines.length && blank(lines[i])) break;
      }
      if (i < lines.length && hs[0] !== 'type7' && endRe && endRe.test(block.join('\n'))) { /* consumed through matching line */ }
      const nextBlock = lines.slice(i).find(x => !blank(x));
      const joinsParagraph = (hs[0] === 'blank' || hs[0] === 'type7') && nextBlock && !htmlStart(nextBlock) && !heading(nextBlock) && !fence(nextBlock) && !listMatch(nextBlock) && !/^ {0,3}>/.test(nextBlock) && !hr(nextBlock);
      out.push(block.join('\n') + (hs[0] === 'comment' && endRe && endRe.test(block.join('\n')) || joinsParagraph ? '' : '\n')); continue;
    }
    if (/^ {4}\S/.test(line) || /^\t/.test(line)) {
      const code = []; while (i < lines.length && (/^(?: {4}|\t)/.test(lines[i]) || blank(lines[i]))) { code.push(lines[i].replace(/^(?: {4}|\t)/, '')); i++; }
      while (code.length && blank(code[code.length - 1])) code.pop();
      out.push('<pre><code>' + esc(code.join('\n')) + '\n</code></pre>\n'); continue;
    }
    if (i + 1 < lines.length && line.includes('|') && /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/.test(lines[i + 1])) {
      const split = (s) => { let a = [], cell = '', escp = false; for (let k = 0; k < s.length; k++) { const c = s[k]; if (c === '|' && !escp) { a.push(cell.trim()); cell = ''; escp = false; } else { cell += c; if (c === '\\') escp = !escp; else escp = false; } } a.push(cell.trim()); if (a[0] === '') a.shift(); if (a[a.length - 1] === '') a.pop(); return a; };
      const heads = split(line), aligns = split(lines[i + 1]).map(x => x[0] === ':' && x.endsWith(':') ? 'center' : x[0] === ':' ? 'left' : x.endsWith(':') ? 'right' : '');
      const cellHtml = (v) => inline(v.replace(/\\\|/g, '|').replace(/\\\\/g, '\\').trim());
      out.push('<table>\n<thead>\n<tr>\n'); for (let k = 0; k < aligns.length; k++) out.push(`<th${aligns[k] ? ` align="${aligns[k]}"` : ''}>${cellHtml(heads[k] || '')}</th>\n`); out.push('</tr>\n</thead>\n');
      i += 2; const width = aligns.length;
      while (i < lines.length && !blank(lines[i]) && (lines[i].includes('|') || !isInterrupt(lines[i], false))) { const cells = split(lines[i]); out.push('<tbody>');
        // Rows are accumulated below to keep tbody as a single section.
        const rows = [];
        while (i < lines.length && !blank(lines[i]) && (lines[i].includes('|') || !isInterrupt(lines[i], false))) { const values = split(lines[i]); rows.push('<tr>\n' + Array.from({length: width}, (_,k) => `<td${aligns[k] ? ` align="${aligns[k]}"` : ''}>${cellHtml(values[k] || '')}</td>\n`).join('') + '</tr>'); i++; }
        out.push(rows.join('\n') + '\n</tbody>'); break;
      }
      out.push('</table>\n'); continue;
    }
    const para = [line]; i++;
    while (i < lines.length && !blank(lines[i]) && !isInterrupt(lines[i], true) && !/^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])) para.push(lines[i++]);
    if (i < lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])) { const n = /^ *-/.test(lines[i]) ? 2 : 1; out.push(`<h${n}>${inline(para.join('\n').trim())}</h${n}>\n`); i++; continue; }
    out.push('<p>' + inline(para.join('\n')) + '</p>\n');
  }
  return out.join('');
}

export function parse(markdown) { return parseBlocks(markdown, true); }
