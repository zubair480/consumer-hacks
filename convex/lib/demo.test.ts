/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { boxFor, eventTiming, isDemoFormUrl, parseSubmission, primaryAgentAction, DEMO_EVENT_TEXT } from "./demo";
import { buildRunRepoResult, planCommands, runRepoInSandbox, type Runner } from "./runRepo";

const SITE = "https://pleasant-lark-678.convex.site";
const NOW = Date.UTC(2026, 10, 15, 20);

describe("boxes and primary actions", () => {
  it("sorts content types into the six pull boxes", () => {
    expect(boxFor("github_repository")).toBe("code");
    expect(boxFor("application")).toBe("forms");
    expect(boxFor("scholarship")).toBe("forms");
    expect(boxFor("event")).toBe("events");
    expect(boxFor("job")).toBe("jobs");
    expect(boxFor("tutorial")).toBe("learn");
    expect(boxFor("restaurant")).toBe("other");
    expect(boxFor(undefined)).toBe("other");
  });
  it("leads Code, Forms and Events with their agent action", () => {
    expect(primaryAgentAction("github_repository")?.label).toBe("Run it for me");
    expect(primaryAgentAction("application")?.label).toBe("Fill it for me");
    expect(primaryAgentAction("event")?.label).toBe("Add to my calendar");
    expect(primaryAgentAction("recipe")).toBeNull();
  });
});

describe("isDemoFormUrl", () => {
  it("only allows our own /demo/apply", () => {
    expect(isDemoFormUrl(`${SITE}/demo/apply`, SITE)).toBe(true);
    expect(isDemoFormUrl(`${SITE}/demo/apply/`, SITE)).toBe(true);
    expect(isDemoFormUrl(`${SITE}/demo/submissions`, SITE)).toBe(false);
    expect(isDemoFormUrl("https://evil.example.com/demo/apply", SITE)).toBe(false);
    expect(isDemoFormUrl("http://pleasant-lark-678.convex.site/demo/apply", SITE)).toBe(false);
    expect(isDemoFormUrl("not a url", SITE)).toBe(false);
  });
});

describe("eventTiming", () => {
  it("uses the demo event's date, start time and end time", () => {
    expect(eventTiming([DEMO_EVENT_TEXT], undefined, NOW)).toEqual({ startDateTime: "2026-11-15T19:00:00", durationMinutes: 120 });
  });
  it("prefers the extracted date and reads a single start time", () => {
    expect(eventTiming(["Doors at 6:30 pm"], "2026-12-01", NOW)).toEqual({ startDateTime: "2026-12-01T18:30:00", durationMinutes: 60 });
  });
  it("reads 24h clock times", () => {
    expect(eventTiming(["Kickoff 2026-03-04 at 14:15"], undefined, NOW)).toEqual({ startDateTime: "2026-03-04T14:15:00", durationMinutes: 60 });
  });
  it("falls back to 09:00 only when no time is found, and leaves the date empty when none is found", () => {
    expect(eventTiming(["March 3, 2027 meetup"], undefined, NOW)).toEqual({ startDateTime: "2027-03-03T09:00:00", durationMinutes: 60 });
    expect(eventTiming(["Some meetup at 7pm"], undefined, NOW).startDateTime).toBe("");
  });
});

describe("parseSubmission", () => {
  it("reads the four fields and requires name and email", () => {
    expect(parseSubmission(new URLSearchParams("name=Ada+L&email=a%40b.co&phone=555&studying=CS"))).toEqual({ name: "Ada L", email: "a@b.co", phone: "555", studying: "CS" });
    expect(parseSubmission(new URLSearchParams("email=a%40b.co"))).toBeNull();
  });
});

describe("Run it for me on zapy-hello-world", () => {
  it("plans npm install then a bounded npm start for a dependency-free start script", () => {
    expect(planCommands("node", { pkg: { scripts: { start: "node index.js" } }, hasLockfile: false }).map((s) => s.command)).toEqual([
      "npm install --no-audit --no-fund",
      "timeout 30 npm start",
    ]);
  });

  it("clones the demo repo, runs it, and the stored result output contains Hello World", async () => {
    const commands: string[] = [];
    const runner: Runner = async (command) => {
      commands.push(command);
      const ok = (stdout = "") => ({ command, exitCode: 0, stdout, stderr: "", durationMs: 10 });
      if (command.startsWith("ls -1a")) {
        return ok('.\n..\nREADME.md\nindex.js\npackage.json\n---PKG---\n{ "name": "zapy-hello-world", "version": "1.0.0", "private": true, "scripts": { "start": "node index.js" } }\n---README---\n# zapy-hello-world');
      }
      if (command === "timeout 30 npm start") return ok("> zapy-hello-world@1.0.0 start\n> node index.js\n\nHello World\n");
      return ok();
    };
    const report = await runRepoInSandbox(runner, "https://github.com/zubair480/zapy-hello-world");
    expect(commands[0]).toBe("git clone --depth 1 https://github.com/zubair480/zapy-hello-world.git /home/user/repo");
    expect(commands).toContain("npm install --no-audit --no-fund");
    expect(commands).toContain("timeout 30 npm start");
    const result = buildRunRepoResult(report);
    expect(result.title).toBe("Passed: Start succeeded");
    const output = result.sections.find((s) => s.kind === "code" && s.heading === "Output");
    expect(output && output.kind === "code" ? output.code : "").toContain("Hello World");
  });
});
