const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const SLOT_HEIGHT = 30;
const LOCKED_REPOSITORY = Object.freeze({
  owner: "GogulnathSA123",
  repo: "RTX-5090-page",
  branch: "main",
  path: "data/bookings.json"
});
const LOCAL_DATA_KEY = "rtx5090:data";
const SETTINGS_KEY = "rtx5090:github-settings";
const TOKEN_KEY = "rtx5090:github-token";
const SESSION_TOKEN_KEY = "rtx5090:session-token";
const LOGIN_KEY = "rtx5090:mail-login";
const ACCOUNTS_KEY = "rtx5090:accounts";
const MEMBER_COLORS = ["#127c78", "#c98624", "#416984", "#2f7d55", "#8a5a9e", "#c75945", "#586f9e"];

const DEFAULT_DATA = {
  systemName: "RTX 5090",
  members: [],
  bookings: [],
  updatedAt: new Date().toISOString()
};

const state = {
  data: clone(DEFAULT_DATA),
  selectedDate: todayISO(),
  settings: {
    ...LOCKED_REPOSITORY,
    rememberToken: false
  },
  currentUser: null,
  token: "",
  remoteSha: "",
  isSaving: false
};

const els = {
  syncMode: document.querySelector("#syncMode"),
  syncDetail: document.querySelector("#syncDetail"),
  syncNowButton: document.querySelector("#syncNowButton"),
  statusCard: document.querySelector("#statusCard"),
  currentStatus: document.querySelector("#currentStatus"),
  currentStatusMeta: document.querySelector("#currentStatusMeta"),
  nextSlot: document.querySelector("#nextSlot"),
  nextSlotMeta: document.querySelector("#nextSlotMeta"),
  todayHours: document.querySelector("#todayHours"),
  todayHoursMeta: document.querySelector("#todayHoursMeta"),
  weekHours: document.querySelector("#weekHours"),
  weekHoursMeta: document.querySelector("#weekHoursMeta"),
  currentMember: document.querySelector("#currentMember"),
  bookingForm: document.querySelector("#bookingForm"),
  signInTab: document.querySelector("#signInTab"),
  signUpTab: document.querySelector("#signUpTab"),
  signInForm: document.querySelector("#signInForm"),
  signUpForm: document.querySelector("#signUpForm"),
  signInEmail: document.querySelector("#signInEmail"),
  signInPassword: document.querySelector("#signInPassword"),
  signUpName: document.querySelector("#signUpName"),
  signUpEmail: document.querySelector("#signUpEmail"),
  signUpPassword: document.querySelector("#signUpPassword"),
  signUpConfirm: document.querySelector("#signUpConfirm"),
  accountStatus: document.querySelector("#accountStatus"),
  authState: document.querySelector("#authState"),
  signOutButton: document.querySelector("#signOutButton"),
  bookingDate: document.querySelector("#bookingDate"),
  startTime: document.querySelector("#startTime"),
  duration: document.querySelector("#duration"),
  bookingTitleInput: document.querySelector("#bookingTitleInput"),
  timelineDate: document.querySelector("#timelineDate"),
  timelineCanvas: document.querySelector("#timelineCanvas"),
  upcomingList: document.querySelector("#upcomingList"),
  usageList: document.querySelector("#usageList"),
  openWindowList: document.querySelector("#openWindowList"),
  githubForm: document.querySelector("#githubForm"),
  lockedRepoName: document.querySelector("#lockedRepoName"),
  lockedRepoMeta: document.querySelector("#lockedRepoMeta"),
  githubToken: document.querySelector("#githubToken"),
  rememberToken: document.querySelector("#rememberToken"),
  clearTokenButton: document.querySelector("#clearTokenButton"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  loadLogin();
  loadSettings();
  populateTimeOptions();
  wireEvents();

  els.bookingDate.value = todayISO();
  els.timelineDate.value = state.selectedDate;

  await loadInitialData();
  ensureCurrentMember();
  render();
}

function wireEvents() {
  els.bookingForm.addEventListener("submit", handleBookingSubmit);
  els.timelineDate.addEventListener("change", () => {
    state.selectedDate = els.timelineDate.value || todayISO();
    renderTimeline();
    renderOpenWindows();
  });
  els.syncNowButton.addEventListener("click", () => syncFromGithub());
  els.signInTab.addEventListener("click", () => setAuthMode("signin"));
  els.signUpTab.addEventListener("click", () => setAuthMode("signup"));
  els.signInForm.addEventListener("submit", handleSignInSubmit);
  els.signUpForm.addEventListener("submit", handleSignUpSubmit);
  els.signOutButton.addEventListener("click", handleSignOut);
  els.githubForm.addEventListener("submit", handleGithubSubmit);
  els.clearTokenButton.addEventListener("click", clearGithubToken);
  els.upcomingList.addEventListener("click", handleCancelClick);
}

function setAuthMode(mode) {
  const isSignUp = mode === "signup";
  els.signInTab.classList.toggle("is-active", !isSignUp);
  els.signUpTab.classList.toggle("is-active", isSignUp);
  els.signInTab.setAttribute("aria-selected", String(!isSignUp));
  els.signUpTab.setAttribute("aria-selected", String(isSignUp));
  els.signInForm.classList.toggle("is-hidden", isSignUp);
  els.signUpForm.classList.toggle("is-hidden", !isSignUp);
}

function handleSignInSubmit(event) {
  event.preventDefault();

  const email = normalizeEmail(els.signInEmail.value);
  const password = els.signInPassword.value;
  const account = getAccount(email);

  if (!isValidEmail(email)) {
    showToast("Enter a valid email address.");
    return;
  }

  if (!account) {
    setAuthMode("signup");
    els.signUpEmail.value = email;
    showToast("No account found. Create one first.");
    return;
  }

  if (account.passwordHash !== passwordHash(email, password)) {
    showToast("Password does not match.");
    return;
  }

  signInAccount(account);
  els.signInPassword.value = "";
  showToast(`Signed in as ${account.name}.`);
}

function handleSignUpSubmit(event) {
  event.preventDefault();

  const name = cleanName(els.signUpName.value);
  const email = normalizeEmail(els.signUpEmail.value);
  const password = els.signUpPassword.value;
  const confirm = els.signUpConfirm.value;

  if (!name) {
    showToast("Enter your name.");
    return;
  }

  if (!isValidEmail(email)) {
    showToast("Enter a valid email address.");
    return;
  }

  if (password.length < 4) {
    showToast("Password must be at least 4 characters.");
    return;
  }

  if (password !== confirm) {
    showToast("Passwords do not match.");
    return;
  }

  if (getAccount(email)) {
    setAuthMode("signin");
    els.signInEmail.value = email;
    showToast("Account already exists. Sign in instead.");
    return;
  }

  const account = {
    email,
    name,
    memberId: memberIdForEmail(email),
    passwordHash: passwordHash(email, password),
    createdAt: new Date().toISOString()
  };
  const accounts = loadAccounts();
  accounts.push(account);
  saveAccounts(accounts);
  signInAccount(account);
  els.signUpPassword.value = "";
  els.signUpConfirm.value = "";
  showToast(`Account created for ${name}.`);
}

function signInAccount(account) {
  state.currentUser = {
    email: account.email,
    name: account.name,
    memberId: account.memberId || memberIdForEmail(account.email)
  };
  localStorage.setItem(LOGIN_KEY, JSON.stringify(state.currentUser));
  ensureCurrentMember();
  render();
}

function handleSignOut() {
  state.currentUser = null;
  localStorage.removeItem(LOGIN_KEY);
  els.signInPassword.value = "";
  render();
  showToast("Signed out.");
}

async function loadInitialData() {
  if (hasGithubTarget()) {
    try {
      await syncFromGithub({ silent: true });
      return;
    } catch (error) {
      showToast(error.message || "GitHub sync failed.");
    }
  }

  const local = readJson(localStorage.getItem(LOCAL_DATA_KEY));
  if (local) {
    state.data = normalizeData(local);
    ensureCurrentMember();
    updateSyncStatus("GitHub read-only", "Using cached bookings for the locked repo.");
    return;
  }

  try {
    const response = await fetch("./data/bookings.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Data file unavailable.");
    state.data = normalizeData(await response.json());
  } catch {
    state.data = normalizeData(DEFAULT_DATA);
  }

  ensureCurrentMember();
  updateSyncStatus("GitHub read-only", "Locked to GogulnathSA123/RTX-5090-page.");
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  if (state.isSaving) return;

  const draft = buildDraftBooking();
  if (!draft) return;

  try {
    state.isSaving = true;
    await refreshBeforeWrite();
    ensureCurrentMember();

    const conflict = findConflict(draft);
    if (conflict) {
      showToast(`Conflict: ${memberName(conflict.memberId)} already has ${conflict.start}-${conflict.end}.`);
      return;
    }

    state.data.bookings.push(draft);
    state.data.updatedAt = new Date().toISOString();
    render();

    await persistData();
    els.bookingForm.reset();
    els.bookingDate.value = draft.date;
    els.timelineDate.value = draft.date;
    state.selectedDate = draft.date;
    render();
    showToast("Booking saved.");
  } catch (error) {
    state.data.bookings = state.data.bookings.filter((booking) => booking.id !== draft.id);
    render();
    showToast(error.message || "Booking could not be saved.");
  } finally {
    state.isSaving = false;
  }
}

function buildDraftBooking() {
  const member = ensureCurrentMember();
  const date = els.bookingDate.value;
  const start = els.startTime.value;
  const duration = Number(els.duration.value);
  const title = els.bookingTitleInput.value.trim();

  if (!member) {
    showToast("Sign in with email before booking.");
    return null;
  }

  if (!date || !start || !duration || !title) {
    showToast("Complete all booking fields.");
    return null;
  }

  const startMinutes = timeToMinutes(start);
  const endMinutes = startMinutes + duration;

  if (startMinutes < DAY_START || endMinutes > DAY_END) {
    showToast("Bookings must stay between 08:00 and 22:00.");
    return null;
  }

  return {
    id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    memberId: member.id,
    memberName: member.name,
    memberEmail: member.email,
    date,
    start,
    end: minutesToTime(endMinutes),
    title,
    createdAt: new Date().toISOString()
  };
}

async function handleCancelClick(event) {
  const button = event.target.closest("[data-cancel-id]");
  if (!button || state.isSaving) return;

  const id = button.dataset.cancelId;
  const previous = clone(state.data.bookings);

  try {
    state.isSaving = true;
    await refreshBeforeWrite();
    state.data.bookings = state.data.bookings.filter((booking) => booking.id !== id);
    state.data.updatedAt = new Date().toISOString();
    render();
    await persistData();
    showToast("Booking cancelled.");
  } catch (error) {
    state.data.bookings = previous;
    render();
    showToast(error.message || "Booking could not be cancelled.");
  } finally {
    state.isSaving = false;
  }
}

async function handleGithubSubmit(event) {
  event.preventDefault();

  state.settings = {
    ...LOCKED_REPOSITORY,
    rememberToken: els.rememberToken.checked
  };
  state.token = els.githubToken.value.trim();
  saveSettings();

  try {
    await syncFromGithub();
    showToast("GitHub connected.");
  } catch (error) {
    showToast(error.message || "GitHub connection failed.");
  }
}

async function syncFromGithub(options = {}) {
  if (!hasGithubTarget()) {
    updateSyncStatus("GitHub unavailable", "Repository target is locked but unavailable.");
    if (!options.silent) showToast("Locked repository target is unavailable.");
    return;
  }

  updateSyncStatus("Syncing", `${state.settings.owner}/${state.settings.repo}`);
  const remote = await fetchGithubData();
  state.data = normalizeData(remote.data);
  state.remoteSha = remote.sha;
  ensureCurrentMember();
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(state.data));
  updateSyncStatus(state.token ? "GitHub connected" : "GitHub read-only", `${state.settings.owner}/${state.settings.repo}:${state.settings.branch}`);
  render();

  if (!options.silent) showToast("Bookings synced.");
}

async function refreshBeforeWrite() {
  if (hasGithubTarget()) {
    await syncFromGithub({ silent: true });
  }
}

async function persistData() {
  state.data = normalizeData(state.data);
  ensureCurrentMember();
  state.data.updatedAt = new Date().toISOString();

  if (hasGithubTarget()) {
    if (!state.token) {
      throw new Error("A GitHub token is required to save shared bookings.");
    }

    await saveGithubData();
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(state.data));
    updateSyncStatus("GitHub connected", `${state.settings.owner}/${state.settings.repo}:${state.settings.branch}`);
    return;
  }

  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(state.data));
  updateSyncStatus("GitHub read-only", "Stored locally because GitHub is unavailable.");
}

async function fetchGithubData() {
  const url = githubContentUrl();
  const response = await fetch(url, {
    headers: githubHeaders()
  });

  if (!response.ok) {
    throw new Error(await githubError(response, "Could not load GitHub data."));
  }

  const payload = await response.json();
  const content = decodeBase64(payload.content || "");
  return {
    data: JSON.parse(content),
    sha: payload.sha
  };
}

async function saveGithubData() {
  const latest = await fetchGithubData();
  if (state.remoteSha && latest.sha !== state.remoteSha) {
    state.data = normalizeData(latest.data);
    state.remoteSha = latest.sha;
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(state.data));
    render();
    throw new Error("Schedule changed on GitHub. Sync and try again.");
  }

  state.remoteSha = latest.sha;

  const response = await fetch(githubContentUrl(), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify({
      message: `chore: update lab PC bookings ${new Date().toISOString()}`,
      content: encodeBase64(JSON.stringify(state.data, null, 2) + "\n"),
      branch: state.settings.branch,
      sha: state.remoteSha
    })
  });

  if (!response.ok) {
    throw new Error(await githubError(response, "Could not save GitHub data."));
  }

  const payload = await response.json();
  state.remoteSha = payload.content?.sha || "";
}

function githubContentUrl() {
  const owner = encodeURIComponent(state.settings.owner);
  const repo = encodeURIComponent(state.settings.repo);
  const path = state.settings.path.split("/").map(encodeURIComponent).join("/");
  const ref = encodeURIComponent(state.settings.branch || "main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
    headers["X-GitHub-Api-Version"] = "2022-11-28";
  }

  return headers;
}

async function githubError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.message ? `${fallback} ${payload.message}` : fallback;
  } catch {
    return fallback;
  }
}

function render() {
  renderAccount();
  renderBookingIdentity();
  renderDashboard();
  renderTimeline();
  renderUpcoming();
  renderUsage();
  renderOpenWindows();
  renderGithubForm();
}

function renderDashboard() {
  const nowBooking = currentBooking();
  const next = nextBooking();
  const todayMinutes = minutesBookedForDate(todayISO());
  const weekMinutes = minutesBookedForWeek(new Date());

  els.statusCard.classList.toggle("is-open", !nowBooking);
  els.statusCard.classList.toggle("is-booked", Boolean(nowBooking));

  if (nowBooking) {
    els.currentStatus.textContent = "Booked now";
    els.currentStatusMeta.textContent = `${memberName(nowBooking.memberId)} until ${nowBooking.end}`;
  } else {
    els.currentStatus.textContent = "Available";
    els.currentStatusMeta.textContent = next ? `Next booking starts ${formatBookingStart(next)}` : "No upcoming booking";
  }

  if (next) {
    els.nextSlot.textContent = formatBookingStart(next);
    els.nextSlotMeta.textContent = `${memberName(next.memberId)} - ${next.title}`;
  } else {
    els.nextSlot.textContent = "--";
    els.nextSlotMeta.textContent = "No upcoming booking";
  }

  els.todayHours.textContent = formatDuration(todayMinutes);
  els.todayHoursMeta.textContent = `${countBookingsForDate(todayISO())} booking${countBookingsForDate(todayISO()) === 1 ? "" : "s"} today`;
  els.weekHours.textContent = formatDuration(weekMinutes);
  els.weekHoursMeta.textContent = `${activeBookings().length} active booking${activeBookings().length === 1 ? "" : "s"}`;
}

function renderTimeline() {
  const bookings = activeBookings()
    .filter((booking) => booking.date === state.selectedDate)
    .sort(compareBookings);

  els.timelineCanvas.innerHTML = "";
  els.timelineCanvas.style.minHeight = `${((DAY_END - DAY_START) / 30) * SLOT_HEIGHT}px`;

  for (let minutes = DAY_START; minutes <= DAY_END; minutes += 60) {
    const top = ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100;
    const marker = document.createElement("div");
    marker.className = "hour-marker";
    marker.style.top = `${top}%`;

    const label = document.createElement("span");
    label.className = "hour-label";
    label.style.top = `${top}%`;
    label.textContent = minutesToTime(minutes);

    els.timelineCanvas.append(marker, label);
  }

  for (const booking of bookings) {
    const start = timeToMinutes(booking.start);
    const end = timeToMinutes(booking.end);
    const clampedStart = Math.max(start, DAY_START);
    const clampedEnd = Math.min(end, DAY_END);
    const top = ((clampedStart - DAY_START) / (DAY_END - DAY_START)) * 100;
    const height = ((clampedEnd - clampedStart) / (DAY_END - DAY_START)) * 100;
    const member = memberById(booking.memberId);

    const block = document.createElement("article");
    block.className = "booking-block";
    block.style.top = `${top}%`;
    block.style.height = `${Math.max(height, 4.8)}%`;
    block.style.setProperty("--booking-color", member.color);
    block.innerHTML = `
      <strong>${escapeHtml(booking.start)}-${escapeHtml(booking.end)} - ${escapeHtml(member.name)}</strong>
      <span>${escapeHtml(booking.title)}</span>
    `;
    els.timelineCanvas.append(block);
  }
}

function renderUpcoming() {
  const upcoming = activeBookings()
    .filter((booking) => bookingEndsAfterNow(booking))
    .sort(compareBookings)
    .slice(0, 8);

  if (!upcoming.length) {
    els.upcomingList.innerHTML = `<div class="empty-state">No upcoming bookings.</div>`;
    return;
  }

  els.upcomingList.innerHTML = upcoming
    .map((booking) => {
      const member = memberById(booking.memberId);
      return `
        <article class="booking-item" style="border-left: 5px solid ${escapeAttr(member.color)}">
          <div>
            <strong>${escapeHtml(member.name)} - ${escapeHtml(booking.title)}</strong>
            <span>${formatDate(booking.date)} - ${escapeHtml(booking.start)}-${escapeHtml(booking.end)}</span>
          </div>
          <button class="cancel-button" type="button" data-cancel-id="${escapeAttr(booking.id)}" aria-label="Cancel booking">x</button>
        </article>
      `;
    })
    .join("");
}

function renderUsage() {
  if (!state.data.members.length) {
    els.usageList.innerHTML = `<div class="empty-state">No signed-in members yet.</div>`;
    return;
  }

  const usage = state.data.members.map((member) => ({
    ...member,
    minutes: minutesBookedByMemberThisWeek(member.id)
  }));
  const maxMinutes = Math.max(60, ...usage.map((item) => item.minutes));

  els.usageList.innerHTML = usage
    .map((item) => {
      const width = Math.round((item.minutes / maxMinutes) * 100);
      return `
        <article class="usage-item">
          <div class="usage-row">
            <span>${escapeHtml(item.name)}</span>
            <span>${formatDuration(item.minutes)}</span>
          </div>
          <div class="usage-track">
            <div class="usage-fill" style="--usage-width: ${width}%; --member-color: ${escapeAttr(item.color)}"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderOpenWindows() {
  const gaps = availableWindows(state.selectedDate);
  if (!gaps.length) {
    els.openWindowList.innerHTML = `<div class="empty-state">Fully booked for this date.</div>`;
    return;
  }

  els.openWindowList.innerHTML = gaps
    .map((gap) => `
      <article class="open-window">
        ${escapeHtml(minutesToTime(gap.start))}-${escapeHtml(minutesToTime(gap.end))}
        <span>${formatDuration(gap.end - gap.start)}</span>
      </article>
    `)
    .join("");
}

function renderAccount() {
  if (state.currentUser) {
    els.signInEmail.value = state.currentUser.email;
    els.signUpEmail.value = state.currentUser.email;
    els.signUpName.value = state.currentUser.name;
    els.accountStatus.textContent = `Signed in as ${state.currentUser.name} (${state.currentUser.email}).`;
    els.authState.textContent = "Signed in";
    els.signOutButton.disabled = false;
    return;
  }

  els.accountStatus.textContent = "Sign in before booking.";
  els.authState.textContent = "Signed out";
  els.signOutButton.disabled = true;
}

function renderBookingIdentity() {
  const member = ensureCurrentMember();
  const submitButton = els.bookingForm.querySelector('button[type="submit"]');

  if (member) {
    els.currentMember.value = `${member.name} (${member.email})`;
    submitButton.disabled = false;
    return;
  }

  els.currentMember.value = "Sign in with email";
  submitButton.disabled = true;
}

function renderGithubForm() {
  els.lockedRepoName.textContent = `${LOCKED_REPOSITORY.owner}/${LOCKED_REPOSITORY.repo}`;
  els.lockedRepoMeta.textContent = `${LOCKED_REPOSITORY.branch} / ${LOCKED_REPOSITORY.path}`;
  els.rememberToken.checked = state.settings.rememberToken;
  if (!els.githubToken.value && state.token) {
    els.githubToken.value = state.token;
  }
}

function populateTimeOptions() {
  const options = [];
  for (let minutes = DAY_START; minutes < DAY_END; minutes += 30) {
    options.push(`<option value="${minutesToTime(minutes)}">${minutesToTime(minutes)}</option>`);
  }
  els.startTime.innerHTML = options.join("");
}

function updateSyncStatus(mode, detail) {
  els.syncMode.textContent = mode;
  els.syncDetail.textContent = detail;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3400);
}

function findConflict(draft) {
  const draftStart = timeToMinutes(draft.start);
  const draftEnd = timeToMinutes(draft.end);
  return activeBookings().find((booking) => {
    if (booking.id === draft.id || booking.date !== draft.date) return false;
    return intervalsOverlap(
      draftStart,
      draftEnd,
      timeToMinutes(booking.start),
      timeToMinutes(booking.end)
    );
  });
}

function availableWindows(date) {
  const bookings = activeBookings()
    .filter((booking) => booking.date === date)
    .sort(compareBookings);
  const gaps = [];
  let cursor = DAY_START;

  for (const booking of bookings) {
    const start = Math.max(DAY_START, timeToMinutes(booking.start));
    const end = Math.min(DAY_END, timeToMinutes(booking.end));
    if (start > cursor) gaps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }

  if (cursor < DAY_END) gaps.push({ start: cursor, end: DAY_END });
  return gaps.filter((gap) => gap.end - gap.start >= 30);
}

function currentBooking() {
  const now = new Date();
  const currentDate = dateISO(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return activeBookings().find((booking) => {
    if (booking.date !== currentDate) return false;
    return timeToMinutes(booking.start) <= currentMinutes && currentMinutes < timeToMinutes(booking.end);
  });
}

function nextBooking() {
  const now = new Date();
  return activeBookings()
    .filter((booking) => bookingEndsAfterNow(booking, now))
    .sort(compareBookings)[0];
}

function bookingEndsAfterNow(booking, now = new Date()) {
  const end = new Date(`${booking.date}T${booking.end}:00`);
  return end >= now;
}

function activeBookings() {
  return state.data.bookings.filter((booking) => booking.status !== "cancelled");
}

function minutesBookedForDate(date) {
  return activeBookings()
    .filter((booking) => booking.date === date)
    .reduce((sum, booking) => sum + bookingDuration(booking), 0);
}

function minutesBookedForWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return activeBookings()
    .filter((booking) => {
      const bookingDate = new Date(`${booking.date}T00:00:00`);
      return bookingDate >= start && bookingDate < end;
    })
    .reduce((sum, booking) => sum + bookingDuration(booking), 0);
}

function minutesBookedByMemberThisWeek(memberId) {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return activeBookings()
    .filter((booking) => {
      const bookingDate = new Date(`${booking.date}T00:00:00`);
      return booking.memberId === memberId && bookingDate >= start && bookingDate < end;
    })
    .reduce((sum, booking) => sum + bookingDuration(booking), 0);
}

function countBookingsForDate(date) {
  return activeBookings().filter((booking) => booking.date === date).length;
}

function bookingDuration(booking) {
  return timeToMinutes(booking.end) - timeToMinutes(booking.start);
}

function compareBookings(a, b) {
  return `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`);
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function memberById(id) {
  return state.data.members.find((member) => member.id === id) || {
    id,
    name: "Unknown member",
    email: "",
    color: "#687381"
  };
}

function memberName(id) {
  return memberById(id).name;
}

function normalizeData(raw) {
  const data = {
    ...clone(DEFAULT_DATA),
    ...(raw && typeof raw === "object" ? raw : {})
  };

  data.members = Array.isArray(data.members)
    ? data.members.map((member, index) => ({
        id: String(member.id || `member-${index + 1}`),
        name: String(member.name || `Member ${index + 1}`),
        email: member.email ? normalizeEmail(member.email) : "",
        color: member.color || colorForIndex(index)
      }))
    : [];

  data.bookings = Array.isArray(data.bookings)
    ? data.bookings
        .filter((booking) => booking && booking.id && booking.memberId && booking.date && booking.start && booking.end)
        .map((booking) => ({
          id: String(booking.id),
          memberId: String(booking.memberId),
          date: String(booking.date),
          start: String(booking.start),
          end: String(booking.end),
          title: String(booking.title || "Lab work"),
          memberName: booking.memberName ? String(booking.memberName) : "",
          memberEmail: booking.memberEmail ? normalizeEmail(booking.memberEmail) : "",
          createdAt: String(booking.createdAt || data.updatedAt || new Date().toISOString()),
          status: booking.status ? String(booking.status) : undefined
        }))
    : [];

  for (const booking of data.bookings) {
    if (!data.members.some((member) => member.id === booking.memberId)) {
      data.members.push({
        id: booking.memberId,
        name: booking.memberName || "Unknown member",
        email: booking.memberEmail || "",
        color: colorForIndex(data.members.length)
      });
    }
  }

  data.updatedAt = data.updatedAt || new Date().toISOString();
  return data;
}

function loadSettings() {
  const saved = readJson(localStorage.getItem(SETTINGS_KEY));
  state.settings = {
    ...LOCKED_REPOSITORY,
    rememberToken: Boolean(saved?.rememberToken)
  };

  state.token =
    (state.settings.rememberToken ? localStorage.getItem(TOKEN_KEY) : sessionStorage.getItem(SESSION_TOKEN_KEY)) ||
    "";
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rememberToken: state.settings.rememberToken }));
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);

  if (state.token) {
    const storage = state.settings.rememberToken ? localStorage : sessionStorage;
    storage.setItem(state.settings.rememberToken ? TOKEN_KEY : SESSION_TOKEN_KEY, state.token);
  }
}

function clearGithubToken() {
  state.token = "";
  els.githubToken.value = "";
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  updateSyncStatus("GitHub read-only", "Token cleared. Bookings still load from the locked repo.");
  showToast("Token cleared from this browser.");
}

function hasGithubTarget() {
  return true;
}

function loadLogin() {
  const saved = readJson(localStorage.getItem(LOGIN_KEY));
  if (!saved?.email) return;

  const email = normalizeEmail(saved.email);
  if (!email) return;

  state.currentUser = {
    email,
    name: cleanName(saved.name) || nameFromEmail(email),
    memberId: saved.memberId || memberIdForEmail(email)
  };
}

function loadAccounts() {
  const accounts = readJson(localStorage.getItem(ACCOUNTS_KEY));
  if (!Array.isArray(accounts)) return [];

  return accounts
    .filter((account) => account?.email && account?.passwordHash)
    .map((account) => ({
      email: normalizeEmail(account.email),
      name: cleanName(account.name) || nameFromEmail(account.email),
      memberId: account.memberId || memberIdForEmail(account.email),
      passwordHash: String(account.passwordHash),
      createdAt: account.createdAt || new Date().toISOString()
    }));
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getAccount(email) {
  const normalized = normalizeEmail(email);
  return loadAccounts().find((account) => account.email === normalized) || null;
}

function passwordHash(email, password) {
  return hashString(`${normalizeEmail(email)}:${String(password)}`).toString(36);
}

function ensureCurrentMember() {
  if (!state.currentUser) return null;

  const existing = state.data.members.find((member) => member.id === state.currentUser.memberId);
  if (existing) {
    existing.name = state.currentUser.name;
    existing.email = state.currentUser.email;
    existing.color = existing.color || colorForEmail(state.currentUser.email);
    return existing;
  }

  const member = {
    id: state.currentUser.memberId,
    name: state.currentUser.name,
    email: state.currentUser.email,
    color: colorForEmail(state.currentUser.email)
  };
  state.data.members.push(member);
  return member;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function nameFromEmail(email) {
  const localPart = email.split("@")[0] || "Member";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Member";
}

function memberIdForEmail(email) {
  return `mail-${hashString(normalizeEmail(email)).toString(36)}`;
}

function colorForEmail(email) {
  return MEMBER_COLORS[Math.abs(hashString(email)) % MEMBER_COLORS.length];
}

function colorForIndex(index) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

function hashString(value) {
  let hash = 5381;
  for (const char of String(value)) {
    hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  }
  return hash >>> 0;
}

function normalizePath(path) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatBookingStart(booking) {
  const date = booking.date === todayISO() ? "Today" : formatDate(booking.date);
  return `${date} ${booking.start}`;
}

function todayISO() {
  return dateISO(new Date());
}

function dateISO(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
