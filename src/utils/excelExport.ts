import * as XLSX from 'xlsx';
import { Session, OrderItem, Vendor } from '../types';

export function exportSessionToExcel(
  session: Session,
  orders: OrderItem[],
  vendors?: Record<string, Vendor>
) {
  const sessionOrders = orders.filter((o) => o.sessionId === session.sessionId);

  // Sheet 1: Detailed Orders
  const orderRows = sessionOrders.map((o) => {
    const vendor = vendors ? vendors[o.storeName] : undefined;
    return {
      '開團日期': session.date,
      '團購主題': session.title || `${session.organizerName} 發起的團購`,
      '承辦人': session.organizerName,
      '訂購人員': o.userName,
      '店家名稱': o.storeName,
      '店家電話': vendor?.phone || '-',
      '店家地址': vendor?.address || '-',
      '餐點品項': o.itemName,
      '規格/客製化': o.options || '無',
      '單價': o.price,
      '數量': o.qty,
      '小計金額': o.subtotal,
    };
  });

  // Sheet 2: Summary by Store & Item
  const summaryMap: Record<
    string,
    {
      storeName: string;
      storePhone: string;
      storeAddress: string;
      itemName: string;
      options: string;
      qty: number;
      total: number;
      buyers: string[];
    }
  > = {};

  sessionOrders.forEach((o) => {
    const key = `${o.storeName}__${o.itemName}__${o.options || ''}`;
    const vendor = vendors ? vendors[o.storeName] : undefined;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        storeName: o.storeName,
        storePhone: vendor?.phone || '-',
        storeAddress: vendor?.address || '-',
        itemName: o.itemName,
        options: o.options || '標準規格',
        qty: 0,
        total: 0,
        buyers: [],
      };
    }
    summaryMap[key].qty += o.qty;
    summaryMap[key].total += o.subtotal;
    summaryMap[key].buyers.push(`${o.userName} x${o.qty}`);
  });

  const summaryRows = Object.values(summaryMap).map((s) => ({
    '店家名稱': s.storeName,
    '店家電話': s.storePhone,
    '店家地址': s.storeAddress,
    '餐點品項': s.itemName,
    '規格/客製化': s.options,
    '採購總數量': s.qty,
    '採購總金額': s.total,
    '訂購名單與份數': s.buyers.join(', '),
  }));

  // Create Workbook
  const wb = XLSX.utils.book_new();

  const wsOrders = XLSX.utils.json_to_sheet(
    orderRows.length > 0 ? orderRows : [{ '訊息': '本團購尚無人員點餐資料' }]
  );
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0 ? summaryRows : [{ '訊息': '本團購尚無點餐統計資料' }]
  );

  // Auto-width adjustment helper
  const adjustColumnWidths = (ws: XLSX.WorkSheet) => {
    const ref = ws['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    const colWidths: number[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v) {
          const valStr = String(cell.v);
          // Simple length estimation for double-byte Chinese characters
          let len = 0;
          for (let i = 0; i < valStr.length; i++) {
            len += valStr.charCodeAt(i) > 255 ? 2 : 1;
          }
          if (len > maxLen) maxLen = len;
        }
      }
      colWidths.push(Math.min(maxLen + 4, 50));
    }
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  };

  adjustColumnWidths(wsOrders);
  adjustColumnWidths(wsSummary);

  XLSX.utils.book_append_sheet(wb, wsOrders, '團購成員訂單明細');
  XLSX.utils.book_append_sheet(wb, wsSummary, '店家採購總彙整表');

  // Generate File Name
  const cleanDate = session.date.replace(/[/:\\]/g, '-');
  const storeLabel = session.bentoStore || session.drinkStore || session.goodsStore || '團購';
  const fileName = `團購訂單清單_${cleanDate}_${session.organizerName}_${storeLabel}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
