import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { yamlLines, type YamlToken } from "../lib/yaml-tokens";
import { YamlCode } from "../components/YamlCode";
import { UnifiedDiff } from "../components/UnifiedDiff";

const kinds = (tokens: YamlToken[] | undefined) =>
  (tokens ?? []).map((token) => `${token.kind}:${token.text}`);

describe("yamlLines", () => {
  test("splits a mapping line into key, punctuation, value and comment", () => {
    expect(kinds(yamlLines("key: value # note")[0])).toEqual([
      "key:key",
      "punct::",
      "text: ",
      "string:value",
      "text: ",
      "comment:# note",
    ]);
  });

  test("keeps the indentation and marks sequence dashes", () => {
    expect(kinds(yamlLines('  - name: "x"')[0])).toEqual([
      "text:  ",
      "punct:-",
      "text: ",
      "key:name",
      "punct::",
      "text: ",
      'string:"x"',
    ]);
    expect(kinds(yamlLines("- - a")[0])).toEqual([
      "punct:-",
      "text: ",
      "punct:-",
      "text: ",
      "string:a",
    ]);
  });

  test("tells numbers and keywords from strings", () => {
    const [count, on, nil] = yamlLines("count: 42\non: true\nnil: ~");
    expect(count?.at(-1)).toEqual({ kind: "number", text: "42" });
    expect(on?.at(-1)).toEqual({ kind: "keyword", text: "true" });
    expect(nil?.at(-1)).toEqual({ kind: "keyword", text: "~" });
  });

  test("a # not preceded by a blank is no comment", () => {
    expect(yamlLines("url: http://a#b")[0]?.at(-1)).toEqual({ kind: "string", text: "http://a#b" });
  });

  test("document markers, aliases and flow collections", () => {
    expect(yamlLines("---")).toEqual([[{ kind: "punct", text: "---" }]]);
    expect(yamlLines("ref: *anchor")[0]?.at(-1)).toEqual({ kind: "punct", text: "*anchor" });
    expect(kinds(yamlLines("flow: {stack: true, n: [1, 2]}")[0]).slice(3)).toEqual([
      "punct:{",
      "key:stack",
      "punct::",
      "text: ",
      "keyword:true",
      "punct:,",
      "text: ",
      "key:n",
      "punct::",
      "text: ",
      "punct:[",
      "number:1",
      "punct:,",
      "text: ",
      "number:2",
      "punct:]",
      "punct:}",
    ]);
  });

  test("the lines of a block scalar are a string, up to the next key", () => {
    const lines = yamlLines("script: |\n  echo hi\n  # not a comment\nnext: 1");
    expect(lines[0]?.at(-1)).toEqual({ kind: "punct", text: "|" });
    expect(lines[1]).toEqual([{ kind: "string", text: "  echo hi" }]);
    expect(lines[2]).toEqual([{ kind: "string", text: "  # not a comment" }]);
    expect(lines[3]?.[0]).toEqual({ kind: "key", text: "next" });
  });

  test("an empty line has no token, and CRLF is read as LF", () => {
    expect(yamlLines("")).toEqual([[]]);
    expect(yamlLines("a: 1\r\nb: 2")).toHaveLength(2);
  });
});

describe("YamlCode", () => {
  const TEXT = "a: 1\nb: true\n# c\nd: x\n\n";

  test("colours the tokens and drops the trailing blank lines", () => {
    const { container } = render(<YamlCode text={TEXT} />);
    expect(container.querySelectorAll(".table-row")).toHaveLength(4);
    expect(screen.getByText("a")).toHaveClass("text-code-key");
    expect(screen.getByText("1")).toHaveClass("text-code-number");
    expect(screen.getByText("true")).toHaveClass("text-code-keyword");
    expect(screen.getByText("# c")).toHaveClass("text-code-comment", "italic");
    expect(screen.getByText("x")).toHaveClass("text-code-string");
  });

  test("maxLines shows the first lines and says how many more there are", () => {
    const { container } = render(
      <YamlCode text={TEXT} maxLines={2} moreLabel={(count) => `${String(count)} more lines`} />,
    );
    expect(container.querySelectorAll(".table-row")).toHaveLength(2);
    expect(screen.getByText("2 more lines")).toBeInTheDocument();
  });

  test("no more line when everything fits", () => {
    render(<YamlCode text={TEXT} maxLines={10} moreLabel={() => "more"} />);
    expect(screen.queryByText("more")).not.toBeInTheDocument();
  });

  test("lineNumbers adds a hidden gutter", () => {
    const { container } = render(<YamlCode text={"a: 1\n\nb: 2"} lineNumbers />);
    const gutter = [...container.querySelectorAll('[aria-hidden="true"]')].map(
      (cell) => cell.textContent,
    );
    expect(gutter).toEqual(["1", "2", "3"]);
  });
});

const DIFF = [
  "@@ -1,3 +1,3 @@ section",
  " unchanged",
  "-old line",
  "+new line",
  "\\ No newline at end of file",
].join("\n");

const LABELS = {
  added: "added",
  removed: "removed",
  showAll: (lines: number) => `Show all ${String(lines)} lines`,
};

describe("UnifiedDiff", () => {
  test("renders one row per line with its old and new numbers", () => {
    render(<UnifiedDiff diff={DIFF} labels={LABELS} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);
    const cells = (index: number) =>
      within(rows[index] as HTMLElement)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
    expect(cells(0)).toEqual(["", "", "", "@@ -1,3 +1,3 @@ section"]);
    expect(cells(1)).toEqual(["1", "1", "", "unchanged"]);
    expect(cells(2)).toEqual(["2", "", "−removed", "old line"]);
    expect(cells(3)).toEqual(["", "2", "+added", "new line"]);
    expect(cells(4)).toEqual(["", "", "", "No newline at end of file"]);
  });

  test("tints added and removed lines and hides their sign", () => {
    render(<UnifiedDiff diff={DIFF} labels={LABELS} />);
    expect(screen.getByText("new line").closest("tr")).toHaveClass("bg-state-up-soft");
    expect(screen.getByText("old line").closest("tr")).toHaveClass("bg-state-down-soft");
    expect(screen.getByText("+")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("removed")).toHaveClass("sr-only");
  });

  test("numbers restart at each hunk", () => {
    render(<UnifiedDiff diff={"@@ -10 +20 @@\n ctx\n@@ -40,2 +50,2 @@\n ctx2"} labels={LABELS} />);
    const ctx2 = screen.getByText("ctx2").closest("tr");
    expect(ctx2?.textContent).toBe("4050ctx2");
    expect(screen.getByText("ctx").closest("tr")?.textContent).toBe("1020ctx");
  });

  test("a long diff shows its first lines, the rest on demand", async () => {
    const user = userEvent.setup();
    const long = ["@@ -1,5 +1,5 @@", " a", " b", " c", " d", " e"].join("\n");
    render(<UnifiedDiff diff={long} labels={LABELS} limit={3} />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Show all 6 lines" }));
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // UnifiedDiff.tsx:16 splits on "\n" and treats the empty string after the final
  // newline as a context line: `git diff` output, which ends with a newline, gets a
  // phantom empty row numbered as if the files had one more line.
  test("a trailing newline adds no row", () => {
    render(<UnifiedDiff diff={`${DIFF}\n`} labels={LABELS} />);
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });
});
