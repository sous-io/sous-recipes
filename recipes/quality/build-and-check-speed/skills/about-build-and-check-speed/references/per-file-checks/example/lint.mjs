// Lint check: ESLint for script files, prettier for the other formats prettier knows.
import { readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { CACHE_DIR, REPO_ROOT, displayPath } from "./paths.mjs";

const ESLINT_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const MAX_WARNINGS = 10;
const PRETTIER_EXTENSIONS = new Set([".css", ".html", ".json", ".md", ".scss", ".yaml", ".yml"]);

let shouldFix = false;
let eslintPromise;
let prettierPromise;

function getEslint() {
  eslintPromise ??= (async () => {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({
      cwd: REPO_ROOT,
      cache: true,
      cacheLocation: join(CACHE_DIR, "eslint/"),
      cacheStrategy: "content",
      // One instance serves both modes: the predicate reads the current request's `--fix` flag.
      fix: () => shouldFix,
    });
    return { ESLint, eslint };
  })();
  return eslintPromise;
}

function getPrettier() {
  prettierPromise ??= import("prettier").then((module) => module.default ?? module);
  return prettierPromise;
}

/**
 * Lints one file. Returns `{ status: "pass" | "fail" | "skip", lines: string[] }`.
 * With `fix`, ESLint and prettier fixes are written to the file.
 */
export async function lintFile(file, { fix }) {
  const extension = extname(file);
  if (ESLINT_EXTENSIONS.has(extension)) {
    return lintWithEslint(file, fix);
  }
  if (PRETTIER_EXTENSIONS.has(extension)) {
    return checkWithPrettier(file, fix);
  }
  return { status: "skip", lines: [`no linter for ${extension || "files without an extension"}`] };
}

async function lintWithEslint(file, fix) {
  const { ESLint, eslint } = await getEslint();
  if (await eslint.isPathIgnored(file)) {
    const prettierResult = await checkWithPrettier(file, fix);
    const note =
      "eslint.config.js ignores this file (specs, tests, stories, build output); prettier only";
    return { ...prettierResult, lines: [note, ...prettierResult.lines] };
  }
  shouldFix = fix;
  const results = await eslint.lintFiles([file]);
  if (fix) {
    await ESLint.outputFixes(results);
  }
  const errorCount = results.reduce(
    (sum, result) => sum + result.errorCount + result.fatalErrorCount,
    0,
  );
  const lines = [];
  let hiddenWarnings = 0;
  let shownWarnings = 0;
  for (const result of results) {
    for (const message of result.messages) {
      const isError = message.severity === 2;
      if (!isError && shownWarnings >= MAX_WARNINGS) {
        hiddenWarnings += 1;
        continue;
      }
      if (!isError) {
        shownWarnings += 1;
      }
      const severity = isError ? "error" : "warning";
      const rule = message.ruleId ? ` (${message.ruleId})` : "";
      lines.push(
        `${displayPath(result.filePath)}:${message.line}:${message.column} ${severity}: ${message.message}${rule}`,
      );
    }
  }
  if (hiddenWarnings) {
    lines.push(`... ${hiddenWarnings} more warning(s)`);
  }
  return { status: errorCount ? "fail" : "pass", lines };
}

async function checkWithPrettier(file, fix) {
  const prettier = await getPrettier();
  const info = await prettier.getFileInfo(file, {
    ignorePath: [join(REPO_ROOT, ".prettierignore")],
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) {
    return { status: "skip", lines: ["ignored by .prettierignore or no prettier parser"] };
  }
  const options = {
    ...(await prettier.resolveConfig(file, { editorconfig: true })),
    filepath: file,
  };
  const source = readFileSync(file, "utf8");
  if (await prettier.check(source, options)) {
    return { status: "pass", lines: [] };
  }
  if (fix) {
    writeFileSync(file, await prettier.format(source, options));
    return { status: "pass", lines: ["prettier: formatted"] };
  }
  return {
    status: "fail",
    lines: [`${displayPath(file)}: not prettier-formatted (rerun with --fix to format)`],
  };
}
