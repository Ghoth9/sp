/**
 * 📂 Setup.gs - สคริปต์เตรียมโครงสร้างชีตสำหรับระบบ AC Service Pro
 */

// โครงสร้างหัวตาราง (Headers) ของแต่ละชีต
const SHEET_SCHEMAS = {
  'ACSP_Customers': ['id', 'name', 'phone', 'address', 'mapsLink', 'lineId', 'notes', 'createdAt', 'updatedAt'],
  'ACSP_Services': ['id', 'customerId', 'type', 'acBrand', 'acModel', 'acBTU', 'symptoms', 'solution', 'partsUsed', 'price', 'paymentStatus', 'paidAmount', 'technician', 'serviceDate', 'notes', 'images', 'createdAt', 'updatedAt'],
  'ACSP_Appointments': ['id', 'customerId', 'serviceType', 'date', 'time', 'status', 'notes', 'createdAt', 'updatedAt'],
  'ACSP_Users': ['id', 'username', 'password', 'role', 'name', 'createdAt', 'updatedAt']
};

/**
 * 🚀 รันฟังก์ชันนี้เพื่อเริ่มสร้างชีตฐานข้อมูลทั้งหมดอัตโนมัติ
 * (กรุณาใส่ SPREADSHEET_ID ใน Script Properties ก่อนรัน)
 */
function setupDatabaseSheets() {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    Logger.log("❌ ไม่พบ SPREADSHEET_ID กรุณาเพิ่มใน Script Properties");
    throw new Error("ไม่พบ SPREADSHEET_ID กรุณาตั้งค่าก่อนรันระบบ");
  }
  
  const ss = SpreadsheetApp.openById(spreadsheetId);
  
  Object.keys(SHEET_SCHEMAS).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log(`✅ สร้างชีตใหม่: ${sheetName}`);
    } else {
      Logger.log(`ℹ️ ชีตมีอยู่แล้ว: ${sheetName}`);
    }
    
    // ตั้งค่าหัวคอลัมน์ (Headers)
    const headers = SHEET_SCHEMAS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f1f5f9");
    
    // ตรึงแถวแรกไว้
    sheet.setFrozenRows(1);

    // ถ้าเป็นชีตผู้ใช้งานและไม่มีข้อมูล (มีแต่หัวตาราง) ให้เพิ่มบัญชีแอดมินเริ่มต้น
    if (sheetName === 'ACSP_Users' && sheet.getLastRow() <= 1) {
      const defaultAdmin = [
        'USR-001',
        'admin',
        'password123',
        'admin',
        'ผู้จัดการร้าน',
        new Date(),
        new Date()
      ];
      sheet.appendRow(defaultAdmin);
      Logger.log("👥 สร้างผู้ใช้แอดมินเริ่มต้น (admin / password123) แล้ว");
    }
  });
  
  Logger.log("🎉 ติดตั้งชีตฐานข้อมูลทั้งหมดเรียบร้อยแล้วจ้า!");
}
