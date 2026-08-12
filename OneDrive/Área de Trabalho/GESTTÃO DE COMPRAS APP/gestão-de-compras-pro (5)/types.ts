
export interface Company {
    id: string;
    name: string;
    code: string;
    buyerPassword: string;
}

export interface AppConfig {
    restaurants: { id: string; name: string }[];
    sectors: { id: string; name: string }[];
    units: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    admPasswords?: Record<string, string>; // { restaurantId: "password" }
    productionTasks?: { id: string; restaurantId: string; sectorId: string; name: string; type?: 'task' | 'production' }[];
}

export interface Item {
    id: string;
    name: string;
    quantity: number;
    purchasedQuantity?: number; // Actual quantity bought
    unit: string;
    category: string;
    purchased: boolean;
    price: number;
    addedAt?: string;
    originalDate?: string; // Date when the item was first added (YYYY-MM-DD)

    // Delivery Tracking
    expectedDeliveryDate?: string | null; // YYYY-MM-DD
    isDelivered?: boolean;
}

export interface StockItem {
    id: string;
    name: string;
    unit: string;
    category: string;
    minStock: number;
    idealStock: number;
    maxStock: number;
    purchasePeriod: string;
    purchaseUnitDescription: string;
    lastPrice: number;
    avgPrice: number;
    purchaseCount: number;
    // currentStock?: number; // REMOVED/DEPRECATED
    stockByRestaurant?: Record<string, number>; // { restaurantId: quantity } -> Correct way to segregate stock
    associations: Record<string, string[]>; // { restaurantId: [sectorId, ...] }
    supplierIds?: string[]; // IDs of suppliers who sell this item
}

export interface Supplier {
    id: string;
    name: string;
    contactName: string;
    phone: string; // WhatsApp
    email: string;
    category?: string;
}

export interface StockCountItem {
    id: string;
    name: string;
    quantity: number | null;
}

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'sector' | 'buyer';
    senderName: string;
    timestamp: any; // Firestore Timestamp or ISO string
}

export interface Order {
    docId?: string; // Helper for UI
    restaurantId: string;
    sectorId: string;
    responsibleName: string;
    collaborators?: string[]; // List of names who edited this order
    orderDate: string;
    createdAt: any; // Firestore Timestamp
    items: Item[];
    stockCountRequested?: boolean;
    messages?: ChatMessage[];
    hasUnreadBuyerMessage?: boolean; // True if buyer sent a message sector hasn't seen
    hasUnreadSectorMessage?: boolean; // True if sector sent a message buyer hasn't seen
}

export interface Bill {
    id: string;
    restaurantId: string;
    supplier: string;
    value: number;
    paymentMethod: 'pix' | 'boleto' | 'dinheiro';
    pixKey?: string;
    dueDate: string;

    // File Metadata & Content
    fileName?: string;
    fileData?: string; // Base64 Content of the bill (invoice)

    status: 'pending' | 'paid';
    createdAt: any;
    createdBy: string;

    // Payment Metadata & Content
    paidAt?: any;
    receiptFileName?: string;
    receiptFileData?: string; // Base64 Content of the payment receipt
}

export interface StockCount {
    restaurantId: string;
    sectorId: string;
    countedBy: string;
    countedAt: any;
    status?: 'pending' | 'validated';
    validatedBy?: string;
    validatedAt?: any;
    items: { id: string; name: string; quantity: number }[];
}

export type ViewState = 'landing' | 'createCompany' | 'login' | 'sector' | 'adm' | 'buyer';
export interface ProductionListItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    scheduledDate: string; // YYYY-MM-DD
    originalDate: string;  // YYYY-MM-DD
    status: 'pending' | 'done';
    completedAt?: any;
    operatorName?: string;
    addedBy: 'buyer' | 'operator';
}

export interface DailyProduction {
    restaurantId: string;
    sectorId: string;
    date: string;
    tasks: {
        id: string;
        name: string;
        type?: 'task' | 'production';
        status: 'pending' | 'done' | 'needs_production';
        addedBy: 'buyer' | 'operator';
        completedAt?: any;
        operatorName?: string;
    }[];
    productionList?: ProductionListItem[];
}

export type BuyerSubView = 'orders' | 'stock' | 'reports' | 'financial' | 'settings' | 'countLists' | 'suppliers' | 'production';
