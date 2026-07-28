import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Layers, Edit3, Store, Phone, MapPin, Building2 } from 'lucide-react';
import { Vendor, StoreType, MenuItem, SizeOption } from '../types';

interface VendorEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  onSave: (
    originalName: string,
    name: string,
    type: StoreType,
    items: MenuItem[],
    phone?: string,
    address?: string,
    city?: string
  ) => Promise<boolean>;
}

export const VendorEditModal: React.FC<VendorEditModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onSave,
}) => {
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('便當');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('台北市');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSizesIndex, setEditingSizesIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && vendor) {
      setStoreName(vendor.name);
      setStoreType(vendor.type);
      setStorePhone(vendor.phone || '');
      setStoreAddress(vendor.address || '');
      setStoreCity(vendor.city || '台北市');
      // Deep clone items so edits don't mutate state directly before saving
      setItems(JSON.parse(JSON.stringify(vendor.items || [])));
      setEditingSizesIndex(null);
    }
  }, [isOpen, vendor]);

  if (!isOpen || !vendor) return null;

  const handleItemChange = (index: number, field: keyof MenuItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    const defaultCategory = items.length > 0 ? items[items.length - 1].category : '一般';
    setItems((prev) => [
      ...prev,
      { category: defaultCategory, itemName: '新餐點品項', price: 50 },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Size option handlers
  const handleAddSize = (itemIndex: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const targetItem = { ...copy[itemIndex] };
      const currentSizes = targetItem.sizes ? [...targetItem.sizes] : [];
      currentSizes.push({ name: '大杯', price: targetItem.price + 10 });
      targetItem.sizes = currentSizes;
      copy[itemIndex] = targetItem;
      return copy;
    });
  };

  const handleUpdateSize = (itemIndex: number, sizeIndex: number, field: keyof SizeOption, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const targetItem = { ...copy[itemIndex] };
      if (!targetItem.sizes) return prev;
      const sizesCopy = [...targetItem.sizes];
      sizesCopy[sizeIndex] = {
        ...sizesCopy[sizeIndex],
        [field]: field === 'price' ? parseFloat(val) || 0 : val,
      };
      targetItem.sizes = sizesCopy;
      copy[itemIndex] = targetItem;
      return copy;
    });
  };

  const handleDeleteSize = (itemIndex: number, sizeIndex: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const targetItem = { ...copy[itemIndex] };
      if (!targetItem.sizes) return prev;
      targetItem.sizes = targetItem.sizes.filter((_, sIdx) => sIdx !== sizeIndex);
      if (targetItem.sizes.length === 0) {
        delete targetItem.sizes;
      }
      copy[itemIndex] = targetItem;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      alert('店家名稱不能為空！');
      return;
    }
    if (items.length === 0) {
      alert('菜單至少需要包含一個品項！');
      return;
    }

    setIsSaving(true);
    const success = await onSave(
      vendor.name,
      storeName.trim(),
      storeType,
      items,
      storePhone.trim(),
      storeAddress.trim(),
      storeCity.trim()
    );
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">編輯店家菜單與聯絡資訊 (資料庫維護)</h3>
              <p className="text-xs text-slate-400">修改縣市、電話、地址、價格異動、新增容量尺寸規格或調整餐點內容</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Vendor Name, Type, City, Phone, Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-blue-600" />
                店家名稱
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                所在縣市
              </label>
              <select
                value={storeCity}
                onChange={(e) => setStoreCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="台北市">台北市</option>
                <option value="新北市">新北市</option>
                <option value="基隆市">基隆市</option>
                <option value="桃園市">桃園市</option>
                <option value="新竹市">新竹市</option>
                <option value="新竹縣">新竹縣</option>
                <option value="苗栗縣">苗栗縣</option>
                <option value="台中市">台中市</option>
                <option value="彰化縣">彰化縣</option>
                <option value="南投縣">南投縣</option>
                <option value="雲林縣">雲林縣</option>
                <option value="嘉義市">嘉義市</option>
                <option value="嘉義縣">嘉義縣</option>
                <option value="台南市">台南市</option>
                <option value="高雄市">高雄市</option>
                <option value="屏東縣">屏東縣</option>
                <option value="宜蘭縣">宜蘭縣</option>
                <option value="花蓮縣">花蓮縣</option>
                <option value="台東縣">台東縣</option>
                <option value="澎湖縣">澎湖縣</option>
                <option value="金門縣">金門縣</option>
                <option value="連江縣">連江縣</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                店家類型
              </label>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value as StoreType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="便當">便當 / 主餐</option>
                <option value="飲料">飲料 / 手搖飲</option>
                <option value="團購商品">團購商品 / 生活雜貨</option>
                <option value="甜點">甜點 / 點心</option>
                <option value="其他">其他 / 輕食</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                訂購電話
              </label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="例: 02-23456789"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                店家地址
              </label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="例: 台北市大安區忠孝東路四段..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>
          </div>

          {/* Items Table Editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                餐點品項與價格清單 ({items.length} 項)
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新增單品
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const isSizesOpen = editingSizesIndex === idx;
                return (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                          placeholder="分類"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                          placeholder="品項名稱"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full pl-5 pr-1.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-emerald-700 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => setEditingSizesIndex(isSizesOpen ? null : idx)}
                          className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            item.sizes && item.sizes.length > 0
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300'
                          }`}
                          title="設定容量與規格價格 (如大/中杯)"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span className="text-[10px]">
                            {item.sizes && item.sizes.length > 0 ? `${item.sizes.length} 規格` : '規格'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="刪除此品項"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Sizes Detail Editor Panel */}
                    {isSizesOpen && (
                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs space-y-2 mt-2">
                        <div className="flex items-center justify-between text-amber-900 font-bold">
                          <span>「{item.itemName}」 的容量與規格價格 (例如: 中杯/大杯、大份/小份)</span>
                          <button
                            type="button"
                            onClick={() => handleAddSize(idx)}
                            className="text-[11px] bg-amber-600 text-white px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 hover:bg-amber-700"
                          >
                            <Plus className="w-3 h-3" />
                            新增規格
                          </button>
                        </div>

                        {!item.sizes || item.sizes.length === 0 ? (
                          <div className="text-slate-500 text-[11px] py-1 italic">
                            尚無設定特定規格，預設使用單一基準價格 (${item.price})
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {item.sizes.map((sz, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={sz.name}
                                  onChange={(e) => handleUpdateSize(idx, sIdx, 'name', e.target.value)}
                                  placeholder="規格名稱 (如: 中杯/大杯)"
                                  className="px-2 py-1 rounded border border-amber-200 text-xs text-slate-800 bg-white font-medium flex-1"
                                />
                                <div className="relative w-24">
                                  <span className="absolute left-1.5 top-1 text-slate-400">$</span>
                                  <input
                                    type="number"
                                    value={sz.price}
                                    onChange={(e) => handleUpdateSize(idx, sIdx, 'price', e.target.value)}
                                    className="w-full pl-4 pr-1 py-1 rounded border border-amber-200 text-xs font-bold text-amber-900 bg-white"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSize(idx, sIdx)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            共 <strong className="text-slate-800">{items.length}</strong> 個餐點品項
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '儲存中...' : '儲存修改菜單'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
