/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Proposal } from "@negotiator/shared-types";
import { AgentColumn } from "./AgentColumn";
import { ConvergenceScale } from "./ConvergenceScale";
import { ProposalCard } from "./ProposalCard";
import { TopBar } from "./TopBar";
import { VerdictStrip } from "./VerdictStrip";

function proposal(round: number, action: Proposal["action"] = "propose"): Proposal {
  return {
    agentId: "agent-a",
    round,
    terms: { agentShare: 62, counterpartyShare: 38 },
    rationale: `rationale for round ${round}`,
    action,
  };
}

describe("ProposalCard", () => {
  test("renders round, action, shares and rationale", () => {
    const html = renderToStaticMarkup(<ProposalCard proposal={proposal(3, "accept")} />);
    expect(html).toContain("<span>Round 3</span>");
    expect(html).toContain('class="card-action card-action-accept"');
    expect(html).toContain('<div class="card-share">62% / 38%</div>');
    expect(html).toContain("rationale for round 3");
  });
});

describe("AgentColumn", () => {
  test("renders its label, floor note and one card per proposal in the given order", () => {
    const html = renderToStaticMarkup(
      <AgentColumn columnId="column-a" label="Agent A" floorNote="(55% floor)" proposals={[proposal(2), proposal(1)]} />,
    );
    expect(html).toContain('id="column-a"');
    expect(html).toContain('aria-label="Agent A"');
    expect(html).toContain("(55% floor)");
    expect(html.match(/class="card"/g)).toHaveLength(2);
    expect(html.indexOf("rationale for round 2")).toBeLessThan(html.indexOf("rationale for round 1"));
  });
});

describe("ConvergenceScale", () => {
  test("shows placeholders before any verdict", () => {
    const html = renderToStaticMarkup(<ConvergenceScale round={null} gap={null} converging={null} />);
    expect(html.match(/–/g)).toHaveLength(2);
    expect(html).toContain('style="left:0%"');
    expect(html).toContain('<div class="scale-converging"></div>');
  });

  test("formats the gap and positions the needle at 2x the gap", () => {
    const html = renderToStaticMarkup(<ConvergenceScale round={2} gap={12.34} converging={true} />);
    expect(html).toContain("12.3");
    expect(html).toContain('style="left:24.68%"');
    expect(html).toContain("converging");
  });

  test("clamps the needle to the track", () => {
    expect(renderToStaticMarkup(<ConvergenceScale round={1} gap={80} converging={false} />)).toContain(
      'style="left:100%"',
    );
    expect(renderToStaticMarkup(<ConvergenceScale round={1} gap={80} converging={false} />)).toContain(
      "not converging yet",
    );
  });
});

describe("TopBar", () => {
  test("renders status with its kind class and an enabled start button when idle", () => {
    const html = renderToStaticMarkup(<TopBar statusText="idle" statusKind="idle" busy={false} onStart={mock()} />);
    expect(html).toContain('class="status status-idle"');
    expect(html).not.toContain("disabled");
  });

  test("disables the start button while busy", () => {
    const html = renderToStaticMarkup(<TopBar statusText="connected" statusKind="connected" busy onStart={mock()} />);
    expect(html).toContain('disabled=""');
  });
});

describe("VerdictStrip", () => {
  test("is hidden with no terminal verdict", () => {
    expect(renderToStaticMarkup(<VerdictStrip terminal={null} />)).toBe(
      '<footer class="verdict-strip" hidden=""></footer>',
    );
  });

  test("renders the terminal text with its kind class", () => {
    expect(renderToStaticMarkup(<VerdictStrip terminal={{ kind: "deadlock", text: "stuck" }} />)).toBe(
      '<footer class="verdict-strip verdict-deadlock">stuck</footer>',
    );
  });
});
