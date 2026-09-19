const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ALLOWED_AREAS = [
  'CC CENTER', 'CC Line 1', 'CC Line 2', 'CC Line 4', 'CC Line 5', 'CC Line 6',
  'PP CENTER', 'PP 28IR', 'PP 22STD', 'PP 28SHL1', 'PP 28SHL2', 'PP 28STD2',
  'PP 28IR2', 'PP 28STD7', 'PP 28STD6', 'PP 28STD5', 'PP 30ED15DIE', 'PP 28SHL4',
  'PP 28DEEP', 'PP COMPOSITE 1', 'PP COMPOSITE 2',
  'MX CENTER', 'MX MX301', 'MX MX302', 'MX MX303', 'MX XP331', 'MX XP332',
  'MX XC362', 'MX XC364', 'MX XC361', 'MX Scroll Shear',
  'PC CENTER', 'PC CP01', 'PC CP02', 'PC CP03', 'PC CP04', 'PC CP05',
  'PC CP06', 'PC CP07', 'PC CP08', 'PC CP09', 'PC CP10', 'PC INJ',
  'PR CENTER', 'PR Line 1', 'PR Line 2', 'PR Line 3', 'PR Line 5',
  'PR Line 8', 'PR Line 9', 'PR Line 6', 'PR Line 10', 'PR Line 7', 'PR อื่นๆ'
];

function cleanText(value, maxLength = 255) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isIsoDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parsePriceSatang(value) {
  const cleaned = String(value ?? '').replace(/[,\s]/g, '').trim();
  if (cleaned === '') return 0; // Optional price defaults to 0 satang
  const amount = parseNumber(cleaned);
  if (amount === null || amount < 0) return null;
  const satang = Math.round(amount * 100);
  return Number.isSafeInteger(satang) ? satang : null;
}

export function validateRecord(input) {
  const errors = {};
  const orderNumber = cleanText(input?.orderNumber, 80);
  const description = cleanText(input?.description, 2000);
  const quantity = parseNumber(input?.quantity);
  const priceRaw = input?.price ?? (input?.priceSatang != null ? input.priceSatang / 100 : '');
  const priceSatang = parsePriceSatang(priceRaw);
  const createdDate = cleanText(input?.createdDate, 10);
  const deliveryDate = cleanText(input?.deliveryDate, 10);
  const area = cleanText(input?.area, 80);

  if (!orderNumber) errors.orderNumber = 'กรุณาระบุเลข ORDER';
  if (!description) errors.description = 'กรุณาระบุรายละเอียด';
  if (quantity === null || quantity <= 0 || quantity > 1_000_000_000) errors.quantity = 'Qty ต้องเป็นตัวเลขมากกว่า 0';
  if (priceSatang === null) errors.price = 'หากระบุราคา ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป';
  if (!isIsoDate(createdDate)) errors.createdDate = 'วันที่สร้างต้องอยู่ในรูปแบบ YYYY-MM-DD';
  if (deliveryDate && !isIsoDate(deliveryDate)) errors.deliveryDate = 'Delivery ต้องอยู่ในรูปแบบ YYYY-MM-DD';
  if (area && !ALLOWED_AREAS.includes(area)) errors.area = 'พื้นที่ไม่ถูกต้องตามรายการที่กำหนด';

  return errors;
}

export function normalizeRecord(input) {
  const errors = validateRecord(input);
  if (Object.keys(errors).length) {
    const error = new Error('ข้อมูลไม่ครบหรือไม่ถูกต้อง');
    error.fields = errors;
    throw error;
  }

  const priceRaw = input?.price ?? (input?.priceSatang != null ? input.priceSatang / 100 : '');
  const priceSatang = parsePriceSatang(priceRaw);

  return {
    orderNumber: cleanText(input.orderNumber, 80),
    description: cleanText(input.description, 2000),
    quantity: parseNumber(input.quantity),
    priceSatang: priceSatang ?? 0,
    requestRef: cleanText(input.requestRef, 120) || null,
    poNumber: cleanText(input.poNumber, 120) || null,
    deliveryDate: cleanText(input.deliveryDate, 10) || null,
    area: cleanText(input.area, 80) || null,
    createdDate: cleanText(input.createdDate, 10)
  };
}
