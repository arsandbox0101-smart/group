import React, { useState } from 'react';
import { ShoppingBag, User, Edit3, Sparkles, Send, Bell, Check, HelpCircle, ExternalLink, Copy, Smartphone } from 'lucide-react';
import { PwaInstallModal } from './PwaInstallModal';

interface NavbarProps {
  userName: string;
  userDepartment?: string;
  userLineToken: string;
  onUpdateUserProfile: (name: string, department: string, lineToken: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasActiveSession: boolean;
  isSessionExpired?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  userName,
  userDepartment = '',
  userLineToken,
  onUpdateUserProfile,
  activeTab,
  setActiveTab,
  hasActiveSession,
  isSessionExpired = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [tempDept, setTempDept] = useState(userDepartment);
  const [tempToken, setTempToken] = useState(userLineToken);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [testMsg, setTestMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const handleOpenModal = () => {
    setTempName(userName);
    setTempDept(userDepartment);
    setTempToken(userLineToken);
    setTestMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateUserProfile(tempName.trim(), tempDept.trim(), tempToken.trim());
      setIsModalOpen(false);
    }
  };

  const handleTestToken = async () => {
    if (!tempToken.trim()) {
      setTestMsg({ success: false, text: '請先輸入個人 LINE / CE Notify Token' });
      return;
    }

    setIsTestingToken(true);
    setTestMsg(null);

    try {
      const res = await fetch('/api/test-user-line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tempToken.trim(),
          userName: tempName.trim() || '訂購同仁',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestMsg({ success: true, text: data.message || '測試訊息已發送至您的 LINE！' });
      } else {
        setTestMsg({ success: false, text: data.error || '發送失敗，請確認 Token 是否正確' });
      }
    } catch (err) {
      setTestMsg({ success: false, text: '網路連線失敗，請檢查網路' });
    } finally {
      setIsTestingToken(false);
    }
  };

  return (
    <>
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center gap-1.5 sm:gap-3">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('order')}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900 text-sm sm:text-lg tracking-tight whitespace-nowrap">智慧團購</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full hidden md:inline-block whitespace-nowrap">
                    辦公室團購合購平台
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden lg:block">團購商品、生活用品、便當飲料一站式合購</p>
              </div>
            </div>

            {/* User Profile Badge & PWA Install Button */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              <button
                onClick={() => setIsPwaModalOpen(true)}
                className="px-2 py-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-[11px] sm:text-xs rounded-xl shadow-xs flex items-center gap-1 sm:gap-1.5 transition active:scale-95 shrink-0"
                title="安裝智慧團購 App 至手機/電腦桌面"
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 animate-bounce" />
                <span className="hidden sm:inline">安裝桌面 App</span>
                <span className="sm:hidden">App</span>
              </button>

              {hasActiveSession && (
                isSessionExpired ? (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                    已截止收單
                  </span>
                ) : (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                    團購開放中
                  </span>
                )
              )}

              {/* Compact & Responsive User Profile Badge */}
              <button
                onClick={handleOpenModal}
                className="flex items-center bg-slate-100 hover:bg-slate-200/80 transition-colors rounded-xl p-1 pr-1.5 sm:pr-2 border border-slate-200/80 cursor-pointer shrink-0 max-w-[100px] sm:max-w-none"
                title="點擊設定姓名、部門與個人 LINE 通知"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm mr-1 sm:mr-1.5 shadow-xs shrink-0">
                  {userName ? userName.charAt(0) : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left min-w-0 flex-1 overflow-hidden">
                  <div className="text-slate-400 font-medium text-[9px] sm:text-[10px] leading-tight hidden sm:flex items-center gap-1 whitespace-nowrap">
                    訂購人
                    {userLineToken && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1 rounded">
                        LINE✓
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-800 text-[11px] sm:text-xs truncate">
                    {userName ? (
                      <span className="truncate">
                        {userName}
                        {userDepartment && <span className="text-slate-500 font-normal ml-0.5 hidden md:inline">({userDepartment})</span>}
                      </span>
                    ) : (
                      <span className="text-amber-600 whitespace-nowrap text-[10px] sm:text-xs">未設定</span>
                    )}
                  </div>
                </div>
                <Edit3 className="w-3 h-3 text-slate-400 ml-1 shrink-0 hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Set User Profile & LINE Token Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                訂購人個人設定與 LINE 通知連結
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Name & Department fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>1. 訂購識別姓名 *</span>
                  </label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="例如：王小明"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm font-bold"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>2. 部門 / 單位</span>
                    <span className="text-[10px] text-slate-400 font-normal">方便辨識</span>
                  </label>
                  <input
                    type="text"
                    value={tempDept}
                    onChange={(e) => setTempDept(e.target.value)}
                    placeholder="例如：研發部 / 總務組"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm"
                  />
                </div>
              </div>

              {/* Personal LINE Token field */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    2. 個人 LINE (CE NOTIFY) TOKEN (自由申請)
                  </span>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    選填即可即時收單
                  </span>
                </label>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  💡 自由輸入您個人申請的 LINE Notify / CE Notify 權杖。填寫後，當您在本平台送出團購訂單時，系統將即時發送點單明細與金額確認至您的個人 LINE！
                </p>

                {/* CE Notify 設定步驟說明 */}
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-extrabold text-emerald-950 border-b border-emerald-200/60 pb-2">
                    <span className="flex items-center gap-1.5 text-emerald-900">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      CE Notify 設定步驟說明：
                    </span>
                  </div>

                  <ol className="text-xs text-slate-800 space-y-2.5 pl-0.5">
                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">1</span>
                      <div className="flex-1">
                        <span className="font-extrabold text-slate-900">加入 CE Notify 官方帳號：</span>
                        <div className="mt-1">
                          <a
                            href="https://line.me/R/ti/p/@973femac"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1 rounded-lg font-bold text-xs shadow-2xs transition-all"
                          >
                            <span>加入 CE Notify LINE 機器人</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">2</span>
                      <div>
                        <span className="font-extrabold text-slate-900">個人 Mail 註冊與驗證：</span>
                        <p className="text-slate-600 text-[11px] mt-0.5">開啟 LINE 聊天室對話輸入個人 Email 註冊，收信完成驗證。</p>
                      </div>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">3</span>
                      <div>
                        <span className="font-extrabold text-slate-900">輸入通關密碼：</span>
                        <div className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>於 CE Notify 聊天室中輸入通關密碼：</span>
                          <code className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md font-mono font-black text-xs border border-emerald-300/80">[line-notify-ce2]</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('[line-notify-ce2]');
                              setCopiedPwd(true);
                              setTimeout(() => setCopiedPwd(false), 2000);
                            }}
                            className="text-[11px] bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            {copiedPwd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-emerald-700" />}
                            <span>{copiedPwd ? '已複製' : '複製通關密碼'}</span>
                          </button>
                        </div>
                      </div>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">4</span>
                      <div>
                        <span className="font-extrabold text-slate-900">複製 Token 貼回本系統：</span>
                        <p className="text-slate-600 text-[11px] mt-0.5">將取得之個人 Token 貼入「LINE CE NOTIFY TOKEN」欄位中。</p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={tempToken}
                    onChange={(e) => setTempToken(e.target.value)}
                    placeholder="貼上您的 LINE CE Notify Token"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={isTestingToken}
                    onClick={handleTestToken}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-shrink-0 flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isTestingToken ? '測試中...' : '測試發送'}
                  </button>
                </div>

                {testMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      testMsg.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {testMsg.success ? <Check className="w-4 h-4 text-emerald-600" /> : '⚠️ '}
                    {testMsg.text}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-colors shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  確認儲存設定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      <PwaInstallModal isOpen={isPwaModalOpen} onClose={() => setIsPwaModalOpen(false)} />
    </>
  );
};
