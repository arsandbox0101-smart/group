import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  PlusCircle,
  FileCode,
  Users,
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { TabOrder } from './components/TabOrder';
import { TabAdmin } from './components/TabAdmin';
import { TabMenuParser } from './components/TabMenuParser';
import { TabOrganizers } from './components/TabOrganizers';
import { TabHistory } from './components/TabHistory';
import {
  Vendor,
  Session,
  Organizer,
  OrderItem,
  CartItem,
  StoreType,
  MenuItem,
  InitialDataResponse,
  AuditLog,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'order' | 'admin' | 'menu' | 'settings' | 'history'>('order');
  const [userName, setUserName] = useState<string>('');
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [userLineToken, setUserLineToken] = useState<string>('');
  const [vendors, setVendors] = useState<Record<string, Vendor>>({});
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [openSessions, setOpenSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [currentOrganizer, setCurrentOrganizer] = useState<Organizer | null>(null);

  // Dedicated buyer mode when opened via copied buyer link (?role=buyer)
  const [isBuyerDedicatedLink, setIsBuyerDedicatedLink] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') === 'buyer' || params.get('mode') === 'order';
  });

  // Track if accessed via a specific session link parameter
  const [hasSessionQueryParam] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('session');
  });

  const isSingleSessionMode = isBuyerDedicatedLink || hasSessionQueryParam;

  // Load user name, department, line token, and organizer session from localStorage
  useEffect(() => {
    let savedName = localStorage.getItem('order_user_name') || '';
    if (savedName) setUserName(savedName);

    let savedDept = localStorage.getItem('order_user_department') || '';
    if (savedDept) setUserDepartment(savedDept);

    let savedToken = localStorage.getItem('order_user_line_token') || '';
    if (savedToken) setUserLineToken(savedToken);

    const savedOrgJson = localStorage.getItem('order_current_organizer');
    if (savedOrgJson) {
      try {
        const parsed = JSON.parse(savedOrgJson);
        setCurrentOrganizer(parsed);

        // Auto sync organizer identity to buyer profile if buyer profile is not set
        if (!savedName && parsed.name) {
          setUserName(parsed.name);
          localStorage.setItem('order_user_name', parsed.name);
        }
        if (!savedDept && parsed.department) {
          setUserDepartment(parsed.department);
          localStorage.setItem('order_user_department', parsed.department);
        }
        if (!savedToken && (parsed.token || parsed.lineNotifyToken)) {
          const t = parsed.token || parsed.lineNotifyToken;
          setUserLineToken(t);
          localStorage.setItem('order_user_line_token', t);
        }
      } catch (e) {
        localStorage.removeItem('order_current_organizer');
      }
    }

    // Parse role-based link routing query parameters
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const roleParam = params.get('role');
    const tabParam = params.get('tab');

    if (roleParam === 'buyer' || tabParam === 'order' || sessionParam) {
      setActiveTab('order');
    } else if (roleParam === 'admin' || tabParam === 'admin') {
      setActiveTab('admin');
    }

    if (sessionParam) {
      setSelectedSessionId(sessionParam);
    }
  }, []);

  // Ensure active tab is compatible with current environment mode
  useEffect(() => {
    if (isBuyerDedicatedLink && activeTab !== 'order') {
      setActiveTab('order');
    } else if (!currentOrganizer && !isBuyerDedicatedLink && activeTab !== 'order' && activeTab !== 'settings') {
      setActiveTab('order');
    }
  }, [isBuyerDedicatedLink, currentOrganizer, activeTab]);

  const handleSetCurrentOrganizer = (org: Organizer | null) => {
    setCurrentOrganizer(org);
    if (org) {
      setIsBuyerDedicatedLink(false);
      localStorage.setItem('order_current_organizer', JSON.stringify(org));

      // Auto-sync Organizer identity to Buyer identity so top-right profile and ordering identity match automatically
      if (org.name) {
        setUserName(org.name);
        localStorage.setItem('order_user_name', org.name);
      }
      if (org.department) {
        setUserDepartment(org.department);
        localStorage.setItem('order_user_department', org.department);
      }
      if (org.token) {
        setUserLineToken(org.token);
        localStorage.setItem('order_user_line_token', org.token);
      }

      showToast('success', `🎉 歡迎承辦人「${org.name}」登入！已自動連動訂購人身分「${org.name}」，全功能管理選單已解鎖。`);
    } else {
      localStorage.removeItem('order_current_organizer');
      showToast('success', '已切換回「一般訂購人模式」（已為您保留訂購人身分）');
      if (activeTab === 'admin' || activeTab === 'menu' || activeTab === 'history') {
        setActiveTab('order');
      }
    }
  };

  const handleUpdateUserProfile = (newName: string, newDept: string, newLineToken: string) => {
    setUserName(newName);
    setUserDepartment(newDept);
    setUserLineToken(newLineToken);
    localStorage.setItem('order_user_name', newName);
    localStorage.setItem('order_user_department', newDept);
    localStorage.setItem('order_user_line_token', newLineToken);
    showToast(
      'success',
      newLineToken
        ? `個人設定已更新！已綁定個人 LINE 訂單即時通知`
        : `訂購人姓名與部門已更新`
    );
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Fetch initial data from Express backend with Self-Healing Auto-Recovery
  const loadInitialData = async () => {
    try {
      const res = await fetch('/api/initial-data');
      if (res.ok) {
        let data: InitialDataResponse = await res.json();
        let serverVendors = data.vendors || {};
        let serverOrganizers = data.organizers || [];

        // 🛡️ Client-Side Dual-Backup & Self-Healing Auto-Recovery
        // 檢查瀏覽器本地備份是否有伺服器因容器休眠重啟 (Scale-to-Zero) 而遺失的資料
        try {
          const cachedOrgStr = localStorage.getItem('sg_cached_organizers');
          const cachedVendorsStr = localStorage.getItem('sg_cached_vendors');

          const cachedOrgs: Organizer[] = cachedOrgStr ? JSON.parse(cachedOrgStr) : [];
          const cachedVendors: Record<string, any> = cachedVendorsStr ? JSON.parse(cachedVendorsStr) : {};

          // 判斷伺服器是否缺少本機曾經建立過的負責人
          const missingOrgs = cachedOrgs.filter(
            (co) => !serverOrganizers.some((so) => so.name === co.name || so.id === co.id)
          );

          // 判斷伺服器是否缺少本機更新過或新加入的店家與菜單
          const missingVendors: Record<string, any> = {};
          let hasMissingVendors = false;
          Object.keys(cachedVendors).forEach((k) => {
            const cv = cachedVendors[k];
            const sv = serverVendors[k];
            if (!sv || (Array.isArray(cv.items) && (!sv.items || cv.items.length > sv.items.length))) {
              missingVendors[k] = cv;
              hasMissingVendors = true;
            }
          });

          if (missingOrgs.length > 0 || hasMissingVendors) {
            console.log(
              `🛡️ [Self-Healing] 偵測到伺服器可能剛經歷容器冷重啟，缺少 ${missingOrgs.length} 位負責人及店家更新，啟動自動雙向復原...`
            );
            const recoveryRes = await fetch('/api/sync-recovery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organizers: cachedOrgs,
                vendors: cachedVendors,
              }),
            });

            if (recoveryRes.ok) {
              const recData = await recoveryRes.json();
              if (recData.restored) {
                serverOrganizers = recData.organizers || serverOrganizers;
                serverVendors = recData.vendors || serverVendors;
                showToast(
                  'success',
                  '🛡️ 系統已自動從瀏覽器持久快照為您復原開團負責人與店家商品資料！'
                );
              }
            }
          }
        } catch (recoveryErr) {
          console.warn('Auto recovery check encountered warning:', recoveryErr);
        }

        // 更新本地持久快照，確保本地持有最新完整資料
        if (serverOrganizers && serverOrganizers.length > 0) {
          localStorage.setItem('sg_cached_organizers', JSON.stringify(serverOrganizers));
        }
        if (serverVendors && Object.keys(serverVendors).length > 0) {
          localStorage.setItem('sg_cached_vendors', JSON.stringify(serverVendors));
        }

        setVendors(serverVendors);
        setOrganizers(serverOrganizers);
        setRecentOrders(data.recentOrders || []);
        setAllSessions(data.allSessions || []);
        setAuditLogs(data.auditLogs || []);

        const fetchedOpenSessions = data.openSessions || (data.activeSession ? [data.activeSession] : []);
        setOpenSessions(fetchedOpenSessions);

        // Select session (prioritize URL search parameter if provided)
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');

        setSelectedSessionId((prevId) => {
          let currentSelected = sessionParam || prevId;
          if (currentSelected && fetchedOpenSessions.some((s) => s.sessionId === currentSelected)) {
            const found = fetchedOpenSessions.find((s) => s.sessionId === currentSelected);
            setActiveSession(found || null);
            return currentSelected;
          }
          if (fetchedOpenSessions.length > 0) {
            const latest = fetchedOpenSessions[fetchedOpenSessions.length - 1];
            setActiveSession(latest);
            return latest.sessionId;
          }
          setActiveSession(null);
          return '';
        });
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const found = openSessions.find((s) => s.sessionId === sessionId);
    if (found) {
      setActiveSession(found);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Cart operations
  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => [...prev, item]);
    showToast('success', `已將 「${item.itemName}」 加入購物車`);
  };

  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }
    setCart((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], qty: newQty };
      return copy;
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Order
  const handleSubmitOrder = async () => {
    let effectiveName = userName.trim();
    let effectiveDept = userDepartment.trim();

    if (!effectiveName && currentOrganizer?.name) {
      effectiveName = currentOrganizer.name;
      effectiveDept = currentOrganizer.department || '';
      setUserName(effectiveName);
      if (effectiveDept) setUserDepartment(effectiveDept);
      localStorage.setItem('order_user_name', effectiveName);
      if (effectiveDept) localStorage.setItem('order_user_department', effectiveDept);
    }

    if (!effectiveName) {
      showToast('error', '請先點擊右上角「訂購人」設定您的姓名！');
      return;
    }
    if (cart.length === 0) {
      showToast('error', '購物車是空的');
      return;
    }
    if (!activeSession) {
      showToast('error', '當前無開放中的團購活動');
      return;
    }

    const displayName = effectiveDept ? `${effectiveName} (${effectiveDept})` : effectiveName;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.sessionId,
          userName: displayName,
          userNotifyToken: userLineToken,
          items: cart,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.lineNoticeSent) {
          showToast('success', '🎉 訂單已成功送出！個人 LINE 訂購單通知已同步發送！');
        } else {
          showToast('success', '🎉 訂單已成功送出！');
        }
        setCart([]);
        await loadInitialData();
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '送出訂單失敗');
      }
    } catch (err) {
      showToast('error', '網路連線發生問題');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Order with personal LINE notification
  const handleDeleteOrder = async (orderId: string) => {
    try {
      const displayName = userDepartment ? `${userName} (${userDepartment})` : userName;
      const res = await fetch('/api/delete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userNotifyToken: userLineToken,
          userName: displayName,
        }),
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.lineNoticeSent) {
          showToast('success', '已成功取消訂單！刪單確認訊息已同步發送至您的 LINE！');
        } else {
          showToast('success', '已成功取消該筆訂單');
        }
        await loadInitialData();
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '刪除失敗');
      }
    } catch (err) {
      showToast('error', '刪除失敗，請檢查網路');
    }
  };

  // Start New Session
  const handleStartSession = async (sessionData: {
    title?: string;
    date: string;
    organizerName: string;
    lineToken: string;
    bentoStore: string;
    drinkStore: string;
    goodsStore?: string;
    deadline: string;
    note: string;
    notifyInfo?: string;
    password?: string;
  }) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (res.ok) {
        showToast('success', '已成功通過權限驗證，開啟團購活動！');
        await loadInitialData();
        setActiveTab('order');
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '承辦人身份驗證失敗，無法發起團購');
      }
    } catch (err) {
      showToast('error', '連線失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  // Close Session & Get Summary
  const handleCloseSession = async (
    sessionId: string,
    options?: { notifyOrganizer?: boolean; notifyBuyers?: boolean; password?: string }
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/close-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          password: options?.password,
          notifyOrganizer: options?.notifyOrganizer ?? true,
          notifyBuyers: options?.notifyBuyers ?? true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || '終止結單失敗');
      }
      await loadInitialData();
      return data;
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Active Session Details (Title, Deadline, Note, Date, Status)
  const handleUpdateSession = async (
    sessionId: string,
    updateData: { title?: string; date?: string; deadline?: string; note?: string; status?: 'Open' | 'Closed'; password?: string }
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/update-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...updateData }),
      });

      if (res.ok) {
        showToast('success', '已成功更新團購活動資訊！');
        await loadInitialData();
        return true;
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '修改失敗');
        return false;
      }
    } catch (err) {
      showToast('error', '網路連線失敗');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-open Group Session (讓已終止結單的團購重新上架開放訂購)
  const handleReopenSession = async (sessionId: string, newDeadline?: string, password?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/reopen-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newDeadline, password }),
      });

      if (res.ok) {
        showToast('success', '🔓 已成功重新開放本團購上架訂購！同仁現可繼續點餐。');
        await loadInitialData();
        return true;
      } else {
        const errData = await res.json().catch(() => ({ error: '伺服器回應異常' }));
        showToast('error', errData.error || '重新開放失敗');
        return false;
      }
    } catch (err) {
      showToast('error', '網路連線發生問題');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Group Session
  const handleDeleteSession = async (sessionId: string, password?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, password }),
      });

      if (res.ok) {
        showToast('success', '已成功刪除團購活動！');
        await loadInitialData();
        return true;
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '刪除失敗');
        return false;
      }
    } catch (err) {
      showToast('error', '網路連線失敗');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Menu Parser API
  const handleParseAndSaveMenu = async (
    storeName: string,
    storeType: StoreType,
    rawText: string,
    phone?: string,
    address?: string,
    city?: string
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/parse-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, storeType, rawText, phone, address, city }),
      });

      if (res.ok) {
        await loadInitialData();
        return true;
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '菜單解析失敗');
        return false;
      }
    } catch (err) {
      showToast('error', '網路連線失敗');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateVendor = async (
    originalName: string,
    name: string,
    type: StoreType,
    items: MenuItem[],
    phone?: string,
    address?: string,
    city?: string
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/vendors/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName, name, type, items, phone, address, city }),
      });

      if (res.ok) {
        try {
          const cachedVendorsStr = localStorage.getItem('sg_cached_vendors');
          const cachedVendors = cachedVendorsStr ? JSON.parse(cachedVendorsStr) : {};
          if (originalName && originalName !== name) {
            delete cachedVendors[originalName];
          }
          cachedVendors[name] = { name, type, items, phone, address, city };
          localStorage.setItem('sg_cached_vendors', JSON.stringify(cachedVendors));
        } catch (e) {
          console.warn('Failed to cache vendor locally:', e);
        }

        showToast('success', `已更換並更新 「${name}」 菜單與價格`);
        await loadInitialData();
        return true;
      } else {
        const errData = await res.json();
        showToast('error', errData.error || '更新店家菜單失敗');
        return false;
      }
    } catch (err) {
      showToast('error', '網路連線失敗');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteVendor = async (storeName: string) => {
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(storeName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        try {
          const cachedVendorsStr = localStorage.getItem('sg_cached_vendors');
          if (cachedVendorsStr) {
            const cachedVendors = JSON.parse(cachedVendorsStr);
            delete cachedVendors[storeName];
            localStorage.setItem('sg_cached_vendors', JSON.stringify(cachedVendors));
          }
        } catch (e) {
          console.warn('Failed to remove vendor from cache:', e);
        }

        showToast('success', `已刪除 「${storeName}」 菜單`);
        await loadInitialData();
      }
    } catch (err) {
      showToast('error', '刪除店家失敗');
    }
  };

  // Organizers API with Security
  const handleSaveOrganizer = async (
    name: string,
    phone: string,
    token: string,
    department?: string,
    notifyInfo?: string,
    password?: string,
    id?: string,
    oldPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/organizers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, phone, token, department, notifyInfo, password, oldPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        try {
          const cachedOrgStr = localStorage.getItem('sg_cached_organizers');
          let cachedOrgs: Organizer[] = cachedOrgStr ? JSON.parse(cachedOrgStr) : [];
          const existingIdx = id
            ? cachedOrgs.findIndex((o) => o.id === id)
            : cachedOrgs.findIndex((o) => o.name === name);
          const savedOrg: Organizer = {
            id: id || 'ORG' + Date.now(),
            name,
            phone: phone || '',
            token: token || '',
            department: department || '一般',
            notifyInfo: notifyInfo || '團購資訊',
            password: password || '',
          };
          if (existingIdx >= 0) {
            cachedOrgs[existingIdx] = { ...cachedOrgs[existingIdx], ...savedOrg };
          } else {
            cachedOrgs.push(savedOrg);
          }
          localStorage.setItem('sg_cached_organizers', JSON.stringify(cachedOrgs));
        } catch (e) {
          console.warn('Failed to cache organizer locally:', e);
        }

        showToast('success', id ? `已更換承辦人「${name}」資料` : `新增承辦人「${name}」成功！`);
        await loadInitialData();
        return { success: true };
      } else {
        showToast('error', data.error || '儲存失敗');
        return { success: false, error: data.error || '儲存失敗' };
      }
    } catch (err) {
      showToast('error', '網路連線失敗');
      return { success: false, error: '網路連線失敗' };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOrganizer = async (id: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const url = password
        ? `/api/organizers/${id}?password=${encodeURIComponent(password)}`
        : `/api/organizers/${id}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        try {
          const cachedOrgStr = localStorage.getItem('sg_cached_organizers');
          if (cachedOrgStr) {
            let cachedOrgs: Organizer[] = JSON.parse(cachedOrgStr);
            cachedOrgs = cachedOrgs.filter((o) => o.id !== id);
            localStorage.setItem('sg_cached_organizers', JSON.stringify(cachedOrgs));
          }
        } catch (e) {
          console.warn('Failed to remove organizer from cache:', e);
        }

        showToast('success', '已成功刪除該承辦人');
        await loadInitialData();
        return { success: true };
      } else {
        showToast('error', data.error || '刪除失敗');
        return { success: false, error: data.error || '刪除失敗' };
      }
    } catch (err) {
      showToast('error', '刪除失敗');
      return { success: false, error: '刪除失敗' };
    }
  };

  // Test Line Notify API
  const handleTestLineNotify = async (token: string, message?: string) => {
    try {
      const res = await fetch('/api/send-line-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message }),
      });
      const data = await res.json();
      if (data.result?.simulated) {
        showToast('success', 'CE Notify 模擬發送測試成功！');
      } else if (data.result?.success) {
        showToast('success', '已成功透過 CE Notify 發送測試通知至承辦人 LINE！');
      } else {
        showToast('error', `CE Notify 測試發送回應：${data.result?.error || '請檢查 Token'}`);
      }
    } catch (err) {
      showToast('error', '測試訊息發送失敗');
    }
  };

  // ⏰ 檢查當前活動是否已截止
  const isSessionExpired = React.useMemo(() => {
    if (!activeSession) return false;
    if (activeSession.status === 'Closed') return true;
    if (!activeSession.deadline) return false;

    const deadlineStr = activeSession.deadline.trim();
    const dateStr = activeSession.date ? activeSession.date.trim() : '';

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
  }, [activeSession]);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        userName={userName}
        userDepartment={userDepartment}
        userLineToken={userLineToken}
        onUpdateUserProfile={handleUpdateUserProfile}
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        hasActiveSession={!!activeSession}
        isSessionExpired={isSessionExpired}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs Pill Bar - 3 Environment Visibility Modes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 pb-4 mb-6 gap-3">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
            {/* 1. 團購項目選擇 (環境一、二、三均完全顯示) */}
            <button
              onClick={() => setActiveTab('order')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'order'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              團購項目選擇
              {cart.length > 0 && (
                <span className="ml-1 bg-amber-400 text-slate-900 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </button>

            {/* 2 & 3. 團購發起與匯入：僅在【環境三：承辦人身份 (已解鎖)】顯示 */}
            {currentOrganizer && !isBuyerDedicatedLink && (
              <>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  發起新團購 / 統計控制
                </button>

                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'menu'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  團購物品匯入
                </button>
              </>
            )}

            {/* 4. 承辦人設定：在【環境二：一般分享網址】與【環境三：承辦人身份】顯示 */}
            {(!isBuyerDedicatedLink || currentOrganizer) && (
              <button
                onClick={() => {
                  if (isBuyerDedicatedLink) {
                    setIsBuyerDedicatedLink(false);
                  }
                  setActiveTab('settings');
                }}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                承辦人設定 {currentOrganizer ? '(已解鎖)' : ''}
              </button>
            )}

            {/* 5. 歷史紀錄：僅在【環境三：承辦人身份 (已解鎖)】顯示 */}
            {currentOrganizer && !isBuyerDedicatedLink && (
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                歷史紀錄
              </button>
            )}
          </div>

          {/* Badge indicator when opened via colleague buyer link */}
          {isBuyerDedicatedLink && (
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <span>🛍️ 同仁免登入點餐模式</span>
              </span>
              <button
                onClick={() => setIsBuyerDedicatedLink(false)}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-xl transition cursor-pointer"
                title="切換至全功能選單"
              >
                切換完整模式
              </button>
            </div>
          )}
        </div>

        {/* Tab Views */}
        {activeTab === 'order' && (
          <TabOrder
            session={activeSession}
            openSessions={openSessions}
            onSelectSession={handleSelectSession}
            vendors={vendors}
            userName={userName}
            onRequestSetName={() => {
              const name = prompt('請輸入您的訂購姓名：', userName);
              if (name) handleUpdateUserProfile(name, userDepartment, userLineToken);
            }}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onSubmitOrder={handleSubmitOrder}
            sessionOrders={
              activeSession
                ? recentOrders.filter((o) => {
                    if (o.sessionId !== activeSession.sessionId) return false;
                    const activeStores = [
                      activeSession.bentoStore,
                      activeSession.drinkStore,
                      activeSession.goodsStore,
                    ].filter(Boolean);
                    return activeStores.includes(o.storeName);
                  })
                : recentOrders
            }
            onDeleteOrder={handleDeleteOrder}
            onNavigateToAdmin={() => setActiveTab('admin')}
            isSubmitting={isSubmitting}
            isSingleSessionMode={isSingleSessionMode}
          />
        )}

        {activeTab === 'admin' && (
          currentOrganizer ? (
            <TabAdmin
              activeSession={activeSession}
              openSessions={openSessions}
              onSelectSession={handleSelectSession}
              organizers={organizers}
              currentOrganizer={currentOrganizer}
              vendors={vendors}
              orders={recentOrders}
              auditLogs={auditLogs}
              onStartSession={handleStartSession}
              onCloseSession={handleCloseSession}
              onUpdateSession={handleUpdateSession}
              onReopenSession={handleReopenSession}
              onDeleteSession={handleDeleteSession}
              onTestLineNotify={handleTestLineNotify}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">【承辦人安全保全關卡】需要承辦人身份</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                「發起新團購/統計控制」功能僅供承辦人使用。請至「承辦人設定」選擇承辦人身份並輸入管理密碼驗證解鎖。
              </p>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
              >
                前往「承辦人設定」解鎖登入
              </button>
            </div>
          )
        )}

        {activeTab === 'menu' && (
          currentOrganizer ? (
            <TabMenuParser
              vendors={vendors}
              onParseAndSaveMenu={handleParseAndSaveMenu}
              onUpdateVendor={handleUpdateVendor}
              onDeleteVendor={handleDeleteVendor}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">【承辦人安全保全關卡】需要承辦人身份</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                「團購物品匯入」與菜單管理僅供承辦人使用。請至「承辦人設定」進行承辦人身分登入驗證。
              </p>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
              >
                前往「承辦人設定」解鎖登入
              </button>
            </div>
          )
        )}

        {activeTab === 'settings' && (
          <TabOrganizers
            organizers={organizers}
            currentOrganizer={currentOrganizer}
            onSetCurrentOrganizer={handleSetCurrentOrganizer}
            onSaveOrganizer={handleSaveOrganizer}
            onDeleteOrganizer={handleDeleteOrganizer}
            onTestLineNotify={handleTestLineNotify}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'history' && (
          <TabHistory sessions={allSessions} orders={recentOrders} vendors={vendors} />
        )}
      </main>

      {/* Floating Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
              notification.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>SmartOrder 辦公室便當與下午茶點餐系統 &copy; {new Date().getFullYear()}</div>
          <div className="text-slate-400">支援 Google Sheets DB & CE Notify 自動化通知</div>
        </div>
      </footer>
    </div>
  );
}
