/* ============================================================
   Services Module – AC Service Pro
   Full CRUD, filtering, payment tracking, totals
   ============================================================ */

const ServicesModule = (() => {
    const $ = (id) => document.getElementById(id);

    // Filter state
    let filters = {
        type: '',
        paymentStatus: '',
        dateFrom: '',
        dateTo: '',
        searchQuery: ''
    };

    const SERVICE_TYPES = ['ล้างแอร์', 'ซ่อมแอร์', 'ติดตั้ง', 'ย้ายแอร์', 'ถอดแอร์', 'เติมน้ำยา'];
    const PAYMENT_STATUSES = [
        { value: 'paid', label: 'ชำระแล้ว', cls: 'badge-success' },
        { value: 'partial', label: 'บางส่วน', cls: 'badge-warning' },
        { value: 'unpaid', label: 'ค้างชำระ', cls: 'badge-danger' }
    ];

    /* ── generate next ID ───────────────────────────────────── */
    function nextId() {
        const all = DB.getAll('services');
        if (all.length === 0) return 'SRV-001';
        const nums = all.map(s => parseInt(s.id.replace('SRV-', ''), 10) || 0);
        return 'SRV-' + String(Math.max(...nums) + 1).padStart(3, '0');
    }

    /* ── filtered & sorted list ─────────────────────────────── */
    function getFiltered() {
        let list = DB.getAll('services');

        if (filters.type) {
            list = list.filter(s => s.type === filters.type);
        }
        if (filters.paymentStatus) {
            list = list.filter(s => s.paymentStatus === filters.paymentStatus);
        }
        if (filters.dateFrom) {
            list = list.filter(s => (s.serviceDate || '') >= filters.dateFrom);
        }
        if (filters.dateTo) {
            list = list.filter(s => (s.serviceDate || '') <= filters.dateTo);
        }
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase();
            list = list.filter(s => {
                const cust = DB.getById('customers', s.customerId);
                const custName = cust ? cust.name.toLowerCase() : '';
                return custName.includes(q) ||
                    (s.acBrand || '').toLowerCase().includes(q) ||
                    (s.acModel || '').toLowerCase().includes(q) ||
                    (s.symptoms || '').toLowerCase().includes(q) ||
                    (s.solution || '').toLowerCase().includes(q) ||
                    (s.technician || '').toLowerCase().includes(q);
            });
        }

        return list.sort((a, b) => {
            return new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt);
        });
    }

    /* ── render totals summary ──────────────────────────────── */
    function renderSummary(services) {
        const container = $('services-summary');
        if (!container) return;

        const totalRevenue = services.reduce((s, sv) => s + (Number(sv.price) || 0), 0);
        const totalPaid = services.reduce((s, sv) => s + (Number(sv.paidAmount) || 0), 0);
        const totalUnpaid = totalRevenue - totalPaid;

        container.innerHTML = `
            <div class="summary-cards" id="services-summary-cards">
                <div class="summary-card">
                    <span class="summary-value">${services.length}</span>
                    <span class="summary-label">รายการ</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">${App.formatCurrency(totalRevenue)}</span>
                    <span class="summary-label">ยอดรวม</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value text-success">${App.formatCurrency(totalPaid)}</span>
                    <span class="summary-label">ชำระแล้ว</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value text-danger">${App.formatCurrency(totalUnpaid)}</span>
                    <span class="summary-label">ค้างชำระ</span>
                </div>
            </div>
        `;
    }

    /* ── render table ───────────────────────────────────────── */
    function renderTable(services) {
        const container = $('services-table-container');
        if (!container) return;

        if (services.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="services-empty">
                    <i data-lucide="wrench" class="empty-icon"></i>
                    <p>ไม่พบรายการบริการ</p>
                    <p class="empty-sub">ลองปรับตัวกรองหรือเพิ่มรายการใหม่</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Check if mobile screen (width < 768px)
        if (window.innerWidth < 768) {
            let html = '<div class="mobile-cards-container" style="display: flex; flex-direction: column; gap: var(--space-md);">';
            
            services.forEach(s => {
                const cust = DB.getById('customers', s.customerId);
                const custName = cust ? cust.name : 'ไม่ทราบ';
                const ps = PAYMENT_STATUSES.find(p => p.value === s.paymentStatus) || PAYMENT_STATUSES[2];
                const acInfo = [s.acBrand, s.acModel, s.acBTU ? s.acBTU + ' BTU' : ''].filter(Boolean).join(' ');

                html += `
                    <div class="card" id="service-row-${s.id}" style="padding: var(--space-md); margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-sm); margin-bottom: var(--space-sm);">
                            <span class="text-xs text-muted" style="font-weight: 500;">${App.formatDate(s.serviceDate)}</span>
                            <span class="badge ${ps.cls}">${ps.label}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-xs);">
                            <strong class="text-base" style="color: var(--text-primary);">${custName}</strong>
                            <span class="service-type-badge">${s.type}</span>
                        </div>

                        ${acInfo ? `<div class="text-sm text-secondary" style="margin-bottom: var(--space-xs);">${acInfo}</div>` : ''}
                        ${s.symptoms ? `<div class="text-xs text-muted" style="background: var(--bg-primary); padding: var(--space-xs) var(--space-sm); border-radius: var(--radius-sm); margin-bottom: var(--space-md);">${s.symptoms}</div>` : ''}
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: var(--space-sm);">
                            <div>
                                <span class="text-xs text-muted" style="display: block; line-height: 1;">ยอดรวม</span>
                                <strong class="text-base" style="color: var(--accent-cyan);">${App.formatCurrency(s.price)}</strong>
                            </div>
                            <div class="table-actions" style="margin-top: 0; padding: 0; border: none;">
                                <button class="btn-icon btn-view-service" data-id="${s.id}" title="ดูรายละเอียด">
                                    <i data-lucide="eye"></i>
                                </button>
                                <button class="btn-icon btn-edit-service" data-id="${s.id}" title="แก้ไข">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon btn-delete-service" data-id="${s.id}" title="ลบ">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        } else {
            // Desktop table render
            let html = `
                <div class="table-responsive">
                    <table class="data-table" id="services-data-table">
                        <thead>
                            <tr>
                                <th>วันที่</th>
                                <th>ลูกค้า</th>
                                <th>ประเภท</th>
                                <th class="hide-mobile">แอร์</th>
                                <th class="hide-mobile">อาการ/งาน</th>
                                <th class="hide-mobile">ช่าง</th>
                                <th>ราคา</th>
                                <th class="hide-mobile">ชำระ</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            services.forEach(s => {
                const cust = DB.getById('customers', s.customerId);
                const custName = cust ? cust.name : 'ไม่ทราบ';
                const ps = PAYMENT_STATUSES.find(p => p.value === s.paymentStatus) || PAYMENT_STATUSES[2];
                const acInfo = [s.acBrand, s.acModel, s.acBTU ? s.acBTU + ' BTU' : ''].filter(Boolean).join(' ');

                html += `
                    <tr id="service-row-${s.id}">
                        <td class="nowrap">${App.formatDate(s.serviceDate)}</td>
                        <td>${custName}</td>
                        <td><span class="service-type-badge">${s.type}</span></td>
                        <td class="text-muted small hide-mobile">${acInfo || '-'}</td>
                        <td class="truncate-cell hide-mobile" title="${(s.symptoms || '') + ' → ' + (s.solution || '')}">${s.symptoms || '-'}</td>
                        <td class="hide-mobile">${s.technician || '-'}</td>
                        <td class="nowrap">${App.formatCurrency(s.price)}</td>
                        <td class="nowrap hide-mobile">${App.formatCurrency(s.paidAmount)}</td>
                        <td><span class="badge ${ps.cls}">${ps.label}</span></td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon btn-view-service" data-id="${s.id}" title="ดูรายละเอียด">
                                    <i data-lucide="eye"></i>
                                </button>
                                <button class="btn-icon btn-edit-service" data-id="${s.id}" title="แก้ไข">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon btn-delete-service hide-mobile" data-id="${s.id}" title="ลบ">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        if (window.lucide) lucide.createIcons();
    }

    /* ── customer dropdown ──────────────────────────────────── */
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

    /* ── form helpers ───────────────────────────────────────── */
    function clearForm() {
        const form = $('service-form');
        if (form) form.reset();
        $('service-form-id').value = '';
        $('service-modal-title').textContent = 'เพิ่มรายการบริการ';
        populateCustomerDropdown('service-form-customer', '');
        // Set default date to today
        $('service-form-date').value = new Date().toISOString().slice(0, 10);
        updatePaidAmountField();
    }

    function fillForm(service) {
        $('service-form-id').value = service.id;
        populateCustomerDropdown('service-form-customer', service.customerId);
        $('service-form-type').value = service.type || '';
        $('service-form-brand').value = service.acBrand || '';
        $('service-form-model').value = service.acModel || '';
        $('service-form-btu').value = service.acBTU || '';
        $('service-form-symptoms').value = service.symptoms || '';
        $('service-form-solution').value = service.solution || '';
        $('service-form-parts').value = (service.partsUsed || []).join(', ');
        $('service-form-price').value = service.price || '';
        $('service-form-payment-status').value = service.paymentStatus || 'unpaid';
        $('service-form-paid').value = service.paidAmount || '';
        $('service-form-technician').value = service.technician || '';
        $('service-form-date').value = service.serviceDate || '';
        $('service-form-notes').value = service.notes || '';
        $('service-modal-title').textContent = 'แก้ไขรายการบริการ';
        updatePaidAmountField();
    }

    function updatePaidAmountField() {
        const status = $('service-form-payment-status');
        const paidField = $('service-form-paid');
        const priceField = $('service-form-price');
        if (!status || !paidField) return;

        if (status.value === 'paid') {
            paidField.value = priceField ? priceField.value : '';
            paidField.readOnly = true;
        } else if (status.value === 'unpaid') {
            paidField.value = '0';
            paidField.readOnly = true;
        } else {
            paidField.readOnly = false;
        }
    }

    function saveService() {
        const id = $('service-form-id').value;
        const customerId = $('service-form-customer').value;
        const type = $('service-form-type').value;
        const serviceDate = $('service-form-date').value;

        if (!customerId) {
            App.showToast('กรุณาเลือกลูกค้า', 'error');
            return;
        }
        if (!type) {
            App.showToast('กรุณาเลือกประเภทบริการ', 'error');
            return;
        }
        if (!serviceDate) {
            App.showToast('กรุณาระบุวันที่', 'error');
            return;
        }

        const partsStr = $('service-form-parts').value.trim();
        const partsUsed = partsStr ? partsStr.split(',').map(p => p.trim()).filter(Boolean) : [];

        const price = Number($('service-form-price').value) || 0;
        const paymentStatus = $('service-form-payment-status').value || 'unpaid';
        let paidAmount = Number($('service-form-paid').value) || 0;

        if (paymentStatus === 'paid') paidAmount = price;
        if (paymentStatus === 'unpaid') paidAmount = 0;

        const data = {
            customerId,
            type,
            acBrand: $('service-form-brand').value.trim(),
            acModel: $('service-form-model').value.trim(),
            acBTU: Number($('service-form-btu').value) || 0,
            symptoms: $('service-form-symptoms').value.trim(),
            solution: $('service-form-solution').value.trim(),
            partsUsed,
            price,
            paymentStatus,
            paidAmount,
            technician: $('service-form-technician').value.trim(),
            serviceDate,
            notes: $('service-form-notes').value.trim()
        };

        if (id) {
            DB.update('services', id, { ...data, id, createdAt: DB.getById('services', id).createdAt });
            App.showToast('อัปเดตรายการบริการเรียบร้อย', 'success');
        } else {
            DB.add('services', {
                ...data,
                id: nextId(),
                createdAt: new Date().toISOString()
            });
            App.showToast('เพิ่มรายการบริการเรียบร้อย', 'success');
        }

        App.closeModal('service-modal');
        render();
    }

    function deleteService(id) {
        const svc = DB.getById('services', id);
        if (!svc) return;

        if (!confirm(`ต้องการลบรายการบริการ ${svc.id} (${svc.type}) หรือไม่?`)) return;

        DB.delete('services', id);
        App.showToast('ลบรายการบริการเรียบร้อย', 'success');
        render();
    }

    /* ── service detail view ─────────────────────────────────── */
    function showServiceDetail(id) {
        const s = DB.getById('services', id);
        if (!s) return;

        const cust = DB.getById('customers', s.customerId);
        const custName = cust ? cust.name : 'ไม่ทราบ';
        const ps = PAYMENT_STATUSES.find(p => p.value === s.paymentStatus) || PAYMENT_STATUSES[2];
        const acInfo = [s.acBrand, s.acModel, s.acBTU ? s.acBTU + ' BTU' : ''].filter(Boolean).join(' · ');

        const container = $('service-detail-content');
        if (!container) return;

        container.innerHTML = `
            <div class="detail-grid-2col">
                <div class="detail-field">
                    <label>รหัส</label>
                    <span>${s.id}</span>
                </div>
                <div class="detail-field">
                    <label>วันที่</label>
                    <span>${App.formatDate(s.serviceDate)}</span>
                </div>
                <div class="detail-field">
                    <label>ลูกค้า</label>
                    <span>${custName}</span>
                </div>
                <div class="detail-field">
                    <label>ประเภท</label>
                    <span class="service-type-badge">${s.type}</span>
                </div>
                <div class="detail-field">
                    <label>แอร์</label>
                    <span>${acInfo || '-'}</span>
                </div>
                <div class="detail-field">
                    <label>ช่างผู้รับผิดชอบ</label>
                    <span>${s.technician || '-'}</span>
                </div>
                <div class="detail-field full-width">
                    <label>อาการ/ปัญหา</label>
                    <span>${s.symptoms || '-'}</span>
                </div>
                <div class="detail-field full-width">
                    <label>การแก้ไข</label>
                    <span>${s.solution || '-'}</span>
                </div>
                <div class="detail-field full-width">
                    <label>อะไหล่ที่ใช้</label>
                    <span>${(s.partsUsed || []).join(', ') || '-'}</span>
                </div>
                <div class="detail-field">
                    <label>ราคา</label>
                    <span class="text-lg">${App.formatCurrency(s.price)}</span>
                </div>
                <div class="detail-field">
                    <label>ชำระแล้ว</label>
                    <span class="text-lg">${App.formatCurrency(s.paidAmount)}</span>
                </div>
                <div class="detail-field">
                    <label>สถานะชำระเงิน</label>
                    <span class="badge ${ps.cls}">${ps.label}</span>
                </div>
                ${s.notes ? `
                    <div class="detail-field full-width">
                        <label>หมายเหตุ</label>
                        <span>${s.notes}</span>
                    </div>
                ` : ''}
            </div>
        `;

        $('service-detail-title').textContent = `รายละเอียดบริการ ${s.id}`;
        App.openModal('service-detail-modal');
    }

    /* ── main render ────────────────────────────────────────── */
    function render() {
        const services = getFiltered();
        renderSummary(services);
        renderTable(services);

        const countEl = $('services-count');
        if (countEl) countEl.textContent = `(${services.length})`;
    }

    /* ── event setup ─────────────────────────────────────────── */
    function setupEvents() {
        const page = $('page-services');
        if (!page) return;

        // Save button inside modal (outside page container)
        const btnSave = $('btn-save-service');
        if (btnSave) {
            btnSave.addEventListener('click', saveService);
        }

        page.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'btn-add-service') {
                clearForm();
                App.openModal('service-modal');
                return;
            }
            if (target.classList.contains('btn-edit-service')) {
                const svc = DB.getById('services', target.dataset.id);
                if (svc) {
                    fillForm(svc);
                    App.openModal('service-modal');
                }
                return;
            }
            if (target.classList.contains('btn-delete-service')) {
                deleteService(target.dataset.id);
                return;
            }
            if (target.classList.contains('btn-view-service')) {
                showServiceDetail(target.dataset.id);
                return;
            }
            if (target.id === 'btn-clear-service-filters') {
                clearFilters();
                return;
            }
        });

        // Filter change events
        const filterType = $('services-filter-type');
        const filterPay = $('services-filter-payment');
        const filterFrom = $('services-filter-from');
        const filterTo = $('services-filter-to');
        const searchInput = $('services-search-input');

        if (filterType) filterType.addEventListener('change', (e) => { filters.type = e.target.value; render(); });
        if (filterPay) filterPay.addEventListener('change', (e) => { filters.paymentStatus = e.target.value; render(); });
        if (filterFrom) filterFrom.addEventListener('change', (e) => { filters.dateFrom = e.target.value; render(); });
        if (filterTo) filterTo.addEventListener('change', (e) => { filters.dateTo = e.target.value; render(); });
        if (searchInput) searchInput.addEventListener('input', (e) => { filters.searchQuery = e.target.value; render(); });

        // Payment status change in form
        const payStatus = $('service-form-payment-status');
        if (payStatus) payStatus.addEventListener('change', updatePaidAmountField);

        const priceField = $('service-form-price');
        if (priceField) priceField.addEventListener('input', () => {
            if ($('service-form-payment-status').value === 'paid') {
                $('service-form-paid').value = priceField.value;
            }
        });
    }

    function clearFilters() {
        filters = { type: '', paymentStatus: '', dateFrom: '', dateTo: '', searchQuery: '' };
        const filterType = $('services-filter-type');
        const filterPay = $('services-filter-payment');
        const filterFrom = $('services-filter-from');
        const filterTo = $('services-filter-to');
        const searchInput = $('services-search-input');

        if (filterType) filterType.value = '';
        if (filterPay) filterPay.value = '';
        if (filterFrom) filterFrom.value = '';
        if (filterTo) filterTo.value = '';
        if (searchInput) searchInput.value = '';

        render();
    }

    /* ── public API ─────────────────────────────────────────── */
    function init() {
        setupEvents();
        render();
    }

    function refresh() {
        render();
    }

    return { init, refresh };
})();
