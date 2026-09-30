const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];


const pages = $(".page")
  ? $$(".page")
  : [];

const API = {
  health: "/api/health",
  dashboard: "/api/dashboard",
  login: "/api/auth/login",
  register: "/api/auth/register",
  chat: "/api/ai/chat",
  upload: "/api/documents/upload",
  compliance: "/api/compliance",
  sources: "/api/sources",
  liveSearch: "/api/ai/live-search"
};

const titles = {
  home: [
    "BIS SAHAYAK AI",
    "Business command center"
  ],

  assistant: [
    "AI ASSISTANT",
    "Ask BIS Sahayak"
  ],

  documents: [
    "DOCUMENT VAULT",
    "Your business documents"
  ],

  compliance: [
    "BUSINESS COMPLIANCE",
    "What needs attention?"
  ],

  sources: [
    "SOURCES & TOOLS",
    "Verify and investigate"
  ]
};


const officialFallbackSources = [

  {
    kind: "BIS",
    title: "BIS Official Website",
    url: "https://www.bis.gov.in/homes-new/?lang=en"
  },

  {
    kind: "BIS",
    title: "About BIS",
    url: "https://www.bis.gov.in/the-bureau/about-bis/?lang=en"
  },

  {
    kind: "BIS",
    title: "BIS Acts, Rules & Regulations",
    url: "https://www.bis.gov.in/the-bureau/bis-act-rules-and-regulations/?lang=en"
  },

  {
    kind: "BIS",
    title: "Product Certification — Online Information",
    url: "https://www.bis.gov.in/product-certification/online-information/?lang=en"
  },

  {
    kind: "BIS",
    title: "Hallmarking FAQs",
    url: "https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/?lang=en"
  },

  {
    kind: "BIS",
    title: "BIS Enquiry / Contact",
    url: "https://www.bis.gov.in/directory/enquiry/?lang=en"
  },

  {
    kind: "e-BIS",
    title: "Manak Online",
    url: "https://www.manakonline.in/"
  }

];


let authMode = "login";
let currentUser = null;
let navigationReady = false;

const tokenKey = "bis_token";


/* ================= UTILITIES ================= */

const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[c]
  );


const isSignedIn = () =>
  !!localStorage.getItem(tokenKey);


const authHeaders = () => {

  const token =
    localStorage.getItem(tokenKey);

  return token
    ? {
        Authorization:
          `Bearer ${token}`
      }
    : {};
};


async function apiJSON(url, options = {}) {

  const response =
    await fetch(url, options);

  const data =
    await response
      .json()
      .catch(() => ({}));

  return {
    r: response,
    d: data
  };
}


/* ================= TOAST ================= */

function toast(
  title,
  message = "",
  type = "success"
) {

  const stack =
    $("#toastStack");

  if (!stack) return;

  const el =
    document.createElement("div");

  el.className =
    `toast ${type}`;

  el.innerHTML = `

    <span class="toast-icon">
      ${type === "success" ? "✓" : "!"}
    </span>

    <div>

      <b>
        ${esc(title)}
      </b>

      <p>
        ${esc(message)}
      </p>

    </div>

  `;

  stack.appendChild(el);

  setTimeout(() => {

    el.style.opacity = "0";

    el.style.transform =
      "translateY(8px)";

    setTimeout(
      () => el.remove(),
      220
    );

  }, 4200);
}


/* ================= ROUTING ================= */

function validPage(id) {

  return Object.hasOwn(
    titles,
    id
  );

}


function go(id) {

  if (!validPage(id)) {
    id = "home";
  }

  if (
    location.hash !==
    `#${id}`
  ) {

    history.pushState(
      { page: id },
      "",
      `#${id}`
    );

  }

  showPage(id, false);

  closeSidebar();

}


function showPage(
  id,
  updateHash = true
) {

  if (!validPage(id)) {
    id = "home";
  }


  pages.forEach((page) => {

    page.classList.toggle(
      "active",
      page.id === id
    );

  });


  $$(".nav-item[data-page]")
    .forEach((item) => {

      item.classList.toggle(
        "active",
        item.dataset.page === id
      );

    });


  $("#pageKicker").textContent =
    titles[id][0];

  $("#pageTitle").textContent =
    titles[id][1];


  if (
    updateHash &&
    location.hash !== `#${id}`
  ) {

    history.pushState(
      { page: id },
      "",
      `#${id}`
    );

  }


  if (id === "documents") {
    loadDocs();
  }

  if (id === "compliance") {
    loadCompliance();
  }

  if (id === "sources") {
    loadSources();
  }


  window.scrollTo({
    top: 0,
    behavior:
      navigationReady
        ? "smooth"
        : "auto"
  });

}


function handleRoute() {

  const id =
    decodeURIComponent(
      location.hash.replace(
        /^#/,
        ""
      ) || "home"
    );

  showPage(
    validPage(id)
      ? id
      : "home",
    false
  );

  navigationReady = true;

}


/* ================= SIDEBAR ================= */

function toggleSidebar() {

  const sidebar =
    $("#sidebar");

  const open =
    sidebar.classList.toggle(
      "open"
    );

  $("#mobileOverlay")
    .classList.toggle(
      "show",
      open
    );

  $("#menuBtn")
    .setAttribute(
      "aria-expanded",
      String(open)
    );

}


function closeSidebar() {

  $("#sidebar")
    .classList.remove(
      "open"
    );

  $("#mobileOverlay")
    .classList.remove(
      "show"
    );

  $("#menuBtn")
    .setAttribute(
      "aria-expanded",
      "false"
    );

}


/* ================= MODALS ================= */

function openModal(el) {

  el.classList.add("show");

  el.setAttribute(
    "aria-hidden",
    "false"
  );

}


function closeModal(el) {

  el.classList.remove("show");

  el.setAttribute(
    "aria-hidden",
    "true"
  );

}


/* ================= AUTH ================= */

function openAuth(
  mode = "login"
) {

  authMode =
    mode === "register"
      ? "register"
      : "login";

  updateAuthUI();

  openModal(
    $("#authModal")
  );

  setTimeout(
    () => $("#email")?.focus(),
    80
  );

}


function closeAuth() {

  closeModal(
    $("#authModal")
  );

}


function updateAuthUI() {

  const register =
    authMode === "register";


  $("#authTitle").textContent =
    register
      ? "Create your account"
      : "Welcome back";


  $("#authSubtitle").textContent =
    register
      ? "Create your secure BIS Sahayak workspace."
      : "Sign in to access your private workspace.";


  $("#nameField").style.display =
    register
      ? "grid"
      : "none";


  $("#password").autocomplete =
    register
      ? "new-password"
      : "current-password";


  $("#authSubmit").textContent =
    register
      ? "Create account"
      : "Sign in";


  $("#switchAuth").textContent =
    register
      ? "Already have an account? Sign in"
      : "New here? Create an account";


  $("#authMsg").textContent = "";

}


function updateAccountUI(
  user
) {

  currentUser =
    user || null;

  const signed =
    isSignedIn();


  const label =
    signed
      ? (
          user?.name?.split(" ")[0]
          || "Account"
        )
      : "Sign in";


  $("#accountTopBtn")
    .textContent =
    label;


  $("#accountSideText")
    .textContent =
    signed
      ? "My account"
      : "Sign in";


  if (signed) {

    const name =
      user?.name ||
      "Account";


    $("#profileName")
      .textContent =
      name;


    $("#profileEmail")
      .textContent =
      user?.email || "";


    $("#profileAvatar")
      .textContent =
      name
        .trim()
        .charAt(0)
        .toUpperCase()
      || "B";

  } else {

    $("#profileName")
      .textContent =
      "Account";

    $("#profileEmail")
      .textContent =
      "";

  }

}


/* ================= SESSION ================= */

async function refreshSession(
  silent = false
) {

  if (!isSignedIn()) {

    updateAccountUI(null);

    return null;

  }


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.dashboard,
      {
        headers:
          authHeaders()
      }
    );


    if (!r.ok) {

      localStorage.removeItem(
        tokenKey
      );

      updateAccountUI(null);

      if (!silent) {

        toast(
          "Session expired",
          "Please sign in again.",
          "error"
        );

      }

      return null;

    }


    updateAccountUI(
      d.user || null
    );


    return d;

  } catch {

    updateAccountUI(
      currentUser
    );

    return null;

  }

}


/* ================= SIGN IN / REGISTER ================= */

async function submitAuth(e) {

  e.preventDefault();


  const register =
    authMode === "register";


  const name =
    $("#name")
      .value
      .trim();


  const email =
    $("#email")
      .value
      .trim();


  const password =
    $("#password")
      .value;


  if (
    register &&
    !name
  ) {

    $("#authMsg").textContent =
      "Please enter your full name.";

    return;

  }


  if (
    !email ||
    !password
  ) {

    $("#authMsg").textContent =
      "Please complete the required fields.";

    return;

  }


  if (
    register &&
    password.length < 8
  ) {

    $("#authMsg").textContent =
      "Password must be at least 8 characters.";

    return;

  }


  const button =
    $("#authSubmit");


  button.disabled = true;

  button.textContent =
    register
      ? "Creating…"
      : "Signing in…";


  try {

    const {
      r,
      d
    } = await apiJSON(
      register
        ? API.register
        : API.login,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            register
              ? {
                  name,
                  email,
                  password
                }
              : {
                  email,
                  password
                }
          )
      }
    );


    if (!r.ok) {

      $("#authMsg")
        .textContent =
        d.error ||
        d.message ||
        "Authentication failed.";

      return;

    }


    /*
      IMPORTANT:
      Backend should return:
      {
        token: "...",
        user: {
          name: "...",
          email: "..."
        }
      }
    */

    if (d.token) {

      localStorage.setItem(
        tokenKey,
        d.token
      );


      updateAccountUI(
        d.user || {
          name,
          email
        }
      );


      closeAuth();

      $("#authForm")
        .reset();


      /*
        USER REQUEST:
        Successful sign-in notification.
      */

      toast(
        register
          ? "Account created"
          : "Signed in successfully",
        register
          ? "Your account is ready."
          : "Thank you for signing in. Welcome back!"
      );


      await refreshSession(
        true
      );


      loadDocs();

      loadCompliance();


      return;

    }


    /*
      Registration endpoint may
      create account without returning
      a token.
    */

    if (register) {

      authMode = "login";

      updateAuthUI();

      $("#email").value =
        email;

      $("#authMsg")
        .textContent =
        "Account created. Please sign in.";

      toast(
        "Account created",
        "Now sign in to enter your workspace."
      );

    } else {

      $("#authMsg")
        .textContent =
        d.message ||
        "Signed in, but no session token was returned.";

      toast(
        "Sign-in response received",
        "The server did not return a session token.",
        "error"
      );

    }

  } catch {

    $("#authMsg")
      .textContent =
      "Authentication service unavailable.";

    toast(
      "Connection problem",
      "Could not reach the authentication service.",
      "error"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      register
        ? "Create account"
        : "Sign in";

  }

}


/* ================= ACCOUNT ================= */

function signOut() {

  localStorage.removeItem(
    tokenKey
  );

  currentUser = null;

  updateAccountUI(null);

  closeModal(
    $("#accountModal")
  );

  go("home");

  toast(
    "Signed out",
    "Your local session has been cleared."
  );

}


function showAccount() {

  if (!isSignedIn()) {

    openAuth("login");

    return;

  }


  updateAccountUI(
    currentUser
  );

  openModal(
    $("#accountModal")
  );

}


/* ================= AI CHAT ================= */

function addMessage(
  text,
  type = "bot",
  sources = []
) {

  const box =
    $("#messages");


  const wrap =
    document.createElement(
      "div"
    );


  wrap.className =
    `message ${type}`;


  const sourceHTML =
    sources.length
      ? `
        <small>
          Sources:
          ${sources
            .map(
              (source) =>
                `
                <a
                  href="${esc(source.url)}"
                  target="_blank"
                  rel="noopener noreferrer">

                  ${esc(
                    source.title ||
                    "Source"
                  )}

                </a>
                `
            )
            .join(" • ")}
        </small>
      `
      : "";


  wrap.innerHTML = `

    <div class="message-avatar">

      ${type === "user"
        ? "●"
        : "✦"}

    </div>


    <div class="bubble">

      <b>
        ${
          type === "user"
            ? "You"
            : "BIS Sahayak"
        }
      </b>


      <p>
        ${esc(text)}
      </p>


      ${sourceHTML}


      <span class="message-time">
        Just now
      </span>

    </div>

  `;


  box.appendChild(
    wrap
  );


  box.scrollTop =
    box.scrollHeight;


  return wrap;

}


async function send(q) {

  q =
    (q || "").trim();


  if (!q) return;


  addMessage(
    q,
    "user"
  );


  $("#chatInput")
    .value = "";


  const waiting =
    addMessage(
      "Thinking…",
      "bot"
    );


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.chat,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...authHeaders()
        },

        body:
          JSON.stringify({
            message: q,

            language:
              $("#lang").value,

            live:
              $("#liveToggle")
                .checked
          })
      }
    );


    waiting.remove();


    if (!r.ok) {

      addMessage(
        d.error ||
        "The assistant could not process this request.",
        "bot"
      );

      return;

    }


    addMessage(
      d.answer ||
      "No answer returned.",
      "bot",
      d.sources || []
    );

  } catch {

    waiting.remove();


    addMessage(
      "Connection unavailable. Please check that BIS Sahayak is running."
    );

  }

}


function quickPrompt(q) {

  go("assistant");


  setTimeout(() => {

    if (q) {

      send(q);

    } else {

      $("#chatInput")
        ?.focus();

    }

  }, 140);

}


/* ================= DOCUMENTS ================= */

async function loadDocs() {

  const tbody =
    $("#docs");


  if (!tbody) return;


  if (!isSignedIn()) {

    tbody.innerHTML =
      `
      <tr>
        <td colspan="4">
          Sign in to use your private document vault.
        </td>
      </tr>
      `;


    $("#docStats").innerHTML =
      `
      <div class="stat-card">
        <b>—</b>
        <span>Sign in required</span>
      </div>

      <div class="stat-card">
        <b>—</b>
        <span>Renewals</span>
      </div>

      <div class="stat-card">
        <b>—</b>
        <span>Actions</span>
      </div>
      `;

    return;

  }


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.dashboard,
      {
        headers:
          authHeaders()
      }
    );


    if (!r.ok) {

      tbody.innerHTML =
        `
        <tr>
          <td colspan="4">
            Your session has expired.
            Please sign in again.
          </td>
        </tr>
        `;

      return;

    }


    const summary =
      d.summary || {};


    $("#docStats").innerHTML =
      `
      <div class="stat-card">

        <b>
          ${summary.valid ?? 0}
        </b>

        <span>
          Valid / active
        </span>

      </div>


      <div class="stat-card">

        <b>
          ${summary.renew ?? 0}
        </b>

        <span>
          Renew soon
        </span>

      </div>


      <div class="stat-card">

        <b>
          ${summary.action ?? 0}
        </b>

        <span>
          Actions pending
        </span>

      </div>
      `;


    const docs =
      d.documents || [];


    tbody.innerHTML =
      docs
        .map((x) => {

          const renew =
            x.expiry &&
            new Date(x.expiry) <
              new Date(
                Date.now() +
                30 * 864e5
              );


          return `
            <tr>

              <td>
                ${esc(x.name)}
              </td>

              <td>
                ${esc(
                  x.status ||
                  "Registered"
                )}
              </td>

              <td>
                ${
                  x.expiry
                    ? new Date(
                        x.expiry
                      ).toLocaleDateString()
                    : "Not set"
                }
              </td>

              <td>
                ${
                  renew
                    ? "Review / renew"
                    : "Monitor"
                }
              </td>

            </tr>
          `;

        })
        .join("")
      ||
      `
      <tr>
        <td colspan="4">
          No documents registered yet.
          Upload one to begin.
        </td>
      </tr>
      `;

  } catch {

    tbody.innerHTML =
      `
      <tr>
        <td colspan="4">
          Unable to load documents right now.
        </td>
      </tr>
      `;

  }

}


async function uploadDocument(
  file
) {

  if (!file) return;


  if (!isSignedIn()) {

    $("#file").value = "";

    openAuth(
      "login"
    );

    return;

  }


  const formData =
    new FormData();


  formData.append(
    "document",
    file
  );


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.upload,
      {
        method: "POST",

        headers:
          authHeaders(),

        body:
          formData
      }
    );


    if (!r.ok) {

      toast(
        "Upload failed",
        d.error ||
        "The server rejected the document.",
        "error"
      );

      return;

    }


    toast(
      "Document uploaded",
      d.message ||
      "Your document was added to the vault."
    );


    await loadDocs();

  } catch {

    toast(
      "Upload failed",
      "Could not reach the document service.",
      "error"
    );

  } finally {

    $("#file").value = "";

  }

}


/* ================= COMPLIANCE ================= */

async function loadCompliance() {

  const tasks =
    $("#tasks");


  if (!tasks) return;


  if (!isSignedIn()) {

    tasks.innerHTML =
      `
      <div class="task">

        <h3>
          Sign in to enable compliance tracking
        </h3>

        <p>
          Your personal compliance tasks
          are loaded from the authenticated dashboard.
        </p>

      </div>
      `;

    $("#compStats").innerHTML =
      "";

    return;

  }


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.dashboard,
      {
        headers:
          authHeaders()
      }
    );


    if (!r.ok) {

      tasks.innerHTML =
        `
        <div class="task">

          <h3>
            Session expired
          </h3>

          <p>
            Please sign in again.
          </p>

        </div>
        `;

      return;

    }


    const summary =
      d.summary || {};


    $("#compStats").innerHTML =
      `
      <div class="stat-card">

        <b>
          ${summary.action ?? 0}
        </b>

        <span>
          Needs action
        </span>

      </div>


      <div class="stat-card">

        <b>
          ${summary.renew ?? 0}
        </b>

        <span>
          Documents renewing soon
        </span>

      </div>


      <div class="stat-card">

        <b>
          ${d.queries ?? 0}
        </b>

        <span>
          AI interactions
        </span>

      </div>
      `;


    tasks.innerHTML =
      (d.compliance || [])
        .map(
          (x) =>
            `
            <article class="task">

              <span class="status">
                ${esc(
                  x.status ||
                  "review"
                )}
              </span>


              <h3>
                ${esc(x.title)}
              </h3>


              <p>
                ${esc(
                  x.action ||
                  "Review requirement and verify the current official source."
                )}
              </p>


              <small>
                Due:
                ${
                  x.dueDate
                    ? new Date(
                        x.dueDate
                      ).toLocaleDateString()
                    : "Not set"
                }
              </small>

            </article>
            `
        )
        .join("")
      ||
      `
      <div class="task">

        <h3>
          No compliance tasks yet
        </h3>

        <p>
          Add your first task to start tracking.
        </p>

      </div>
      `;

  } catch {

    tasks.innerHTML =
      `
      <div class="task">

        <h3>
          Unable to load compliance
        </h3>

        <p>
          Please check your connection and try again.
        </p>

      </div>
      `;

  }

}


async function addCompliance() {

  if (!isSignedIn()) {

    openAuth(
      "login"
    );

    return;

  }


  const title =
    prompt(
      "Compliance task name"
    );


  if (!title?.trim()) {
    return;
  }


  const due =
    prompt(
      "Due date YYYY-MM-DD (optional)"
    ) || "";


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.compliance,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...authHeaders()
        },

        body:
          JSON.stringify({
            title:
              title.trim(),

            status:
              "review",

            dueDate:
              due,

            category:
              "business",

            action:
              "Review requirement and verify the current official source."
          })
      }
    );


    if (!r.ok) {

      toast(
        "Could not create task",
        d.error ||
        "The server rejected the task.",
        "error"
      );

      return;

    }


    toast(
      "Task added",
      "Your compliance task was saved."
    );


    loadCompliance();

  } catch {

    toast(
      "Connection problem",
      "Could not save the task.",
      "error"
    );

  }

}


/* ================= SOURCES ================= */

function renderSources(
  list
) {

  $("#sourceGrid")
    .innerHTML =
    list
      .map(
        (x) =>
          `
          <article class="source">

            <small>
              ${esc(
                x.kind ||
                "OFFICIAL"
              )}
            </small>


            <h3>
              ${esc(x.title)}
            </h3>


            <p>
              Reference for verification
              and current information.
            </p>


            <a
              href="${esc(x.url)}"
              target="_blank"
              rel="noopener noreferrer">

              Open source ↗

            </a>

          </article>
          `
      )
      .join("");

}


async function loadSources() {

  try {

    const {
      r,
      d
    } = await apiJSON(
      API.sources
    );


    if (!r.ok) {
      throw 0;
    }


    const list =
      Array.isArray(d)
        ? d
        : (
            d.sources ||
            []
          );


    renderSources(
      list.length
        ? list
        : officialFallbackSources
    );

  } catch {

    renderSources(
      officialFallbackSources
    );

  }

}


/* ================= LIVE SEARCH ================= */

async function liveSearch() {

  const q =
    prompt(
      "What current BIS information do you want to search?"
    );


  if (!q?.trim()) {
    return;
  }


  $("#liveResults")
    .innerHTML =
    "<div>Searching current sources…</div>";


  try {

    const {
      r,
      d
    } = await apiJSON(
      API.liveSearch,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...authHeaders()
        },

        body:
          JSON.stringify({
            query:
              q.trim()
          })
      }
    );


    const results =
      d.results || [];


    $("#liveResults")
      .innerHTML =
      results.length
        ? results
            .map(
              (x) =>
                `
                <div>

                  <b>
                    ${esc(
                      x.title ||
                      "Live result"
                    )}
                  </b>

                  <p>
                    ${esc(
                      x.snippet ||
                      x.description ||
                      ""
                    )}
                  </p>

                  ${
                    x.url
                      ? `
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href="${esc(x.url)}">

                          Open ↗

                        </a>
                      `
                      : ""
                  }

                </div>
                `
            )
            .join("")
        : `
          <div>
            No live-search connector is configured.
            Official BIS links remain available above.
          </div>
        `;

  } catch {

    $("#liveResults")
      .innerHTML =
      `
      <div>
        Live search is currently unavailable.
        Official BIS links remain available above.
      </div>
      `;

  }

}


/* ================= THEME ================= */

function toggleTheme() {

  document.body
    .classList
    .toggle("dark");


  const dark =
    document.body
      .classList
      .contains("dark");


  localStorage.theme =
    dark
      ? "dark"
      : "light";


  $("#themeIcon")
    .textContent =
    dark
      ? "☀"
      : "☾";


  $("#themeBtn")
    .lastElementChild
    .textContent =
    dark
      ? "Light mode"
      : "Dark mode";

}


/* ================= HEALTH ================= */

async function health() {

  try {

    const {
      r,
      d
    } = await apiJSON(
      API.health
    );


    if (!r.ok) {
      throw 0;
    }


    const pill =
      $("#connection");


    const title =
      $("#aiStatusTitle");


    const text =
      $("#aiStatusText");


    if (d.onlineAI) {

      pill.innerHTML =
        `
        <span class="pulse-dot"></span>
        <span>Online AI ready</span>
        `;


      title.textContent =
        "Online AI ready";


      text.textContent =
        "The configured online AI service is reachable.";

    }

    else if (d.ollama) {

      pill.innerHTML =
        `
        <span class="pulse-dot"></span>
        <span>Local AI ready</span>
        `;


      title.textContent =
        "Local AI ready";


      text.textContent =
        "Online AI is unavailable, but the configured local fallback is available.";

    }

    else {

      pill.innerHTML =
        `
        <span class="pulse-dot"></span>
        <span>Backend connected</span>
        `;


      title.textContent =
        "Backend connected";


      text.textContent =
        "Core application services are reachable.";

    }

  } catch {

    $("#connection")
      .innerHTML =
      `
      <span
        class="pulse-dot"
        style="background:#c93b4b">
      </span>

      <span>
        Backend offline
      </span>
      `;


    $("#aiStatusTitle")
      .textContent =
      "Backend unavailable";


    $("#aiStatusText")
      .textContent =
      "Start the BIS Sahayak backend to use live account, AI and dashboard features.";

  }

}


/* ================= EVENTS ================= */

$$("[data-page]")
  .forEach((el) => {

    el.addEventListener(
      "click",
      (e) => {

        e.preventDefault();

        const page =
          el.dataset.page;

        const prompt =
          el.dataset.prompt;


        go(page);


        if (prompt) {

          setTimeout(
            () =>
              quickPrompt(prompt),
            100
          );

        }

      }
    );

  });


$$("[data-prompt]")
  .forEach((el) => {

    el.addEventListener(
      "click",
      () =>
        quickPrompt(
          el.dataset.prompt
        )
    );

  });


$("#menuBtn")
  .addEventListener(
    "click",
    toggleSidebar
  );


$("#closeSidebar")
  .addEventListener(
    "click",
    closeSidebar
  );


$("#mobileOverlay")
  .addEventListener(
    "click",
    closeSidebar
  );


$("#accountTopBtn")
  .addEventListener(
    "click",
    showAccount
  );


$("#accountSideBtn")
  .addEventListener(
    "click",
    showAccount
  );


$("#themeBtn")
  .addEventListener(
    "click",
    toggleTheme
  );


$("#homeBtn")
  .addEventListener(
    "click",
    () => go("home")
  );


$("#backBtn")
  .addEventListener(
    "click",
    () => history.back()
  );


$("#chatForm")
  .addEventListener(
    "submit",
    (e) => {

      e.preventDefault();

      send(
        $("#chatInput").value
      );

    }
  );


$("#uploadBtn")
  .addEventListener(
    "click",
    () =>
      isSignedIn()
        ? $("#file").click()
        : openAuth("login")
  );


$("#file")
  .addEventListener(
    "change",
    (e) =>
      uploadDocument(
        e.target.files[0]
      )
  );


$("#refreshDocs")
  .addEventListener(
    "click",
    loadDocs
  );


$("#addTaskBtn")
  .addEventListener(
    "click",
    addCompliance
  );


$("#liveSearchBtn")
  .addEventListener(
    "click",
    liveSearch
  );


$("#authForm")
  .addEventListener(
    "submit",
    submitAuth
  );


$("#switchAuth")
  .addEventListener(
    "click",
    () => {

      authMode =
        authMode === "login"
          ? "register"
          : "login";

      updateAuthUI();

    }
  );


$("#authClose")
  .addEventListener(
    "click",
    closeAuth
  );


$("#accountClose")
  .addEventListener(
    "click",
    () =>
      closeModal(
        $("#accountModal")
      )
  );


$("#accountRefresh")
  .addEventListener(
    "click",
    async () => {

      await refreshSession();

      toast(
        "Session refreshed",
        "Your account data was checked again."
      );

    }
  );


$("#signOutBtn")
  .addEventListener(
    "click",
    signOut
  );


[
  "#authModal",
  "#accountModal"
].forEach((id) => {

  $(id).addEventListener(
    "click",
    (e) => {

      if (
        e.target ===
        e.currentTarget
      ) {

        closeModal(
          e.currentTarget
        );

      }

    }
  );

});


document.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "Escape") {

      closeAuth();

      closeModal(
        $("#accountModal")
      );

      closeSidebar();

    }


    if (
      e.key === "/" &&
      ![
        "INPUT",
        "TEXTAREA",
        "SELECT"
      ].includes(
        document.activeElement.tagName
      )
    ) {

      e.preventDefault();

      go("assistant");

      setTimeout(
        () =>
          $("#chatInput")
            .focus(),
        100
      );

    }

  }
);


window.addEventListener(
  "hashchange",
  handleRoute
);


window.addEventListener(
  "popstate",
  handleRoute
);


/* ================= STARTUP ================= */

if (
  localStorage.theme ===
  "dark"
) {

  document.body
    .classList
    .add("dark");

  $("#themeIcon")
    .textContent =
    "☀";

  $("#themeBtn")
    .lastElementChild
    .textContent =
    "Light mode";

}


handleRoute();

loadSources();

refreshSession(true);

health();