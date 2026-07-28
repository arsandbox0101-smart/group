import React, { useState } from 'react';
import { History, Calendar, UserCheck, Store, ChevronRight, FileText, FileSpreadsheet, Download } from 'lucide-react';
import { Session, OrderItem, Vendor } from '../types';
import { exportSessionToExcel } from '../utils/excelExport';

interface TabHistoryProps {
  sessions: Session[];
  orders: OrderItem[];
  vendors?: Record<string, Vendor>;
}

export const TabHistory: React.FC<TabHistoryProps> = ({ sessions, orders, vendors }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions[0]?.sessionId || null
  );

  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId) || sessions[0];
  const sessionOrders = selectedSession
    ? orders.filter((o) => o.sessionId === selectedSession.sessionId)
    : [];

  const totalSessionAmount = sessionOrders.reduce((sum, o) => sum + o.subtotal, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shadow-xs">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">歷史開團與訂單紀錄</h2>
            <p className="text-xs text-slate-500">查閱過往辦公室團購紀錄與詳細同仁點餐清單</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">尚無歷史團購紀錄</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Session selector list */}
            <div className="md:col-span-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">歷史活動列表</label>
              {sessions.map((sess) => {
                const isSelected = selectedSession?.sessionId === sess.sessionId;
                return (
                  <div
                    key={sess.sessionId}
                    onClick={() => setSelectedSessionId(sess.sessionId)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">{sess.date}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {sess.status === 'Open' ? '進行中' : '已結單'}
                      </span>
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      承辦人: {sess.organizerName} | {sess.bentoStore} / {sess.drinkStore}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Session order details */}
            <div className="md:col-span-8 bg-slate-50/60 rounded-2xl p-5 border border-slate-200">
              {selectedSession ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-lg">{selectedSession.date} 團購紀錄</h3>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                          selectedSession.status === 'Open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {selectedSession.status === 'Open' ? '開放中' : '已結單'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        承辦人: <strong className="text-slate-800">{selectedSession.organizerName}</strong> | 店家: {selectedSession.bentoStore || '-'} / {selectedSession.drinkStore || '-'} {selectedSession.goodsStore ? `/ ${selectedSession.goodsStore}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => exportSessionToExcel(selectedSession, orders, vendors)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                        title="匯出此團購的完整 Excel 點餐明細與採購彙整表"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                        <span>匯出單一團購 Excel</span>
                      </button>

                      <div className="text-right pl-3 border-l border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">總金額</div>
                        <div className="text-xl font-black text-red-600">${totalSessionAmount}</div>
                      </div>
                    </div>
                  </div>

                  {sessionOrders.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">此團購無點餐紀錄</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="pb-2 font-semibold">訂購人</th>
                            <th className="pb-2 font-semibold">店家</th>
                            <th className="pb-2 font-semibold">品項</th>
                            <th className="pb-2 font-semibold">規格/備註</th>
                            <th className="pb-2 font-semibold text-center">數量</th>
                            <th className="pb-2 font-semibold text-right">小計</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                          {sessionOrders.map((ord) => (
                            <tr key={ord.orderId}>
                              <td className="py-2 font-bold text-slate-900">{ord.userName}</td>
                              <td className="py-2 text-slate-600">{ord.storeName}</td>
                              <td className="py-2 font-bold text-slate-800">{ord.itemName}</td>
                              <td className="py-2 text-slate-500">{ord.options}</td>
                              <td className="py-2 text-center font-bold">{ord.qty}</td>
                              <td className="py-2 text-right font-extrabold text-blue-600">${ord.subtotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">請點選左側歷史活動檢視詳情</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
