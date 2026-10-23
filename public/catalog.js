/* QIVA catalog: one source of truth for prices, plans, tracks and slot rules.
   Loaded by the browser (window.QIVA_CATALOG) and required by the server. Prices are in rupees, GST included. */
(function (root) {
  "use strict";
  const SINGLE = [
    { id: "s30", name: "30 Minute Session", mins: 30, sub: "One topic, one clear answer", price: 599, was: 799, off: "25% off", mode: "voice",
      perks: ["Appointment shown in IST", "Voice call in a private room", "Focused on one goal or doubt", "Written notes by email"] },
    { id: "s60", name: "60 Minute Session", mins: 60, sub: "Time to go deep and practise", price: 999, was: 1299, off: "23% off", mode: "voice",
      perks: ["Appointment shown in IST", "Voice call in a private room", "Worked examples and practice tasks", "Written notes by email"] },
    { id: "s90", name: "90 Minute Session", mins: 90, sub: "A full chapter or a big decision, face to face", price: 1399, was: 1799, off: "22% off", mode: "video",
      perks: ["Appointment shown in IST", "Video call with screen sharing", "Follow up by email and WhatsApp", "Notes and a practice set or action plan"] }
  ];
  const PLANS = [
    { id: "saathi", name: "Saathi", mins: 30, sub: "Your weekly companion", price: 1699, was: 1999,
      perks: ["4 weekly voice calls of 30 minutes", "Your first call sets goals for the month", "Chat support answered within 24 hours, Monday to Saturday", "Written notes and action points after every call", "Pause once a month, cancel any time"],
      bonus: ["Personal goal roadmap on one page", "Weekly WhatsApp nudge to keep you on track", "Free mentor switch if the first call is not a fit"],
      why: "For anyone who needs a regular check-in on one goal, such as a school subject, a habit or a career decision." },
    { id: "pragati", name: "Pragati", mins: 60, sub: "Steady progress, week by week", price: 2999, was: 3499, best: true,
      perks: ["4 weekly sessions of 60 minutes", "Priority slot booking, including weekends", "Chat support answered within 12 hours", "Action review between sessions so nothing slips", "Monthly progress report with next month’s targets", "One free reschedule every month"],
      bonus: ["Personal goal roadmap with weekly nudges", "Monthly live group Q&A with QIVA mentors", "Curated resource pack for your track", "Progress certificate after three months", "Free mentor switch if it is not a fit"],
      why: "For steady, visible progress. A weekly hour with the same mentor builds the habit and fixes problems while they are small." },
    { id: "shikhar", name: "Shikhar", mins: 90, sub: "The full mentor experience", price: 4499, was: 5499,
      perks: ["4 weekly video sessions of 90 minutes with screen sharing", "Same day chat and WhatsApp support", "Follow up by email and WhatsApp after every session", "Weekly plan reset and one mock test or project review", "2 bonus check-in calls of 15 minutes", "Fortnightly progress update for parents, with your consent", "Priority booking and a free reschedule every week"],
      bonus: ["Personal roadmap, reviewed every week", "One session on career or college planning", "CV, LinkedIn or project showcase review", "Invitations to QIVA workshops and mentorship events", "Progress certificate after three months", "Free mentor switch if it is not a fit"],
      why: "For the weeks before boards, entrance exams, interviews or a launch, and for anyone who wants a mentor closely involved." }
  ];
  PLANS.forEach(function (p) {
    const s = SINGLE.find(function (x) { return x.mins === p.mins; });
    p.per = Math.round(p.price / 4);
    p.save = Math.round((1 - p.price / (4 * s.price)) * 100);
  });

  const TRACKS = [
    { id: "career", name: "Career guidance", sub: "Streams, colleges, exams, first jobs",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
      desc: "Choose a stream, a college, an entrance exam or a first job with someone who has already walked that road.",
      focus: ["Science or Commerce?", "Choosing a college", "Entrance exam strategy", "First job search", "CV and LinkedIn", "Mock interview"] },
    { id: "study", name: "Study doubts", sub: "One topic, explained till it clicks",
      icon: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
      desc: "Bring one chapter or one problem. Your mentor starts at the exact line where you got stuck and stays until it makes sense.",
      focus: ["Integration by parts", "Torque and angular momentum", "Balancing redox equations", "Essay structure", "Accounts: ledger posting"] },
    { id: "motivation", name: "Motivation and mindset", sub: "Goals, habits, getting back on track",
      icon: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>',
      desc: "Build a routine that holds, plan your year, and get going again after a setback, with someone who checks in on you.",
      focus: ["Back on track after a bad result", "Goals for the year", "A study routine that sticks", "Exam season nerves"],
      note: "<strong>Guidance, not therapy.</strong> If you feel unsafe or overwhelmed, please call Tele-MANAS on 14416 (free, any time)." },
    { id: "startup", name: "Startup and innovation", sub: "From idea to first users",
      icon: '<path d="M5 19c1-4 4-7 8-9l3-3 1 4-3 3c-2 4-5 7-9 8z"/><circle cx="14.5" cy="9.5" r="1.4"/>',
      desc: "Turn an idea into something real. Test it, build a first version, find first users and learn to pitch it.",
      focus: ["Is my idea worth building?", "First ten customers", "Five minute pitch"] },
    { id: "ai", name: "AI and tech skills", sub: "Tools, code, projects",
      icon: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
      desc: "Learn to use AI tools well, build a project, or start coding with someone looking over your shoulder.",
      focus: ["Prompting for homework help", "First Python project", "Portfolio review"] },
    { id: "comm", name: "Communication and confidence", sub: "Speak, write and present",
      icon: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
      desc: "Speak, write and present with ease, in English or Hindi.",
      focus: ["Stage fright", "Fluent spoken English", "Clear emails"] }
  ];

  const ABOUT = ["School student (Class 6 to 10)", "Class 11 or 12 student", "College student", "Graduate or job seeker", "Working professional", "Parent booking for a child", "Founder or creator"];
  const WEEKDAY_TIMES = ["5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];
  const WEEKEND_TIMES = ["10:00 AM", "12:00 PM", "3:00 PM", "5:00 PM", "7:00 PM"];
  const BOOKING_WINDOW_DAYS = 14;

  function istParts(ms) {
    const d = new Date(ms);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const wd = d.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
    const day = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" });
    const mon = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
    return { key: key, wd: wd, day: day, mon: mon, weekend: wd === "Sat" || wd === "Sun" };
  }
  function upcomingDays(n, from) {
    const out = [];
    const start = typeof from === "number" ? from : Date.now();
    for (let i = 1; i <= n; i++) out.push(istParts(start + i * 864e5));
    return out;
  }
  function slotTimes(weekend) { return weekend ? WEEKEND_TIMES : WEEKDAY_TIMES; }
  function isValidSlot(slot, from) {
    if (!slot || typeof slot.date !== "string" || typeof slot.time !== "string") return false;
    const d = upcomingDays(BOOKING_WINDOW_DAYS, from).find(function (x) { return x.key === slot.date; });
    return !!d && slotTimes(d.weekend).indexOf(slot.time) !== -1;
  }
  function slotLabel(slot) {
    const parts = String(slot.date).split("-").map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 30));
    const label = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
    return label + ", " + slot.time + " IST";
  }
  function item(id) { return PLANS.find(function (p) { return p.id === id; }) || SINGLE.find(function (s) { return s.id === id; }) || null; }
  function isPlan(id) { return PLANS.some(function (p) { return p.id === id; }); }
  function track(id) { return TRACKS.find(function (t) { return t.id === id; }) || null; }

  const C = { SINGLE: SINGLE, PLANS: PLANS, TRACKS: TRACKS, ABOUT: ABOUT, BOOKING_WINDOW_DAYS: BOOKING_WINDOW_DAYS,
    upcomingDays: upcomingDays, slotTimes: slotTimes, isValidSlot: isValidSlot, slotLabel: slotLabel, item: item, isPlan: isPlan, track: track };
  if (typeof module === "object" && module.exports) module.exports = C; else root.QIVA_CATALOG = C;
})(typeof self !== "undefined" ? self : this);
