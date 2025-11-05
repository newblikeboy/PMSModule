// ----------------------------------------------------
// Navigation (mobile)
// ----------------------------------------------------
const mobileBtn = document.getElementById("mobileMenuBtn");
const mobileNav = document.getElementById("mobileNav");

if (mobileBtn && mobileNav) {
  let menuOpen = false;

  const toggleMenu = (force) => {
    if (typeof force === "boolean") {
      menuOpen = force;
    } else {
      menuOpen = !menuOpen;
    }
    mobileNav.style.display = menuOpen ? "flex" : "none";
    mobileBtn.classList.toggle("is-open", menuOpen);
  };

  mobileBtn.addEventListener("click", () => toggleMenu());

  mobileNav.querySelectorAll("a, button").forEach((item) => {
    item.addEventListener("click", () => toggleMenu(false));
  });
}

// ----------------------------------------------------
// Footer year
// ----------------------------------------------------
const yearNowEl = document.getElementById("yearNow");
if (yearNowEl) {
  yearNowEl.textContent = new Date().getFullYear();
}

// ----------------------------------------------------
// Modal logic (Login / Signup)
// ----------------------------------------------------
const loginModal = document.getElementById("loginModal");
const signupModal = document.getElementById("signupModal");
const modals = [loginModal, signupModal].filter(Boolean);

const openLoginBtn = document.getElementById("openLoginBtn");
const openSignupBtn = document.getElementById("openSignupBtn");
const openLoginBtnMobile = document.getElementById("openLoginBtnMobile");
const openSignupBtnMobile = document.getElementById("openSignupBtnMobile");
const openLoginBtnBelow = document.getElementById("openLoginBtnBelow");

const swapToSignup = document.getElementById("swapToSignup");
const swapToLogin = document.getElementById("swapToLogin");
const closeButtons = document.querySelectorAll("[data-close-modal]");

const showModal = (modal) => {
  modals.forEach((item) => {
    if (item) {
      item.style.display = item === modal ? "flex" : "none";
    }
  });
};

const hideModals = () => {
  modals.forEach((item) => {
    if (item) item.style.display = "none";
  });
};

const bindOpen = (button, modal) => {
  if (button && modal) {
    button.addEventListener("click", () => {
      showModal(modal);
    });
  }
};

bindOpen(openLoginBtn, loginModal);
bindOpen(openLoginBtnMobile, loginModal);
bindOpen(openLoginBtnBelow, loginModal);
bindOpen(openSignupBtn, signupModal);
bindOpen(openSignupBtnMobile, signupModal);

const signupTriggers = document.querySelectorAll(".js-open-signup");
if (signupTriggers.length && signupModal) {
  signupTriggers.forEach((btn) => {
    btn.addEventListener("click", () => showModal(signupModal));
  });
}

closeButtons.forEach((btn) => {
  btn.addEventListener("click", hideModals);
});

modals.forEach((modal) => {
  if (!modal) return;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideModals();
    }
  });
});

if (swapToSignup) {
  swapToSignup.addEventListener("click", () => showModal(signupModal));
}
if (swapToLogin) {
  swapToLogin.addEventListener("click", () => showModal(loginModal));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideModals();
  }
});

// ----------------------------------------------------
// Login submit
// ----------------------------------------------------
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const loginBtn = document.getElementById("loginSubmitBtn");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Checking...";
    }

    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!data.ok) {
        if (loginMsg) {
          loginMsg.textContent = data.error || "Login failed";
          loginMsg.style.color = "#d11f4a";
        }
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = "Log in";
        }
        return;
      }

      localStorage.setItem("qp_token", data.token);

      if (loginMsg) {
        loginMsg.textContent = "Login successful. Redirecting...";
        loginMsg.style.color = "#0ea77f";
      }

      window.location.href = "./app.html";
    } catch (error) {
      console.error(error);
      if (loginMsg) {
        loginMsg.textContent = "Network error";
        loginMsg.style.color = "#d11f4a";
      }
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Log in";
      }
    }
  });
}

// ----------------------------------------------------
// Signup submit
// ----------------------------------------------------
const signupForm = document.getElementById("signupForm");
const signupMsg = document.getElementById("signupMsg");
const signupBtn = document.getElementById("signupSubmitBtn");

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (signupBtn) {
      signupBtn.disabled = true;
      signupBtn.textContent = "Creating...";
    }

    const formData = new FormData(signupForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!data.ok) {
        if (signupMsg) {
          signupMsg.textContent = data.error || "Signup failed";
          signupMsg.style.color = "#d11f4a";
        }
        if (signupBtn) {
          signupBtn.disabled = false;
          signupBtn.textContent = "Create account";
        }
        return;
      }

      localStorage.setItem("qp_token", data.token);

      if (signupMsg) {
        signupMsg.textContent = "Account created. Redirecting...";
        signupMsg.style.color = "#0ea77f";
      }

      window.location.href = "./app.html";
    } catch (error) {
      console.error(error);
      if (signupMsg) {
        signupMsg.textContent = "Network error";
        signupMsg.style.color = "#d11f4a";
      }
      if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.textContent = "Create account";
      }
    }
  });
}
