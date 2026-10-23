/* /contact — enquiries and complaints, each logged with a ticket number */
(function () {
  "use strict";
  const Q = window.QIVA;
  const { $, $$, esc, api } = Q;
  let kind = "enquiry";
  function setKind(k) {
    kind = k;
    $$("#kindSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === k)));
    Q.moveKnob ? Q.moveKnob($("#kindSeg")) : moveKnob();
    $("#mBody").placeholder = k === "grievance" ? "What went wrong, when, and what you would like us to do. Include your booking ID if you have one." : "Tell us what you need and we will help you pick the right track and plan.";
    $("#mSend").textContent = k === "grievance" ? "Send complaint" : "Send message";
  }
  function moveKnob() {
    const seg = $("#kindSeg"), on = seg.querySelector('[aria-pressed="true"]'), k = seg.querySelector(".knob");
    if (on && k) { k.style.width = on.offsetWidth + "px"; k.style.transform = `translateX(${on.offsetLeft - 5}px)`; }
  }
  document.addEventListener("DOMContentLoaded", async () => {
    if (!Q.moveKnob) Q.moveKnob = (seg) => { const on = seg.querySelector('[aria-pressed="true"]'), k = seg.querySelector(".knob"); if (on && k) { k.style.width = on.offsetWidth + "px"; k.style.transform = `translateX(${on.offsetLeft - 5}px)`; } };
    const p = new URLSearchParams(location.search);
    setKind(location.hash === "#grievance" || p.get("kind") === "grievance" ? "grievance" : "enquiry");
    if (p.get("topic") === "custom") { $("#mSubject").value = "Custom plan"; $("#mBody").placeholder = "Subject, topic, class or level, and your exam or deadline date."; }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveKnob);
    $("#kindSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (b) setKind(b.dataset.kind); });
    const c = await Q.config();
    $("#mWa").href = Q.wa(c, "Hi QIVA, I have a question.");
    $("#contactPageForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = { kind, name: $("#mName").value, phone: $("#mPhone").value, email: $("#mEmail").value.trim(), bookingId: $("#mBooking").value.trim(), subject: $("#mSubject").value, body: $("#mBody").value };
      const btn = $("#mSend"); btn.disabled = true;
      try {
        const r = await api("/api/messages", { method: "POST", body });
        $("#mDone").hidden = false;
        $("#mDone").innerHTML = `<strong>Ticket ${esc(r.id)}</strong><span>${kind === "grievance" ? "Your complaint is logged. Our Grievance Officer acknowledges it within 48 hours." : "Thanks. We reply during support hours."} Quote this ticket number if you follow up.</span>`;
        $("#contactPageForm").querySelectorAll(".field,.two,#mSend,#kindSeg").forEach((el) => { el.hidden = true; });
        $("#mErr").textContent = "";
      } catch (x) { $("#mErr").textContent = x.message; btn.disabled = false; }
    });
  });
})();
