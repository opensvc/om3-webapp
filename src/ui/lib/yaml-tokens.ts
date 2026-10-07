/**
 * Splits YAML text into the tokens a highlighter colours, line by line, without
 * parsing it: keys, strings, numbers, keywords (booleans, null), comments and the
 * punctuation of the syntax. The text itself is left as it is, indentation included,
 * since YAML depends on it; a text that is not valid YAML is still shown, coloured
 * as far as its lines allow.
 *
 * Covers what definitions use — mappings, sequences, quoted and plain scalars, flow
 * collections, block scalars (`|`, `>`), anchors and aliases, comments, document
 * markers — not the whole of YAML.
 */

export type YamlTokenKind = "key" | "string" | "number" | "keyword" | "comment" | "punct" | "text";

export interface YamlToken {
  kind: YamlTokenKind;
  text: string;
}

const KEYWORDS = new Set(["true", "false", "yes", "no", "on", "off", "null", "~"]);
const NUMBER = /^[-+]?(\d[\d_]*(\.\d*)?([eE][-+]?\d+)?|\.\d+|0x[0-9a-fA-F]+|\.inf|\.nan)$/;

/** The comment starting this text, if a `#` outside quotes follows a blank. */
function commentStart(text: string): number {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (quote !== null) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(text.charAt(i - 1)))) return i;
  }
  return -1;
}

/** A scalar or flow value: quoted strings, flow punctuation, numbers, keywords, text. */
function valueTokens(value: string): YamlToken[] {
  const tokens: YamlToken[] = [];
  let rest = value;
  while (rest !== "") {
    const space = /^\s+/.exec(rest);
    if (space !== null) {
      tokens.push({ kind: "text", text: space[0] });
      rest = rest.slice(space[0].length);
      continue;
    }
    const quoted = /^("(?:[^"\\]|\\.)*"?|'(?:[^']|'')*'?)/.exec(rest);
    if (quoted !== null) {
      tokens.push({ kind: "string", text: quoted[0] });
      rest = rest.slice(quoted[0].length);
      continue;
    }
    const punct = /^([[\]{},]|[|>][-+]?\d*(?=\s|$)|[&*!][^\s[\]{},]*)/.exec(rest);
    if (punct !== null) {
      tokens.push({ kind: "punct", text: punct[0] });
      rest = rest.slice(punct[0].length);
      continue;
    }
    // A key inside a flow mapping: "{stack: true}".
    const flowKey = /^([^\s[\]{},:'"][^[\]{},:]*?)(:)(?=\s)/.exec(rest);
    if (flowKey !== null) {
      tokens.push({ kind: "key", text: flowKey[1] ?? "" }, { kind: "punct", text: ":" });
      rest = rest.slice(flowKey[0].length);
      continue;
    }
    // A plain scalar runs up to a flow delimiter.
    const plain = /^[^[\]{},]+?(?=\s*(?:[[\]{},]|$))/.exec(rest) ?? [rest];
    const word = plain[0];
    const trimmed = word.trim();
    const kind: YamlTokenKind = KEYWORDS.has(trimmed.toLowerCase())
      ? "keyword"
      : NUMBER.test(trimmed)
        ? "number"
        : "string";
    tokens.push({ kind, text: word });
    rest = rest.slice(word.length);
  }
  return tokens;
}

/** The tokens of each line of the text. */
export function yamlLines(source: string): YamlToken[][] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  // Inside a block scalar: the indentation its lines are deeper than.
  let blockIndent: number | null = null;
  return lines.map((line) => {
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    if (blockIndent !== null) {
      if (line.trim() === "" || indent.length > blockIndent)
        return [{ kind: "string", text: line }];
      blockIndent = null;
    }
    const tokens: YamlToken[] = [];
    let rest = line;
    const cut = commentStart(rest);
    const comment = cut === -1 ? "" : rest.slice(cut);
    if (cut !== -1) rest = rest.slice(0, cut);

    if (/^(---|\.\.\.)\s*$/.test(rest)) {
      tokens.push({ kind: "punct", text: rest });
    } else {
      tokens.push({ kind: "text", text: indent });
      rest = rest.slice(indent.length);
      // Sequence entries, possibly several on a line: "- - a".
      for (let dash = /^-(\s+|$)/.exec(rest); dash !== null; dash = /^-(\s+|$)/.exec(rest)) {
        tokens.push({ kind: "punct", text: "-" }, { kind: "text", text: dash[1] ?? "" });
        rest = rest.slice(dash[0].length);
      }
      const key = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'[\]{},#][^:#]*?)(\s*)(:)(?=\s|$)/.exec(
        rest,
      );
      if (key !== null) {
        tokens.push(
          { kind: "key", text: key[1] ?? "" },
          { kind: "text", text: key[2] ?? "" },
          { kind: "punct", text: ":" },
        );
        rest = rest.slice(key[0].length);
      }
      tokens.push(...valueTokens(rest));
      // A block scalar indicator ends the line: the lines below, deeper, are its text.
      if (/(^|\s)[|>][-+]?\d*\s*$/.test(rest)) blockIndent = indent.length;
    }
    if (comment !== "") tokens.push({ kind: "comment", text: comment });
    return tokens.filter((token) => token.text !== "");
  });
}
