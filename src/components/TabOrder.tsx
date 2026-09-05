import React, { useState } from 'react';
import {
  Utensils,
  Coffee,
  ShoppingBag,
  Clock,
  UserCheck,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  Store,
  Info,
  ChevronRight,
  ListOrdered,
  Pin,
  ShieldAlert,
  Phone,
  MapPin
} from 'lucide-react';
import { Session, Vendor, MenuItem, CartItem, OrderItem, StoreType } from '../types';
import { AddToCartModal } from './AddToCartModal';

interface TabOrderProps {
  session: Session | null;
  openSessions?: Session[];
  onSelectSession?: (sessionId: string) => void;
  vendors: Record<string, Vendor>;
  userName: string;
  onRequestSetName: () => void;
  cart: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onUpdateCartQty: (index: number, newQty: number) => void;
  onRemoveFromCart: (index: number) => void;
  onSubmitOrder: () => void;
  sessionOrders: OrderItem[];
  onDeleteOrder: (orderId: string) => void;
  onNavigateToAdmin: () => void;
  isSubmitting: boolean;
  isSingleSessionMode?: boolean;
}

export const TabOrder: React.FC<TabOrderProps> = ({
  session,
  openSessions = [],
  onSelectSession,
  vendors,
  userName,
  onRequestSetName,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onSubmitOrder,
  sessionOrders,
  onDeleteOrder,
  onNavigateToAdmin,
  isSubmitting,
  isSingleSessionMode = false,
}) => {
  const [modalItem, setModalItem] = useState<{
    item: MenuItem;
    storeName: string;
    storeType: StoreType;
  } | null>(null);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('全部分類');
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);

  // Pinning (置頂) states
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([]);
  const [pinnedMenuItems, setPinnedMenuItems] = useState<Record<string, boolean>>({});
  const [pinnedOrderIds, setPinnedOrderIds] = useState<Record<string, boolean>>({});
  const [pinMyOrders, setPinMyOrders] = useState<boolean>(true);
  const [allowDeleteAll, setAllowDeleteAll] = useState<boolean>(false);

  // Custom Delete Confirmation Modal state
  const [orderToDelete, setOrderToDelete] = useState<OrderItem | null>(null);

  const isClosed = session?.status === 'Closed';

  // ⏰ 檢查是否已超過團購截止時間
  const isExpired = React.useMemo(() => {
    if (!session?.deadline) return false;
    const deadlineStr = session.deadline.trim();
    const dateStr = session.date ? session.date.trim() : '';

    let targetDate: Date | null = null;
    if (deadlineStr.includes('-') || deadlineStr.includes('/')) {
      targetDate = new Date(deadlineStr.replace(/-/g, '/'));
    } else if (dateStr) {
      const cleanDate = dateStr.split(' ')[0].replace(/-/g, '/');
      targetDate = new Date(`${cleanDate} ${deadlineStr}`);
    }

    if (targetDate && !isNaN(targetDate.getTime())) {
      return Date.now() >= targetDate.getTime();
    }
    return false;
  }, [session?.deadline, session?.date]);

  const isOrderingDisabled = isClosed || isExpired;

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">目前沒有開放中的團購活動</h3>
          <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
            今天尚未發起便當或飲料點餐活動。如果您是團購承辦人，可以立即點擊下方按鈕發起今日團購！
          </p>
          <button
            onClick={onNavigateToAdmin}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md shadow-blue-500/20 transition-all hover:scale-102"
          >
            <Plus className="w-5 h-5" />
            發起今日團購
          </button>
        </div>
      </div>
    );
  }

  const bentoVendor = session.bentoStore && session.bentoStore !== '-' ? vendors[session.bentoStore] : null;
  const drinkVendor = session.drinkStore && session.drinkStore !== '-' ? vendors[session.drinkStore] : null;
  const goodsVendor = session.goodsStore && session.goodsStore !== '-' ? vendors[session.goodsStore] : null;

  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleModalConfirm = (
    item: MenuItem,
    storeName: string,
    storeType: StoreType,
    options: string,
    qty: number
  ) => {
    onAddToCart({
      storeName,
      type: storeType,
      itemName: item.itemName,
      price: item.price,
      options,
      qty,
    });
  };

  const togglePinSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const togglePinMenuItem = (storeName: string, itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${storeName}_${itemName}`;
    setPinnedMenuItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePinOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedOrderIds((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Sort open sessions with pinned ones at top
  const sortedOpenSessions = [...openSessions].sort((a, b) => {
    const aPinned = pinnedSessionIds.includes(a.sessionId);
    const bPinned = pinnedSessionIds.includes(b.sessionId);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 text-center mb-1">
              確定要取消刪除此筆訂單嗎？
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              確認刪除後將由系統自訂單清單移除，並於有連結 LINE Notify 時同步推播取消訊息。
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-200/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">訂購人員：</span>
                <span className="font-bold text-slate-900">{orderToDelete.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">店家品項：</span>
                <span className="font-bold text-slate-900">[{orderToDelete.storeName}] {orderToDelete.itemName}</span>
              </div>
              {orderToDelete.options && orderToDelete.options !== '-' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">客製規格：</span>
                  <span className="text-slate-700">{orderToDelete.options}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">數量與金額：</span>
                <span className="font-black text-red-600">{orderToDelete.qty} 份 (${orderToDelete.subtotal})</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                保留訂單
              </button>
              <button
                onClick={() => {
                  const targetId = orderToDelete.orderId;
                  setOrderToDelete(null);
                  onDeleteOrder(targetId);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-red-500/20 transition-all hover:scale-102"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Ongoing Sessions Switcher Bar (Hidden in single session / copied link mode) */}
      {!isSingleSessionMode && sortedOpenSessions.length > 1 && (
        <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-xs">
          <div className="text-xs font-extrabold text-slate-800 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              目前有 {sortedOpenSessions.length} 個同時上線的團購活動，點選下方切換（可點按 📌 置頂）：
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {sortedOpenSessions.map((s, idx) => {
              const isSelected = session.sessionId === s.sessionId;
              const isPinned = pinnedSessionIds.includes(s.sessionId);
              const sessionTitle = s.title || `${s.organizerName} 的團購`;
              return (
                <div
                  key={s.sessionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectSession?.(s.sessionId)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectSession?.(s.sessionId)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative group cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/30'
                      : isPinned
                      ? 'bg-amber-50/80 text-slate-800 border-amber-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <div className="font-extrabold text-sm truncate">
                      {isPinned && <span className="mr-1 text-amber-500">📌</span>}
                      團購 {idx + 1}：{sessionTitle}
                    </div>
                    <button
                      onClick={(e) => togglePinSession(s.sessionId, e)}
                      className={`p-1 rounded-md transition-colors ${
                        isSelected
                          ? 'hover:bg-blue-500 text-blue-100'
                          : isPinned
                          ? 'text-amber-600 hover:bg-amber-100'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isPinned ? '取消活動置頂' : '置頂此團購活動'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-500 text-amber-600' : ''}`} />
                    </button>
                  </div>
                  <div className={`text-xs flex items-center justify-between ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    <span>👤 {s.organizerName}</span>
                    <span className="font-bold">⏰ {s.date} {s.deadline} 截止</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terminated Session Alert Banner */}
      {isClosed && (
        <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-3xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-black flex-shrink-0 shadow-2xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-red-900 flex items-center gap-2">
                🛑 本團購活動已終止結單 (目前停止接受加訂)
              </h3>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed font-medium">
                承辦人已終止此團購點餐活動。系統已停止接受選購加點與送出訂單。如需繼續訂購，請聯繫承辦人重新開放此團購。
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToAdmin}
            className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs whitespace-nowrap shadow-sm transition-all hover:scale-[1.02] flex items-center gap-1.5 self-end sm:self-center"
          >
            <span>前往承辦控制頁 / 重新開放</span>
          </button>
        </div>
      )}

      {/* Session Active Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              {isClosed ? (
                <span className="bg-red-500/30 text-red-200 border border-red-400/40 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  🔒 團購已終止結單
                </span>
              ) : (
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  今日團購中
                </span>
              )}
              <span className="bg-slate-800/80 text-slate-300 text-xs font-medium px-3 py-1 rounded-full border border-slate-700">
                {session.date}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white">
              {session.title || '辦公室團購合購平台'}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <span>承辦人：<strong className="text-white">{session.organizerName}</strong></span>
              </div>
              {session.bentoStore && session.bentoStore !== '-' && (
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>便當：<strong className="text-amber-200">{session.bentoStore}</strong></span>
                </div>
              )}
              {session.drinkStore && session.drinkStore !== '-' && (
                <div className="flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-cyan-400" />
                  <span>飲料：<strong className="text-cyan-200">{session.drinkStore}</strong></span>
                </div>
              )}
              {session.goodsStore && session.goodsStore !== '-' && (
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                  <span>團購特賣：<strong className="text-indigo-200">{session.goodsStore}</strong></span>
                </div>
              )}
            </div>
            {session.note && (
              <div className="mt-3 bg-white/10 backdrop-blur-xs rounded-xl p-3 text-xs text-blue-100 flex items-start gap-2 max-w-xl border border-white/10">
                <Info className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <span>{session.note}</span>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center min-w-[180px]">
            <div className="text-xs text-blue-200 font-medium flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-amber-300" />
              團購截止日期與時間
            </div>
            <div className="text-xs font-extrabold text-blue-100 mb-0.5">
              {session.date}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wider">
              {session.deadline}
            </div>
          </div>
        </div>
      </div>

      {/* Price Change Disclaimer Warning Box */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-amber-950 text-sm block mb-0.5">
            ⚠️ 團購商品規格與價格異動注意事項
          </strong>
          最近物價與商家規格調整頻繁，請在訂購時留意品項與選項；<strong>提醒訂購人：最終訂購品項、規格與應付總金額，均以店家出貨當日價格與承辦人最後通知為準！</strong>
        </div>
      </div>

      {/* Main Grid: Left Side Menus, Right Side Shopping Cart & Live Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Menus Section (8 cols on large screens) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bento Menu */}
          {bentoVendor ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{bentoVendor.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>主餐與便當選擇 ({bentoVendor.items.length} 個品項)</span>
                      {bentoVendor.phone && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          電話: {bentoVendor.phone}
                        </span>
                      )}
                      {bentoVendor.address && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-red-500" />
                          地址: {bentoVendor.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-200 self-start sm:self-center">
                  便當店家
                </span>
              </div>

              {/* Items Grid with Pinning Support */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...bentoVendor.items]
                  .sort((a, b) => {
                    const isPinnedA = pinnedMenuItems[`${bentoVendor.name}_${a.itemName}`];
                    const isPinnedB = pinnedMenuItems[`${bentoVendor.name}_${b.itemName}`];
                    if (isPinnedA && !isPinnedB) return -1;
                    if (!isPinnedA && isPinnedB) return 1;
                    return 0;
                  })
                  .map((item, idx) => {
                    const hasSizes = item.sizes && item.sizes.length > 0;
                    const itemKey = `${bentoVendor.name}_${item.itemName}`;
                    const isPinned = pinnedMenuItems[itemKey];

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group shadow-2xs hover:shadow-sm space-y-2.5 relative ${
                          isPinned
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                            : 'border-slate-200/80 hover:border-amber-400 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0 pr-6">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex-shrink-0">
                                {item.category}
                              </span>
                              <span className="font-bold text-slate-900 text-sm truncate" title={item.itemName}>
                                {item.itemName}
                              </span>
                            </div>
                            <div className="text-amber-600 font-black text-sm flex-shrink-0">
                              ${item.price}
                            </div>
                          </div>

                          {/* Display outer specs / size options if present */}
                          {hasSizes ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400">規格：</span>
                              {item.sizes!.map((sz, szIdx) => (
                                <span
                                  key={szIdx}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs"
                                >
                                  <span>{sz.name}</span>
                                  <span className="text-amber-600 font-extrabold">${sz.price}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">標準特餐規格 / NT${item.price}</div>
                          )}
                        </div>

                        {/* Top-Right Pin Button */}
                        <button
                          onClick={(e) => togglePinMenuItem(bentoVendor.name, item.itemName, e)}
                          className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-all ${
                            isPinned
                              ? 'bg-amber-200 text-amber-800 shadow-xs'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200/60'
                          }`}
                          title={isPinned ? '取消品項置頂' : '將此品項置頂到最前'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-700' : ''}`} />
                        </button>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/60">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isPinned ? '📌 常點置頂項目' : '現點現做便當'}
                          </span>
                          <button
                            onClick={() => {
                              if (isClosed) return alert('本團購活動已終止結單，無法再新增餐點！');
                              setModalItem({ item, storeName: bentoVendor.name, storeType: '便當' });
                            }}
                            disabled={isClosed}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 shadow-xs ${
                              isClosed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isClosed ? '已結單' : '加購物車'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-500 text-sm border border-slate-200">
              今日無設定便當店家
            </div>
          )}

          {/* Goods / General Group Buy Store Menu */}
          {goodsVendor && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{goodsVendor.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>團購商品與生活特賣 ({goodsVendor.items.length} 個品項)</span>
                      {goodsVendor.phone && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          電話: {goodsVendor.phone}
                        </span>
                      )}
                      {goodsVendor.address && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-red-500" />
                          地址: {goodsVendor.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-indigo-200 self-start sm:self-center">
                  團購商品
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...goodsVendor.items]
                  .sort((a, b) => {
                    const isPinnedA = pinnedMenuItems[`${goodsVendor.name}_${a.itemName}`];
                    const isPinnedB = pinnedMenuItems[`${goodsVendor.name}_${b.itemName}`];
                    if (isPinnedA && !isPinnedB) return -1;
                    if (!isPinnedA && isPinnedB) return 1;
                    return 0;
                  })
                  .map((item, idx) => {
                    const hasSizes = item.sizes && item.sizes.length > 0;
                    const itemKey = `${goodsVendor.name}_${item.itemName}`;
                    const isPinned = pinnedMenuItems[itemKey];

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group shadow-2xs hover:shadow-sm space-y-2.5 relative ${
                          isPinned
                            ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300'
                            : 'border-slate-200/80 hover:border-indigo-400 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0 pr-6">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 flex-shrink-0">
                                {item.category}
                              </span>
                              <span className="font-bold text-slate-900 text-sm truncate" title={item.itemName}>
                                {item.itemName}
                              </span>
                            </div>
                            <div className="text-indigo-700 font-black text-sm flex-shrink-0">
                              ${item.price}
                            </div>
                          </div>

                          {/* Display outer specs / sizes if present */}
                          {hasSizes ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400">規格：</span>
                              {item.sizes!.map((sz, szIdx) => (
                                <span
                                  key={szIdx}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs"
                                >
                                  <span>{sz.name}</span>
                                  <span className="text-indigo-600 font-extrabold">${sz.price}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">團購特惠規格 / NT${item.price}</div>
                          )}
                        </div>

                        {/* Top-Right Pin Button */}
                        <button
                          onClick={(e) => togglePinMenuItem(goodsVendor.name, item.itemName, e)}
                          className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-all ${
                            isPinned
                              ? 'bg-indigo-200 text-indigo-800 shadow-xs'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200/60'
                          }`}
                          title={isPinned ? '取消品項置頂' : '將此品項置頂到最前'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-indigo-700' : ''}`} />
                        </button>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/60">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isPinned ? '📌 常點置頂項目' : '團購限時特價'}
                          </span>
                          <button
                            onClick={() => {
                              if (isClosed) return alert('本團購活動已終止結單，無法再新增餐點！');
                              setModalItem({ item, storeName: goodsVendor.name, storeType: '團購商品' });
                            }}
                            disabled={isClosed}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 shadow-xs ${
                              isClosed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isClosed ? '已結單' : '加購物車'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {drinkVendor ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{drinkVendor.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>冷熱飲與甜度冰塊客製化 ({drinkVendor.items.length} 個品項)</span>
                      {drinkVendor.phone && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          電話: {drinkVendor.phone}
                        </span>
                      )}
                      {drinkVendor.address && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-red-500" />
                          地址: {drinkVendor.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="bg-cyan-50 text-cyan-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-cyan-200 self-start sm:self-center">
                  飲料店家
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...drinkVendor.items]
                  .sort((a, b) => {
                    const isPinnedA = pinnedMenuItems[`${drinkVendor.name}_${a.itemName}`];
                    const isPinnedB = pinnedMenuItems[`${drinkVendor.name}_${b.itemName}`];
                    if (isPinnedA && !isPinnedB) return -1;
                    if (!isPinnedA && isPinnedB) return 1;
                    return 0;
                  })
                  .map((item, idx) => {
                    const hasSizes = item.sizes && item.sizes.length > 0;
                    const itemKey = `${drinkVendor.name}_${item.itemName}`;
                    const isPinned = pinnedMenuItems[itemKey];

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group shadow-2xs hover:shadow-sm space-y-2.5 relative ${
                          isPinned
                            ? 'bg-cyan-50/70 border-cyan-300 ring-1 ring-cyan-300'
                            : 'border-slate-200/80 hover:border-cyan-400 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0 pr-6">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 flex-shrink-0">
                                {item.category}
                              </span>
                              <span className="font-bold text-slate-900 text-sm truncate" title={item.itemName}>
                                {item.itemName}
                              </span>
                            </div>
                            <div className="text-cyan-700 font-black text-sm flex-shrink-0">
                              {hasSizes
                                ? `$${Math.min(...item.sizes!.map((s) => s.price))} ~ $${Math.max(...item.sizes!.map((s) => s.price))}`
                                : `$${item.price}`}
                            </div>
                          </div>

                          {/* Size Options & Prices displayed clearly on outside */}
                          {hasSizes ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400">容量價格：</span>
                              {item.sizes!.map((sz, szIdx) => (
                                <span
                                  key={szIdx}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs"
                                >
                                  <span>{sz.name}</span>
                                  <span className="text-cyan-700 font-extrabold">${sz.price}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-cyan-100">
                                🧊 冰熱可調 / 🍬 甜度客製
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Top-Right Pin Button */}
                        <button
                          onClick={(e) => togglePinMenuItem(drinkVendor.name, item.itemName, e)}
                          className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-all ${
                            isPinned
                              ? 'bg-cyan-200 text-cyan-800 shadow-xs'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200/60'
                          }`}
                          title={isPinned ? '取消品項置頂' : '將此品項置頂到最前'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-cyan-700' : ''}`} />
                        </button>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/60">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isPinned ? '📌 常點置頂項目' : hasSizes ? `${item.sizes!.length} 種容量可選` : '客製甜度冰塊'}
                          </span>
                          <button
                            onClick={() => {
                              if (isClosed) return alert('本團購活動已終止結單，無法再新增餐點！');
                              setModalItem({ item, storeName: drinkVendor.name, storeType: '飲料' });
                            }}
                            disabled={isClosed}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 shadow-xs ${
                              isClosed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-cyan-600 text-white hover:bg-cyan-700'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isClosed ? '已結單' : '選甜度冰塊'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-500 text-sm border border-slate-200">
              今日無設定飲料店家
            </div>
          )}

          {/* Real-time Session Orders Feed */}
          {(() => {
            const ordererTotals: Record<string, number> = {};
            sessionOrders.forEach((o) => {
              ordererTotals[o.userName] = (ordererTotals[o.userName] || 0) + o.subtotal;
            });

            // Advanced sorting: 1. Manually pinned orders, 2. My orders (if enabled), 3. Name sort
            const sortedSessionOrders = [...sessionOrders].sort((a, b) => {
              const pinnedA = Boolean(pinnedOrderIds[a.orderId]);
              const pinnedB = Boolean(pinnedOrderIds[b.orderId]);
              if (pinnedA && !pinnedB) return -1;
              if (!pinnedA && pinnedB) return 1;

              if (pinMyOrders && userName) {
                const cleanUser = userName.trim().split(' ')[0].split('(')[0].trim();
                const isOwnA = a.userName.includes(cleanUser);
                const isOwnB = b.userName.includes(cleanUser);
                if (isOwnA && !isOwnB) return -1;
                if (!isOwnA && isOwnB) return 1;
              }

              if (sortAsc === true) {
                return a.userName.localeCompare(b.userName, 'zh-TW');
              }
              if (sortAsc === false) {
                return b.userName.localeCompare(a.userName, 'zh-TW');
              }
              return 0;
            });

            return (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900">今日同仁累積訂購清單 ({sessionOrders.length} 筆)</h3>
                  </div>

                  {/* Pinning and Admin Controls */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={pinMyOrders}
                        onChange={(e) => setPinMyOrders(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>📌 我的訂單置頂</span>
                    </label>

                    <label className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowDeleteAll}
                        onChange={(e) => setAllowDeleteAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>🔓 代理刪除模式</span>
                    </label>
                  </div>
                </div>

                {sessionOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    目前尚無同仁送出訂單，快搶頭香第一個點餐吧！
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-2 font-semibold w-8 text-center">置頂</th>
                          <th
                            onClick={() =>
                              setSortAsc((prev) => (prev === true ? false : prev === false ? null : true))
                            }
                            className="pb-2 font-semibold cursor-pointer hover:text-blue-600 select-none flex items-center gap-1"
                            title="點擊依訂購人姓名排序"
                          >
                            訂購人 {sortAsc === true ? '▲ (升冪)' : sortAsc === false ? '▼ (降冪)' : '⇅ (可排序)'}
                          </th>
                          <th className="pb-2 font-semibold">店家</th>
                          <th className="pb-2 font-semibold">品項與客製化規格</th>
                          <th className="pb-2 font-semibold text-center">數量</th>
                          <th className="pb-2 font-semibold text-right">單筆小計</th>
                          <th className="pb-2 font-semibold text-right text-blue-700">訂購人累計</th>
                          <th className="pb-2 font-semibold text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedSessionOrders.map((order) => {
                          const cleanOrderUser = order.userName.split(' ')[0].split('(')[0].trim();
                          const cleanCurrentUser = userName.trim().split(' ')[0].split('(')[0].trim();
                          const isOwn = Boolean(
                            userName && (
                              order.userName === userName ||
                              (cleanCurrentUser && cleanOrderUser === cleanCurrentUser) ||
                              order.userName.startsWith(userName)
                            )
                          );
                          const isOrderPinned = Boolean(pinnedOrderIds[order.orderId]);
                          const canDelete = isOwn || allowDeleteAll;

                          return (
                            <tr
                              key={order.orderId}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isOrderPinned
                                  ? 'bg-amber-50/90 font-medium'
                                  : isOwn
                                  ? 'bg-blue-50/40 font-medium'
                                  : ''
                              }`}
                            >
                              <td className="py-2.5 text-center">
                                <button
                                  onClick={(e) => togglePinOrder(order.orderId, e)}
                                  className={`p-1 rounded transition-colors ${
                                    isOrderPinned
                                      ? 'text-amber-600 hover:bg-amber-200/70'
                                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                                  }`}
                                  title={isOrderPinned ? '取消表格列置頂' : '置頂此列到最上方'}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${isOrderPinned ? 'fill-amber-600' : ''}`} />
                                </button>
                              </td>
                              <td className="py-2.5 font-bold text-slate-900">
                                <div className="flex items-center gap-1">
                                  <span>{order.userName}</span>
                                  {isOwn && (
                                    <span className="ml-0.5 text-[10px] text-blue-600 bg-blue-100 px-1 rounded font-bold">
                                      我
                                    </span>
                                  )}
                                  {isOrderPinned && (
                                    <span className="ml-0.5 text-[10px] text-amber-700 bg-amber-100 px-1 rounded font-bold">
                                      📌 置頂
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 text-slate-600">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    order.type === '飲料'
                                      ? 'bg-cyan-100 text-cyan-800'
                                      : order.type === '團購商品'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {order.storeName}
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-800">
                                <div className="font-bold">{order.itemName}</div>
                                {order.options && order.options !== '-' && (
                                  <div className="text-[11px] text-slate-500">{order.options}</div>
                                )}
                              </td>
                              <td className="py-2.5 text-center font-bold text-slate-700">{order.qty}</td>
                              <td className="py-2.5 text-right font-extrabold text-slate-900">${order.subtotal}</td>
                              <td className="py-2.5 text-right font-black text-blue-600">
                                ${ordererTotals[order.userName] || order.subtotal}
                              </td>
                              <td className="py-2.5 text-right">
                                {canDelete ? (
                                  <button
                                    onClick={() => setOrderToDelete(order)}
                                    className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors font-bold flex items-center gap-1 ml-auto"
                                    title="取消此筆訂單"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="text-[11px]">刪除</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Shopping Cart Drawer / Sidebar (4 cols on large screens) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md sticky top-20">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-lg">您的購物車</h3>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {cart.reduce((sum, i) => sum + i.qty, 0)} 個項目
              </span>
            </div>

            {/* User prompt alert if name not set */}
            {!userName && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 flex items-center justify-between">
                <span>尚未點選設定訂購姓名</span>
                <button
                  onClick={onRequestSetName}
                  className="font-bold underline hover:text-amber-900"
                >
                  立刻設定
                </button>
              </div>
            )}

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                購物車目前是空的<br />
                請點選左側菜單新增餐點！
              </div>
            ) : (
              <div className="space-y-3 mb-6 max-h-[380px] overflow-y-auto pr-1">
                {cart.map((item, index) => (
                  <div key={index} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 relative group">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded mr-1">
                          {item.storeName}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{item.itemName}</span>
                        {item.options && (
                          <div className="text-xs text-slate-500 mt-0.5">{item.options}</div>
                        )}
                        <div className="text-xs font-bold text-blue-600 mt-1">${item.price}</div>
                      </div>
                      <button
                        onClick={() => onRemoveFromCart(index)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Adjustment Bar */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/50">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onUpdateCartQty(index, item.qty - 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-800 w-6 text-center">{item.qty}</span>
                        <button
                          onClick={() => onUpdateCartQty(index, item.qty + 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                      <div className="font-extrabold text-slate-900 text-sm">${item.price * item.qty}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total & Submit Button */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="flex items-center justify-between text-slate-900">
                <span className="text-sm font-bold">總金額</span>
                <span className="text-2xl font-black text-red-600">${totalCartPrice}</span>
              </div>

              {/* Expiration or Closed Warning Banner above button */}
              {isExpired && !isClosed && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2 font-bold animate-pulse">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>⚠️ 本活動已於 {session.deadline} 截止，已停止收單！</span>
                </div>
              )}
              {isClosed && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>🛑 承辦人已結單關閉本活動，無法再新增餐點。</span>
                </div>
              )}

              <button
                onClick={onSubmitOrder}
                disabled={cart.length === 0 || isSubmitting || isOrderingDisabled}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01]"
              >
                {isSubmitting ? (
                  <span>訂單送出中...</span>
                ) : isClosed ? (
                  <span>🛑 承辦人已終止結單 (停止收單)</span>
                ) : isExpired ? (
                  <span>🚫 已過截止時間 ({session.deadline}) 停止收單</span>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    確認送出訂單 (${totalCartPrice})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      {modalItem && (
        <AddToCartModal
          isOpen={!!modalItem}
          onClose={() => setModalItem(null)}
          item={modalItem.item}
          storeName={modalItem.storeName}
          storeType={modalItem.storeType}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
};
