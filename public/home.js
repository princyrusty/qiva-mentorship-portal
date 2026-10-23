/* Home page: sample session, tracks explorer, plans, savings calculator, FAQ. */
(function () {
  "use strict";
  const Q = window.QIVA, C = window.QIVA_CATALOG;
  const { $, $$, esc, inr } = Q;
  const reduce = Q.reduce;
  const ICO = {
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  const tIco = (p) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const BENEFITS = [
    ["Clear direction", "Turn a vague goal into a plan with the next three steps written down.", '<path d="M4 20l6-6M14 4h6v6M20 4l-9 9"/>'],
    ["Faster progress", "Skip the mistakes someone else has already made and learn what to focus on first.", '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'],
    ["Real confidence", "Having someone in your corner who believes you can do it changes how you show up.", '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'],
    ["Accountability", "A weekly check-in keeps the plan moving when motivation dips.", '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M8 13l3 3 5-6"/>'],
    ["Honest feedback", "Someone who looks at your work and tells you what to fix first.", '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h7"/>'],
    ["A wider view", "Options you had not considered, from someone who has seen more paths.", '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>']
  ];

  /* ---------- illustrated people in the sample room ---------- */
  const mouth = (o) => `M176 262 Q200 ${270 + o * 28} 224 262 Q200 ${266 + o * 5} 176 262 Z`;
  function person(kind) {
    const P = { mentor: { s: "#C68642", sh: "#A86E35", hair: "#1E1A1D", cloth: "#2E7F6E", bun: true }, learner: { s: "#D9A066", sh: "#BD8650", hair: "#17131A", cloth: "#6B4FBB", tail: true } }[kind];
    return `<svg viewBox="0 0 400 520" width="100%" role="img" aria-label="${kind === "mentor" ? "Illustration of Meera, the mentor" : "Illustration of Aditi, the learner"}">
      ${P.bun ? `<circle cx="200" cy="86" r="42" fill="${P.hair}"/><rect x="180" y="114" width="40" height="11" rx="5.5" fill="#F3A20F"/>` : ""}
      ${P.tail ? `<path d="M266 150 C344 168 350 270 322 344 C312 292 298 238 262 204 Z" fill="${P.hair}"/>` : ""}
      <path d="M58 520 C60 420 110 350 200 348 C290 350 340 420 342 520 Z" fill="${P.cloth}"/>
      <path d="M172 266 h56 v86 q-28 24 -56 0 z" fill="${P.sh}"/>
      <ellipse cx="116" cy="214" rx="15" ry="23" fill="${P.sh}"/><ellipse cx="284" cy="214" rx="15" ry="23" fill="${P.sh}"/>
      <ellipse cx="200" cy="202" rx="86" ry="98" fill="${P.s}"/>
      ${P.bun ? `<path d="M166 348 L200 402 L234 348 Z" fill="${P.sh}"/><path d="M164 349 L200 406 L236 349" fill="none" stroke="#F3A20F" stroke-width="8" stroke-linejoin="round"/>
        <path d="M110 216 C104 130 150 100 200 100 C250 100 296 130 290 216 C278 168 248 140 200 138 C152 140 122 168 110 216 Z" fill="${P.hair}"/>
        <circle cx="116" cy="240" r="6" fill="#F3A20F"/><circle cx="284" cy="240" r="6" fill="#F3A20F"/>`
        : `<path d="M110 214 C104 128 150 98 204 98 C256 98 294 128 290 200 C272 152 232 134 196 144 C170 152 150 170 140 202 C132 188 122 198 110 214 Z" fill="${P.hair}"/>`}
      <path d="M148 188 q20 -12 40 0" fill="none" stroke="${P.hair}" stroke-width="7" stroke-linecap="round"/><path d="M212 188 q20 -12 40 0" fill="none" stroke="${P.hair}" stroke-width="7" stroke-linecap="round"/>
      <ellipse id="${kind}EyeL" cx="168" cy="214" rx="9.5" ry="11" fill="#1B1420"/><ellipse id="${kind}EyeR" cx="232" cy="214" rx="9.5" ry="11" fill="#1B1420"/>
      <circle cx="171" cy="209" r="3.2" fill="#fff"/><circle cx="235" cy="209" r="3.2" fill="#fff"/>
      <path d="M199 224 q-9 22 5 26" fill="none" stroke="${P.sh}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="148" cy="250" r="14" fill="#E8796B" opacity=".22"/><circle cx="252" cy="250" r="14" fill="#E8796B" opacity=".22"/>
      <path id="${kind}Mouth" d="${mouth(0.12)}" fill="#6E2A2A"/></svg>`;
  }

  function sampleRoom() {
    $("#artMentor").innerHTML = person("mentor");
    $("#artLearner").innerHTML = person("learner");
    const SCRIPT = [
      ["mentor", "Let’s start with what you enjoy and what you are good at."],
      ["learner", "I like maths, and I explain things to my friends a lot."],
      ["mentor", "Then engineering and data science both fit. Let’s compare them."],
      ["learner", "Which entrance exams would I need for each?"],
      ["mentor", "I’ll list them with dates. Your first step is this week’s mock test."]
    ];
    const NOTES = ["Strengths: maths, explaining ideas", "Explore: B.Tech CSE and BSc Data Science", "Next: one mock test, then review"];
    let line = 0, sec = 12 * 60 + 32, speaker = "mentor", noteIdx = 0, typed = [0, 0, 0], hold = 0;
    const notesEls = $$("#notesList li");
    function setLine(i) {
      const [who, text] = SCRIPT[i]; speaker = who;
      $("#capWho").textContent = who === "mentor" ? "Meera · mentor" : "Aditi · learner";
      $("#capText").textContent = text;
      $("#tileMentor").classList.toggle("speaking", who === "mentor");
      $("#tileLearner").classList.toggle("speaking", who === "learner");
      const g = Math.min(3, 1 + Math.floor(i / 2)); $("#goalTxt").textContent = g + " of 3"; $("#goalBar").style.width = (g / 3) * 100 + "%";
    }
    setLine(0);
    if (reduce) { NOTES.forEach((n, i) => { notesEls[i].textContent = "• " + n; }); return; }
    setInterval(() => { sec++; const p = (n) => String(n).padStart(2, "0"); $("#recTime").textContent = `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`; }, 1000);
    setInterval(() => { line = (line + 1) % SCRIPT.length; setLine(line); }, 4200);
    setInterval(() => {
      if (noteIdx >= NOTES.length) { if (++hold < 60) return; hold = 0; noteIdx = 0; typed = [0, 0, 0]; notesEls.forEach((li) => { li.textContent = ""; }); return; }
      const full = "• " + NOTES[noteIdx]; typed[noteIdx] = Math.min(full.length, typed[noteIdx] + 2);
      notesEls[noteIdx].textContent = full.slice(0, typed[noteIdx]);
      if (typed[noteIdx] >= full.length) noteIdx++;
    }, 90);
    const waveBars = $$("#wave i"), t0 = performance.now(), blink = { mentor: 1.2, learner: 2.4 };
    (function frame(now) {
      const t = (now - t0) / 1000;
      ["mentor", "learner"].forEach((k) => {
        const o = speaker === k ? 0.14 + 0.7 * Math.abs(Math.sin(t * 12.3)) * (0.45 + 0.55 * Math.abs(Math.sin(t * 3.1 + 0.7))) : 0.12;
        const m = document.getElementById(k + "Mouth"); if (m) m.setAttribute("d", mouth(o));
        const ph = (t + blink[k]) % 3.6, b = ph < 0.16 ? 1 - Math.abs(ph / 0.08 - 1) : 0;
        ["L", "R"].forEach((s) => { const e = document.getElementById(k + "Eye" + s); if (e) e.setAttribute("ry", (11 * (1 - b) + 1.3).toFixed(2)); });
      });
      waveBars.forEach((w, i) => { w.style.height = (speaker === "mentor" ? 6 + Math.abs(Math.sin(t * 9 + i * 1.3)) * 18 : 5) + "px"; });
      requestAnimationFrame(frame);
    })(t0);
  }

  function rotator() {
    if (reduce) return;
    const ROT = ["choosing the right career", "integration by parts", "your first startup pitch", "fluent spoken English", "your first Python project", "a study routine that sticks"];
    let i = 0;
    setInterval(() => { const w = $("#rotWord"); w.classList.add("out"); setTimeout(() => { i = (i + 1) % ROT.length; w.textContent = ROT[i]; w.classList.remove("out"); }, 350); }, 2800);
  }

  /* ---------- tracks ---------- */
  let curTrack = "career";
  function renderTracks() {
    $("#tlist").innerHTML = C.TRACKS.map((t) => `<button class="titem" role="tab" id="tab-${t.id}" aria-controls="tdetail" aria-selected="${t.id === curTrack}" tabindex="${t.id === curTrack ? 0 : -1}" data-t="${t.id}" type="button"><span class="ti">${tIco(t.icon)}</span><span class="tt"><strong>${esc(t.name)}</strong><span>${esc(t.sub)}</span></span><span class="go">${ICO.arrow}</span></button>`).join("");
    const t = C.track(curTrack);
    $("#tdetail").setAttribute("aria-labelledby", "tab-" + t.id);
    $("#tdetail").innerHTML = `<div class="band"><span class="eyebrow" style="color:var(--ink-2)">Track</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></div>
      <div class="body"><span class="eyebrow">What people bring to it · tap one to book</span><div class="focus">${t.focus.map((f) => `<button class="chip" type="button" data-focus="${esc(f)}">${esc(f)}</button>`).join("")}</div>
      ${t.note ? `<p class="note">${t.note}</p>` : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-dark" type="button" data-booktrack="${t.id}">Book ${esc(t.name.toLowerCase())} <span class="arr" aria-hidden="true">${ICO.arrow}</span></button><a class="btn" href="#plans">See plans</a></div></div>`;
  }

  /* ---------- plans + calculator ---------- */
  let planKind = "plan", calcLen = 60;
  function renderPlans() {
    const list = planKind === "plan" ? C.PLANS : C.SINGLE;
    $("#planNote").textContent = planKind === "plan" ? "Four sessions a month with the same mentor." : "Pay once for one conversation. No commitment.";
    $("#cards").innerHTML = list.map((p) => {
      const isPlan = planKind === "plan";
      return `<article class="pcard${p.best ? " best" : ""}">
        <div class="head"><div class="row"><h3>${esc(p.name)}</h3>${p.best ? '<span class="tag tag-amber">Most chosen</span>' : ""}</div><span class="sub">${esc(p.sub)}</span></div>
        <div class="price"><s>${inr(p.was)}</s><strong>${inr(p.price)}</strong><span class="per">${isPlan ? "per month, inc. GST" : "one time, inc. GST"}</span></div>
        <div class="tags">${isPlan ? `<span class="tag">4 sessions</span><span class="tag">${inr(p.per)} per session</span><span class="tag tag-good">Save ${p.save}%</span>` : `<span class="tag">${p.mins} min</span><span class="tag">${p.mode}</span><span class="tag tag-good">${p.off}</span>`}</div>
        <ul class="perks">${p.perks.map((x) => `<li>${ICO.check}<span>${esc(x)}</span></li>`).join("")}</ul>
        ${isPlan ? `<details class="bonus"><summary>Bonuses included</summary><ul>${p.bonus.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details><div class="why"><b>Why this plan</b>${esc(p.why)}</div>` : ""}
        <button class="btn ${p.best ? "btn-amber" : "btn-dark"}" type="button" data-item="${p.id}">${isPlan ? "Start " + esc(p.name) : "Book " + p.mins + " minutes"}</button></article>`;
    }).join("");
    $$("#planSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === planKind)));
    Q.moveKnob($("#planSeg"));
  }
  function renderCalc() {
    const n = +$("#calcN").value; $("#calcNVal").textContent = n;
    const s = C.SINGLE.find((x) => x.mins === calcLen), p = C.PLANS.find((x) => x.mins === calcLen);
    const singles = n * s.price, plan = p.price + Math.max(0, n - 4) * s.price, max = Math.max(singles, plan);
    $("#barPlanLab").textContent = `${p.name} plan${n > 4 ? ` + ${n - 4} extra` : ""}`; $("#barPlanVal").textContent = inr(plan);
    $("#barSingleLab").textContent = `${n} × ${s.name.replace(" Session", "")} session${n > 1 ? "s" : ""}`; $("#barSingleVal").textContent = inr(singles);
    $("#barPlan .track i").style.width = (plan / max) * 100 + "%"; $("#barSingle .track i").style.width = (singles / max) * 100 + "%";
    const usePlan = plan < singles;
    $("#calcVerdict").textContent = usePlan ? `${p.name} saves you ${inr(singles - plan)} a month.` : (n === 1 ? `Book a single ${calcLen} minute session.` : `Book ${n} single sessions. A plan pays off from three a month.`);
    $("#calcBook").textContent = usePlan ? `Start ${p.name}` : `Book ${calcLen} minutes`;
    $("#calcBook").dataset.item = usePlan ? p.id : s.id;
    $$("#calcLen button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.len === calcLen)));
    Q.moveKnob($("#calcLen"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    sampleRoom(); rotator();
    const mq = ["Career guidance", "Study doubts", "Motivation", "Startups", "AI and tech", "Communication", "Book at your convenience", "Slots in IST", "Private video room", "Notes after every session"];
    $("#marquee").innerHTML = [...mq, ...mq].map((s) => `<span>${s}</span>`).join("");

    $("#heroChips").insertAdjacentHTML("beforeend", C.TRACKS.map((t) => `<button class="chip" type="button" data-track="${t.id}">${esc(t.name.split(" and ")[0])}</button>`).join(""));
    $("#heroChips").addEventListener("click", (e) => { const b = e.target.closest("[data-track]"); if (b) Q.openBooking({ track: b.dataset.track }); });
    const KEYS = { career: /career|stream|college|job|cv|resume|interview|neet|jee|cuet|commerce|science or/i, study: /math|physics|chem|biology|chapter|doubt|equation|integration|essay|account|subject|class \d/i, motivation: /motiv|habit|routine|focus|procrast|stress|nerv|goal|bad result/i, startup: /startup|idea|pitch|founder|customer|business/i, ai: /\bai\b|python|code|coding|program|tech|prompt|portfolio|chatgpt/i, comm: /english|speak|stage|confiden|present|email|communicat|hindi/i };
    $("#finder").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#finderInput").value.trim(); const tr = Object.keys(KEYS).find((k) => KEYS[k].test(q)); Q.openBooking({ topic: q, track: tr || "" }); });

    $("#benefits").innerHTML = BENEFITS.map((b) => `<div class="benefit"><span class="ic">${tIco(b[2])}</span><h3>${b[0]}</h3><p>${b[1]}</p></div>`).join("");

    renderTracks();
    $("#tlist").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; curTrack = b.dataset.t; renderTracks(); document.getElementById("tab-" + curTrack).focus(); });
    $("#tlist").addEventListener("keydown", (e) => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
      e.preventDefault();
      const i = C.TRACKS.findIndex((t) => t.id === curTrack), d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : C.TRACKS.length - 1;
      curTrack = C.TRACKS[(i + d) % C.TRACKS.length].id; renderTracks(); document.getElementById("tab-" + curTrack).focus();
    });
    $("#tdetail").addEventListener("click", (e) => {
      const f = e.target.closest("[data-focus]"); if (f) return Q.openBooking({ track: curTrack, focus: f.dataset.focus });
      const b = e.target.closest("[data-booktrack]"); if (b) Q.openBooking({ track: b.dataset.booktrack });
    });

    renderPlans();
    $("#planSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (!b) return; planKind = b.dataset.kind; renderPlans(); });
    $("#cards").addEventListener("click", (e) => { const b = e.target.closest("[data-item]"); if (b) Q.openBooking({ item: b.dataset.item }); });

    $("#calcN").addEventListener("input", renderCalc);
    $("#calcLen").addEventListener("click", (e) => { const b = e.target.closest("[data-len]"); if (!b) return; calcLen = +b.dataset.len; renderCalc(); });
    $("#calcBook").addEventListener("click", (e) => Q.openBooking({ item: e.currentTarget.dataset.item }));
    renderCalc();
    $("#cmpBody").innerHTML = [...C.SINGLE.map((s) => `<tr><td><strong>${s.name}</strong></td><td>1 session of ${s.mins} minutes</td><td class="num">${inr(s.price)}</td><td class="num">${inr(s.price)}</td><td>Pay as you go</td></tr>`),
      ...C.PLANS.map((p) => `<tr><td><strong>${p.name}</strong> plan</td><td>4 × ${p.mins} min per month</td><td class="num">${inr(p.price)}</td><td class="num">${inr(p.per)}</td><td class="save">${p.save}% less than booking singly</td></tr>`)].join("");
    const knobs = () => { Q.moveKnob($("#planSeg")); Q.moveKnob($("#calcLen")); };
    window.addEventListener("resize", knobs);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(knobs);

    fetch("/faq.json").then((r) => r.json()).then((faq) => {
      $("#faqList").innerHTML = faq.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("");
    }).catch(() => {});

    Q.config().then((c) => {
      $("#introLink").href = Q.wa(c, "Hi QIVA, I would like to book the free 10 minute intro call.");
      $("#mbarWa").href = Q.wa(c, "Hi QIVA, I have a question about mentorship.");
    });

    if (!reduce && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("rise"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
      $$(".benefit,.pcard,.vs>div,.fact,.steps li,.week,.titem").forEach((el) => io.observe(el));
    }
  });
})();
