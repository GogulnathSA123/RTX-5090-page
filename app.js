import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const SLOT_HEIGHT = 30;
const SUPABASE_URL = "https://liwamsxkjccrrozqmxfr.supabase.co";
const SUPABASE_KEY = "sb_publishable_MZv75VvlJtkt8oYytyCsYA_ZcnHzDy2";
const MEMBER_COLORS = ["#127c78", "#c98624", "#416984", "#2f7d55", "#8a5a9e", "#c75945", "#586f9e"];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true
  }
});

const state = {
  currentUser: null,
  data: {
    systemName: "RTX 5090",
    members: [],
    bookings: [],
    updatedAt: new Date().toISOString()
  },
  selectedDate: todayISO(),
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
  storageProject: document.querySelector("#storageProject"),
  storageMeta: document.querySelector("#storageMeta"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  populateTimeOptions();
  wireEvents();

  els.bookingDate.value = todayISO();
  els.timelineDate.value = state.selectedDate;
  els.storageProject.textContent = new URL(SUPABASE_URL).host;
  els.storageMeta.textContent = "Authenticated users share one bookings table";

  const { data } = await supabase.auth.getSession();
  state.currentUser = data.session?.user ? userFromSupabase(data.session.user) : null;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.currentUser = session?.user ? userFromSupabase(session.user) : null;
    render();
    await loadBookings({ silent: true });
  });

  render();
  await loadBookings({ silent: true });
}

function wireEvents() {
  els.bookingForm.addEventListener("submit", handleBookingSubmit);
  els.timelineDate.addEventListener("change", () => {
    state.selectedDate = els.timelineDate.value || todayISO();
    renderTimeline();
    renderOpenWindows();
  });
  els.syncNowButton.addEventListener("click", () => loadBookings());
  els.signInTab.addEventListener("click", () => setAuthMode("signin"));
  els.signUpTab.addEventListener("click", () => setAuthMode("signup"));
  els.signInForm.addEventListener("submit", handleSignInSubmit);
  els.signUpForm.addEventListener("submit", handleSignUpSubmit);
  els.signOutButton.addEventListener("click", handleSignOut);
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

async function handleSignInSubmit(event) {
  event.preventDefault();

  const email = normalizeEmail(els.signInEmail.value);
  const password = els.signInPassword.value;

  if (!isValidEmail(email)) {
    showToast("Enter a valid email address.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message || "Sign in failed.");
    return;
  }

  state.currentUser = userFromSupabase(data.user);
  els.signInPassword.value = "";
  render();
  await loadBookings({ silent: true });
  showToast(`Signed in as ${state.currentUser.name}.`);
}

async function handleSignUpSubmit(event) {
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

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirm) {
    showToast("Passwords do not match.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: window.location.href.split("#")[0]
    }
  });

  if (error) {
    showToast(error.message || "Sign up failed.");
    return;
  }

  els.signUpPassword.value = "";
  els.signUpConfirm.value = "";

  if (data.session?.user) {
    state.currentUser = userFromSupabase(data.session.user);
    render();
    await loadBookings({ silent: true });
    showToast(`Account created for ${name}.`);
    return;
  }

  setAuthMode("signin");
  els.signInEmail.value = email;
  showToast("Account created. Check your email, then sign in.");
}

async function handleSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast(error.message || "Sign out failed.");
    return;
  }

  state.currentUser = null;
  els.signInPassword.value = "";
  render();
  showToast("Signed out.");
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  if (state.isSaving) return;

  const draft = buildDraftBooking();
  if (!draft) return;

  try {
    state.isSaving = true;
    await loadBookings({ silent: true });

    const conflict = findConflict(draft);
    if (conflict) {
      showToast(`Conflict: ${memberName(conflict.memberId)} already has ${conflict.start}-${conflict.end}.`);
      return;
    }

    const row = {
      user_id: draft.memberId,
      member_name: draft.memberName,
      member_email: draft.memberEmail,
      booking_date: draft.date,
      start_minutes: timeToMinutes(draft.start),
      end_minutes: timeToMinutes(draft.end),
      title: draft.title
    };
    const { error } = await supabase.from("bookings").insert(row);

    if (error) {
      throw error;
    }

    els.bookingForm.reset();
    els.bookingDate.value = draft.date;
    els.timelineDate.value = draft.date;
    state.selectedDate = draft.date;
    await loadBookings({ silent: true });
    showToast("Booking saved.");
  } catch (error) {
    showToast(supabaseBookingError(error, "Booking could not be saved."));
  } finally {
    state.isSaving = false;
  }
}

function buildDraftBooking() {
  const member = state.currentUser;
  const date = els.bookingDate.value;
  const start = els.startTime.value;
  const duration = Number(els.duration.value);
  const title = els.bookingTitleInput.value.trim();

  if (!member) {
    showToast("Sign in before booking.");
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

  try {
    state.isSaving = true;
    const { error } = await supabase.from("bookings").delete().eq("id", button.dataset.cancelId);
    if (error) throw error;
    await loadBookings({ silent: true });
    showToast("Booking cancelled.");
  } catch (error) {
    showToast(supabaseBookingError(error, "Booking could not be cancelled."));
  } finally {
    state.isSaving = false;
  }
}

async function loadBookings(options = {}) {
  if (!state.currentUser) {
    state.data = normalizeRows([]);
    updateSyncStatus("Supabase", "Sign in to view and create bookings.");
    render();
    return;
  }

  try {
    updateSyncStatus("Syncing", "Loading bookings from Supabase.");
    const { data, error } = await supabase
      .from("bookings")
      .select("id,user_id,member_name,member_email,booking_date,start_minutes,end_minutes,title,created_at")
      .order("booking_date", { ascending: true })
      .order("start_minutes", { ascending: true });

    if (error) {
      throw error;
    }

    state.data = normalizeRows(data || []);
    updateSyncStatus("Supabase", state.currentUser ? "Signed in and synced." : "Sign in to create bookings.");
    render();
    if (!options.silent) showToast("Bookings synced.");
  } catch (error) {
    updateSyncStatus("Setup needed", "Run supabase/schema.sql in your Supabase SQL editor.");
    render();
    if (!options.silent) {
      showToast(supabaseBookingError(error, "Could not load bookings."));
    }
  }
}

function normalizeRows(rows) {
  const bookings = rows.map((row) => ({
    id: row.id,
    memberId: row.user_id,
    memberName: row.member_name || "Unknown member",
    memberEmail: row.member_email || "",
    date: row.booking_date,
    start: minutesToTime(row.start_minutes),
    end: minutesToTime(row.end_minutes),
    title: row.title || "Lab work",
    createdAt: row.created_at
  }));
  const members = [];

  for (const booking of bookings) {
    if (!members.some((member) => member.id === booking.memberId)) {
      members.push({
        id: booking.memberId,
        name: booking.memberName,
        email: booking.memberEmail,
        color: colorForIndex(members.length)
      });
    }
  }

  if (state.currentUser && !members.some((member) => member.id === state.currentUser.id)) {
    members.push({
      id: state.currentUser.id,
      name: state.currentUser.name,
      email: state.currentUser.email,
      color: colorForEmail(state.currentUser.email)
    });
  }

  return {
    systemName: "RTX 5090",
    members,
    bookings,
    updatedAt: new Date().toISOString()
  };
}

function render() {
  renderAccount();
  renderBookingIdentity();
  renderDashboard();
  renderTimeline();
  renderUpcoming();
  renderUsage();
  renderOpenWindows();
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
  const submitButton = els.bookingForm.querySelector('button[type="submit"]');

  if (state.currentUser) {
    els.currentMember.value = `${state.currentUser.name} (${state.currentUser.email})`;
    submitButton.disabled = false;
    return;
  }

  els.currentMember.value = "Sign in required";
  submitButton.disabled = true;
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
      const canCancel = state.currentUser?.id === booking.memberId;
      return `
        <article class="booking-item" style="border-left: 5px solid ${escapeAttr(member.color)}">
          <div>
            <strong>${escapeHtml(member.name)} - ${escapeHtml(booking.title)}</strong>
            <span>${formatDate(booking.date)} - ${escapeHtml(booking.start)}-${escapeHtml(booking.end)}</span>
          </div>
          ${canCancel ? `<button class="cancel-button" type="button" data-cancel-id="${escapeAttr(booking.id)}" aria-label="Cancel booking">x</button>` : ""}
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
  }, 4200);
}

function findConflict(draft) {
  const draftStart = timeToMinutes(draft.start);
  const draftEnd = timeToMinutes(draft.end);
  return activeBookings().find((booking) => {
    if (booking.date !== draft.date) return false;
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

function userFromSupabase(user) {
  const email = normalizeEmail(user.email);
  return {
    id: user.id,
    email,
    name: cleanName(user.user_metadata?.full_name) || cleanName(user.user_metadata?.name) || nameFromEmail(email)
  };
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

function supabaseBookingError(error, fallback) {
  const message = error?.message || fallback;
  if (error?.code === "42P01") {
    return `${fallback} Run supabase/schema.sql in Supabase first.`;
  }
  if (error?.code === "23P01") {
    return "Conflict: that time overlaps an existing booking.";
  }
  if (message.includes("row-level security")) {
    return `${fallback} Check the Supabase RLS policies in supabase/schema.sql.`;
  }
  return message;
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
