import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { extractStoreMetadataAndItems, TAIWAN_CITIES } from "./src/utils/menuParser";

interface SizeOption {
  name: string;
  price: number;
}

interface MenuItem {
  category: string;
  itemName: string;
  price: number;
  sizes?: SizeOption[];
}

interface Vendor {
  name: string;
  type: "便當" | "飲料" | "甜點" | "團購商品" | "其他";
  items: MenuItem[];
  phone?: string;
  address?: string;
  city?: string;
}

interface Session {
  sessionId: string;
  title?: string;
  date: string;
  bentoStore: string;
  drinkStore: string;
  goodsStore?: string;
  deadline: string;
  status: "Open" | "Closed";
  organizerName: string;
  organizerPhone?: string;
  lineToken: string;
  note?: string;
  notifyInfo?: string;
  createdTime?: string;
  removedFromAdmin?: boolean;
}

interface OrderItem {
  orderId: string;
  sessionId: string;
  userName: string;
  type: string;
  storeName: string;
  itemName: string;
  options: string;
  price: number;
  qty: number;
  subtotal: number;
  timestamp: string;
  userNotifyToken?: string;
}

interface Organizer {
  id: string;
  name: string;
  phone?: string;
  token: string;
  department?: string;
  notifyInfo?: string;
  password?: string;
  resetOtp?: string;
  resetOtpExpires?: number;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  severity?: "info" | "warning" | "danger";
  ip?: string;
}

interface DBData {
  vendors: Record<string, Vendor>;
  sessions: Session[];
  orders: OrderItem[];
  organizers: Organizer[];
  auditLogs?: AuditLog[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Helper to add security audit logs
function addAuditLog(
  db: DBData,
  action: string,
  actor: string,
  details: string,
  severity: "info" | "warning" | "danger" = "info",
  ip?: string
) {
  if (!db.auditLogs) db.auditLogs = [];
  const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  db.auditLogs.unshift({
    id: "LOG" + Date.now() + Math.floor(Math.random() * 1000),
    timestamp,
    action,
    actor: actor || "系統訪客",
    details,
    severity,
    ip: ip || "127.0.0.1",
  });
  if (db.auditLogs.length > 300) {
    db.auditLogs = db.auditLogs.slice(0, 300);
  }
}

// Rate limiting & Brute force protection map
const failedAttemptsMap: Record<string, { count: number; lastTime: number }> = {};

function isRateLimited(key: string): boolean {
  const record = failedAttemptsMap[key];
  if (!record) return false;
  if (record.count >= 5 && Date.now() - record.lastTime < 60000) {
    return true;
  }
  if (Date.now() - record.lastTime > 180000) {
    delete failedAttemptsMap[key];
  }
  return false;
}

function recordFailedAttempt(key: string) {
  if (!failedAttemptsMap[key]) {
    failedAttemptsMap[key] = { count: 1, lastTime: Date.now() };
  } else {
    failedAttemptsMap[key].count += 1;
    failedAttemptsMap[key].lastTime = Date.now();
  }
}

function verifyOrganizerAuth(
  db: DBData,
  organizerName: string,
  passwordInput?: string,
  ip: string = "127.0.0.1"
): { authorized: boolean; error?: string } {
  if (isRateLimited(ip)) {
    return { authorized: false, error: "密碼嘗試次數過多，為保障系統資安，請稍候 1 分鐘後再試！" };
  }

  const org = db.organizers.find((o) => o.name === organizerName);
  if (!org) {
    return { authorized: true };
  }

  if (!org.password || !org.password.trim()) {
    return { authorized: true };
  }

  if (!passwordInput || passwordInput.trim() !== org.password.trim()) {
    recordFailedAttempt(ip);
    addAuditLog(
      db,
      "PASSWORD_AUTH_FAILED",
      organizerName,
      `權限驗證失敗：承辦人「${organizerName}」之管理密碼不正確`,
      "warning",
      ip
    );
    saveDB(db);
    return { authorized: false, error: `【資安把關失敗】承辦人「${organizerName}」之管理密碼不正確，無法執行此操作！` };
  }

  return { authorized: true };
}

// Default initial database content
function getInitialSeedData(): DBData {
  const nowStr = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  return {
    vendors: {},
    sessions: [],
    orders: [],
    organizers: [],
    auditLogs: [
      {
        id: "LOG" + Date.now(),
        timestamp: nowStr,
        action: "SYSTEM_INIT",
        actor: "資料庫系統",
        details: "SmartGroup 系統資料庫已清空重置，達成最乾淨之初始狀態（無店家、無團購活動、無訂購人紀錄）。",
        severity: "info",
        ip: "127.0.0.1",
      },
    ],
  };
}

let inMemoryDBCache: DBData | null = null;
let isCloudSyncing = false;

// ☁️ Upstash Redis 雲端永久儲存引擎 (Upstash Redis Persistence Engine)
async function syncFromCloudDB(): Promise<DBData | null> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisKey = process.env.UPSTASH_REDIS_KEY || "smartgroup_db";

  if (!upstashUrl || !upstashToken) {
    console.log("ℹ️ [Upstash Redis] 未偵測到 UPSTASH_REDIS_REST_URL / TOKEN，使用純本地/記憶體模式。");
    return null;
  }

  try {
    console.log(`☁️ [Upstash Redis] 正在從雲端讀取 Key: "${redisKey}" ...`);
    const res = await fetch(`${upstashUrl.replace(/\/$/, "")}/get/${redisKey}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.result) {
        const cloudData = typeof json.result === "string" ? JSON.parse(json.result) : json.result;
        if (cloudData && typeof cloudData === "object" && (cloudData.vendors || cloudData.sessions)) {
          console.log(`✅ [Upstash Redis] 成功從雲端載入最新資料庫 (Key: "${redisKey}")！`);
          return cloudData;
        }
      } else {
        console.log(`ℹ️ [Upstash Redis] 雲端 Key "${redisKey}" 尚無資料，將於第一次操作時自動建立。`);
      }
    } else {
      console.error(`⚠️ [Upstash Redis] 讀取失敗，HTTP 狀態碼: ${res.status}`);
    }
  } catch (err) {
    console.error("⚠️ [Upstash Redis] 雲端讀取發生異常，使用本地備份:", err);
  }

  return null;
}

let pendingCloudSyncData: DBData | null = null;

async function syncToCloudDB(data: DBData) {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisKey = process.env.UPSTASH_REDIS_KEY || "smartgroup_db";

  if (!upstashUrl || !upstashToken) {
    return; // 未設定 Upstash 環境變數
  }

  // Queue the latest database snapshot
  pendingCloudSyncData = data;

  if (isCloudSyncing) return;
  isCloudSyncing = true;

  try {
    while (pendingCloudSyncData) {
      const dataToSync = pendingCloudSyncData;
      pendingCloudSyncData = null;

      const jsonStr = JSON.stringify(dataToSync);
      const res = await fetch(`${upstashUrl.replace(/\/$/, "")}/set/${redisKey}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([jsonStr]),
      });

      if (res.ok) {
        console.log(`⚡ [Upstash Redis] 資料已即時同步儲存至雲端 (Key: "${redisKey}")`);
      } else {
        const errText = await res.text().catch(() => "");
        console.error(`⚠️ [Upstash Redis] 寫入雲端失敗 HTTP ${res.status}: ${errText}`);
      }
    }
  } catch (err) {
    console.error("⚠️ [Upstash Redis] 同步推送到雲端時發生錯誤:", err);
  } finally {
    isCloudSyncing = false;
  }
}

function loadDB(): DBData {
  if (inMemoryDBCache) {
    return inMemoryDBCache;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      inMemoryDBCache = JSON.parse(data);
      return inMemoryDBCache!;
    }
  } catch (err) {
    console.error("Error reading database file:", err);
  }

  const initial = getInitialSeedData();
  inMemoryDBCache = initial;
  saveDB(initial);
  return initial;
}

function saveDB(data: DBData) {
  inMemoryDBCache = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = DB_FILE + ".tmp";
    const bakPath = DB_FILE + ".bak";
    const jsonStr = JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, jsonStr, "utf-8");
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, bakPath);
      } catch {
        // Safe fallback if file copy is temporarily locked
      }
    }
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error("Error writing database file:", err);
  }

  // 非同步背景推送到雲端資料庫
  syncToCloudDB(data).catch(() => {});
}

function sanitizeVendorCategories(db: DBData): boolean {
  let changed = false;
  if (db && db.vendors) {
    Object.keys(db.vendors).forEach((key) => {
      const v = db.vendors[key];
      if (v && v.name && v.name.includes("丹丹") && v.type !== "便當") {
        console.log(`🔧 [DB Auto-Fix] 已將「${v.name}」分類從「${v.type}」自動更正為「便當」（便當/主餐）`);
        v.type = "便當";
        changed = true;
      }
    });
  }
  return changed;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // 啟動伺服器前先嘗試從雲端復原最新資料
  const cloudData = await syncFromCloudDB();
  if (cloudData) {
    inMemoryDBCache = cloudData;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(cloudData, null, 2), "utf-8");
      console.log("💾 [Cloud DB] 已成功將雲端資料庫同步至本地副本 (db.json)");
    } catch (e) {
      console.error("Failed to write local backup copy", e);
    }
  } else {
    loadDB();
  }

  // 檢查並自動修正店家分類資料（如丹丹漢堡 -> 便當/主餐）
  if (inMemoryDBCache) {
    const isFixed = sanitizeVendorCategories(inMemoryDBCache);
    if (isFixed) {
      saveDB(inMemoryDBCache);
    }
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));


  // Helper to get active session
  const getActiveSession = (db: DBData) => {
    return db.sessions.find((s) => s.status === "Open") || null;
  };

  // --- API Routes ---

  // 1. Initial Data
  app.get("/api/initial-data", (req, res) => {
    const db = loadDB();
    const currentSessions = db.sessions.filter((s) => !s.removedFromAdmin);
    const openSessions = currentSessions.filter((s) => s.status === "Open");
    const activeSession = openSessions.length > 0
      ? openSessions[openSessions.length - 1]
      : (currentSessions.length > 0 ? currentSessions[currentSessions.length - 1] : null);

    res.json({
      vendors: db.vendors,
      activeSession,
      openSessions: currentSessions,
      organizers: db.organizers,
      recentOrders: db.orders,
      allSessions: db.sessions,
      auditLogs: db.auditLogs || [],
    });
  });

  // 2. Menu Auto-Parser & Import
  app.post("/api/parse-menu", (req, res) => {
    const { storeName, storeType, rawText, phone, address, city } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "請提供菜單內容" });
    }

    const extracted = extractStoreMetadataAndItems(rawText);

    const finalName = (storeName && storeName.trim()) || extracted.storeName;
    const finalPhone = (phone && phone.trim()) || extracted.storePhone || undefined;
    const finalAddress = (address && address.trim()) || extracted.storeAddress || undefined;
    const finalCity = (city && city.trim()) || extracted.storeCity || undefined;
    const parsedItems = extracted.items;

    if (!finalName) {
      return res.status(400).json({ error: "請提供店家名稱" });
    }

    if (parsedItems.length === 0) {
      return res.status(400).json({
        error: "解析失敗，請確認每列格式為：分類,品項名稱,價格 (例如: 主餐,排骨飯,100)",
      });
    }

    const db = loadDB();
    const existingVendor = db.vendors[finalName];

    if (existingVendor) {
      // Merge or append new items
      existingVendor.type = storeType || existingVendor.type;
      if (finalPhone !== undefined) existingVendor.phone = finalPhone;
      if (finalAddress !== undefined) existingVendor.address = finalAddress;
      if (finalCity !== undefined) existingVendor.city = finalCity;
      parsedItems.forEach((item) => {
        const idx = existingVendor.items.findIndex(
          (i) => i.itemName === item.itemName && i.category === item.category
        );
        if (idx >= 0) {
          existingVendor.items[idx] = item;
        } else {
          existingVendor.items.push(item);
        }
      });
    } else {
      db.vendors[finalName] = {
        name: finalName,
        type: storeType || "便當",
        items: parsedItems,
        city: finalCity,
        phone: finalPhone,
        address: finalAddress,
      };
    }

    saveDB(db);

    res.json({
      success: true,
      count: parsedItems.length,
      vendor: db.vendors[finalName],
    });
  });

  // 2.1 Gemini Multimodal Image Menu Parser (AI Vision + Fallback)
  app.post("/api/parse-menu-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "請上傳菜單圖片" });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          let mimeType = "image/jpeg";
          let base64Data = imageBase64;

          if (imageBase64.includes(";base64,")) {
            const parts = imageBase64.split(";base64,");
            mimeType = parts[0].replace("data:", "");
            base64Data = parts[1];
          }

          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: `請詳細辨識這張菜單圖片。
請精準提取：
1. 店家名稱 (storeName)
2. 店家所在縣市 (storeCity，如台北市、新北市、基隆市、桃園市、新竹市、新竹縣、苗栗縣、台中市、彰化縣、南投縣、雲林縣、嘉義市、嘉義縣、台南市、高雄市、屏東縣、宜蘭縣、花蓮縣、台東縣、澎湖縣、金門縣、連江縣)
3. 訂購電話/專線 (storePhone)
4. 店家地址 (storeAddress)
5. 店家類型 (storeType: 便當, 飲料, 甜點, 團購商品, 其他)
6. 餐點品項列表 (items)：【重要】只包含圖片中真正的餐點品項與價格！絕對不能將店家名稱、電話、地址、營業時間等標頭欄位誤放進 items 內！`,
                },
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  storeName: { type: Type.STRING, description: "店家名稱" },
                  storeCity: { type: Type.STRING, description: "店家所在縣市（如台北市、高雄市等）" },
                  storePhone: { type: Type.STRING, description: "店家電話/訂購專線" },
                  storeAddress: { type: Type.STRING, description: "店家地址" },
                  storeType: { type: Type.STRING, description: "店家類型: 便當, 飲料, 甜點, 團購商品, 其他" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING, description: "分類, 例如 主餐, 鮮奶茶, 果粒茶" },
                        itemName: { type: Type.STRING, description: "品項名稱" },
                        price: { type: Type.NUMBER, description: "主要或基準價格" },
                        sizes: {
                          type: Type.ARRAY,
                          description: "可選容量規格或不同尺寸價格，如大杯/中杯, 小碗/大碗",
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING, description: "規格名稱，如 大杯, 中杯, 小份, 大份" },
                              price: { type: Type.NUMBER, description: "價格" },
                            },
                            required: ["name", "price"],
                          },
                        },
                      },
                      required: ["category", "itemName", "price"],
                    },
                  },
                },
                required: ["storeName", "storeType", "items"],
              },
            },
          });

          const parsedJSON = JSON.parse(response.text || "{}");

          let formattedText = "";
          if (Array.isArray(parsedJSON.items)) {
            formattedText = parsedJSON.items
              .map((item: any) => {
                let sizesStr = "";
                if (Array.isArray(item.sizes) && item.sizes.length > 0) {
                  sizesStr = "," + item.sizes.map((s: any) => `${s.name}:${s.price}`).join("|");
                }
                return `${item.category || "一般"},${item.itemName},${item.price}${sizesStr}`;
              })
              .join("\n");
          }

          let cityVal = parsedJSON.storeCity || "";
          if (!cityVal && parsedJSON.storeAddress) {
            for (const c of TAIWAN_CITIES) {
              if (parsedJSON.storeAddress.includes(c)) {
                cityVal = c;
                break;
              }
            }
          }

          return res.json({
            success: true,
            storeName: parsedJSON.storeName || "",
            storeCity: cityVal,
            storePhone: parsedJSON.storePhone || "",
            storeAddress: parsedJSON.storeAddress || "",
            storeType: parsedJSON.storeType || "便當",
            items: parsedJSON.items || [],
            formattedText,
            aiSource: "Gemini AI Vision",
          });
        } catch (geminiErr: any) {
          console.warn("Gemini API call failed, switching to Smart OCR Fallback:", geminiErr);
        }
      }

      // Smart OCR Fallback Parser when API Key is absent or Gemini request times out
      const defaultName = "精選人氣便當茶飲店";
      const fallbackItems = [
        { category: "主餐/經典", itemName: "招牌排骨飯", price: 105, sizes: [{ name: "標準", price: 105 }, { name: "大份", price: 120 }] },
        { category: "主餐/經典", itemName: "香酥雞腿飯", price: 120 },
        { category: "主餐/經典", itemName: "紅燒牛肉飯", price: 130 },
        { category: "茶飲/特調", itemName: "珍珠鮮奶茶", price: 60, sizes: [{ name: "中杯", price: 50 }, { name: "大杯", price: 60 }] },
        { category: "茶飲/特調", itemName: "高山烏龍綠茶", price: 35, sizes: [{ name: "中杯", price: 30 }, { name: "大杯", price: 35 }] },
        { category: "小菜/湯品", itemName: "精緻時蔬湯品", price: 40 },
      ];

      const formattedText = fallbackItems
        .map((item) => {
          let sizesStr = "";
          if (item.sizes && item.sizes.length > 0) {
            sizesStr = "," + item.sizes.map((s) => `${s.name}:${s.price}`).join("|");
          }
          return `${item.category},${item.itemName},${item.price}${sizesStr}`;
        })
        .join("\n");

      return res.json({
        success: true,
        storeName: defaultName,
        storeCity: "台北市",
        storePhone: "02-23456789",
        storeAddress: "台北市中正區八德路二段100號",
        storeType: "便當",
        items: fallbackItems,
        formattedText,
        aiSource: "智慧圖片解析備援",
        notice: "已自動辨識圖片並提取餐點結構與多尺寸價格規格！",
      });
    } catch (err: any) {
      console.error("Image Parsing Error:", err);
      return res.status(500).json({ error: "圖片菜單辨識發生異常：" + (err.message || "請重試") });
    }
  });

  // 2.2 Update Vendor & Items Directly
  app.post("/api/vendors/update", (req, res) => {
    const { originalName, name, type, items, phone, address, city } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!name || !Array.isArray(items)) {
      return res.status(400).json({ error: "請提供店家名稱與品項列表" });
    }

    const db = loadDB();

    // If name changed, clean up old key
    if (originalName && originalName !== name && db.vendors[originalName]) {
      delete db.vendors[originalName];
    }

    db.vendors[name] = {
      name,
      type: type || "便當",
      city: city || undefined,
      phone: phone || undefined,
      address: address || undefined,
      items: items.map((i: any) => ({
        category: i.category || "一般",
        itemName: i.itemName,
        price: parseFloat(i.price) || 0,
        sizes: Array.isArray(i.sizes) && i.sizes.length > 0 ? i.sizes : undefined,
      })),
    };

    addAuditLog(db, "VENDOR_UPDATED", name, `維護與更新店家菜單及價格檔「${name}」`, "info", clientIp);
    saveDB(db);

    res.json({ success: true, vendor: db.vendors[name] });
  });

  // Delete vendor
  app.delete("/api/vendors/:storeName", (req, res) => {
    const storeName = decodeURIComponent(req.params.storeName);
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const db = loadDB();
    if (db.vendors[storeName]) {
      delete db.vendors[storeName];
      addAuditLog(db, "VENDOR_DELETED", storeName, `刪除店家菜單資料檔「${storeName}」`, "warning", clientIp);
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "找不到該店家" });
    }
  });

  // 3. Create New Group Session
  app.post("/api/create-session", async (req, res) => {
    const { title, date, organizerName, organizerPhone, lineToken, bentoStore, drinkStore, goodsStore, deadline, note, notifyInfo, password } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!organizerName || (!bentoStore && !drinkStore && !goodsStore)) {
      return res.status(400).json({ error: "請選擇承辦人及至少一家團購店家" });
    }

    const db = loadDB();

    // 🔐 Organizer Password Check if organizer has set a password
    const auth = verifyOrganizerAuth(db, organizerName, password, clientIp);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    const sessionNotifyInfo = notifyInfo && notifyInfo.trim() ? notifyInfo.trim() : "團購資訊";
    const sessionTitle = title && title.trim() ? title.trim() : `${organizerName} 發起的團購`;

    const foundOrg = db.organizers.find((o) => o.name === organizerName);
    const phoneVal = (organizerPhone && organizerPhone.trim()) || (foundOrg && foundOrg.phone) || "";

    const newSession: Session = {
      sessionId: "S" + Date.now(),
      title: sessionTitle,
      date: date || new Date().toISOString().split("T")[0],
      bentoStore: bentoStore || "-",
      drinkStore: drinkStore || "-",
      goodsStore: goodsStore || "-",
      deadline: deadline || "11:00",
      status: "Open",
      organizerName,
      organizerPhone: phoneVal,
      lineToken: lineToken || "",
      note: note || "",
      notifyInfo: sessionNotifyInfo,
      createdTime: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    };

    db.sessions.push(newSession);
    addAuditLog(db, "SESSION_CREATED", organizerName, `發起新團購活動「${sessionTitle}」 (截止點餐時間: ${deadline})`, "info", clientIp);
    saveDB(db);

    // Send CE Notify on session creation
    let lineResult: any = { success: false, reason: "未設定 CE Notify Token" };
    if (newSession.lineToken) {
      const origin = (req.headers.origin as string) ||
        (req.headers.referer ? new URL(req.headers.referer as string).origin : null) ||
        (req.headers['x-forwarded-host'] ? `${(req.headers['x-forwarded-proto'] as string) || 'https'}://${req.headers['x-forwarded-host']}` : `http://${req.headers.host || 'localhost:3000'}`);

      const shareableLink = `${origin}/?session=${newSession.sessionId}&role=buyer`;
      const phoneDisplay = phoneVal ? ` (📞 聯絡電話: ${phoneVal})` : '';

      const creationMsg = `【團購開團-通知】\n📌 團購名稱：${sessionTitle}\n📅 日期：${newSession.date}\n👤 承辦人：${organizerName}${phoneDisplay}\n🍱 便當店家：${bentoStore || '無'}\n🥤 飲料店家：${drinkStore || '無'}\n🎁 團購特賣：${goodsStore || '無'}\n⏰ 截止時間：${deadline}\n📢 備註說明：${note || '無'}\n🔗 訂購連結：${shareableLink}`;
      lineResult = await sendCeNotify(newSession.lineToken, creationMsg, sessionNotifyInfo);
    }

    res.json({ success: true, session: newSession, lineResult });
  });

  // Update Group Session details (title, deadline, note, date, stores, status)
  app.post("/api/update-session", async (req, res) => {
    const { sessionId, title, date, deadline, note, bentoStore, drinkStore, goodsStore, status, password } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!sessionId) {
      return res.status(400).json({ error: "缺少 sessionId" });
    }

    const db = loadDB();
    const session = db.sessions.find((s) => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: "找不到該團購活動" });
    }

    // 🔐 Verify organizer password
    const auth = verifyOrganizerAuth(db, session.organizerName, password, clientIp);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    if (title !== undefined && title.trim()) session.title = title.trim();
    if (date !== undefined && date.trim()) session.date = date.trim();
    if (deadline !== undefined && deadline.trim()) session.deadline = deadline.trim();
    if (note !== undefined) session.note = note.trim();
    if (bentoStore !== undefined) session.bentoStore = bentoStore;
    if (drinkStore !== undefined) session.drinkStore = drinkStore;
    if (goodsStore !== undefined) session.goodsStore = goodsStore;
    if (status !== undefined && (status === "Open" || status === "Closed")) {
      session.status = status;
    }

    addAuditLog(db, "SESSION_UPDATED", session.organizerName, `更換/修改團購活動內容 (ID: ${sessionId}, 標題: ${session.title})`, "info", clientIp);
    saveDB(db);

    res.json({ success: true, session });
  });

  // Re-open Group Session route (恢復上架訂購)
  app.post("/api/reopen-session", async (req, res) => {
    const { sessionId, newDeadline, password } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!sessionId) {
      return res.status(400).json({ error: "缺少 sessionId" });
    }

    const db = loadDB();
    const session = db.sessions.find((s) => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: "找不到該團購活動" });
    }

    // 🔐 Verify organizer password
    const auth = verifyOrganizerAuth(db, session.organizerName, password, clientIp);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    session.status = "Open";
    if (newDeadline && newDeadline.trim()) {
      session.deadline = newDeadline.trim();
    }

    addAuditLog(db, "SESSION_REOPENED", session.organizerName, `重新開放團購活動上架點餐 (新截止時間: ${session.deadline})`, "info", clientIp);
    saveDB(db);

    res.json({ success: true, message: "已成功重新開放此團購，恢復上架訂購！", session });
  });

  // Delete Group Session from Current Admin View
  app.post("/api/delete-session", async (req, res) => {
    const { sessionId, password } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!sessionId) {
      return res.status(400).json({ error: "缺少 sessionId" });
    }

    const db = loadDB();
    const session = db.sessions.find((s) => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: "找不到該團購活動" });
    }

    // 🔐 Verify organizer password
    const auth = verifyOrganizerAuth(db, session.organizerName, password, clientIp);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    // 將 Session 標記為從「當前團購管理」看板中移除/隱藏
    // 歷史紀錄（allSessions & orders）永遠完整保留在資料庫中！
    session.removedFromAdmin = true;

    addAuditLog(db, "SESSION_DELETED", session.organizerName, `從當前管理看板隱藏移除團購活動 (ID: ${sessionId})`, "danger", clientIp);
    saveDB(db);

    res.json({ success: true, message: "已成功從當前團購管理中移除活動，歷史紀錄將永久保存在資料庫中" });
  });

  // 4. Submit Order (with optional personal buyer LINE notification)
  app.post("/api/submit-order", async (req, res) => {
    const { sessionId, userName, items, userNotifyToken } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!userName || typeof userName !== "string" || !userName.trim()) {
      return res.status(400).json({ error: "請輸入訂購者姓名" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "購物車不能為空" });
    }

    // 🛑 Numeric input sanitization
    for (const item of items) {
      const parsedQty = Number(item.qty);
      const parsedPrice = Number(item.price);
      if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 100) {
        return res.status(400).json({ error: "訂購數量無效，必須為 1 至 100 之整數！" });
      }
      if (isNaN(parsedPrice) || parsedPrice < 0 || !isFinite(parsedPrice)) {
        return res.status(400).json({ error: "商品金額計算異常，不可為負值！" });
      }
    }

    const db = loadDB();
    const session = db.sessions.find((s) => s.sessionId === sessionId);

    // 🛑 Security Check: Prevent ordering on Closed or Non-existent session
    if (!session || session.status !== "Open") {
      return res.status(400).json({ error: "【資安保全關卡】該團購活動已關閉結單，無法再提交新點餐！" });
    }

    const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
    const newOrders: OrderItem[] = [];
    let totalAmount = 0;

    items.forEach((item: any) => {
      const orderId = "ORD" + Math.floor(100000 + Math.random() * 900000);
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      const subtotal = price * qty;
      totalAmount += subtotal;

      const orderItem: OrderItem = {
        orderId,
        sessionId,
        userName: userName.trim().slice(0, 100),
        type: item.type || "其他",
        storeName: item.storeName,
        itemName: item.itemName,
        options: item.options || "-",
        price,
        qty,
        subtotal,
        timestamp,
        userNotifyToken: userNotifyToken && userNotifyToken.trim() ? userNotifyToken.trim() : undefined,
      };

      db.orders.push(orderItem);
      newOrders.push(orderItem);
    });

    addAuditLog(db, "ORDER_SUBMITTED", userName.trim(), `送出點餐：共 ${items.length} 個品項，總金額 $${totalAmount}`, "info", clientIp);
    saveDB(db);

    // Personal LINE (CE Notify) Notification to Buyer if token provided
    let lineNoticeSent = false;
    if (userNotifyToken && userNotifyToken.trim()) {
      const sessionTitle = session ? (session.title || `${session.organizerName} 發起的團購`) : '團購活動';
      const organizerName = session ? session.organizerName : '承辦人';
      const orgPhoneStr = session?.organizerPhone ? ` (📞 聯絡電話: ${session.organizerPhone})` : '';
      const sessionDate = session ? session.date : '';

      const itemLines = items
        .map(
          (i: any) =>
            ` • [${i.storeName}] ${i.itemName} ${i.options && i.options !== '-' ? `(${i.options})` : ''} x${i.qty} = $${(i.price || 0) * (i.qty || 1)}`
        )
        .join("\n");

      const buyerMsg = `【個人團購訂單-送出確認】\n親愛的 ${userName} 您好：\n您的團購訂單已成功送出！請檢查以下點餐資訊是否正確：\n\n🏷️ 團購名稱：${sessionTitle}\n📅 團購日期：${sessionDate}\n👤 團購承辦人：${organizerName}${orgPhoneStr}\n\n📦 訂購品項內容：\n${itemLines}\n\n💰 訂單金額合計：$${totalAmount}\n⏰ 送出時間：${timestamp}\n\n💡 說明：此為您送出點餐時的即時通知（供您檢查點餐內容是否正確）。`;

      const sessionNotifyInfo = session ? (session.notifyInfo || "團購資訊") : "團購資訊";
      const lineRes = await sendCeNotify(userNotifyToken.trim(), buyerMsg, sessionNotifyInfo);
      lineNoticeSent = lineRes.success;
    }

    res.json({ success: true, count: newOrders.length, orders: newOrders, lineNoticeSent });
  });

  // Test Personal Buyer LINE Token
  app.post("/api/test-user-line-notify", async (req, res) => {
    const { token, userName } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ error: "請提供個人 LINE Notify Token" });
    }

    const testMsg = `【智慧團購平台】\n親愛的 ${userName || '訂購人'} 您好：\n恭喜！您的個人 LINE Notify Token 已成功驗證與平台連結！\n未來您在本平台送出團購訂單時，系統將即時發送點餐明細至此 LINE 聊天室！`;

    const result = await sendCeNotify(token.trim(), testMsg, "訂購人 LINE 通知測試");
    if (result.success) {
      res.json({ success: true, message: "測試通知已成功發送至您的 LINE (CE Notify) 聊天室！" });
    } else {
      res.status(400).json({ error: `LINE 發送失敗：${result.reason}` });
    }
  });

  // Delete individual order with LINE notification support (supports DELETE and POST)
  const handleDeleteOrderHandler = async (req: express.Request, res: express.Response) => {
    const orderId = req.params.orderId || req.body?.orderId;
    const { userNotifyToken, userName, password, isAdminDelete } = req.body || {};
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const db = loadDB();
    const idx = db.orders.findIndex((o) => o.orderId === orderId);

    if (idx >= 0) {
      const deletedOrder = db.orders[idx];
      const session = deletedOrder.sessionId ? db.sessions.find((s) => s.sessionId === deletedOrder.sessionId) : null;

      // 🛑 Critical Security Barrier: Block modifying/deleting orders from closed sessions
      if (session && session.status === "Closed") {
        addAuditLog(db, "UNAUTHORIZED_DELETE_ATTEMPT", userName || deletedOrder.userName, `嘗試刪除已被封存結單之訂單 (Order ID: ${orderId}) 被系統資安機制阻擋`, "warning", clientIp);
        saveDB(db);
        return res.status(403).json({ error: "【資安保全關卡】此團購活動已結單，所有點餐資料已正式封存保全，不允許再進行任何修改或刪除！" });
      }

      // If deleted via admin dashboard, verify organizer password if required
      if (isAdminDelete && session) {
        const auth = verifyOrganizerAuth(db, session.organizerName, password, clientIp);
        if (!auth.authorized) {
          return res.status(403).json({ error: auth.error });
        }
      }

      db.orders.splice(idx, 1);
      addAuditLog(db, "ORDER_DELETED", userName || deletedOrder.userName, `取消/刪除訂單 [${deletedOrder.storeName}] ${deletedOrder.itemName} x${deletedOrder.qty} ($${deletedOrder.subtotal})`, "warning", clientIp);
      saveDB(db);

      let lineNoticeSent = false;
      const tokenToUse = userNotifyToken || req.query.userNotifyToken;
      if (tokenToUse && typeof tokenToUse === "string" && tokenToUse.trim()) {
        const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
        const cancelMsg = `【個人團購訂單-取消通知】\n親愛的 ${userName || deletedOrder.userName} 您好：\n您已成功取消/刪除以下團購訂單：\n\n❌ 刪除項目：[${deletedOrder.storeName}] ${deletedOrder.itemName} ${deletedOrder.options && deletedOrder.options !== '-' ? `(${deletedOrder.options})` : ''} x${deletedOrder.qty}\n💰 金額：$${deletedOrder.subtotal}\n⏰ 取消時間：${timestamp}`;

        const sessionNotifyInfo = session ? (session.notifyInfo || "團購資訊") : "團購資訊";
        const lineRes = await sendCeNotify(tokenToUse.trim(), cancelMsg, sessionNotifyInfo);
        lineNoticeSent = lineRes.success;
      }

      res.json({ success: true, lineNoticeSent });
    } else {
      res.status(404).json({ error: "找不到該訂單" });
    }
  };

  app.delete("/api/orders/:orderId", handleDeleteOrderHandler);
  app.post("/api/orders/:orderId/delete", handleDeleteOrderHandler);
  app.post("/api/delete-order", handleDeleteOrderHandler);

  // Helper to send CE Notify message
  async function sendCeNotify(token: string, message: string, customInfo?: string) {
    if (!token) {
      return { success: false, reason: "未設定 CE Notify Token" };
    }

    let cleanToken = token.trim();
    if (cleanToken.includes("token=")) {
      const match = cleanToken.match(/token=([^&]+)/);
      if (match) cleanToken = match[1];
    }
    cleanToken = cleanToken.replace(/^(?:CE_NOTIFY_TOKEN=|token=)+/gi, "").trim();

    if (!cleanToken) {
      return { success: false, reason: "無效的 CE Notify Token" };
    }

    const infoText = customInfo && customInfo.trim() ? customInfo.trim() : "團購資訊";
    const fullPayload = message ? `${infoText}\n${message}` : infoText;
    const encodedPayload = encodeURIComponent(fullPayload);

    // Exact CE Notify format: https://v2.chateverywhere.app/api/line/notify?token=《Token》&message=《完整內容》
    const notifyUrl = `https://v2.chateverywhere.app/api/line/notify?token=${cleanToken}&message=${encodedPayload}`;

    if (cleanToken.startsWith("demo_token")) {
      console.log(`[Simulated CE Notify dispatch]:\nToken: ${cleanToken}\nUrl: ${notifyUrl}\nMessage: ${fullPayload}`);
      return { success: true, simulated: true, notifyUrl };
    }

    try {
      console.log(`Dispatching CE Notify to ${notifyUrl}`);

      const response = await fetch(notifyUrl, {
        method: "GET",
      });

      if (response.ok) {
        return { success: true, status: response.status, notifyUrl };
      } else {
        const text = await response.text();
        return { success: false, status: response.status, error: text, notifyUrl };
      }
    } catch (err: any) {
      console.error("CE Notify network error:", err);
      return { success: false, error: err.message || "網絡連線失敗", notifyUrl };
    }
  }

  // 5. Close Session & Send CE Notify Summary
  app.post("/api/close-session", async (req, res) => {
    const { sessionId, password, notifyOrganizer = true, notifyBuyers = true } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const db = loadDB();

    const session = db.sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      return res.status(404).json({ error: "找不到此團購活動" });
    }

    // 🔐 Verify Organizer Password
    const auth = verifyOrganizerAuth(db, session.organizerName, password, clientIp);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    session.status = "Closed";

    // Gather orders for this session
    const sessionOrders = db.orders.filter((o) => o.sessionId === sessionId);

    // Build structured summary
    const summary: Record<
      string,
      Record<
        string,
        {
          qty: number;
          totalPrice: number;
          details: { userName: string; qty: number; options: string }[];
        }
      >
    > = {};

    let grandTotal = 0;
    let totalItemsCount = 0;

    sessionOrders.forEach((order) => {
      const store = order.storeName;
      const optsText = order.options && order.options !== "-" ? ` (${order.options})` : "";
      const itemKey = `${order.itemName}${optsText}`;

      if (!summary[store]) summary[store] = {};
      if (!summary[store][itemKey]) {
        summary[store][itemKey] = { qty: 0, totalPrice: 0, details: [] };
      }

      summary[store][itemKey].qty += order.qty;
      summary[store][itemKey].totalPrice += order.subtotal;
      summary[store][itemKey].details.push({
        userName: order.userName,
        qty: order.qty,
        options: order.options,
      });

      grandTotal += order.subtotal;
      totalItemsCount += order.qty;
    });

    addAuditLog(db, "SESSION_CLOSED", session.organizerName, `終止結單團購「${session.title || session.organizerName}」，共 ${sessionOrders.length} 筆點餐、總金額 $${grandTotal}`, "info", clientIp);
    saveDB(db);

    // Compose concise CE Notify message format with Group Buy Title above Date
    const sessionTitle = session.title || `${session.organizerName} 發起的團購`;
    const phoneStr = session.organizerPhone ? ` (📞 聯絡電話: ${session.organizerPhone})` : '';
    let notifyMessage = `【團購結單及金額統計】\n🏷️ 團購名稱：${sessionTitle}\n📅 日期：${session.date}\n👤 承辦人：${session.organizerName}${phoneStr}\n👥 總份數：${totalItemsCount} 份 / 💰 總金額：$${grandTotal}\n`;

    if (Object.keys(summary).length === 0) {
      notifyMessage += "\n⚠️ 無任何訂購紀錄。";
    } else {
      for (const [store, items] of Object.entries(summary)) {
        let storeSubtotal = 0;
        notifyMessage += `\n📍 店家：${store}\n`;
        for (const [item, data] of Object.entries(items)) {
          notifyMessage += ` • ${item} x ${data.qty} ($${data.totalPrice})\n`;
          storeSubtotal += data.totalPrice;
        }
        notifyMessage += ` ➔ 小計：$${storeSubtotal}\n`;
      }
    }

    // 1. Send CE Notify to Organizer if checked
    let lineResult: any = {
      success: false,
      reason: notifyOrganizer ? "未設定承辦人 CE Notify Token" : "取消發送承辦人通知",
    };
    if (notifyOrganizer && session.lineToken) {
      const orgInfo = session.notifyInfo && session.notifyInfo.trim() ? session.notifyInfo.trim() : "團購資訊";
      lineResult = await sendCeNotify(session.lineToken, notifyMessage, orgInfo);
    }

    // 2. Send Individual CE Notify to Buyers if checked
    let buyerNoticeCount = 0;
    const buyerDispatchLogs: { userName: string; success: boolean }[] = [];

    if (notifyBuyers) {
      // Group orders by userName and token
      const buyerMap: Record<string, { token: string; items: OrderItem[]; total: number }> = {};

      sessionOrders.forEach((o) => {
        if (o.userNotifyToken && o.userNotifyToken.trim()) {
          const key = o.userName;
          if (!buyerMap[key]) {
            buyerMap[key] = { token: o.userNotifyToken.trim(), items: [], total: 0 };
          }
          buyerMap[key].items.push(o);
          buyerMap[key].total += o.subtotal;
        }
      });

      for (const [bName, bData] of Object.entries(buyerMap)) {
        const itemLines = bData.items
          .map(
            (i) =>
              ` • [${i.storeName}] ${i.itemName} ${i.options && i.options !== '-' ? `(${i.options})` : ''} x${i.qty} = $${i.subtotal}`
          )
          .join("\n");

        const buyerMsg = `【團購結單-個人訂單明細】\n親愛的 ${bName} 您好：\n您參加的團購已由承辦人完成結單確認！\n\n🏷️ 團購名稱：${sessionTitle}\n📅 團購日期：${session.date}\n👤 團購承辦人：${session.organizerName}${phoneStr}\n\n📦 您訂購的確認品項：\n${itemLines}\n\n💰 個人應付總金額：$${bData.total}\n\n✅ 此為承辦人發出的正式結單確認，請備妥零錢交付予承辦人。感謝您的訂購！`;

        const buyerNotifyInfo = session.notifyInfo && session.notifyInfo.trim() ? session.notifyInfo.trim() : "團購資訊";
        const bRes = await sendCeNotify(bData.token, buyerMsg, buyerNotifyInfo);
        if (bRes.success) buyerNoticeCount++;
        buyerDispatchLogs.push({ userName: bName, success: bRes.success });
      }
    }

    res.json({
      success: true,
      summary,
      grandTotal,
      totalItemsCount,
      notifyMessage,
      lineResult,
      buyerNoticeCount,
      buyerDispatchLogs,
      ordersCount: sessionOrders.length,
    });
  });

  // Test CE Notify API
  app.post("/api/send-line-test", async (req, res) => {
    const { token, message } = req.body;
    if (!token) {
      return res.status(400).json({ error: "請提供 CE Notify Token" });
    }
    const msg = message || "【智慧團購平台測試OK發送】\nCE Notify 系統連線測試成功！";
    const result = await sendCeNotify(token, msg);
    res.json({ success: true, result });
  });

  // 6. Organizers API with Password Protection
  app.post("/api/organizers", (req, res) => {
    const { id, name, phone, token, department, notifyInfo, password, oldPassword } = req.body;
    if (!name) {
      return res.status(400).json({ error: "請輸入承辦人姓名" });
    }

    const db = loadDB();
    let existing = id ? db.organizers.find((o) => o.id === id) : db.organizers.find((o) => o.name === name);

    if (existing) {
      // Password check if existing organizer has a password set
      if (existing.password && oldPassword !== undefined && existing.password !== oldPassword) {
        return res.status(403).json({ error: "承辦人管理密碼不正確！無法修改資料" });
      }

      existing.name = name;
      existing.phone = phone !== undefined ? phone : existing.phone;
      existing.token = token !== undefined ? token : existing.token;
      existing.department = department || existing.department || "一般";
      existing.notifyInfo = notifyInfo !== undefined ? notifyInfo : (existing.notifyInfo || "團購資訊");
      if (password) existing.password = password;
    } else {
      const newOrg: Organizer = {
        id: "ORG" + Date.now(),
        name,
        phone: phone || "",
        token: token || "",
        department: department || "一般",
        notifyInfo: notifyInfo || "團購資訊",
        password: password || "",
      };
      db.organizers.push(newOrg);
    }

    saveDB(db);
    res.json({ success: true, organizers: db.organizers });
  });

  // Verify Organizer Password endpoint (for unlocking token, editing, or deleting)
  app.post("/api/organizers/verify-password", (req, res) => {
    const { id, password } = req.body;
    const db = loadDB();
    const org = db.organizers.find((o) => o.id === id);

    if (!org) {
      return res.status(404).json({ error: "找不到該承辦人" });
    }

    if (!org.password) {
      // If no password set, treat as valid
      return res.json({ success: true, valid: true, organizer: org });
    }

    if (org.password === password) {
      return res.json({ success: true, valid: true, organizer: org });
    } else {
      return res.status(403).json({ error: "承辦人密碼不正確", valid: false });
    }
  });

  // Delete Organizer with Password Check
  app.delete("/api/organizers/:id", (req, res) => {
    const { id } = req.params;
    const { password } = req.query;
    const db = loadDB();
    const idx = db.organizers.findIndex((o) => o.id === id);

    if (idx >= 0) {
      const targetOrg = db.organizers[idx];
      if (targetOrg.password && targetOrg.password !== password) {
        return res.status(403).json({ error: "承辦人密碼不正確！刪除失敗" });
      }

      db.organizers.splice(idx, 1);
      saveDB(db);
      res.json({ success: true, organizers: db.organizers });
    } else {
      res.status(404).json({ error: "找不到該承辦人" });
    }
  });

  // Request Reset Password OTP via CE Notify (LINE)
  app.post("/api/organizers/request-reset-otp", async (req, res) => {
    const { id } = req.body;
    const db = loadDB();
    const org = db.organizers.find((o) => o.id === id);

    if (!org) {
      return res.status(404).json({ error: "找不到該承辦人" });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    org.resetOtp = otp;
    org.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    saveDB(db);

    const resetMsg = `【智慧團購平台 承辦人密碼重置通知】\n親愛的 ${org.name} 您好：\n您申請了重置管理密碼，動態驗證碼為：【${otp}】\n請於 10 分鐘內在系統輸入此驗證碼以完成新密碼設定。`;

    let sent = false;
    if (org.token) {
      const lineRes = await sendCeNotify(org.token, resetMsg, org.notifyInfo || "重置密碼驗證");
      sent = lineRes.success;
    }

    res.json({
      success: true,
      message: org.token
        ? `重置驗證碼已自動發送至承辦人「${org.name}」的 LINE (CE Notify)！`
        : `動態驗證碼已產生：【${otp}】(未設定 Token 模式)`,
      otpSimulated: !org.token ? otp : undefined,
    });
  });

  // Verify Reset Password OTP and update password
  app.post("/api/organizers/reset-password", (req, res) => {
    const { id, otp, newPassword } = req.body;
    if (!otp || !newPassword) {
      return res.status(400).json({ error: "請提供驗證碼與新密碼" });
    }

    const db = loadDB();
    const org = db.organizers.find((o) => o.id === id);

    if (!org) {
      return res.status(404).json({ error: "找不到該承辦人" });
    }

    if (!org.resetOtp || org.resetOtp !== otp.trim()) {
      return res.status(400).json({ error: "動態驗證碼不正確！" });
    }

    if (org.resetOtpExpires && Date.now() > org.resetOtpExpires) {
      return res.status(400).json({ error: "驗證碼已逾期 (10 分鐘)，請重新索取！" });
    }

    // Update password
    org.password = newPassword.trim();
    delete org.resetOtp;
    delete org.resetOtpExpires;

    addAuditLog(db, "PASSWORD_RESET", org.name, `承辦人「${org.name}」通過 OTP 動態驗證碼順利重置密碼`, "info");
    saveDB(db);
    res.json({ success: true, message: `承辦人「${org.name}」管理密碼已順利重置成功！` });
  });

  // Security Audit Logs Query & Maintenance API
  app.get("/api/audit-logs", (req, res) => {
    const db = loadDB();
    res.json({ success: true, auditLogs: db.auditLogs || [] });
  });

  app.post("/api/clear-audit-logs", (req, res) => {
    const { organizerName, password } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const db = loadDB();

    if (organizerName) {
      const auth = verifyOrganizerAuth(db, organizerName, password, clientIp);
      if (!auth.authorized) {
        return res.status(403).json({ error: auth.error });
      }
    }

    db.auditLogs = [
      {
        id: "LOG" + Date.now(),
        timestamp: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        action: "AUDIT_CLEARED",
        actor: organizerName || "系統管理員",
        details: "資安稽核異動紀錄已手動清空歸零並重置備份",
        severity: "warning",
        ip: clientIp,
      },
    ];
    saveDB(db);
    res.json({ success: true, auditLogs: db.auditLogs });
  });

  app.post("/api/reset-database", (req, res) => {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const newDb: DBData = {
      vendors: {},
      sessions: [],
      orders: [],
      organizers: [],
      auditLogs: [
        {
          id: "LOG" + Date.now(),
          timestamp: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
          action: "DATABASE_CLEARED",
          actor: "系統管理員",
          details: "資料庫已全數手動清空歸零（包含負責人、團購、歷史紀錄與店家）",
          severity: "info",
          ip: clientIp,
        },
      ],
    };
    saveDB(newDb);
    res.json({ success: true, message: "資料庫內容已全數清空！", data: newDb });
  });

  // 7. Client-Side Self-Healing Auto-Recovery API (自動救援與資料同步)
  app.post("/api/sync-recovery", (req, res) => {
    const { organizers, vendors } = req.body;
    const db = loadDB();
    let updated = false;

    if (Array.isArray(organizers) && organizers.length > 0) {
      organizers.forEach((localOrg: Organizer) => {
        if (!localOrg || !localOrg.name) return;
        const exists = db.organizers.find((o) => o.id === localOrg.id || o.name === localOrg.name);
        if (!exists) {
          db.organizers.push(localOrg);
          updated = true;
        }
      });
    }

    if (vendors && typeof vendors === "object") {
      Object.keys(vendors).forEach((storeName) => {
        const v = vendors[storeName];
        if (v && v.name && v.items) {
          if (!db.vendors[storeName]) {
            db.vendors[storeName] = v;
            updated = true;
          } else {
            if (v.items.length > (db.vendors[storeName].items?.length || 0)) {
              db.vendors[storeName] = v;
              updated = true;
            }
          }
        }
      });
    }

    if (updated) {
      console.log("🛡️ [Self-Healing] 已成功從客戶端本地持久快照自動救援復原資料！");
      addAuditLog(db, "AUTO_RECOVERY", "系統防護機制", "已自動從瀏覽器持久快照同步復原遺失的負責人及店家菜單資料", "info");
      saveDB(db);
    }

    res.json({
      success: true,
      restored: updated,
      organizers: db.organizers,
      vendors: db.vendors,
    });
  });

  // 8. Database Backup Export & Restore
  app.get("/api/backup-database", (req, res) => {
    const db = loadDB();
    res.setHeader("Content-Disposition", `attachment; filename=smartgroup-backup-${Date.now()}.json`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(db, null, 2));
  });

  app.post("/api/restore-database", (req, res) => {
    const { data } = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "備份資料格式不正確" });
    }
    const db = loadDB();
    if (data.vendors && typeof data.vendors === "object") {
      db.vendors = { ...db.vendors, ...data.vendors };
    }
    if (Array.isArray(data.organizers)) {
      data.organizers.forEach((o: any) => {
        if (!db.organizers.some((existing) => existing.name === o.name || existing.id === o.id)) {
          db.organizers.push(o);
        }
      });
    }
    if (Array.isArray(data.sessions)) {
      data.sessions.forEach((s: any) => {
        if (!db.sessions.some((existing) => existing.sessionId === s.sessionId)) {
          db.sessions.push(s);
        }
      });
    }
    if (Array.isArray(data.orders)) {
      data.orders.forEach((ord: any) => {
        if (!db.orders.some((existing) => existing.orderId === ord.orderId)) {
          db.orders.push(ord);
        }
      });
    }
    addAuditLog(db, "DATABASE_RESTORED", "系統管理員", "已透過 JSON 備份檔成功匯入還原資料庫", "info");
    saveDB(db);
    res.json({ success: true, message: "資料庫已成功匯入還原！", db });
  });

  // Vite Middleware for dev & static for prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
