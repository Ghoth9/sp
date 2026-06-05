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

        // Update active class on top nav items
        const topNavItems = document.querySelectorAll('#top-nav-menu .top-nav-item');
        topNavItems.forEach(item => {
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

        if (modalId === 'qr-scanner-modal') {
            stopQrScanner();
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
        const demoBanner = $('demo-banner');
        if (demoBanner) {
            demoBanner.style.display = DB.isCloudEnabled() ? 'none' : 'block';
        }

        const label = $('storage-usage');
        const dbTypeEl = $('settings-db-type');
        if (dbTypeEl) {
            dbTypeEl.textContent = DB.isCloudEnabled() ? 'Google Sheets (คลาวด์)' : 'localStorage (เบราว์เซอร์)';
        }

        updateCloudStatusBadge();

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
            label.textContent = DB.isCloudEnabled()
                ? `${kb} KB (แคชโลคอล) / ซิงก์ข้อมูลคลาวด์แล้ว`
                : `${kb} KB / 5,120 KB ( localStorage )`;
        } catch {
            label.textContent = 'ไม่สามารถคำนวณได้';
        }
    }

    // ── Setup Global Event Listeners ──────────────────────────
    function setupGlobalEvents() {
        // Navigation clicks (Sidebar / Fallbacks)
        const nav = $('sidebar-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                const item = e.target.closest('.nav-item');
                if (item && item.dataset.page) {
                    navigateTo(item.dataset.page);
                }
            });
        }

        // Top Navigation menu clicks
        const topNav = $('top-nav-menu');
        if (topNav) {
            topNav.addEventListener('click', (e) => {
                const item = e.target.closest('.top-nav-item');
                if (item && item.dataset.page) {
                    navigateTo(item.dataset.page);
                }
            });
        }

        // Top Logo Click -> Dashboard (Home) shortcut
        const topLogo = $('top-logo-btn');
        if (topLogo) {
            topLogo.addEventListener('click', () => {
                navigateTo('dashboard');
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

        // Modal Close Button handler & Backdrop click handler
        document.body.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-modal-close]');
            if (closeBtn) {
                closeModal(closeBtn.dataset.modalClose);
            } else if (e.target.classList.contains('modal-overlay')) {
                closeModal(e.target.id);
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

        const btnForceClear = $('btn-force-clear-cache');
        if (btnForceClear) {
            btnForceClear.addEventListener('click', () => {
                if (confirm('⚠️ ต้องการล้างไฟล์แคชระบบและบังคับอัปเดตแอปใช่หรือไม่?\n\n(ระบบจะโหลดหน้าเว็บและโค้ดเวอร์ชันล่าสุดจากเซิร์ฟเวอร์ โดยข้อมูลประวัติแอร์และลูกค้าของคุณจะไม่สูญหาย)')) {
                    showToast('กำลังล้างแคชระบบ...', 'info');
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then(regs => {
                            for (const r of regs) r.unregister();
                        });
                    }
                    if (window.caches) {
                        caches.keys().then(keys => {
                            return Promise.all(keys.map(k => caches.delete(k)));
                        }).then(() => {
                            showToast('ล้างแคชสำเร็จ กำลังรีสตาร์ท...', 'success');
                            setTimeout(() => { window.location.reload(true); }, 1000);
                        }).catch(err => {
                            showToast('ล้างแคชขัดข้อง: ' + err, 'error');
                        });
                    } else {
                        window.location.reload(true);
                    }
                }
            });
        }

        // Cloud Sync Actions
        const cloudEnabledToggle = $('settings-cloud-enabled');
        const cloudUrlInput = $('settings-cloud-url');
        const btnCloudUpload = $('btn-cloud-upload-all');
        const btnCloudTriggerLine = $('btn-cloud-trigger-line');

        if (cloudEnabledToggle && cloudUrlInput && btnCloudUpload && btnCloudTriggerLine) {
            // Load current configs
            cloudEnabledToggle.checked = DB.isCloudEnabled();
            cloudUrlInput.value = DB.getCloudUrl();
            updateStorageUsage(); // Initialize layout display on settings load

            const shareSection = $('share-cloud-section');
            const updateButtonStates = () => {
                const isEnabled = cloudEnabledToggle.checked;
                const hasUrl = cloudUrlInput.value.trim().length > 0;
                btnCloudUpload.disabled = !isEnabled || !hasUrl;
                btnCloudTriggerLine.disabled = !isEnabled || !hasUrl;
                if (shareSection) {
                    shareSection.style.display = (isEnabled && hasUrl) ? 'block' : 'none';
                }
            };

            updateButtonStates();

            // Setup share button handlers
            const btnCopyShare = $('btn-copy-share-link');
            const btnShowShareQR = $('btn-show-share-qr');

            const getShareLink = (url) => {
                let proto = window.location.protocol;
                let host = window.location.host;
                let path = window.location.pathname;
                
                // Fallback to production URL if running from local file
                if (proto === 'file:' || !host) {
                    proto = 'https:';
                    host = 'spairdee.netlify.app';
                    path = '/';
                }
                return `${proto}//${host}${path}?sync_url=${encodeURIComponent(url)}`;
            };

            if (btnCopyShare) {
                btnCopyShare.addEventListener('click', () => {
                    const url = DB.getCloudUrl();
                    if (!url) return;
                    const shareLink = getShareLink(url);
                    copyToClipboard(shareLink)
                        .then(() => showToast('คัดลอกลิงก์ตั้งค่าสำหรับทีมงานลงคลิปบอร์ดแล้ว! สามารถส่งต่อใน LINE ได้ทันที', 'success'))
                        .catch(err => showToast('ไม่สามารถคัดลอกลิงก์ได้: ' + err, 'error'));
                });
            }

            if (btnShowShareQR) {
                btnShowShareQR.addEventListener('click', () => {
                    const url = DB.getCloudUrl();
                    if (!url) return;
                    const shareLink = getShareLink(url);
                    
                    const qrImg = $('share-qr-img');
                    const qrLoading = $('share-qr-loading');
                    
                    if (qrImg && qrLoading) {
                        qrImg.style.display = 'none';
                        qrLoading.style.display = 'block';
                        
                        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareLink)}`;
                        qrImg.src = qrApiUrl;
                        qrImg.onload = () => {
                            qrLoading.style.display = 'none';
                            qrImg.style.display = 'block';
                        };
                    }
                    openModal('share-qr-modal');
                });
            }

            // Save configs on changes
            cloudEnabledToggle.addEventListener('change', (e) => {
                if (cloudEnabledToggle.checked) {
                    const urlVal = cloudUrlInput.value.trim();
                    if (!urlVal) {
                        showToast('กรุณากรอก Google Apps Script Web App URL ก่อนเปิดใช้งาน Cloud Mode', 'error');
                        cloudEnabledToggle.checked = false;
                        return;
                    }
                } else {
                    const confirmClose = confirm("⚠️ คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งานระบบเชื่อมต่อคลาวด์?\n\nเมื่อปิดแล้วระบบจะสลับไปใช้ฐานข้อมูลจำลองในเครื่องนี้แทนข้อมูลจริงบนคลาวด์");
                    if (!confirmClose) {
                        cloudEnabledToggle.checked = true;
                        return;
                    }
                }

                DB.setCloudConfig(cloudEnabledToggle.checked, cloudUrlInput.value.trim());
                updateButtonStates();
                updateStorageUsage(); // Update labels immediately!
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
                } else if (!cloudEnabledToggle.checked) {
                    setTimeout(() => {
                        location.reload();
                    }, 800);
                }
            });

            cloudUrlInput.addEventListener('change', () => {
                DB.setCloudConfig(cloudEnabledToggle.checked, cloudUrlInput.value.trim());
                updateButtonStates();
                updateStorageUsage(); // Update labels immediately!
                showToast('บันทึก Web App URL แล้ว', 'success');
            });

            // Demo Banner QR Code Scan click
            const btnBannerScanQr = $('btn-banner-scan-qr');
            if (btnBannerScanQr) {
                btnBannerScanQr.addEventListener('click', () => {
                    startQrScanner();
                });
            }

            // Settings Page QR Code Scan click
            const btnSettingsScanQr = $('btn-settings-scan-qr');
            if (btnSettingsScanQr) {
                btnSettingsScanQr.addEventListener('click', () => {
                    startQrScanner();
                });
            }

            // Click on Topbar Cloud Badge -> Go to Settings page
            const cloudBadge = $('topbar-cloud-badge');
            if (cloudBadge) {
                cloudBadge.addEventListener('click', () => {
                    navigateTo('settings');
                    const section = $('settings-cloud-enabled');
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            }

            // Advanced settings collapse/expand toggle
            const linkToggleAdvanced = $('link-toggle-advanced-settings');
            const advancedSection = $('settings-advanced-cloud-url');
            if (linkToggleAdvanced && advancedSection) {
                linkToggleAdvanced.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isHidden = advancedSection.style.display === 'none';
                    advancedSection.style.display = isHidden ? 'block' : 'none';
                    linkToggleAdvanced.innerHTML = isHidden 
                        ? '<i data-lucide="chevron-up" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> ซ่อนการตั้งค่าขั้นสูง' 
                        : '<i data-lucide="chevron-down" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> ตั้งค่าขั้นสูง (แก้ไขลิงก์ระบบ)';
                    if (window.lucide) lucide.createIcons();
                });
            }

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

        // Setup Date Display in topbar (Clean & compact date format)
        const topbarDate = $('topbar-date');
        const topbarDateWrapper = $('topbar-date-wrapper');
        if (topbarDate) {
            const today = new Date();
            const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const dayName = days[today.getDay()];
            const dateNum = today.getDate();
            const monthName = months[today.getMonth()];
            const yearNum = today.getFullYear() + 543;
            topbarDate.innerHTML = `<span class="date-day-month">${dayName} ${dateNum} ${monthName}</span><span class="date-year"> ${yearNum}</span>`;

            if (topbarDateWrapper) {
                topbarDateWrapper.style.cursor = 'pointer';
                topbarDateWrapper.addEventListener('click', () => {
                    const daysFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
                    const monthsFull = [
                        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                    ];
                    const dayFull = daysFull[today.getDay()];
                    const monthFull = monthsFull[today.getMonth()];
                    showToast(`📅 ${dayFull}ที่ ${dateNum} ${monthFull} พ.ศ. ${yearNum}`, 'info');
                });
            }
        }

        // Setup Online/Offline Status Indicator
        const updateOnlineStatus = () => {
            const statusBadge = $('topbar-status-badge');
            if (statusBadge) {
                const isOnline = navigator.onLine;
                statusBadge.classList.toggle('online', isOnline);
                statusBadge.classList.toggle('offline', !isOnline);
                
                const text = statusBadge.querySelector('.status-text');
                if (text) {
                    text.textContent = isOnline ? 'ออนไลน์' : 'ออฟไลน์';
                }
                
                // Show a toast message to notify status change
                if (window.__app_initialized) {
                    showToast(
                        isOnline ? 'กลับมาออนไลน์เชื่อมต่อแล้ว' : 'คุณกำลังใช้งานแบบออฟไลน์',
                        isOnline ? 'success' : 'warning'
                    );

                    // Auto background sync when returning online if cloud enabled
                    if (isOnline && typeof DB !== 'undefined' && DB.isCloudEnabled() && DB.getCloudUrl()) {
                        showToast('กำลังประมวลผลข้อมูลค้างซิงก์ขึ้นคลาวด์...', 'info');
                        DB.triggerSyncQueue()
                            .then(() => DB.pullFromCloud())
                            .then(() => {
                                showToast('ซิงก์ข้อมูลคลาวด์อัตโนมัติสำเร็จ', 'success');
                                refreshModule(currentPage);
                            })
                            .catch(err => {
                                console.warn('[App] Auto cloud sync failed:', err);
                            });
                    }
                }
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
        window.__app_initialized = true;
    }

    // ── App Initialization ────────────────────────────────────
    function init() {
        const progressEl = $('splash-loader-progress');
        const statusEl = $('splash-status');

        const updateProgress = (pct, text) => {
            if (progressEl) progressEl.style.width = pct + '%';
            if (statusEl) statusEl.textContent = text;
        };

        // 1. Initialize Database
        updateProgress(20, 'กำลังเชื่อมต่อฐานข้อมูล...');
        DB.init();

        // Check if sync was configured from URL
        if (window.__sync_configured) {
            showToast('เชื่อมต่อฐานข้อมูลคลาวด์ร้านแอร์เรียบร้อยแล้ว!', 'success');
        }

        // 2. Setup Events
        updateProgress(50, 'กำลังเตรียมเมนูการใช้งาน...');
        setupGlobalEvents();

        // Update Storage labels initially (also sets demo banner display)
        updateStorageUsage();

        // 3. Initialize Feature Modules
        updateProgress(75, 'กำลังโหลดข้อมูลบริการ...');
        try {
            if (typeof DashboardModule !== 'undefined') DashboardModule.init();
            if (typeof CustomersModule !== 'undefined') CustomersModule.init();
            if (typeof ServicesModule !== 'undefined') ServicesModule.init();
            if (typeof AppointmentsModule !== 'undefined') AppointmentsModule.init();
        } catch (e) {
            console.error('[App] Failed to initialize modules', e);
        }

        // 4. Initial navigation
        updateProgress(90, 'กำลังเปิดเซสชัน...');
        navigateTo('dashboard');

        // 5. Icons Render
        if (window.lucide) {
            lucide.createIcons();
        }

        // Complete loading and fade out splash screen
        updateProgress(100, 'แอปพร้อมใช้งาน');
        setTimeout(() => {
            const splash = $('app-splash-screen');
            if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 500);
            }
        }, 400);

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
                        
                        // Force check for updates on load
                        reg.update();
                        
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

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return Promise.resolve();
            } catch (err) {
                document.body.removeChild(textarea);
                return Promise.reject(err);
            }
        }
    }

    // ── QR Code Scanner Logic ─────────────────────────────────
    let html5QrcodeScanner = null;

    function startQrScanner() {
        const qrReader = $('qr-reader');
        if (!qrReader) return;

        if (typeof Html5Qrcode === 'undefined') {
            showToast('ระบบกล้องสแกนกำลังโหลด... กรุณาลองใหม่อีกครั้ง', 'warning');
            return;
        }

        openModal('qr-scanner-modal');
        const statusEl = $('qr-scanner-status');
        if (statusEl) statusEl.textContent = "กำลังเชื่อมต่อกล้องถ่ายรูป...";

        stopQrScanner();

        html5QrcodeScanner = new Html5Qrcode("qr-reader");

        html5QrcodeScanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
                console.log("[QR Scanner] Decoded QR:", decodedText);
                try {
                    const url = new URL(decodedText);
                    const syncUrl = url.searchParams.get('sync_url');
                    if (syncUrl) {
                        stopQrScanner();
                        closeModal('qr-scanner-modal');
                        
                        DB.setCloudConfig(true, syncUrl);
                        showToast('เชื่อมต่อฐานข้อมูลคลาวด์ทีมงานสำเร็จ! กำลังโหลด...', 'success');
                        setTimeout(() => {
                            location.reload();
                        }, 1200);
                        return;
                    }
                } catch (e) {
                    // Ignored
                }

                if (decodedText.includes('script.google.com/macros/')) {
                    stopQrScanner();
                    closeModal('qr-scanner-modal');
                    
                    DB.setCloudConfig(true, decodedText.trim());
                    showToast('เชื่อมต่อฐานข้อมูลคลาวด์ทีมงานสำเร็จ! กำลังโหลด...', 'success');
                    setTimeout(() => {
                        location.reload();
                    }, 1200);
                } else {
                    showToast('QR Code นี้ไม่มีสิทธิ์เข้าถึงระบบแอร์ Spairdee', 'error');
                }
            },
            (errorMessage) => {
                // Ignore decoding errors
            }
        ).then(() => {
            if (statusEl) statusEl.textContent = "เล็งกล้องไปที่ QR Code ของทีมงานเพื่อซิงก์ระบบ";
        }).catch(err => {
            console.error("[QR Scanner] Start error:", err);
            if (statusEl) statusEl.textContent = "กล้องขัดข้อง: " + err;
        });
    }

    function stopQrScanner() {
        if (html5QrcodeScanner) {
            const statusEl = $('qr-scanner-status');
            if (statusEl) statusEl.textContent = "กำลังปิดกล้อง...";
            
            // Only stop if actively scanning
            const stopPromise = html5QrcodeScanner.isScanning 
                ? html5QrcodeScanner.stop() 
                : Promise.resolve();

            stopPromise.then(() => {
                console.log("[QR Scanner] Stopped.");
                html5QrcodeScanner = null;
            }).catch(err => {
                console.error("[QR Scanner] Stop error:", err);
                html5QrcodeScanner = null;
            });
        }
    }

    // ── Update Topbar Cloud Badge State ───────────────────────
    function updateCloudStatusBadge() {
        const badge = $('topbar-cloud-badge');
        if (!badge) return;

        const isEnabled = DB.isCloudEnabled();
        const hasUrl = DB.getCloudUrl().trim().length > 0;

        badge.classList.remove('connected', 'disconnected');

        const iconEl = badge.querySelector('.cloud-icon');
        const textEl = badge.querySelector('.cloud-text');

        if (isEnabled && hasUrl) {
            badge.classList.add('connected');
            badge.title = "ระบบเชื่อมต่อคลาวด์เปิดใช้งาน (ข้อมูลจริง)";
            if (textEl) textEl.textContent = "เชื่อมต่อคลาวด์";
            if (iconEl) iconEl.setAttribute('data-lucide', 'cloud');
        } else {
            badge.classList.add('disconnected');
            badge.title = "โหมดสาธิต (ใช้ข้อมูลจำลองในเครื่องนี้)";
            if (textEl) textEl.textContent = "โหมดสาธิต";
            if (iconEl) iconEl.setAttribute('data-lucide', 'cloud-off');
        }

        if (window.lucide) {
            lucide.createIcons();
        }
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
        formatPhone,
        copyToClipboard
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
