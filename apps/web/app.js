// Plain vanilla JS, no build step, no shared-types import — this frontend
// hand-parses the raw JSON events off the WebSocket, matching the
// architecture doc's stated demo-scope simplification.

const startBtn = document.getElementById("start-btn");
const statusEl = document.getElementById("status");
const cardsA = document.getElementById("cards-a");
const cardsB = document.getElementById("cards-b");
const roundNumberEl = document.getElementById("round-number");
const gapNumberEl = document.getElementById("gap-number");
const needleEl = document.getElementById("scale-needle");
const convergingEl = document.getElementById("converging-indicator");
const verdictStrip = document.getElementById("verdict-strip");

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` status-${kind}` : "");
}

function resetLedger() {
  cardsA.innerHTML = "";
  cardsB.innerHTML = "";
  roundNumberEl.textContent = "–";
  gapNumberEl.textContent = "–";
  needleEl.style.left = "0%";
  convergingEl.textContent = "";
  verdictStrip.hidden = true;
  verdictStrip.className = "verdict-strip";
  verdictStrip.textContent = "";
}

function renderProposalCard(proposal) {
  const container = proposal.agentId === "agent-a" ? cardsA : cardsB;

  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card-header";

  const roundLabel = document.createElement("span");
  roundLabel.textContent = `Round ${proposal.round}`;

  const actionLabel = document.createElement("span");
  actionLabel.className = `card-action card-action-${proposal.action}`;
  actionLabel.textContent = proposal.action;

  header.appendChild(roundLabel);
  header.appendChild(actionLabel);

  const share = document.createElement("div");
  share.className = "card-share";
  share.textContent = `${proposal.terms.agentShare}% / ${proposal.terms.counterpartyShare}%`;

  const rationale = document.createElement("p");
  rationale.className = "card-rationale";
  rationale.textContent = proposal.rationale;

  card.appendChild(header);
  card.appendChild(share);
  card.appendChild(rationale);
  container.prepend(card);
}

function renderVerdict(verdict) {
  roundNumberEl.textContent = String(verdict.round);
  gapNumberEl.textContent = verdict.gap.toFixed(1);

  // Map gap onto the 0-100% track, with 0-50 spread across the full width
  // so small demo-scale gaps are still visually legible.
  const needlePosition = Math.min(Math.max(verdict.gap, 0), 50) * 2;
  needleEl.style.left = `${needlePosition}%`;

  convergingEl.textContent = verdict.converging ? "converging" : "not converging yet";
}

function renderTerminal(kind, text) {
  verdictStrip.hidden = false;
  verdictStrip.className = `verdict-strip verdict-${kind}`;
  verdictStrip.textContent = text;
}

function handleEvent(event) {
  switch (event.type) {
    case "round_started":
      roundNumberEl.textContent = String(event.round);
      break;
    case "proposal":
      renderProposalCard(event.proposal);
      break;
    case "verdict":
      renderVerdict(event.verdict);
      break;
    case "settled":
      renderTerminal(
        "settled",
        `Settled in round ${event.round}: ${event.finalTerms.agentShare.toFixed(1)}% / ${event.finalTerms.counterpartyShare.toFixed(1)}%${
          event.reason ? ` — ${event.reason}` : ""
        }`,
      );
      setStatus("settled", "connected");
      break;
    case "deadlock":
      renderTerminal("deadlock", `Deadlock in round ${event.round}: ${event.reason}`);
      setStatus("deadlock", "error");
      break;
    default:
      console.warn("Unknown event type", event);
  }
}

async function startNegotiation() {
  startBtn.disabled = true;
  resetLedger();
  setStatus("starting…");

  try {
    const response = await fetch("/negotiations", { method: "POST" });
    if (!response.ok) throw new Error(`POST /negotiations failed: ${response.status}`);
    const { id } = await response.json();

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/negotiations/${id}/stream`);

    ws.addEventListener("open", () => setStatus("connected", "connected"));
    ws.addEventListener("message", (msg) => {
      try {
        handleEvent(JSON.parse(msg.data));
      } catch (err) {
        console.error("Failed to parse negotiation event", err);
      }
    });
    ws.addEventListener("close", () => {
      startBtn.disabled = false;
    });
    ws.addEventListener("error", () => {
      setStatus("connection error", "error");
    });
  } catch (err) {
    console.error(err);
    setStatus("failed to start", "error");
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", startNegotiation);
