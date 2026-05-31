// ============================================================
// AC Service Pro — Database Layer (db.js)
// localStorage CRUD · Auto-ID · Search · Export / Import
// Demo data seeds on first run
// ============================================================

const DB = (() => {
  'use strict';

  // ── Collection keys ────────────────────────────────────────
  const COLLECTIONS = {
    customers: 'acsp_customers',
    services: 'acsp_services',
    appointments: 'acsp_appointments',
  };

  const INITIALIZED_KEY = 'acsp_initialized';

  // ── Helpers ────────────────────────────────────────────────

  /** Read a full collection from localStorage */
  function _getAll(collectionKey) {
    try {
      const raw = localStorage.getItem(collectionKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      console.error(`[DB] Failed to parse ${collectionKey}`);
      return [];
    }
  }

  /** Persist a full collection */
  function _saveAll(collectionKey, data) {
    localStorage.setItem(collectionKey, JSON.stringify(data));
  }

  function normalizeDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (!str) return '';
    
    // 1. ถ้าเป็น YYYY-MM-DD...
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    
    // 2. ถ้าเป็น DD/MM/YYYY หรือ DD/MM/BBBB
    const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      let d = parseInt(dmyMatch[1], 10);
      let m = parseInt(dmyMatch[2], 10);
      let y = parseInt(dmyMatch[3], 10);
      if (y >= 2500) y -= 543;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    
    // 3. ลองใช้ Date.parse
    try {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().substring(0, 10);
      }
    } catch (e) {}
    
    return str;
  }

  function _cleanRecordDates(collection, record) {
    if (!record) return record;
    if (collection === 'appointments' && record.date) {
      record.date = normalizeDate(record.date);
    }
    if (collection === 'services' && record.serviceDate) {
      record.serviceDate = normalizeDate(record.serviceDate);
    }
    return record;
  }

  /** Generate next sequential ID  e.g. CUS-009 → CUS-010 */
  function _nextId(prefix, collectionKey) {
    const items = _getAll(collectionKey);
    if (items.length === 0) return `${prefix}-001`;
    const nums = items.map((i) => {
      const parts = i.id.split('-');
      return parseInt(parts[parts.length - 1], 10) || 0;
    });
    const max = Math.max(...nums);
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }

  // ── Generic CRUD ──────────────────────────────────────────

  function getAll(collection) {
    return _getAll(COLLECTIONS[collection]);
  }

  function getById(collection, id) {
    return _getAll(COLLECTIONS[collection]).find((item) => item.id === id) || null;
  }

  function create(collection, data) {
    const key = COLLECTIONS[collection];
    const prefixMap = {
      customers: 'CUS',
      services: 'SRV',
      appointments: 'APT',
    };
    const id = _nextId(prefixMap[collection], key);
    const record = { id, ...data, createdAt: new Date().toISOString() };
    const all = _getAll(key);
    all.push(record);
    _saveAll(key, all);
    
    // Background cloud sync
    _pushToCloud('create', collection, id, record);
    
    return record;
  }

  function update(collection, id, data) {
    const key = COLLECTIONS[collection];
    const all = _getAll(key);
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    _saveAll(key, all);
    
    // Background cloud sync
    _pushToCloud('update', collection, id, all[idx]);
    
    return all[idx];
  }

  function remove(collection, id) {
    const key = COLLECTIONS[collection];
    const all = _getAll(key);
    const filtered = all.filter((item) => item.id !== id);
    if (filtered.length === all.length) return false;
    _saveAll(key, filtered);
    
    // Background cloud sync
    _pushToCloud('delete', collection, id, null);
    
    return true;
  }

  // ── Search helpers ────────────────────────────────────────

  /** Case-insensitive multi-field search */
  function search(collection, query, fields) {
    if (!query || !query.trim()) return getAll(collection);
    const q = query.trim().toLowerCase();
    return getAll(collection).filter((item) =>
      fields.some((f) => {
        const val = item[f];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }

  function searchCustomers(query) {
    return search('customers', query, ['name', 'phone', 'address', 'lineId', 'id']);
  }

  function searchServices(query) {
    return search('services', query, [
      'id', 'customerId', 'type', 'acBrand', 'acModel', 'symptoms', 'solution', 'technician',
    ]);
  }

  function searchAppointments(query) {
    return search('appointments', query, ['id', 'customerId', 'serviceType', 'status', 'notes']);
  }

  // ── Relationship helpers ──────────────────────────────────

  /** Get all services for a given customer */
  function getServicesByCustomer(customerId) {
    return getAll('services').filter((s) => s.customerId === customerId);
  }

  /** Get all appointments for a given customer */
  function getAppointmentsByCustomer(customerId) {
    return getAll('appointments').filter((a) => a.customerId === customerId);
  }

  /** Get appointments for a given date (YYYY-MM-DD) */
  function getAppointmentsByDate(date) {
    return getAll('appointments').filter((a) => a.date === date);
  }

  /** Get appointments for a given month (YYYY-MM) */
  function getAppointmentsByMonth(yearMonth) {
    return getAll('appointments').filter((a) => a.date && a.date.startsWith(yearMonth));
  }

  // ── Dashboard stats ───────────────────────────────────────

  function getStats() {
    const customers = getAll('customers');
    const services = getAll('services');
    const appointments = getAll('appointments');

    const totalRevenue = services.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const unpaidAmount = services.reduce((sum, s) => {
      if (s.paymentStatus === 'unpaid') return sum + (s.price || 0);
      if (s.paymentStatus === 'partial') return sum + ((s.price || 0) - (s.paidAmount || 0));
      return sum;
    }, 0);

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const servicesThisMonth = services.filter((s) => s.serviceDate && s.serviceDate.startsWith(thisMonth));
    const revenueThisMonth = servicesThisMonth.reduce((sum, s) => sum + (s.paidAmount || 0), 0);

    const pendingAppointments = appointments.filter((a) => a.status === 'pending' || a.status === 'in-progress');

    // Revenue by month (last 6 months)
    const revenueByMonth = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = 0;
    }
    services.forEach((s) => {
      if (!s.serviceDate) return;
      const key = s.serviceDate.substring(0, 7);
      if (key in revenueByMonth) {
        revenueByMonth[key] += (s.paidAmount || 0);
      }
    });

    // Services by type
    const servicesByType = {};
    services.forEach((s) => {
      servicesByType[s.type] = (servicesByType[s.type] || 0) + 1;
    });

    return {
      totalCustomers: customers.length,
      totalServices: services.length,
      totalRevenue,
      unpaidAmount,
      revenueThisMonth,
      servicesThisMonth: servicesThisMonth.length,
      pendingAppointments: pendingAppointments.length,
      revenueByMonth,
      servicesByType,
    };
  }

  // ── Export / Import ───────────────────────────────────────

  function exportData() {
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        customers: getAll('customers'),
        services: getAll('services'),
        appointments: getAll('appointments'),
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  function importData(jsonString) {
    try {
      const payload = JSON.parse(jsonString);
      if (!payload.data) throw new Error('Invalid backup format');
      const { customers, services, appointments } = payload.data;
      if (customers) _saveAll(COLLECTIONS.customers, customers);
      if (services) _saveAll(COLLECTIONS.services, services);
      if (appointments) _saveAll(COLLECTIONS.appointments, appointments);
      return { success: true, message: 'นำเข้าข้อมูลสำเร็จ' };
    } catch (e) {
      return { success: false, message: `นำเข้าข้อมูลล้มเหลว: ${e.message}` };
    }
  }

  function clearAllData() {
    Object.values(COLLECTIONS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(INITIALIZED_KEY);
  }

  // ── Demo Data ─────────────────────────────────────────────

  function _seedDemoData() {
    // ---------- Customers ----------
    const customers = [
      {
        id: 'CUS-001',
        name: 'สมชาย วงศ์สวัสดิ์',
        phone: '081-234-5678',
        address: '123/45 ซ.สุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
        lineId: 'somchai_w',
        notes: 'ลูกค้าประจำ คอนโด 2 ห้อง',
        createdAt: '2024-11-10T08:30:00Z',
      },
      {
        id: 'CUS-002',
        name: 'พิมพ์ใจ แสงทอง',
        phone: '092-876-5432',
        address: '88/12 หมู่บ้านพฤกษา ถ.รามอินทรา แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพฯ 10220',
        lineId: 'pimjai.s',
        notes: 'บ้านเดี่ยว แอร์ 4 ตัว',
        createdAt: '2024-11-22T10:15:00Z',
      },
      {
        id: 'CUS-003',
        name: 'ธนกร เจริญสุข',
        phone: '065-111-2233',
        address: '299 อาคารออฟฟิศพาร์ค ชั้น 15 ถ.วิภาวดีรังสิต แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
        lineId: 'thanakorn_c',
        notes: 'ออฟฟิศ ระบบแอร์ส่วนกลาง + แยก 3 ตัว',
        createdAt: '2024-12-05T14:00:00Z',
      },
      {
        id: 'CUS-004',
        name: 'นภาพร ศรีสุวรรณ',
        phone: '089-456-7890',
        address: '56/7 ซ.ลาดพร้าว 71 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพฯ 10230',
        lineId: 'napaporn.sri',
        notes: 'ทาวน์เฮ้าส์ 3 ชั้น',
        createdAt: '2024-12-18T09:45:00Z',
      },
      {
        id: 'CUS-005',
        name: 'วีระพงษ์ อัครพันธ์',
        phone: '062-333-4455',
        address: '401/89 คอนโดไลฟ์ แอท รัชดา ชั้น 22 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400',
        lineId: 'weerapong401',
        notes: '',
        createdAt: '2025-01-08T11:30:00Z',
      },
      {
        id: 'CUS-006',
        name: 'ร้านกาแฟ บ้านสวน',
        phone: '02-123-4567',
        address: '78 ถ.เจริญกรุง แขวงสี่พระยา เขตบางรัก กรุงเทพฯ 10500',
        lineId: 'baansuan_cafe',
        notes: 'ร้านกาแฟ แอร์ 2 ตัว ล้างทุก 3 เดือน',
        createdAt: '2025-01-15T16:00:00Z',
      },
      {
        id: 'CUS-007',
        name: 'อรุณี พัฒนกิจ',
        phone: '095-678-9012',
        address: '34/5 หมู่บ้านสัมมากร ถ.รามคำแหง 110 แขวงสะพานสูง เขตสะพานสูง กรุงเทพฯ 10240',
        lineId: 'arunee.p34',
        notes: 'บ้านเดี่ยว แอร์เก่า ต้องดูแลบ่อย',
        createdAt: '2025-02-02T08:00:00Z',
      },
      {
        id: 'CUS-008',
        name: 'ปิยะ มั่นคง',
        phone: '083-222-9988',
        address: '19/3 ซ.อ่อนนุช 44 แขวงสวนหลวง เขตสวนหลวง กรุงเทพฯ 10250',
        lineId: '',
        notes: 'ไม่มี LINE ติดต่อโทรศัพท์อย่างเดียว',
        createdAt: '2025-02-20T13:20:00Z',
      },
    ];

    // ---------- Services (15 records, last 6 months) ----------
    const services = [
      {
        id: 'SRV-001',
        customerId: 'CUS-001',
        type: 'ล้างแอร์',
        acBrand: 'Daikin',
        acModel: 'FTKM09TV2S',
        acBTU: 9000,
        symptoms: 'แอร์ไม่เย็น มีกลิ่นอับ',
        solution: 'ล้างแอร์แบบถอดล้าง ทำความสะอาดคอยล์เย็นและรังผึ้ง',
        partsUsed: [],
        price: 1800,
        paymentStatus: 'paid',
        paidAmount: 1800,
        technician: 'ช่างวิทยา',
        serviceDate: '2024-12-15',
        notes: '',
        createdAt: '2024-12-15T09:00:00Z',
      },
      {
        id: 'SRV-002',
        customerId: 'CUS-002',
        type: 'ซ่อมแอร์',
        acBrand: 'Mitsubishi Electric',
        acModel: 'MSY-GR13VF',
        acBTU: 13000,
        symptoms: 'คอมเพรสเซอร์ไม่ทำงาน แอร์ไม่เย็นเลย',
        solution: 'เปลี่ยนคาปาซิเตอร์คอมเพรสเซอร์ 35µF',
        partsUsed: ['Capacitor 35µF'],
        price: 2500,
        paymentStatus: 'paid',
        paidAmount: 2500,
        technician: 'ช่างวิทยา',
        serviceDate: '2024-12-22',
        notes: '',
        createdAt: '2024-12-22T10:30:00Z',
      },
      {
        id: 'SRV-003',
        customerId: 'CUS-003',
        type: 'ล้างแอร์',
        acBrand: 'Daikin',
        acModel: 'FTKC18TV2S',
        acBTU: 18000,
        symptoms: 'ล้างประจำไตรมาส',
        solution: 'ล้างแอร์แบบถอดล้าง 3 ตัว',
        partsUsed: [],
        price: 5400,
        paymentStatus: 'paid',
        paidAmount: 5400,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-01-10',
        notes: 'ออฟฟิศ ล้าง 3 ตัว ตัวละ 1,800',
        createdAt: '2025-01-10T08:00:00Z',
      },
      {
        id: 'SRV-004',
        customerId: 'CUS-004',
        type: 'เติมน้ำยา',
        acBrand: 'Samsung',
        acModel: 'AR10TYHYCWKNST',
        acBTU: 10000,
        symptoms: 'แอร์เย็นไม่ค่อยพอ น้ำยาหมด',
        solution: 'เติมน้ำยา R32 จำนวน 2 กก.',
        partsUsed: ['น้ำยา R32 2kg'],
        price: 3000,
        paymentStatus: 'partial',
        paidAmount: 1500,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-01-18',
        notes: 'ลูกค้าขอผ่อนจ่าย จ่ายมัดจำ 50%',
        createdAt: '2025-01-18T14:00:00Z',
      },
      {
        id: 'SRV-005',
        customerId: 'CUS-006',
        type: 'ล้างแอร์',
        acBrand: 'Carrier',
        acModel: '42TVAB024',
        acBTU: 24000,
        symptoms: 'ล้างประจำ 3 เดือน',
        solution: 'ล้างแอร์แบบถอดล้าง 2 ตัว',
        partsUsed: [],
        price: 4000,
        paymentStatus: 'paid',
        paidAmount: 4000,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-02-05',
        notes: 'ร้านกาแฟ ล้างแอร์ 24000 BTU 2 ตัว',
        createdAt: '2025-02-05T09:00:00Z',
      },
      {
        id: 'SRV-006',
        customerId: 'CUS-005',
        type: 'ติดตั้ง',
        acBrand: 'Daikin',
        acModel: 'FTKF12XV2S',
        acBTU: 12000,
        symptoms: '',
        solution: 'ติดตั้งแอร์ใหม่ ห้องนอน ชั้น 22 ท่อยาว 5 เมตร',
        partsUsed: ['ท่อทองแดง 5m', 'สายไฟ', 'ขาแขวน'],
        price: 4500,
        paymentStatus: 'paid',
        paidAmount: 4500,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-02-14',
        notes: 'ลูกค้าซื้อแอร์เอง ค่าติดตั้งอย่างเดียว',
        createdAt: '2025-02-14T08:30:00Z',
      },
      {
        id: 'SRV-007',
        customerId: 'CUS-007',
        type: 'ซ่อมแอร์',
        acBrand: 'LG',
        acModel: 'IG13R.SE',
        acBTU: 13000,
        symptoms: 'แอร์มีเสียงดัง พัดลมคอยล์เย็นสั่น',
        solution: 'เปลี่ยนมอเตอร์พัดลมคอยล์เย็น',
        partsUsed: ['Fan Motor Indoor'],
        price: 3500,
        paymentStatus: 'paid',
        paidAmount: 3500,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-02-28',
        notes: '',
        createdAt: '2025-02-28T10:00:00Z',
      },
      {
        id: 'SRV-008',
        customerId: 'CUS-001',
        type: 'ล้างแอร์',
        acBrand: 'Daikin',
        acModel: 'FTKM12TV2S',
        acBTU: 12000,
        symptoms: 'ล้างประจำ ห้องนอนใหญ่',
        solution: 'ล้างแอร์แบบถอดล้าง',
        partsUsed: [],
        price: 1800,
        paymentStatus: 'paid',
        paidAmount: 1800,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-03-10',
        notes: 'ตัวที่ 2 ในคอนโด',
        createdAt: '2025-03-10T09:00:00Z',
      },
      {
        id: 'SRV-009',
        customerId: 'CUS-008',
        type: 'ย้ายแอร์',
        acBrand: 'Panasonic',
        acModel: 'CS-PU12VKT',
        acBTU: 12000,
        symptoms: 'ย้ายแอร์จากห้องนอนไปห้องนั่งเล่น',
        solution: 'ถอดเครื่อง ติดตั้งใหม่ เปลี่ยนท่อใหม่ 4 เมตร เติมน้ำยา',
        partsUsed: ['ท่อทองแดง 4m', 'น้ำยา R32 1kg'],
        price: 5500,
        paymentStatus: 'unpaid',
        paidAmount: 0,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-03-25',
        notes: 'ลูกค้าขอวางบิล จ่ายปลายเดือน',
        createdAt: '2025-03-25T08:00:00Z',
      },
      {
        id: 'SRV-010',
        customerId: 'CUS-002',
        type: 'ล้างแอร์',
        acBrand: 'Mitsubishi Electric',
        acModel: 'MSY-GR18VF',
        acBTU: 18000,
        symptoms: 'ล้างประจำปี',
        solution: 'ล้างแอร์แบบถอดล้าง 4 ตัว',
        partsUsed: [],
        price: 7200,
        paymentStatus: 'paid',
        paidAmount: 7200,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-04-08',
        notes: 'บ้านเดี่ยว ล้างทุกตัว',
        createdAt: '2025-04-08T08:00:00Z',
      },
      {
        id: 'SRV-011',
        customerId: 'CUS-003',
        type: 'ซ่อมแอร์',
        acBrand: 'Daikin',
        acModel: 'FTKC18TV2S',
        acBTU: 18000,
        symptoms: 'แอร์รั่วน้ำ ถาดน้ำทิ้งตัน',
        solution: 'ล้างท่อน้ำทิ้ง เปลี่ยนปั๊มน้ำทิ้ง',
        partsUsed: ['Drain Pump'],
        price: 2800,
        paymentStatus: 'paid',
        paidAmount: 2800,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-04-15',
        notes: '',
        createdAt: '2025-04-15T13:00:00Z',
      },
      {
        id: 'SRV-012',
        customerId: 'CUS-006',
        type: 'ล้างแอร์',
        acBrand: 'Carrier',
        acModel: '42TVAB024',
        acBTU: 24000,
        symptoms: 'ล้างประจำ 3 เดือน',
        solution: 'ล้างแอร์แบบถอดล้าง 2 ตัว',
        partsUsed: [],
        price: 4000,
        paymentStatus: 'paid',
        paidAmount: 4000,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-05-03',
        notes: '',
        createdAt: '2025-05-03T09:00:00Z',
      },
      {
        id: 'SRV-013',
        customerId: 'CUS-004',
        type: 'ถอดแอร์',
        acBrand: 'Samsung',
        acModel: 'AR13TYHYCWKNST',
        acBTU: 13000,
        symptoms: 'ต้องการถอดแอร์เพื่อปรับปรุงห้อง',
        solution: 'ถอดแอร์ เก็บน้ำยา เก็บรักษาเครื่อง',
        partsUsed: [],
        price: 2000,
        paymentStatus: 'paid',
        paidAmount: 2000,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-05-12',
        notes: 'จะติดตั้งกลับหลังปรับปรุงเสร็จ ประมาณ 2 สัปดาห์',
        createdAt: '2025-05-12T10:00:00Z',
      },
      {
        id: 'SRV-014',
        customerId: 'CUS-007',
        type: 'เติมน้ำยา',
        acBrand: 'Toshiba',
        acModel: 'RAS-H10E2KCVG',
        acBTU: 10000,
        symptoms: 'แอร์ห้องนั่งเล่นไม่เย็น น้ำยารั่ว',
        solution: 'ซ่อมรอยรั่วข้อต่อท่อ เติมน้ำยา R410A 1.5 กก.',
        partsUsed: ['น้ำยา R410A 1.5kg'],
        price: 3500,
        paymentStatus: 'partial',
        paidAmount: 2000,
        technician: 'ช่างสมบัติ',
        serviceDate: '2025-05-20',
        notes: 'จ่ายก่อน 2,000 ที่เหลือสิ้นเดือน',
        createdAt: '2025-05-20T14:30:00Z',
      },
      {
        id: 'SRV-015',
        customerId: 'CUS-005',
        type: 'ล้างแอร์',
        acBrand: 'Daikin',
        acModel: 'FTKF12XV2S',
        acBTU: 12000,
        symptoms: 'ล้างครั้งแรกหลังติดตั้ง 3 เดือน',
        solution: 'ล้างแอร์แบบไม่ถอด',
        partsUsed: [],
        price: 1200,
        paymentStatus: 'paid',
        paidAmount: 1200,
        technician: 'ช่างวิทยา',
        serviceDate: '2025-05-22',
        notes: '',
        createdAt: '2025-05-22T09:00:00Z',
      },
    ];

    // ---------- Appointments (5 upcoming) ----------
    const appointments = [
      {
        id: 'APT-001',
        customerId: 'CUS-004',
        serviceType: 'ติดตั้ง',
        date: '2025-05-30',
        time: '09:00',
        status: 'pending',
        notes: 'ติดตั้งแอร์กลับหลังปรับปรุงห้อง เครื่องเดิมที่ถอดไว้',
        createdAt: '2025-05-20T10:00:00Z',
      },
      {
        id: 'APT-002',
        customerId: 'CUS-001',
        serviceType: 'ล้างแอร์',
        date: '2025-06-02',
        time: '10:00',
        status: 'pending',
        notes: 'ล้างแอร์ประจำ คอนโดห้อง A',
        createdAt: '2025-05-22T08:00:00Z',
      },
      {
        id: 'APT-003',
        customerId: 'CUS-003',
        serviceType: 'ล้างแอร์',
        date: '2025-06-05',
        time: '08:30',
        status: 'pending',
        notes: 'ล้างแอร์ประจำไตรมาส ออฟฟิศ 3 ตัว',
        createdAt: '2025-05-25T09:00:00Z',
      },
      {
        id: 'APT-004',
        customerId: 'CUS-008',
        serviceType: 'ซ่อมแอร์',
        date: '2025-06-08',
        time: '13:00',
        status: 'pending',
        notes: 'แอร์ Panasonic มีเสียงดัง ช่างตรวจดูอาการ',
        createdAt: '2025-05-26T11:00:00Z',
      },
      {
        id: 'APT-005',
        customerId: 'CUS-006',
        serviceType: 'ล้างแอร์',
        date: '2025-06-15',
        time: '09:00',
        status: 'pending',
        notes: 'ร้านกาแฟ ล้างประจำ 3 เดือน',
        createdAt: '2025-05-27T10:00:00Z',
      }
    ];
    _saveAll(COLLECTIONS.customers, customers);
    _saveAll(COLLECTIONS.services, services);
    _saveAll(COLLECTIONS.appointments, appointments);
    localStorage.setItem(INITIALIZED_KEY, 'true');

    console.log('[DB] Demo data seeded ✓');
  }

  // ── Cloud Sync Configuration & Functions ──────────────────
  const DEFAULT_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbxurKONxQEqeF6NyLb_OuiQkCbToT6-gyWkIIwhdGmj7DJcEeHlxNheJ-F2YZdHdlla/exec';
  
  let _cloudUrl = localStorage.getItem('acsp_cloud_url') || DEFAULT_CLOUD_URL;
  let _cloudEnabled = localStorage.getItem('acsp_cloud_enabled') !== null
    ? localStorage.getItem('acsp_cloud_enabled') === 'true'
    : true; // เปิดใช้งาน Cloud Mode เป็นค่าเริ่มต้นสำหรับเครื่องใหม่/ช่างทุกคน

  function isCloudEnabled() {
    return _cloudEnabled;
  }

  function getCloudUrl() {
    return _cloudUrl;
  }

  function setCloudConfig(enabled, url) {
    _cloudEnabled = !!enabled;
    _cloudUrl = url || '';
    localStorage.setItem('acsp_cloud_enabled', String(_cloudEnabled));
    localStorage.setItem('acsp_cloud_url', _cloudUrl);
  }

  function _pushToCloud(action, collection, id, data) {
    if (!_cloudEnabled || !_cloudUrl) return;

    const payload = {
      action: action,
      collection: collection,
      id: id,
      data: data
    };

    fetch(_cloudUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        console.log(`[Cloud] Background push success: ${action} ${collection}`);
        if (res.record && (action === 'create' || action === 'update')) {
          const key = COLLECTIONS[collection];
          const all = _getAll(key);
          const idx = all.findIndex(item => item.id === id);
          if (idx !== -1) {
            all[idx] = _cleanRecordDates(collection, res.record);
            _saveAll(key, all);
            // Dispatch event to refresh UI
            document.dispatchEvent(new CustomEvent('db-synced'));
          }
        }
      } else {
        console.warn(`[Cloud] Background push failed from API: ${res.error}`);
        _addToSyncQueue(action, collection, id, data);
      }
    })
    .catch(err => {
      console.warn(`[Cloud] Background push failed: ${action} ${collection}, queuing for retry.`, err);
      _addToSyncQueue(action, collection, id, data);
    });
  }

  function _addToSyncQueue(action, collection, id, data) {
    try {
      const queue = JSON.parse(localStorage.getItem('acsp_sync_queue') || '[]');
      const duplicateIdx = queue.findIndex(q => q.collection === collection && q.id === id && q.action === action);
      if (duplicateIdx === -1) {
        queue.push({ action, collection, id, data, timestamp: new Date().toISOString() });
        localStorage.setItem('acsp_sync_queue', JSON.stringify(queue));
      }
    } catch (e) {
      console.error("[Cloud] Failed to add to sync queue", e);
    }
  }

  function triggerSyncQueue() {
    if (!_cloudEnabled || !_cloudUrl) return Promise.resolve();
    const queue = JSON.parse(localStorage.getItem('acsp_sync_queue') || '[]');
    if (queue.length === 0) return Promise.resolve();

    console.log(`[Cloud] Processing ${queue.length} queued operations...`);
    
    let promise = Promise.resolve();
    const successfulIndexes = [];

    queue.forEach((op, index) => {
      promise = promise.then(() => {
        return fetch(_cloudUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(op)
        })
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            successfulIndexes.push(index);
            if (res.record && (op.action === 'create' || op.action === 'update')) {
              const key = COLLECTIONS[op.collection];
              const all = _getAll(key);
              const idx = all.findIndex(item => item.id === op.id);
              if (idx !== -1) {
                all[idx] = _cleanRecordDates(op.collection, res.record);
                _saveAll(key, all);
              }
            }
          }
        })
        .catch(err => {
          console.warn("[Cloud] Queue item failed to sync", op, err);
        });
      });
    });

    return promise.then(() => {
      const remaining = queue.filter((_, idx) => !successfulIndexes.includes(idx));
      localStorage.setItem('acsp_sync_queue', JSON.stringify(remaining));
      console.log(`[Cloud] Queue sync complete. Remaining: ${remaining.length}`);
    });
  }

  function pullFromCloud() {
    if (!_cloudEnabled || !_cloudUrl) return Promise.reject("Cloud not enabled or URL missing");

    return fetch(_cloudUrl)
      .then(res => {
        if (!res.ok) throw new Error("Network response not ok");
        return res.json();
      })
      .then(data => {
        if (data.customers) _saveAll(COLLECTIONS.customers, data.customers);
        if (data.services) {
          const cleaned = data.services.map(s => _cleanRecordDates('services', s));
          _saveAll(COLLECTIONS.services, cleaned);
        }
        if (data.appointments) {
          const cleaned = data.appointments.map(a => _cleanRecordDates('appointments', a));
          _saveAll(COLLECTIONS.appointments, cleaned);
        }
        
        console.log("[Cloud] Pulled all data from Google Sheets successfully.");
        return data;
      });
  }

  function pushAllToCloud() {
    if (!_cloudEnabled || !_cloudUrl) return Promise.reject("Cloud not enabled or URL missing");

    const payload = {
      action: 'sync_all',
      data: {
        customers: getAll('customers'),
        services: getAll('services'),
        appointments: getAll('appointments')
      }
    };

    return fetch(_cloudUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => {
      if (!res.success) throw new Error(res.error || "Sync failed");
      console.log("[Cloud] Pushed all local data to Google Sheets successfully.");
      return res;
    });
  }

  function triggerCloudLineReport() {
    if (!_cloudEnabled || !_cloudUrl) return Promise.reject("Cloud not enabled or URL missing");

    const payload = { action: 'trigger_line' };

    return fetch(_cloudUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => {
      if (!res.success) throw new Error(res.error || "Failed to trigger LINE message");
      return res;
    });
  }

  // ── Initialise ────────────────────────────────────────────

  function init() {
    if (!localStorage.getItem(INITIALIZED_KEY)) {
      _seedDemoData();
    }
    console.log('[DB] Ready');
    
    // Auto sync queue and pull fresh data if online and cloud enabled
    if (_cloudEnabled && _cloudUrl) {
      triggerSyncQueue()
        .then(() => pullFromCloud())
        .then(() => {
          // Trigger a custom event to notify components that DB was synced
          document.dispatchEvent(new CustomEvent('db-synced'));
        })
        .catch(err => console.warn("[Cloud] Initial sync failed:", err));
    }
  }

  // ── Public API ────────────────────────────────────────────

  return {
    init,
    getAll,
    getById,
    create,
    add: create,
    update,
    remove,
    delete: remove,
    searchCustomers,
    searchServices,
    searchAppointments,
    getServicesByCustomer,
    getAppointmentsByCustomer,
    getAppointmentsByDate,
    getAppointmentsByMonth,
    getStats,
    exportData,
    importData,
    clearAllData,
    
    // Exposed Cloud API
    isCloudEnabled,
    getCloudUrl,
    setCloudConfig,
    pullFromCloud,
    pushAllToCloud,
    triggerSyncQueue,
    triggerCloudLineReport
  };
})();

