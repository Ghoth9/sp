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

    // Image Upload State
    let selectedImages = []; // เก็บรูปภาพใหม่ที่ช่างเลือก { name: string, data: base64 }
    let existingImages = []; // เก็บคอมมาแยกลิงก์รูปภาพที่มีอยู่เดิมในฐานข้อมูล (สำหรับกรณีแก้ไข)

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
                const custName = cust ? (cust.name || '').toLowerCase() : '';
                const custPhone = cust ? (cust.phone || '') : '';
                const custAddress = cust ? (cust.address || '').toLowerCase() : '';
                const custLine = cust ? (cust.lineId || '').toLowerCase() : '';
                const partsStr = Array.isArray(s.partsUsed) ? s.partsUsed.join(' ').toLowerCase() : '';

                return (s.id || '').toLowerCase().includes(q) ||
                    (s.type || '').toLowerCase().includes(q) ||
                    custName.includes(q) ||
                    custPhone.includes(q) ||
                    custAddress.includes(q) ||
                    custLine.includes(q) ||
                    (s.acBrand || '').toLowerCase().includes(q) ||
                    (s.acModel || '').toLowerCase().includes(q) ||
                    String(s.acBTU || '').includes(q) ||
                    (s.symptoms || '').toLowerCase().includes(q) ||
                    (s.solution || '').toLowerCase().includes(q) ||
                    partsStr.includes(q) ||
                    (s.technician || '').toLowerCase().includes(q) ||
                    (s.notes || '').toLowerCase().includes(q);
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
                                <button class="btn-icon btn-print-service" data-id="${s.id}" title="พิมพ์ใบแจ้งหนี้/ใบเสร็จ">
                                    <i data-lucide="printer"></i>
                                </button>
                                <button class="btn-icon btn-share-service" data-id="${s.id}" title="คัดลอกข้อความแจ้งลูกค้า">
                                    <i data-lucide="share-2"></i>
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
                                <button class="btn-icon btn-print-service" data-id="${s.id}" title="พิมพ์ใบแจ้งหนี้/ใบเสร็จ">
                                    <i data-lucide="printer"></i>
                                </button>
                                <button class="btn-icon btn-share-service" data-id="${s.id}" title="คัดลอกข้อความแจ้งลูกค้า">
                                    <i data-lucide="share-2"></i>
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

    /* ── บีบอัดรูปภาพฝั่ง Client ด้วย Canvas ────────────────────────── */
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 900; // ขนาดสูงสุดของรูปภาพ (ลดจาก 1200 เป็น 900 เพื่อประหยัดพื้นที่จัดเก็บได้กว่า 60%)

                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // บีบอัดเป็น JPEG คุณภาพ 0.7 (ให้รูปภาพมีขนาดเล็กลงมาก แต่ยังเห็นรายละเอียดครบถ้วน)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve({ name: file.name, data: dataUrl });
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    /* ── แสดงภาพตัวอย่างพรีวิวในหน้าฟอร์ม ───────────────────────────── */
    function renderImagePreviews() {
        const container = $('service-form-images-preview');
        const statusText = $('service-form-images-status');
        if (!container) return;

        container.innerHTML = '';
        const totalImages = existingImages.length + selectedImages.length;
        
        if (statusText) {
            statusText.textContent = totalImages > 0 ? `แนบรูปภาพแล้ว ${totalImages} รูป` : 'ยังไม่มีรูปภาพแนบ';
        }

        // 1. แสดงรูปภาพเดิมที่มีอยู่แล้ว
        existingImages.forEach((url, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '80px';
            wrapper.style.height = '80px';
            wrapper.style.borderRadius = '6px';
            wrapper.style.overflow = 'hidden';
            wrapper.style.border = '1px solid var(--border-color)';
            wrapper.style.boxShadow = 'var(--shadow-sm)';

            wrapper.innerHTML = `
                <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                <button type="button" class="btn-delete-preview-existing" data-index="${index}" style="position:absolute; top:2px; right:2px; width:18px; height:18px; border-radius:50%; background:rgba(220,38,38,0.9); color:white; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; line-height:1;">
                  ✕
                </button>
            `;
            container.appendChild(wrapper);
        });

        // 2. แสดงรูปภาพใหม่ที่ช่างเลือกเพิ่ม
        selectedImages.forEach((img, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '80px';
            wrapper.style.height = '80px';
            wrapper.style.borderRadius = '6px';
            wrapper.style.overflow = 'hidden';
            wrapper.style.border = '1px solid var(--accent-cyan)';
            wrapper.style.boxShadow = 'var(--shadow-sm)';

            wrapper.innerHTML = `
                <img src="${img.data}" style="width:100%; height:100%; object-fit:cover;">
                <button type="button" class="btn-delete-preview-selected" data-index="${index}" style="position:absolute; top:2px; right:2px; width:18px; height:18px; border-radius:50%; background:rgba(220,38,38,0.9); color:white; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; line-height:1;">
                  ✕
                </button>
            `;
            container.appendChild(wrapper);
        });

        // ผูกปุ่มลบรูปภาพ
        const delExisting = container.querySelectorAll('.btn-delete-preview-existing');
        delExisting.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                existingImages.splice(idx, 1);
                renderImagePreviews();
            });
        });

        const delSelected = container.querySelectorAll('.btn-delete-preview-selected');
        delSelected.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                selectedImages.splice(idx, 1);
                renderImagePreviews();
            });
        });
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
        
        selectedImages = [];
        existingImages = [];
        renderImagePreviews();
        
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
        
        selectedImages = [];
        existingImages = (service.images || '').split(',').filter(Boolean);
        renderImagePreviews();
        
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
            notes: $('service-form-notes').value.trim(),
            images: existingImages.join(','),
            tempImages: selectedImages
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
                ${(() => {
                    const allImgs = [];
                    if (s.images) {
                        allImgs.push(...s.images.split(',').filter(Boolean));
                    }
                    if (s.tempImages && Array.isArray(s.tempImages)) {
                        allImgs.push(...s.tempImages.map(img => img.data));
                    }
                    if (allImgs.length === 0) return '';
                    return `
                        <div class="detail-field full-width">
                            <label style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                                <i data-lucide="image" style="width:16px;height:16px;color:var(--text-muted);"></i>
                                รูปภาพผลงานบริการ (${allImgs.length})
                            </label>
                            <div class="service-detail-images-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:12px; margin-top:8px;">
                                ${allImgs.map(imgUrl => `
                                    <div class="service-detail-image-wrapper" style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer; box-shadow:var(--shadow-sm); transition:transform 0.2s, border-color 0.2s;" onclick="window.open('${imgUrl}', '_blank')">
                                        <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                })()}
            </div>
        `;

        $('service-detail-title').textContent = `รายละเอียดบริการ ${s.id}`;
        
        const btnDetailPrint = $('btn-detail-print-service');
        const btnDetailShare = $('btn-detail-share-service');
        if (btnDetailPrint) btnDetailPrint.dataset.id = s.id;
        if (btnDetailShare) btnDetailShare.dataset.id = s.id;
        
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

        // Photo upload listener
        const imgInput = $('service-form-images');
        if (imgInput) {
            imgInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                const statusText = $('service-form-images-status');
                if (statusText) statusText.textContent = 'กำลังย่อขนาดรูปภาพ...';

                for (const file of files) {
                    try {
                        const compressed = await compressImage(file);
                        selectedImages.push(compressed);
                    } catch (err) {
                        console.error('Error compressing image:', err);
                        App.showToast(`ไม่สามารถย่อรูปภาพ ${file.name} ได้`, 'error');
                    }
                }
                
                imgInput.value = '';
                renderImagePreviews();
            });
        }

        // Global body click delegator for services-specific buttons
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('.btn-print-service, .btn-share-service');
            if (!target) return;
            
            const serviceId = target.dataset.id;
            if (!serviceId) return;
            
            if (target.classList.contains('btn-print-service')) {
                printServiceInvoice(serviceId);
            } else if (target.classList.contains('btn-share-service')) {
                shareServiceMessage(serviceId);
            }
        });

        // Trigger native print inside print preview modal
        const btnDoPrint = $('btn-do-print');
        if (btnDoPrint) {
            btnDoPrint.addEventListener('click', () => {
                window.print();
            });
        }
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

    function printServiceInvoice(id) {
        const s = DB.getById('services', id);
        if (!s) return;

        const cust = DB.getById('customers', s.customerId);
        const custName = cust ? cust.name : 'ไม่ทราบ';
        const custPhone = cust ? cust.phone : '-';
        const custAddress = cust ? cust.address : '-';
        const custLine = cust ? cust.lineId : '-';

        const price = Number(s.price) || 0;
        const paid = Number(s.paidAmount) || 0;
        const balance = price - paid;

        const dateFormatted = App.formatDate(s.serviceDate);
        const payStatusText = s.paymentStatus === 'paid' ? 'ชำระเงินแล้ว' 
                            : s.paymentStatus === 'partial' ? 'ชำระบางส่วน' : 'ค้างชำระ';

        const printBody = $('invoice-print-body');
        if (!printBody) return;

        // Render Invoice Receipt
        printBody.innerHTML = `
            <div style="max-width: 100%; border: 1px solid #e2e8f0; padding: 30px; border-radius: 8px; background: #fff; box-shadow: var(--shadow-sm);">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--accent-cyan); padding-bottom: 20px; margin-bottom: 20px;">
                    <div>
                        <h2 style="margin: 0 0 6px 0; color: var(--accent-cyan); font-size: 24px; font-weight: 700; font-family: var(--font-thai);">เอส พี แอร์ คอน แอนด์ เซอร์วิส</h2>
                        <p style="margin: 0 0 4px 0; font-size: 13px; color: var(--text-secondary);">ให้บริการซ่อม ติดตั้ง ล้าง และย้ายแอร์ทุกชนิด</p>
                        <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">โทร. 089-xxx-xxxx | LINE ID: @spaircon</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</h3>
                        <p style="margin: 0 0 4px 0; font-size: 13px; color: var(--text-secondary);">เลขที่ใบงาน: <strong>${s.id}</strong></p>
                        <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">วันที่: ${dateFormatted}</p>
                    </div>
                </div>

                <!-- Info Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px;">
                    <div>
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">ข้อมูลลูกค้า</h4>
                        <p style="margin: 0 0 4px 0;"><strong>ชื่อลูกค้า:</strong> ${custName}</p>
                        <p style="margin: 0 0 4px 0;"><strong>เบอร์โทรศัพท์:</strong> ${custPhone}</p>
                        <p style="margin: 0 0 4px 0;"><strong>LINE ID:</strong> ${custLine}</p>
                        <p style="margin: 0; line-height: 1.4;"><strong>ที่อยู่:</strong> ${custAddress}</p>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">รายละเอียดงาน</h4>
                        <p style="margin: 0 0 4px 0;"><strong>ประเภทบริการ:</strong> ${s.type}</p>
                        <p style="margin: 0 0 4px 0;"><strong>เครื่องแอร์:</strong> ${s.acBrand || '-'} ${s.acModel || ''} ${s.acBTU ? `(${s.acBTU} BTU)` : ''}</p>
                        <p style="margin: 0;"><strong>ช่างผู้ให้บริการ:</strong> ${s.technician || '-'}</p>
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                            <th style="padding: 10px; text-align: left; font-weight: 600;">รายละเอียดบริการ</th>
                            <th style="padding: 10px; text-align: right; font-weight: 600; width: 120px;">จำนวนเงิน</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 10px;">
                                <strong>บริการ${s.type}</strong><br>
                                <span style="font-size: 12px; color: var(--text-secondary);">
                                    ${s.symptoms ? `อาการเสีย: ${s.symptoms} | ` : ''}
                                    ${s.solution ? `การแก้ไข: ${s.solution}` : ''}
                                </span>
                            </td>
                            <td style="padding: 12px 10px; text-align: right;">${App.formatCurrency(price)}</td>
                        </tr>
                        ${s.partsUsed && s.partsUsed.length > 0 ? `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 10px;">
                                <strong>อะไหล่และอุปกรณ์เสริมที่ใช้</strong><br>
                                <span style="font-size: 12px; color: var(--text-secondary);">${s.partsUsed.join(', ')}</span>
                            </td>
                            <td style="padding: 12px 10px; text-align: right;">รวมในค่าบริการ</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>

                <!-- Summary Row -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 40px; font-size: 14px;">
                    <div style="width: 250px; text-align: right; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-secondary);">ค่าบริการรวม:</span>
                            <strong>${App.formatCurrency(price)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-secondary);">ชำระแล้ว:</span>
                            <strong style="color: var(--success);">${App.formatCurrency(paid)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                            <span style="font-weight: 600;">ยอดค้างชำระ:</span>
                            <strong style="color: var(--danger); font-size: 16px;">${App.formatCurrency(balance)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">สถานะการชำระ:</span>
                            <span style="font-size: 12px; font-weight: 600; color: ${s.paymentStatus === 'paid' ? 'var(--success)' : 'var(--danger)'};">${payStatusText}</span>
                        </div>
                    </div>
                </div>

                <!-- Signatures -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; font-size: 13px;">
                    <div>
                        <div style="border-bottom: 1px solid #cbd5e1; width: 200px; margin: 0 auto 10px; height: 40px;"></div>
                        <p style="margin: 0; font-weight: 500;">ลงชื่อผู้รับบริการ (ลูกค้า)</p>
                    </div>
                    <div>
                        <div style="border-bottom: 1px solid #cbd5e1; width: 200px; margin: 0 auto 10px; height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                            <span style="font-family: var(--font-eng); font-style: italic; color: var(--text-muted); font-size: 14px;">${s.technician || 'SP Air Con'}</span>
                        </div>
                        <p style="margin: 0; font-weight: 500;">ลงชื่อผู้ให้บริการ (ช่าง)</p>
                    </div>
                </div>
            </div>
        `;

        App.openModal('invoice-print-modal');
    }

    function shareServiceMessage(id) {
        const s = DB.getById('services', id);
        if (!s) return;

        const cust = DB.getById('customers', s.customerId);
        const custName = cust ? cust.name : 'ลูกค้า';

        const price = Number(s.price) || 0;
        const paid = Number(s.paidAmount) || 0;
        const balance = price - paid;

        const dateFormatted = App.formatDate(s.serviceDate);
        const payStatusText = s.paymentStatus === 'paid' ? 'ชำระเงินเรียบร้อยแล้ว' 
                            : s.paymentStatus === 'partial' ? `ชำระบางส่วนแล้ว คงเหลือค้างชำระ ${App.formatCurrency(balance)}` : `ค้างชำระ ${App.formatCurrency(balance)}`;

        let msg = `❄️ รายละเอียดสรุปงานบริการ Spairdee ❄️\n\n`;
        msg += `เรียนคุณ: ${custName}\n`;
        msg += `• บริการ: ${s.type}\n`;
        if (s.acBrand || s.acModel) {
            msg += `• เครื่องแอร์: ${s.acBrand || '-'} ${s.acModel || ''} ${s.acBTU ? `(${s.acBTU} BTU)` : ''}\n`;
        }
        msg += `• วันที่ให้บริการ: ${dateFormatted}\n`;
        if (s.symptoms) msg += `• อาการ/ปัญหา: ${s.symptoms}\n`;
        if (s.solution) msg += `• การแก้ไข: ${s.solution}\n`;
        if (s.partsUsed && s.partsUsed.length > 0) msg += `• อะไหล่ที่ใช้: ${s.partsUsed.join(', ')}\n`;
        msg += `• ช่างผู้ดูแล: ${s.technician || '-'}\n`;
        msg += `• ยอดบริการรวม: ${App.formatCurrency(price)}\n`;
        msg += `• สถานะการเงิน: ${payStatusText}\n\n`;
        msg += `ขอบคุณที่ไว้วางใจใช้บริการ เอส พี แอร์ คอน ครับ! 🛠️`;

        App.copyToClipboard(msg)
            .then(() => {
                App.showToast('คัดลอกข้อความสรุปงานบริการเรียบร้อยแล้ว! สามารถนำไปวางส่ง LINE ได้ทันที', 'success');
            })
            .catch(err => {
                App.showToast('ไม่สามารถคัดลอกข้อความได้: ' + err, 'error');
            });
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
