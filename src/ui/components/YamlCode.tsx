import { yamlLines, type YamlTokenKind } from "../lib/yaml-tokens";

/** Written out in full: Tailwind does not see names built at runtime. */
const TOKEN_CLASS: Record<YamlTokenKind, string> = {
  key: "text-code-key",
  string: "text-code-string",
  number: "text-code-number",
  keyword: "text-code-keyword",
  comment: "text-code-comment italic",
  punct: "text-code-punct",
  text: "",
};

/**
 * YAML shown as code: monospaced, its indentation kept as typed, the syntax
 * coloured (`yaml-tokens.ts`). With `maxLines`, only the first lines show, then a
 * line saying how many more there are, written by `moreLabel`. `lineNumbers` adds a
 * gutter, for a definition read at length.
 */
export function YamlCode({
  text,
  maxLines,
  moreLabel,
  lineNumbers = false,
  className = "",
}: {
  text: string;
  maxLines?: number;
  moreLabel?: (count: number) => string;
  lineNumbers?: boolean;
  className?: string;
}) {
  const all = yamlLines(text.replace(/\s+$/, ""));
  const shown = maxLines === undefined ? all : all.slice(0, maxLines);
  const hidden = all.length - shown.length;
  return (
    <pre className={`m-0 font-mono text-data leading-relaxed whitespace-pre text-ink ${className}`}>
      <code className="table">
        {shown.map((tokens, index) => (
          <span key={index} className="table-row">
            {lineNumbers && (
              <span
                aria-hidden="true"
                className="table-cell pr-3 text-right text-ink-muted select-none"
              >
                {index + 1}
              </span>
            )}
            <span className="table-cell">
              {tokens.length === 0
                ? " "
                : tokens.map((token, at) => (
                    <span key={at} className={TOKEN_CLASS[token.kind]}>
                      {token.text}
                    </span>
                  ))}
            </span>
          </span>
        ))}
      </code>
      {hidden > 0 && moreLabel !== undefined && (
        <span className="block text-ink-muted italic">{moreLabel(hidden)}</span>
      )}
    </pre>
  );
}
