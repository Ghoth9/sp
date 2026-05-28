/**
 * 📂 Code.gs - ระบบหลังบ้านหลักสำหรับ AC Service Pro (แยกโปรเจกต์เดี่ยว)
 * จัดการ API สำหรับแอปหน้าเว็บ และตารางส่ง LINE อัตโนมัติ
 */

// ── GET REQUESTS (อ่านข้อมูล) ──────────────────────────────────
function doGet(e) {
  try {
    const ssId = getSpreadsheetId();
    if (!ssId) {
      return errorResponse("ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน Script Properties จ้า");
    }
    
    // โหลดตารางข้อมูลทั้งหมดส่งกลับเป็น JSON
    const payload = {
      customers: readSheetAsJson('ACSP_Customers'),
      services: readSheetAsJson('ACSP_Services'),
      appointments: readSheetAsJson('ACSP_Appointments'),
      inventory: readSheetAsJson('ACSP_Inventory')
    };
    
    return jsonResponse(payload);
  } catch (err) {
    return errorResponse(err.message);
  }
}

// ── POST REQUESTS (เขียนข้อมูล / ส่งไลน์) ──────────────────────────
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return errorResponse("ไม่มีข้อมูลดิบส่งมา");
    }
    
    const request = JSON.parse(e.postData.contents);
    const ssId = getSpreadsheetId();
    if (!ssId) {
      return errorResponse("ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน Script Properties จ้า");
    }
    
    const action = request.action;
    const collection = request.collection; // 'customers', 'services', 'appointments', 'inventory'
    const sheetName = getSheetName(collection);
    
    if (action === 'create') {
      const record = writeRecord(sheetName, request.data);
      return jsonResponse({ success: true, record: record });
    }
    
    if (action === 'update') {
      const record = updateRecord(sheetName, request.id, request.data);
      return jsonResponse({ success: true, record: record });
    }
    
    if (action === 'delete') {
      const success = deleteRecord(sheetName, request.id);
      return jsonResponse({ success: success });
    }
    
    if (action === 'sync_all') {
      // ซิงก์ทับข้อมูลทั้งหมด (มีประโยชน์ตอนอัปโหลดข้อมูลจาก Local ขึ้นชีตครั้งแรก)
      const data = request.data;
      if (data.customers) overwriteSheet('ACSP_Customers', data.customers);
      if (data.services) overwriteSheet('ACSP_Services', data.services);
      if (data.appointments) overwriteSheet('ACSP_Appointments', data.appointments);
      if (data.inventory) overwriteSheet('ACSP_Inventory', data.inventory);
      
      return jsonResponse({ success: true, message: "ซิงก์ข้อมูลทั้งหมดขึ้นคลาวด์เรียบร้อย!" });
    }
    
    if (action === 'trigger_line') {
      // เจ้าของร้านสั่งส่งสรุปคิวงานผ่านหน้าเว็บทันที
      const result = sendDailyJobQueueToLine();
      return jsonResponse({ success: result });
    }
    
    return errorResponse("ไม่รู้จัก Action: " + action);
  } catch (err) {
    return errorResponse(err.message);
  }
}

// ── ตารางทำงานอัตโนมัติ (Time Triggers) ──────────────────────────

/**
 * ⏰ ตั้งเวลา Trigger รันฟังก์ชันนี้ช่วง 07:00 - 08:00 น. ทุกเช้า
 * เพื่อรวบรวมงานวันนี้ส่งเข้ากลุ่มไลน์ช่างโดยอัตโนมัติ
 */
function sendDailyJobQueueToLine() {
  try {
    const ssId = getSpreadsheetId();
    if (!ssId) {
      Logger.log("❌ ไม่พบ SPREADSHEET_ID ในระบบ");
      return false;
    }
    
    // 1. ดึงวันปัจจุบัน (ฟอร์แมต YYYY-MM-DD แบบไทย)
    const now = new Date();
    const formattedToday = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
    const thaiDateText = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    
    // 2. โหลดข้อมูลนัดหมายและลูกค้า
    const appointments = readSheetAsJson('ACSP_Appointments');
    const customers = readSheetAsJson('ACSP_Customers');
    
    // กรองนัดหมายเฉพาะของ "วันนี้" และไม่ยกเลิก
    const todayJobs = appointments.filter(a => a.date === formattedToday && a.status !== 'cancelled');
    if (todayJobs.length === 0) {
      Logger.log("ℹ️ วันนี้ไม่มีนัดหมายงานบริการแอร์");
      // ส่งบอกกลุ่มช่างสักนิดว่าวันนี้ไม่มีคิวงาน
      sendToLineGroup(`❄️ สรุปคิวงานบริการแอร์ วันที่ ${thaiDateText} ❄️\n\n🟢 วันนี้ไม่มีคิวงานนัดหมายบริการแอร์ พักผ่อนให้เต็มที่ครับช่าง! 🛠️☕`);
      return true;
    }
    
    // เรียงตามเวลา
    todayJobs.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    
    // 3. ประกอบร่างข้อความสรุปงาน
    let message = `❄️ สรุปคิวงานบริการแอร์ วันที่ ${thaiDateText} ❄️\n\n`;
    
    todayJobs.forEach((job, index) => {
      // ค้นหารายละเอียดลูกค้า
      const customer = customers.find(c => c.id === job.customerId) || { name: 'ไม่พบข้อมูลลูกค้า', phone: '-' };
      
      message += `📌 คิวที่ ${index + 1}: เวลา ${job.time || '-'} น. | ${job.serviceType}\n`;
      message += `• ลูกค้า: คุณ${customer.name}\n`;
      message += `• เบอร์โทร: ${customer.phone}\n`;
      if (customer.address) {
        message += `• ที่อยู่: ${customer.address}\n`;
      }
      if (customer.mapsLink) {
        message += `• แผนที่นำทาง: ${customer.mapsLink}\n`;
      }
      if (job.notes) {
        message += `• หมายเหตุงาน: ${job.notes}\n`;
      }
      message += `-------------------------\n`;
    });
    
    message += `⚠️ แจ้งทีมช่าง: หากปิดงานเสร็จสิ้น หรือติดต่อลูกค้าไม่ได้ (บ้านปิด) กรุณากดอัปเดตสถานะในระบบทันทีเพื่อเจ้าของร้านจะได้เลื่อนนัดหมายครับ 🛠️💻`;
    
    // 4. ส่งข้อความเข้ากลุ่ม LINE
    return sendToLineGroup(message);
  } catch (err) {
    Logger.log("❌ เกิดข้อผิดพลาดในการส่งข้อความ: " + err.message);
    return false;
  }
}

// ── ฟังก์ชันตัวช่วยส่ง LINE (Bot หรือ Notify) ───────────────────────
function sendToLineGroup(message) {
  const notifyToken = getLineNotifyToken();
  const botToken = getLineBotToken();
  const groupId = getLineGroupId();
  
  let success = false;
  
  // 1. วิธี LINE Notify (สะดวกสุดสำหรับส่งเข้ากลุ่มงาน)
  if (notifyToken) {
    const url = 'https://notify-api.line.me/api/notify';
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + notifyToken },
      payload: { message: message },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      Logger.log("✅ ส่งข้อความสำเร็จผ่าน LINE Notify");
      success = true;
    } else {
      Logger.log("❌ LINE Notify ส่งไม่สำเร็จ: " + response.getContentText());
    }
  }
  
  // 2. วิธี LINE Bot (ถ้าตั้งค่า Bot Token และ Group ID ไว้)
  if (botToken && groupId) {
    const url = 'https://api.line.me/v2/bot/message/push';
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + botToken },
      payload: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      Logger.log("✅ ส่งข้อความสำเร็จผ่าน LINE Bot");
      success = true;
    } else {
      Logger.log("❌ LINE Bot ส่งไม่สำเร็จ: " + response.getContentText());
    }
  }
  
  if (!notifyToken && (!botToken || !groupId)) {
    Logger.log("❌ ไม่พบโทเค็นสำหรับส่งข้อความ กรุณาตั้ง LINE_NOTIFY_TOKEN หรือ LINE_BOT_TOKEN+LINE_GROUP_ID");
  }
  
  return success;
}

// ── ฟังก์ชันจัดการเขียนอ่านตารางชีต (Sheet helpers) ───────────────────

function getSheetName(collection) {
  const maps = {
    'customers': 'ACSP_Customers',
    'services': 'ACSP_Services',
    'appointments': 'ACSP_Appointments',
    'inventory': 'ACSP_Inventory'
  };
  return maps[collection];
}

function readSheetAsJson(sheetName) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const rows = values.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, index) => {
      let val = row[index];
      // แปลงฟอร์แมตวันที่ให้อยู่ใน ISO String สำหรับใช้งานบน JS
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      }
      obj[h] = val;
    });
    return obj;
  });
}

function writeRecord(sheetName, data) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // สร้างแถวข้อมูลใหม่
  const newRow = headers.map(h => {
    if (h === 'createdAt' || h === 'updatedAt') return new Date();
    return data[h] !== undefined ? data[h] : '';
  });
  
  sheet.appendRow(newRow);
  
  // คืนค่าออบเจกต์ที่เพิ่มลงชีต
  const record = {};
  headers.forEach((h, idx) => {
    record[h] = newRow[idx];
  });
  return record;
}

function updateRecord(sheetName, id, data) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getDataRange().getValues();
  
  // หาแถวที่ ID ตรงกัน
  let rowIdx = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      rowIdx = i + 1; // ลำดับ 1-indexed
      break;
    }
  }
  
  if (rowIdx === -1) throw new Error("ไม่พบแถวข้อมูลที่มีรหัส: " + id);
  
  // อัปเดตข้อมูลในแต่ละช่อง
  headers.forEach((h, colIdx) => {
    if (h === 'id') return; // ห้ามแก้รหัสคีย์
    if (h === 'updatedAt') {
      sheet.getRange(rowIdx, colIdx + 1).setValue(new Date());
    } else if (data[h] !== undefined) {
      sheet.getRange(rowIdx, colIdx + 1).setValue(data[h]);
    }
  });
  
  // คืนค่าข้อมูลที่อัปเดตแล้ว
  const updatedValues = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const record = {};
  headers.forEach((h, idx) => {
    record[h] = updatedValues[idx];
  });
  return record;
}

function deleteRecord(sheetName, id) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  
  // หาแถวที่ ID ตรงกันเพื่อลบ
  let rowIdx = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      rowIdx = i + 1;
      break;
    }
  }
  
  if (rowIdx === -1) return false;
  
  sheet.deleteRow(rowIdx);
  return true;
}

function overwriteSheet(sheetName, dataList) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // ล้างเนื้อหาเก่าทั้งหมด (แต่คงหัวตารางไว้)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (dataList.length === 0) return;
  
  // จัดเรียงแถวข้อมูลที่จะเขียน
  const newRows = dataList.map(data => {
    return headers.map(h => data[h] !== undefined ? data[h] : '');
  });
  
  sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
}

// ── GET/SET Properties ─────────────────────────────────────────
function getSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
}
function getLineNotifyToken() {
  return PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_TOKEN');
}
function getLineBotToken() {
  return PropertiesService.getScriptProperties().getProperty('LINE_BOT_TOKEN');
}
function getLineGroupId() {
  return PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
}

// ── ตัวช่วยสร้างการตอบสนอง API (JSON Response Helpers) ────────────────
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
