import type { ActionResultDocument, ResultSection } from "../../src/shared/contracts";

// Agent mode: plan and shape a "Run it for me" sandbox run. Pure logic, so the
// E2B wiring in convex/agentMode.ts stays thin and this stays testable.

export const LOG_TAIL_CHARS = 6000;
export const REPO_DIR = "/home/user/repo";

export type CommandOutcome = { command: string; exitCode: number; stdout: string; stderr: string; durationMs: number };

/** Runs a shell command in the sandbox and never throws on a non-zero exit or timeout. */
export type Runner = (command: string, opts?: { cwd?: string; timeoutMs?: number }) => Promise<CommandOutcome>;

export type RepoKind = "node" | "python" | "unknown";

export function parseRepo(url: string | undefined): { owner: string; name: string; cloneUrl: string } | null {
  const match = url?.match(/^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) return null;
  const [, owner, name] = match;
  return { owner, name, cloneUrl: `https://github.com/${owner}/${name}.git` };
}

export function tail(text: string, max = LOG_TAIL_CHARS): string {
  return text.length <= max ? text : `…(truncated)\n${text.slice(text.length - max)}`;
}

export function firstPythonBlock(readme: string): string | null {
  const match = readme.match(/```(?:python|py)\s*\n([\s\S]*?)```/i);
  return match?.[1]?.trim() || null;
}

type Pkg = { scripts?: Record<string, string>; main?: string };

const NO_TEST = /no test specified/i;

/** The commands to run after cloning, chosen from the repo's files. */
export function planCommands(kind: RepoKind, files: { pkg?: Pkg; hasLockfile?: boolean; hasRequirements?: boolean; hasPytest?: boolean; readme?: string }): { label: string; command: string; timeoutMs: number }[] {
  if (kind === "node") {
    const pkg = files.pkg ?? {};
    const steps = [{ label: "Install", command: files.hasLockfile ? "npm ci --no-audit --no-fund" : "npm install --no-audit --no-fund", timeoutMs: 150_000 }];
    if (pkg.scripts?.test && !NO_TEST.test(pkg.scripts.test)) steps.push({ label: "Test", command: "npm test", timeoutMs: 90_000 });
    else if (pkg.scripts?.start) steps.push({ label: "Start", command: "timeout 30 npm start", timeoutMs: 40_000 });
    else if (pkg.main) steps.push({ label: "Load main", command: `node -e "require('./')" && echo "Loaded ${pkg.main}"`, timeoutMs: 30_000 });
    return steps;
  }
  if (kind === "python") {
    const steps: { label: string; command: string; timeoutMs: number }[] = [];
    if (files.hasRequirements) steps.push({ label: "Install", command: "pip install -q -r requirements.txt", timeoutMs: 150_000 });
    else steps.push({ label: "Install", command: "pip install -q . || true", timeoutMs: 150_000 });
    const example = files.readme ? firstPythonBlock(files.readme) : null;
    if (files.hasPytest) steps.push({ label: "Test", command: "pip install -q pytest && python -m pytest -q", timeoutMs: 90_000 });
    else if (example) steps.push({ label: "README example", command: `python - <<'ZAPY_EOF'\n${example}\nZAPY_EOF`, timeoutMs: 60_000 });
    return steps;
  }
  return [];
}

export type RunReport = {
  repo: { owner: string; name: string; url: string };
  kind: RepoKind;
  clone: CommandOutcome;
  steps: { label: string; outcome: CommandOutcome }[];
  files: string[];
};

/** Clones, detects, and runs the repo through runner. Never throws on a failing command. */
export async function runRepoInSandbox(runner: Runner, sourceUrl: string): Promise<RunReport> {
  const repo = parseRepo(sourceUrl);
  if (!repo) throw new Error("Not a GitHub repository URL");
  const url = `https://github.com/${repo.owner}/${repo.name}`;
  const clone = await runner(`git clone --depth 1 ${repo.cloneUrl} ${REPO_DIR}`, { timeoutMs: 60_000 });
  if (clone.exitCode !== 0) return { repo: { ...repo, url }, kind: "unknown", clone, steps: [], files: [] };

  const probe = await runner(
    "ls -1a; echo '---PKG---'; cat package.json 2>/dev/null; echo '---README---'; cat README.md README.rst readme.md 2>/dev/null | head -c 20000",
    { cwd: REPO_DIR, timeoutMs: 15_000 },
  );
  const [listing = "", rest = ""] = probe.stdout.split("---PKG---");
  const [pkgText = "", readme = ""] = rest.split("---README---");
  const names = new Set(listing.split("\n").map((s) => s.trim()).filter(Boolean));
  let pkg: Pkg | undefined;
  try {
    pkg = pkgText.trim() ? (JSON.parse(pkgText) as Pkg) : undefined;
  } catch {
    pkg = undefined;
  }
  const kind: RepoKind = names.has("package.json")
    ? "node"
    : ["requirements.txt", "setup.py", "pyproject.toml"].some((f) => names.has(f))
      ? "python"
      : "unknown";
  const plan = planCommands(kind, {
    pkg,
    hasLockfile: names.has("package-lock.json") || names.has("npm-shrinkwrap.json"),
    hasRequirements: names.has("requirements.txt"),
    hasPytest: names.has("tests") || names.has("test") || names.has("pytest.ini") || names.has("conftest.py"),
    readme,
  });
  const steps: RunReport["steps"] = [];
  for (const step of plan) {
    const outcome = await runner(step.command, { cwd: REPO_DIR, timeoutMs: step.timeoutMs });
    steps.push({ label: step.label, outcome });
    if (step.label === "Install" && outcome.exitCode !== 0 && kind === "node") break;
  }
  const listed = await runner("git status --porcelain --untracked-files=all | grep -v node_modules | head -40", { cwd: REPO_DIR, timeoutMs: 15_000 });
  const files = listed.stdout
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
  return { repo: { ...repo, url }, kind, clone, steps, files };
}

/** The verdict: did the repo's own check pass? */
export function verdictOf(report: RunReport): { passed: boolean; label: string } {
  if (report.clone.exitCode !== 0) return { passed: false, label: "Could not clone" };
  if (report.kind === "unknown") return { passed: false, label: "No Node or Python project found" };
  const last = report.steps[report.steps.length - 1];
  if (!last) return { passed: false, label: "Nothing to run" };
  if (last.outcome.exitCode === 0) return { passed: true, label: last.label === "Test" ? "Tests passed" : `${last.label} succeeded` };
  return { passed: false, label: last.label === "Test" ? "Tests failed" : `${last.label} failed` };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** The ActionResultDocument for a finished run. Always a result, even when the repo's tests fail. */
export function buildRunRepoResult(report: RunReport): ActionResultDocument {
  const verdict = verdictOf(report);
  const all = [{ label: "Clone", outcome: report.clone }, ...report.steps];
  const output = all.map((s) => `$ ${s.outcome.command}\n${s.outcome.stdout}`).join("\n");
  const errors = all
    .filter((s) => s.outcome.stderr.trim())
    .map((s) => `$ ${s.outcome.command}\n${s.outcome.stderr}`)
    .join("\n");
  const sections: ResultSection[] = [
    {
      kind: "key_value",
      heading: "Run",
      rows: [
        { label: "Repository", value: `${report.repo.owner}/${report.repo.name}` },
        { label: "Project", value: report.kind === "unknown" ? "Not detected" : report.kind === "node" ? "Node.js" : "Python" },
        { label: "Verdict", value: verdict.label, status: verdict.passed ? "met" : "unmet" },
        { label: "Time", value: seconds(all.reduce((sum, s) => sum + s.outcome.durationMs, 0)) },
      ],
    },
    {
      kind: "steps",
      heading: "Steps",
      steps: all.map((s) => ({
        title: `${s.label}: ${s.outcome.exitCode === 0 ? "ok" : `exit ${s.outcome.exitCode}`} (${seconds(s.outcome.durationMs)})`,
        code: s.outcome.command.split("\n")[0],
        checked: s.outcome.exitCode === 0,
      })),
    },
    { kind: "code", heading: "Output", language: "text", code: tail(output) || "(no output)" },
  ];
  if (errors.trim()) sections.push({ kind: "code", heading: "Errors", language: "text", code: tail(errors) });
  if (report.files.length) sections.push({ kind: "list", heading: "Generated files", items: report.files });
  const summary = `Ran ${report.repo.owner}/${report.repo.name} in a fresh cloud sandbox: ${verdict.label.toLowerCase()}.`;
  return {
    version: 1,
    actionType: "run_repo",
    title: `${verdict.passed ? "Passed" : "Failed"}: ${verdict.label}`,
    summary,
    sections,
    sources: [{ label: "GitHub repository", url: report.repo.url }],
    shareText: `${summary}\n\n${tail(output, 1500)}`,
    warnings: verdict.passed ? [] : ["The repository's own command did not succeed. See Output and Errors for details."],
  };
}
