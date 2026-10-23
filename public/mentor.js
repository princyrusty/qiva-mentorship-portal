/* /mentor — mentor application form */
(function () {
  "use strict";
  const Q = window.QIVA;
  const { $, esc, api } = Q;
  document.addEventListener("DOMContentLoaded", async () => {
    const c = await Q.config();
    $("#mentorWa").href = Q.wa(c, "Hi QIVA, I would like to know more about becoming a mentor.");
    $("#mentorForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = (m) => { $("#aErr").textContent = m; };
      const tracks = [...document.querySelectorAll('input[name="tracks"]:checked')].map((x) => x.value);
      const body = {
        name: $("#aName").value, city: $("#aCity").value, email: $("#aEmail").value, phone: $("#aPhone").value, tracks,
        jobRole: $("#aRole").value, experienceYears: $("#aYears").value, hoursPerMonth: $("#aHours").value,
        languages: $("#aLang").value, linkedin: $("#aLink").value.trim(), why: $("#aWhy").value, consent: $("#aConsent").checked
      };
      if (!tracks.length) return err("Choose at least one track.");
      if (!body.consent) return err("Please agree to be contacted about your application.");
      const btn = $("#aSend"); btn.disabled = true; btn.textContent = "Sending…";
      try {
        const r = await api("/api/mentor-applications", { method: "POST", body });
        $("#mentorForm").querySelectorAll(".field,.two,.check,#aSend,#aErr").forEach((el) => { el.hidden = true; });
        const d = $("#aDone"); d.hidden = false;
        d.innerHTML = `<strong>Thank you, ${esc(body.name.split(" ")[0])}.</strong><span>Your application reference is <span class="mono">${esc(r.id)}</span>. We will contact you on WhatsApp or email to set up a short intro call.</span>`;
        d.scrollIntoView({ behavior: Q.reduce ? "auto" : "smooth", block: "center" });
      } catch (x) { err(x.message); btn.disabled = false; btn.textContent = "Send application"; }
    });
  });
})();
