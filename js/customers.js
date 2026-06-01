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
                String(c.id || '').toLowerCase().includes(q) ||
                String(c.name || '').toLowerCase().includes(q) ||
                String(c.phone || '').toLowerCase().includes(q) ||
                String(c.lineId || '').toLowerCase().includes(q) ||
                String(c.address || '').toLowerCase().includes(q) ||
                String(c.notes || '').toLowerCase().includes(q)
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
                        ${(() => {
                            if (!c.address) return '';
                            const mapsUrl = c.mapsLink || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address);
                            return `
                                <p class="customer-address">
                                    <i data-lucide="map-pin"></i> 
                                    ${c.address}
                                    <a href="${mapsUrl}" target="_blank" class="maps-shortcut-btn" title="เปิดแผนที่นำทาง" style="margin-left: 6px; display: inline-flex; align-items: center; color: var(--accent-cyan);"><i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;"></i></a>
                                </p>
                            `;
                        })()}
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

        // กรองและรวมข้อมูลสำหรับไทม์ไลน์
        const timelineEvents = [];
        services.forEach(s => {
            timelineEvents.push({
                type: 'service',
                date: s.serviceDate || s.createdAt || '',
                time: '',
                original: s
            });
        });
        appointments.forEach(a => {
            timelineEvents.push({
                type: 'appointment',
                date: a.date || '',
                time: a.time || '',
                original: a
            });
        });

        // เรียงลำดับตามวันที่จากใหม่ไปเก่า (descending)
        timelineEvents.sort((a, b) => {
            const dateA = (a.date || '').slice(0, 10) + (a.time ? 'T' + a.time : 'T00:00');
            const dateB = (b.date || '').slice(0, 10) + (b.time ? 'T' + b.time : 'T00:00');
            return dateB.localeCompare(dateA);
        });

        // สร้าง HTML ไทม์ไลน์
        let timelineHtml = '';
        if (timelineEvents.length > 0) {
            timelineHtml = '<div class="customer-timeline">';
            timelineEvents.forEach(evt => {
                if (evt.type === 'service') {
                    const s = evt.original;
                    const payClass = s.paymentStatus === 'paid' ? 'badge-success'
                        : s.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger';
                    const payLabel = s.paymentStatus === 'paid' ? 'ชำระแล้ว'
                        : s.paymentStatus === 'partial' ? 'บางส่วน' : 'ค้างชำระ';
                    
                    timelineHtml += `
                        <div class="timeline-item service" id="timeline-service-${s.id}">
                            <div class="timeline-badge" title="งานบริการเสร็จสิ้น"><i data-lucide="wrench"></i></div>
                            <div class="timeline-content">
                                <div class="timeline-header">
                                    <span class="timeline-date-time">
                                        <i data-lucide="calendar" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> 
                                        ${App.formatDate(s.serviceDate)}
                                    </span>
                                    <span class="timeline-type-tag">ประวัติบริการ</span>
                                </div>
                                <h4 class="timeline-title">${s.type}</h4>
                                <div class="timeline-details">
                                    ${(s.acBrand || s.acModel || s.acBTU) ? `<p><strong>เครื่องแอร์:</strong> ${s.acBrand || '-'} ${s.acModel || ''} ${s.acBTU ? `(${s.acBTU} BTU)` : ''}</p>` : ''}
                                    ${s.symptoms ? `<p><strong>อาการเสีย:</strong> ${s.symptoms}</p>` : ''}
                                    ${s.solution ? `<p><strong>การแก้ไข:</strong> ${s.solution}</p>` : ''}
                                    ${s.partsUsed ? `<p><strong>อะไหล่ที่ใช้:</strong> ${s.partsUsed}</p>` : ''}
                                    ${s.notes ? `<p><strong>หมายเหตุ:</strong> ${s.notes}</p>` : ''}
                                    ${(() => {
                                        const serviceImgs = [];
                                        if (s.images) {
                                            serviceImgs.push(...s.images.split(',').filter(Boolean));
                                        }
                                        if (s.tempImages && Array.isArray(s.tempImages)) {
                                            serviceImgs.push(...s.tempImages.map(img => img.data));
                                        }
                                        if (serviceImgs.length === 0) return '';
                                        return `
                                            <div class="timeline-images-gallery" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                                                ${serviceImgs.map(imgUrl => `
                                                    <div class="timeline-image-wrapper" style="width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.2s;" onclick="window.open('${imgUrl}', '_blank')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                                        <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                                                    </div>
                                                `).join('')}
                                            </div>
                                        `;
                                    })()}
                                </div>
                                <div class="timeline-meta-row">
                                    <span class="timeline-meta-left"><i data-lucide="user" style="width:12px;height:12px;display:inline-block;margin-right:2px;"></i> ช่าง: ${s.technician || '-'}</span>
                                    <span class="timeline-meta-right">
                                        <strong style="color:var(--text-primary); margin-right:6px;">${App.formatCurrency(s.price)}</strong>
                                        <span class="badge ${payClass}" style="font-size: 11px;">${payLabel}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (evt.type === 'appointment') {
                    const a = evt.original;
                    const statusMap = {
                        'pending': { cls: 'badge-warning', label: 'รอดำเนินการ', icon: 'clock' },
                        'in-progress': { cls: 'badge-info', label: 'กำลังดำเนินการ', icon: 'loader' },
                        'completed': { cls: 'badge-success', label: 'เสร็จสิ้น', icon: 'check-circle' },
                        'cancelled': { cls: 'badge-danger', label: 'ยกเลิก', icon: 'x-circle' },
                        'no-one-home': { cls: 'badge-no-one-home', label: 'ไม่มีคนอยู่/ติดต่อไม่ได้', icon: 'user-x' }
                    };
                    const st = statusMap[a.status] || statusMap['pending'];
                    
                    timelineHtml += `
                        <div class="timeline-item appointment" id="timeline-appointment-${a.id}">
                            <div class="timeline-badge" title="นัดหมายงานบริการ"><i data-lucide="${st.icon}"></i></div>
                            <div class="timeline-content">
                                <div class="timeline-header">
                                    <span class="timeline-date-time">
                                        <i data-lucide="calendar" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> 
                                        ${App.formatDate(a.date)} ${a.time ? `| เวลา ${a.time} น.` : ''}
                                    </span>
                                    <span class="timeline-type-tag">นัดหมาย</span>
                                </div>
                                <h4 class="timeline-title">${a.serviceType || 'งานบริการ'}</h4>
                                ${a.notes ? `
                                <div class="timeline-details">
                                    <p><strong>หมายเหตุ:</strong> ${a.notes}</p>
                                </div>` : ''}
                                <div class="timeline-meta-row">
                                    <span class="timeline-meta-left"><i data-lucide="info" style="width:12px;height:12px;display:inline-block;margin-right:2px;"></i> รหัสงาน: ${a.id}</span>
                                    <span class="timeline-meta-right">
                                        <span class="badge ${st.cls}" style="font-size: 11px;">${st.label}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
            timelineHtml += '</div>';
        } else {
            timelineHtml = `
                <div class="empty-state" style="padding: 24px 0; background: transparent; border: 1px dashed var(--border-color); border-radius: var(--radius-md); text-align: center;">
                    <i data-lucide="history" class="empty-icon" style="width: 32px; height: 32px; color: var(--text-muted); opacity: 0.5;"></i>
                    <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">ยังไม่มีประวัติกิจกรรม นัดหมาย หรือบริการสำหรับลูกค้ารายนี้</p>
                </div>
            `;
        }

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
                                ${(() => {
                                    if (!customer.address) return '';
                                    const mapsUrl = customer.mapsLink || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(customer.address);
                                    return `<br><a href="${mapsUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; font-size:13px; color:var(--accent-cyan); font-weight:600;"><i data-lucide="external-link" style="width:13px;height:13px;"></i> เปิดแผนที่ Google Maps</a>`;
                                })()}
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

                    <!-- Unified Timeline Section -->
                    <h3 class="detail-section-title" style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 28px 0 16px 0; display: flex; align-items: center; gap: 8px;"><i data-lucide="history" style="width: 16px; height: 16px; color: var(--accent-cyan);"></i> ไทม์ไลน์ประวัติกิจกรรมแอร์และบริการ</h3>
                    
                    ${timelineHtml}
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
            if (e.target.closest('a')) {
                return;
            }

            let target = e.target.closest('button') || e.target.closest('.customer-card');

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

            // View detail (card click or view button)
            if (target.classList.contains('btn-view-customer') || target.classList.contains('customer-card')) {
                const id = target.dataset.id || target.dataset.customerId;
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
