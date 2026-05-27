/* ============================================================
   Inventory Module – AC Service Pro
   Full CRUD, stock alerts, quantity adjust, category filter
   ============================================================ */

const InventoryModule = (() => {
    const $ = (id) => document.getElementById(id);

    const CATEGORIES = ['อะไหล่', 'น้ำยา', 'อุปกรณ์'];
    const UNITS = ['ชิ้น', 'ถัง', 'กก.', 'ม้วน', 'เมตร', 'กล่อง', 'ขวด', 'ชุด'];

    let filterCategory = '';
    let filterStock = ''; // 'low', 'ok', ''
    let searchQuery = '';

    /* ── generate next ID ───────────────────────────────────── */
    function nextId() {
        const all = DB.getAll('inventory');
        if (all.length === 0) return 'INV-001';
        const nums = all.map(i => parseInt(i.id.replace('INV-', ''), 10) || 0);
        return 'INV-' + String(Math.max(...nums) + 1).padStart(3, '0');
    }

    /* ── filtered list ───────────────────────────────────────── */
    function getFiltered() {
        let list = DB.getAll('inventory');

        if (filterCategory) {
            list = list.filter(i => i.category === filterCategory);
        }
        if (filterStock === 'low') {
            list = list.filter(i => i.quantity <= i.minQuantity);
        } else if (filterStock === 'ok') {
            list = list.filter(i => i.quantity > i.minQuantity);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(i =>
                (i.name || '').toLowerCase().includes(q) ||
                (i.id || '').toLowerCase().includes(q) ||
                (i.notes || '').toLowerCase().includes(q)
            );
        }

        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    /* ── low stock alert ─────────────────────────────────────── */
    function renderLowStockAlert() {
        const container = $('inventory-low-stock-alert');
        if (!container) return;

        const all = DB.getAll('inventory');
        const lowStock = all.filter(i => i.quantity <= i.minQuantity);

        if (lowStock.length === 0) {
            container.innerHTML = '';
            return;
        }

        const outOfStock = lowStock.filter(i => i.quantity === 0);

        let html = `
            <div class="alert-banner alert-warning" id="inventory-low-alert-banner">
                <i data-lucide="package-x"></i>
                <div class="alert-content">
                    <span>อะไหล่ใกล้หมดหรือหมดสต็อก <strong>${lowStock.length}</strong> รายการ</span>
                    ${outOfStock.length > 0 ? `<span class="text-danger">หมดสต็อก: ${outOfStock.map(i => i.name).join(', ')}</span>` : ''}
                </div>
                <button class="btn btn-sm btn-outline" id="btn-filter-low-stock">แสดงเฉพาะ</button>
            </div>
        `;
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    /* ── summary cards ───────────────────────────────────────── */
    function renderSummary() {
        const container = $('inventory-summary');
        if (!container) return;

        const all = DB.getAll('inventory');
        const totalItems = all.length;
        const totalQuantity = all.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        const totalValue = all.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
        const lowCount = all.filter(i => i.quantity <= i.minQuantity).length;

        container.innerHTML = `
            <div class="summary-cards" id="inventory-summary-cards">
                <div class="summary-card">
                    <span class="summary-value">${totalItems}</span>
                    <span class="summary-label">ประเภทสินค้า</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">${totalQuantity.toLocaleString()}</span>
                    <span class="summary-label">จำนวนรวม</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">${App.formatCurrency(totalValue)}</span>
                    <span class="summary-label">มูลค่ารวม</span>
                </div>
                <div class="summary-card ${lowCount > 0 ? 'summary-card-danger' : ''}">
                    <span class="summary-value ${lowCount > 0 ? 'text-danger' : ''}">${lowCount}</span>
                    <span class="summary-label">ใกล้หมด/หมด</span>
                </div>
            </div>
        `;
    }

    /* ── render table ────────────────────────────────────────── */
    function renderTable(items) {
        const container = $('inventory-table-container');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="inventory-empty">
                    <i data-lucide="package-open" class="empty-icon"></i>
                    <p>ไม่พบรายการสินค้า</p>
                    <p class="empty-sub">ลองปรับตัวกรองหรือเพิ่มรายการใหม่</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Check if mobile screen (width < 768px)
        if (window.innerWidth < 768) {
            let html = '<div class="mobile-cards-container" style="display: flex; flex-direction: column; gap: var(--space-md);">';
            
            items.forEach(item => {
                const isLow = item.quantity <= item.minQuantity;
                const isOut = item.quantity === 0;
                const stockCls = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok';
                const stockLabel = isOut ? 'หมด' : isLow ? 'ใกล้หมด' : 'ปกติ';
                const stockBadge = isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success';
                const value = (Number(item.price) || 0) * (Number(item.quantity) || 0);

                html += `
                    <div class="card ${stockCls}" id="inventory-row-${item.id}" style="padding: var(--space-md); margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-sm); margin-bottom: var(--space-sm);">
                            <span class="text-xs text-muted" style="font-weight: 500;">${item.id}</span>
                            <span class="badge ${stockBadge}">${stockLabel}</span>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-xs);">
                            <strong class="text-base" style="color: var(--text-primary);">${item.name || '-'}</strong>
                            <span class="category-badge">${item.category || '-'}</span>
                        </div>

                        ${item.notes ? `<div class="text-xs text-muted" style="margin-bottom: var(--space-md);">${item.notes}</div>` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary); padding: var(--space-sm); border-radius: var(--radius-md); margin-bottom: var(--space-md);">
                            <div>
                                <span class="text-xs text-muted" style="display: block; margin-bottom: 2px;">จำนวนคงเหลือ</span>
                                <div class="quantity-controls" style="margin-top: 0;">
                                    <button class="btn-qty btn-qty-minus" data-id="${item.id}" title="ลด" style="width: 28px; height: 28px;">
                                        <i data-lucide="minus" style="width: 14px; height: 14px;"></i>
                                    </button>
                                    <span class="quantity-value ${isLow ? 'text-danger' : ''}" style="font-size: var(--text-sm); font-weight: 600; min-width: 40px; text-align: center;">
                                        ${item.quantity} ${item.unit || 'ชิ้น'}
                                    </span>
                                    <button class="btn-qty btn-qty-plus" data-id="${item.id}" title="เพิ่ม" style="width: 28px; height: 28px;">
                                        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                                    </button>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <span class="text-xs text-muted" style="display: block; margin-bottom: 4px;">ราคา/หน่วย</span>
                                <strong class="text-base" style="color: var(--text-primary);">${App.formatCurrency(item.price)}</strong>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: var(--space-sm);">
                            <div>
                                <span class="text-xs text-muted">มูลค่าคลัง:</span>
                                <strong class="text-sm" style="color: var(--accent-cyan); margin-left: 4px;">${App.formatCurrency(value)}</strong>
                            </div>
                            <div class="table-actions" style="margin-top: 0; padding: 0; border: none;">
                                <button class="btn-icon btn-edit-inventory" data-id="${item.id}" title="แก้ไข">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon btn-delete-inventory" data-id="${item.id}" title="ลบ">
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
                    <table class="data-table" id="inventory-data-table">
                        <thead>
                            <tr>
                                <th class="hide-mobile">รหัส</th>
                                <th>ชื่อสินค้า</th>
                                <th class="hide-mobile">หมวดหมู่</th>
                                <th>จำนวน</th>
                                <th class="hide-mobile">ขั้นต่ำ</th>
                                <th class="hide-mobile">หน่วย</th>
                                <th class="hide-mobile">ราคา/หน่วย</th>
                                <th class="hide-mobile">มูลค่า</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            items.forEach(item => {
                const isLow = item.quantity <= item.minQuantity;
                const isOut = item.quantity === 0;
                const stockCls = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok';
                const stockLabel = isOut ? 'หมด' : isLow ? 'ใกล้หมด' : 'ปกติ';
                const stockBadge = isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success';
                const value = (Number(item.price) || 0) * (Number(item.quantity) || 0);

                html += `
                    <tr class="${stockCls}" id="inventory-row-${item.id}">
                        <td class="text-muted hide-mobile">${item.id}</td>
                        <td>
                            <strong>${item.name || '-'}</strong>
                            ${item.notes ? `<div class="cell-sub text-muted">${item.notes}</div>` : ''}
                        </td>
                        <td class="hide-mobile"><span class="category-badge">${item.category || '-'}</span></td>
                        <td>
                            <div class="quantity-controls">
                                <button class="btn-qty btn-qty-minus" data-id="${item.id}" title="ลด">
                                    <i data-lucide="minus"></i>
                                </button>
                                <span class="quantity-value ${isLow ? 'text-danger' : ''}">${item.quantity}</span>
                                <button class="btn-qty btn-qty-plus" data-id="${item.id}" title="เพิ่ม">
                                    <i data-lucide="plus"></i>
                                </button>
                            </div>
                        </td>
                        <td class="text-muted hide-mobile">${item.minQuantity}</td>
                        <td class="hide-mobile">${item.unit || 'ชิ้น'}</td>
                        <td class="hide-mobile">${App.formatCurrency(item.price)}</td>
                        <td class="hide-mobile">${App.formatCurrency(value)}</td>
                        <td><span class="badge ${stockBadge}">${stockLabel}</span></td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon btn-edit-inventory" data-id="${item.id}" title="แก้ไข">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon btn-delete-inventory hide-mobile" data-id="${item.id}" title="ลบ">
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

    /* ── form helpers ────────────────────────────────────────── */
    function clearForm() {
        const form = $('inventory-form');
        if (form) form.reset();
        $('inventory-form-id').value = '';
        $('inventory-modal-title').textContent = 'เพิ่มสินค้า/อะไหล่';
        // Set defaults
        $('inventory-form-quantity').value = '0';
        $('inventory-form-min').value = '5';
    }

    function fillForm(item) {
        $('inventory-form-id').value = item.id;
        $('inventory-form-name').value = item.name || '';
        $('inventory-form-category').value = item.category || '';
        $('inventory-form-quantity').value = item.quantity ?? 0;
        $('inventory-form-min').value = item.minQuantity ?? 5;
        $('inventory-form-unit').value = item.unit || 'ชิ้น';
        $('inventory-form-price').value = item.price || '';
        $('inventory-form-notes').value = item.notes || '';
        $('inventory-modal-title').textContent = 'แก้ไขสินค้า/อะไหล่';
    }

    function saveInventory() {
        const id = $('inventory-form-id').value;
        const name = $('inventory-form-name').value.trim();
        const category = $('inventory-form-category').value;
        const quantity = Number($('inventory-form-quantity').value) || 0;
        const minQuantity = Number($('inventory-form-min').value) || 0;
        const unit = $('inventory-form-unit').value || 'ชิ้น';
        const price = Number($('inventory-form-price').value) || 0;
        const notes = $('inventory-form-notes').value.trim();

        if (!name) {
            App.showToast('กรุณากรอกชื่อสินค้า', 'error');
            $('inventory-form-name').focus();
            return;
        }
        if (!category) {
            App.showToast('กรุณาเลือกหมวดหมู่', 'error');
            return;
        }

        const data = { name, category, quantity, minQuantity, unit, price, notes };

        if (id) {
            DB.update('inventory', id, { ...data, id });
            App.showToast('อัปเดตสินค้าเรียบร้อย', 'success');
        } else {
            DB.add('inventory', { ...data, id: nextId() });
            App.showToast('เพิ่มสินค้าเรียบร้อย', 'success');
        }

        App.closeModal('inventory-modal');
        render();
    }

    function deleteInventory(id) {
        const item = DB.getById('inventory', id);
        if (!item) return;

        if (!confirm(`ต้องการลบ "${item.name}" หรือไม่?`)) return;

        DB.delete('inventory', id);
        App.showToast('ลบสินค้าเรียบร้อย', 'success');
        render();
    }

    /* ── quantity adjust ─────────────────────────────────────── */
    function adjustQuantity(id, delta) {
        const item = DB.getById('inventory', id);
        if (!item) return;

        const newQty = Math.max(0, (Number(item.quantity) || 0) + delta);
        DB.update('inventory', id, { ...item, quantity: newQty });

        if (newQty <= item.minQuantity && delta < 0) {
            App.showToast(`⚠️ ${item.name} เหลือ ${newQty} ${item.unit || 'ชิ้น'} (ต่ำกว่าขั้นต่ำ)`, 'warning');
        }

        render();
    }

    /* ── main render ─────────────────────────────────────────── */
    function render() {
        const items = getFiltered();
        renderLowStockAlert();
        renderSummary();
        renderTable(items);

        const countEl = $('inventory-count');
        if (countEl) countEl.textContent = `(${items.length})`;
    }

    /* ── event setup ─────────────────────────────────────────── */
    function setupEvents() {
        const page = $('page-inventory');
        if (!page) return;

        // Save button inside modal (outside page container)
        const btnSave = $('btn-save-inventory');
        if (btnSave) {
            btnSave.addEventListener('click', saveInventory);
        }

        page.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // Add
            if (target.id === 'btn-add-inventory') {
                clearForm();
                App.openModal('inventory-modal');
                return;
            }

            // Edit
            if (target.classList.contains('btn-edit-inventory')) {
                const item = DB.getById('inventory', target.dataset.id);
                if (item) {
                    fillForm(item);
                    App.openModal('inventory-modal');
                }
                return;
            }

            // Delete
            if (target.classList.contains('btn-delete-inventory')) {
                deleteInventory(target.dataset.id);
                return;
            }

            // Quantity adjust
            if (target.classList.contains('btn-qty-plus')) {
                adjustQuantity(target.dataset.id, 1);
                return;
            }
            if (target.classList.contains('btn-qty-minus')) {
                adjustQuantity(target.dataset.id, -1);
                return;
            }

            // Filter low stock from alert
            if (target.id === 'btn-filter-low-stock') {
                filterStock = 'low';
                const filterEl = $('inventory-filter-stock');
                if (filterEl) filterEl.value = 'low';
                render();
                return;
            }

            // Clear filters
            if (target.id === 'btn-clear-inventory-filters') {
                clearFilters();
                return;
            }
        });

        // Filter events
        const filterCat = $('inventory-filter-category');
        const filterStk = $('inventory-filter-stock');
        const searchInput = $('inventory-search-input');

        if (filterCat) {
            filterCat.addEventListener('change', (e) => {
                filterCategory = e.target.value;
                render();
            });
        }
        if (filterStk) {
            filterStk.addEventListener('change', (e) => {
                filterStock = e.target.value;
                render();
            });
        }
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                render();
            });
        }
    }

    function clearFilters() {
        filterCategory = '';
        filterStock = '';
        searchQuery = '';
        const filterCat = $('inventory-filter-category');
        const filterStk = $('inventory-filter-stock');
        const searchInput = $('inventory-search-input');
        if (filterCat) filterCat.value = '';
        if (filterStk) filterStk.value = '';
        if (searchInput) searchInput.value = '';
        render();
    }

    /* ── public API ──────────────────────────────────────────── */
    function init() {
        setupEvents();
        render();
    }

    function refresh() {
        render();
    }

    return { init, refresh };
})();
