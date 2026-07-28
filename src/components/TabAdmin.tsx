import React, { useState } from 'react';
import {
  PlusCircle,
  StopCircle,
  Send,
  Copy,
  Check,
  Bell,
  UserCheck,
  Store,
  Clock,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Building2,
  Lock,
  Key,
  ShieldCheck,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Link2
} from 'lucide-react';
import { Session, Vendor, Organizer, SessionSummary, OrderItem, AuditLog } from '../types';
import { exportSessionToExcel } from '../utils/excelExport';

interface TabAdminProps {
  activeSession: Session | null;
  openSessions?: Session[];
  onSelectSession?: (sessionId: string) => void;
  organizers: Organizer[];
  currentOrganizer?: Organizer | null;
  vendors: Record<string, Vendor>;
  orders?: OrderItem[];
  auditLogs?: AuditLog[];
  onStartSession: (sessionData: {
    title?: string;
    date: string;
    organizerName: string;
    lineToken: string;
    bentoStore: string;
    drinkStore: string;
    goodsStore: string;
    deadline: string;
    note: string;
    notifyInfo: string;
    password?: string;
  }) => void;
  onCloseSession: (
    sessionId: string,
    options?: { notifyOrganizer?: boolean; notifyBuyers?: boolean; password?: string }
  ) => Promise<{ summary: SessionSummary; notifyMessage: string; lineResult: any; buyerNoticeCount?: number }>;
  onUpdateSession?: (
    sessionId: string,
    updateData: { title?: string; date?: string; deadline?: string; note?: string; status?: 'Open' | 'Closed'; password?: string }
  ) => Promise<boolean>;
  onReopenSession?: (sessionId: string, newDeadline?: string, password?: string) => Promise<boolean>;
  onDeleteSession?: (sessionId: string, password?: string) => Promise<boolean>;
  onTestLineNotify: (token: string, message?: string) => void;
  isProcessing: boolean;
}

const CITIES_LIST = [
  '台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '台南市',
  '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣'
];

export const TabAdmin: React.FC<TabAdminProps> = ({
  activeSession,
  openSessions = [],
  onSelectSession,
  organizers,
  currentOrganizer,
  vendors,
  orders = [],
  auditLogs = [],
  onStartSession,
  onCloseSession,
  onUpdateSession,
  onReopenSession,
  onDeleteSession,
  onTestLineNotify,
  isProcessing,
}) => {
  // New Session Form State
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [selectedOrgName, setSelectedOrgName] = useState<string>('');
  const [startPasswordInput, setStartPasswordInput] = useState<string>('');
  const [showStartPassword, setShowStartPassword] = useState<boolean>(false);
  const [selectedBento, setSelectedBento] = useState<string>('-');
  const [selectedDrink, setSelectedDrink] = useState<string>('-');
  const [selectedGoods, setSelectedGoods] = useState<string>('-');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState<string>('10:30');
  const [sessionNote, setSessionNote] = useState<string>('歡迎大家踴躍參與團購，請在截止時間前送出購物車！');
  const [formError, setFormError] = useState<string | null>(null);

  // Auto pre-fill organizer info when currentOrganizer or organizers load
  React.useEffect(() => {
    if (currentOrganizer) {
      setSelectedOrgName(currentOrganizer.name);
      setStartPasswordInput(currentOrganizer.password || '');
    } else if (!selectedOrgName && organizers.length > 0) {
      setSelectedOrgName(organizers[0].name);
      setStartPasswordInput(organizers[0].password || '');
    }
  }, [currentOrganizer, organizers]);

  // Vendor City Selection Filters for New Session
  const [bentoCity, setBentoCity] = useState<string>('全部');
  const [drinkCity, setDrinkCity] = useState<string>('全部');
  const [goodsCity, setGoodsCity] = useState<string>('全部');

  // Edit Session State
  const [isEditingSession, setIsEditingSession] = useState<boolean>(false);
  const [editingSessionTarget, setEditingSessionTarget] = useState<Session | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDeadline, setEditDeadline] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'Open' | 'Closed'>('Open');

  // Password Verification for Session Management (Requirement 5)
  const [authRequiredSession, setAuthRequiredSession] = useState<{
    session: Session;
    actionType: 'edit' | 'delete' | 'terminate';
  } | null>(null);
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Delete & Terminate Modal State
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reopen Session Modal State
  const [reopenSessionTarget, setReopenSessionTarget] = useState<Session | null>(null);
  const [reopenPasswordInput, setReopenPasswordInput] = useState('');
  const [reopenDeadlineInput, setReopenDeadlineInput] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  const [copiedLinkSessionId, setCopiedLinkSessionId] = useState<string | null>(null);

  const [showTerminateModal, setShowTerminateModal] = useState<boolean>(false);
  const [terminatePasswordInput, setTerminatePasswordInput] = useState('');
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [notifyOrganizerOption, setNotifyOrganizerOption] = useState<boolean>(true);
  const [notifyBuyersOption, setNotifyBuyersOption] = useState<boolean>(true);

  // Summary State
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null);
  const [formattedMessage, setFormattedMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [lineStatusInfo, setLineStatusInfo] = useState<string | null>(null);

  // Security Audit Search & Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'warning' | 'danger'>('all');

  const filteredAuditLogs = (auditLogs || []).filter((log) => {
    if (auditFilter === 'warning' && log.severity !== 'warning' && log.severity !== 'danger') return false;
    if (auditFilter === 'danger' && log.severity !== 'danger') return false;
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      return (
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getVendorCity = (v: Vendor): string => {
    if (v.city && v.city.trim()) return v.city.trim();
    if (v.address) {
      const matched = v.address.match(/(台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|台南市|高雄市|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);
      if (matched) return matched[1];
    }
    return '台北市';
  };

  const verifyOrgPassword = async (orgName: string, passInput: string): Promise<boolean> => {
    const org = organizers.find((o) => o.name === orgName);
    if (!org || !org.password) return true; // No password required if none set
    try {
      const res = await fetch('/api/organizers/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: org.id, password: passInput }),
      });
      const data = await res.json();
      return res.ok && data.valid === true;
    } catch {
      return passInput === org.password;
    }
  };

  const handleOpenEditSessionFor = (target: Session) => {
    setEditingSessionTarget(target);
    setEditTitle(target.title || `${target.organizerName} 發起的團購`);
    setEditDeadline(target.deadline || '10:30');
    setEditDate(target.date || new Date().toISOString().split('T')[0]);
    setEditNote(target.note || '');
    setEditStatus(target.status || 'Open');
    setIsEditingSession(true);
  };

  const handleRequestEditSession = async (s: Session) => {
    const org = organizers.find((o) => o.name === s.organizerName);
    if (org && org.password) {
      setAuthRequiredSession({ session: s, actionType: 'edit' });
      setAuthPasswordInput('');
      setAuthError(null);
    } else {
      onSelectSession?.(s.sessionId);
      handleOpenEditSessionFor(s);
    }
  };

  const handleVerifyEditSessionPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authRequiredSession) return;
    const isValid = await verifyOrgPassword(authRequiredSession.session.organizerName, authPasswordInput);
    if (isValid) {
      const targetSession = authRequiredSession.session;
      setAuthRequiredSession(null);
      setAuthPasswordInput('');
      setAuthError(null);
      onSelectSession?.(targetSession.sessionId);
      handleOpenEditSessionFor(targetSession);
    } else {
      setAuthError('承辦人密碼錯誤，無法修改團購內容！');
    }
  };

  const handleSaveSessionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSessionTarget || !onUpdateSession) return;

    const ok = await onUpdateSession(editingSessionTarget.sessionId, {
      title: editTitle.trim(),
      deadline: editDeadline.trim(),
      date: editDate.trim(),
      note: editNote.trim(),
      status: editStatus,
    });

    if (ok) {
      setIsEditingSession(false);
      setEditingSessionTarget(null);
    }
  };

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedOrgName) {
      setFormError('⚠️ 請先選擇團購承辦人！');
      return;
    }

    if (selectedBento === '-' && selectedDrink === '-' && selectedGoods === '-') {
      setFormError('⚠️ 請至少選擇一家團購店家（便當、飲料或團購特賣）！');
      return;
    }

    const org = organizers.find((o) => o.name === selectedOrgName);
    if (org && org.password && !startPasswordInput.trim()) {
      setFormError(`⚠️ 承辦人「${selectedOrgName}」已啟用資安授權控管，請輸入授權密碼！`);
      return;
    }

    const lineToken = org ? org.token : '';
    const sessionNotifyInfo = org?.notifyInfo || '團購資訊';

    onStartSession({
      title: sessionTitle.trim() || `${selectedOrgName} 發起的團購`,
      date: sessionDate,
      organizerName: selectedOrgName,
      lineToken,
      bentoStore: selectedBento,
      drinkStore: selectedDrink,
      goodsStore: selectedGoods,
      deadline,
      note: sessionNote,
      notifyInfo: sessionNotifyInfo,
      password: startPasswordInput.trim(),
    });

    setSessionTitle('');
  };

  const handleTerminateSession = () => {
    if (!activeSession) return;
    setNotifyOrganizerOption(true);
    setNotifyBuyersOption(true);
    setShowTerminateModal(true);
  };

  const handleRequestReopenSession = (s: Session) => {
    setReopenSessionTarget(s);
    setReopenPasswordInput('');
    setReopenDeadlineInput(s.deadline || '21:30');
    setReopenError(null);
  };

  const handleConfirmReopenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenSessionTarget || !onReopenSession) return;

    const org = organizers.find((o) => o.name === reopenSessionTarget.organizerName);
    if (org && org.password) {
      if (!reopenPasswordInput.trim()) {
        setReopenError(`請輸入承辦人「${reopenSessionTarget.organizerName}」的授權密碼！`);
        return;
      }
      const isValid = await verifyOrgPassword(reopenSessionTarget.organizerName, reopenPasswordInput.trim());
      if (!isValid) {
        setReopenError('承辦人密碼錯誤，無法重新開放團購！');
        return;
      }
    }

    const ok = await onReopenSession(
      reopenSessionTarget.sessionId,
      reopenDeadlineInput.trim(),
      reopenPasswordInput.trim()
    );

    if (ok) {
      setReopenSessionTarget(null);
      setReopenPasswordInput('');
      setReopenError(null);
    }
  };

  const executeTerminateSession = async () => {
    if (!activeSession) return;

    try {
      const res = await onCloseSession(activeSession.sessionId, {
        notifyOrganizer: notifyOrganizerOption,
        notifyBuyers: notifyBuyersOption,
        password: terminatePasswordInput,
      });
      setSummaryData(res.summary);
      setFormattedMessage(res.notifyMessage);

      const statusParts: string[] = [];

      if (res.lineResult?.simulated) {
        statusParts.push('CE Notify 模擬派發成功 (使用測試權杖)');
      } else if (res.lineResult?.success) {
        statusParts.push('已成功發送 CE Notify 結單統計訊息至承辦人 LINE！');
      } else if (notifyOrganizerOption) {
        statusParts.push(`承辦人通知狀態：${res.lineResult?.reason || res.lineResult?.error || '權杖未設定'}`);
      }

      if (res.buyerNoticeCount && res.buyerNoticeCount > 0) {
        statusParts.push(`🎉 已同步發送個人訂購明細至 ${res.buyerNoticeCount} 位填寫 CE Notify 的訂購同仁 LINE！`);
      } else if (notifyBuyersOption) {
        statusParts.push('ℹ️ 本次訂購同仁尚無設定個人 CE Notify Token。');
      }

      setLineStatusInfo(statusParts.join(' '));
    } catch (err) {
      console.error('Terminate session error:', err);
    }
  };

  const handleCopyText = () => {
    if (formattedMessage) {
      navigator.clipboard.writeText(formattedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedOrgObj = organizers.find((o) => o.name === selectedOrgName);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Start New Session Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-xs">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">發起新團購</h2>
                <p className="text-xs text-slate-500">設定承辦人、便當/飲料店家與截止時間</p>
              </div>
            </div>

            <form onSubmit={handleStartSession} className="space-y-4">
              {/* Session Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  自定團購名稱 / 主題
                </label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="例：週五下午茶雙饗團 / 衛生紙爆款特賣 (選填)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800 bg-white"
                />
              </div>

              {/* Organizer Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    選擇團購承辦人
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    權限驗證保護
                  </span>
                </label>
                <select
                  value={selectedOrgName}
                  onChange={(e) => {
                    setSelectedOrgName(e.target.value);
                    setStartPasswordInput('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 bg-white font-medium"
                >
                  <option value="">-- 請選擇團購承辦人 --</option>
                  {organizers.map((org) => (
                    <option key={org.id} value={org.name}>
                      {org.name} ({org.department || '同仁'}) {org.token ? '✓ 已綁定 CE Notify' : ''}
                    </option>
                  ))}
                </select>

                {selectedOrgObj && (
                  <div className="mt-2.5 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        承辦人安全授權密碼 <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                        {selectedOrgObj.password ? '🔒 承辦人防護鎖' : '🔑 預設密碼 1234'}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showStartPassword ? 'text' : 'password'}
                        value={startPasswordInput}
                        onChange={(e) => setStartPasswordInput(e.target.value)}
                        placeholder={selectedOrgObj.password ? '請輸入該承辦人的安全密碼' : '預設密碼為 1234'}
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono text-slate-900 bg-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowStartPassword(!showStartPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={showStartPassword ? '隱藏密碼' : '顯示密碼'}
                      >
                        {showStartPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight flex items-start gap-1">
                      <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>資安辨識控管：防止未經授權人員任意開團。可至【承辦人資料管理】自訂獨立密碼。</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Bento Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-600" />
                    選擇便當店家
                  </label>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <select
                      value={bentoCity}
                      onChange={(e) => {
                        setBentoCity(e.target.value);
                        setSelectedBento('-');
                      }}
                      className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5 outline-none"
                    >
                      <option value="全部">全部縣市便當</option>
                      {CITIES_LIST.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <select
                  value={selectedBento}
                  onChange={(e) => setSelectedBento(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none text-sm text-slate-800 bg-white"
                >
                  <option value="-">-- 請選擇便當店家 --</option>
                  {Object.values(vendors)
                    .filter((v: Vendor) => v.type === '便當' && (bentoCity === '全部' || getVendorCity(v) === bentoCity))
                    .map((v: Vendor) => (
                      <option key={v.name} value={v.name}>
                        [{getVendorCity(v)}] {v.name} ({v.items.length} 個品項)
                      </option>
                    ))}
                </select>
              </div>

              {/* Drink Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-cyan-600" />
                    選擇飲料店家
                  </label>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <select
                      value={drinkCity}
                      onChange={(e) => {
                        setDrinkCity(e.target.value);
                        setSelectedDrink('-');
                      }}
                      className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5 outline-none"
                    >
                      <option value="全部">全部縣市飲料</option>
                      {CITIES_LIST.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <select
                  value={selectedDrink}
                  onChange={(e) => setSelectedDrink(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none text-sm text-slate-800 bg-white"
                >
                  <option value="-">-- 請選擇飲料店家 --</option>
                  {Object.values(vendors)
                    .filter((v: Vendor) => v.type === '飲料' && (drinkCity === '全部' || getVendorCity(v) === drinkCity))
                    .map((v: Vendor) => (
                      <option key={v.name} value={v.name}>
                        [{getVendorCity(v)}] {v.name} ({v.items.length} 個品項)
                      </option>
                    ))}
                </select>
              </div>

              {/* Goods / General Group Buy Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-indigo-600" />
                    選擇團購商品 / 生活特賣店家
                  </label>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <select
                      value={goodsCity}
                      onChange={(e) => {
                        setGoodsCity(e.target.value);
                        setSelectedGoods('-');
                      }}
                      className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5 outline-none"
                    >
                      <option value="全部">全部縣市商品</option>
                      {CITIES_LIST.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <select
                  value={selectedGoods}
                  onChange={(e) => setSelectedGoods(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-800 bg-white"
                >
                  <option value="-">-- 請選擇團購特賣店家 --</option>
                  {Object.values(vendors)
                    .filter((v: Vendor) => (v.type === '團購商品' || v.type === '其他' || v.type === '甜點') && (goodsCity === '全部' || getVendorCity(v) === goodsCity))
                    .map((v: Vendor) => (
                      <option key={v.name} value={v.name}>
                        [{getVendorCity(v)}] {v.name} [{v.type}] ({v.items.length} 個品項)
                      </option>
                    ))}
                </select>
              </div>

              {/* Date & Deadline Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    團購日期限制
                  </label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 bg-white font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-red-600" />
                    團購截止時間
                  </label>
                  <input
                    type="text"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="例如：10:30 或 14:00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Session Announcement Note */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                  團購公告與備註
                </label>
                <textarea
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-800"
                  placeholder="例如：便當滿 10 個免外送費..."
                />
              </div>

              {/* Inline Form Validation Error Banner */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2 animate-shake">
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>正在驗證並建立團購...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>開啟新團購</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Session Control & Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Session Termination Panel */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <StopCircle className="w-6 h-6 text-red-600" />
                  當前團購管理與統計控制
                </h2>
                <p className="text-xs text-slate-500">截止時間到達後，點擊「終止訂購」彙整清單並通知廠商</p>
              </div>

              {activeSession && (
                activeSession.status === 'Open' ? (
                  <button
                    onClick={handleTerminateSession}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all hover:scale-[1.01]"
                  >
                    <StopCircle className="w-4 h-4" />
                    終止訂購並發送 Line通知
                  </button>
                ) : (
                  <button
                    onClick={() => handleRequestReopenSession(activeSession)}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01]"
                  >
                    <Sparkles className="w-4 h-4" />
                    🔓 重新開放訂購 (恢復上架)
                  </button>
                )
              )}
            </div>

            {/* Multiple Open Sessions Selector / Active Session Status Box */}
            {openSessions.length > 0 ? (
              <div className="space-y-3 mb-6">
                {openSessions.length > 1 && (
                  <div className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    目前有 {openSessions.length} 個團購活動 (點擊切換管理標的)：
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2.5">
                  {openSessions.map((s, idx) => {
                    const isSelected = activeSession?.sessionId === s.sessionId;
                    const sessionTitle = s.title || `${s.organizerName} 發起的團購`;
                    const isClosed = s.status === 'Closed';
                    return (
                      <div
                        key={s.sessionId}
                        onClick={() => onSelectSession?.(s.sessionId)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                            {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                            團購 {idx + 1}：{sessionTitle}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isClosed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestReopenSession(s);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                title="重新開放此團購，讓同仁繼續下單"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                重新開放
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestEditSession(s);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="修改團購名稱與截止時間 (需驗證密碼)"
                            >
                              <Edit3 className="w-3 h-3" />
                              修改
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionToDelete(s);
                                setDeletePasswordInput('');
                                setDeleteError(null);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              title="刪除此團購活動 (需驗證密碼)"
                            >
                              <Trash2 className="w-3 h-3" />
                              刪除
                            </button>
                            <span className={isClosed ? 'bg-red-100 text-red-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full' : 'bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full'}>
                              {isClosed ? '🔒 已終止結單' : '開放訂購中'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                          <div>承辦人: <strong className="text-slate-800">{s.organizerName}</strong></div>
                          <div>截止時間: <strong className="text-red-600 font-bold">{s.date} {s.deadline}</strong></div>
                          <div>便當: <strong className="text-slate-800">{s.bentoStore || '-'}</strong></div>
                          <div>飲料: <strong className="text-slate-800">{s.drinkStore || '-'}</strong></div>
                        </div>

                        {/* 🔗 Role-Based Dedicated Order Link Card */}
                        {!isClosed && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 p-2.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 flex-shrink-0">
                                <Link2 className="w-3.5 h-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                                  <span>同仁免登入專屬訂購連結</span>
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">3 秒點餐</span>
                                </div>
                                <div className="text-[11px] font-mono text-indigo-800 truncate select-all">
                                  {`${window.location.origin}/?session=${s.sessionId}&role=buyer`}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const link = `${window.location.origin}/?session=${s.sessionId}&role=buyer`;
                                navigator.clipboard.writeText(link);
                                setCopiedLinkSessionId(s.sessionId);
                                setTimeout(() => setCopiedLinkSessionId(null), 2500);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                            >
                              {copiedLinkSessionId === s.sessionId ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-300" />
                                  <span>已複製</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>複製連結</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-800 text-xs flex items-center gap-2 mb-6">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                目前沒有開啟中的團購活動。請在左側選擇參數並發起團購。
              </div>
            )}

            {/* Line Status Feedback */}
            {lineStatusInfo && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
                <span className="font-bold">{lineStatusInfo}</span>
                {selectedOrgObj?.token && (
                  <button
                    onClick={() => onTestLineNotify(selectedOrgObj.token)}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700"
                  >
                    重新測試發送
                  </button>
                )}
              </div>
            )}

            {/* Summary Display Area */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  當前團購品項統計結果
                </h3>
                {activeSession && (
                  <button
                    type="button"
                    onClick={() => exportSessionToExcel(activeSession, orders, vendors)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all hover:scale-[1.02]"
                    title="將當前團購明細與統計結果匯出為 Excel 檔案"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                    <span>匯出 Excel 清單</span>
                  </button>
                )}
              </div>

              {summaryData && Object.keys(summaryData).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(summaryData).map(([storeName, items]) => (
                    <div key={storeName} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between">
                        <span>📍 店家：{storeName}</span>
                        <span className="text-amber-300 font-extrabold">
                          小計: ${Object.values(items).reduce((s, i) => s + i.totalPrice, 0)}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100 bg-white">
                        {Object.entries(items).map(([itemKey, data]) => (
                          <div key={itemKey} className="p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span>• {itemKey}</span>
                              <div className="flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                                  {data.qty} 份
                                </span>
                                <span className="text-slate-900 font-extrabold">${data.totalPrice}</span>
                              </div>
                            </div>
                            {/* Purchaser breakdown */}
                            <div className="text-[11px] text-slate-500 pl-3">
                              訂購人員: {data.details.map((d) => `${d.userName} (${d.qty}份)`).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Formatted Copyable Message */}
                  {formattedMessage && (
                    <div className="mt-4 bg-slate-900 text-slate-100 rounded-2xl p-4 text-xs font-mono relative">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-sans font-bold text-[11px]">CE Notify / 團購結單統計報表</span>
                        <button
                          onClick={handleCopyText}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? '已複製！' : '一鍵複製文本'}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap leading-relaxed text-slate-200">{formattedMessage}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-xs border border-slate-200">
                  按下「終止訂購並發送 Line通知」後，將會自動發送訊息至承辦人 LINE 並彙整便當與飲料品項數量、參與人與金額。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🛡️ 資安與異動稽核紀錄 (Security Audit Log) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                資安與資料異動稽核紀錄
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">
                  {auditLogs.length} 筆紀錄
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                系統自動即時稽核紀錄所有點餐、結單、修改、刪除與密碼驗證等資安異動
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="搜尋操作人或紀錄內容..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-700 cursor-pointer"
            >
              <option value="all">所有等級</option>
              <option value="warning">僅看警告與刪除</option>
              <option value="danger">僅看高風險/失敗</option>
            </select>
          </div>
        </div>

        {filteredAuditLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-bold">
            暫無符合條件的資安稽核紀錄
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">時間</th>
                  <th className="py-2.5 px-3">風險等級</th>
                  <th className="py-2.5 px-3">動作類型</th>
                  <th className="py-2.5 px-3">操作人 / IP</th>
                  <th className="py-2.5 px-3">異動與防護細節說明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAuditLogs.map((log) => {
                  let badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (log.severity === 'warning') badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                  if (log.severity === 'danger') badgeBg = 'bg-red-50 text-red-700 border-red-200';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeBg}`}>
                          {log.severity === 'danger' ? '高風險' : log.severity === 'warning' ? '警告/變更' : '一般紀錄'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{log.actor}</span>
                        {log.ip && <span className="text-[10px] text-slate-400 block font-mono">IP: {log.ip}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium leading-relaxed">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Session Modal */}
      {isEditingSession && editingSessionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                修改當前團購設定
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingSession(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSessionEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">自定團購名稱 / 主題</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-900 text-sm"
                  placeholder="例如：週五下午茶雙饗團 / 衛生紙爆款特賣"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">團購日期</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">團購截止時間</label>
                  <input
                    type="text"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    placeholder="如：10:30 或 12:00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-red-600 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">團購公告與備註</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800"
                  placeholder="例如：便當滿 10 個免外送費..."
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <input
                  type="checkbox"
                  id="reopenStatusCheckbox"
                  checked={editStatus === 'Open'}
                  onChange={(e) => setEditStatus(e.target.checked ? 'Open' : 'Closed')}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="reopenStatusCheckbox" className="text-xs font-extrabold text-emerald-900 cursor-pointer flex items-center gap-1">
                  <span>🔓 開放上架訂購 (若勾選則允許同仁繼續下單點餐)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingSession(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Required Modal for Editing Session */}
      {authRequiredSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4 font-bold">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">
              權限驗證 — 修改團購
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              保護機制：此團購由承辦人「<strong>{authRequiredSession.session.organizerName}</strong>」發起，請輸入承辦人個人密碼以進行修改：
            </p>

            <form onSubmit={handleVerifyEditSessionPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  承辦人密碼
                </label>
                <input
                  type="password"
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  placeholder="請輸入承辦人密碼..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                  required
                />
              </div>

              {authError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {authError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthRequiredSession(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-sm flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  驗證並編輯
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal with Password Protection */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">
              確定要刪除團購「{sessionToDelete.title || `${sessionToDelete.organizerName} 發起的團購`}」嗎？
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              刪除後此團購活動將從當前團購管理看板移除。相關的歷史紀錄與點餐訂單資料將會永久保存在資料庫當中。
            </p>

            {/* Password input if organizer has password set */}
            {organizers.find((o) => o.name === sessionToDelete.organizerName)?.password && (
              <div className="mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-red-600" />
                  請輸入承辦人「{sessionToDelete.organizerName}」的密碼：
                </label>
                <input
                  type="password"
                  value={deletePasswordInput}
                  onChange={(e) => setDeletePasswordInput(e.target.value)}
                  placeholder="輸入密碼驗證..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-xs font-bold text-slate-900 bg-white"
                  required
                />
              </div>
            )}

            {deleteError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = sessionToDelete.sessionId;
                  const isValid = await verifyOrgPassword(sessionToDelete.organizerName, deletePasswordInput);
                  if (!isValid) {
                    setDeleteError('承辦人密碼錯誤，無法刪除團購內容！');
                    return;
                  }
                  setSessionToDelete(null);
                  if (onDeleteSession) {
                    await onDeleteSession(targetId);
                  }
                }}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-500/20 transition-all"
              >
                {isProcessing ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Session Confirmation Modal with Password Protection */}
      {showTerminateModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">
              確定要終止今日團購並彙整結單統計？
            </h3>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              終止後將會結算統計所有便當與飲料品項數量，並發送 Line 通知訊息給承辦人與店家。
            </p>

            {/* Notification Target Options Checkboxes */}
            <div className="mb-4 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-2.5">
              <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-600" />
                Line 通知對象選擇：
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-slate-800 select-none">
                <input
                  type="checkbox"
                  checked={notifyOrganizerOption}
                  onChange={(e) => setNotifyOrganizerOption(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <span>
                  👤 發送整個團購結單統計給承辦人 ({activeSession.organizerName})
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-slate-800 select-none">
                <input
                  type="checkbox"
                  checked={notifyBuyersOption}
                  onChange={(e) => setNotifyBuyersOption(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span>
                  👥 發送個人訂購明細給有輸入 CE Notify Token 的訂購同仁
                </span>
              </label>
            </div>

            {/* Password input if organizer has password set */}
            {organizers.find((o) => o.name === activeSession.organizerName)?.password && (
              <div className="mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  請輸入承辦人「{activeSession.organizerName}」的密碼：
                </label>
                <input
                  type="password"
                  value={terminatePasswordInput}
                  onChange={(e) => setTerminatePasswordInput(e.target.value)}
                  placeholder="輸入密碼驗證..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-900 bg-white"
                  required
                />
              </div>
            )}

            {terminateError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {terminateError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTerminateModal(false)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const isValid = await verifyOrgPassword(activeSession.organizerName, terminatePasswordInput);
                  if (!isValid) {
                    setTerminateError('承辦人密碼錯誤，無法終止團購！');
                    return;
                  }
                  setShowTerminateModal(false);
                  await executeTerminateSession();
                }}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-500/20 transition-all"
              >
                {isProcessing ? '處理中...' : '確認終止並發送 Line通知'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Session Confirmation Modal with Password Protection */}
      {reopenSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">
              🔓 重新開放團購 (恢復上架)
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              團購名稱：<strong>{reopenSessionTarget.title || `${reopenSessionTarget.organizerName} 發起的團購`}</strong><br />
              重新開放後，同仁即可於點餐頁面繼續選購餐點與送出訂單。
            </p>

            <form onSubmit={handleConfirmReopenSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  設定新點餐截止時間：
                </label>
                <input
                  type="text"
                  value={reopenDeadlineInput}
                  onChange={(e) => setReopenDeadlineInput(e.target.value)}
                  placeholder="例：21:30"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 bg-white"
                  required
                />
              </div>

              {organizers.find((o) => o.name === reopenSessionTarget.organizerName)?.password && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    請輸入承辦人「{reopenSessionTarget.organizerName}」的安全密碼：
                  </label>
                  <input
                    type="password"
                    value={reopenPasswordInput}
                    onChange={(e) => setReopenPasswordInput(e.target.value)}
                    placeholder="輸入密碼驗證..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-900 bg-white"
                    autoFocus
                    required
                  />
                </div>
              )}

              {reopenError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {reopenError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReopenSessionTarget(null)}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {isProcessing ? '開放中...' : '確認重新開放'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
