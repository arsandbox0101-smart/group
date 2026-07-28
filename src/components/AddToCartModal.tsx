import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Coffee, Utensils, Check, Layers } from 'lucide-react';
import { MenuItem, StoreType, SizeOption } from '../types';

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null;
  storeName: string;
  storeType: StoreType;
  onConfirm: (item: MenuItem, storeName: string, storeType: StoreType, options: string, qty: number) => void;
}

const SWEETNESS_OPTIONS = ['無糖 0%', '微糖 30%', '半糖 50%', '少糖 70%', '正常糖 100%'];
const ICE_OPTIONS = ['去冰', '微冰', '少冰', '正常冰', '溫熱'];
const BENTO_QUICK_TAGS = ['加辣', '微辣', '飯少', '不加香菜', '醬汁分開', '白飯更換五穀米'];

export const AddToCartModal: React.FC<AddToCartModalProps> = ({
  isOpen,
  onClose,
  item,
  storeName,
  storeType,
  onConfirm,
}) => {
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<SizeOption | null>(null);
  const [selectedSweetness, setSelectedSweetness] = useState('微糖 30%');
  const [selectedIce, setSelectedIce] = useState('微冰');
  const [customNote, setCustomNote] = useState('');
  const [selectedBentoTags, setSelectedBentoTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && item) {
      setQty(1);
      setSelectedSweetness('微糖 30%');
      setSelectedIce('微冰');
      setCustomNote('');
      setSelectedBentoTags([]);
      if (item.sizes && item.sizes.length > 0) {
        setSelectedSize(item.sizes[0]);
      } else {
        setSelectedSize(null);
      }
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const currentPrice = selectedSize ? selectedSize.price : item.price;

  const toggleBentoTag = (tag: string) => {
    if (selectedBentoTags.includes(tag)) {
      setSelectedBentoTags(selectedBentoTags.filter((t) => t !== tag));
    } else {
      setSelectedBentoTags([...selectedBentoTags, tag]);
    }
  };

  const handleConfirm = () => {
    let finalOptionText = '';

    const sizePrefix = selectedSize ? `【${selectedSize.name}】 ` : '';

    if (storeType === '飲料') {
      finalOptionText = `${sizePrefix}${selectedSweetness} / ${selectedIce}`;
      if (customNote.trim()) {
        finalOptionText += ` (${customNote.trim()})`;
      }
    } else {
      const tagsStr = selectedBentoTags.join(', ');
      if (sizePrefix && tagsStr && customNote.trim()) {
        finalOptionText = `${sizePrefix}${tagsStr} - ${customNote.trim()}`;
      } else if (sizePrefix && tagsStr) {
        finalOptionText = `${sizePrefix}${tagsStr}`;
      } else if (sizePrefix && customNote.trim()) {
        finalOptionText = `${sizePrefix}${customNote.trim()}`;
      } else if (sizePrefix) {
        finalOptionText = `${selectedSize?.name}`;
      } else if (tagsStr && customNote.trim()) {
        finalOptionText = `${tagsStr} - ${customNote.trim()}`;
      } else if (tagsStr) {
        finalOptionText = tagsStr;
      } else if (customNote.trim()) {
        finalOptionText = customNote.trim();
      } else {
        finalOptionText = '無特別備註';
      }
    }

    const modifiedItem: MenuItem = {
      ...item,
      price: currentPrice,
    };

    onConfirm(modifiedItem, storeName, storeType, finalOptionText, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between relative">
          <div className="pr-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {storeName}
              </span>
              <span className="text-xs text-slate-400">{item.category}</span>
            </div>
            <h3 className="text-xl font-bold text-white">{item.itemName}</h3>
            <div className="text-amber-400 font-bold text-lg mt-1">${currentPrice}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Size / Specification Selector if available */}
          {item.sizes && item.sizes.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5">
              <label className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                容量 / 尺寸規格選擇
              </label>
              <div className="flex flex-wrap gap-2">
                {item.sizes.map((sOption, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSize(sOption)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      selectedSize?.name === sOption.name
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-[1.02]'
                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    {sOption.name} (${sOption.price})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              數量
            </label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-lg"
              >
                -
              </button>
              <span className="font-bold text-slate-900 text-lg w-12 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Drink Sweetness & Ice Options */}
          {storeType === '飲料' ? (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-blue-600" />
                  甜度選擇
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {SWEETNESS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedSweetness(opt)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                        selectedSweetness === opt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-cyan-600" />
                  冰塊選擇
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {ICE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedIce(opt)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                        selectedIce === opt
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Bento Options */
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-600" />
                常用偏好客製化
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {BENTO_QUICK_TAGS.map((tag) => {
                  const isSelected = selectedBentoTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleBentoTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Note */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              其他特殊備註 (選填)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={storeType === '飲料' ? '例如：加珍珠 / 加椰果' : '例如：飯要淋少許肉汁'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">小計總額</div>
            <div className="text-xl font-extrabold text-red-600">${currentPrice * qty}</div>
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
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <ShoppingBag className="w-4 h-4" />
              加入購物車 (${currentPrice * qty})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
