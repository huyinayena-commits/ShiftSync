/**
 * TSM Shift Scheduler - Algoritma Jadwal
 * Mengandung logika Weighted Rotation dan Constraint Satisfaction
 */

// =============================================
// DATA MODEL - Anggota Tim
// =============================================
const TEAM = [
    { id: 'CIF', name: 'CIF', gender: 'M', isLeader: true },
    { id: 'SSL', name: 'SSL', gender: 'M', isLeader: true },
    { id: 'SJL', name: 'SJL', gender: 'F', isLeader: true },
    { id: 'SCB1', name: 'SCB 1', gender: 'M', isLeader: false },
    { id: 'SCB2', name: 'SCB 2', gender: 'F', isLeader: false }
];

// Daftar leader yang bisa memegang kunci
const LEADERS = TEAM.filter(m => m.isLeader);

// Nama hari dalam bahasa Indonesia
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Daftar Hari Libur Nasional Indonesia 2026
const NATIONAL_HOLIDAYS = {
    '2026-01-01': 'Tahun Baru Masehi',
    '2026-01-29': 'Tahun Baru Imlek',
    '2026-03-20': 'Isra Miraj',
    '2026-03-22': 'Hari Suci Nyepi',
    '2026-04-03': 'Jumat Agung',
    '2026-05-01': 'Hari Buruh',
    '2026-05-14': 'Kenaikan Isa Almasih',
    '2026-05-17': 'Idul Fitri',
    '2026-05-18': 'Idul Fitri',
    '2026-05-26': 'Hari Waisak',
    '2026-06-01': 'Hari Lahir Pancasila',
    '2026-07-24': 'Idul Adha',
    '2026-08-14': 'Tahun Baru Hijriah',
    '2026-08-17': 'Hari Kemerdekaan RI',
    '2026-10-23': 'Maulid Nabi Muhammad',
    '2026-12-25': 'Hari Natal'
};

// Fungsi cek apakah tanggal adalah libur nasional
function isNationalHoliday(dateStr) {
    return NATIONAL_HOLIDAYS.hasOwnProperty(dateStr);
}

// Dapatkan nama libur nasional
function getHolidayName(dateStr) {
    return NATIONAL_HOLIDAYS[dateStr] || null;
}

// =============================================
// STATE MANAGEMENT
// =============================================
let scheduleData = {
    startDate: null,
    endDate: null,
    eventDates: [],
    holidays: [],
    schedule: {}, // { 'YYYY-MM-DD': { memberId: { shift: 1|2|'OFF', isPK: bool, isLocked: bool } } }
    pkYesterday: null,
    offYesterday: null
};

// =============================================
// UTILITY FUNCTIONS
// =============================================

// Format tanggal ke string YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parse string tanggal ke Date object
function parseDate(dateStr) {
    return new Date(dateStr + 'T00:00:00');
}

// Dapatkan tanggal berikutnya
function getNextDate(dateStr) {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() + 1);
    return formatDate(date);
}

// Dapatkan tanggal sebelumnya
function getPrevDate(dateStr) {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() - 1);
    return formatDate(date);
}

// Cek apakah weekend
function isWeekend(dateStr) {
    const day = parseDate(dateStr).getDay();
    return day === 0 || day === 6;
}

// Dapatkan minggu ke-berapa dalam bulan
function getWeekOfMonth(dateStr) {
    const date = parseDate(dateStr);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayOfWeek = firstDay.getDay();
    return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

// Dapatkan key minggu (untuk tracking kuota OFF)
function getWeekKey(dateStr) {
    const date = parseDate(dateStr);
    // Mulai minggu dari Senin
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return formatDate(monday);
}

// Dapatkan semua tanggal dalam rentang
function getDateRange(startDate, endDate) {
    const dates = [];
    let current = parseDate(startDate);
    const end = parseDate(endDate);

    while (current <= end) {
        dates.push(formatDate(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// Acak urutan array (Fisher-Yates Shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// =============================================
// CONSTRAINT VALIDATORS
// =============================================

// Validasi: Minimal 2 orang per shift
function validateMinPersonnel(schedule, dateStr) {
    const daySchedule = schedule[dateStr];
    if (!daySchedule) return true;

    const shift1Count = Object.values(daySchedule).filter(s => s.shift === 1).length;
    const shift2Count = Object.values(daySchedule).filter(s => s.shift === 2).length;

    return shift1Count >= 2 && shift2Count >= 2;
}

// Validasi: Minimal 1 laki-laki per shift
function validateGenderRule(schedule, dateStr) {
    const daySchedule = schedule[dateStr];
    if (!daySchedule) return true;

    const shift1Members = TEAM.filter(m => daySchedule[m.id]?.shift === 1);
    const shift2Members = TEAM.filter(m => daySchedule[m.id]?.shift === 2);

    const shift1HasMale = shift1Members.some(m => m.gender === 'M');
    const shift2HasMale = shift2Members.some(m => m.gender === 'M');

    return shift1HasMale && shift2HasMale;
}

// Validasi: CIF dan SSL tidak boleh satu shift
function validateLeaderSeparation(schedule, dateStr) {
    const daySchedule = schedule[dateStr];
    if (!daySchedule) return true;

    const cifShift = daySchedule['CIF']?.shift;
    const sslShift = daySchedule['SSL']?.shift;

    // Jika salah satu OFF, aman
    if (cifShift === 'OFF' || sslShift === 'OFF') return true;

    return cifShift !== sslShift;
}

// Hitung jumlah OFF dalam seminggu untuk member tertentu
function countWeeklyOff(schedule, dateStr, memberId) {
    const weekKey = getWeekKey(dateStr);
    let count = 0;

    for (const d in schedule) {
        if (getWeekKey(d) === weekKey && schedule[d][memberId]?.shift === 'OFF') {
            count++;
        }
    }

    return count;
}

// =============================================
// SCHEDULE GENERATOR
// =============================================

// Generate jadwal otomatis
// Generate jadwal otomatis
function generateSchedule() {
    const dates = getDateRange(scheduleData.startDate, scheduleData.endDate);
    const schedule = {};

    // Auto-detect Kondisi H-1 dari Global Grid Data
    let lastPK = null;
    let lastOff = null;

    if (dates.length > 0) {
        const prevDate = getPrevDate(dates[0]);
        const prevData = scheduleData.schedule[prevDate];
        if (prevData) {
            const pkMember = TEAM.find(m => prevData[m.id]?.isPK);
            lastPK = pkMember ? pkMember.id : null;

            const offMember = TEAM.find(m => prevData[m.id]?.shift === 'OFF');
            lastOff = offMember ? offMember.id : 'none'; // 'none' jika tidak ada yang off (misal awal bulan/reset)
        }
    }

    // Track shift berturut-turut untuk anti-monoton
    const consecutiveShifts = {};
    TEAM.forEach(m => consecutiveShifts[m.id] = { shift: null, count: 0 });

    // Track distribusi PK
    const pkCount = {};
    LEADERS.forEach(l => pkCount[l.id] = 0);

    for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        const isEvent = scheduleData.eventDates.includes(dateStr);
        const dayOfWeek = parseDate(dateStr).getDay(); // 0=Minggu

        schedule[dateStr] = {};

        // Cek apakah ada locked cells dari edit manual
        const existingDay = scheduleData.schedule[dateStr];

        // Step 1: Terapkan constraint wajib
        TEAM.forEach(member => {
            if (existingDay && existingDay[member.id]?.isLocked) {
                schedule[dateStr][member.id] = { ...existingDay[member.id] };
                return;
            }
            schedule[dateStr][member.id] = { shift: null, isPK: false, isLocked: false };
        });

        // Step 2 & 3: Wajib Shift 1/2 dari kemarin
        if (lastPK && !schedule[dateStr][lastPK]?.isLocked) {
            schedule[dateStr][lastPK].shift = 1;
        }
        if (lastOff && lastOff !== 'none' && !schedule[dateStr][lastOff]?.isLocked) {
            schedule[dateStr][lastOff].shift = 2;
        }

        // Step 4: Assign shift
        let unassigned = TEAM.filter(m => schedule[dateStr][m.id].shift === null);
        // RANDOMIZE agar adil dalam distribusi libur
        unassigned = shuffleArray(unassigned);

        unassigned.forEach(member => {
            const prevDateStr = i > 0 ? dates[i - 1] : null;
            const prevShift = prevDateStr ? schedule[prevDateStr]?.[member.id]?.shift : null;

            // Cek kuota OFF mingguan
            const weeklyOffCount = countWeeklyOff(schedule, dateStr, member.id);
            // Mandatory Off Logic: Wajib ambil libur jika belum dapat jatah di akhir minggu
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const mandatoryOff = (weeklyOffCount === 0 && dayOfWeek === 0) || (weeklyOffCount === 0 && dayOfWeek === 6 && !isEvent);

            const canTakeOff = !isEvent && (weeklyOffCount < 1 || mandatoryOff);

            let bestShift = null;
            let bestScore = -Infinity;

            const options = canTakeOff ? [1, 2, 'OFF'] : [1, 2];

            // Cek distribusi OFF harian (Target: 1 orang OFF per hari)
            const currentOffCount = Object.values(schedule[dateStr]).filter(s => s.shift === 'OFF').length;

            options.forEach(shift => {
                let score = 0;
                const consec = consecutiveShifts[member.id];

                // --- LOGIC LIBUR ---
                if (shift === 'OFF') {
                    if (weeklyOffCount === 0) {
                        score += 60; // Base priority tinggi untuk ambil jatah libur
                        if (mandatoryOff) score += 1000; // Force OFF (Sangat tinggi)
                        else if (dayOfWeek >= 5) score += 40; // Urgent Jumat-Sabtu
                    } else {
                        score -= 50; // Sudah libur, prioritas rendah
                    }

                    // Balance Daily Off: Target 1 orang
                    if (currentOffCount === 0) score += 25; // Dorong agar ada yang libur
                    else if (currentOffCount >= 1) score -= 15; // Tahan agar tidak kekurangan orang
                }

                // --- LOGIC KERJA ---
                // Anti-zigzag
                if (prevShift === shift && shift !== 'OFF') {
                    if (consec.count < 2) score += 25;
                    else if (consec.count >= 3) score -= 15;
                }

                if (prevShift !== null && prevShift !== 'OFF' && shift !== 'OFF' && prevShift !== shift) {
                    if (consec.count === 1 && consec.shift !== shift) score -= 20;
                }

                if (shift === 'OFF' && prevShift !== 1) score -= 20;

                // Balance Shifts
                const shift1Count = Object.values(schedule[dateStr]).filter(s => s.shift === 1).length;
                const shift2Count = Object.values(schedule[dateStr]).filter(s => s.shift === 2).length;
                if (shift === 1 && shift1Count < shift2Count) score += 5;
                if (shift === 2 && shift2Count < shift1Count) score += 5;

                // Leader Separation
                if (member.id === 'CIF' || member.id === 'SSL') {
                    const otherId = member.id === 'CIF' ? 'SSL' : 'CIF';
                    const otherShift = schedule[dateStr][otherId]?.shift;
                    if (otherShift === shift && shift !== 'OFF') score -= 100;
                }

                score += Math.random() * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestShift = shift;
                }
            });

            schedule[dateStr][member.id].shift = bestShift;
        });

        // Step 5: Validasi
        fixConstraintViolations(schedule, dateStr, isEvent);

        // Step 6: Assign PK
        const shift2Leaders = LEADERS.filter(l => schedule[dateStr][l.id].shift === 2);
        if (shift2Leaders.length > 0) {
            shift2Leaders.sort((a, b) => pkCount[a.id] - pkCount[b.id]);
            const selectedPK = shift2Leaders[0].id;
            schedule[dateStr][selectedPK].isPK = true;
            pkCount[selectedPK]++;
            lastPK = selectedPK;
        } else {
            lastPK = null;
        }

        // Step 7: Catat OFF
        const offToday = TEAM.find(m => schedule[dateStr][m.id].shift === 'OFF');
        lastOff = offToday ? offToday.id : 'none';

        // Update consecutive
        TEAM.forEach(m => {
            const shift = schedule[dateStr][m.id].shift;
            if (consecutiveShifts[m.id].shift === shift) {
                consecutiveShifts[m.id].count++;
            } else {
                consecutiveShifts[m.id] = { shift, count: 1 };
            }
        });
    }

    return schedule;
}

// Perbaiki pelanggaran constraint
function fixConstraintViolations(schedule, dateStr, isEvent) {
    const daySchedule = schedule[dateStr];

    // Fix: Minimal 2 orang per shift
    let shift1Members = TEAM.filter(m => daySchedule[m.id].shift === 1 && !daySchedule[m.id].isLocked);
    let shift2Members = TEAM.filter(m => daySchedule[m.id].shift === 2 && !daySchedule[m.id].isLocked);
    let offMembers = TEAM.filter(m => daySchedule[m.id].shift === 'OFF' && !daySchedule[m.id].isLocked);

    // Jika event, tidak boleh ada OFF
    if (isEvent) {
        offMembers.forEach(m => {
            // Pindahkan ke shift yang kurang
            if (shift1Members.length <= shift2Members.length) {
                daySchedule[m.id].shift = 1;
                shift1Members.push(m);
            } else {
                daySchedule[m.id].shift = 2;
                shift2Members.push(m);
            }
        });
    }

    // Refresh setelah event fix
    shift1Members = TEAM.filter(m => daySchedule[m.id].shift === 1 && !daySchedule[m.id].isLocked);
    shift2Members = TEAM.filter(m => daySchedule[m.id].shift === 2 && !daySchedule[m.id].isLocked);
    offMembers = TEAM.filter(m => daySchedule[m.id].shift === 'OFF' && !daySchedule[m.id].isLocked);

    // Pastikan minimal 2 orang per shift
    while (shift1Members.length < 2 && (shift2Members.length > 2 || offMembers.length > 0)) {
        const source = shift2Members.length > 2 ? shift2Members : offMembers;
        if (source.length > 0) {
            const member = source.pop();
            daySchedule[member.id].shift = 1;
            shift1Members.push(member);
        } else break;
    }

    while (shift2Members.length < 2 && (shift1Members.length > 2 || offMembers.length > 0)) {
        const source = shift1Members.length > 2 ? shift1Members : offMembers;
        if (source.length > 0) {
            const member = source.pop();
            daySchedule[member.id].shift = 2;
            shift2Members.push(member);
        } else break;
    }

    // Fix: CIF dan SSL tidak boleh satu shift
    const cifShift = daySchedule['CIF'].shift;
    const sslShift = daySchedule['SSL'].shift;

    if (cifShift === sslShift && cifShift !== 'OFF') {
        // Pindahkan SSL ke shift lain jika tidak locked
        if (!daySchedule['SSL'].isLocked) {
            daySchedule['SSL'].shift = cifShift === 1 ? 2 : 1;
        } else if (!daySchedule['CIF'].isLocked) {
            daySchedule['CIF'].shift = sslShift === 1 ? 2 : 1;
        }
    }

    // Fix: Minimal 1 laki-laki per shift
    const shift1MaleCount = TEAM.filter(m => daySchedule[m.id].shift === 1 && m.gender === 'M').length;
    const shift2MaleCount = TEAM.filter(m => daySchedule[m.id].shift === 2 && m.gender === 'M').length;

    if (shift1MaleCount === 0) {
        // Cari laki-laki dari shift 2 yang tidak locked untuk dipindah
        const maleInShift2 = TEAM.find(m =>
            daySchedule[m.id].shift === 2 &&
            m.gender === 'M' &&
            !daySchedule[m.id].isLocked
        );
        if (maleInShift2) {
            // Swap dengan perempuan di shift 1
            const femaleInShift1 = TEAM.find(m =>
                daySchedule[m.id].shift === 1 &&
                m.gender === 'F' &&
                !daySchedule[m.id].isLocked
            );
            if (femaleInShift1) {
                daySchedule[maleInShift2.id].shift = 1;
                daySchedule[femaleInShift1.id].shift = 2;
            }
        }
    }

    if (shift2MaleCount === 0) {
        const maleInShift1 = TEAM.find(m =>
            daySchedule[m.id].shift === 1 &&
            m.gender === 'M' &&
            !daySchedule[m.id].isLocked
        );
        if (maleInShift1) {
            const femaleInShift2 = TEAM.find(m =>
                daySchedule[m.id].shift === 2 &&
                m.gender === 'F' &&
                !daySchedule[m.id].isLocked
            );
            if (femaleInShift2) {
                daySchedule[maleInShift1.id].shift = 2;
                daySchedule[femaleInShift2.id].shift = 1;
            }
        }
    }

    // Fix: Minimal 1 Pemimpin Sif (PS) per shift - CIF/SSL/SJL
    const shift1Leaders = LEADERS.filter(l => daySchedule[l.id].shift === 1);
    const shift2Leaders = LEADERS.filter(l => daySchedule[l.id].shift === 2);

    // Jika shift 1 tidak ada leader, pindahkan dari shift 2
    if (shift1Leaders.length === 0 && shift2Leaders.length > 1) {
        const leaderToMove = shift2Leaders.find(l => !daySchedule[l.id].isLocked);
        if (leaderToMove) {
            // Swap dengan non-leader di shift 1
            const nonLeaderInShift1 = TEAM.find(m =>
                daySchedule[m.id].shift === 1 &&
                !m.isLeader &&
                !daySchedule[m.id].isLocked
            );
            if (nonLeaderInShift1) {
                daySchedule[leaderToMove.id].shift = 1;
                daySchedule[nonLeaderInShift1.id].shift = 2;
            }
        }
    }

    // Jika shift 2 tidak ada leader, pindahkan dari shift 1
    if (shift2Leaders.length === 0 && shift1Leaders.length > 1) {
        const leaderToMove = shift1Leaders.find(l => !daySchedule[l.id].isLocked);
        if (leaderToMove) {
            const nonLeaderInShift2 = TEAM.find(m =>
                daySchedule[m.id].shift === 2 &&
                !m.isLeader &&
                !daySchedule[m.id].isLocked
            );
            if (nonLeaderInShift2) {
                daySchedule[leaderToMove.id].shift = 2;
                daySchedule[nonLeaderInShift2.id].shift = 1;
            }
        }
    }
}

// =============================================
// UI RENDERING (IMMUTABLE STATIC GRID)
// =============================================

// Inisialisasi Grid Statis (Absolut Calendar Schema)
// Dipanggil HANYA SEKALI saat load halaman atau ganti konteks bulan (eksplisit)
function initializeStaticGrid() {
    // Gunakan bulan saat ini sebagai referensi schema standar
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11

    // Schema Standar: Tanggal 1 sampai akhir bulan
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Set default value selector (Data Layer) agar sinkron dengan View tapi tidak trigger re-render
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (!startDateInput.value) startDateInput.value = formatDate(firstDay);
    if (!endDateInput.value) endDateInput.value = formatDate(lastDay);

    const dates = getDateRange(formatDate(firstDay), formatDate(lastDay));
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');

    // 1. Render Header (Structural Layer - Fixed)
    let headerHTML = '<tr><th>Anggota</th>';
    dates.forEach(dateStr => {
        const date = parseDate(dateStr);
        const dayIndex = date.getDay();
        const dayName = DAY_NAMES_SHORT[dayIndex];
        const dayNum = date.getDate();
        const isHoliday = isNationalHoliday(dateStr);
        const holidayName = getHolidayName(dateStr);

        let classes = 'date-header';
        if (isHoliday) classes += ' holiday';

        const tooltip = holidayName ? ` title="${holidayName}"` : '';
        headerHTML += `<th class="${classes}"${tooltip}>
            ${dayNum}
            <span class="day-name">${dayName}</span>
        </th>`;
    });
    headerHTML += '</tr>';
    tableHead.innerHTML = headerHTML;

    // 2. Render Body Grid (Structural Layer - Fixed)
    let bodyHTML = '';
    TEAM.forEach(member => {
        bodyHTML += `<tr><th>${member.name}</th>`;

        dates.forEach(dateStr => {
            // Render sel kosong (Placeholder)
            bodyHTML += `<td data-date="${dateStr}" data-member="${member.id}">
                <span class="shift-badge">-</span>
            </td>`;
        });

        bodyHTML += '</tr>';
    });
    tableBody.innerHTML = bodyHTML;

    // Attach interaction handlers (Read/Write Data Layer)
    tableBody.querySelectorAll('td').forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    console.log("Static Grid Initialized: Structure Locked.");
}

// Update Values pada Grid (Data Injection)
// TIDAK PERNAH mengubah struktur tabel (baris/kolom)
function updateGridValues() {
    console.log("Mapping Data to Static Grid...");
    const tableBody = document.getElementById('tableBody');

    // Iterasi setiap cell yang ADA di tabel (View Driven)
    const cells = tableBody.querySelectorAll('td[data-date]');

    cells.forEach(cell => {
        const dateStr = cell.dataset.date;
        const memberId = cell.dataset.member;

        // Ambil data jika ada (Data Layer)
        const cellData = scheduleData.schedule[dateStr]?.[memberId];

        const badge = cell.querySelector('.shift-badge');
        if (!badge) return;

        // Default state (Empty/Reset)
        let shiftClass = 'shift-badge';
        let shiftText = '-';

        if (cellData) {
            const shift = cellData.shift;

            if (shift === 1) {
                shiftClass += ' shift-1';
                shiftText = '1';
            } else if (shift === 2) {
                shiftClass += ' shift-2';
                shiftText = '2';
            } else if (shift === 'OFF') {
                shiftClass += ' shift-off';
                shiftText = 'OFF';
            }

            if (cellData.isPK) shiftClass += ' has-pk';
            if (cellData.isLocked) shiftClass += ' is-locked';
        }

        // Apply visual state (Mutation minimal)
        if (badge.className !== shiftClass) badge.className = shiftClass;
        if (badge.textContent !== shiftText) badge.textContent = shiftText;
    });

    // Update Header Event Markers jika perlu (Optional, visual only, tanpa ubah struktur)
    const tableHead = document.getElementById('tableHead');
    const headerCells = tableHead.querySelectorAll('th.date-header');

    // Kita asumsikan grid statis selalu mulai dari tanggal 1 bulan saat ini
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dates = getDateRange(formatDate(new Date(currentYear, currentMonth, 1)), formatDate(new Date(currentYear, currentMonth + 1, 0)));

    if (headerCells.length === dates.length) {
        headerCells.forEach((th, index) => {
            const dateStr = dates[index];
            const isEvent = scheduleData.eventDates.includes(dateStr);
            // Toggle event class
            if (isEvent) th.classList.add('event');
            else th.classList.remove('event');
        });
    }
}

// Handle klik pada cell untuk edit manual
function handleCellClick(event) {
    const cell = event.currentTarget;
    const dateStr = cell.dataset.date;
    const memberId = cell.dataset.member;

    // Auto-init jika data schedule belum ada (Fitur Input Manual Awal)
    if (!scheduleData.schedule[dateStr]) {
        scheduleData.schedule[dateStr] = {};
        // Perlu inisialisasi struktur member dasar agar tidak error akses property nanti
        TEAM.forEach(m => {
            scheduleData.schedule[dateStr][m.id] = { shift: null, isPK: false, isLocked: false };
        });
    }

    if (!scheduleData.schedule[dateStr][memberId]) {
        // Init data object jika belum ada
        scheduleData.schedule[dateStr][memberId] = { shift: '-', isPK: false, isLocked: false };
    }

    const cellData = scheduleData.schedule[dateStr][memberId];
    const currentShift = cellData.shift;

    // Cycle: 1 -> 2 -> OFF -> 1
    let newShift;
    if (currentShift === 1) newShift = 2;
    else if (currentShift === 2) newShift = 'OFF';
    else newShift = 1;

    // Update Data Layer
    cellData.shift = newShift;
    cellData.isLocked = true;

    if (cellData.isPK && newShift !== 2) {
        cellData.isPK = false;
    }

    // Recalculate Logic Layer
    regenerateFromDate(dateStr);

    // Refresh View Layer
    updateGridValues();
}

// Regenerate jadwal dari tanggal tertentu ke depan
function regenerateFromDate(fromDate) {
    const dates = getDateRange(scheduleData.startDate, scheduleData.endDate);
    const fromIndex = dates.indexOf(fromDate);
    if (fromIndex === -1) return;

    // Dapatkan kondisi dari hari sebelumnya
    let lastPK = null;
    let lastOff = null;

    if (fromIndex > 0) {
        const prevDate = dates[fromIndex - 1];
        const prevDaySchedule = scheduleData.schedule[prevDate];

        // Cari siapa yang PK kemarin
        const pkMember = TEAM.find(m => prevDaySchedule[m.id]?.isPK);
        lastPK = pkMember ? pkMember.id : null;

        // Cari siapa yang OFF kemarin
        const offMember = TEAM.find(m => prevDaySchedule[m.id]?.shift === 'OFF');
        lastOff = offMember ? offMember.id : 'none';
    } else {
        lastPK = scheduleData.pkYesterday;
        lastOff = scheduleData.offYesterday;
    }

    // Track shift berturut-turut
    const consecutiveShifts = {};
    TEAM.forEach(m => consecutiveShifts[m.id] = { shift: null, count: 0 });

    // Track distribusi PK
    const pkCount = {};
    LEADERS.forEach(l => pkCount[l.id] = 0);

    // Hitung PK yang sudah ada sebelum fromDate
    for (let i = 0; i < fromIndex; i++) {
        const d = dates[i];
        TEAM.forEach(m => {
            if (scheduleData.schedule[d][m.id]?.isPK) {
                pkCount[m.id] = (pkCount[m.id] || 0) + 1;
            }
        });
    }

    // Regenerate mulai dari fromDate
    for (let i = fromIndex; i < dates.length; i++) {
        const dateStr = dates[i];
        const isEvent = scheduleData.eventDates.includes(dateStr);
        const dayOfWeek = parseDate(dateStr).getDay();

        // Inisialisasi jika belum ada
        if (!scheduleData.schedule[dateStr]) {
            scheduleData.schedule[dateStr] = {};
        }

        // Skip cell yang locked
        TEAM.forEach(member => {
            if (!scheduleData.schedule[dateStr][member.id]) {
                scheduleData.schedule[dateStr][member.id] = { shift: null, isPK: false, isLocked: false };
            } else if (scheduleData.schedule[dateStr][member.id].isLocked) {
                // Pertahankan nilai locked
                return;
            } else {
                // Reset untuk regenerate
                scheduleData.schedule[dateStr][member.id] = { shift: null, isPK: false, isLocked: false };
            }
        });

        // Terapkan constraint wajib untuk non-locked
        if (lastPK && !scheduleData.schedule[dateStr][lastPK]?.isLocked) {
            scheduleData.schedule[dateStr][lastPK].shift = 1;
        }

        if (lastOff && lastOff !== 'none' && !scheduleData.schedule[dateStr][lastOff]?.isLocked) {
            scheduleData.schedule[dateStr][lastOff].shift = 2;
        }

        // Assign shift untuk yang belum dapat
        let unassigned = TEAM.filter(m =>
            scheduleData.schedule[dateStr][m.id].shift === null &&
            !scheduleData.schedule[dateStr][m.id].isLocked
        );

        // RANDOMIZE agar adil
        unassigned = shuffleArray(unassigned);

        unassigned.forEach(member => {
            const prevDateStr = i > 0 ? dates[i - 1] : null;
            const prevShift = prevDateStr ? scheduleData.schedule[prevDateStr]?.[member.id]?.shift : null;

            const weeklyOffCount = countWeeklyOff(scheduleData.schedule, dateStr, member.id);

            // Mandatory Off Logic
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const mandatoryOff = (weeklyOffCount === 0 && dayOfWeek === 0) || (weeklyOffCount === 0 && dayOfWeek === 6 && !isEvent);

            const canTakeOff = !isEvent && (weeklyOffCount < 1 || mandatoryOff);

            let bestShift = null;
            let bestScore = -Infinity;

            const options = canTakeOff ? [1, 2, 'OFF'] : [1, 2];

            // Cek distribusi OFF harian
            const currentOffCount = Object.values(scheduleData.schedule[dateStr]).filter(s => s.shift === 'OFF').length;

            options.forEach(shift => {
                let score = 0;
                const consec = consecutiveShifts[member.id];

                // Anti-zigzag: Bonus besar jika shift sama dengan kemarin (mendorong 1-1-2-2)
                if (prevShift === shift && shift !== 'OFF') {
                    if (consec.count < 2) {
                        score += 25;
                    } else if (consec.count >= 3) {
                        score -= 15;
                    }
                }

                // Penalti untuk zigzag
                if (prevShift !== null && prevShift !== 'OFF' && shift !== 'OFF' && prevShift !== shift) {
                    if (consec.count === 1 && consec.shift !== shift) {
                        score -= 20;
                    }
                }

                // Balance Daily Off
                if (shift === 'OFF') {
                    if (weeklyOffCount === 0) {
                        score += 60;
                        if (mandatoryOff) score += 1000;
                        else if (dayOfWeek >= 5) score += 40;
                    } else {
                        score -= 50;
                    }

                    if (currentOffCount === 0) score += 25;
                    else if (currentOffCount >= 1) score -= 15;
                }

                if (shift === 'OFF' && prevShift !== 1) {
                    score -= 20;
                }

                const shift1Count = Object.values(scheduleData.schedule[dateStr]).filter(s => s.shift === 1).length;
                const shift2Count = Object.values(scheduleData.schedule[dateStr]).filter(s => s.shift === 2).length;

                if (shift === 1 && shift1Count < shift2Count) score += 5;
                if (shift === 2 && shift2Count < shift1Count) score += 5;

                if (member.id === 'CIF' || member.id === 'SSL') {
                    const otherId = member.id === 'CIF' ? 'SSL' : 'CIF';
                    const otherShift = scheduleData.schedule[dateStr][otherId]?.shift;
                    if (otherShift === shift && shift !== 'OFF') {
                        score -= 100;
                    }
                }

                score += Math.random() * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestShift = shift;
                }
            });

            scheduleData.schedule[dateStr][member.id].shift = bestShift;
        });

        // Fix violations
        fixConstraintViolations(scheduleData.schedule, dateStr, isEvent);

        // Assign PK
        const daySchedule = scheduleData.schedule[dateStr];
        const shift2Leaders = LEADERS.filter(l => daySchedule[l.id].shift === 2 && !daySchedule[l.id].isLocked);

        // Reset semua PK untuk hari ini yang tidak locked
        TEAM.forEach(m => {
            if (!daySchedule[m.id].isLocked) {
                daySchedule[m.id].isPK = false;
            }
        });

        if (shift2Leaders.length > 0) {
            shift2Leaders.sort((a, b) => (pkCount[a.id] || 0) - (pkCount[b.id] || 0));
            const selectedPK = shift2Leaders[0].id;
            daySchedule[selectedPK].isPK = true;
            pkCount[selectedPK] = (pkCount[selectedPK] || 0) + 1;
            lastPK = selectedPK;
        } else {
            const lockedPK = LEADERS.find(l => daySchedule[l.id].shift === 2 && daySchedule[l.id].isLocked);
            if (lockedPK) {
                daySchedule[lockedPK.id].isPK = true;
                lastPK = lockedPK.id;
            } else {
                lastPK = null;
            }
        }

        // Catat OFF
        const offToday = TEAM.find(m => daySchedule[m.id].shift === 'OFF');
        lastOff = offToday ? offToday.id : 'none';

        // Update consecutive
        TEAM.forEach(m => {
            const shift = daySchedule[m.id].shift;
            if (consecutiveShifts[m.id].shift === shift) {
                consecutiveShifts[m.id].count++;
            } else {
                consecutiveShifts[m.id] = { shift, count: 1 };
            }
        });
    }
}


// =============================================
// EVENT HANDLERS
// =============================================

document.addEventListener('DOMContentLoaded', function () {
    // 1. Initialize Static View (Structural Layer)
    initializeStaticGrid();

    // Elements
    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettings');

    // Action Buttons
    const generateBtn = document.getElementById('prepareBtn');
    const fastGenerateBtn = document.getElementById('fastGenerateBtn');
    const printBtn = document.getElementById('printBtn');

    // UI Init
    if (generateBtn) generateBtn.textContent = 'GENERATE JADWAL';

    // Set default dates (bulan ini)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    if (startInput) startInput.value = formatDate(firstDay);
    if (endInput) endInput.value = formatDate(lastDay);

    // --- SETTINGS MODAL INTERACTION ---

    if (settingsBtn) {
        settingsBtn.addEventListener('click', function () {
            settingsModal.classList.add('active');
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function () {
            settingsModal.classList.remove('active');
        });
    }

    if (settingsModal) {
        const backdrop = settingsModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', function () {
                settingsModal.classList.remove('active');
            });
        }
    }

    // --- FAST GENERATE ACTION (+7 Days) ---
    if (fastGenerateBtn) {
        fastGenerateBtn.addEventListener('click', function () {
            // 1. Tentukan Start Date
            let nextStart = new Date();

            // Cek jadwal terakhir yg ada isi
            const existingDates = Object.keys(scheduleData.schedule).sort();
            let lastFilledDateStr = null;

            // Cari tanggal terakhir yg ada shift assign
            for (let i = existingDates.length - 1; i >= 0; i--) {
                const d = existingDates[i];
                const hasData = TEAM.some(m => {
                    const cell = scheduleData.schedule[d][m.id];
                    return cell && cell.shift !== null;
                });

                if (hasData) {
                    lastFilledDateStr = d;
                    break;
                }
            }

            if (lastFilledDateStr) {
                const lastDate = parseDate(lastFilledDateStr);
                lastDate.setDate(lastDate.getDate() + 1);
                nextStart = lastDate;
            } else {
                nextStart = new Date();
            }

            const startDate = formatDate(nextStart);
            const nextEnd = new Date(nextStart);
            nextEnd.setDate(nextEnd.getDate() + 6);
            const endDate = formatDate(nextEnd);

            scheduleData.startDate = startDate;
            scheduleData.endDate = endDate;

            if (startInput) startInput.value = startDate;
            if (endInput) endInput.value = endDate;

            try {
                const newSchedule = generateSchedule();
                Object.assign(scheduleData.schedule, newSchedule);
                updateGridValues();
                if (printBtn) printBtn.style.display = 'inline-flex';
            } catch (e) {
                console.error(e);
                alert('Error fast generate: ' + e.message);
            }
        });
    }

    // --- GENERATE ACTION (Direct Execute) ---

    if (generateBtn) {
        generateBtn.addEventListener('click', function () {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!startDate || !endDate) {
                alert('Mohon isi tanggal mulai dan selesai!');
                return;
            }

            if (parseDate(startDate) > parseDate(endDate)) {
                alert('Tanggal mulai harus sebelum tanggal selesai!');
                return;
            }

            // Parse event dates
            const eventDatesInput = document.getElementById('eventDates').value;
            const eventDates = eventDatesInput
                .split(',')
                .map(d => d.trim())
                .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d));

            // Update Data Layer
            scheduleData.startDate = startDate;
            scheduleData.endDate = endDate;
            scheduleData.eventDates = eventDates;

            // EXECUTE GENERATOR
            try {
                const newSchedule = generateSchedule();
                Object.assign(scheduleData.schedule, newSchedule);

                // Update UI
                updateGridValues();

                // Close Modal & Show Print
                if (settingsModal) settingsModal.classList.remove('active');
                if (printBtn) printBtn.style.display = 'inline-flex';

            } catch (e) {
                console.error(e);
                alert('Terjadi kesalahan saat generate jadwal: ' + e.message);
            }
        });
    }

    // Tombol Cetak
    if (printBtn) {
        printBtn.addEventListener('click', function () {
            window.print();
        });
    }
});
