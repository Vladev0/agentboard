/**
 * Promo demo project — "Project Indra": a speculative-but-grounded quantum biology
 * moonshot, written to be screenshotted for Twitter/Threads/GitHub. Real citations,
 * real research-culture texture (grant-speak, IRB bureaucracy, Bell-test loopholes),
 * two tasks flagged `blocked` to showcase the needs-input mechanic, nothing forced
 * to Done just for tidiness.
 */
import { createProject } from "./project.js";
import { addComment, createSubtask, createTask, setBlocked, updateDescription, updateStatus } from "./task.js";
import { getVaultRoot } from "./vault.js";

function seed(): void {
  const vaultRoot = getVaultRoot();

  const p = createProject(vaultRoot, "Project Indra", {
    key: "IND",
    labels: ["theory", "hardware", "experiment", "ethics", "grant"],
  });

  const t1 = createTask(vaultRoot, p.slug, {
    title: "Mission brief: the Indra Hypothesis",
    priority: "high",
    labels: ["theory"],
    order: 5,
    description: `We start from an uncomfortable fact: nobody has ever fully explained why room-temperature biological systems show quantum-like behavior at all, and a small but serious literature (Fröhlich 1968; Engel et al. 2007 on the FMO photosynthetic complex; Hore & Mouritsen 2016 on the avian radical-pair compass) says some of them clearly do.

The Penrose-Hameroff Orch-OR model goes further and proposes that microtubules — the structural lattices inside every neuron — host organized quantum states that survive long enough to matter for cognition. Most physicists remain skeptical, for good reason: decoherence times in a warm, wet, noisy cell should be femtoseconds, not the milliseconds neural computation would need.

Bandyopadhyay's 2013-2024 conductance measurements are the closest thing to a crack in that skepticism: resonant, temperature-stable conductance peaks in isolated microtubule bundles that don't have an obvious classical explanation yet. We are not claiming this settles anything. We are claiming it's worth a modest grant to find out whether it's noise, an artifact, or something that deserves a much bigger grant.

The escalation, if the early data holds: if the phosphate-vibron lattice inside one neuron's microtubules can sustain entangled states, there's no principled reason a lattice grown outside a neuron — in a dish, wired to a receiver — couldn't in principle correlate with them too. That's the Indra Hypothesis, named for Indra's Net: every node in the web reflecting every other. It's a metaphor until, possibly, it isn't.

Goal of this project: build the smallest instrument that could tell the difference between "elegant metaphor" and "measurable effect." Everything below is in service of that one falsifiable question.`,
  });
  updateStatus(vaultRoot, p.slug, t1.id, "done");
  updateDescription(
    vaultRoot,
    p.slug,
    t1.id,
    `${t1.description}\n\nEdit after journal club: to be unambiguous, nothing above is a result. It is a hypothesis we think is cheap enough to test properly and interesting enough to be worth the embarrassment if it's wrong.`,
    "Softened the framing after journal club pushback — v1 read like we already had signal. We don't. Added an explicit closing line so nobody downstream mistakes the pitch for a finding."
  );
  addComment(vaultRoot, p.slug, t1.id, "This is a great pitch. Make sure it stays a pitch and doesn't quietly turn into a conclusion three months from now.", "human");
  addComment(vaultRoot, p.slug, t1.id, "Noted. Falsifiability framework is tracked separately in IND-18 for exactly this reason.", "agent");

  const t2 = createTask(vaultRoot, p.slug, {
    title: "Literature synthesis: Orch-OR, Fröhlich condensates & the warm-coherence loophole",
    priority: "medium",
    labels: ["theory"],
    order: 10,
    description: "Annotated synthesis of the warm quantum biology literature: Fröhlich condensates, FMO photosynthetic energy transfer, avian cryptochrome radical pairs, and the Orch-OR decoherence-time objections (Tegmark 2000) alongside the rebuttals (Hagan, Hameroff & Tuszynski 2002). Used as the shared citation base for everything downstream.",
  });
  updateStatus(vaultRoot, p.slug, t2.id, "done");

  const t3 = createTask(vaultRoot, p.slug, {
    title: "Replicate Bandyopadhyay (2024) anomalous microtubule conductance",
    priority: "high",
    labels: ["experiment"],
    order: 20,
    description: "Attempted replication of the reported anomalous conductance peaks in isolated bovine-brain microtubule bundles, using our own SQUID pickup and shielded low-noise preamp chain (see IND-10).",
  });
  updateStatus(vaultRoot, p.slug, t3.id, "done");
  updateDescription(
    vaultRoot,
    p.slug,
    t3.id,
    "Attempted replication of the reported anomalous conductance peaks in isolated bovine-brain microtubule bundles, using our own SQUID pickup and shielded low-noise preamp chain (see IND-10).\n\nResult: replicated the 8.5 MHz peak across 6 of 7 samples, stable across three days of remeasurement. Did not cleanly replicate the reported 41 MHz peak — amplitude dropped ~30% with the building ventilation fan off, but didn't disappear. Logging the 41 MHz peak as an open question rather than a finding either way.",
    "Partial replication: the 8.5 MHz peak looks real and repeatable. The 41 MHz peak is partly (not fully) explained by the ventilation fan — chasing the remainder in the new shielded chamber (IND-11) before calling it either way."
  );
  addComment(vaultRoot, p.slug, t3.id, "Did we control for the fan?", "human");
  addComment(vaultRoot, p.slug, t3.id, "We did, after you asked — see the updated description. Turning it off dropped the 41 MHz peak's amplitude by about 30% but didn't kill it. So: partially the fan, partially something else. Following up once the new Faraday chamber is signed off.", "agent");

  const t4 = createTask(vaultRoot, p.slug, {
    title: "Formalize the phosphate-vibron coherence hypothesis for GTP-bound tubulin lattices",
    priority: "medium",
    labels: ["theory"],
    order: 30,
    description: "Working theoretical note: GTP hydrolysis at the tubulin dimer's phosphate-binding pocket as a candidate energy source for sustaining coherent lattice vibrations, structured on the same superradiance mechanism Bandyopadhyay's group proposed for tryptophan networks. Falls apart if the coherence time estimate in section 3 is off by more than one order of magnitude — flagged for review before anyone cites it externally.",
  });
  updateStatus(vaultRoot, p.slug, t4.id, "done");

  const t5 = createTask(vaultRoot, p.slug, {
    title: "Source isotopically pure lab-grown tubulin dimers (>99.2%)",
    priority: "high",
    labels: ["hardware"],
    order: 40,
    description: "Need enough isotopically clean tubulin to run the full chamber A/B comparison without impurity signal contaminating the conductance measurements.",
  });
  updateStatus(vaultRoot, p.slug, t5.id, "done");
  createSubtask(vaultRoot, p.slug, t5.id, {
    title: "Vet three biotech suppliers for isotopic purity",
    order: 41,
  });
  const t5b = createSubtask(vaultRoot, p.slug, t5.id, {
    title: "Negotiate sourcing NDA with Supplier B",
    order: 42,
  });
  const t5c = createSubtask(vaultRoot, p.slug, t5.id, {
    title: "QC batch #7 — reject, contaminated with MAP2 protein",
    order: 43,
  });
  updateStatus(vaultRoot, p.slug, t5b.id, "done");
  updateStatus(vaultRoot, p.slug, t5c.id, "done");

  const t9 = createTask(vaultRoot, p.slug, {
    title: "Design cryogen-free lattice scaffold (operating range 4-37°C)",
    priority: "high",
    labels: ["hardware"],
    order: 50,
    description: "Structural scaffold to hold a tubulin lattice at physiological-adjacent temperatures without liquid helium or nitrogen — the entire point is that this has to work warm, or it's just another dilution-fridge qubit experiment with extra steps.",
  });
  updateStatus(vaultRoot, p.slug, t9.id, "in_progress");

  const t10 = createTask(vaultRoot, p.slug, {
    title: "Build low-noise SQUID array for flux readout",
    priority: "medium",
    labels: ["hardware"],
    order: 60,
    description: "Superconducting quantum interference device array for picking up the microtubule lattice's magnetic flux signature without swamping it in our own instrument noise. Target noise floor: below 5 fT/√Hz.",
  });
  updateStatus(vaultRoot, p.slug, t10.id, "in_progress");

  const t11 = createTask(vaultRoot, p.slug, {
    title: "Fabricate Faraday-shielded biocompatible sample chamber",
    priority: "high",
    labels: ["hardware"],
    order: 70,
    description: "Welded copper-mesh shield (>100 dB attenuation, 10 kHz-1 GHz), Peltier loop holding 4-37°C without introducing detectable EM ripple at the sample position. Passed internal leakage test three times running.",
  });
  updateStatus(vaultRoot, p.slug, t11.id, "in_review");
  addComment(
    vaultRoot,
    p.slug,
    t11.id,
    "Chamber's ready for sign-off before we move live samples in. Wanted a second set of eyes on the shielding numbers before committing tubulin batch #9 to it — that batch took three weeks to grow and we don't get a second one soon.",
    "agent"
  );

  const t12 = createTask(vaultRoot, p.slug, {
    title: "Design double-slit-analog entanglement protocol across paired lattices",
    priority: "high",
    labels: ["experiment"],
    order: 80,
    description: "Measurement protocol for testing correlation between two isolated tubulin lattices (Chamber A / Chamber B) using photon-tagged readout events, structured so the result can feed directly into a CHSH Bell-inequality calculation (IND-15).",
  });
  updateStatus(vaultRoot, p.slug, t12.id, "in_progress");
  const t13 = createSubtask(vaultRoot, p.slug, t12.id, { title: "Simulate expected coherence decay curve", order: 81 });
  updateStatus(vaultRoot, p.slug, t13.id, "done");
  createSubtask(vaultRoot, p.slug, t12.id, { title: "Select decoherence-free subspace encoding", order: 82 });

  const t15 = createTask(vaultRoot, p.slug, {
    title: "CHSH Bell-inequality test across paired microtubule samples",
    priority: "urgent",
    labels: ["experiment"],
    order: 90,
    description: `Running a CHSH-style Bell inequality test across two isolated tubulin lattices (Chamber A / Chamber B, see IND-11), correlating photon-tagged readout events.

Current status is the reason this card is flagged: on odd-numbered experimental runs we measure S = 2.83 ± 0.04 — statistically indistinguishable from Tsirelson's bound, the theoretical maximum for genuine quantum entanglement. On even-numbered runs, S drops to 1.1 ± 0.3 — pure noise, no correlation at all.

Three hypotheses on the table:
1. Genuine signal, gated by something we're toggling between runs without meaning to (most likely: chamber swap order, see below).
2. An artifact of our own randomization procedure — Bell tests are notoriously easy to fool yourself with this way (the "freedom of choice" loophole) if the measurement settings aren't actually random.
3. Correlated environmental noise doing a very good impression of entanglement on alternating runs, for reasons unrelated to tubulin at all.

Needs a human call: do we (a) bring in an outside statistician blind to our hypothesis to re-audit the randomization before spending more beam time, or (b) just relocate the whole rig away from the break room — odd runs happen to line up with Tuesday/Thursday, when Facilities runs the building's water chiller. Both are cheap. Neither is obviously right. Not comfortable guessing on this one.`,
  });
  updateStatus(vaultRoot, p.slug, t15.id, "in_progress");
  setBlocked(vaultRoot, p.slug, t15.id, true);
  addComment(vaultRoot, p.slug, t15.id, "Water chiller. Definitely rule out the water chiller before you page a statistician.", "human");
  addComment(vaultRoot, p.slug, t15.id, "Fair — moving the rig Thursday. Will report back before touching the randomization code either way.", "agent");

  createTask(vaultRoot, p.slug, {
    title: "Cross-reference entanglement fidelity against ambient 60Hz mains hum",
    priority: "low",
    labels: ["experiment"],
    order: 100,
    blockedBy: [t15.id],
    description: "Once IND-15's result is trustworthy either way, check whether fidelity tracks the building's mains frequency — a clean way to rule in or out mundane electrical pickup as the correlated-noise explanation.",
  });

  const t17 = createTask(vaultRoot, p.slug, {
    title: "Prototype passive receiver array (working title: \"the Antenna\")",
    priority: "medium",
    labels: ["hardware", "theory"],
    order: 110,
    description: "If IND-15 holds up: a passive array tuned to the same phosphate-vibron resonance band, with no active transmitter of its own, to test whether it picks up anything correlated with a paired lattice at range. Explicitly gated on IND-15 resolving — no point building the antenna for a signal we haven't confirmed exists yet.",
  });
  updateStatus(vaultRoot, p.slug, t17.id, "todo");

  const t18 = createTask(vaultRoot, p.slug, {
    title: "Draft falsifiability framework for \"shared knowledge access\" claims",
    priority: "high",
    labels: ["theory", "ethics"],
    order: 120,
    description: "Before this program produces a headline it can't take back, we need a written-in-advance answer to: what specific, pre-registered result would we accept as evidence, and what result would we accept as this not working? Popperian discipline applied to a genuinely exciting hypothesis is exactly where research programs like this usually go wrong.",
  });
  updateStatus(vaultRoot, p.slug, t18.id, "in_progress");
  addComment(vaultRoot, p.slug, t18.id, "If the device ever starts answering questions about our own research budget, treat that as a red flag, not a milestone.", "agent");
  addComment(vaultRoot, p.slug, t18.id, "Putting that sentence directly into the pre-registration document.", "human");

  const t19 = createTask(vaultRoot, p.slug, {
    title: "Design blinded protocol against experimenter psi-priming",
    priority: "medium",
    labels: ["experiment", "ethics"],
    order: 130,
    description: "Analysis pipeline where whoever scores correlation strength doesn't know which runs are real paired-chamber trials and which are decoy runs with lattices that were never entangled to begin with. If we can tell the difference before unblinding, something is wrong with the protocol, not the physics.",
  });
  updateStatus(vaultRoot, p.slug, t19.id, "todo");

  const t20 = createTask(vaultRoot, p.slug, {
    title: "Determine IRB jurisdiction for passive quantum-field reception experiments on human subjects",
    priority: "high",
    labels: ["ethics"],
    order: 140,
    description: `Before any experiment touches a living human nervous system — even passively, no stimulation, pure reception — we need a documented answer to whether this counts as human-subjects research requiring full IRB review, sits closer to an EEG cap (minimal risk, expedited review), or has no existing precedent at all.

Reviewed our institution's guidance plus two comparable protocols (a magnetoencephalography study and a consumer EEG wearable study). Neither anticipates a device whose stated purpose is "test whether it receives anything." That's the actual snag: IRB categories assume you already know what you're measuring for risk-assessment purposes. We're asking them to approve an experiment whose hypothesis is, charitably, unresolved.

This needs a human decision, not an agent guess — getting it wrong in either direction is costly. Over-claim risk and the whole program stalls in review; under-claim it and we've made a promise on a consent form we can't back up yet.`,
  });
  updateStatus(vaultRoot, p.slug, t20.id, "in_progress");
  setBlocked(vaultRoot, p.slug, t20.id, true);
  addComment(
    vaultRoot,
    p.slug,
    t20.id,
    "Recommend filing for expedited review under the minimal-risk EEG-adjacent category, with the speculative framing disclosed explicitly in the consent language, rather than waiting for a bespoke category that doesn't exist yet. Flagging this rather than deciding it — not my call to make.",
    "agent"
  );

  const t21 = createTask(vaultRoot, p.slug, {
    title: "Weekly coherence-time regression dashboard",
    priority: "low",
    labels: ["experiment"],
    order: 150,
    description: "Rolling chart of measured coherence time per sample batch, so a slow drift in tubulin quality or chamber performance shows up before it quietly invalidates three weeks of runs.",
  });
  updateStatus(vaultRoot, p.slug, t21.id, "in_progress");

  const t22 = createTask(vaultRoot, p.slug, {
    title: "Grant renewal: reframe \"quantum telepathy\" as \"distributed biocomputing substrate\"",
    priority: "medium",
    labels: ["grant"],
    order: 160,
    description: "Rewrote the year-2 renewal narrative for the review committee: replaced \"quantum telepathy\" with \"distributed biocomputing substrate\" throughout, moved the FMO-complex and avian-compass precedents up front so reviewers hit peer-reviewed quantum biology before the more speculative claims, and moved the Indra framing to an appendix marked clearly as exploratory.",
  });
  updateStatus(vaultRoot, p.slug, t22.id, "done");
  updateDescription(
    vaultRoot,
    p.slug,
    t22.id,
    "Rewrote the year-2 renewal narrative for the review committee: replaced \"quantum telepathy\" with \"distributed biocomputing substrate\" throughout, moved the FMO-complex and avian-compass precedents up front so reviewers hit peer-reviewed quantum biology before the more speculative claims, and moved the Indra framing to an appendix marked clearly as exploratory.\n\nSubmitted, then resubmitted — see update log.",
    "Committee responded well to \"biocomputing substrate.\" Committee did not respond well to the word \"telepathy\" surviving on slide 14 despite the rename everywhere else in the deck. Removed slide 14. Resubmitted."
  );
  addComment(vaultRoot, p.slug, t22.id, "lol slide 14", "human");
  addComment(vaultRoot, p.slug, t22.id, "In my defense, it had a really good diagram.", "agent");

  console.log(`Seeded promo project "${p.name}" (${p.slug}) at ${vaultRoot}`);
}

seed();
