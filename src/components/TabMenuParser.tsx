import React, { useState } from 'react';
import {
  FileCode,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Store,
  ChevronDown,
  ChevronUp,
  Search,
  Camera,
  Image as ImageIcon,
  Loader2,
  Edit3,
  Layers,
  HelpCircle,
  Phone,
  MapPin,
  Building2,
  Filter
} from 'lucide-react';
import { Vendor, StoreType, MenuItem } from '../types';
import { VendorEditModal } from './VendorEditModal';
import { extractStoreMetadataAndItems } from '../utils/menuParser';

interface TabMenuParserProps {
  vendors: Record<string, Vendor>;
  onParseAndSaveMenu: (
    storeName: string,
    storeType: StoreType,
    rawText: string,
    phone?: string,
    address?: string,
    city?: string
  ) => Promise<boolean>;
  onUpdateVendor: (
    originalName: string,
    name: string,
    type: StoreType,
    items: MenuItem[],
    phone?: string,
    address?: string,
    city?: string
  ) => Promise<boolean>;
  onDeleteVendor: (storeName: string) => void;
  isProcessing: boolean;
}

const SAMPLE_TEMPLATES = [
  {
    name: '辦公室團購零食特賣',
    type: '團購商品' as StoreType,
    city: '台北市',
    text: `團購零食,日式綜合堅果大禮包 (300g),199,買一送一優惠組:350|單包試吃裝:199
團購零食,韓國香濃起司夾心餅 (12入/盒),140
生活用品,三層柔柔抽取式衛生紙 (12包/串),159
辦公室美食,微熱山丘鳳梨酥 (10入盒裝),450
團購飲品,冷萃精品無糖咖啡豆 (250g),280`,
  },
  {
    name: '鬍鬚張魯肉飯',
    type: '便當' as StoreType,
    city: '台北市',
    text: `主餐,招牌魯肉飯便當,105,小份:95|大份:115
主餐,雞肉飯便當,105
主餐,黃金炸豬排便當,120
主餐,唐揚雞腿便當,130
小菜,香菇貢丸湯,45
小菜,燙青菜,45`,
  },
  {
    name: '珍煮丹',
    type: '飲料' as StoreType,
    city: '台北市',
    text: `黑糖系列,黑糖珍珠鮮奶,75,中杯:65|大杯:75
黑糖系列,黑糖仙草鮮奶,70,中杯:60|大杯:70
茶飲,泰泰鮮奶茶,65,中杯:55|大杯:65
茶飲,不知春青茶,35,中杯:30|大杯:35
特調,蜂蜜檸檬菊普,60,中杯:50|大杯:60`,
  },
  {
    name: '麥當勞',
    type: '其他' as StoreType,
    city: '台北市',
    text: `超值全餐,大麥克套餐,145
超值全餐,麥克鷄塊6塊套餐,135
超值全餐,勁辣鷄腿堡套餐,155
單點,大薯條,66
單點,蛋捲冰淇淋,18`,
  },
];

const CITIES_LIST = [
  '台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '台南市',
  '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣'
];

export const TabMenuParser: React.FC<TabMenuParserProps> = ({
  vendors,
  onParseAndSaveMenu,
  onUpdateVendor,
  onDeleteVendor,
  isProcessing,
}) => {
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('便當');
  const [storeCity, setStoreCity] = useState('台北市');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [rawText, setRawText] = useState('');
  const [previewItems, setPreviewItems] = useState<MenuItem[]>([]);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 2-level filters for existing menu database
  const [selectedCity, setSelectedCity] = useState<string>('全部');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');

  // Image Upload AI Vision state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParsingMsg, setImageParsingMsg] = useState<string | null>(null);

  // Vendor Editor Modal state
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorToDeleteName, setVendorToDeleteName] = useState<string | null>(null);

  // File Input Ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getVendorCity = (v: Vendor): string => {
    if (v.city && v.city.trim()) return v.city.trim();
    if (v.address) {
      const matched = v.address.match(/(台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|台南市|高雄市|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);
      if (matched) return matched[1];
    }
    return '台北市';
  };

  // Get available cities present in vendors
  const availableCities = Array.from(
    new Set((Object.values(vendors) as Vendor[]).map((v) => getVendorCity(v)))
  ).filter(Boolean).sort();

  const handleApplySample = (template: typeof SAMPLE_TEMPLATES[0]) => {
    setStoreName(template.name);
    setStoreType(template.type);
    if (template.city) setStoreCity(template.city);
    setRawText(template.text);
  };

  // Auto-parse preview & auto-extract store metadata on rawText change
  React.useEffect(() => {
    if (!rawText.trim()) {
      setPreviewItems([]);
      return;
    }

    const extracted = extractStoreMetadataAndItems(rawText);

    if (extracted.storeName) {
      setStoreName(extracted.storeName);
    }
    if (extracted.storeType) {
      setStoreType(extracted.storeType);
    }
    if (extracted.storeCity) {
      setStoreCity(extracted.storeCity);
    }
    if (extracted.storePhone) {
      setStorePhone(extracted.storePhone);
    }
    if (extracted.storeAddress) {
      setStoreAddress(extracted.storeAddress);
    }

    setPreviewItems(extracted.items);
  }, [rawText]);

  // Image file select handler with Canvas compression
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片檔案 (JPEG, PNG, WEBP等)');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600; // max width or height
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(compressedBase64);
          } else {
            setImagePreview(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      setImageParsingMsg(null);
    }
  };

  // Execute Gemini AI Multimodal Vision Parsing
  const handleParseMenuImage = async () => {
    if (!imagePreview) {
      alert('請先選擇或拍攝菜單圖片！');
      return;
    }

    setIsParsingImage(true);
    setImageParsingMsg('🤖 Gemini AI 現正分析圖片菜單，請稍候...');

    try {
      const res = await fetch('/api/parse-menu-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imagePreview }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.storeName) setStoreName(data.storeName);
        if (data.storeType) setStoreType(data.storeType);
        if (data.storePhone) setStorePhone(data.storePhone);
        if (data.storeAddress) {
          setStoreAddress(data.storeAddress);
          const cityMatch = data.storeAddress.match(/(台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|台南市|高雄市|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);
          if (cityMatch) setStoreCity(cityMatch[1]);
        }
        if (data.storeCity) setStoreCity(data.storeCity);
        if (data.formattedText) setRawText(data.formattedText);

        const sourceLabel = data.aiSource || 'Gemini AI Vision';
        const count = data.items?.length || 0;
        const phoneAddrInfo = [];
        if (data.storePhone) phoneAddrInfo.push(`電話: ${data.storePhone}`);
        if (data.storeAddress) phoneAddrInfo.push(`地址: ${data.storeAddress}`);
        const extraText = phoneAddrInfo.length > 0 ? ` [包含${phoneAddrInfo.join(' | ')}]` : '';
        setImageParsingMsg(`✨ 【${sourceLabel}】辨識成功！自動擷取 ${count} 個餐點品項${extraText}，已寫入下方欄位與表格，可直接確認及微調。`);
      } else {
        alert(data.error || '圖片菜單解析失敗');
        setImageParsingMsg('解析失敗：' + (data.error || '請嘗試重新拍攝更清晰的菜單照片'));
      }
    } catch (err) {
      alert('網路連線發生錯誤');
      setImageParsingMsg('連線失敗，請檢查網路設定');
    } finally {
      setIsParsingImage(false);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageParsingMsg(null);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractStoreMetadataAndItems(rawText);
    const finalStoreName = storeName.trim() || extracted.storeName || '';
    const finalPhone = storePhone.trim() || extracted.storePhone || '';
    const finalAddress = storeAddress.trim() || extracted.storeAddress || '';
    const finalCity = storeCity.trim() || extracted.storeCity || '台北市';
    const cleanedText = extracted.cleanedRawText || rawText;

    if (!finalStoreName || (!cleanedText.trim() && previewItems.length === 0)) {
      alert('請填寫店家名稱與菜單文字');
      return;
    }

    const ok = await onParseAndSaveMenu(
      finalStoreName,
      storeType,
      cleanedText,
      finalPhone,
      finalAddress,
      finalCity
    );
    if (ok) {
      alert(`菜單匯入成功！已將 ${previewItems.length} 項餐點與店家聯絡資訊寫入資料庫`);
      setStoreName('');
      setStorePhone('');
      setStoreAddress('');
      setRawText('');
      setPreviewItems([]);
      handleClearImage();
    }
  };

  const filteredVendors = Object.values(vendors).filter((v: Vendor) => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
    const vCity = getVendorCity(v);
    const matchesCity = selectedCity === '全部' || vCity === selectedCity;

    let matchesCat = true;
    if (selectedCategory === '便當/主餐') matchesCat = v.type === '便當';
    else if (selectedCategory === '飲料/手搖飲') matchesCat = v.type === '飲料';
    else if (selectedCategory === '團購商品/生活雜貨') matchesCat = v.type === '團購商品';
    else if (selectedCategory === '甜點/點心') matchesCat = v.type === '甜點';
    else if (selectedCategory === '其他/輕食') matchesCat = v.type === '其他';

    return matchesSearch && matchesCity && matchesCat;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Menu Import & AI Image Parser (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">菜單圖片 AI 辨識 & 文字匯入</h2>
                <p className="text-xs text-slate-500">
                  可拍照/上傳菜單圖片自動辨識，或手動貼上文字解析寫入資料庫
                </p>
              </div>
            </div>

            {/* AI Image Upload & Vision Section */}
            <div className="mb-6 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/70 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  菜單圖片自動辨識 (Gemini AI Vision)
                </label>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  支援照片/紙本傳單/圖片檔
                </span>
              </div>

              {/* API Key Notice */}
              <div className="mb-3 text-[11px] bg-white/80 border border-blue-200/80 rounded-xl p-2.5 text-blue-900 leading-relaxed flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">不需要手動填寫 API Key！</strong> 本系統由後端自動連結 Gemini 3.6 Flash 多模態 AI Vision 進行影像與表格解析。若環境未設定金鑰，系統將自動啟動內建智慧圖像 OCR 備援，輕鬆匯入各式餐點與大中小杯價格。
                </div>
              </div>

              {/* Hidden file input with ref for reliable invocation */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300/80 hover:border-blue-500 rounded-xl p-6 text-center bg-white/70 hover:bg-white transition-all cursor-pointer relative group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    點擊選擇相片 / 上傳菜單圖片
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    支援 JPEG, PNG, WEBP 等格式
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 max-h-56 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="菜單照片預覽"
                      className="max-h-56 object-contain rounded-xl"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-900/80 hover:bg-slate-900 text-white px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="換一張照片"
                      >
                        <Camera className="w-3 h-3" />
                        重選照片
                      </button>
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-full text-xs font-bold transition-colors"
                        title="清除照片"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleParseMenuImage}
                    disabled={isParsingImage}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
                  >
                    {isParsingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Gemini AI 分析菜單圖片中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        執行 Gemini AI 辨識菜單圖片
                      </>
                    )}
                  </button>

                  {imageParsingMsg && (
                    <div className="p-2.5 rounded-xl bg-white/90 border border-blue-200 text-xs font-medium text-blue-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{imageParsingMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sample Templates quick picker */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  快速範例菜單載入
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplySample(tmpl)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 transition-all"
                  >
                    + 載入 {tmpl.name} ({tmpl.type})
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleImport} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    店家名稱
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="例如：正忠排骨飯"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800"
                    required
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 bg-white"
                  >
                    {CITIES_LIST.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    店家類型
                  </label>
                  <select
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value as StoreType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 bg-white"
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
                    placeholder="例如：02-23456789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800"
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
                    placeholder="例如：台北市大安區忠孝東路..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    菜單文字內容 (每行一筆)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    格式: <code className="bg-slate-100 px-1 rounded text-slate-700">分類,品項,基準價,規格1:價格1|規格2:價格2</code>
                  </span>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={6}
                  placeholder={`每列格式範例：\n主餐,正忠排骨飯,100\n茶飲,波霸奶茶,50,中杯:50|大杯:60\n甜點,豆花,40,小份:40|大份:50`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-mono text-slate-800"
                  required
                />
              </div>

              {/* Parsed Preview Table */}
              {previewItems.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      預覽解析成功 ({previewItems.length} 個品項)
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                    {previewItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <div>
                          <span className="text-slate-600">[{item.category}] <strong className="text-slate-900">{item.itemName}</strong></span>
                          {item.sizes && item.sizes.length > 0 && (
                            <div className="text-[10px] text-amber-700">
                              容量規格: {item.sizes.map((s) => `${s.name}:$${s.price}`).join(', ')}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-emerald-700">${item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing || previewItems.length === 0}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01]"
              >
                <Plus className="w-5 h-5" />
                自動解析並寫入菜單資料庫
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Existing Vendors List & Editor (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-lg">現有菜單資料庫 ({Object.keys(vendors).length})</h3>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋店家名稱..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Level 1: County/City Filter */}
            <div className="mb-3">
              <div className="text-[11px] font-extrabold text-slate-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                <Building2 className="w-3 h-3 text-indigo-600" />
                第一層：縣 / 市 篩選
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 border border-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedCity('全部')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedCity === '全部'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  全部縣市
                </button>
                {CITIES_LIST.map((city) => {
                  const hasVendors = (Object.values(vendors) as Vendor[]).some((v) => getVendorCity(v) === city);
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setSelectedCity(city)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                        selectedCity === city
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : hasVendors
                          ? 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                          : 'bg-white/60 text-slate-400 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level 2: Category Filter */}
            <div className="mb-4">
              <div className="text-[11px] font-extrabold text-slate-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                <Filter className="w-3 h-3 text-emerald-600" />
                第二層：店家類型細分類
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '全部', value: '全部' },
                  { label: '便當/主餐', value: '便當/主餐' },
                  { label: '飲料/手搖飲', value: '飲料/手搖飲' },
                  { label: '團購商品/生活雜貨', value: '團購商品/生活雜貨' },
                  { label: '甜點/點心', value: '甜點/點心' },
                  { label: '其他/輕食', value: '其他/輕食' },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedCategory === cat.value
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendors List Accordion */}
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredVendors.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  無符合的店家資料
                </div>
              ) : (
                filteredVendors.map((vendor: Vendor) => {
                  const isExpanded = expandedVendor === vendor.name;
                  return (
                    <div key={vendor.name} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
                      <div
                        onClick={() => setExpandedVendor(isExpanded ? null : vendor.name)}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              vendor.type === '飲料' ? 'bg-cyan-100 text-cyan-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {vendor.type}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{vendor.name}</span>
                            <span className="text-xs text-slate-400">({vendor.items.length} 品項)</span>
                          </div>
                          {(vendor.phone || vendor.address) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pl-0.5">
                              {vendor.phone && (
                                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  {vendor.phone}
                                </span>
                              )}
                              {vendor.address && (
                                <span className="flex items-center gap-1 text-slate-600 truncate max-w-[220px]" title={vendor.address}>
                                  <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                                  {vendor.address}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVendor(vendor);
                            }}
                            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                            title="編輯菜單與價格"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編輯菜單/價格
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVendorToDeleteName(vendor.name);
                            }}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                            title="刪除店家"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* Items List */}
                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-slate-200/60 divide-y divide-slate-100 text-xs">
                          {vendor.items.map((item, idx) => (
                            <div key={idx} className="py-2 flex justify-between items-start">
                              <div>
                                <span className="text-slate-700">[{item.category}] <strong className="text-slate-900">{item.itemName}</strong></span>
                                {item.sizes && item.sizes.length > 0 && (
                                  <div className="text-[10px] text-amber-700 flex flex-wrap gap-1 mt-0.5">
                                    {item.sizes.map((s, sIdx) => (
                                      <span key={sIdx} className="bg-amber-50 px-1 py-0.2 rounded border border-amber-200/80">
                                        {s.name}: ${s.price}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="font-extrabold text-blue-600 ml-2">${item.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Edit Modal */}
      {editingVendor && (
        <VendorEditModal
          isOpen={!!editingVendor}
          onClose={() => setEditingVendor(null)}
          vendor={editingVendor}
          onSave={onUpdateVendor}
        />
      )}

      {/* Vendor Delete Confirmation Modal */}
      {vendorToDeleteName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">
              確定要刪除「{vendorToDeleteName}」的菜單嗎？
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              刪除後該店家的所有餐點菜單將被完全移除。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVendorToDeleteName(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetName = vendorToDeleteName;
                  setVendorToDeleteName(null);
                  onDeleteVendor(targetName);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-500/20 transition-all"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
