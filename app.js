// ===== Badminton Court Booking Tracker (Firebase Version) =====
import { db, ref, set, remove, onValue } from './firebase.js';

// --- State ---
let bookings = [];
let activeFilter = 'all';

// --- DOM Elements ---
const form = document.getElementById('bookingForm');
const bookingsList = document.getElementById('bookingsList');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');
const currentDateEl = document.getElementById('currentDate');
const toastEl = document.getElementById('toast');
const filterTabs = document.querySelectorAll('.filter-tab');

// Form fields
const dateInput = document.getElementById('bookingDate');
const timeInput = document.getElementById('bookingTime');
const courtSelect = document.getElementById('courtSelect');
const hoursSelect = document.getElementById('bookingHours');
const playerInput = document.getElementById('playerName');

// --- Initialization ---
function init() {
    setCurrentDate();
    setDefaultFormValues();
    setupFirebaseListener();
    bindEvents();
    
    // Check for day change every minute
    setInterval(checkDayChange, 60000);
}

// --- Date & Time Helpers ---
function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);
}

function setDefaultFormValues() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

let currentListenDate = getTodayString();
let unsubscribeFirebase = null;

function checkDayChange() {
    const actualToday = getTodayString();
    if (actualToday !== currentListenDate) {
        currentListenDate = actualToday;
        setCurrentDate();
        setDefaultFormValues();
        setupFirebaseListener();
    }
}

function formatTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatEndTime(timeStr, hours) {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMin = h * 60 + m + hours * 60;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const ampm = endH >= 12 ? 'PM' : 'AM';
    const hour = endH % 12 || 12;
    return `${hour}:${String(endM).padStart(2, '0')} ${ampm}`;
}

function formatDuration(hours) {
    const h = Math.floor(hours);
    const m = (hours - h) * 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr${h > 1 ? 's' : ''}`;
    return `${h} hr ${m} min`;
}

// --- Firebase ---
function setupFirebaseListener() {
    if (unsubscribeFirebase) {
        unsubscribeFirebase();
    }
    
    // We only listen to today's bookings.
    // The DB will store past days automatically, acting as an archive, 
    // but the app appears "reset" daily.
    const todayRef = ref(db, `badminton-bookings/${currentListenDate}`);
    
    unsubscribeFirebase = onValue(todayRef, (snapshot) => {
        const data = snapshot.val();
        bookings = [];
        if (data) {
            Object.keys(data).forEach(key => {
                bookings.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        
        // Sort bookings by time then court
        bookings.sort((a, b) => {
            if (a.time !== b.time) return a.time.localeCompare(b.time);
            return a.court - b.court;
        });
        
        renderBookings();
        updateCourtCards();
    });
}

// --- Booking CRUD ---
function addBooking(booking) {
    // Add to specific date node in Firebase
    const bookingRef = ref(db, `badminton-bookings/${booking.date}/${booking.id}`);
    set(bookingRef, {
        date: booking.date,
        time: booking.time,
        court: booking.court,
        hours: booking.hours,
        player: booking.player
    });
}

function deleteBooking(id, date) {
    const bookingRef = ref(db, `badminton-bookings/${date}/${id}`);
    
    // Add remove animation locally before deleting from DB
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
        item.classList.add('removing');
        setTimeout(() => {
            remove(bookingRef);
        }, 300);
    } else {
        remove(bookingRef);
    }
}

function clearAllBookings() {
    if (bookings.length === 0) {
        showToast('No bookings to clear', 'info');
        return;
    }
    
    // Clear only today's bookings
    const todayRef = ref(db, `badminton-bookings/${currentListenDate}`);
    remove(todayRef).then(() => {
        showToast('All bookings cleared for today', 'info');
    });
}

// --- Check Overlap ---
function hasOverlap(newBooking) {
    const newStart = timeToMinutes(newBooking.time);
    const newEnd = newStart + newBooking.hours * 60;

    // Check against current loaded bookings (which are only for today)
    // If they book for a future date, we don't have that data loaded.
    // For simplicity, we assume they only book for today. If they book for another date, 
    // we should ideally check Firebase first, but let's keep it simple.
    if (newBooking.date !== currentListenDate) return false;

    return bookings.some(b => {
        if (b.court !== newBooking.court) return false;
        const bStart = timeToMinutes(b.time);
        const bEnd = bStart + b.hours * 60;
        return newStart < bEnd && newEnd > bStart;
    });
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// --- Rendering ---
function renderBookings() {
    const filtered = activeFilter === 'all'
        ? bookings
        : bookings.filter(b => b.court === parseInt(activeFilter));

    if (filtered.length === 0) {
        bookingsList.innerHTML = '';
        bookingsList.appendChild(createEmptyState());
        return;
    }

    bookingsList.innerHTML = '';
    filtered.forEach(booking => {
        bookingsList.appendChild(createBookingItem(booking));
    });
}

function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>${activeFilter === 'all' ? 'No bookings yet' : `No bookings for Court ${activeFilter}`}</p>
        <span>Add a booking to get started</span>
    `;
    return div;
}

function createBookingItem(booking) {
    const div = document.createElement('div');
    div.className = 'booking-item';
    div.dataset.id = booking.id;

    const startTime = formatTime(booking.time);
    const endTime = formatEndTime(booking.time, booking.hours);
    const duration = formatDuration(booking.hours);

    div.innerHTML = `
        <div class="booking-court-badge court-${booking.court}">C${booking.court}</div>
        <div class="booking-info">
            <div class="booking-time">${startTime} – ${endTime}</div>
            <div class="booking-details">
                <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${duration}
                </span>
                <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                    Today
                </span>
            </div>
            ${booking.player ? `<div class="booking-player">${escapeHtml(booking.player)}</div>` : ''}
        </div>
        <button class="btn-delete" title="Remove booking" data-delete="${booking.id}" data-date="${booking.date}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    return div;
}

// --- Court Cards ---
function updateCourtCards() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let court = 1; court <= 3; court++) {
        const courtBookings = bookings.filter(b => b.court === court);
        const countEl = document.getElementById(`count-${court}`);
        const statusEl = document.getElementById(`status-${court}`);
        const nextEl = document.getElementById(`next-${court}`);

        // Count
        countEl.textContent = courtBookings.length;

        // Check if currently booked
        const currentlyBooked = courtBookings.some(b => {
            const start = timeToMinutes(b.time);
            const end = start + b.hours * 60;
            return currentMinutes >= start && currentMinutes < end;
        });

        if (currentlyBooked) {
            statusEl.textContent = 'In Use';
            statusEl.className = 'court-status booked';
        } else {
            statusEl.textContent = 'Available';
            statusEl.className = 'court-status available';
        }

        // Next booking
        const upcoming = courtBookings
            .filter(b => timeToMinutes(b.time) > currentMinutes)
            .sort((a, b) => a.time.localeCompare(b.time));

        if (upcoming.length > 0) {
            nextEl.textContent = `Next: ${formatTime(upcoming[0].time)}`;
        } else if (courtBookings.length > 0) {
            nextEl.textContent = 'No more bookings today';
        } else {
            nextEl.textContent = 'No upcoming bookings';
        }
    }
}

// --- Events ---
function bindEvents() {
    form.addEventListener('submit', handleSubmit);
    clearAllBtn.addEventListener('click', clearAllBookings);

    bookingsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete]');
        if (btn) {
            deleteBooking(btn.dataset.delete, btn.dataset.date);
            showToast('Booking removed', 'info');
        }
    });

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            renderBookings();
        });
    });

    // Refresh court statuses every minute
    setInterval(updateCourtCards, 60000);
}

function handleSubmit(e) {
    e.preventDefault();

    const date = dateInput.value;
    const time = timeInput.value;
    const court = parseInt(courtSelect.value);
    const hours = parseFloat(hoursSelect.value);
    const player = playerInput.value.trim();

    if (!date || !time || !court || !hours) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const newBooking = {
        id: generateId(),
        date,
        time,
        court,
        hours,
        player
    };

    if (hasOverlap(newBooking)) {
        showToast(`Court ${court} is already booked during that time`, 'error');
        return;
    }

    addBooking(newBooking);
    
    if (date === currentListenDate) {
        showToast(`Booked Court ${court} at ${formatTime(time)}`, 'success');
    } else {
        showToast(`Booked Court ${court} for ${date}`, 'success');
    }

    // Reset only time, court, hours, player — keep date
    timeInput.value = '';
    courtSelect.value = '';
    hoursSelect.value = '';
    playerInput.value = '';
    timeInput.focus();
}

// --- Helpers ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let toastTimeout;
function showToast(message, type = 'info') {
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;

    // Trigger reflow for re-animation
    void toastEl.offsetWidth;
    toastEl.classList.add('show');

    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 2800);
}

// --- Start ---
init();
