import React, { useEffect, useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, Check, Laptop, Sparkles } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for Chrome/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">安裝「智慧團購」App 至桌面</h3>
              <p className="text-xs text-slate-500">免經 App Store / Google Play，一鍵釘選至手機/平板桌面</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {isStandalone || installed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-emerald-900 text-sm">🎉 系統已偵測到 App 執行模式！</h4>
              <p className="text-xs text-emerald-700 mt-1">
                您目前正以「桌面 App 獨立視窗」狀態順暢使用，享受極速全螢幕無網址列體驗！
              </p>
            </div>
          ) : deferredPrompt ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-base">您的裝置支援一鍵快速安裝！</h4>
                <p className="text-xs text-blue-700 mt-1">
                  點擊下方按鈕，系統將自動跳出提示，將「智慧團購」新增至您的手機或電腦桌面。
                </p>
              </div>
              <button
                onClick={handleInstallClick}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                🚀 立即一鍵安裝至桌面 App
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {isIOS ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-200 pb-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    iPhone / iPad (Safari 瀏覽器) 安裝步驟：
                  </div>
                  <ol className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                      <span>點擊畫面下方（或上方）的 Safari <strong>分享按鈕</strong> <Share className="w-3.5 h-3.5 inline text-blue-600" /></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                      <span>向上滑動選單，找到並點擊 <strong>「加入主畫面」</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-600" /></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                      <span>點擊右上角 <strong>「新增」</strong>，即可完成桌面獨立 App 建立！</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-200 pb-2">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    Android / Chrome / 平板 / 電腦 手動安裝步驟：
                  </div>
                  <ol className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                      <span>點擊瀏覽器右上角 <strong>「三點選單 (⋮)」</strong> 或網址列右側安裝圖示</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                      <span>點選 <strong>「新增至主螢幕」</strong> 或 <strong>「安裝 智慧團購」</strong></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                      <span>按下確定後，手機桌面上就會出現專屬「智慧團購」App 圖示囉！</span>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
            <span className="font-bold">💡 PWA 特色優勢：</span>
            <span>不需要安裝檔或儲存空間，開啟極快、無網址列、點開即可即時團購，資料即時同步！</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
