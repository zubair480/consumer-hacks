import type { ResultSection } from "../../../src/shared/contracts";
import { buildDocument, composeDocument, itemBlocks, sourcesFromBlocks } from "./document";
import { fetchGithubRepo, type GithubRepo } from "./sources";
import { ExecutorError, type Executor, type ExecutorInput, type SourceBlock } from "./types";

// OWNER: D+E. Priority 2: GitHub repository explanation.

async function repoContext(input: ExecutorInput, needReadme: boolean): Promise<{ repo: GithubRepo; blocks: SourceBlock[]; warnings: string[] }> {
  const url = input.item.sourceUrl;
  const repo = url ? await fetchGithubRepo(url) : null;
  if (!repo) throw new ExecutorError("Couldn't load this repository from GitHub. Check the link is a public repository.");
  const warnings: string[] = [];
  if (!repo.readme && !needReadme) warnings.push("This repository has no README; the explanation uses repository metadata only.");
  const meta = [
    `Repository: ${repo.fullName}`,
    repo.description ? `Description: ${repo.description}` : "",
    repo.language ? `Primary language: ${repo.language}` : "",
    repo.topics.length ? `Topics: ${repo.topics.join(", ")}` : "",
    repo.homepage ? `Homepage: ${repo.homepage}` : "",
    repo.license ? `License: ${repo.license}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const blocks: SourceBlock[] = [{ label: "GitHub repository metadata", source: repo.url, url: repo.url, text: meta }];
  if (repo.readme) blocks.push({ label: "README", source: repo.readmeUrl ?? repo.url, url: repo.readmeUrl ?? repo.url, text: repo.readme });
  blocks.push(...itemBlocks(input).filter((b) => b.source === "user_text"));
  return { repo, blocks, warnings };
}

function metaSection(repo: GithubRepo): ResultSection {
  const ev = { quote: repo.fullName, source: repo.url };
  const rows: { label: string; value: string; evidence: typeof ev }[] = [
    { label: "Repository", value: repo.fullName, evidence: ev },
  ];
  if (repo.stars !== null) rows.push({ label: "Stars", value: repo.stars.toLocaleString("en-US"), evidence: ev });
  if (repo.language) rows.push({ label: "Language", value: repo.language, evidence: ev });
  if (repo.license) rows.push({ label: "License", value: repo.license, evidence: ev });
  if (repo.pushedAt) rows.push({ label: "Last push", value: repo.pushedAt.slice(0, 10), evidence: ev });
  if (repo.topics.length) rows.push({ label: "Topics", value: repo.topics.slice(0, 6).join(", "), evidence: ev });
  return { kind: "key_value", heading: "At a glance (GitHub)", rows };
}

function repoLinks(repo: GithubRepo): ResultSection {
  const links = [{ label: "Repository", url: repo.url }];
  if (repo.homepage && /^https?:\/\//.test(repo.homepage)) links.push({ label: "Homepage / docs", url: repo.homepage });
  return { kind: "links", heading: "Links", links };
}

const understandProject: Executor = async (input) => {
  const { repo, blocks, warnings } = await repoContext(input, false);
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    title: `Understand ${repo.fullName}`,
    prepend: [metaSection(repo)],
    append: [repoLinks(repo)],
    instruction: `Explain this GitHub repository to a developer who just bookmarked it.
1. "text" headed "What it is": 2-3 plain sentences on what it does and who it is for.
2. "text" headed "Who it's for": the audience, based on the README.
3. "list" headed "Key features": 3-6 features the README actually describes.
4. "text" headed "How it's built": languages, frameworks, architecture, as stated in the README/metadata.
5. "list" headed "Good fit when": 2-4 use cases (guidance; no evidence needed).
6. "key_value" headed "Requirements" for runtime/version requirements ONLY if the README states them, each with evidence.
The "summary" is one sentence a non-expert understands.`,
  });
  return { result, status: "succeeded" };
};

function noSetupGuide(input: ExecutorInput, repo: GithubRepo, blocks: SourceBlock[], reason: string) {
  return composeDocument(
    "extract_setup_guide",
    `Set up ${repo.fullName}`,
    reason,
    [{ kind: "text", heading: "No setup steps in the README", body: `${reason} AfterScroll only extracts setup steps the README states, so none are listed. Check the repository's docs or homepage.` }, repoLinks(repo)],
    sourcesFromBlocks(input, blocks),
    [reason],
  );
}

const extractSetupGuide: Executor = async (input) => {
  const { repo, blocks, warnings } = await repoContext(input, true);
  if (!repo.readme) return { result: noSetupGuide(input, repo, blocks, "This repository has no README."), status: "succeeded" };
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    verifyCode: true,
    strictRows: true,
    title: `Set up ${repo.fullName}`,
    append: [repoLinks(repo)],
    instruction: `Turn the README's installation / getting-started / usage instructions into a step-by-step setup guide.
1. "key_value" headed "Prerequisites": tools and versions the README requires, each with evidence.
2. "steps" headed "Setup": ordered steps. Put commands in "code" copied EXACTLY character-for-character from the README (code lines not in the README are deleted). Do not invent commands, flags, file names, or env vars.
3. "steps" headed "First run" for a minimal usage example from the README if one exists.
If the README has no setup instructions, return no steps and say so in warnings.`,
  });
  if (!result.sections.some((s) => s.kind === "steps")) {
    return { result: noSetupGuide(input, repo, blocks, "The README doesn't include setup instructions."), status: "succeeded" };
  }
  return { result, status: "succeeded" };
};

const prepareIntegrationPlan: Executor = async (input) => {
  const { repo, blocks, warnings } = await repoContext(input, false);
  const project = input.inputs.your_project?.trim();
  if (!project) warnings.push("Tell AfterScroll about your project (stack, goal) for a more specific plan.");
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    verifyCode: true,
    title: `Integrate ${repo.fullName}`,
    append: [repoLinks(repo)],
    instruction: `Prepare a plan for using this repository in the user's own project${project ? `: "${project}"` : " (unspecified; keep it general)"}.
1. "text" headed "Fit": does it fit, and what role would it play.
2. "steps" headed "Integration plan": 4-7 concrete steps. Only include "code" when copied exactly from the README (install command, import, minimal usage); otherwise describe in words.
3. "list" headed "Risks and checks": license, maintenance, compatibility questions to verify (guidance).
4. "key_value" headed "From the README" for license, supported platforms, versions, each with evidence.`,
  });
  return { result, status: "succeeded" };
};

export const githubExecutors = {
  understand_project: understandProject,
  extract_setup_guide: extractSetupGuide,
  prepare_integration_plan: prepareIntegrationPlan,
};
