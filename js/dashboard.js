/* ============================================================
   Dashboard Module – AC Service Pro
   Stats, charts (canvas), recent activity, upcoming appointments
   ============================================================ */

const DashboardModule = (() => {
    /* ── helpers ────────────────────────────────────────────── */
    const $ = (id) => document.getElementById(id);

    const MONTH_NAMES_TH = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const SERVICE_TYPE_COLORS = {
        'ล้างแอร์': '#00bcd4',
        'ซ่อมแอร์': '#ff5722',
        'ติดตั้ง': '#4caf50',
        'ย้ายแอร์': '#ff9800',
        'ถอดแอร์': '#9c27b0',
        'เติมน้ำยา': '#2196f3'
    };

    const SERVICE_TYPE_LABELS = {
        'ล้างแอร์': 'ล้างแอร์',
        'ซ่อมแอร์': 'ซ่อมแอร์',
        'ติดตั้ง': 'ติดตั้ง',
        'ย้ายแอร์': 'ย้ายแอร์',
        'ถอดแอร์': 'ถอดแอร์',
        'เติมน้ำยา': 'เติมน้ำยา'
    };

    /* ── animated counter ───────────────────────────────────── */
    function animateCounter(el, target, duration = 800, prefix = '', suffix = '') {
        const start = 0;
        const startTime = performance.now();
        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            const current = Math.round(start + (target - start) * eased);
            el.textContent = prefix + current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /* ── compute stats ──────────────────────────────────────── */
    function computeStats() {
        const customers = DB.getAll('customers');
        const services = DB.getAll('services');
        const appointments = DB.getAll('appointments');

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // This month services & revenue
        const thisMonthServices = services.filter(s => {
            const d = new Date(s.serviceDate || s.createdAt);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        const revenueThisMonth = thisMonthServices.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);

        // Today appointments
        const todayAppointments = appointments.filter(a => a.date === todayStr);

        // Pending appointments
        const pendingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'in-progress');

        // Unpaid services
        const unpaidServices = services.filter(s => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial');
        const unpaidTotal = unpaidServices.reduce((sum, s) => sum + ((Number(s.price) || 0) - (Number(s.paidAmount) || 0)), 0);

        return {
            totalCustomers: customers.length,
            servicesThisMonth: thisMonthServices.length,
            revenueThisMonth,
            todayAppointments: todayAppointments.length,
            pendingAppointments: pendingAppointments.length,
            unpaidTotal,
            customers,
            services,
            appointments
        };
    }

    /* ── render stat cards ──────────────────────────────────── */
    function renderStatCards(stats) {
        const container = $('dashboard-stats-grid');
        if (!container) return;

        container.innerHTML = `
            <div class="stat-card" id="stat-card-customers">
                <div class="stat-icon cyan"><i data-lucide="users"></i></div>
                <div class="stat-info">
                    <span class="stat-value" id="stat-total-customers">0</span>
                    <span class="stat-label">ลูกค้าทั้งหมด</span>
                </div>
            </div>
            <div class="stat-card" id="stat-card-services">
                <div class="stat-icon teal"><i data-lucide="wrench"></i></div>
                <div class="stat-info">
                    <span class="stat-value" id="stat-services-month">0</span>
                    <span class="stat-label">บริการเดือนนี้</span>
                </div>
            </div>
            <div class="stat-card" id="stat-card-revenue">
                <div class="stat-icon success"><i data-lucide="banknote"></i></div>
                <div class="stat-info">
                    <span class="stat-value" id="stat-revenue-month">0</span>
                    <span class="stat-label">รายได้เดือนนี้</span>
                </div>
            </div>
            <div class="stat-card" id="stat-card-appointments">
                <div class="stat-icon warning"><i data-lucide="calendar-check"></i></div>
                <div class="stat-info">
                    <span class="stat-value" id="stat-today-appointments">0</span>
                    <span class="stat-label">นัดหมายวันนี้</span>
                </div>
            </div>
        `;

        // Re-init lucide icons
        if (window.lucide) lucide.createIcons();

        // Animate
        animateCounter($('stat-total-customers'), stats.totalCustomers);
        animateCounter($('stat-services-month'), stats.servicesThisMonth);
        animateCounter($('stat-revenue-month'), stats.revenueThisMonth, 1000, '฿');
        animateCounter($('stat-today-appointments'), stats.todayAppointments);
    }

    /* ── revenue bar chart (last 6 months) ──────────────────── */
    function drawRevenueChart(services) {
        const canvas = $('dashboard-revenue-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // High-DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width || 500;
        const h = 320;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        // Collect last 6 months revenue
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES_TH[d.getMonth()] });
        }

        const data = months.map(m => {
            return services
                .filter(s => {
                    const d = new Date(s.serviceDate || s.createdAt);
                    return d.getFullYear() === m.year && d.getMonth() === m.month;
                })
                .reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
        });

        const maxVal = Math.max(...data, 10000);

        // Chart area
        const padding = { top: 30, right: 20, bottom: 40, left: 65 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const barW = Math.min(chartW / months.length * 0.5, 50);
        const gap = chartW / months.length;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Resolve colors dynamically from CSS variables
        const style = getComputedStyle(document.documentElement);
        const textPrimary = style.getPropertyValue('--text-primary').trim() || '#0f172a';
        const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#475569';
        const textMuted = style.getPropertyValue('--text-muted').trim() || '#64748b';
        const borderColor = style.getPropertyValue('--border-color').trim() || '#e2e8f0';

        // Grid lines
        const gridLines = 5;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = textMuted;
        ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + chartH - (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            const val = Math.round((maxVal / gridLines) * i);
            ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString(), padding.left - 8, y + 4);
        }

        // Bars
        months.forEach((m, i) => {
            const barH = (data[i] / maxVal) * chartH;
            const x = padding.left + gap * i + (gap - barW) / 2;
            const y = padding.top + chartH - barH;

            // Gradient bar
            const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            grad.addColorStop(0, '#0284c7');
            grad.addColorStop(1, '#0ea5e9');
            ctx.fillStyle = grad;

            // Rounded top
            const radius = Math.min(barW / 2, 6);
            ctx.beginPath();
            ctx.moveTo(x, padding.top + chartH);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + barW - radius, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
            ctx.lineTo(x + barW, padding.top + chartH);
            ctx.closePath();
            ctx.fill();

            // Bar value on top
            if (data[i] > 0) {
                ctx.fillStyle = textSecondary;
                ctx.font = '10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(
                    data[i] >= 1000 ? (data[i] / 1000).toFixed(1) + 'k' : data[i].toString(),
                    x + barW / 2,
                    y - 6
                );
            }

            // Label
            ctx.fillStyle = textSecondary;
            ctx.font = '12px "Noto Sans Thai", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.label, x + barW / 2, padding.top + chartH + 22);
        });
    }

    /* ── service type donut chart ───────────────────────────── */
    function drawServiceTypeChart(services) {
        const canvas = $('dashboard-service-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(canvas.parentElement.getBoundingClientRect().width - 40 || 400, 400);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);

        // Count by type
        const types = {};
        services.forEach(s => {
            const t = s.type || 'อื่นๆ';
            types[t] = (types[t] || 0) + 1;
        });

        const entries = Object.entries(types).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, e) => s + e[1], 0);

        // Resolve colors dynamically from CSS variables
        const style = getComputedStyle(document.documentElement);
        const textPrimary = style.getPropertyValue('--text-primary').trim() || '#0f172a';
        const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#475569';
        const textMuted = style.getPropertyValue('--text-muted').trim() || '#64748b';

        if (total === 0) {
            ctx.fillStyle = textMuted;
            ctx.font = '14px "Noto Sans Thai", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ไม่มีข้อมูล', size / 2, size / 2);
            return;
        }

        const cx = size / 2;
        const cy = size * 0.42;
        const outerR = size * 0.32;
        const innerR = outerR * 0.58;
        let startAngle = -Math.PI / 2;

        entries.forEach(([type, count]) => {
            const sliceAngle = (count / total) * 2 * Math.PI;
            const color = SERVICE_TYPE_COLORS[type] || '#888';

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            startAngle += sliceAngle;
        });

        // Center text
        ctx.fillStyle = textPrimary;
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total.toString(), cx, cy - 6);
        ctx.font = '11px "Noto Sans Thai", sans-serif';
        ctx.fillStyle = textMuted;
        ctx.fillText('รายการทั้งหมด', cx, cy + 14);

        // Legend below
        const legendY = cy + outerR + 16;
        const legendCols = Math.min(entries.length, 3);
        const colW = size / legendCols;
        entries.forEach(([type, count], i) => {
            const col = i % legendCols;
            const row = Math.floor(i / legendCols);
            const lx = col * colW + 10;
            const ly = legendY + row * 18;

            ctx.fillStyle = SERVICE_TYPE_COLORS[type] || '#888';
            ctx.fillRect(lx, ly, 10, 10);

            ctx.fillStyle = textSecondary;
            ctx.font = '10px "Noto Sans Thai", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const label = (SERVICE_TYPE_LABELS[type] || type) + ' (' + count + ')';
            ctx.fillText(label, lx + 14, ly);
        });
    }

    /* ── recent services table ──────────────────────────────── */
    function renderRecentServices(services) {
        const container = $('dashboard-recent-services');
        if (!container) return;

        const sorted = [...services].sort((a, b) => {
            return new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt);
        }).slice(0, 5);

        if (sorted.length === 0) {
            container.innerHTML = '<p class="empty-state-text">ยังไม่มีรายการบริการ</p>';
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table" id="dashboard-recent-table">
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>ลูกค้า</th>
                            <th>ประเภท</th>
                            <th>ราคา</th>
                            <th>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sorted.forEach(s => {
            const cust = DB.getById('customers', s.customerId);
            const custName = cust ? cust.name : 'ไม่ทราบ';
            const payClass = s.paymentStatus === 'paid' ? 'badge-success'
                : s.paymentStatus === 'partial' ? 'badge-warning'
                : 'badge-danger';
            const payLabel = s.paymentStatus === 'paid' ? 'ชำระแล้ว'
                : s.paymentStatus === 'partial' ? 'บางส่วน'
                : 'ค้างชำระ';

            html += `
                <tr>
                    <td>${App.formatDate(s.serviceDate || s.createdAt)}</td>
                    <td>${custName}</td>
                    <td><span class="service-type-badge">${s.type}</span></td>
                    <td>${App.formatCurrency(s.price)}</td>
                    <td><span class="badge ${payClass}">${payLabel}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    /* ── upcoming appointments ──────────────────────────────── */
    function renderUpcomingAppointments(appointments) {
        const container = $('dashboard-upcoming-appointments');
        if (!container) return;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const upcoming = appointments
            .filter(a => a.date >= todayStr && (a.status === 'pending' || a.status === 'in-progress'))
            .sort((a, b) => {
                if (a.date === b.date) return (a.time || '').localeCompare(b.time || '');
                return a.date.localeCompare(b.date);
            })
            .slice(0, 6);

        if (upcoming.length === 0) {
            container.innerHTML = '<p class="empty-state-text">ไม่มีนัดหมายที่กำลังจะมาถึง</p>';
            return;
        }

        let html = '<ul class="upcoming-list" id="dashboard-upcoming-list">';
        upcoming.forEach(a => {
            const cust = DB.getById('customers', a.customerId);
            const custName = cust ? cust.name : 'ลูกค้าทั่วไป';
            const isToday = a.date === todayStr;
            const statusClass = a.status === 'in-progress' ? 'badge-info' : 'badge-warning';
            const statusLabel = a.status === 'in-progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ';

            html += `
                <li class="upcoming-item ${isToday ? 'upcoming-today' : ''}" id="dashboard-apt-${a.id}">
                    <div class="upcoming-item-time">
                        <span class="upcoming-date">${isToday ? 'วันนี้' : App.formatDate(a.date)}</span>
                        <span class="upcoming-time-value">${a.time || '--:--'}</span>
                    </div>
                    <div class="upcoming-item-info">
                        <span class="upcoming-customer">${custName}</span>
                        <span class="upcoming-service">${a.serviceType || '-'}</span>
                    </div>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    /* ── unpaid summary ─────────────────────────────────────── */
    function renderUnpaidSummary(stats) {
        const container = $('dashboard-unpaid-summary');
        if (!container) return;

        const services = stats.services.filter(s => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial');
        if (services.length === 0) {
            container.innerHTML = '';
            return;
        }

        const total = services.reduce((sum, s) => sum + ((Number(s.price) || 0) - (Number(s.paidAmount) || 0)), 0);
        container.innerHTML = `
            <div class="alert-banner alert-danger" id="dashboard-unpaid-alert">
                <i data-lucide="circle-alert"></i>
                <span>ยอดค้างชำระ ${services.length} รายการ รวม <strong>${App.formatCurrency(total)}</strong></span>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    /* ── main render ────────────────────────────────────────── */
    function render() {
        const stats = computeStats();

        renderStatCards(stats);

        const user = typeof DB !== 'undefined' ? DB.getCurrentUser() : null;
        const isAdmin = user && user.role === 'admin';

        if (isAdmin) {
            renderUnpaidSummary(stats);
            drawRevenueChart(stats.services);
            const revChartCard = $('chart-revenue-card');
            if (revChartCard) revChartCard.style.display = 'block';
        } else {
            const unpaidContainer = $('dashboard-unpaid-summary');
            if (unpaidContainer) unpaidContainer.innerHTML = '';
            const revChartCard = $('chart-revenue-card');
            if (revChartCard) revChartCard.style.display = 'none';
        }

        // Hide revenue card in stats grid if not admin
        if (!isAdmin) {
            const revCard = $('stat-card-revenue');
            if (revCard) revCard.style.display = 'none';
        }

        drawServiceTypeChart(stats.services);
        renderRecentServices(stats.services);
        renderUpcomingAppointments(stats.appointments);
    }

    /* ── resize handler for charts ──────────────────────────── */
    let resizeTimer;
    function handleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (App.currentPage === 'dashboard') {
                const services = DB.getAll('services');
                drawRevenueChart(services);
                drawServiceTypeChart(services);
            }
        }, 250);
    }

    /* ── public API ─────────────────────────────────────────── */
    function init() {
        window.addEventListener('resize', handleResize);
        render();
    }

    function refresh() {
        render();
    }

    return { init, refresh };
})();
