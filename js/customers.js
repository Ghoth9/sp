/* ============================================================
   Customers Module – AC Service Pro
   Full CRUD, search, card/table view toggle, detail view
   ============================================================ */

const CustomersModule = (() => {
    const $ = (id) => document.getElementById(id);

    let currentView = 'card'; // 'card' | 'table'
    let searchQuery = '';
    let selectedCustomerId = null;

    /* ── generate next ID ───────────────────────────────────── */
    function nextId() {
        const all = DB.getAll('customers');
        if (all.length === 0) return 'CUS-001';
        const nums = all.map(c => parseInt(c.id.replace('CUS-', ''), 10) || 0);
        const next = Math.max(...nums) + 1;
        return 'CUS-' + String(next).padStart(3, '0');
    }

    /* ── get filtered list ──────────────────────────────────── */
    function getFiltered() {
        let list = DB.getAll('customers');
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(q) ||
                (c.lineId || '').toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    /* ── customer total spent ───────────────────────────────── */
    function totalSpent(customerId) {
        const services = DB.getAll('services').filter(s => s.customerId === customerId);
        return services.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
    }

    function serviceCount(customerId) {
        return DB.getAll('services').filter(s => s.customerId === customerId).length;
    }

    /* ── render card view ───────────────────────────────────── */
    function renderCards(customers) {
        if (customers.length === 0) {
            return `
                <div class="empty-state" id="customers-empty">
                    <i data-lucide="user-x" class="empty-icon"></i>
                    <p>ไม่พบลูกค้า</p>
                    ${searchQuery ? '<p class="empty-sub">ลองค้นหาด้วยคำอื่น</p>' : '<p class="empty-sub">เพิ่มลูกค้าใหม่เพื่อเริ่มต้น</p>'}
                </div>
            `;
        }

        let html = '<div class="customers-card-grid" id="customers-card-grid">';
        customers.forEach(c => {
            const spent = totalSpent(c.id);
            const svcCount = serviceCount(c.id);
            html += `
                <div class="customer-card glass-card" data-customer-id="${c.id}" id="customer-card-${c.id}">
                    <div class="customer-card-header">
                        <div class="customer-avatar">${(c.name || '?').charAt(0)}</div>
                        <div class="customer-card-actions">
                            <button class="btn-icon btn-edit-customer" data-id="${c.id}" title="แก้ไข">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="btn-icon btn-delete-customer" data-id="${c.id}" title="ลบ">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="customer-card-body" data-id="${c.id}">
                        <h3 class="customer-name">${c.name || '-'}</h3>
                        <div class="customer-meta">
                            <span><i data-lucide="phone"></i> ${c.phone || '-'}</span>
                            ${c.lineId ? `<span><i data-lucide="message-circle"></i> ${c.lineId}</span>` : ''}
                        </div>
                        ${c.address ? `<p class="customer-address"><i data-lucide="map-pin"></i> ${c.address}</p>` : ''}
                        <div class="customer-stats-row">
                            <span class="customer-stat"><strong>${svcCount}</strong> บริการ</span>
                            <span class="customer-stat"><strong>${App.formatCurrency(spent)}</strong></span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    /* ── render table view ──────────────────────────────────── */
    function renderTable(customers) {
        if (customers.length === 0) {
            return `
                <div class="empty-state" id="customers-empty">
                    <i data-lucide="user-x" class="empty-icon"></i>
                    <p>ไม่พบลูกค้า</p>
                </div>
            `;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table" id="customers-data-table">
                    <thead>
                        <tr>
                            <th class="hide-mobile">รหัส</th>
                            <th>ชื่อ</th>
                            <th>โทรศัพท์</th>
                            <th class="hide-mobile">LINE ID</th>
                            <th class="hide-mobile">บริการ</th>
                            <th>ยอดใช้จ่าย</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        customers.forEach(c => {
            const spent = totalSpent(c.id);
            const svcCount = serviceCount(c.id);
            html += `
                <tr id="customer-row-${c.id}">
                    <td class="text-muted hide-mobile">${c.id}</td>
                    <td>
                        <button class="link-btn btn-view-customer" data-id="${c.id}">${c.name || '-'}</button>
                    </td>
                    <td>${c.phone || '-'}</td>
                    <td class="hide-mobile">${c.lineId || '-'}</td>
                    <td class="hide-mobile">${svcCount}</td>
                    <td>${App.formatCurrency(spent)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-view-customer" data-id="${c.id}" title="ดูรายละเอียด">
                                <i data-lucide="eye"></i>
                            </button>
                            <button class="btn-icon btn-edit-customer" data-id="${c.id}" title="แก้ไข">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="btn-icon btn-delete-customer hide-mobile" data-id="${c.id}" title="ลบ">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        return html;
    }

    /* ── main render ────────────────────────────────────────── */
    function render() {
        const container = $('customers-list-container');
        if (!container) return;

        const customers = getFiltered();
        const countEl = $('customers-count');
        if (countEl) countEl.textContent = `(${customers.length})`;

        container.innerHTML = currentView === 'card'
            ? renderCards(customers)
            : renderTable(customers);

        // Update toggle button states
        const btnCard = $('customers-view-card');
        const btnTable = $('customers-view-table');
        if (btnCard) btnCard.classList.toggle('active', currentView === 'card');
        if (btnTable) btnTable.classList.toggle('active', currentView === 'table');

        if (window.lucide) lucide.createIcons();
    }

    /* ── form helpers ───────────────────────────────────────── */
    function clearForm() {
        const form = $('customer-form');
        if (form) form.reset();
        $('customer-form-id').value = '';
        $('customer-modal-title').textContent = 'เพิ่มลูกค้าใหม่';
    }

    function fillForm(customer) {
        $('customer-form-id').value = customer.id;
        $('customer-form-name').value = customer.name || '';
        $('customer-form-phone').value = customer.phone || '';
        $('customer-form-address').value = customer.address || '';
        $('customer-form-maps').value = customer.mapsLink || '';
        $('customer-form-line').value = customer.lineId || '';
        $('customer-form-notes').value = customer.notes || '';
        $('customer-modal-title').textContent = 'แก้ไขข้อมูลลูกค้า';
    }

    function saveCustomer() {
        const id = $('customer-form-id').value;
        const name = $('customer-form-name').value.trim();
        const phone = $('customer-form-phone').value.trim();
        const address = $('customer-form-address').value.trim();
        const mapsLink = $('customer-form-maps').value.trim();
        const lineId = $('customer-form-line').value.trim();
        const notes = $('customer-form-notes').value.trim();

        if (!name) {
            App.showToast('กรุณากรอกชื่อลูกค้า', 'error');
            $('customer-form-name').focus();
            return;
        }

        if (id) {
            // Update
            const existing = DB.getById('customers', id);
            DB.update('customers', id, {
                ...existing,
                name,
                phone,
                address,
                mapsLink,
                lineId,
                notes
            });
            App.showToast('อัปเดตข้อมูลลูกค้าเรียบร้อย', 'success');
        } else {
            // Add
            DB.add('customers', {
                id: nextId(),
                name,
                phone,
                address,
                mapsLink,
                lineId,
                notes,
                createdAt: new Date().toISOString()
            });
            App.showToast('เพิ่มลูกค้าใหม่เรียบร้อย', 'success');
        }

        App.closeModal('customer-modal');
        refresh();
    }

    /* ── delete ──────────────────────────────────────────────── */
    function deleteCustomer(id) {
        const customer = DB.getById('customers', id);
        if (!customer) return;

        const svcCount = serviceCount(id);
        const msg = svcCount > 0
            ? `ลูกค้า "${customer.name}" มีประวัติบริการ ${svcCount} รายการ\nต้องการลบหรือไม่?`
            : `ต้องการลบลูกค้า "${customer.name}" หรือไม่?`;

        if (!confirm(msg)) return;

        DB.delete('customers', id);
        App.showToast('ลบลูกค้าเรียบร้อย', 'success');

        // Close detail if open
        if (selectedCustomerId === id) {
            closeDetail();
        }
        render();
    }

    /* ── customer detail view ────────────────────────────────── */
    function showDetail(id) {
        const customer = DB.getById('customers', id);
        if (!customer) return;

        selectedCustomerId = id;
        const container = $('customer-detail-modal');
        if (!container) return;

        const services = DB.getAll('services')
            .filter(s => s.customerId === id)
            .sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt));

        const appointments = DB.getAll('appointments')
            .filter(a => a.customerId === id)
            .sort((a, b) => b.date.localeCompare(a.date));

        const spent = services.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
        const totalBilled = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

        let html = `
            <div class="modal modal-wide">
                <div class="modal-header">
                    <div>
                        <h3>รายละเอียดลูกค้า</h3>
                        <p class="modal-subtitle">ข้อมูลติดต่อและประวัติการบริการทั้งหมด</p>
                    </div>
                    <button class="modal-close" data-modal-close="customer-detail-modal" id="btn-close-customer-detail"><i data-lucide="x" width="18" height="18"></i></button>
                </div>
                <div class="modal-body">
                    <!-- Top Profile Row -->
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);">
                        <div class="customer-avatar" style="width: 56px; height: 56px; font-size: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--accent-gradient); color: white; font-weight: bold; flex-shrink: 0;">
                            ${(customer.name || '?').charAt(0)}
                        </div>
                        <div>
                            <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0;">${customer.name}</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin: 4px 0 0 0;">รหัสลูกค้า: ${customer.id}</p>
                        </div>
                    </div>

                    <!-- Details Grid -->
                    <div class="detail-grid" style="margin-bottom: 24px;">
                        <div class="detail-item">
                            <span class="detail-label" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="phone" style="width: 14px; height: 14px; color: var(--text-muted);"></i> โทรศัพท์</span>
                            <span class="detail-value" style="font-weight: 600; color: #0f172a;">${customer.phone || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="message-circle" style="width: 14px; height: 14px; color: var(--text-muted);"></i> LINE ID</span>
                            <span class="detail-value" style="font-weight: 600; color: #0f172a;">${customer.lineId || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="calendar" style="width: 14px; height: 14px; color: var(--text-muted);"></i> ลูกค้าตั้งแต่</span>
                            <span class="detail-value">${App.formatDate(customer.createdAt)}</span>
                        </div>
                        <div class="detail-item" style="grid-column: span 2;">
                            <span class="detail-label" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--text-muted);"></i> ที่อยู่</span>
                            <span class="detail-value" style="line-height: 1.5;">
                                ${customer.address || '-'}
                                ${customer.mapsLink ? `<br><a href="${customer.mapsLink}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; font-size:13px; color:var(--accent-cyan); font-weight:600;"><i data-lucide="external-link" style="width:13px;height:13px;"></i> เปิดแผนที่ Google Maps</a>` : ''}
                            </span>
                        </div>
                        ${customer.notes ? `
                        <div class="detail-item" style="grid-column: span 2;">
                            <span class="detail-label" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="info" style="width: 14px; height: 14px; color: var(--text-muted);"></i> หมายเหตุ</span>
                            <span class="detail-value" style="font-style: italic; color: var(--text-secondary); line-height: 1.5;">${customer.notes}</span>
                        </div>` : ''}
                    </div>

                    <!-- Stats Grid -->
                    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: var(--space-md); margin-bottom: 24px;">
                        <div class="stat-card" style="padding: 14px; gap: 12px; align-items: center; background: #f8fafc; border-radius: 8px;">
                            <div class="stat-icon cyan" style="width: 38px; height: 38px; font-size: 1rem; border-radius: 6px; flex-shrink: 0;"><i data-lucide="wrench"></i></div>
                            <div class="stat-info">
                                <span class="stat-label" style="font-size: 11px; color: var(--text-muted);">ประวัติบริการ</span>
                                <span class="stat-value" style="font-size: 18px; font-weight: 700; color: #0f172a;">${services.length} ครั้ง</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 14px; gap: 12px; align-items: center; background: #f8fafc; border-radius: 8px;">
                            <div class="stat-icon teal" style="width: 38px; height: 38px; font-size: 1rem; border-radius: 6px; flex-shrink: 0;"><i data-lucide="wallet"></i></div>
                            <div class="stat-info">
                                <span class="stat-label" style="font-size: 11px; color: var(--text-muted);">ยอดรวมทั้งหมด</span>
                                <span class="stat-value" style="font-size: 18px; font-weight: 700; color: #0f172a;">${App.formatCurrency(totalBilled)}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 14px; gap: 12px; align-items: center; background: #f8fafc; border-radius: 8px;">
                            <div class="stat-icon success" style="width: 38px; height: 38px; font-size: 1rem; border-radius: 6px; flex-shrink: 0;"><i data-lucide="check-circle-2"></i></div>
                            <div class="stat-info">
                                <span class="stat-label" style="font-size: 11px; color: var(--text-muted);">ชำระเงินแล้ว</span>
                                <span class="stat-value" style="font-size: 18px; font-weight: 700; color: #0f172a;">${App.formatCurrency(spent)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Service History Section -->
                    <h3 class="detail-section-title" style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; display: flex; align-items: center; gap: 8px;"><i data-lucide="history" style="width: 16px; height: 16px; color: var(--accent-cyan);"></i> ประวัติบริการ (${services.length})</h3>
                    ${services.length > 0 ? `
                        <div class="table-responsive" style="margin-bottom: 24px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                            <table class="data-table" id="customer-detail-services-table" style="margin: 0; width: 100%;">
                                <thead>
                                    <tr>
                                        <th>วันที่</th>
                                        <th>ประเภท</th>
                                        <th>ราคา</th>
                                        <th>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${services.map(s => {
                                        const payClass = s.paymentStatus === 'paid' ? 'badge-success'
                                            : s.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger';
                                        const payLabel = s.paymentStatus === 'paid' ? 'ชำระแล้ว'
                                            : s.paymentStatus === 'partial' ? 'บางส่วน' : 'ค้างชำระ';
                                        return `
                                            <tr>
                                                <td style="font-size: 13px;">${App.formatDate(s.serviceDate)}</td>
                                                <td><span class="service-type-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(2, 132, 199, 0.1); color: #0284c7; font-weight: 500;">${s.type}</span></td>
                                                <td style="font-weight: 600; font-size: 13px;">${App.formatCurrency(s.price)}</td>
                                                <td><span class="badge ${payClass}" style="font-size: 11px;">${payLabel}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="empty-state-text" style="color: var(--text-muted); font-style: italic; margin-bottom: 24px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border-color); text-align: center; font-size: 13px;">ยังไม่มีประวัติบริการ</p>'}

                    <!-- Appointments History Section -->
                    ${appointments.length > 0 ? `
                        <h3 class="detail-section-title" style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; display: flex; align-items: center; gap: 8px;"><i data-lucide="calendar" style="width: 16px; height: 16px; color: var(--accent-cyan);"></i> รายการนัดหมาย (${appointments.length})</h3>
                        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                            <table class="data-table" id="customer-detail-appointments-table" style="margin: 0; width: 100%;">
                                <thead>
                                    <tr>
                                        <th>วันที่</th>
                                        <th>เวลา</th>
                                        <th>ประเภท</th>
                                        <th>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${appointments.map(a => {
                                        const statusMap = {
                                            'pending': { cls: 'badge-warning', label: 'รอดำเนินการ' },
                                            'in-progress': { cls: 'badge-info', label: 'กำลังดำเนินการ' },
                                            'completed': { cls: 'badge-success', label: 'เสร็จสิ้น' },
                                            'cancelled': { cls: 'badge-danger', label: 'ยกเลิก' },
                                            'no-one-home': { cls: 'badge-no-one-home', label: 'ไม่มีคนอยู่/ติดต่อไม่ได้' }
                                        };
                                        const st = statusMap[a.status] || statusMap['pending'];
                                        return `
                                            <tr>
                                                <td style="font-size: 13px;">${App.formatDate(a.date)}</td>
                                                <td style="font-size: 13px;">${a.time || '-'} น.</td>
                                                <td><span style="font-size: 13px;">${a.serviceType || '-'}</span></td>
                                                <td><span class="badge ${st.cls}" style="font-size: 11px;">${st.label}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger btn-delete-customer" data-id="${customer.id}" id="btn-detail-delete-customer" style="margin-right: auto;">
                        <i data-lucide="trash-2"></i> ลบลูกค้า
                    </button>
                    <button class="btn btn-primary btn-edit-customer" data-id="${customer.id}" id="btn-detail-edit-customer">
                        <i data-lucide="pencil"></i> แก้ไขข้อมูล
                    </button>
                    <button class="btn btn-secondary" data-modal-close="customer-detail-modal">ปิด</button>
                </div>
            </div>
        `;

        container.innerHTML = html;
        if (typeof App !== 'undefined') {
            App.openModal('customer-detail-modal');
        } else {
            container.classList.add('active');
        }
        if (window.lucide) lucide.createIcons();
    }

    function closeDetail() {
        selectedCustomerId = null;
        if (typeof App !== 'undefined') {
            App.closeModal('customer-detail-modal');
        } else {
            const container = $('customer-detail-modal');
            if (container) {
                container.classList.remove('active');
                setTimeout(() => { container.innerHTML = ''; }, 300);
            }
        }
    }

    /* ── event delegation ────────────────────────────────────── */
    function setupEvents() {
        const page = $('page-customers');
        if (!page) return;

        // Save button inside modal (outside page container)
        const btnSave = $('btn-save-customer');
        if (btnSave) {
            btnSave.addEventListener('click', saveCustomer);
        }

        // Delegated clicks
        page.addEventListener('click', (e) => {
            const target = e.target.closest('button') || e.target.closest('.customer-card-body');

            if (!target) return;

            // View toggle
            if (target.id === 'customers-view-card') {
                currentView = 'card';
                render();
                return;
            }
            if (target.id === 'customers-view-table') {
                currentView = 'table';
                render();
                return;
            }

            // Add
            if (target.id === 'btn-add-customer') {
                clearForm();
                App.openModal('customer-modal');
                return;
            }

            // Edit
            if (target.classList.contains('btn-edit-customer')) {
                const id = target.dataset.id;
                const c = DB.getById('customers', id);
                if (c) {
                    closeDetail();
                    fillForm(c);
                    App.openModal('customer-modal');
                }
                return;
            }

            // Delete
            if (target.classList.contains('btn-delete-customer')) {
                deleteCustomer(target.dataset.id);
                return;
            }

            // View detail (card body click or eye button)
            if (target.classList.contains('btn-view-customer') || target.classList.contains('customer-card-body')) {
                const id = target.dataset.id;
                if (id) showDetail(id);
                return;
            }

            // Close detail
            if (target.id === 'btn-close-customer-detail' || target.getAttribute('data-modal-close') === 'customer-detail-modal') {
                closeDetail();
                return;
            }
        });

        // Search input
        const searchInput = $('customers-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                render();
            });
        }

        // Close on backdrop click
        const detailModal = $('customer-detail-modal');
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) {
                    closeDetail();
                }
            });

            // Observer to reset selectedCustomerId when modal class is changed (closed by Escape key, etc)
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        const isActive = detailModal.classList.contains('active');
                        if (!isActive) {
                            selectedCustomerId = null;
                        }
                    }
                });
            });
            observer.observe(detailModal, { attributes: true });
        }
    }

    /* ── public API ─────────────────────────────────────────── */
    function init() {
        setupEvents();
        render();
    }

    function refresh() {
        render();
        if (selectedCustomerId) {
            showDetail(selectedCustomerId);
        }
    }

    return { init, refresh };
})();
