/* ============================================================
   AC Service Pro — Main Application Logic (app.js)
   SPA Navigation · Modal Helpers · Custom Toast Notifications
   Format Helpers · Backup (Export/Import) Integration
   ============================================================ */

const App = (() => {
    'use strict';

    // ── Elements ──────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    // ── App State ─────────────────────────────────────────────
    let currentPage = 'dashboard';
    let deferredPrompt = null;

    // ── Navigation ────────────────────────────────────────────
    function navigateTo(pageId) {
        // Hide all page sections
        const sections = document.querySelectorAll('.page-section');
        sections.forEach(sec => sec.classList.remove('active'));

        // Show target page section
        const targetSection = $(`page-${pageId}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update active class on sidebar items
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        navItems.forEach(item => {
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update active class on bottom nav items
        const bottomNavItems = document.querySelectorAll('.bottom-nav .bottom-nav-item');
        bottomNavItems.forEach(item => {
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update header page title
        const pageTitles = {
            'dashboard': 'หน้าหลักและสรุปผล',
            'customers': 'รายชื่อลูกค้า',
            'services': 'ประวัติงานบริการ',
            'appointments': 'ตารางนัดหมายบริการ',
            'settings': 'ตั้งค่าระบบ'
        };
        const titleEl = $('page-title');
        if (titleEl) {
            titleEl.textContent = pageTitles[pageId] || 'Spairdee';
        }

        currentPage = pageId;

        // Refresh corresponding module if initialized
        refreshModule(pageId);

        // Auto-close sidebar on mobile
        const sidebar = $('sidebar');
        const overlay = $('sidebar-overlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    }

    function refreshModule(pageId) {
        try {
            if (pageId === 'dashboard' && typeof DashboardModule !== 'undefined') DashboardModule.refresh();
            if (pageId === 'customers' && typeof CustomersModule !== 'undefined') CustomersModule.refresh();
            if (pageId === 'services' && typeof ServicesModule !== 'undefined') ServicesModule.refresh();
            if (pageId === 'appointments' && typeof AppointmentsModule !== 'undefined') AppointmentsModule.refresh();
            if (pageId === 'settings') updateStorageUsage();
            
            updateSidebarBadges();
        } catch (e) {
            console.error(`[App] Failed to refresh module for page: ${pageId}`, e);
        }
    }

    function updateSidebarBadges() {
        const allApts = DB.getAll('appointments');
        const pendingCount = allApts.filter(a => a.status === 'pending' || a.status === 'in-progress').length;

        // Appointments Badge (Sidebar)
        const aptBadge = $('nav-badge-appointments');
        if (aptBadge) {
            if (pendingCount > 0) {
                aptBadge.textContent = pendingCount;
                aptBadge.style.display = 'flex';
            } else {
                aptBadge.style.display = 'none';
            }
        }

        // Appointments Badge (Bottom Nav)
        const bottomAptBadge = $('bottom-badge-appointments');
        if (bottomAptBadge) {
            if (pendingCount > 0) {
                bottomAptBadge.textContent = pendingCount;
                bottomAptBadge.style.display = 'flex';
            } else {
                bottomAptBadge.style.display = 'none';
            }
        }
    }

    // ── Modal Helpers ─────────────────────────────────────────
    function openModal(modalId) {
        // Support both format: 'customer-modal' or 'modal-customer'
        let modal = $(modalId);
        if (!modal && modalId.endsWith('-modal')) {
            modal = $('modal-' + modalId.replace('-modal', ''));
        } else if (!modal && modalId.startsWith('modal-')) {
            modal = $(modalId.replace('modal-', '') + '-modal');
        }

        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modalId) {
        let modal = $(modalId);
        if (!modal && modalId.endsWith('-modal')) {
            modal = $('modal-' + modalId.replace('-modal', ''));
        } else if (!modal && modalId.startsWith('modal-')) {
            modal = $(modalId.replace('modal-', '') + '-modal');
        }

        if (modal) {
            modal.classList.remove('active');
            // Check if any other modal is still active
            const activeModals = document.querySelectorAll('.modal-overlay.active');
            if (activeModals.length === 0) {
                document.body.style.overflow = '';
            }
        }
    }

    // ── Toast Notifications ───────────────────────────────────
    function showToast(message, type = 'success') {
        const container = $('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Select Icon based on type
        let iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-octagon';
        if (type === 'warning') iconName = 'alert-triangle';
        if (type === 'info') iconName = 'info';

        toast.innerHTML = `
            <i class="toast-icon" data-lucide="${iconName}"></i>
            <div class="toast-message">${message}</div>
            <button class="toast-close"><i data-lucide="x" width="14" height="14"></i></button>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        // Close on button click
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => removeToast(toast));
        }

        // Auto remove
        setTimeout(() => removeToast(toast), 4000);
    }

    function removeToast(toast) {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }

    // ── Format Helpers ────────────────────────────────────────
    function formatCurrency(num) {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(num) || 0);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            const d = date.getDate();
            const m = date.getMonth();
            const thaiMonthsShort = [
                'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
            ];
            const y = date.getFullYear() + 543; // Buddhist year

            return `${d} ${thaiMonthsShort[m]} ${y}`;
        } catch {
            return dateStr;
        }
    }

    function formatPhone(phoneStr) {
        if (!phoneStr) return '-';
        const cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        if (cleaned.length === 9) {
            return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
        }
        return phoneStr;
    }

    // ── Backup & Settings functions ───────────────────────────
    function exportData() {
        try {
            const jsonString = DB.exportData();
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const dateStr = new Date().toISOString().slice(0, 10);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spairdee_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('สำรองข้อมูลสำเร็จ (ดาวน์โหลดแล้ว)', 'success');
        } catch (e) {
            showToast('สำรองข้อมูลล้มเหลว', 'error');
            console.error(e);
        }
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const result = DB.importData(e.target.result);
            if (result.success) {
                showToast(result.message, 'success');
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                showToast(result.message, 'error');
            }
        };
        reader.readAsText(file);
        // Clear input value to allow importing same file again
        event.target.value = '';
    }

    function clearAllData() {
        if (confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด? ข้อมูลลูกค้า งานบริการ และปฏิทินนัดหมายจะหายไปอย่างถาวร!')) {
            if (confirm('ยืนยันอีกครั้ง: ลบข้อมูลทั้งหมดจริงหรือไม่?')) {
                DB.clearAllData();
                showToast('ล้างข้อมูลระบบแล้ว กำลังรีสตาร์ท...', 'info');
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
        }
    }

    function loadDemoData() {
        if (confirm('ต้องการโหลดข้อมูลตัวอย่างสำหรับใช้ทดสอบแอปพลิเคชันหรือไม่? (ข้อมูลปัจจุบันจะถูกเขียนทับ)')) {
            DB.clearAllData();
            DB.init();
            showToast('โหลดข้อมูลตัวอย่างสำเร็จ กำลังรีสตาร์ท...', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }

    function updateStorageUsage() {
        const label = $('storage-usage');
        if (!label) return;

        try {
            let total = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('acsp_')) {
                    total += (localStorage.getItem(key).length * 2); // 2 bytes per char
                }
            }
            const kb = (total / 1024).toFixed(2);
            label.textContent = `${kb} KB / 5,120 KB ( localStorage )`;
        } catch {
            label.textContent = 'ไม่สามารถคำนวณได้';
        }
    }

    // ── Setup Global Event Listeners ──────────────────────────
    function setupGlobalEvents() {
        // Navigation clicks
        const nav = $('sidebar-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                const item = e.target.closest('.nav-item');
                if (item && item.dataset.page) {
                    navigateTo(item.dataset.page);
                }
            });
        }

        // Bottom Navigation clicks (mobile)
        const bottomNav = $('bottom-nav');
        if (bottomNav) {
            bottomNav.addEventListener('click', (e) => {
                const item = e.target.closest('.bottom-nav-item');
                if (item && item.dataset.page) {
                    navigateTo(item.dataset.page);
                }
            });
        }

        // Inline navigations (e.g. "ดูทั้งหมด →")
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-navigate]');
            if (target) {
                navigateTo(target.dataset.navigate);
            }
        });

        // Hamburger Menu (mobile)
        const hamburgerBtn = $('hamburger-btn');
        const sidebar = $('sidebar');
        const sidebarOverlay = $('sidebar-overlay');

        if (hamburgerBtn && sidebar && sidebarOverlay) {
            hamburgerBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                sidebarOverlay.classList.toggle('active');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Modal Close Button handler
        document.body.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-modal-close]');
            if (closeBtn) {
                closeModal(closeBtn.dataset.modalClose);
            }
        });

        // Close modal on escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeOverlay = document.querySelector('.modal-overlay.active');
                if (activeOverlay) {
                    closeModal(activeOverlay.id);
                }
            }
        });

        // Settings actions
        const btnExport = $('btn-export-data');
        if (btnExport) btnExport.addEventListener('click', exportData);

        const btnImport = $('btn-import-data');
        const importInput = $('import-file-input');
        if (btnImport && importInput) {
            btnImport.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', importData);
        }

        const btnClear = $('btn-clear-data');
        if (btnClear) btnClear.addEventListener('click', clearAllData);

        const btnReloadDemo = $('btn-reload-demo');
        if (btnReloadDemo) btnReloadDemo.addEventListener('click', loadDemoData);

        // Cloud Sync Actions
        const cloudEnabledToggle = $('settings-cloud-enabled');
        const cloudUrlInput = $('settings-cloud-url');
        const btnCloudUpload = $('btn-cloud-upload-all');
        const btnCloudTriggerLine = $('btn-cloud-trigger-line');

        if (cloudEnabledToggle && cloudUrlInput && btnCloudUpload && btnCloudTriggerLine) {
            // Load current configs
            cloudEnabledToggle.checked = DB.isCloudEnabled();
            cloudUrlInput.value = DB.getCloudUrl();

            const updateButtonStates = () => {
                const isEnabled = cloudEnabledToggle.checked;
                const hasUrl = cloudUrlInput.value.trim().length > 0;
                btnCloudUpload.disabled = !isEnabled || !hasUrl;
                btnCloudTriggerLine.disabled = !isEnabled || !hasUrl;
            };

            updateButtonStates();

            // Save configs on changes
            cloudEnabledToggle.addEventListener('change', () => {
                DB.setCloudConfig(cloudEnabledToggle.checked, cloudUrlInput.value.trim());
                updateButtonStates();
                showToast(cloudEnabledToggle.checked ? 'เปิดใช้งาน Cloud Mode แล้ว' : 'ปิดใช้งาน Cloud Mode แล้ว', 'info');
                
                // If enabled, trigger a sync to pull fresh data
                if (cloudEnabledToggle.checked && cloudUrlInput.value.trim()) {
                    showToast('กำลังซิงก์ข้อมูลจากคลาวด์...', 'info');
                    DB.triggerSyncQueue()
                        .then(() => DB.pullFromCloud())
                        .then(() => {
                            showToast('ซิงก์ข้อมูลสำเร็จ', 'success');
                            location.reload();
                        })
                        .catch(err => {
                            showToast('ซิงก์ข้อมูลล้มเหลว: ' + err, 'error');
                        });
                }
            });

            cloudUrlInput.addEventListener('change', () => {
                DB.setCloudConfig(cloudEnabledToggle.checked, cloudUrlInput.value.trim());
                updateButtonStates();
                showToast('บันทึก Web App URL แล้ว', 'success');
            });

            btnCloudUpload.addEventListener('click', () => {
                if (confirm('คุณต้องการอัปเดตข้อมูลบนคลาวด์ด้วยข้อมูลในเครื่องของคุณใช่หรือไม่? (ข้อมูลเดิมบน Google Sheet ในชีต ACSP จะถูกเขียนทับ)')) {
                    btnCloudUpload.disabled = true;
                    btnCloudUpload.textContent = 'กำลังซิงก์...';
                    showToast('กำลังอัปโหลดข้อมูล...', 'info');
                    DB.pushAllToCloud()
                        .then(() => {
                            showToast('อัปโหลดข้อมูลสำเร็จ', 'success');
                        })
                        .catch(err => {
                            showToast('อัปโหลดข้อมูลล้มเหลว: ' + err, 'error');
                        })
                        .finally(() => {
                            btnCloudUpload.disabled = false;
                            btnCloudUpload.innerHTML = '<i data-lucide="cloud-lightning"></i> ซิงก์ขึ้นชีตทันที';
                            if (window.lucide) lucide.createIcons();
                            updateButtonStates();
                        });
                }
            });

            btnCloudTriggerLine.addEventListener('click', () => {
                btnCloudTriggerLine.disabled = true;
                btnCloudTriggerLine.textContent = 'กำลังส่ง...';
                showToast('กำลังส่งคำสั่งส่ง LINE...', 'info');
                DB.triggerCloudLineReport()
                    .then(() => {
                        showToast('ส่งสรุปคิวงานเข้า LINE สำเร็จ!', 'success');
                    })
                    .catch(err => {
                        showToast('ส่งสรุป LINE ล้มเหลว: ' + err, 'error');
                    })
                    .finally(() => {
                        btnCloudTriggerLine.disabled = false;
                        btnCloudTriggerLine.innerHTML = '<i data-lucide="send"></i> รันคำสั่งส่ง LINE';
                        if (window.lucide) lucide.createIcons();
                        updateButtonStates();
                    });
            });
        }

        // PWA Install Action
        const installBtn = $('btn-install-pwa');
        const settingsInstallBtn = $('btn-settings-install-pwa');
        const topInstallBtn = $('btn-top-install-pwa');

        const triggerInstall = async (btnEl) => {
            if (!deferredPrompt) {
                const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);
                if (isIOS) {
                    openModal('ios-install-modal');
                } else {
                    showToast('อุปกรณ์หรือบราวเซอร์นี้ไม่รองรับการติดตั้งตรง หรือแอปได้รับการติดตั้งแล้ว', 'info');
                }
                return;
            }
            btnEl.disabled = true;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`[PWA] Install choice: ${outcome}`);
            deferredPrompt = null;
            if (installBtn) installBtn.style.display = 'none';
            if (topInstallBtn) topInstallBtn.style.display = 'none';
            const installSection = $('settings-pwa-install-section');
            if (installSection) installSection.style.display = 'none';
            btnEl.disabled = false;
        };

        if (installBtn) installBtn.addEventListener('click', () => triggerInstall(installBtn));
        if (settingsInstallBtn) settingsInstallBtn.addEventListener('click', () => triggerInstall(settingsInstallBtn));
        if (topInstallBtn) topInstallBtn.addEventListener('click', () => triggerInstall(topInstallBtn));

        // Setup Date Display in topbar
        const topbarDate = $('topbar-date');
        if (topbarDate) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const today = new Date();
            topbarDate.textContent = today.toLocaleDateString('th-TH', options);
        }
    }

    // ── App Initialization ────────────────────────────────────
    function init() {
        // 1. Initialize Database
        DB.init();

        // 2. Setup Events
        setupGlobalEvents();

        // 3. Initialize Feature Modules
        try {
            if (typeof DashboardModule !== 'undefined') DashboardModule.init();
            if (typeof CustomersModule !== 'undefined') CustomersModule.init();
            if (typeof ServicesModule !== 'undefined') ServicesModule.init();
            if (typeof AppointmentsModule !== 'undefined') AppointmentsModule.init();
        } catch (e) {
            console.error('[App] Failed to initialize modules', e);
        }

        // 4. Initial navigation
        navigateTo('dashboard');

        // 5. Icons Render
        if (window.lucide) {
            lucide.createIcons();
        }

        // 6. PWA Installation Event Listeners
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show sidebar install button
            const installBtn = $('btn-install-pwa');
            if (installBtn) installBtn.style.display = 'inline-flex';

            // Show top-bar install button
            const topInstallBtn = $('btn-top-install-pwa');
            if (topInstallBtn) topInstallBtn.style.display = 'inline-flex';

            // Show settings page install section
            const installSection = $('settings-pwa-install-section');
            if (installSection) {
                installSection.style.display = 'block';
                const settingsInstallBtn = $('btn-settings-install-pwa');
                if (settingsInstallBtn) settingsInstallBtn.style.display = 'inline-flex';
            }

            if (window.lucide) lucide.createIcons();
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            const installBtn = $('btn-install-pwa');
            if (installBtn) installBtn.style.display = 'none';
            
            const topInstallBtn = $('btn-top-install-pwa');
            if (topInstallBtn) topInstallBtn.style.display = 'none';

            const installSection = $('settings-pwa-install-section');
            if (installSection) installSection.style.display = 'none';

            showToast('ติดตั้งแอปพลิเคชัน Spairdee เรียบร้อยแล้ว!', 'success');
        });

        // 8. Detect iOS PWA Installation Guide
        const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isIOS && !isStandalone) {
            // Show installation buttons on iOS
            const installBtn = $('btn-install-pwa');
            if (installBtn) installBtn.style.display = 'inline-flex';

            const topInstallBtn = $('btn-top-install-pwa');
            if (topInstallBtn) topInstallBtn.style.display = 'inline-flex';

            const installSection = $('settings-pwa-install-section');
            if (installSection) {
                installSection.style.display = 'block';
                const settingsInstallBtn = $('btn-settings-install-pwa');
                if (settingsInstallBtn) settingsInstallBtn.style.display = 'inline-flex';
            }
        }

        // Listen for cloud sync completion to refresh views
        document.addEventListener('db-synced', () => {
            console.log('[App] Database synced from cloud, refreshing views');
            showToast('ซิงก์ข้อมูลล่าสุดจากคลาวด์แล้ว', 'success');
            refreshModule(currentPage);
        });

        // 7. Register Service Worker (PWA) with Update Check
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => {
                        console.log('[PWA] Service Worker registered ✓', reg.scope);
                        
                        // Check if there is already an update waiting
                        if (reg.waiting) {
                            showUpdateToast(reg.waiting);
                        }

                        // Listen for future updates
                        reg.addEventListener('updatefound', () => {
                            const newWorker = reg.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    showUpdateToast(newWorker);
                                }
                            });
                        });
                    })
                    .catch(err => console.error('[PWA] Service Worker failed', err));

                // Ensure refresh only happens once when the new service worker takes over
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                    }
                });
            });
        }
    }

    function showUpdateToast(worker) {
        const container = $('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast toast-info';
        toast.style.cursor = 'pointer';
        toast.style.padding = '12px 16px';
        toast.style.background = 'var(--accent-gradient)';
        toast.style.color = '#fff';
        toast.style.boxShadow = 'var(--shadow-lg)';
        toast.style.border = '1px solid var(--accent-cyan)';

        toast.innerHTML = `
            <i class="toast-icon" data-lucide="refresh-cw" style="color:#fff;"></i>
            <div class="toast-message" style="margin-left: 8px; color:#fff;"><strong>มีระบบเวอร์ชันใหม่!</strong> กดที่นี่เพื่ออัปเดตแอปทันที</div>
        `;
        
        toast.addEventListener('click', () => {
            worker.postMessage({ action: 'skipWaiting' });
        });

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();
    }

    // Public API
    return {
        init,
        currentPage: () => currentPage,
        openModal,
        closeModal,
        showToast,
        formatCurrency,
        formatDate,
        formatPhone
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
