// parse.js — dependency-free CommonMark + GFM parser (marked 18.1.3 behaviour).
// v4: written fresh in-session. No imports. ESM.
export function parse(markdown) {
  return renderBlocks(normalize(markdown));
}
function normalize(src) {
  return String(src).replace(/\r\n?/g, "\n");
}
// ---------- character helpers ----------
function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\v" || ch === "\f" || ch === "\r";
}
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}
function isAlphaNum(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || isDigit(ch);
}
function isAsciiPunct(ch) {
  return !!ch && /[!-\/:-@\[-`{-~]/.test(ch);
}
function isPunct(ch) {
  if (!ch) return false;
  if (isAsciiPunct(ch)) return true;
  try { return /\p{P}/u.test(ch); } catch (e) { return false; }
}
// Tab-aware indentation: a tab advances to the next multiple of 4 columns.
function indentCols(line) {
  let col = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === " ") col++;
    else if (ch === "\t") col += 4 - (col % 4);
    else break;
  }
  return col;
}
// Remove `cols` columns of leading whitespace. A tab straddling the boundary
// leaves spaces for the remaining columns. Tabs elsewhere are preserved.
function stripCols(line, cols) {
  let col = 0, i = 0;
  while (i < line.length && col < cols) {
    const ch = line[i];
    if (ch === " ") { col++; i++; }
    else if (ch === "\t") {
      const next = col + (4 - (col % 4));
      if (next <= cols) { col = next; i++; }
      else return " ".repeat(next - cols) + line.slice(i + 1);
    } else break;
  }
  return line.slice(i);
}
// Advance `cols` columns into the line (through ANY characters, including a
// list marker), returning the rest. A tab straddling the boundary leaves
// spaces for the remaining columns. Used to extract a list item's content.
function contentAfterCols(line, cols) {
  let col = 0, i = 0;
  while (i < line.length && col < cols) {
    const ch = line[i];
    if (ch === " ") { col++; i++; }
    else if (ch === "\t") {
      const next = col + (4 - (col % 4));
      if (next <= cols) { col = next; i++; }
      else return " ".repeat(next - cols) + line.slice(i + 1);
    } else { col++; i++; }
  }
  return line.slice(i);
}
function escText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// ---------- named entities (HTML4 + common HTML5) ----------
const ENTITIES = {
  quot: '"', amp: "&", apos: "'", lt: "<", gt: ">", nbsp: " ", iexcl: "¡", cent: "¢",
  pound: "£", curren: "¤", yen: "¥", brvbar: "¦", sect: "§", uml: "¨", copy: "©",
  ordf: "ª", laquo: "«", not: "¬", shy: "­", reg: "®", macr: "¯", deg: "°",
  plusmn: "±", sup2: "²", sup3: "³", acute: "´", micro: "µ", para: "¶", middot: "·",
  cedil: "¸", sup1: "¹", ordm: "º", raquo: "»", frac14: "¼", frac12: "½", frac34: "¾",
  iquest: "¿", Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å",
  AElig: "Æ", Ccedil: "Ç", Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì",
  Iacute: "Í", Icirc: "Î", Iuml: "Ï", ETH: "Ð", Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó",
  Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", times: "×", Oslash: "Ø", Ugrave: "Ù", Uacute: "Ú",
  Ucirc: "Û", Uuml: "Ü", Yacute: "Ý", THORN: "Þ", szlig: "ß", agrave: "à", aacute: "á",
  acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç", egrave: "è",
  eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  eth: "ð", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö",
  divide: "÷", oslash: "ø", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý",
  thorn: "þ", yuml: "ÿ", OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ",
  fnof: "ƒ", circ: "ˆ", tilde: "˜", Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ",
  Epsilon: "Ε", Zeta: "Ζ", Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ", Lambda: "Λ",
  Mu: "Μ", Nu: "Ν", Xi: "Ξ", Omicron: "Ο", Pi: "Π", Rho: "Ρ", Sigma: "Σ", Tau: "Τ",
  Upsilon: "Υ", Phi: "Φ", Chi: "Χ", Psi: "Ψ", Omega: "Ω", alpha: "α", beta: "β",
  gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι",
  kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π", rho: "ρ",
  sigmaf: "ς", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ",
  omega: "ω", thetasym: "ϑ", upsih: "ϒ", piv: "ϖ", ensp: " ", emsp: " ", thinsp: " ",
  zwnj: "‌", zwj: "‍", lrm: "‎", rlm: "‏", ndash: "–", mdash: "—", lsquo: "‘",
  rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", dagger: "†", Dagger: "‡",
  bull: "•", hellip: "…", permil: "‰", prime: "′", Prime: "″", lsaquo: "‹", rsaquo: "›",
  oline: "‾", frasl: "⁄", euro: "€", image: "ℑ", weierp: "℘", real: "ℜ", trade: "™",
  alefsym: "ℵ", larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔", crarr: "↵",
  lArr: "⇐", uArr: "⇑", rArr: "⇒", dArr: "⇓", hArr: "⇔", forall: "∀", part: "∂",
  exist: "∃", empty: "∅", nabla: "∇", isin: "∈", notin: "∉", ni: "∋", prod: "∏",
  sum: "∑", minus: "−", lowast: "∗", radic: "√", prop: "∝", infin: "∞", ang: "∠",
  and: "∧", or: "∨", cap: "∩", cup: "∪", int: "∫", there4: "∴", sim: "∼", cong: "≅",
  asymp: "≈", ne: "≠", equiv: "≡", le: "≤", ge: "≥", sub: "⊂", sup: "⊃", nsub: "⊄",
  sube: "⊆", supe: "⊇", oplus: "⊕", otimes: "⊗", perp: "⊥", sdot: "⋅", lceil: "⌈",
  rceil: "⌉", lfloor: "⌊", rfloor: "⌋", lang: "⟨", rang: "⟩", loz: "◊", spades: "♠",
  clubs: "♣", hearts: "♥", diams: "♦"
};
function decodeEntity(text, i) {
  const m = /^&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/.exec(text.slice(i));
  if (!m) return null;
  const body = m[1];
  if (body[0] === "#") {
    let cp;
    if (body[1] === "x" || body[1] === "X") cp = parseInt(body.slice(2), 16);
    else cp = parseInt(body.slice(1), 10);
    if (isNaN(cp) || cp < 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF) || cp === 0) {
      return { value: "�", next: i + m[0].length };
    }
    return { value: String.fromCodePoint(cp), next: i + m[0].length };
  }
  if (Object.prototype.hasOwnProperty.call(ENTITIES, body)) {
    return { value: ENTITIES[body], next: i + m[0].length };
  }
  return null;
}

// ---------- inline parsing ----------
// Token kinds: {t:'s',v} literal text | {t:'h',v} raw HTML | {t:'d',ch,n,open,close} delimiter run
function inlineParse(text, refs) {
  const parts = [];
  let i = 0;
  const n = text.length;
  let buf = "";
  function flush() { if (buf) { parts.push({ t: "s", v: buf }); buf = ""; } }
  function pushHtml(h) { flush(); parts.push({ t: "h", v: h }); }
  while (i < n) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < n && isAsciiPunct(text[i + 1])) {
      buf += text[i + 1]; i += 2; continue;
    }
    if (ch === "\\" && i + 1 < n && text[i + 1] === "\n") {
      flush(); parts.push({ t: "h", v: "<br />\n" }); i += 2; continue;
    }
    if (ch === "`") {
      let j = i; while (j < n && text[j] === "`") j++;
      const run = j - i;
      const close = findCodeClose(text, j, run);
      if (close === -1) { buf += "`".repeat(run); i = j; continue; }
      let content = text.slice(j, close);
      content = content.replace(/\n/g, " ");
      if (content.length >= 2 && content[0] === " " && content[content.length - 1] === " " && content.trim() !== "") {
        content = content.slice(1, -1);
      }
      pushHtml("<code>" + escText(content) + "</code>");
      i = close + run; continue;
    }
    if (ch === "<") {
      const auto = parseAutolink(text, i);
      if (auto) { pushHtml(auto.html); i = auto.next; continue; }
      const tag = parseHtmlTag(text, i);
      if (tag) { pushHtml(tag); i += tag.length; continue; }
      buf += "<"; i++; continue;
    }
    if (ch === "!" && text[i + 1] === "[") {
      const img = parseLinkOrImage(text, i + 1, refs, true);
      if (img) { pushHtml(img.html); i = img.next; continue; }
      buf += "!"; i++; continue;
    }
    if (ch === "[") {
      const lnk = parseLinkOrImage(text, i, refs, false);
      if (lnk) { pushHtml(lnk.html); i = lnk.next; continue; }
      buf += "["; i++; continue;
    }
    if (ch === "*" || ch === "_") {
      let j = i; while (j < n && text[j] === ch) j++;
      const run = j - i;
      const prev = i > 0 ? text[i - 1] : "";
      const next = j < n ? text[j] : "";
      const prevWs = prev === "" || isSpace(prev);
      const nextWs = next === "" || isSpace(next);
      const prevP = prev !== "" && isPunct(prev);
      const nextP = next !== "" && isPunct(next);
      const leftFlank = !nextWs && (!nextP || prevWs || prevP);
      const rightFlank = !prevWs && (!prevP || nextWs || nextP);
      let canOpen, canClose;
      if (ch === "*") { canOpen = leftFlank; canClose = rightFlank; }
      else { canOpen = leftFlank && (!rightFlank || prevP); canClose = rightFlank && (!leftFlank || nextP); }
      flush();
      parts.push({ t: "d", ch, n: run, open: canOpen, close: canClose });
      i = j; continue;
    }
    if (ch === "~" && text[i + 1] === "~") {
      const close = text.indexOf("~~", i + 2);
      if (close !== -1) {
        const inner = text.slice(i + 2, close);
        if (inner.length > 0 && !/^\s*$/.test(inner)) {
          pushHtml("<del>" + inlineParse(inner, refs) + "</del>");
          i = close + 2; continue;
        }
      }
      buf += "~"; i++; continue;
    }
    if (ch === "&") {
      const ent = decodeEntity(text, i);
      if (ent) { buf += ent.value; i = ent.next; continue; }
      buf += "&"; i++; continue;
    }
    if (ch === "\n") {
      let sp = 0;
      for (let k = buf.length - 1; k >= 0 && buf[k] === " "; k--) sp++;
      if (sp >= 2) { buf = buf.slice(0, buf.length - sp); flush(); parts.push({ t: "h", v: "<br />\n" }); }
      else { flush(); parts.push({ t: "s", v: "\n" }); }
      i++; continue;
    }
    buf += ch; i++;
  }
  flush();
  return resolveEmphasis(applyGfmAutolinks(parts));
}
function findCodeClose(text, from, run) {
  let i = from;
  while (i < text.length) {
    if (text[i] === "`") {
      let j = i; while (j < text.length && text[j] === "`") j++;
      if (j - i === run) return i;
      i = j;
    } else i++;
  }
  return -1;
}
function parseAutolink(text, i) {
  const m = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>/.exec(text.slice(i));
  if (m) {
    const url = m[1];
    return { html: '<a href="' + escAttr(url) + '">' + escText(url) + "</a>", next: i + m[0].length };
  }
  const em = /^<([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(text.slice(i));
  if (em) {
    const addr = em[1];
    return { html: '<a href="mailto:' + escAttr(addr) + '">' + escText(addr) + "</a>", next: i + em[0].length };
  }
  return null;
}
const HTML_TAG_RE = /^(?:<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!A[\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>)/;
function parseHtmlTag(text, i) {
  const m = HTML_TAG_RE.exec(text.slice(i));
  return m ? m[0] : null;
}
function findClosingBracket(text, pos) {
  let depth = 0;
  let i = pos;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) { i += 2; continue; }
    if (ch === "`") {
      let j = i; while (j < text.length && text[j] === "`") j++;
      const run = j - i;
      const close = findCodeClose(text, j, run);
      if (close === -1) { i = j; continue; }
      i = close + run; continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}
// Unescape backslash-punctuation so a label written with escapes matches the
// same label written plainly, then collapse whitespace and lowercase.
function normalizeLabel(label) {
  return label.replace(/\\([!-\/:-@\[-`{-~])/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();
}
function parseLinkDestTitle(text, i) {
  let j = i + 1;
  while (j < text.length && (text[j] === " " || text[j] === "\n" || text[j] === "\t")) j++;
  let url = "", title = null;
  if (text[j] === "<") {
    const close = text.indexOf(">", j + 1);
    if (close === -1) return null;
    url = text.slice(j + 1, close);
    if (/[\n]/.test(url)) return null;
    j = close + 1;
  } else {
    let depth = 0;
    const start = j;
    while (j < text.length) {
      const ch = text[j];
      if (ch === "\\" && j + 1 < text.length && isAsciiPunct(text[j + 1])) { j += 2; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") { if (depth === 0) break; depth--; }
      else if (ch === " " || ch === "\n" || ch === "\t") break;
      j++;
    }
    if (j === start) return null;
    url = text.slice(start, j);
  }
  let k = j;
  while (k < text.length && (text[k] === " " || text[k] === "\n" || text[k] === "\t")) k++;
  if (text[k] === '"' || text[k] === "'" || text[k] === "(") {
    const q = text[k];
    const qc = q === "(" ? ")" : q;
    const tstart = k + 1;
    let t = tstart;
    let found = -1;
    while (t < text.length) {
      if (text[t] === "\\" && t + 1 < text.length) { t += 2; continue; }
      if (text[t] === qc) { found = t; break; }
      t++;
    }
    if (found === -1) return null;
    title = text.slice(tstart, found);
    k = found + 1;
    while (k < text.length && (text[k] === " " || text[k] === "\n" || text[k] === "\t")) k++;
  }
  if (text[k] !== ")") return null;
  return { url: unescapeLinkUrl(url), title, next: k + 1 };
}
function unescapeLinkUrl(u) {
  return u.replace(/\\([!-\/:-@\[-`{-~])/g, "$1");
}
// Plain text of a label (for img alt): render inline, keep nested img alt text, strip tags, decode entities.
function altText(label, refs) {
  const html = inlineParse(label, refs);
  let t = html.replace(/<img[^>]*?alt="([^"]*)"[^>]*>/g, "$1");
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  t = t.replace(/&#(\d+);/g, (m, d) => {
    const cp = parseInt(d, 10);
    return (cp > 0 && cp <= 0x10FFFF) ? String.fromCodePoint(cp) : "�";
  });
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (m, h) => {
    const cp = parseInt(h, 16);
    return (cp > 0 && cp <= 0x10FFFF) ? String.fromCodePoint(cp) : "�";
  });
  return t;
}
function parseLinkOrImage(text, pos, refs, isImage) {
  const close = findClosingBracket(text, pos);
  if (close === -1) return null;
  const labelText = text.slice(pos + 1, close);
  const after = close + 1;
  let url = null, title = null, next = -1;
  if (text[after] === "(") {
    const d = parseLinkDestTitle(text, after);
    if (!d) return null;
    url = d.url; title = d.title; next = d.next;
  } else if (text[after] === "[") {
    const c2 = text.indexOf("]", after + 1);
    if (c2 === -1) return null;
    const lab = c2 === after + 1 ? labelText : text.slice(after + 1, c2);
    const ref = refs.get(normalizeLabel(lab));
    if (!ref) return null;
    url = ref.url; title = ref.title; next = c2 + 1;
  } else {
    const ref = refs.get(normalizeLabel(labelText));
    if (!ref) return null;
    url = ref.url; title = ref.title; next = after;
  }
  if (url === null) return null;
  if (isImage) {
    const alt = altText(labelText, refs);
    let h = '<img src="' + escAttr(url) + '" alt="' + escAttr(alt) + '"';
    if (title !== null && title !== undefined) h += ' title="' + escAttr(title) + '"';
    h += ">";
    return { html: h, next };
  }
  const inner = inlineParse(labelText, refs);
  let h = '<a href="' + escAttr(url) + '"';
  if (title !== null && title !== undefined) h += ' title="' + escAttr(title) + '"';
  h += ">" + inner + "</a>";
  return { html: h, next };
}

function resolveEmphasis(parts) {
  const delims = [];
  for (let idx = 0; idx < parts.length; idx++) {
    if (parts[idx].t === "d") delims.push(idx);
  }
  if (delims.length === 0) return partsToHtml(parts);
  const remaining = new Map();
  for (const idx of delims) remaining.set(idx, parts[idx].n);
  const openAt = new Map();
  const closeAt = new Map();
  const stack = [];
  function bothFlank(d) { return d.open && d.close; }
  for (const dIdx of delims) {
    const d = parts[dIdx];
    let dRem = remaining.get(dIdx);
    if (d.close && dRem > 0) {
      for (let s = stack.length - 1; s >= 0 && dRem > 0; s--) {
        const oIdx = stack[s];
        const o = parts[oIdx];
        if (o.ch !== d.ch) continue;
        let oRem = remaining.get(oIdx);
        if (oRem <= 0) continue;
        if ((bothFlank(o) || bothFlank(d)) && (oRem + dRem) % 3 === 0 && !(oRem % 3 === 0 && dRem % 3 === 0)) {
          continue;
        }
        const use = (oRem >= 2 && dRem >= 2) ? 2 : 1;
        const tag = use === 2 ? "strong" : "em";
        if (!openAt.has(oIdx)) openAt.set(oIdx, []);
        openAt.get(oIdx).push("<" + tag + ">");
        if (!closeAt.has(dIdx)) closeAt.set(dIdx, []);
        closeAt.get(dIdx).push("</" + tag + ">");
        oRem -= use; dRem -= use;
        remaining.set(oIdx, oRem);
        remaining.set(dIdx, dRem);
        if (oRem === 0) stack.splice(s, 1);
      }
    }
    if (d.open && remaining.get(dIdx) > 0) {
      stack.push(dIdx);
    }
  }
  let out = "";
  for (let idx = 0; idx < parts.length; idx++) {
    const p = parts[idx];
    if (p.t === "d") {
      const closes = closeAt.get(idx);
      if (closes) for (const c of closes) out += c;
      const rem = remaining.get(idx);
      if (rem > 0) out += p.ch.repeat(rem);
      const opens = openAt.get(idx);
      if (opens) for (const o of opens) out += o;
    } else if (p.t === "s") {
      out += escText(p.v);
    } else {
      out += p.v;
    }
  }
  return out;
}
function partsToHtml(parts) {
  let out = "";
  for (const p of parts) {
    if (p.t === "s") out += escText(p.v);
    else if (p.t === "h") out += p.v;
    else out += p.ch.repeat(p.n);
  }
  return out;
}
function applyGfmAutolinks(parts) {
  const out = [];
  for (const p of parts) {
    if (p.t !== "s") { out.push(p); continue; }
    const text = p.v;
    let i = 0, buf = "";
    while (i < text.length) {
      const m = tryGfmAutolink(text, i);
      if (m) {
        if (buf) { out.push({ t: "s", v: buf }); buf = ""; }
        out.push({ t: "h", v: m.html });
        i = m.next;
      } else { buf += text[i]; i++; }
    }
    if (buf) out.push({ t: "s", v: buf });
  }
  return out;
}
function tryGfmAutolink(text, i) {
  const prev = i > 0 ? text[i - 1] : "";
  const prevOk = prev === "" || isSpace(prev) || prev === "*" || prev === "_" || prev === "~" || prev === "(" || prev === "[" || prev === "<";
  if (!prevOk) return null;
  let m = /^www\.[-A-Za-z0-9]+(?:\.[-A-Za-z0-9]+)+(?:\/[^\s<]*)?/.exec(text.slice(i));
  if (m) {
    const url = trimUrlTail(m[0]);
    if (!url) return null;
    return { html: '<a href="http://' + escAttr(url) + '">' + escText(url) + "</a>", next: i + url.length };
  }
  m = /^(?:https?|ftp):\/\/[^\s<]+/.exec(text.slice(i));
  if (m) {
    const url = trimUrlTail(m[0]);
    if (!url) return null;
    return { html: '<a href="' + escAttr(url) + '">' + escText(url) + "</a>", next: i + url.length };
  }
  m = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+/.exec(text.slice(i));
  if (m) {
    const addr = m[0];
    return { html: '<a href="mailto:' + escAttr(addr) + '">' + escText(addr) + "</a>", next: i + addr.length };
  }
  return null;
}
function trimUrlTail(url) {
  let end = url.length;
  while (end > 0 && /[?!.,:;*_~'"]/.test(url[end - 1])) end--;
  let s = url.slice(0, end);
  let open = 0;
  for (const c of s) { if (c === "(") open++; else if (c === ")") open--; }
  while (s.endsWith(")") && open < 0) { s = s.slice(0, -1); open++; }
  if (s.length === 0) return null;
  return s;
}

// ---------- block parsing ----------
function isBlank(line) { return /^[ \t]*$/.test(line); }
function indentOf(line) { return indentCols(line); }
function renderBlocks(src) {
  const lines = src.split("\n");
  const refs = new Map();
  collectLinkRefs(lines, refs);
  return parseBlockRange(lines, 0, lines.length, refs);
}
// Blockquote prefix: up to 3 columns of indent, then '>', then at most one space.
function blockquotePrefix(line) {
  let col = 0, i = 0;
  while (i < line.length && col < 3) {
    const ch = line[i];
    if (ch === " ") { col++; i++; }
    else if (ch === "\t") { const nx = col + (4 - (col % 4)); if (nx > 3) return -1; col = nx; i++; }
    else break;
  }
  if (line[i] !== ">") return -1;
  i++;
  if (line[i] === " ") i++;
  return i;
}
function parseBlockRange(lines, start, end, refs) {
  let out = "";
  let i = start;
  while (i < end) {
    if (isBlank(lines[i])) { i++; continue; }
    const line = lines[i];
    const ind = indentOf(line);
    // ATX heading
    let m = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (m && ind <= 3) {
      const level = m[1].length;
      let content = m[2].replace(/[ \t]+#+[ \t]*$/, "").replace(/[ \t]+$/, "");
      out += "<h" + level + ">" + inlineParse(content, refs) + "</h" + level + ">\n";
      i++; continue;
    }
    // fenced code block
    m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (m && ind <= 3) {
      const fence = m[1], fenceCh = fence[0], fenceLen = fence.length;
      let info = m[2].trim();
      if (fenceCh === "`" && info.indexOf("`") !== -1) {
        // not a fence; fall through to paragraph
      } else {
        let j = i + 1;
        const codeLines = [];
        while (j < end) {
          const cl = lines[j];
          const cm = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(cl);
          if (cm && cm[1][0] === fenceCh && cm[1].length >= fenceLen && indentOf(cl) <= 3) { j++; break; }
          codeLines.push(cl);
          j++;
        }
        const lang = info.split(/\s+/)[0] || "";
        const cls = lang ? ' class="language-' + escAttr(lang) + '"' : "";
        out += "<pre><code" + cls + ">" + escText(codeLines.join("\n") + (codeLines.length ? "\n" : "")) + "</code></pre>\n";
        i = j; continue;
      }
    }
    // thematic break
    if (ind <= 3 && /^ {0,3}((?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line)) {
      out += "<hr />\n"; i++; continue;
    }
    // HTML block type 1-6
    const htmlBlock = matchHtmlBlockStart(line);
    if (htmlBlock && htmlBlock.type !== 7 && ind <= 3) {
      let j = i;
      const hLines = [];
      while (j < end) {
        hLines.push(lines[j]);
        if (htmlBlock.end && j > i && htmlBlock.end.test(lines[j])) { j++; break; }
        j++;
        if (htmlBlock.type === 6 && j < end && isBlank(lines[j])) break;
        if (htmlBlock.type !== 6 && j > i && htmlBlock.end.test(lines[j - 1])) break;
      }
      out += hLines.join("\n") + "\n";
      i = j; continue;
    }
    // HTML block type 7 (complete tag alone on line)
    if (htmlBlock && htmlBlock.type === 7 && ind <= 3) {
      out += line.trim() + "\n"; i++; continue;
    }
    // blockquote
    const bq = blockquotePrefix(line);
    if (bq !== -1) {
      const inner = [];
      let j = i;
      while (j < end) {
        const l = lines[j];
        const bp = blockquotePrefix(l);
        if (bp !== -1) { inner.push(l.slice(bp)); j++; }
        else if (isBlank(l)) { inner.push(""); j++; }
        else {
          if (inner.length && !isBlank(inner[inner.length - 1]) && !/^(?:#{1,6}[ \t]|```|~~~)/.test(l)) {
            inner.push(l); j++;
          } else break;
        }
      }
      while (inner.length && isBlank(inner[inner.length - 1])) inner.pop();
      out += "<blockquote>\n" + parseBlockRange(inner, 0, inner.length, refs) + "</blockquote>\n";
      i = j; continue;
    }
    // list
    const listInfo = matchListStart(line);
    if (listInfo) {
      const res = parseList(lines, i, end, refs);
      out += res.html; i = res.next; continue;
    }
    // indented code block (4+ columns, at block start)
    if (ind >= 4) {
      const codeLines = [];
      let j = i;
      while (j < end) {
        const l = lines[j];
        if (isBlank(l)) {
          let k = j + 1;
          while (k < end && isBlank(lines[k])) k++;
          if (k < end && indentOf(lines[k]) >= 4) {
            while (j < k) { codeLines.push(stripCols(lines[j], 4)); j++; }
            continue;
          }
          break;
        }
        if (indentOf(l) >= 4) { codeLines.push(stripCols(l, 4)); j++; }
        else break;
      }
      while (codeLines.length && codeLines[codeLines.length - 1] === "") codeLines.pop();
      out += "<pre><code>" + escText(codeLines.join("\n") + (codeLines.length ? "\n" : "")) + "</code></pre>\n";
      i = j; continue;
    }
    // table (GFM)
    if (line.indexOf("|") !== -1 && i + 1 < end) {
      const tbl = tryParseTable(lines, i, end, refs);
      if (tbl) { out += tbl.html; i = tbl.next; continue; }
    }
    // paragraph
    const pres = parseParagraph(lines, i, end, refs);
    out += pres.html; i = pres.next;
  }
  return out;
}
function matchHtmlBlockStart(line) {
  const s = line.trimStart();
  if (/^<(script|pre|style|textarea)(?:\s|>|\/>|$)/i.test(s)) {
    return { type: 1, end: /<\/(script|pre|style|textarea)>/i };
  }
  if (/^<!--/.test(s)) return { type: 2, end: /-->/ };
  if (/^<\?/.test(s)) return { type: 3, end: /\?>/ };
  if (/^<![A-Za-z]/.test(s)) return { type: 4, end: />/ };
  if (/^<!\[CDATA\[/.test(s)) return { type: 5, end: /\]\]>/ };
  if (/^<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i.test(s)) {
    return { type: 6, end: null };
  }
  if (/^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>[ \t]*$/.test(s)) {
    return { type: 7, end: null };
  }
  return null;
}

function isLinkRefLine(line) {
  return /^ {0,3}\[(?:\\.|[^\]])+\]:[ \t]*(?:\S+(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?)?[ \t]*$/.test(line);
}
function parseParagraph(lines, i, end, refs) {
  const paraLines = [];
  let j = i;
  while (j < end) {
    const l = lines[j];
    if (isBlank(l)) break;
    if (isLinkRefLine(l)) { j++; continue; }
    // setext underline (only `=` or `-` chars, no spaces) -> heading
    const setext = /^ {0,3}(=+|-+)[ \t]*$/.exec(l);
    if (setext && paraLines.length > 0) {
      const level = setext[1][0] === "=" ? 1 : 2;
      const content = paraLines.join("\n").replace(/[ \t]*\n[ \t]*/g, " ");
      return { html: "<h" + level + ">" + inlineParse(content, refs) + "</h" + level + ">\n", next: j + 1 };
    }
    // paragraph-interrupting blocks
    if (/^ {0,3}#{1,6}(?:[ \t]+|$)/.test(l) && indentOf(l) <= 3) break;
    if (/^ {0,3}(`{3,}|~{3,})/.test(l) && indentOf(l) <= 3) break;
    if (/^ {0,3}((?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(l) && indentOf(l) <= 3) break;
    if (matchHtmlBlockStart(l) && indentOf(l) <= 3) break;
    if (blockquotePrefix(l) !== -1) break;
    if (matchListStart(l)) break;
    paraLines.push(l);
    j++;
  }
  if (paraLines.length === 0) {
    return { html: "", next: j + 1 };
  }
  return { html: "<p>" + inlineParse(paraLines.join("\n"), refs) + "</p>\n", next: j };
}
// Content indent of a list item: column where the item's content starts.
// Marker + 1-4 spaces -> content after those spaces; 5+ spaces -> marker+1 (rest is content indent).
function computeContentIndent(line, markerLenChars) {
  let p = 0, col = 0;
  while (p < line.length && (line[p] === " " || line[p] === "\t")) {
    if (line[p] === " ") col++;
    else col += 4 - (col % 4);
    p++;
    if (col > 3) return -1;
  }
  const markerEndCol = col + markerLenChars;
  let q = p + markerLenChars;
  let wsCols = 0, c2 = markerEndCol;
  while (q < line.length && (line[q] === " " || line[q] === "\t")) {
    if (line[q] === " ") { wsCols++; c2++; }
    else { const nx = c2 + (4 - (c2 % 4)); wsCols += nx - c2; c2 = nx; }
    q++;
  }
  const hasContent = q < line.length;
  if (!hasContent) return markerEndCol + 1;
  if (wsCols <= 4) return markerEndCol + wsCols;
  return markerEndCol + 1;
}
function matchListStart(line) {
  const ind = indentOf(line);
  if (ind > 3) return null;
  let m = /^ {0,3}([*+-])(?:[ \t]+|$)/.exec(line);
  if (m) {
    const ci = computeContentIndent(line, 1);
    if (ci < 0) return null;
    return { bullet: true, marker: m[1], ordered: false, start: 1, contentIndent: ci };
  }
  m = /^ {0,3}(\d{1,9})([.)])(?:[ \t]+|$)/.exec(line);
  if (m) {
    const ci = computeContentIndent(line, m[1].length + 1);
    if (ci < 0) return null;
    return { bullet: false, marker: m[1] + m[2], ordered: true, start: parseInt(m[1], 10), contentIndent: ci };
  }
  return null;
}
function parseList(lines, i, end, refs) {
  const first = matchListStart(lines[i]);
  const ordered = first.ordered;
  const startNum = first.start;
  const items = [];
  let j = i;
  let contentIndent = first.contentIndent;
  let loose = false;
  const listIndent = indentOf(lines[i]);
  while (j < end) {
    const l = lines[j];
    if (isBlank(l)) {
      let k = j + 1;
      while (k < end && isBlank(lines[k])) k++;
      if (k < end) {
        const nl = matchListStart(lines[k]);
        if (nl && nl.ordered === ordered && indentOf(lines[k]) <= 3 && (ordered || nl.marker === first.marker)) {
          loose = true;
          j = k; continue;
        }
        if (items.length > 0 && indentOf(lines[k]) >= contentIndent && contentIndent > 0) {
          loose = true;
          for (let b = j; b < k; b++) items[items.length - 1].lines.push("");
          j = k; continue;
        }
      }
      break;
    }
    const cur = matchListStart(l);
    const curInd = indentOf(l);
    if (cur && curInd <= 3 && cur.ordered === ordered) {
      if (!ordered && cur.marker !== first.marker) break;
      const ci = cur.contentIndent;
      if (items.length === 0) contentIndent = ci;
      items.push({ lines: [contentAfterCols(l, ci)], indent: ci });
      j++; continue;
    }
    if (items.length === 0) break;
    if (curInd >= contentIndent && contentIndent > 0) {
      items[items.length - 1].lines.push(contentAfterCols(l, contentIndent));
      j++; continue;
    }
    // lazy continuation of the item's paragraph (plain text, not a new block)
    if (!/^ {0,3}#{1,6}(?:[ \t]+|$)/.test(l) && !/^ {0,3}(`{3,}|~{3,})/.test(l) &&
        !/^ {0,3}((?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(l) &&
        !matchHtmlBlockStart(l) && blockquotePrefix(l) === -1 && !matchListStart(l) &&
        curInd >= listIndent) {
      items[items.length - 1].lines.push(l.trimStart());
      j++; continue;
    }
    break;
  }
  const tag = ordered ? "ol" : "ul";
  const startAttr = ordered && startNum !== 1 ? ' start="' + startNum + '"' : "";
  let html = "<" + tag + startAttr + ">\n";
  for (const item of items) {
    const itemLines = item.lines;
    while (itemLines.length && isBlank(itemLines[itemLines.length - 1])) itemLines.pop();
    let itemHtml = parseBlockRange(itemLines, 0, itemLines.length, refs);
    if (!loose) {
      // tight list: strip a single surrounding <p>...</p> if the item is exactly one paragraph
      if (itemHtml.startsWith("<p>") && itemHtml.endsWith("</p>\n") && itemHtml.indexOf("</p>") === itemHtml.length - 5) {
        itemHtml = itemHtml.slice(3, -5);
      }
    }
    html += "<li>" + itemHtml + "</li>\n";
  }
  html += "</" + tag + ">\n";
  return { html, next: j };
}
// ---------- GFM tables ----------
function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) { cur += s[i] + s[i + 1]; i += 2; continue; }
    if (ch === "|") { cells.push(cur); cur = ""; i++; continue; }
    cur += ch; i++;
  }
  cells.push(cur);
  return cells;
}
function tryParseTable(lines, i, end, refs) {
  if (i + 1 >= end) return null;
  const header = splitTableRow(lines[i]);
  if (!header || header.length === 0) return null;
  const cells = splitTableRow(lines[i + 1]);
  if (!cells) return null;
  if (cells.length !== header.length) return null;
  const aligns = [];
  for (const c of cells) {
    const t = c.trim();
    if (!/^:?-+:?$/.test(t)) return null;
    if (t.startsWith(":") && t.endsWith(":")) aligns.push("center");
    else if (t.endsWith(":")) aligns.push("right");
    else if (t.startsWith(":")) aligns.push("left");
    else aligns.push(null);
  }
  const rows = [];
  let j = i + 2;
  while (j < end) {
    const l = lines[j];
    if (isBlank(l)) break;
    if (blockquotePrefix(l) !== -1) break;
    if (/^ {0,3}#{1,6}(?:[ \t]+|$)/.test(l)) break;
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) break;
    if (matchListStart(l)) break;
    if (/^ {0,3}((?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(l)) break;
    if (matchHtmlBlockStart(l)) break;
    const rc = splitTableRow(l);
    if (!rc) break;
    while (rc.length < header.length) rc.push("");
    if (rc.length > header.length) rc.length = header.length;
    rows.push(rc);
    j++;
  }
  let h = "<table>\n<thead>\n<tr>\n";
  for (let k = 0; k < header.length; k++) {
    h += "<th" + (aligns[k] ? ' align="' + aligns[k] + '"' : "") + ">" + inlineParse(header[k].trim(), refs) + "</th>\n";
  }
  h += "</tr>\n</thead>\n";
  if (rows.length > 0) {
    h += "<tbody>";
    for (const r of rows) {
      h += "<tr>\n";
      for (let k = 0; k < header.length; k++) {
        h += "<td" + (aligns[k] ? ' align="' + aligns[k] + '"' : "") + ">" + inlineParse(r[k].trim(), refs) + "</td>\n";
      }
      h += "</tr>\n";
    }
    h += "</tbody></table>\n";
  } else {
    h += "</table>\n";
  }
  return { html: h, next: j };
}
// ---------- link reference definitions (can span up to 3 lines) ----------
function collectLinkRefs(lines, refs) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^ {0,3}\[((?:\\.|[^\]])+)\]:[ \t]*(.*)$/.exec(line);
    if (!m) continue;
    const label = normalizeLabel(m[1]);
    let rest = m[2];
    let url = "", title = null;
    let consumed = 0;
    let urlLine = rest;
    if (urlLine.trim() === "") {
      if (i + 1 < lines.length && lines[i + 1].trim() !== "") {
        urlLine = lines[i + 1].trim();
        consumed = 1;
      } else continue;
    }
    if (urlLine.startsWith("<")) {
      const close = urlLine.indexOf(">");
      if (close === -1) continue;
      url = urlLine.slice(1, close);
      rest = urlLine.slice(close + 1).trim();
    } else {
      const sp = urlLine.search(/[ \t]/);
      if (sp === -1) { url = urlLine; rest = ""; }
      else { url = urlLine.slice(0, sp); rest = urlLine.slice(sp).trim(); }
    }
    if (!url) continue;
    url = url.replace(/ /g, "%20");
    if (!rest) {
      const ti = i + consumed + 1;
      if (ti < lines.length) {
        const tl = lines[ti].trim();
        const tm = /^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/.exec(tl);
        if (tm) { title = tm[1] !== undefined ? tm[1] : (tm[2] !== undefined ? tm[2] : tm[3]); consumed++; }
      }
    } else {
      const tm = /^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/.exec(rest);
      if (tm) title = tm[1] !== undefined ? tm[1] : (tm[2] !== undefined ? tm[2] : tm[3]);
      else continue;
    }
    if (!refs.has(label)) {
      refs.set(label, { url: unescapeLinkUrl(url), title });
    }
    i += consumed;
  }
}
