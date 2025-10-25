// mobile nav toggle
const mobileBtn = document.getElementById("mobileMenuBtn");
const mobileNav = document.getElementById("mobileNav");

if (mobileBtn && mobileNav) {
  mobileBtn.addEventListener("click", () => {
    if (mobileNav.style.display === "flex") {
      mobileNav.style.display = "none";
    } else {
      mobileNav.style.display = "flex";
    }
  });
}

// footer year
const yearNowEl = document.getElementById("yearNow");
if (yearNowEl) {
  yearNowEl.textContent = new Date().getFullYear();
}

// waitlist form handling (client-side only for now)
const waitForm = document.getElementById("waitlistForm");
const waitMsg = document.getElementById("waitlistMsg");
const waitBtn = document.getElementById("waitlistSubmitBtn");

if (waitForm) {
  waitForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!waitBtn) return;
    waitBtn.disabled = true;
    waitBtn.textContent = "Submitting...";

    const formData = new FormData(waitForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      exp: formData.get("exp")
    };

    // For now we just log locally.
    // Later you can POST this to /waitlist and store in Mongo.
    console.log("WAITLIST SUBMIT", payload);

    waitMsg.textContent = "Thanks! We'll reach out soon.";
    waitMsg.style.color = "#0ea77f";

    waitBtn.textContent = "Request Sent ✓";
  });
}
