/* ============================================================
   Appointments Module – AC Service Pro
   Calendar view, CRUD, status management, overdue alerts
   ============================================================ */

const AppointmentsModule = (() => {
    const $ = (id) => document.getElementById(id);

    const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const MONTH_NAMES = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const STATUS_MAP = {
        'pending': { label: 'รอดำเนินการ', cls: 'badge-warning', icon: 'clock' },
        'in-progress': { label: 'กำลังดำเนินการ', cls: 'badge-info', icon: 'loader' },
        'completed': { label: 'เสร็จสิ้น', cls: 'badge-success', icon: 'check-circle' },
        'cancelled': { label: 'ยกเลิก', cls: 'badge-danger', icon: 'x-circle' },
        'no-one-home': { label: 'ไม่มีคนอยู่/ติดต่อไม่ได้', cls: 'badge-no-one-home', icon: 'user-x' }
    };
    const SERVICE_TYPES = ['ล้างแอร์', 'ซ่อมแอร์', 'ติดตั้ง', 'ย้ายแอร์', 'ถอดแอร์', 'เติมน้ำยา'];

    let calendarYear, calendarMonth; // 0-indexed month
    let listFilter = ''; // status filter
    let selectedDate = ''; // YYYY-MM-DD
    let isQuickAddingCustomer = false;

    /* ── generate next ID ───────────────────────────────────── */
    function nextId() {
        const all = DB.getAll('appointments');
        if (all.length === 0) return 'APT-001';
        const nums = all.map(a => parseInt(a.id.replace('APT-', ''), 10) || 0);
        return 'APT-' + String(Math.max(...nums) + 1).padStart(3, '0');
    }

    /* ── helpers ─────────────────────────────────────────────── */
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }


    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function dateStr(y, m, d) {
        return `${y}-${pad2(m + 1)}-${pad2(d)}`;
    }

    /* ── calendar rendering ──────────────────────────────────── */
    function renderCalendar() {
        const gridEl = $('calendar-grid');
        if (!gridEl) return;

        const today = new Date();
        const todayDate = todayStr();

        const year = calendarYear;
        const month = calendarMonth;

        // Header
        const headerEl = $('appointments-calendar-title');
        if (headerEl) headerEl.textContent = `${MONTH_NAMES[month]} ${year + 543}`;

        // Build grid
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Get appointments for this month
        const appointments = DB.getAll('appointments');
        const monthAppointments = {};
        appointments.forEach(a => {
            const d = a.date;
            if (d && d.startsWith(`${year}-${pad2(month + 1)}`)) {
                if (!monthAppointments[d]) monthAppointments[d] = [];
                monthAppointments[d].push(a);
            }
        });

        let html = '';

        // Weekday headers
        WEEKDAYS.forEach(wd => {
            html += `<div class="calendar-day-header">${wd}</div>`;
        });

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = dateStr(year, month, d);
            const isToday = ds === todayDate;
            const isSelected = ds === selectedDate;
            const dayAppts = monthAppointments[ds] || [];
            const hasAppts = dayAppts.length > 0;

            let cls = 'calendar-day';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';
            if (hasAppts) cls += ' has-appointments';

            // Check for overdue
            const hasOverdue = dayAppts.some(a =>
                ds < todayDate && (a.status === 'pending' || a.status === 'in-progress')
            );
            if (hasOverdue) cls += ' overdue';

            html += `<div class="${cls}" data-date="${ds}" id="cal-day-${ds}">`;
            html += `<span class="day-number">${d}</span>`;

            if (hasAppts) {
                html += '<div class="calendar-dots">';
                dayAppts.slice(0, 3).forEach(a => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP['pending'];
                    html += `<span class="calendar-dot ${st.cls}" title="${a.serviceType || ''} - ${st.label}"></span>`;
                });
                if (dayAppts.length > 3) {
                    html += `<span class="calendar-dot-more">+${dayAppts.length - 3}</span>`;
                }
                html += '</div>';
            }

            html += '</div>';
        }

        gridEl.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    /* ── overdue alerts ──────────────────────────────────────── */
    function renderOverdueAlert() {
        const container = $('appointments-overdue-alert');
        if (!container) return;

        const today = todayStr();
        const all = DB.getAll('appointments');
        const overdue = all.filter(a =>
            a.date < today && (a.status === 'pending' || a.status === 'in-progress')
        );

        if (overdue.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="alert-banner alert-danger" id="overdue-alert-banner">
                <i data-lucide="alert-triangle"></i>
                <span>มีนัดหมายเลยกำหนด <strong>${overdue.length}</strong> รายการ</span>
                <button class="btn btn-sm btn-outline" id="btn-show-overdue">ดูรายการ</button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    /* ── appointments list ───────────────────────────────────── */
    function renderList() {
        const container = $('appointments-list-container');
        if (!container) return;

        const today = todayStr();
        let appointments = DB.getAll('appointments');

        // If a date is selected, show only that date
        if (selectedDate) {
            appointments = appointments.filter(a => a.date === selectedDate);
        } else {
            // Show current month by default
            const prefix = `${calendarYear}-${pad2(calendarMonth + 1)}`;
            appointments = appointments.filter(a => a.date && a.date.startsWith(prefix));
        }

        // Status filter
        if (listFilter) {
            appointments = appointments.filter(a => a.status === listFilter);
        }

        // Sort by date + time
        appointments.sort((a, b) => {
            if (a.date === b.date) return (a.time || '').localeCompare(b.time || '');
            return a.date.localeCompare(b.date);
        });

        const listTitle = $('appointments-list-title');
        if (listTitle) {
            if (selectedDate) {
                const [y, m, d] = selectedDate.split('-').map(Number);
                listTitle.textContent = `นัดหมายวันที่ ${d} ${MONTH_NAMES[m - 1]} ${y + 543}`;

            } else {
                listTitle.textContent = `นัดหมาย ${MONTH_NAMES[calendarMonth]} ${calendarYear + 543}`;
            }
        }

        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="appointments-empty">
                    <i data-lucide="calendar-off" class="empty-icon"></i>
                    <p>${selectedDate ? 'ไม่มีนัดหมายในวันนี้' : 'ไม่มีนัดหมายในเดือนนี้'}</p>
                    ${selectedDate ? `
                        <button class="btn btn-primary btn-sm" id="btn-empty-add-appointment" style="margin-top: 12px; display: inline-flex; align-items: center; gap: 4px;">
                            <i data-lucide="plus" style="width: 14px; height: 14px;"></i> เพิ่มคิวงานสำหรับวันนี้
                        </button>
                    ` : ''}
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        let html = '<div class="appointments-list" id="appointments-list">';
        appointments.forEach(a => {
            const cust = DB.getById('customers', a.customerId);
            const custName = cust ? cust.name : 'ลูกค้าทั่วไป';
            const st = STATUS_MAP[a.status] || STATUS_MAP['pending'];
            const isOverdue = a.date < today && (a.status === 'pending' || a.status === 'in-progress');
            const isToday = a.date === today;

            html += `
                <div class="appointment-card glass-card ${isOverdue ? 'overdue' : ''} ${isToday ? 'today-card' : ''}" id="apt-card-${a.id}">
                    <div class="apt-card-left">
                        <div class="apt-card-date">
                            <span class="apt-day">${parseInt(a.date.split('-')[2], 10)}</span>
                            <span class="apt-month">${MONTH_NAMES[parseInt(a.date.split('-')[1], 10) - 1].slice(0, 3)}</span>

                        </div>
                        <span class="apt-time">${a.time || '--:--'}</span>
                    </div>
                    <div class="apt-card-center">
                        <span class="apt-customer">${custName}</span>
                        <span class="apt-service-type">${a.serviceType || '-'}</span>
                        ${a.notes ? `<span class="apt-notes text-muted">${a.notes}</span>` : ''}
                        ${isOverdue ? '<span class="apt-overdue-tag"><i data-lucide="alert-circle"></i> เลยกำหนด</span>' : ''}
                    </div>
                    <div class="apt-card-right">
                        <span class="badge ${st.cls}">${st.label}</span>
                        <div class="apt-card-actions">
                            ${a.status === 'pending' ? `
                                <button class="btn btn-icon btn-ghost btn-apt-start" data-id="${a.id}" title="เริ่มงาน">
                                    <i data-lucide="play"></i>
                                </button>
                            ` : ''}
                            ${a.status === 'in-progress' ? `
                                <button class="btn btn-icon btn-ghost btn-apt-complete" data-id="${a.id}" title="เสร็จสิ้น">
                                    <i data-lucide="check"></i>
                                </button>
                            ` : ''}
                            ${a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'no-one-home' ? `
                                <button class="btn btn-icon btn-ghost btn-apt-no-home" data-id="${a.id}" title="ไม่มีคนอยู่/ติดต่อไม่ได้">
                                    <i data-lucide="user-x"></i>
                                </button>
                            ` : ''}
                            ${a.status !== 'completed' && a.status !== 'cancelled' ? `
                                <button class="btn btn-icon btn-ghost btn-apt-cancel" data-id="${a.id}" title="ยกเลิก">
                                    <i data-lucide="x"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-icon btn-ghost btn-share-appointment" data-id="${a.id}" title="คัดลอกข้อความแจ้งยืนยันนัดหมาย">
                                <i data-lucide="share-2"></i>
                            </button>
                            <button class="btn btn-icon btn-ghost btn-edit-appointment" data-id="${a.id}" title="แก้ไข">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="btn btn-icon btn-ghost btn-delete-appointment" data-id="${a.id}" title="ลบ">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    /* ── form helpers ────────────────────────────────────────── */
    function populateCustomerDropdown(selectId, selectedId) {
        const sel = $(selectId);
        if (!sel) return;
        const customers = DB.getAll('customers').sort((a, b) => a.name.localeCompare(b.name));
        let opts = '<option value="">-- เลือกลูกค้า --</option>';
        customers.forEach(c => {
            const selected = c.id === selectedId ? 'selected' : '';
            opts += `<option value="${c.id}" ${selected}>${c.name} (${c.phone || '-'})</option>`;
        });
        sel.innerHTML = opts;
    }

    function clearForm() {
        const form = $('appointment-form');
        if (form) form.reset();
        $('appointment-form-id').value = '';
        $('appointment-modal-title').textContent = 'เพิ่มนัดหมาย';
        populateCustomerDropdown('appointment-form-customer', '');
        // Default date
        $('appointment-form-date').value = selectedDate || todayStr();

        // Reset quick add customer state
        isQuickAddingCustomer = false;
        const selectContainer = $('appointment-customer-select-container');
        const quickContainer = $('appointment-quick-customer-container');
        if (selectContainer && quickContainer) {
            selectContainer.style.display = 'block';
            quickContainer.style.display = 'none';
            $('appointment-form-customer').required = true;
            $('appointment-quick-customer-name').required = false;
            $('appointment-quick-customer-phone').required = false;
            $('appointment-quick-customer-name').value = '';
            $('appointment-quick-customer-phone').value = '';
            $('appointment-quick-customer-address').value = '';
        }
    }

    function fillForm(apt) {
        $('appointment-form-id').value = apt.id;
        populateCustomerDropdown('appointment-form-customer', apt.customerId);
        $('appointment-form-type').value = apt.serviceType || '';
        $('appointment-form-date').value = apt.date || '';
        $('appointment-form-time').value = apt.time || '';
        $('appointment-form-status').value = apt.status || 'pending';
        $('appointment-form-notes').value = apt.notes || '';
        $('appointment-modal-title').textContent = 'แก้ไขนัดหมาย';

        // Reset quick add customer state when editing
        isQuickAddingCustomer = false;
        const selectContainer = $('appointment-customer-select-container');
        const quickContainer = $('appointment-quick-customer-container');
        if (selectContainer && quickContainer) {
            selectContainer.style.display = 'block';
            quickContainer.style.display = 'none';
            $('appointment-form-customer').required = true;
            $('appointment-quick-customer-name').required = false;
            $('appointment-quick-customer-phone').required = false;
            $('appointment-quick-customer-name').value = '';
            $('appointment-quick-customer-phone').value = '';
            $('appointment-quick-customer-address').value = '';
        }
    }

    function saveAppointment() {
        const id = $('appointment-form-id').value;
        let customerId = $('appointment-form-customer').value;
        const serviceType = $('appointment-form-type').value;
        const date = $('appointment-form-date').value;
        const time = $('appointment-form-time').value;
        const status = $('appointment-form-status').value || 'pending';
        const notes = $('appointment-form-notes').value.trim();

        if (!date) {
            App.showToast('กรุณาระบุวันที่', 'error');
            return;
        }
        if (!serviceType) {
            App.showToast('กรุณาเลือกประเภทบริการ', 'error');
            return;
        }

        // Check if quick adding customer
        if (isQuickAddingCustomer) {
            const name = $('appointment-quick-customer-name').value.trim();
            const phone = $('appointment-quick-customer-phone').value.trim();
            const address = $('appointment-quick-customer-address').value.trim();

            if (!name) {
                App.showToast('กรุณาระบุชื่อลูกค้าใหม่', 'error');
                $('appointment-quick-customer-name').focus();
                return;
            }
            if (!phone) {
                App.showToast('กรุณาระบุเบอร์โทรศัพท์ลูกค้าใหม่', 'error');
                $('appointment-quick-customer-phone').focus();
                return;
            }

            // Create customer
            try {
                const newCust = DB.create('customers', {
                    name,
                    phone,
                    address,
                    mapsLink: '',
                    lineId: '',
                    notes: 'สร้างด่วนจากหน้าตารางนัดหมาย',
                    createdAt: new Date().toISOString()
                });
                customerId = newCust.id;
                App.showToast(`สร้างลูกค้า ${name} สำเร็จ`, 'success');
            } catch (err) {
                App.showToast('ไม่สามารถสร้างลูกค้าใหม่ได้: ' + err.message, 'error');
                return;
            }
        } else {
            if (!customerId) {
                App.showToast('กรุณาเลือกลูกค้า', 'error');
                $('appointment-form-customer').focus();
                return;
            }
        }

        const data = { customerId, serviceType, date, time, status, notes };

        if (id) {
            const existing = DB.getById('appointments', id);
            DB.update('appointments', id, { ...existing, ...data });
            App.showToast('อัปเดตนัดหมายเรียบร้อย', 'success');
        } else {
            DB.add('appointments', {
                ...data,
                id: nextId(),
                createdAt: new Date().toISOString()
            });
            App.showToast('เพิ่มนัดหมายเรียบร้อย', 'success');
        }

        App.closeModal('appointment-modal');
        render();
    }

    function deleteAppointment(id) {
        const apt = DB.getById('appointments', id);
        if (!apt) return;

        const cust = DB.getById('customers', apt.customerId);
        const custName = cust ? cust.name : 'ลูกค้าทั่วไป';

        if (!confirm(`ต้องการลบนัดหมาย ${apt.id}\n${custName} - ${App.formatDate(apt.date)} หรือไม่?`)) return;

        DB.delete('appointments', id);
        App.showToast('ลบนัดหมายเรียบร้อย', 'success');
        render();
    }

    /* ── status transitions ──────────────────────────────────── */
    function changeStatus(id, newStatus) {
        const apt = DB.getById('appointments', id);
        if (!apt) return;
        DB.update('appointments', id, { ...apt, status: newStatus });

        const label = STATUS_MAP[newStatus] ? STATUS_MAP[newStatus].label : newStatus;
        App.showToast(`อัปเดตสถานะเป็น "${label}"`, 'success');
        render();
    }

    /* ── main render ─────────────────────────────────────────── */
    function render() {
        renderCalendar();
        renderOverdueAlert();
        renderList();
        if (window.lucide) lucide.createIcons();
    }

    /* ── event setup ─────────────────────────────────────────── */
    function setupEvents() {
        const page = $('page-appointments');
        if (!page) return;

        // Save button inside modal (outside page container)
        const btnSave = $('btn-save-appointment');
        if (btnSave) {
            btnSave.addEventListener('click', saveAppointment);
        }

        // Quick add customer toggles
        const btnQuickAdd = $('btn-appointment-quick-add-customer');
        const btnCancelQuickAdd = $('btn-appointment-cancel-quick-add');
        const selectContainer = $('appointment-customer-select-container');
        const quickContainer = $('appointment-quick-customer-container');

        if (btnQuickAdd && btnCancelQuickAdd && selectContainer && quickContainer) {
            btnQuickAdd.addEventListener('click', () => {
                isQuickAddingCustomer = true;
                selectContainer.style.display = 'none';
                quickContainer.style.display = 'block';
                
                // Toggle required
                $('appointment-form-customer').required = false;
                $('appointment-quick-customer-name').required = true;
                $('appointment-quick-customer-phone').required = true;
                
                // Focus name field
                $('appointment-quick-customer-name').focus();
            });

            btnCancelQuickAdd.addEventListener('click', () => {
                isQuickAddingCustomer = false;
                selectContainer.style.display = 'block';
                quickContainer.style.display = 'none';
                
                // Toggle required
                $('appointment-form-customer').required = true;
                $('appointment-quick-customer-name').required = false;
                $('appointment-quick-customer-phone').required = false;
                
                // Reset inputs
                $('appointment-quick-customer-name').value = '';
                $('appointment-quick-customer-phone').value = '';
                $('appointment-quick-customer-address').value = '';
            });
        }

        page.addEventListener('click', (e) => {
            const target = e.target.closest('button') || e.target.closest('.calendar-day');

            if (!target) return;

            // Calendar navigation
            if (target.id === 'btn-cal-prev') {
                calendarMonth--;
                if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
                selectedDate = '';
                render();
                return;
            }
            if (target.id === 'btn-cal-next') {
                calendarMonth++;
                if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
                selectedDate = '';
                render();
                return;
            }
            if (target.id === 'btn-cal-today') {
                const now = new Date();
                calendarYear = now.getFullYear();
                calendarMonth = now.getMonth();
                selectedDate = todayStr();
                render();
                return;
            }

            // Calendar day click
            if (target.classList.contains('calendar-day') && !target.classList.contains('empty')) {
                const date = target.dataset.date;
                if (date) {
                    selectedDate = selectedDate === date ? '' : date;
                    render();
                }
                return;
            }

            // Add
            if (target.id === 'btn-add-appointment' || target.id === 'btn-cal-add-appointment' || target.id === 'btn-empty-add-appointment') {
                clearForm();
                App.openModal('appointment-modal');
                return;
            }

            // Status changes
            if (target.classList.contains('btn-apt-start')) {
                changeStatus(target.dataset.id, 'in-progress');
                return;
            }
            if (target.classList.contains('btn-apt-complete')) {
                changeStatus(target.dataset.id, 'completed');
                return;
            }
            if (target.classList.contains('btn-apt-no-home')) {
                if (confirm('ยืนยันสถานะ "ไม่มีคนอยู่บ้าน/ติดต่อไม่ได้" หรือไม่?')) {
                    changeStatus(target.dataset.id, 'no-one-home');
                }
                return;
            }
            if (target.classList.contains('btn-apt-cancel')) {
                if (confirm('ต้องการยกเลิกนัดหมายนี้หรือไม่?')) {
                    changeStatus(target.dataset.id, 'cancelled');
                }
                return;
            }

            // Share
            if (target.classList.contains('btn-share-appointment')) {
                shareAppointmentMessage(target.dataset.id);
                return;
            }

            // Edit
            if (target.classList.contains('btn-edit-appointment')) {
                const apt = DB.getById('appointments', target.dataset.id);
                if (apt) {
                    fillForm(apt);
                    App.openModal('appointment-modal');
                }
                return;
            }

            // Delete
            if (target.classList.contains('btn-delete-appointment')) {
                deleteAppointment(target.dataset.id);
                return;
            }

            // Show overdue
            if (target.id === 'btn-show-overdue') {
                selectedDate = '';
                listFilter = '';
                // Show all & scroll to overdue items
                const filterEl = $('appointments-filter-status');
                if (filterEl) filterEl.value = '';
                render();
                // Scroll to list
                const listContainer = $('appointments-list-container');
                if (listContainer) listContainer.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            // Clear selected date
            if (target.id === 'btn-clear-date-filter') {
                selectedDate = '';
                render();
                return;
            }
        });

        // Status filter
        const filterStatus = $('appointments-filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                listFilter = e.target.value;
                render();
            });
        }

        // LINE Share button handler
        const btnShareLine = $('btn-share-line-today');
        if (btnShareLine) {
            btnShareLine.addEventListener('click', shareTodayScheduleToLine);
        }
    }

    /* ── public API ──────────────────────────────────────────── */
    function init() {
        const now = new Date();
        calendarYear = now.getFullYear();
        calendarMonth = now.getMonth();
        selectedDate = '';
        listFilter = '';

        setupEvents();
        render();
    }

    function refresh() {
        render();
    }

    function shareTodayScheduleToLine() {
        const btn = $('btn-share-line-today');
        
        // If Cloud Mode is enabled, trigger backend instantly!
        if (DB.isCloudEnabled() && DB.getCloudUrl()) {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-right:4px;"></i> กำลังส่งเข้า LINE...';
            }
            App.showToast('กำลังสั่งให้ระบบหลังบ้านส่งคิวงานเข้า LINE...', 'info');
            
            DB.triggerCloudLineReport()
                .then(() => {
                    App.showToast('ส่งคิวงานเข้ากลุ่ม LINE ของทีมงานสำเร็จแล้ว! (ผ่านระบบคลาวด์)', 'success');
                })
                .catch(err => {
                    App.showToast('การส่งผ่านคลาวด์ขัดข้อง: ' + err + ' จะเปลี่ยนไปใช้การคัดลอกส่งมือแทน', 'warning');
                    runClientSideLineShare();
                })
                .finally(() => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i data-lucide="share-2"></i> ส่งคิวงานเข้า LINE';
                        if (window.lucide) lucide.createIcons();
                    }
                });
        } else {
            // Fallback for Demo Mode
            runClientSideLineShare();
        }

        function runClientSideLineShare() {
            const today = todayStr();
            const appointments = DB.getAll('appointments').filter(a => a.date === today);

            if (appointments.length === 0) {
                App.showToast('ไม่มีงานนัดหมายสำหรับวันนี้', 'info');
                return;
            }

            // Sort by time
            appointments.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            // Format message
            let msg = `❄️ สรุปคิวงานบริการแอร์ วันนี้ (${App.formatDate(today)}) ❄️\n\n`;

            appointments.forEach((a, index) => {
                const cust = DB.getById('customers', a.customerId);
                const custName = cust ? cust.name : 'ไม่ระบุ';
                const custPhone = cust ? cust.phone : 'ไม่ระบุ';
                const custAddress = cust ? cust.address : 'ไม่ระบุ';
                const mapsLink = cust ? cust.mapsLink : '';

                const statusLabel = STATUS_MAP[a.status] ? STATUS_MAP[a.status].label : a.status;

                msg += `คิวที่ ${index + 1}: ${a.time || '--:--'} น. | ${a.serviceType || 'งานบริการ'}\n`;
                msg += `• ลูกค้า: ${custName} (${custPhone})\n`;
                msg += `• ที่อยู่: ${custAddress}\n`;
                if (mapsLink) {
                    msg += `• แผนที่: ${mapsLink}\n`;
                }
                msg += `• สถานะ: ${statusLabel}\n`;
                if (a.notes) {
                    msg += `• หมายเหตุ: ${a.notes}\n`;
                }
                msg += `-----------------------\n`;
            });

            msg += `\n*แจ้งเตือน*: หากบ้านไหนไม่อยู่หรือติดต่อไม่ได้ ให้ช่างอัปเดตระบบเป็นสถานะ "ไม่มีคนอยู่/ติดต่อไม่ได้" ทันทีครับ`;

            // Copy formatted message to clipboard first for bulletproof fallback
            App.copyToClipboard(msg)
                .then(() => {
                    App.showToast('คัดลอกสรุปคิวงานวันนี้ลงคลิปบอร์ดแล้ว! และกำลังเปิดหน้าแชร์ไป LINE...', 'success');
                    setTimeout(() => {
                        const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(msg)}`;
                        window.open(lineUrl, '_blank');
                    }, 1000);
                })
                .catch(err => {
                    console.warn("[LINE Share] Clipboard failed:", err);
                    App.showToast('ไม่สามารถคัดลอกลงคลิปบอร์ดได้ แต่กำลังเปิดแชร์ไป LINE...', 'warning');
                    const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(msg)}`;
                    window.open(lineUrl, '_blank');
                });
        }
    }

    function shareAppointmentMessage(id) {
        const a = DB.getById('appointments', id);
        if (!a) return;

        const cust = DB.getById('customers', a.customerId);
        const custName = cust ? cust.name : 'ลูกค้า';

        const dateFormatted = App.formatDate(a.date);
        
        let msg = `❄️ แจ้งเตือนยืนยันนัดหมาย Spairdee ❄️\n\n`;
        msg += `เรียนคุณ: ${custName}\n`;
        msg += `ทางร้านแอร์ เอส พี แอร์ คอน ขอแจ้งยืนยันคิวนัดหมายบริการ "${a.serviceType || 'งานบริการแอร์'}"\n`;
        msg += `• วันที่: ${dateFormatted}\n`;
        msg += `• เวลา: ${a.time || '--:--'} น.\n`;
        if (a.notes) msg += `• หมายเหตุเพิ่มเติม: ${a.notes}\n`;
        msg += `\nหากต้องการเลื่อนคิวหรือแจ้งข้อมูลเพิ่มเติม สามารถติดต่อกลับได้ทันทีครับ ขอบคุณครับ! 🛠️`;

        App.copyToClipboard(msg)
            .then(() => {
                App.showToast('คัดลอกข้อความด่วนนัดหมายเรียบร้อยแล้ว! สามารถนำไปวางส่ง LINE ได้ทันที', 'success');
            })
            .catch(err => {
                App.showToast('ไม่สามารถคัดลอกข้อความได้: ' + err, 'error');
            });
    }

    return { init, refresh };
})();
