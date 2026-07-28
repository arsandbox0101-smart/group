export type StoreType = '便當' | '飲料' | '甜點' | '團購商品' | '其他';

export interface SizeOption {
  name: string; // e.g. "中杯 (M)", "大杯 (L)", "小份", "大份"
  price: number; // e.g. 45, 60
}

export interface MenuItem {
  category: string;
  itemName: string;
  price: number;
  sizes?: SizeOption[];
}

export interface Vendor {
  name: string;
  type: StoreType;
  items: MenuItem[];
  phone?: string;
  address?: string;
  city?: string;
}

export interface Session {
  sessionId: string;
  title?: string;
  date: string;
  bentoStore: string;
  drinkStore: string;
  goodsStore?: string;
  deadline: string;
  status: 'Open' | 'Closed';
  organizerName: string;
  organizerPhone?: string;
  lineToken: string;
  ceNotifyToken?: string;
  note?: string;
  notifyInfo?: string;
  createdTime?: string;
  removedFromAdmin?: boolean;
}

export interface CartItem {
  storeName: string;
  type: StoreType;
  itemName: string;
  price: number;
  options: string;
  qty: number;
}

export interface OrderItem {
  orderId: string;
  sessionId: string;
  userName: string;
  type: StoreType;
  storeName: string;
  itemName: string;
  options: string;
  price: number;
  qty: number;
  subtotal: number;
  timestamp: string;
  userNotifyToken?: string;
}

export interface Organizer {
  id: string;
  name: string;
  phone?: string;
  token: string;
  department?: string;
  notifyInfo?: string;
  password?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  severity?: 'info' | 'warning' | 'danger';
  ip?: string;
}

export interface StoreItemSummary {
  qty: number;
  totalPrice: number;
  details: { userName: string; qty: number; options: string }[];
}

export interface SessionSummary {
  [storeName: string]: {
    [itemKey: string]: StoreItemSummary;
  };
}

export interface InitialDataResponse {
  vendors: Record<string, Vendor>;
  activeSession: Session | null;
  openSessions?: Session[];
  organizers: Organizer[];
  recentOrders: OrderItem[];
  allSessions: Session[];
  auditLogs?: AuditLog[];
}
