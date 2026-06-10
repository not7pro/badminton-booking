// ===== Schedule Page Logic =====

(function () {
    'use strict';

    // --- State ---
    let bookings = [];
    const STORAGE_KEY = 'badminton_bookings';
    const STORAGE_DATE_KEY = 'badminton_bookings_date';
    
    // Time range (e.g., 6:00 AM to 11:30 PM)
    const START_HOUR = 6; 
    const END_HOUR = 23; 
    const TIME_SLOT_MINUTES = 30;

    // --- DOM Elements ---
    const currentDateEl = document.getElementById('currentDate');
    const scheduleBody = document.getElementById('scheduleBody');
    const totalBookedEl = document.getElementById('totalBooked');
    const totalFreeEl = document.getElementById('totalFree');
    const totalHoursEl = document.getElementById('totalHours');

    // --- Initialization ---
    function init() {
        setCurrentDate();
        loadBookings();
        renderScheduleGrid();
        updateStats();
        
        // Auto-refresh current time row every minute
        setInterval(renderScheduleGrid, 60000);
    }

    // --- Date Helpers ---
    function setCurrentDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = now.toLocaleDateString('en-US', options);
    }

    function getTodayString() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    function formatTimeLabel(hour, minutes) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const displayMin = String(minutes).padStart(2, '0');
        return `${displayHour}:${displayMin} ${ampm}`;
    }

    // --- Storage ---
    function loadBookings() {
        try {
            const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
            const today = getTodayString();

            if (storedDate !== today) {
                // If the day changed, data was already reset on the main page, 
                // but just in case they land here directly:
                localStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(STORAGE_DATE_KEY, today);
                bookings = [];
                return;
            }

            const stored = localStorage.getItem(STORAGE_KEY);
            bookings = stored ? JSON.parse(stored) : [];
        } catch {
            bookings = [];
        }
    }

    // --- Scheduling Logic ---
    function getBookingForSlot(court, hour, minutes) {
        const slotStartMinutes = hour * 60 + minutes;
        const slotEndMinutes = slotStartMinutes + TIME_SLOT_MINUTES;

        // Find if any booking overlaps with this slot
        const todayStr = getTodayString();
        
        for (const b of bookings) {
            if (b.court !== court || b.date !== todayStr) continue;
            
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
        
        // Track which court has a spanning booking so we can skip creating cells
        // spanTracker[court] = slots remaining to skip
        const spanTracker = { 1: 0, 2: 0, 3: 0 };
        let totalSlots = 0;
        let bookedSlotsCount = 0;
        let bookedHoursTotal = 0;

        for (let h = START_HOUR; h <= END_HOUR; h++) {
            for (let m = 0; m < 60; m += TIME_SLOT_MINUTES) {
                const tr = document.createElement('tr');
                
                // Add classes for styling hour lines and current time
                if (m === 0) tr.classList.add('hour-row');
                if (isCurrentTimeSlot(h, m)) tr.classList.add('current-time-row');

                // Time Cell
                const timeTd = document.createElement('td');
                timeTd.className = `time-cell ${m === 30 ? 'half-hour' : ''}`;
                timeTd.textContent = formatTimeLabel(h, m);
                tr.appendChild(timeTd);

                // Court Cells
                for (let c = 1; c <= 3; c++) {
                    // If we are currently spanning a booking from an earlier slot, skip creating the td (rowspan handles it)
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
                        
                        // Set rowspan if it's the start of a booking
                        td.rowSpan = slotData.span;
                        spanTracker[c] = slotData.span - 1; // Skip the next N-1 rows for this court
                        
                        td.classList.add('booked');
                        td.classList.add('booking-start');
                        
                        // Create content
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'slot-booked-content';
                        
                        const playerSpan = document.createElement('span');
                        playerSpan.className = 'slot-player';
                        playerSpan.textContent = slotData.booking.player || 'Booked';
                        
                        // Calculate end time string for display
                        const endMins = (h * 60 + m) + (slotData.booking.hours * 60);
                        const endH = Math.floor(endMins / 60) % 24;
                        const endM = endMins % 60;
                        
                        const timeRangeSpan = document.createElement('span');
                        timeRangeSpan.className = 'slot-time-range';
                        timeRangeSpan.textContent = `${formatTimeLabel(h, m)} - ${formatTimeLabel(endH, endM)}`;
                        
                        contentDiv.appendChild(playerSpan);
                        // Only show time range if it's 1 hour or more (rowspan >= 2) so it fits nicely
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
        
        // Save stats for updateStats function
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
})();
