import React, { useState, useEffect } from 'react';
import {
  Users,
  Key,
  Plus,
  Trash2,
  Send,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  BellRing,
  AlertCircle,
  Globe,
  Lock,
  Unlock,
  Edit3,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  Phone,
  Download,
  Upload,
  Database,
  RefreshCw
} from 'lucide-react';
import { Organizer } from '../types';

interface TabOrganizersProps {
  organizers: Organizer[];
  currentOrganizer: Organizer | null;
  onSetCurrentOrganizer: (org: Organizer | null) => void;
  onSaveOrganizer: (
    name: string,
    phone: string,
    token: string,
    department?: string,
    notifyInfo?: string,
    password?: string,
    id?: string,
    oldPassword?: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteOrganizer: (id: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  onTestLineNotify: (token: string, message?: string) => void;
  isProcessing: boolean;
}

export const TabOrganizers: React.FC<TabOrganizersProps> = ({
  organizers,
  currentOrganizer,
  onSetCurrentOrganizer,
  onSaveOrganizer,
  onDeleteOrganizer,
  onTestLineNotify,
  isProcessing,
}) => {
  // Login / Switch mode state
  const [loginOrgId, setLoginOrgId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Form state for creating new organizer
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [department, setDepartment] = useState('總務/福委');
  const [notifyInfo, setNotifyInfo] = useState('團購資訊');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Security Unlocked state per organizer ID (maps org.id -> boolean)
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({});

  // Active Modals
  const [unlockModalOrg, setUnlockModalOrg] = useState<Organizer | null>(null);
  const [unlockInputPassword, setUnlockInputPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Edit Modal State
  const [editingOrg, setEditingOrg] = useState<Organizer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editNotifyInfo, setEditNotifyInfo] = useState('');
  const [editOldPassword, setEditOldPassword] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');

  // Login verification as Organizer handler
  const handleVerifyLoginOrganizer = () => {
    if (!loginOrgId) {
      setLoginError('請選擇要驗證登入的承辦人帳號');
      return;
    }
    const org = organizers.find((o) => o.id === loginOrgId);
    if (!org) {
      setLoginError('找不到該承辦人帳號');
      return;
    }
    if (org.password && loginPassword !== org.password) {
      setLoginError('承辦人管理密碼不正確！');
      return;
    }
    onSetCurrentOrganizer(org);
    setLoginPassword('');
    setLoginError(null);
  };

  // Delete Confirm Modal State
  const [deleteModalOrg, setDeleteModalOrg] = useState<Organizer | null>(null);
  const [deleteInputPassword, setDeleteInputPassword] = useState('');

  // Password Query / Verification Modal
  const [queryModalOrg, setQueryModalOrg] = useState<Organizer | null>(null);
  const [queryInputPassword, setQueryInputPassword] = useState('');
  const [queryResult, setQueryResult] = useState<{ verified: boolean; msg: string } | null>(null);

  // Reset Password via OTP Modal State
  const [resetModalOrg, setResetModalOrg] = useState<Organizer | null>(null);
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpMsg, setResetOtpMsg] = useState<string | null>(null);
  const [resetOtpSimulated, setResetOtpSimulated] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Backup & Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCloudSyncingNow, setIsCloudSyncingNow] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{
    configured: boolean;
    connected: boolean;
    redisKey: string;
    cloudStats?: { vendorCount: number; organizerCount: number; sessionCount: number; orderCount: number };
    localStats?: { vendorCount: number; organizerCount: number; sessionCount: number; orderCount: number };
    errorMessage?: string | null;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchCloudStatus = async () => {
    try {
      const res = await fetch('/api/cloud-status');
      if (res.ok) {
        const data = await res.json();
        setCloudStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCloudStatus();
  }, []);

  const handleManualCloudSync = async () => {
    try {
      setIsCloudSyncingNow(true);
      const res = await fetch('/api/cloud-sync-now', { method: 'POST' });
      if (res.ok) {
        alert('⚡ 資料庫已成功強制同步至 Upstash 雲端！');
        await fetchCloudStatus();
      } else {
        alert('同步至雲端失敗，請確認 Render 上的 Upstash 環境變數');
      }
    } catch (e: any) {
      alert('同步失敗: ' + (e?.message || '網路異常'));
    } finally {
      setIsCloudSyncingNow(false);
    }
  };

  const handleExportBackup = () => {
    window.location.href = '/api/backup-database';
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          alert('備份檔案格式不符合 JSON 規範！');
          return;
        }
        setIsRestoring(true);
        const res = await fetch('/api/restore-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: parsed }),
        });
        const resData = await res.json();
        if (res.ok) {
          alert('🎉 資料庫已成功匯入還原！系統即將重新整理畫面。');
          window.location.reload();
        } else {
          alert(resData.error || '匯入資料庫失敗');
        }
      } catch (err) {
        alert('解析備份檔案失敗，請確保選取正確的 SmartGroup JSON 備份檔');
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Auto-lock helper
  const unlockOrganizerWithAutoLock = (orgId: string) => {
    setUnlockedMap((prev) => ({ ...prev, [orgId]: true }));
    // Auto re-lock after 3 minutes (180,000 ms)
    setTimeout(() => {
      setUnlockedMap((prev) => ({ ...prev, [orgId]: false }));
    }, 180000);
  };

  // Clean token string if user pasted URL or prepended parameter
  const cleanTokenString = (raw: string) => {
    let s = raw.trim();
    if (s.includes('token=')) {
      const match = s.match(/token=([^&]+)/);
      if (match) s = match[1];
    }
    return s.replace(/^(?:CE_NOTIFY_TOKEN=|token=)+/gi, '').trim();
  };

  // Handle Form Submit (Add New Organizer)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('請輸入承辦人姓名');

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        alert('兩次輸入的管理密碼不一致！請重新確認');
        return;
      }
    }

    const cleanedToken = cleanTokenString(token);

    const res = await onSaveOrganizer(
      name.trim(),
      phone.trim(),
      cleanedToken,
      department.trim(),
      notifyInfo.trim() || '團購資訊',
      password.trim()
    );

    if (res.success) {
      // Auto unlock / login as current organizer
      const newOrgObj: Organizer = {
        id: 'ORG_' + Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        token: cleanedToken,
        department: department.trim() || '一般',
        notifyInfo: notifyInfo.trim() || '團購資訊',
        password: password.trim(),
      };
      onSetCurrentOrganizer(newOrgObj);

      setName('');
      setPhone('');
      setToken('');
      setPassword('');
      setConfirmPassword('');
      setNotifyInfo('團購資訊');
    }
  };

  // Request Reset OTP via LINE
  const handleRequestOtp = async (org: Organizer) => {
    setIsSendingOtp(true);
    setResetOtpMsg(null);
    try {
      const res = await fetch('/api/organizers/request-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: org.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetOtpSent(true);
        setResetOtpMsg(data.message);
        if (data.otpSimulated) {
          setResetOtpSimulated(data.otpSimulated);
        }
      } else {
        alert(data.error || '發送動態驗證碼失敗');
      }
    } catch (err) {
      alert('網路連線失敗，請稍後重試');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Execute Password Reset
  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalOrg) return;
    if (!resetOtp.trim() || !resetNewPassword.trim()) {
      alert('請填寫動態驗證碼與新密碼');
      return;
    }

    try {
      const res = await fetch('/api/organizers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetModalOrg.id,
          otp: resetOtp.trim(),
          newPassword: resetNewPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || '承辦人密碼已成功重置！');
        setResetModalOrg(null);
        setResetOtp('');
        setResetNewPassword('');
        setResetOtpSent(false);
        setResetOtpMsg(null);
        setResetOtpSimulated(null);
        window.location.reload();
      } else {
        alert(data.error || '重置密碼失敗，請確認驗證碼');
      }
    } catch (err) {
      alert('連線失敗，請檢查網路');
    }
  };

  // Unlock Organizer (Verify Password)
  const handleVerifyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockModalOrg) return;

    if (!unlockModalOrg.password) {
      // No password set
      unlockOrganizerWithAutoLock(unlockModalOrg.id);
      setUnlockModalOrg(null);
      setUnlockInputPassword('');
      return;
    }

    try {
      const res = await fetch('/api/organizers/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: unlockModalOrg.id, password: unlockInputPassword }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        unlockOrganizerWithAutoLock(unlockModalOrg.id);
        setUnlockModalOrg(null);
        setUnlockInputPassword('');
        setUnlockError(null);
      } else {
        setUnlockError(data.error || '密碼不正確');
      }
    } catch (err) {
      setUnlockError('驗證連線失敗');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (org: Organizer) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditPhone(org.phone || '');
    setEditToken(org.token || '');
    setEditDept(org.department || '一般');
    setEditNotifyInfo(org.notifyInfo || '團購資訊');
    setEditOldPassword('');
    setEditNewPassword('');
    setEditConfirmPassword('');
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    if (editNewPassword || editConfirmPassword) {
      if (editNewPassword !== editConfirmPassword) {
        alert('新密碼與確認密碼不符！');
        return;
      }
    }

    const cleanedToken = cleanTokenString(editToken);

    const res = await onSaveOrganizer(
      editName.trim(),
      editPhone.trim(),
      cleanedToken,
      editDept.trim(),
      editNotifyInfo.trim() || '團購資訊',
      editNewPassword.trim() || undefined,
      editingOrg.id,
      editOldPassword.trim()
    );

    if (res.success) {
      setEditingOrg(null);
    }
  };

  // Handle Delete
  const handleExecuteDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalOrg) return;

    const res = await onDeleteOrganizer(deleteModalOrg.id, deleteInputPassword);
    if (res.success) {
      setDeleteModalOrg(null);
      setDeleteInputPassword('');
    }
  };

  // Handle Query / Verify Password
  const handleVerifyQueryPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryModalOrg) return;

    if (!queryModalOrg.password) {
      setQueryResult({
        verified: true,
        msg: '此承辦人目前未設定管理密碼（開放權限）。如需保護請點擊編輯設定密碼。',
      });
      return;
    }

    if (queryInputPassword === queryModalOrg.password) {
      setQueryResult({
        verified: true,
        msg: `🎉 密碼驗證正確！承辦人「${queryModalOrg.name}」已獲得安全管控認證。`,
      });
    } else {
      setQueryResult({
        verified: false,
        msg: '❌ 輸入的管理密碼不正確！請確認後重新輸入。',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 承辦人身分驗證登入與解鎖控制卡片 */}
      <div className="bg-white rounded-3xl p-6 border border-blue-200/90 shadow-xs relative overflow-hidden">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
              currentOrganizer ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  {currentOrganizer ? `已驗證登入承辦人：${currentOrganizer.name}` : '承辦人身分驗證與權限解鎖'}
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  currentOrganizer ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {currentOrganizer ? '🟢 承辦人全功能已解鎖' : '⚪ 一般訂購人模式 (選單已保護)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentOrganizer
                  ? `📞 聯絡電話: ${currentOrganizer.phone || '未設定'} | 所屬部門: ${currentOrganizer.department || '一般'}`
                  : '目前僅開放「團購項目選擇」與「承辦人設定」。若您是承辦人，請於下方選擇姓名並輸入管理密碼驗證解鎖。'}
              </p>
            </div>
          </div>

          {currentOrganizer ? (
            <button
              onClick={() => onSetCurrentOrganizer(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
            >
              切換回「一般訂購人模式」
            </button>
          ) : null}
        </div>

        {!currentOrganizer && (
          <div className="mt-4 pt-2 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                請選擇您的承辦人姓名
              </label>
              <select
                value={loginOrgId}
                onChange={(e) => {
                  setLoginOrgId(e.target.value);
                  setLoginError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-800 bg-slate-50"
              >
                <option value="">-- 請選擇承辦人帳號 --</option>
                {organizers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.department || '一般'}{o.phone ? ` | 📞 ${o.phone}` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                承辦人管理密碼
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError(null);
                }}
                placeholder="預設: 1234"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-800 bg-slate-50"
              />
            </div>

            <div className="md:col-span-3">
              <button
                onClick={handleVerifyLoginOrganizer}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                驗證登入承辦人
              </button>
            </div>

            {loginError && (
              <p className="md:col-span-12 text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 mt-1">
                ❌ {loginError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* CE Notify Migration Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-sm text-amber-950">
              📢 LINE Notify 服務結束公告與 CE Notify 升級通知
            </p>
            <p className="text-amber-800">
              原 LINE Notify (<code className="bg-amber-100 px-1 rounded text-amber-900">notify-bot.line.me</code>) 已結束服務。
              本系統已全面升級轉換為全新 <strong className="text-amber-950 font-extrabold">CE Notify</strong> 通知系統！請承辦人加入後設定 Token，享受自動化開團通知。
            </p>
          </div>
        </div>
        <a
          href="https://line.me/R/ti/p/@973femac"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          立即加入 CE Notify
        </a>
      </div>

      {/* Database Protection & Backup/Restore Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-md border border-indigo-800/40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold flex-shrink-0 border border-indigo-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-white">資料庫持久保存與雙向防護機制</span>
                
                {/* Upstash Redis 狀態標籤 */}
                {cloudStatus?.connected ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Upstash 雲端已連線 (Key: {cloudStatus.redisKey})
                  </span>
                ) : cloudStatus?.configured ? (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full" title={cloudStatus.errorMessage || '請檢查 Render 上的 URL 與 Token'}>
                    ⚠️ Upstash 連線失敗 (密鑰或網址異常)
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    🛡️ 瀏覽器快照救援模式 (未設定 Upstash)
                  </span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed max-w-2xl">
                {cloudStatus?.connected
                  ? `雲端資料庫運作中！雲端已儲存 ${cloudStatus.cloudStats?.vendorCount ?? 0} 家店家、${cloudStatus.cloudStats?.organizerCount ?? 0} 位負責人、${cloudStatus.cloudStats?.orderCount ?? 0} 筆訂單。即使主機休眠重啟，資料亦永不遺失。`
                  : '已啟用客戶端自動快照機制！即使伺服器容器休眠重啟，系統亦會在您開啟網頁時智慧對齊復原建立的負責人與店家商品。您亦可隨時匯出整份資料庫備份檔案。'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportBackup}
              accept=".json"
              className="hidden"
            />
            {cloudStatus?.configured && (
              <button
                onClick={handleManualCloudSync}
                disabled={isCloudSyncingNow}
                className="px-3 py-2 rounded-xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-500/40 text-indigo-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                title="立即將目前的店家菜單與負責人資料強制同步至 Upstash 雲端"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isCloudSyncingNow ? 'animate-spin' : ''}`} />
                {isCloudSyncingNow ? '同步中...' : '同步至雲端'}
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
              title="從先前下載的 JSON 備份檔還原"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              {isRestoring ? '還原中...' : '匯入還原'}
            </button>
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm shadow-indigo-500/30"
              title="下載整份資料庫 JSON 備份檔（包含店家、菜單、負責人與歷史資料）"
            >
              <Download className="w-3.5 h-3.5" />
              匯出備份 (JSON)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Organizers List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* New Organizer Creation Form */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">承辦人與 CE Notify 設定</h2>
                <p className="text-xs text-slate-500">新增或修改開團承辦人姓名、聯絡手機、CE Notify Token 與自訂通知主題</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    承辦人姓名 *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：許博淵"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    聯絡手機號碼
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例：0912-345-678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    所屬部門 / 群組
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="例：研發部 / 福委會"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    CE NOTIFY TOKEN (個人通知權杖)
                  </span>
                  <span className="text-[11px] text-indigo-600 font-normal">留空代表使用模擬通知模式</span>
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="貼上個人 CE Notify Token 數值"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800 font-mono"
                />
              </div>

              {/* 5. Notification Info (CE Notify Message Title) */}
              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  通知資訊 (CE Notify 訊息主題)
                </label>
                <input
                  type="text"
                  value={notifyInfo}
                  onChange={(e) => setNotifyInfo(e.target.value)}
                  placeholder="預設為「團購資訊」，可自由填寫想要收到的訊息主題"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-indigo-950 bg-indigo-50/40"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  格式帶入：<code className="bg-slate-100 px-1 rounded text-slate-600">https://v2.chateverywhere.app/api/line/notify?token=《貼上個人Token值》&message=《團購資訊》</code>
                </p>
              </div>

              {/* Password Protection Area */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-600" />
                    承辦人管理密碼 (隱私與權限防護)
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    預設: 1234 (可自行修訂)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      設定管理密碼
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="請輸入密碼"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      確認管理密碼 (輸入第二次)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="再次輸入相同密碼"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  💡 訂購同仁點餐無需輸入密碼！此密碼僅用於承辦人修改 Token、查看完整網址或刪除承辦人時驗證。
                </p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4" />
                儲存承辦人與 CE Notify 設定
              </button>
            </form>
          </div>

          {/* Active Organizers List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                已登記承辦人清單 ({organizers.length})
              </span>
              <span className="text-xs text-slate-400 font-normal">
                點擊 🔑 解鎖即可查看個人 Token 與測試網址
              </span>
            </h3>

            <div className="space-y-4">
              {organizers.map((org) => {
                const isUnlocked = unlockedMap[org.id] || false;
                const displayNotifyInfo = org.notifyInfo || '團購資訊';

                // Display masked Token
                const maskedToken = org.token
                  ? `${org.token.substring(0, 5)}***`
                  : '未設定 (使用模擬通知)';

                const fullToken = org.token || '';

                const tokenVal = fullToken
                  ? fullToken.replace(/^(?:CE_NOTIFY_TOKEN=|token=)+/gi, '')
                  : '《貼上個人Token值》';

                const testUrl = `https://v2.chateverywhere.app/api/line/notify?token=${tokenVal}&message=${encodeURIComponent(displayNotifyInfo)}`;

                return (
                  <div
                    key={org.id}
                    className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-base">{org.name}</span>
                          {org.phone && (
                            <span className="bg-blue-50 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-blue-600" />
                              {org.phone}
                            </span>
                          )}
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {org.department || '一般'}
                          </span>
                          {org.password ? (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-700" />
                              密碼保護中
                            </span>
                          ) : (
                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              開放權限
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 font-mono mt-1 flex flex-wrap items-center gap-2">
                          <span>CE Notify Token:</span>
                          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {isUnlocked ? fullToken || '未設定' : maskedToken}
                          </span>
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-sans font-bold">
                            主題: {displayNotifyInfo}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {!isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!org.password) {
                                unlockOrganizerWithAutoLock(org.id);
                              } else {
                                setUnlockModalOrg(org);
                                setUnlockInputPassword('');
                                setUnlockError(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors"
                            title="解鎖完整 Token 與連結"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            解鎖查看
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              已解鎖 (3分鐘自動上鎖)
                            </span>
                            <button
                              type="button"
                              onClick={() => setUnlockedMap((prev) => ({ ...prev, [org.id]: false }))}
                              className="px-2 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[11px] flex items-center gap-1 transition-colors"
                              title="手動重新上鎖保護隱私"
                            >
                              <Lock className="w-3 h-3 text-amber-700" />
                              重新上鎖
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (org.password && !isUnlocked) {
                              setUnlockModalOrg(org);
                              setUnlockInputPassword('');
                              setUnlockError(null);
                            } else {
                              handleOpenEdit(org);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors"
                          title="需先輸入密碼驗證後才可以進去編輯資料"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          編輯/密碼
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setQueryModalOrg(org);
                            setQueryInputPassword('');
                            setQueryResult(null);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs flex items-center gap-1 transition-colors"
                          title="驗證或查詢個人密碼權限"
                        >
                          🔑 驗證密碼
                        </button>

                        <button
                          type="button"
                          onClick={() => onTestLineNotify(org.token || 'demo_token', `【智慧團購平台測試OK發送】\n主題：${displayNotifyInfo}\n承辦人：${org.name}`)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          測試通知
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteModalOrg(org);
                            setDeleteInputPassword('');
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="刪除承辦人"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* URL display */}
                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-mono text-slate-600 break-all">
                        網址格式:{' '}
                        {isUnlocked ? (
                          <code className="text-indigo-900 bg-indigo-50/90 px-1.5 py-0.5 rounded font-mono font-bold">
                            {testUrl}
                          </code>
                        ) : (
                          <code className="text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded">
                            https://v2.chateverywhere.app/api/line/notify?token=《貼上個人Token值》&message={encodeURIComponent(displayNotifyInfo)}
                          </code>
                        )}
                      </span>

                      {org.token && isUnlocked && (
                        <a
                          href={testUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 underline flex-shrink-0"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          以瀏覽器直接開啟通知 (純文字)
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: CE Notify Setup Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <BellRing className="w-6 h-6 text-emerald-400" />
              <h3 className="font-extrabold text-lg text-white">承辦人 CE Notify 設定步驟說明</h3>
            </div>

            <ol className="space-y-3.5 text-xs text-slate-300 leading-relaxed list-none">
              <li className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <strong className="text-emerald-300">加入 CE Notify 官方帳號</strong>：<br />
                  負責人請點擊加入 CE Notify LINE 機器人：<br />
                  <a
                    href="https://line.me/R/ti/p/@973femac"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-emerald-400 hover:text-emerald-300 font-bold underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    https://line.me/R/ti/p/@973femac
                  </a>
                </div>
              </li>

              <li className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div>
                  <strong className="text-white">個人 Mail 註冊與驗證</strong>：<br />
                  開啟 LINE 聊天室進行個人 Email 註冊，並寄信收信完成驗證。
                </div>
              </li>

              <li className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <strong className="text-white">輸入通關密碼</strong>：<br />
                  於 CE Notify 聊天室中輸入通關密碼：<br />
                  <code className="inline-block mt-1 bg-emerald-900/90 text-emerald-200 border border-emerald-500/50 px-2 py-0.5 rounded-lg font-mono font-extrabold text-xs">
                    [line-notify-ce2]
                  </code>
                </div>
              </li>

              <li className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <div>
                  <strong className="text-white">複製 Token 貼回本系統</strong>：<br />
                  將取得之個人 Token 貼入左側「CE NOTIFY TOKEN」欄位中。
                </div>
              </li>

              <li className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                <div>
                  <strong className="text-emerald-300">設定通知資訊與管理密碼</strong>：<br />
                  於左側表單設定「通知資訊 (CE Notify 訊息主題)」，預設為「團購資訊」；並可設定「承辦人管理密碼」(需輸入密碼兩次確認)，防範其他人查看 Token 或誤刪資料。
                </div>
              </li>
            </ol>

            <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-2">
              <div className="font-bold text-slate-300">🔗 CE Notify 通知系統 URL 完整格式：</div>
              <code className="block bg-black/50 p-2.5 rounded-xl text-[10px] text-emerald-300 break-all font-mono leading-relaxed border border-emerald-500/30">
                https://v2.chateverywhere.app/api/line/notify?token=《貼上個人Token值》&message=《團購資訊》
              </code>
              <p className="text-slate-300 space-y-1">
                • <code className="text-emerald-300 font-bold">token=《貼上個人Token值》</code>：承辦人於此頁面填入之 Token。<br />
                • <code className="text-emerald-300 font-bold">&message=《團購資訊》</code>：預設為 "團購資訊"，承辦人可自由填寫想要收到的訊息主題。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Unlock View Password Modal */}
      {unlockModalOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">承辦人密碼解鎖驗證</h3>
                <p className="text-xs text-slate-500">承辦人：{unlockModalOrg.name}</p>
              </div>
            </div>

            <form onSubmit={handleVerifyUnlock} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  請輸入該承辦人的管理密碼
                </label>
                <input
                  type="password"
                  value={unlockInputPassword}
                  onChange={(e) => setUnlockInputPassword(e.target.value)}
                  placeholder="輸入密碼 (預設: 1234)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  autoFocus
                  required
                />
              </div>

              {unlockError && (
                <div className="space-y-1">
                  <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {unlockError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const org = unlockModalOrg;
                      setUnlockModalOrg(null);
                      setResetModalOrg(org);
                      handleRequestOtp(org);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    忘記密碼？點此經由 LINE (CE Notify) 重置密碼
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnlockModalOrg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  驗證並解鎖
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Organizer & Change Password Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                編輯承辦人與管理密碼
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrg(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    承辦人姓名
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    聯絡手機號碼
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="例：0912-345-678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    部門 / 群組
                  </label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CE Notify Token
                </label>
                <input
                  type="text"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  通知資訊 (CE Notify 訊息主題)
                </label>
                <input
                  type="text"
                  value={editNotifyInfo}
                  onChange={(e) => setEditNotifyInfo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-950 bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  修改承辦人管理密碼
                </span>

                {editingOrg.password && (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      請輸入原管理密碼 (驗證權限)
                    </label>
                    <input
                      type="password"
                      value={editOldPassword}
                      onChange={(e) => setEditOldPassword(e.target.value)}
                      placeholder="輸入舊密碼"
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-200 text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      輸入新管理密碼
                    </label>
                    <input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="設定新密碼"
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-200 text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      確認新管理密碼
                    </label>
                    <input
                      type="password"
                      value={editConfirmPassword}
                      onChange={(e) => setEditConfirmPassword(e.target.value)}
                      placeholder="再次確認新密碼"
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-200 text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-blue-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Organizer Confirmation Modal */}
      {deleteModalOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">確認刪除承辦人</h3>
                <p className="text-xs text-slate-500">承辦人：{deleteModalOrg.name}</p>
              </div>
            </div>

            <form onSubmit={handleExecuteDelete} className="space-y-3">
              {deleteModalOrg.password ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    請輸入管理密碼以授權刪除
                  </label>
                  <input
                    type="password"
                    value={deleteInputPassword}
                    onChange={(e) => setDeleteInputPassword(e.target.value)}
                    placeholder="輸入管理密碼"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    autoFocus
                    required
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                  此承辦人未設定管理密碼，點擊「確認刪除」即可直接刪除。
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOrg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  確認刪除
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Password Query / Verification Modal */}
      {queryModalOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center font-bold">
                🔑
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">承辦人密碼查詢與權限驗證</h3>
                <p className="text-xs text-slate-500">對象：{queryModalOrg.name}</p>
              </div>
            </div>

            <form onSubmit={handleVerifyQueryPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  輸入該承辦人的密碼測試驗證
                </label>
                <input
                  type="password"
                  value={queryInputPassword}
                  onChange={(e) => setQueryInputPassword(e.target.value)}
                  placeholder="輸入密碼"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  required
                />
              </div>

              {queryResult && (
                <div
                  className={`p-3 rounded-2xl border text-xs font-bold leading-relaxed ${
                    queryResult.verified
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  {queryResult.msg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQueryModalOrg(null);
                    setQueryResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  關閉
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  執行密碼驗證
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 5: Reset Password via LINE (CE Notify) OTP Modal */}
      {resetModalOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">重置承辦人管理密碼 (LINE 驗證)</h3>
                  <p className="text-xs text-slate-500">承辦人：{resetModalOrg.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetModalOrg(null);
                  setResetOtpMsg(null);
                  setResetOtpSimulated(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  LINE 訊息自動驗證發送機制
                </div>
                <p className="leading-relaxed">
                  系統已將 6 位數動態重置驗證碼發送至該承辦人的 CE Notify LINE 聊天室中，請於 10 分鐘內填入驗證碼並設定新密碼。
                </p>
                {resetOtpMsg && (
                  <div className="p-2 rounded-xl bg-white border border-indigo-200 text-emerald-700 font-bold">
                    {resetOtpMsg}
                  </div>
                )}
                {resetOtpSimulated && (
                  <div className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-mono font-bold">
                    🔑 模擬模式測試驗證碼: {resetOtpSimulated}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6 位數動態驗證碼 (OTP) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="請輸入 LINE 收到的 6 位數字"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono font-bold tracking-wider text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    disabled={isSendingOtp}
                    onClick={() => handleRequestOtp(resetModalOrg)}
                    className="px-3 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold text-xs flex-shrink-0"
                  >
                    {isSendingOtp ? '發送中...' : '重新發送'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  請輸入新的管理密碼 *
                </label>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="設定新密碼"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOrg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  確認重置密碼
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
