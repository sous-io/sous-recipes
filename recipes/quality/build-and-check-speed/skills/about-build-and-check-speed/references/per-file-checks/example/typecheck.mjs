// Typecheck: one in-memory TypeScript LanguageService per tsconfig.json, re-parsing only files whose mtime changed.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

import { REPO_ROOT, displayPath, findUp, newestMtime } from "./paths.mjs";

const TS_EXTENSIONS = new Set([".cts", ".mts", ".ts", ".tsx"]);
const SPEC_PATTERN = /\.(spec|test)(\.[cm]?[jt]sx?)$/;

let tsPromise;
let documentRegistry;

/** Per-request cache of file versions, so each file is stat-ed once per request. */
let versionCache = new Map();

/** tsconfig path -> project state */
const projects = new Map();

function getTs() {
  tsPromise ??= import("typescript").then((module) => {
    const ts = module.default ?? module;
    documentRegistry = ts.createDocumentRegistry(true, REPO_ROOT);
    return ts;
  });
  return tsPromise;
}

function fileVersion(path) {
  let version = versionCache.get(path);
  if (version === undefined) {
    try {
      version = String(statSync(path).mtimeMs);
    } catch {
      version = "missing";
    }
    versionCache.set(path, version);
  }
  return version;
}

function parseConfig(ts, configPath) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
  );
  return parsed;
}

function configIncludes(parsed, file) {
  return parsed?.fileNames.some((name) => resolve(name) === file) ?? false;
}

function referencePath(reference) {
  const path = reference.path;
  return path.endsWith(".json") ? path : join(path, "tsconfig.json");
}

/**
 * Picks the tsconfig that owns `file`: the nearest tsconfig.json, or one of its project references that includes
 * the file.
 */
function chooseConfig(ts, file) {
  const nearest = findUp(dirname(file), ["tsconfig.json"]);
  if (!nearest) {
    return undefined;
  }
  const parsed = parseConfig(ts, nearest.path);
  if (configIncludes(parsed, file)) {
    return { configPath: nearest.path, parsed };
  }
  for (const reference of parsed?.projectReferences ?? []) {
    const path = referencePath(reference);
    const referenced = existsSync(path) ? parseConfig(ts, path) : undefined;
    if (configIncludes(referenced, file)) {
      return { configPath: path, parsed: referenced };
    }
  }
  return { configPath: nearest.path, parsed };
}

function createProject(ts, configPath, parsed) {
  const options = { ...parsed.options, noEmit: true };
  delete options.composite;
  delete options.incremental;
  delete options.tsBuildInfoFile;
  const project = {
    configPath,
    configVersion: fileVersion(configPath),
    // Only the ambient declaration files plus the files checked so far: the program then holds just their import
    // graph, not the whole package, which keeps the first check of a package fast.
    rootNames: new Set(
      parsed.fileNames.filter((name) => name.endsWith(".d.ts")).map((name) => resolve(name)),
    ),
    service: undefined,
  };
  const host = {
    getScriptFileNames: () => [...project.rootNames],
    getScriptVersion: fileVersion,
    getScriptSnapshot: (path) => {
      if (!existsSync(path)) {
        return undefined;
      }
      return ts.ScriptSnapshot.fromString(readFileSync(path, "utf8"));
    },
    getCurrentDirectory: () => dirname(configPath),
    getCompilationSettings: () => options,
    getDefaultLibFileName: (compilerOptions) => ts.getDefaultLibFilePath(compilerOptions),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => true,
  };
  project.service = ts.createLanguageService(host, documentRegistry);
  return project;
}

function getProject(ts, file) {
  const chosen = chooseConfig(ts, file);
  if (!chosen?.parsed) {
    return undefined;
  }
  let project = projects.get(chosen.configPath);
  const isStale = project && project.configVersion !== fileVersion(chosen.configPath);
  if (!project || isStale) {
    project = createProject(ts, chosen.configPath, chosen.parsed);
    projects.set(chosen.configPath, project);
  }
  project.rootNames.add(file);
  return project;
}

function formatDiagnostic(ts, diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").split("\n");
  const head = message[0];
  const rest = message.slice(1, 4).map((line) => `      ${line.trim()}`);
  if (!diagnostic.file || diagnostic.start === undefined) {
    return [`TS${diagnostic.code}: ${head}`, ...rest];
  }
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const location = `${displayPath(diagnostic.file.fileName)}:${line + 1}:${character + 1}`;
  return [`${location} TS${diagnostic.code}: ${head}`, ...rest];
}

/**
 * Finds workspace packages this file's package consumes through their built `dist` whose `src` is newer than the
 * build, and returns one warning line per stale package. Also notes when the file itself is in such a package.
 */
function distWarnings(file, program) {
  const lines = [];
  const ownPackage = findUp(dirname(file), ["package.json"]);
  if (!ownPackage) {
    return lines;
  }
  const manifest = JSON.parse(readFileSync(ownPackage.path, "utf8"));
  const sourceFiles = program?.getSourceFiles().map((sourceFile) => sourceFile.fileName) ?? [];
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const [name, version] of Object.entries(dependencies)) {
    if (!String(version).startsWith("workspace:")) {
      continue;
    }
    let packageDir;
    try {
      packageDir = realpathSync(join(ownPackage.dir, "node_modules", name));
    } catch {
      continue;
    }
    const distDir = join(packageDir, "dist");
    const srcDir = join(packageDir, "src");
    const isUsedThroughDist = sourceFiles.some((path) => path.startsWith(`${distDir}/`));
    if (!isUsedThroughDist || !existsSync(srcDir)) {
      continue;
    }
    const srcNewest = newestMtime(
      srcDir,
      (path) => TS_EXTENSIONS.has(extname(path)) && !SPEC_PATTERN.test(path),
    );
    const distNewest = newestMtime(distDir);
    if (srcNewest > distNewest) {
      lines.push(
        `warning: ${name} src is newer than its dist, so this check sees the old build. ` +
          `Run: pnpm --filter ${name} build`,
      );
    }
  }
  const exportsDist = JSON.stringify(manifest.exports ?? manifest.main ?? "").includes("dist/");
  if (exportsDist && !file.includes("/dist/") && manifest.name) {
    lines.push(
      `note: other packages see changes to ${manifest.name} only after: pnpm --filter ${manifest.name} build`,
    );
  }
  return lines;
}

/**
 * Typechecks one file (and, for a spec, its subject file) against its tsconfig. Returns
 * `{ status: "pass" | "fail" | "skip", lines: string[] }`.
 */
export async function typecheckFile(file) {
  if (!TS_EXTENSIONS.has(extname(file)) || file.endsWith(".d.ts")) {
    return { status: "skip", lines: ["not a TypeScript source file"] };
  }
  const ts = await getTs();
  versionCache = new Map();
  const project = getProject(ts, file);
  if (!project) {
    return { status: "skip", lines: ["no tsconfig.json found above this file"] };
  }
  const subject = file.replace(SPEC_PATTERN, "$2");
  const files = [file];
  if (subject !== file && existsSync(subject)) {
    project.rootNames.add(subject);
    files.push(subject);
  }
  const lines = [`tsconfig: ${displayPath(project.configPath)}`];
  let errorCount = 0;
  for (const target of files) {
    const diagnostics = [
      ...project.service.getSyntacticDiagnostics(target),
      ...project.service.getSemanticDiagnostics(target),
    ];
    for (const diagnostic of diagnostics) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        errorCount += 1;
      }
      lines.push(...formatDiagnostic(ts, diagnostic));
    }
  }
  lines.push(...distWarnings(file, project.service.getProgram()));
  return { status: errorCount ? "fail" : "pass", lines };
}

/** Lists the tsconfig files with a warm LanguageService. */
export function typecheckProjects() {
  return [...projects.keys()].map(displayPath);
}
