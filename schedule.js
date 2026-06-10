// ===== Schedule Page Logic (Firebase Version) =====
import { db, ref, onValue } from './firebase.js';

// --- State ---
let bookings = [];

// Time range (e.g., 6:00 AM to 11:30 PM)
const START_HOUR = 6; 
const END_HOUR = 23; 
const TIME_SLOT_MINUTES = 30;

// --- DOM Elements ---
const dateInput = document.getElementById('scheduleDate');
const scheduleBody = document.getElementById('scheduleBody');
const totalBookedEl = document.getElementById('totalBooked');
const totalFreeEl = document.getElementById('totalFree');
const totalHoursEl = document.getElementById('totalHours');

// --- Initialization ---
function init() {
    setDefaultDate();
    setupFirebaseListener();
    
    // Auto-refresh current time row every minute
    setInterval(() => {
        renderScheduleGrid();
    }, 60000);
    
    dateInput.addEventListener('change', () => {
        currentListenDate = dateInput.value;
        setupFirebaseListener();
    });
}

// --- Date Helpers ---
function setDefaultDate() {
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

function formatTimeLabel(hour, minutes) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMin = String(minutes).padStart(2, '0');
    return `${displayHour}:${displayMin} ${ampm}`;
}

// --- Firebase ---
function setupFirebaseListener() {
    if (unsubscribeFirebase) {
        unsubscribeFirebase();
    }
    
    // Listen to ALL bookings so we can catch permanent ones
    const allRef = ref(db, `badminton-bookings`);
    
    unsubscribeFirebase = onValue(allRef, (snapshot) => {
        const data = snapshot.val();
        bookings = [];
        if (data) {
            Object.keys(data).forEach(dateKey => {
                const dayBookings = data[dateKey];
                Object.keys(dayBookings).forEach(id => {
                    bookings.push({
                        id: id,
                        ...dayBookings[id]
                    });
                });
            });
        }
        
        renderScheduleGrid();
        updateStats();
    });
}

// --- Scheduling Logic ---
function getBookingForSlot(court, hour, minutes) {
    const slotStartMinutes = hour * 60 + minutes;
    
    for (const b of bookings) {
        // Only consider bookings for the currently viewed date, or permanent bookings
        if (b.court !== court) continue;
        if (b.date !== currentListenDate && b.date !== 'permanent') continue;
        
        const [bH, bM] = b.time.split(':').map(Number);
        const bStartMinutes = bH * 60 + bM;
        const bEndMinutes = bStartMinutes + b.hours * 60;
        
        // Check for overlap
        if (slotStartMinutes >= bStartMinutes && slotStartMinutes < bEndMinutes) {
            return {
                booking: b,
                isStart: slotStartMinutes === bStartMinutes,
                span: b.hours * 60 / TIME_SLOT_MINUTES
            };
        }
    }
    return null;
}

function isCurrentTimeSlot(hour, minutes) {
    if (currentListenDate !== getTodayString()) return false;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const nowTotalMinutes = currentHour * 60 + currentMinutes;
    
    const slotStartMinutes = hour * 60 + minutes;
    const slotEndMinutes = slotStartMinutes + TIME_SLOT_MINUTES;
    
    return nowTotalMinutes >= slotStartMinutes && nowTotalMinutes < slotEndMinutes;
}

// --- Rendering ---
function renderScheduleGrid() {
    scheduleBody.innerHTML = '';
    
    const spanTracker = { 1: 0, 2: 0, 3: 0 };
    let totalSlots = 0;
    let bookedSlotsCount = 0;
    let bookedHoursTotal = 0;

    for (let h = START_HOUR; h <= END_HOUR; h++) {
        for (let m = 0; m < 60; m += TIME_SLOT_MINUTES) {
            const tr = document.createElement('tr');
            
            if (m === 0) tr.classList.add('hour-row');
            if (isCurrentTimeSlot(h, m)) tr.classList.add('current-time-row');

            // Time Cell
            const timeTd = document.createElement('td');
            timeTd.className = `time-cell ${m === 30 ? 'half-hour' : ''}`;
            timeTd.textContent = formatTimeLabel(h, m);
            tr.appendChild(timeTd);

            // Court Cells
            for (let c = 1; c <= 3; c++) {
                if (spanTracker[c] > 0) {
                    spanTracker[c]--;
                    continue;
                }

                totalSlots++;
                const td = document.createElement('td');
                td.className = `slot-cell court-${c}`;
                
                const slotData = getBookingForSlot(c, h, m);

                if (slotData) {
                    bookedSlotsCount += slotData.span;
                    bookedHoursTotal += slotData.booking.hours;
                    
                    td.rowSpan = slotData.span;
                    spanTracker[c] = slotData.span - 1;
                    
                    td.classList.add('booked');
                    td.classList.add('booking-start');
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'slot-booked-content';
                    if (slotData.booking.date === 'permanent') {
                        contentDiv.style.borderStyle = 'dashed';
                    }
                    
                    const playerSpan = document.createElement('span');
                    playerSpan.className = 'slot-player';
                    playerSpan.textContent = slotData.booking.player || 'Booked';
                    
                    const endMins = (h * 60 + m) + (slotData.booking.hours * 60);
                    const endH = Math.floor(endMins / 60) % 24;
                    const endM = endMins % 60;
                    
                    const timeRangeSpan = document.createElement('span');
                    timeRangeSpan.className = 'slot-time-range';
                    timeRangeSpan.textContent = `${formatTimeLabel(h, m)} - ${formatTimeLabel(endH, endM)}`;
                    
                    contentDiv.appendChild(playerSpan);
                    if (slotData.span >= 2) {
                        contentDiv.appendChild(timeRangeSpan);
                    }
                    
                    td.appendChild(contentDiv);
                    
                } else {
                    td.classList.add('free');
                }
                
                tr.appendChild(td);
            }

            scheduleBody.appendChild(tr);
        }
    }
    
    window._scheduleStats = {
        totalSlots: totalSlots,
        bookedSlots: bookedSlotsCount,
        bookedHours: bookedHoursTotal
    };
}

function updateStats() {
    if (!window._scheduleStats) return;
    const stats = window._scheduleStats;
    
    totalBookedEl.textContent = stats.bookedSlots;
    totalFreeEl.textContent = stats.totalSlots - stats.bookedSlots;
    totalHoursEl.textContent = stats.bookedHours;
}

// --- Start ---
init();
