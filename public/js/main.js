// ------------------------------
// Mobile nav toggle
// ------------------------------
const mobileBtn = document.getElementById("mobileMenuBtn");
const mobileNav = document.getElementById("mobileNav");

if (mobileBtn && mobileNav) {
  mobileBtn.addEventListener("click", () => {
    mobileNav.style.display = (mobileNav.style.display === "flex") ? "none" : "flex";
  });
}

// ------------------------------
// Footer year
// ------------------------------
const yearNowEl = document.getElementById("yearNow");
if (yearNowEl) {
  yearNowEl.textContent = new Date().getFullYear();
}

// ------------------------------
// Waitlist form handling
// ------------------------------
const waitForm = document.getElementById("waitlistForm");
const waitMsg = document.getElementById("waitlistMsg");
const waitBtn = document.getElementById("waitlistSubmitBtn");

if (waitForm) {
  waitForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (waitBtn) {
      waitBtn.disabled = true;
      waitBtn.textContent = "Submitting...";
    }

    const formData = new FormData(waitForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      exp: formData.get("exp")
    };

    console.log("WAITLIST SUBMIT", payload);

    if (waitMsg) {
      waitMsg.textContent = "Thanks! We'll reach out soon.";
      waitMsg.style.color = "#0ea77f";
    }

    if (waitBtn) {
      waitBtn.textContent = "Request Sent ✓";
    }
  });
}

// ------------------------------
// Modal logic (Login / Signup)
// ------------------------------
const loginModal = document.getElementById("loginModal");
const signupModal = document.getElementById("signupModal");

// open buttons desktop
const openLoginBtn = document.getElementById("openLoginBtn");
const openSignupBtn = document.getElementById("openSignupBtn");

// open buttons mobile/other
const openLoginBtnMobile = document.getElementById("openLoginBtnMobile");
const openSignupBtnMobile = document.getElementById("openSignupBtnMobile");
const openLoginBtnBelow = document.getElementById("openLoginBtnBelow");

// swap links inside modals
const swapToSignup = document.getElementById("swapToSignup");
const swapToLogin = document.getElementById("swapToLogin");

// close buttons (data-close-modal)
const closeButtons = document.querySelectorAll("[data-close-modal]");

// helper to open/close
function openModal(modalEl) {
  if (modalEl) modalEl.style.display = "flex";
}
function closeModal(modalEl) {
  if (modalEl) modalEl.style.display = "none";
}
function closeAllModals() {
  closeModal(loginModal);
  closeModal(signupModal);
}

// bind open login
if (openLoginBtn) {
  openLoginBtn.addEventListener("click", () => {
    closeAllModals();
    openModal(loginModal);
  });
}
if (openLoginBtnMobile) {
  openLoginBtnMobile.addEventListener("click", () => {
    closeAllModals();
    openModal(loginModal);
    mobileNav.style.display = "none";
  });
}
if (openLoginBtnBelow) {
  openLoginBtnBelow.addEventListener("click", () => {
    closeAllModals();
    openModal(loginModal);
  });
}

// bind open signup
if (openSignupBtn) {
  openSignupBtn.addEventListener("click", () => {
    closeAllModals();
    openModal(signupModal);
  });
}
if (openSignupBtnMobile) {
  openSignupBtnMobile.addEventListener("click", () => {
    closeAllModals();
    openModal(signupModal);
    mobileNav.style.display = "none";
  });
}

// bind swap login <-> signup
if (swapToSignup) {
  swapToSignup.addEventListener("click", () => {
    closeAllModals();
    openModal(signupModal);
  });
}
if (swapToLogin) {
  swapToLogin.addEventListener("click", () => {
    closeAllModals();
    openModal(loginModal);
  });
}

// bind close buttons
closeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    closeAllModals();
  });
});

// close if click outside card
[loginModal, signupModal].forEach(modalEl => {
  if (!modalEl) return;
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeAllModals();
    }
  });
});

// ------------------------------
// Login submit (REAL)
// ------------------------------
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const loginBtn = document.getElementById("loginSubmitBtn");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Checking...";
    }

    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };

    try {
      const resp = await fetch("/auth/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      if (!data.ok) {
        if (loginMsg) {
          loginMsg.textContent = data.error || "Login failed";
          loginMsg.style.color = "#d11f4a";
        }
        loginBtn.disabled = false;
        loginBtn.textContent = "Log in →";
        return;
      }

      // Save token
      localStorage.setItem("qp_token", data.token);

      if (loginMsg) {
        loginMsg.textContent = "Login successful. Redirecting…";
        loginMsg.style.color = "#0ea77f";
      }

      window.location.href = "./app.html";

    } catch(err) {
      console.error(err);
      if (loginMsg) {
        loginMsg.textContent = "Network error";
        loginMsg.style.color = "#d11f4a";
      }
      loginBtn.disabled = false;
      loginBtn.textContent = "Log in →";
    }
  });
}

// ------------------------------
// Signup submit (REAL)
// ------------------------------
const signupForm = document.getElementById("signupForm");
const signupMsg = document.getElementById("signupMsg");
const signupBtn = document.getElementById("signupSubmitBtn");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (signupBtn) {
      signupBtn.disabled = true;
      signupBtn.textContent = "Creating...";
    }

    const formData = new FormData(signupForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password")
    };

    try {
      const resp = await fetch("/auth/signup", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      if (!data.ok) {
        if (signupMsg) {
          signupMsg.textContent = data.error || "Signup failed";
          signupMsg.style.color = "#d11f4a";
        }
        signupBtn.disabled = false;
        signupBtn.textContent = "Sign up →";
        return;
      }

      // Save token
      localStorage.setItem("qp_token", data.token);

      if (signupMsg) {
        signupMsg.textContent = "Account created. Redirecting…";
        signupMsg.style.color = "#0ea77f";
      }

      window.location.href = "./app.html";

    } catch(err) {
      console.error(err);
      if (signupMsg) {
        signupMsg.textContent = "Network error";
        signupMsg.style.color = "#d11f4a";
      }
      signupBtn.disabled = false;
      signupBtn.textContent = "Sign up →";
    }
  });
}
