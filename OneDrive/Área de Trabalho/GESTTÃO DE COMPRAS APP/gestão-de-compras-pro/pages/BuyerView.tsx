
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, deleteDoc, Timestamp, increment, arrayUnion, arrayRemove, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { AppConfig, Order, StockItem, BuyerSubView, ChatMessage, Bill, StockCount, Item, Supplier, DailyProduction } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/UI';
import {
    LayoutDashboard, Package, FileBarChart, Settings, Share2,
    Bell, ChevronDown, Plus, Trash, MessageCircle, Send, Upload, Edit3, Save, DollarSign, CheckCircle, FileText, Clock, Camera, Download, ExternalLink, Trash2, Database, Eye, Loader2, ClipboardCheck, TrendingUp, Truck, AlertTriangle, AlertCircle, BarChart3, ShoppingCart, RefreshCw, CheckSquare
} from 'lucide-react';

interface Props {
    companyId: string;
    companyCode: string;
    config: AppConfig;
    stockItems: StockItem[];
    getRestaurantName: (id: string) => string;
    getSectorName: (id: string) => string;
    suppliers: Supplier[];
}

// Helper to remove undefined values before sending to Firestore
const sanitizeData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
};

const BuyerView: React.FC<Props> = ({ companyId, companyCode, config, stockItems, getRestaurantName, getSectorName, suppliers }) => {
    const [view, setView] = useState<BuyerSubView>('orders');
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-CA');
    });
    const [orders, setOrders] = useState<Record<string, Record<string, Order>>>({});
    const [stockCounts, setStockCounts] = useState<Record<string, StockCount>>({});

    // Price/Purchase Modal State
    const [priceModalData, setPriceModalData] = useState<{ orderId: string, restaurantId: string, item: any } | null>(null);
    const [priceInput, setPriceInput] = useState('');
    const [qtyInput, setQtyInput] = useState('');
    const [deliveryDateInput, setDeliveryDateInput] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Fast Purchase / Future Delivery State
    const [detailedPurchaseMode, setDetailedPurchaseMode] = useState(false);
    const [futureDeliveryModalData, setFutureDeliveryModalData] = useState<{ orderId: string, restaurantId: string, item: any } | null>(null);
    const [futureDeliveryDate, setFutureDeliveryDate] = useState('');

    // Delivery Confirmation Modal
    const [deliveryModalData, setDeliveryModalData] = useState<{ orderId: string, restaurantId: string, item: any } | null>(null);

    // Stock Validation Modal
    const [validationModalData, setValidationModalData] = useState<{ docId: string, restaurantId: string, count: StockCount } | null>(null);
    const [validationItems, setValidationItems] = useState<any[]>([]);

    // Chat Modal State
    const [chatOrderDocId, setChatOrderDocId] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Independent Purchase Modal State (CART)
    const [independentModalOpen, setIndependentModalOpen] = useState(false);
    const [indepGlobal, setIndepGlobal] = useState({ restaurantId: '', deliveryDate: '' });
    const [indepForm, setIndepForm] = useState({ itemName: '', quantity: '', unitPrice: '' });
    const [indepCart, setIndepCart] = useState<any[]>([]);
    const [indepSuggestions, setIndepSuggestions] = useState<StockItem[]>([]);

    // Quotation Modal
    const [quotationModalOpen, setQuotationModalOpen] = useState(false);
    const [quotationItems, setQuotationItems] = useState<Item[]>([]);

    const menuItems = [
        { id: 'orders', label: 'Pedidos do Dia', icon: LayoutDashboard },
        { id: 'stock', label: 'Gestão de Estoque', icon: Package },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
        { id: 'financial', label: 'Financeiro', icon: DollarSign },
        { id: 'countLists', label: 'Listas de Contagem', icon: ClipboardCheck },
        { id: 'production', label: 'Produção (Checklist)', icon: CheckSquare },
        { id: 'reports', label: 'Relatórios', icon: FileBarChart },
        { id: 'settings', label: 'Configurações', icon: Settings },
    ] as const;
    const handleManualSync = async () => {
        setIsUpdating(true);
        try {
            let changesMade = 0;
            
            const thirtyDaysAgo = new Date(selectedDate + 'T00:00:00');
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-CA');

            const q = query(
                collection(db, `${BASE_PATH}/companies/${companyId}/daily_orders`),
                where("orderDate", ">=", thirtyDaysAgoStr),
                where("orderDate", "<", selectedDate)
            );
            const pastOrdersSnap = await getDocs(q);
            
            const pastOrdersBySector: Record<string, Order[]> = {};
            pastOrdersSnap.docs.forEach(d => {
                const data = d.data() as Order;
                const key = `${data.restaurantId}_${data.sectorId}`;
                if (!pastOrdersBySector[key]) pastOrdersBySector[key] = [];
                pastOrdersBySector[key].push(data);
            });

            for (const key in pastOrdersBySector) {
                pastOrdersBySector[key].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
            }

            const syncPromises = config.restaurants.flatMap(r => 
                config.sectors.map(async (s) => {
                    const key = `${r.id}_${s.id}`;
                    const lastOrder = pastOrdersBySector[key]?.[0];
                    
                    if (lastOrder) {
                        const itemsToCarry = lastOrder.items.filter((i: any) => {
                            if (!i.purchased) return true;
                            if (i.purchased && i.expectedDeliveryDate && !i.isDelivered) return true;
                            return false;
                        }).map((i: any) => ({
                            ...i,
                            originalDate: i.originalDate || lastOrder!.orderDate,
                            price: i.purchased ? i.price : 0,
                            addedAt: i.purchased ? i.addedAt : '(Pendente)',
                            purchased: i.purchased || false
                        }));

                        if (itemsToCarry.length > 0) {
                            const todayDocId = `${selectedDate}_${r.id}_${s.id}`;
                            const todayRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, todayDocId);
                            const todaySnap = await getDoc(todayRef);
                            
                            if (!todaySnap.exists()) {
                                changesMade++;
                                await setDoc(todayRef, {
                                    restaurantId: r.id,
                                    sectorId: s.id,
                                    responsibleName: "Sistema (Auto)",
                                    collaborators: ["Sistema"],
                                    orderDate: selectedDate,
                                    createdAt: Timestamp.now(),
                                    items: itemsToCarry,
                                    stockCountRequested: false
                                });
                            } else {
                                const currentItems = todaySnap.data().items || [];
                                const currentIds = new Set(currentItems.map((ci: any) => ci.id));
                                const itemsToAdd = itemsToCarry.filter((ni: any) => !currentIds.has(ni.id));

                                if (itemsToAdd.length > 0) {
                                    changesMade++;
                                    await updateDoc(todayRef, {
                                        items: arrayUnion(...itemsToAdd)
                                    });
                                }
                            }
                        }
                    }
                })
            );
            
            await Promise.all(syncPromises);
            if (changesMade > 0) alert(`${changesMade} setores sincronizados com pendências.`);
        } catch (e) {
            console.error(e);
            alert("Erro ao sincronizar.");
        }
        setIsUpdating(false);
    };

    // Fetch Orders
    useEffect(() => {
        if (view !== 'orders') return;

        // --- NEW: Auto-Check for Pending Items (Carry Over) for ALL sectors ---
        const checkForPendingItems = async () => {
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (selectedDate !== todayStr) return; // Only run for "today"

            // Iterate all Rest/Sector combos
            for (const r of config.restaurants) {
                for (const s of config.sectors) {
                    const todayDocId = `${selectedDate}_${r.id}_${s.id}`;
                    // Optimisation: We could check if it's already in 'orders' state, but
                    // Firestore reads are cheap enough for this specific robustness check on load.
                    // To avoid flicker/over-reads, we can check if we already have it in state? 
                    // No, state might not be loaded yet. Let's do a direct check or relying on the missing gap.

                    const todayRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, todayDocId);
                    const todaySnap = await getDoc(todayRef);

                    // Logic updated to MERGE pending items if today's order exists
                    let lastOrder: Order | null = null;
                    for (let i = 1; i <= 30; i++) {
                        const d = new Date();
                        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
                        d.setDate(d.getDate() - i);
                        const pastDateStr = d.toLocaleDateString('en-CA');
                        const pastDocId = `${pastDateStr}_${r.id}_${s.id}`;
                        const pastSnap = await getDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, pastDocId));

                        if (pastSnap.exists()) {
                            lastOrder = pastSnap.data() as Order;
                            break;
                        }
                    }

                    if (lastOrder) {
                        const itemsToCarry = lastOrder.items.filter((i: any) => {
                            if (!i.purchased) return true;
                            if (i.purchased && i.expectedDeliveryDate && !i.isDelivered) return true;
                            return false;
                        }).map((i: any) => ({
                            ...i,
                            originalDate: i.originalDate || lastOrder!.orderDate,
                            price: i.purchased ? i.price : 0, // Keep price if purchased (delivery pending), reset if not
                            addedAt: i.purchased ? i.addedAt : '(Pendente)',
                            purchased: i.purchased || false // Keep status
                        }));

                        if (itemsToCarry.length > 0) {
                            console.log(`Carrying over ${itemsToCarry.length} items for ${r.name}/${s.name}`);
                            if (!todaySnap.exists()) {
                                await setDoc(todayRef, {
                                    restaurantId: r.id,
                                    sectorId: s.id,
                                    responsibleName: "Sistema (Auto)",
                                    collaborators: ["Sistema"],
                                    orderDate: selectedDate,
                                    createdAt: Timestamp.now(),
                                    items: itemsToCarry,
                                    stockCountRequested: false
                                });
                            } else {
                                // Merge if exists
                                const currentItems = todaySnap.data().items || [];
                                const currentIds = new Set(currentItems.map((ci: any) => ci.id));
                                const itemsToAdd = itemsToCarry.filter((ni: any) => !currentIds.has(ni.id));

                                if (itemsToAdd.length > 0) {
                                    await updateDoc(todayRef, {
                                        items: arrayUnion(...itemsToAdd)
                                    });
                                }
                            }
                        }
                    }
                }
            }
        };

        // Auto-run sync on mount if today
        const todayStr = new Date().toLocaleDateString('en-CA');
        if (selectedDate === todayStr) {
            handleManualSync();
        }
        // ---------------------------------------------------------------------

        const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/daily_orders`), where("orderDate", "==", selectedDate));
        const unsub = onSnapshot(q, async (snap) => {
            const newOrders: any = {};
            const countPromises: any[] = [];

            snap.docs.forEach(d => {
                const data = d.data() as Order;
                if (!newOrders[data.restaurantId]) newOrders[data.restaurantId] = {};
                newOrders[data.restaurantId][data.sectorId] = { ...data, docId: d.id };

                countPromises.push(getDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_counts`, d.id)).then(s => ({
                    id: d.id,
                    data: s.exists() ? s.data() : null
                })));
            });

            const counts = await Promise.all(countPromises);
            const countMap: any = {};
            counts.forEach(c => countMap[c.id] = c.data);

            setOrders(newOrders);
            setStockCounts(countMap);
        });
        return () => unsub();
    }, [companyId, selectedDate, view, config]);

    // Scroll chat
    useEffect(() => {
        if (chatOrderDocId && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatOrderDocId, orders]);

    // Mark as read when chat opens
    useEffect(() => {
        if (chatOrderDocId) {
            let foundOrder: Order | null = null;
            Object.values(orders).forEach(rest => {
                Object.values(rest).forEach(o => {
                    if (o.docId === chatOrderDocId) foundOrder = o;
                })
            });

            if (foundOrder && (foundOrder as Order).hasUnreadSectorMessage) {
                updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, chatOrderDocId), { hasUnreadSectorMessage: false });
            }
        }
    }, [chatOrderDocId, orders, companyId]);

    // --- Stock Update Helper (Restaurant Specific) ---
    const addToStock = async (restaurantId: string, itemName: string, qty: number) => {
        if (!restaurantId) return;
        const stockItem = stockItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (stockItem) {
            try {
                await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, stockItem.id), {
                    [`stockByRestaurant.${restaurantId}`]: increment(qty)
                });
            } catch (e) { console.error("Error updating stock count", e); }
        }
    };

    // --- Actions ---

    // 1. Purchase Actions
    const handleItemClick = (orderDocId: string, restaurantId: string, item: any) => {
        if (item.purchased) {
            // Uncheck: Reset price and purchasedQty
            updateItemStatus(orderDocId, item, false, 0, item.quantity, null);
        } else {
            if (detailedPurchaseMode) {
                // Open modal to confirm price AND quantity
                setPriceModalData({ orderId: orderDocId, restaurantId, item });
                setPriceInput('');
                setQtyInput(String(item.quantity)); // Default to requested qty
                setDeliveryDateInput(''); // Reset delivery date
            } else {
                // Fast purchase without price update
                updateItemStatus(orderDocId, item, true, 0, item.quantity, null);
            }
        }
    };

    const confirmFutureDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!futureDeliveryModalData || !futureDeliveryDate || isUpdating) return;
        setIsUpdating(true);
        const { orderId, item } = futureDeliveryModalData;
        await updateItemStatus(orderId, item, true, 0, item.quantity, futureDeliveryDate);
        setFutureDeliveryModalData(null);
        setIsUpdating(false);
    };

    const confirmPrice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!priceModalData || isUpdating) return;

        setIsUpdating(true);
        const unitPrice = parseFloat(priceInput.replace(',', '.')) || 0;
        const finalQty = parseFloat(qtyInput.replace(',', '.')) || 0;
        const deliveryDate = deliveryDateInput ? deliveryDateInput : null;

        // Calculate Total Price for the Order record
        const totalPrice = unitPrice * finalQty;

        await updateItemStatus(priceModalData.orderId, priceModalData.item, true, totalPrice, finalQty, deliveryDate);

        // Update Stock Average using Unit Price AND Added Quantity
        await updateStockAverage(priceModalData.item.name, unitPrice, finalQty);

        // Immediate Stock Update if no delivery date (Immediate delivery)
        if (!deliveryDate) {
            await addToStock(priceModalData.restaurantId, priceModalData.item.name, finalQty);
        }

        setIsUpdating(false);
        setPriceModalData(null);
    };

    const updateItemStatus = async (orderDocId: string, item: any, purchased: boolean, price: number, purchasedQuantity: number, expectedDeliveryDate: string | null) => {
        try {
            const orderRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);
            const orderSnap = await getDoc(orderRef);

            if (orderSnap.exists()) {
                const items = orderSnap.data().items.map((i: any) =>
                    i.id === item.id ? {
                        ...i,
                        purchased,
                        price: price || 0, // Total Price stored in Order
                        purchasedQuantity: purchasedQuantity || 0,
                        // FIX: Explicitly handle undefined to ensure null is stored
                        expectedDeliveryDate: (purchased && expectedDeliveryDate) ? expectedDeliveryDate : null,
                        isDelivered: false // Reset delivery status on new purchase update
                    } : i
                );
                await updateDoc(orderRef, { items: sanitizeData(items) });
            }
        } catch (e) {
            console.error("Error updating item:", e);
            alert("Erro ao atualizar item: " + (e as any).message);
        }
    };

    const confirmDelivery = async () => {
        if (!deliveryModalData) return;
        try {
            const { orderId, restaurantId, item } = deliveryModalData;
            const orderRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderId);
            const orderSnap = await getDoc(orderRef);

            if (orderSnap.exists()) {
                const items = orderSnap.data().items.map((i: any) =>
                    i.id === item.id ? { ...i, isDelivered: true } : i
                );
                await updateDoc(orderRef, { items });

                // Update Stock for SPECIFIC RESTAURANT
                const qtyToAdd = item.purchasedQuantity || item.quantity;
                await addToStock(restaurantId, item.name, qtyToAdd);

                alert("Entrega confirmada e estoque atualizado!");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao confirmar recebimento.");
        }
        setDeliveryModalData(null);
    };

    const updateStockAverage = async (itemName: string, newUnitPrice: number, qtyAdded: number) => {
        if (newUnitPrice <= 0 || qtyAdded <= 0) return;
        const sItem = stockItems.find(s => s.name === itemName);

        if (sItem) {
            try {
                // 1. Calculate Total Current Stock across all restaurants
                let totalCurrentStock = 0;
                if (sItem.stockByRestaurant) {
                    Object.values(sItem.stockByRestaurant).forEach((q: any) => totalCurrentStock += (Number(q) || 0));
                }

                // 2. Weighted Average Calculation
                const currentTotalValue = totalCurrentStock * (sItem.avgPrice || 0);
                const newPurchaseValue = qtyAdded * newUnitPrice;
                const newTotalStock = totalCurrentStock + qtyAdded;

                let newAvg = sItem.avgPrice || newUnitPrice;

                if (newTotalStock > 0) {
                    newAvg = (currentTotalValue + newPurchaseValue) / newTotalStock;
                }

                await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, sItem.id), {
                    lastPrice: newUnitPrice,
                    avgPrice: newAvg,
                    purchaseCount: increment(1)
                });
            } catch (e) { console.error("Error updating stock avg:", e); }
        }
    };

    // 2. Stock Validation Actions
    const openValidationModal = (docId: string, restaurantId: string, count: StockCount) => {
        setValidationModalData({ docId, restaurantId, count });
        setValidationItems(count.items.map(i => ({ ...i }))); // Clone for editing
    };

    const saveValidation = async () => {
        if (!validationModalData) return;
        try {
            // Update Stock Count Status
            await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_counts`, validationModalData.docId), {
                items: sanitizeData(validationItems),
                status: 'validated',
                validatedBy: 'Comprador',
                validatedAt: Timestamp.now()
            });

            // Update Real-Time Stock Levels for SPECIFIC RESTAURANT
            const batch = writeBatch(db);
            const restId = validationModalData.restaurantId;

            validationItems.forEach(vi => {
                const stockItem = stockItems.find(si => si.id === vi.id);
                if (stockItem) {
                    const ref = doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, stockItem.id);
                    batch.update(ref, { [`stockByRestaurant.${restId}`]: Number(vi.quantity) });
                }
            });
            await batch.commit();

            alert("Estoque validado e atualizado.");
            setValidationModalData(null);
        } catch (e) {
            console.error(e);
            alert("Erro ao validar estoque.");
        }
    };

    const createOrderFromValidation = () => {
        if (!validationModalData) return;

        const itemsToOrder: any[] = [];
        validationItems.forEach(vi => {
            const stockItem = stockItems.find(si => si.id === vi.id);
            if (stockItem && stockItem.maxStock && stockItem.maxStock > vi.quantity) {
                const diff = stockItem.maxStock - vi.quantity;
                if (diff > 0) {
                    itemsToOrder.push({
                        id: crypto.randomUUID(),
                        itemName: vi.name,
                        quantity: diff,
                        unitPrice: 0, // Needs manual input or last price
                        unit: stockItem.unit,
                        category: stockItem.category,
                        total: 0
                    });
                }
            }
        });

        if (itemsToOrder.length === 0) return alert("Nenhum item abaixo do estoque máximo.");

        setIndepCart(itemsToOrder);
        setIndepGlobal(p => ({ ...p, restaurantId: validationModalData.restaurantId }));
        setValidationModalData(null);
        setIndependentModalOpen(true);
        alert(`${itemsToOrder.length} itens sugeridos para compra. Revise os preços no carrinho.`);
    };

    // 3. Misc Actions
    const requestStockCount = async (docId: string) => {
        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, docId), { stockCountRequested: true });
        alert("Solicitação enviada.");
    };

    const handleSendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatOrderDocId || !chatMessage.trim()) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: chatMessage.trim(),
            sender: 'buyer',
            senderName: 'Comprador',
            timestamp: Timestamp.now()
        };

        try {
            await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, chatOrderDocId), {
                messages: arrayUnion(newMessage),
                hasUnreadBuyerMessage: true
            });
            setChatMessage('');
        } catch (e) {
            console.error("Error sending message", e);
        }
    };

    const getChatMessages = () => {
        if (!chatOrderDocId) return [];
        let msgs: ChatMessage[] = [];
        Object.values(orders).forEach(rest => {
            Object.values(rest).forEach(o => {
                if (o.docId === chatOrderDocId && o.messages) msgs = o.messages;
            })
        });
        return msgs;
    };

    const shareLink = () => {
        // FIX: Ensure the link matches the Route path /app/:code
        const url = `${window.location.origin}${window.location.pathname}#/app/${companyCode}`;
        navigator.clipboard.writeText(url);
        alert("Link copiado: " + url);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr || dateStr === selectedDate) return "";
        const [y, m, d] = dateStr.split('-');
        return `(${d}/${m})`;
    };

    // 4. Independent Purchase Logic (Cart)
    const handleIndepSearch = (val: string) => {
        setIndepForm(p => ({ ...p, itemName: val }));
        if (val.length < 2) {
            setIndepSuggestions([]);
            return;
        }
        const filtered = stockItems.filter(i =>
            i.name.toLowerCase().includes(val.toLowerCase())
        );
        setIndepSuggestions(filtered);
    };

    const addToIndepCart = () => {
        if (!indepForm.itemName || !indepForm.quantity || !indepForm.unitPrice) return;

        const qty = parseFloat(indepForm.quantity.replace(',', '.'));
        const price = parseFloat(indepForm.unitPrice.replace(',', '.'));

        if (isNaN(qty) || isNaN(price)) return alert("Valores inválidos");

        const stockItem = stockItems.find(i => i.name.toLowerCase() === indepForm.itemName.toLowerCase());
        const unit = stockItem ? stockItem.unit : (config.units[0]?.name || 'un');
        const category = stockItem ? stockItem.category : (config.categories[0]?.name || 'Outros');

        setIndepCart(prev => [...prev, {
            id: crypto.randomUUID(),
            itemName: indepForm.itemName,
            quantity: qty,
            unitPrice: price,
            unit,
            category,
            total: qty * price
        }]);

        setIndepForm({ itemName: '', quantity: '', unitPrice: '' });
        setIndepSuggestions([]);
    };

    const removeFromIndepCart = (id: string) => {
        setIndepCart(prev => prev.filter(i => i.id !== id));
    };

    const handleIndependentPurchaseBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!indepGlobal.restaurantId) return alert("Selecione a empresa.");
        if (indepCart.length === 0) return alert("Carrinho vazio.");

        setIsUpdating(true);
        try {
            // FIX: Ensure deliveryDate is null, not undefined. Firestore throws error on undefined.
            const deliveryDate = indepGlobal.deliveryDate || null;
            const sectorId = 'independent';
            const orderDocId = `${selectedDate}_${indepGlobal.restaurantId}_${sectorId}`;
            const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);

            const itemsToAdd: Item[] = indepCart.map(item => ({
                id: crypto.randomUUID(),
                name: item.itemName,
                quantity: item.quantity,
                purchasedQuantity: item.quantity,
                unit: item.unit,
                category: item.category,
                purchased: true,
                price: item.total,
                addedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                originalDate: selectedDate,
                expectedDeliveryDate: deliveryDate, // Pass null if empty
                isDelivered: !deliveryDate
            }));

            // Use sanitizeData to ensure no undefined values are passed
            const sanitizedItems = sanitizeData(itemsToAdd);

            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                await updateDoc(docRef, { items: arrayUnion(...sanitizedItems) });
            } else {
                await setDoc(docRef, {
                    restaurantId: indepGlobal.restaurantId,
                    sectorId,
                    responsibleName: 'Comprador (Avulso)',
                    collaborators: ['Comprador'],
                    orderDate: selectedDate,
                    createdAt: Timestamp.now(),
                    items: sanitizedItems,
                    stockCountRequested: false
                });
            }

            // Update Stock & Avg Price
            for (const item of indepCart) {
                await updateStockAverage(item.itemName, item.unitPrice, item.quantity);
                if (!deliveryDate) {
                    await addToStock(indepGlobal.restaurantId, item.itemName, item.quantity);
                }
            }

            alert("Compra registrada com sucesso!");
            setIndependentModalOpen(false);
            setIndepCart([]);
            setIndepGlobal({ restaurantId: '', deliveryDate: '' });

        } catch (error) {
            console.error(error);
            alert("Erro ao registrar compra.");
        }
        setIsUpdating(false);
    };

    // Helper for delivery visuals
    const renderDeliveryStatus = (item: any, orderDocId: string, restaurantId: string) => {
        if (!item.purchased) return null;

        if (item.isDelivered) {
            return (
                <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-200 animate-pulse">
                    <CheckCircle className="w-3 h-3" /> CHEGOU!!
                </div>
            );
        }

        if (item.expectedDeliveryDate) {
            const today = new Date().toLocaleDateString('en-CA');
            const isLate = today > item.expectedDeliveryDate;

            if (isLate) {
                return (
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeliveryModalData({ orderId: orderDocId, restaurantId, item }); }}
                        className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded border border-red-200 animate-bounce hover:bg-red-100"
                        title="Clique para confirmar recebimento"
                    >
                        <AlertTriangle className="w-3 h-3" /> ATENÇÃO NÃO CHEGOU!!!
                    </button>
                );
            } else {
                return (
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeliveryModalData({ orderId: orderDocId, restaurantId, item }); }}
                        className="flex items-center gap-1 text-amber-600 font-medium text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200 hover:bg-amber-100"
                        title={`Entrega prevista: ${formatDate(item.expectedDeliveryDate)}. Clique para confirmar.`}
                    >
                        <Truck className="w-3 h-3" /> {formatDate(item.expectedDeliveryDate)}
                    </button>
                );
            }
        }

        // Add truck button if purchased but no date set yet
        return (
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeliveryModalData({ orderId: orderDocId, restaurantId, item }); }}
                className="text-gray-300 hover:text-amber-500"
                title="Confirmar Entrega"
            >
                <Truck className="w-4 h-4" />
            </button>
        );
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-brand-800">Comprador</h2>
                    <p className="text-xs text-brand-600 font-bold mt-1">v2.0 FIX - {companyCode}</p>
                </div>
                <nav className="px-4 space-y-1">
                    {[
                        { id: 'orders', label: 'Pedidos do Dia', icon: LayoutDashboard },
                        { id: 'stock', label: 'Gestão de Estoque', icon: Package },
                        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
                        { id: 'financial', label: 'Financeiro / Contas', icon: DollarSign },
                        { id: 'countLists', label: 'Listas de Contagem', icon: ClipboardCheck },
                        { id: 'production', label: 'Produção (Checklist)', icon: CheckSquare },
                        { id: 'reports', label: 'Relatórios / Projeção', icon: FileBarChart },
                        { id: 'settings', label: 'Configurações', icon: Settings },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as BuyerSubView)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === item.id ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}
                    <div className="pt-4 mt-4 border-t">
                        <button onClick={shareLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                            <Share2 className="w-5 h-5" /> Partilhar Acesso
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                {view === 'orders' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border gap-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
                                <label className="flex items-center gap-2 cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md border border-blue-100 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={detailedPurchaseMode} 
                                        onChange={e => setDetailedPurchaseMode(e.target.checked)} 
                                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-brand-800">Atualizar Preços e Estoque ao Comprar</span>
                                </label>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <Button
                                    onClick={() => handleManualSync()}
                                    title="Forçar verificação de pendências de dias anteriores"
                                    className="bg-blue-100 text-brand-700 hover:bg-blue-200 border-blue-200"
                                    isLoading={isUpdating}
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar
                                </Button>
                                <Button onClick={() => setIndependentModalOpen(true)} className="bg-brand-600 text-white shadow-md hover:bg-brand-700">
                                    <ShoppingCart className="w-4 h-4 mr-2" /> Nova Compra (Avulsa)
                                </Button>
                            </div>
                        </div>

                        {Object.keys(orders).length === 0 ? (
                            <div className="text-center py-20 text-gray-400">Nenhum pedido encontrado para esta data.</div>
                        ) : (
                            Object.entries(orders).map(([restId, sectorOrders]) => (
                                <div key={restId} className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-800 ml-1">{getRestaurantName(restId)}</h3>
                                    {Object.entries(sectorOrders).map(([secId, order]) => (
                                        <Card key={secId} className={`border-l-4 ${secId === 'independent' ? 'border-l-green-500 bg-green-50/20' : 'border-l-brand-500'}`}>
                                            <details open className="group">
                                                <summary className="flex justify-between items-center cursor-pointer list-none">
                                                    <div>
                                                        <span className="font-bold text-lg">
                                                            {secId === 'independent' ? 'Compras Avulsas' : getSectorName(secId)}
                                                        </span>
                                                        <span className="text-gray-500 text-sm ml-2">
                                                            - {order.collaborators && order.collaborators.length > 0
                                                                ? order.collaborators.join(', ')
                                                                : order.responsibleName}
                                                        </span>
                                                        {order.hasUnreadSectorMessage && (
                                                            <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full animate-pulse font-bold">Nova Mensagem</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {secId !== 'independent' && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.preventDefault(); setChatOrderDocId(order.docId || null); }}
                                                                    className={`p-2 rounded-full hover:bg-gray-100 ${order.hasUnreadSectorMessage ? 'text-blue-600' : 'text-gray-400'}`}
                                                                    title="Chat com Setor"
                                                                >
                                                                    <MessageCircle className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.preventDefault(); requestStockCount(order.docId!); }}
                                                                    className={`p-2 rounded-full hover:bg-gray-100 ${order.stockCountRequested ? 'text-amber-500' : 'text-gray-400'}`}
                                                                    title="Solicitar Contagem"
                                                                >
                                                                    <Bell className="w-5 h-5" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                                                    </div>
                                                </summary>

                                                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    {/* Items List */}
                                                    <div>
                                                        <div className="flex justify-between items-center mb-3 pb-1 border-b">
                                                            <h4 className="font-semibold">Lista de Compras</h4>
                                                            <Button
                                                                variant="secondary"
                                                                className="text-xs h-7"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    const itemsToQuote = order.items.filter((i: any) => !i.purchased);
                                                                    if (itemsToQuote.length === 0) return alert("Nenhum item pendente para cotar.");
                                                                    setQuotationItems(itemsToQuote);
                                                                    setQuotationModalOpen(true);
                                                                }}
                                                            >
                                                                <Truck className="w-3 h-3 mr-1" /> Cotação
                                                            </Button>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {order.items.sort((a: any, b: any) => Number(a.purchased) - Number(b.purchased)).map((item: any) => (
                                                                <div
                                                                    key={item.id}
                                                                    className={`flex items-center gap-3 p-3 rounded border transition-all ${item.purchased
                                                                        ? 'bg-gray-50 border-transparent'
                                                                        : 'bg-white border-transparent hover:border-brand-200 hover:bg-brand-50/30 shadow-sm'
                                                                        }`}
                                                                >
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleItemClick(order.docId!, order.restaurantId, item);
                                                                        }}
                                                                        className="flex-1 flex items-center gap-3 cursor-pointer"
                                                                    >
                                                                        <div className="relative flex items-center justify-center pointer-events-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={item.purchased}
                                                                                readOnly
                                                                                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-300"
                                                                            />
                                                                        </div>
                                                                        <div className={`flex-1 select-none ${item.purchased ? 'text-gray-600' : 'text-gray-800'}`}>
                                                                            <div className="flex items-center gap-2">
                                                                                {item.originalDate && item.originalDate !== selectedDate && (
                                                                                    <span className="text-red-500 font-bold text-xs">{formatDate(item.originalDate)}</span>
                                                                                )}
                                                                                <span className={`font-medium ${item.purchased ? 'line-through decoration-gray-400' : ''}`}>{item.name}</span>
                                                                            </div>

                                                                            <span className="text-sm text-gray-500 block">
                                                                                {item.purchased && item.purchasedQuantity && item.purchasedQuantity !== item.quantity
                                                                                    ? <><span className="line-through text-xs mr-1">{item.quantity}</span>{item.purchasedQuantity}</>
                                                                                    : item.quantity} {item.unit}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                                        {item.price > 0 && (
                                                                            <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-sm font-bold border border-green-100">
                                                                                R$ {item.price.toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                        {renderDeliveryStatus(item, order.docId!, order.restaurantId)}
                                                                        {!item.purchased && (
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    if (detailedPurchaseMode) {
                                                                                        setPriceModalData({ orderId: order.docId!, restaurantId: order.restaurantId, item });
                                                                                        setPriceInput('');
                                                                                        setQtyInput(String(item.quantity));
                                                                                        setDeliveryDateInput('');
                                                                                    } else {
                                                                                        setFutureDeliveryModalData({ orderId: order.docId!, restaurantId: order.restaurantId, item });
                                                                                        setFutureDeliveryDate('');
                                                                                    }
                                                                                }}
                                                                                className="p-1.5 rounded-md text-blue-500 hover:bg-blue-100 transition-colors"
                                                                                title="Agendar Entrega Futura"
                                                                            >
                                                                                <Truck className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Stock Count Display (Hide for Independent) */}
                                                    {secId !== 'independent' && (
                                                        <div className="bg-gray-50 p-4 rounded-lg">
                                                            <div className="flex justify-between items-center mb-3 pb-1 border-b">
                                                                <h4 className="font-semibold text-gray-700">Contagem de Estoque</h4>
                                                                {stockCounts[order.docId!] && stockCounts[order.docId!].status === 'pending' && (
                                                                    <Button
                                                                        onClick={(e) => { e.preventDefault(); openValidationModal(order.docId!, order.restaurantId, stockCounts[order.docId!]); }}
                                                                        className="text-xs py-1 h-7 bg-amber-500 hover:bg-amber-600 text-white border-none"
                                                                    >
                                                                        Validar
                                                                    </Button>
                                                                )}
                                                                {stockCounts[order.docId!] && stockCounts[order.docId!].status === 'validated' && (
                                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold flex items-center gap-1">
                                                                        <ClipboardCheck className="w-3 h-3" /> Validado
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {stockCounts[order.docId!] ? (
                                                                <ul className="space-y-2 text-sm">
                                                                    {stockCounts[order.docId!].items.map((i: any) => {
                                                                        const stockDef = stockItems.find(si => si.id === i.id);
                                                                        const suggestion = stockDef && stockDef.idealStock ? Math.max(0, stockDef.idealStock - (i.quantity || 0)) : 0;

                                                                        return (
                                                                            <li key={i.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                                                                                <span>{i.name}: <strong>{i.quantity}</strong></span>
                                                                                {suggestion > 0 && (
                                                                                    <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-0.5 rounded-full">
                                                                                        Pedir +{suggestion}
                                                                                    </span>
                                                                                )}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-gray-400 italic text-sm">Nenhuma contagem realizada para este setor hoje.</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        </Card>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {view === 'financial' && <FinancialView companyId={companyId} config={config} getRestaurantName={getRestaurantName} />}

                {view === 'stock' && <StockManagement companyId={companyId} stockItems={stockItems} config={config} suppliers={suppliers} />}

                {view === 'reports' && <ReportView companyId={companyId} config={config} getRestaurantName={getRestaurantName} stockItems={stockItems} getSectorName={getSectorName} />}

                {view === 'settings' && <SettingsPanel companyId={companyId} config={config} />}

                {view === 'suppliers' && <SuppliersView companyId={companyId} suppliers={suppliers} />}

                {view === 'countLists' && <CountListView companyId={companyId} config={config} getRestaurantName={getRestaurantName} getSectorName={getSectorName} stockItems={stockItems} />}

                {view === 'production' && <ProductionSettingsView companyId={companyId} config={config} getRestaurantName={getRestaurantName} />}



                {/* Independent Purchase Modal (CART) */}
                <Modal isOpen={independentModalOpen} onClose={() => setIndependentModalOpen(false)} title="Nova Compra (Avulsa)">
                    <div className="space-y-4">
                        <Select
                            label="Empresa"
                            value={indepGlobal.restaurantId}
                            onChange={e => setIndepGlobal(p => ({ ...p, restaurantId: e.target.value }))}
                            required
                        >
                            <option value="">Selecione a empresa...</option>
                            {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>

                        <Card className="p-3 bg-gray-50 border-gray-200">
                            <h4 className="font-bold text-sm text-gray-700 mb-2">Adicionar Item</h4>
                            <div className="space-y-3">
                                <div className="relative">
                                    <Input
                                        placeholder="Buscar Item..."
                                        value={indepForm.itemName}
                                        onChange={e => handleIndepSearch(e.target.value)}
                                        autoComplete="off"
                                    />
                                    {indepSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full bg-white border shadow-lg rounded-lg mt-1 max-h-48 overflow-auto">
                                            {indepSuggestions.map(s => (
                                                <div key={s.id}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    onClick={() => {
                                                        setIndepForm(prev => ({ ...prev, itemName: s.name }));
                                                        setIndepSuggestions([]);
                                                    }}
                                                >
                                                    {s.name} <span className="text-gray-400 text-xs">({s.unit})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Qtd"
                                        type="text"
                                        inputMode="decimal"
                                        value={indepForm.quantity}
                                        onChange={e => setIndepForm(p => ({ ...p, quantity: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="R$ Unit."
                                        type="text"
                                        inputMode="decimal"
                                        value={indepForm.unitPrice}
                                        onChange={e => setIndepForm(p => ({ ...p, unitPrice: e.target.value }))}
                                    />
                                </div>
                                <Button onClick={addToIndepCart} variant="secondary" className="w-full text-xs h-8">Adicionar à Lista</Button>
                            </div>
                        </Card>

                        {/* Cart List */}
                        <div className="max-h-40 overflow-y-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                                    <tr>
                                        <th className="p-2">Item</th>
                                        <th className="p-2 text-right">Qtd</th>
                                        <th className="p-2 text-right">Total</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {indepCart.length === 0 ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-gray-400 text-xs">Lista vazia</td></tr>
                                    ) : (
                                        indepCart.map(item => (
                                            <tr key={item.id}>
                                                <td className="p-2">{item.itemName}</td>
                                                <td className="p-2 text-right">{item.quantity}</td>
                                                <td className="p-2 text-right font-mono">R$ {item.total.toFixed(2)}</td>
                                                <td className="p-2 text-right">
                                                    <button onClick={() => removeFromIndepCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-right font-bold text-lg text-gray-800 border-t pt-2">
                            Total Pedido: R$ {indepCart.reduce((acc, i) => acc + i.total, 0).toFixed(2)}
                        </div>

                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <label className="block text-sm font-bold text-amber-800 mb-1 flex items-center gap-2">
                                <Truck className="w-4 h-4" /> Previsão de Entrega (Opcional)
                            </label>
                            <Input
                                type="date"
                                value={indepGlobal.deliveryDate}
                                onChange={e => setIndepGlobal(p => ({ ...p, deliveryDate: e.target.value }))}
                                className="bg-white"
                            />
                            <p className="text-[10px] text-amber-600 mt-1">
                                Se vazio, o estoque de todos os itens será atualizado IMEDIATAMENTE.
                            </p>
                        </div>

                        <Button onClick={handleIndependentPurchaseBatch} className="w-full" isLoading={isUpdating} disabled={indepCart.length === 0}>
                            Confirmar Compra
                        </Button>
                    </div>
                </Modal>

                {/* Quotation Modal */}
                <Modal isOpen={quotationModalOpen} onClose={() => setQuotationModalOpen(false)} title="Cotação de Preços">
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">Envie a lista de itens para os fornecedores via WhatsApp.</p>

                        {suppliers.map(supplier => {
                            // Find items linked to this supplier
                            const relevantItems = quotationItems.filter(item => {
                                const stockItem = stockItems.find(si => si.name === item.name); // Simple name match
                                return stockItem && (stockItem.supplierIds || []).includes(supplier.id);
                            });

                            if (relevantItems.length === 0) return null;

                            const messageText = `Olá ${supplier.contactName}, gostaria de cotação para:\n\n` +
                                relevantItems.map(i => `- ${i.quantity} ${i.unit} de ${i.name}`).join('\n');

                            const whatsappUrl = `https://wa.me/${supplier.phone.replace(/\D/g, '')}?text=${encodeURIComponent(messageText)}`;

                            return (
                                <div key={supplier.id} className="border rounded-lg p-3 bg-gray-50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-gray-800">{supplier.name}</h4>
                                        <a
                                            href={whatsappUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-bold hover:bg-green-600 transition-colors"
                                        >
                                            <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
                                        </a>
                                    </div>
                                    <ul className="text-sm bg-white rounded border divide-y">
                                        {relevantItems.map((item, idx) => (
                                            <li key={idx} className="p-2 flex justify-between">
                                                <span>{item.name}</span>
                                                <span className="font-mono text-gray-500">{item.quantity} {item.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}

                        {/* Items without Supplier */}
                        {(() => {
                            const unknownItems = quotationItems.filter(item => {
                                const stockItem = stockItems.find(si => si.name === item.name);
                                return !stockItem || !(stockItem.supplierIds && stockItem.supplierIds.length > 0);
                            });

                            if (unknownItems.length === 0) return null;

                            const messageTextRaw = `Olá, gostaria de cotação para:\n\n` +
                                unknownItems.map(i => `- ${i.quantity} ${i.unit} de ${i.name}`).join('\n');

                            return (
                                <div className="border rounded-lg p-3 bg-amber-50 border-amber-100">
                                    <div className="mb-2">
                                        <h4 className="font-bold text-amber-800 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" /> Sem Fornecedor Definido
                                        </h4>
                                        <p className="text-xs text-amber-700">Vincule estes itens a fornecedores na aba "Gestão de Estoque".</p>
                                    </div>
                                    <div className="space-y-2">
                                        <ul className="text-sm bg-white rounded border divide-y mb-2">
                                            {unknownItems.map((item, idx) => (
                                                <li key={idx} className="p-2 flex justify-between">
                                                    <span>{item.name}</span>
                                                    <span className="font-mono text-gray-500">{item.quantity} {item.unit}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(messageTextRaw)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block text-center w-full bg-amber-200 text-amber-900 px-3 py-2 rounded text-sm font-bold hover:bg-amber-300"
                                        >
                                            Enviar Genérico (WhatsApp)
                                        </a>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </Modal>

                {/* Confirm Price & Quantity Modal */}
                <Modal
                    isOpen={!!priceModalData}
                    onClose={() => setPriceModalData(null)}
                    title={priceModalData ? `Comprar: ${priceModalData.item.name}` : ''}
                >
                    <form onSubmit={confirmPrice} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={`Qtd Comprada (${priceModalData?.item.unit})`}
                                type="text"
                                inputMode="decimal"
                                value={qtyInput}
                                onChange={e => setQtyInput(e.target.value)}
                            />
                            <Input
                                label="Preço Unitário (R$)"
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={priceInput}
                                onChange={e => setPriceInput(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="text-right font-bold text-lg text-gray-800 border-t pt-2">
                            Total: R$ {((parseFloat(priceInput.replace(',', '.') || '0')) * (parseFloat(qtyInput.replace(',', '.') || '0'))).toFixed(2)}
                        </div>

                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mt-2">
                            <label className="block text-sm font-bold text-amber-800 mb-1 flex items-center gap-2">
                                <Truck className="w-4 h-4" /> Previsão de Entrega (Opcional)
                            </label>
                            <Input
                                type="date"
                                value={deliveryDateInput}
                                onChange={e => setDeliveryDateInput(e.target.value)}
                                className="bg-white"
                            />
                            <p className="text-[10px] text-amber-600 mt-1">Se preenchido, o item continuará na lista até ser marcado como "Chegou".</p>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">Solicitado: {priceModalData?.item.quantity} {priceModalData?.item.unit}</p>
                        <Button type="submit" className="w-full" isLoading={isUpdating}>
                            Confirmar Compra
                        </Button>
                    </form>
                </Modal>

                {/* Future Delivery Simple Modal */}
                <Modal isOpen={!!futureDeliveryModalData} onClose={() => setFutureDeliveryModalData(null)} title="Agendar Entrega Futura">
                    <form onSubmit={confirmFutureDelivery} className="space-y-6">
                        {futureDeliveryModalData && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <p className="font-semibold text-blue-900">{futureDeliveryModalData.item.name}</p>
                                <p className="text-sm text-blue-700">Quantidade Solicitada: {futureDeliveryModalData.item.quantity} {futureDeliveryModalData.item.unit}</p>
                            </div>
                        )}
                        <Input
                            label="Data Prevista de Entrega"
                            type="date"
                            value={futureDeliveryDate}
                            onChange={(e) => setFutureDeliveryDate(e.target.value)}
                            required
                        />
                        <div className="flex gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setFutureDeliveryModalData(null)} className="w-1/2">
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" className="w-1/2" disabled={isUpdating}>
                                {isUpdating ? 'Agendando...' : 'Comprar e Agendar'}
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* Delivery Confirmation Modal */}
                <Modal
                    isOpen={!!deliveryModalData}
                    onClose={() => setDeliveryModalData(null)}
                    title="Confirmar Entrega"
                >
                    <div className="space-y-6">
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <h3 className="font-bold text-lg text-green-800">O produto chegou?</h3>
                            <p className="text-sm text-green-700 mt-1">{deliveryModalData?.item.name}</p>
                        </div>

                        <p className="text-gray-600 text-sm text-center">
                            Ao confirmar, o status será atualizado e a quantidade de <strong>{deliveryModalData?.item.purchasedQuantity || deliveryModalData?.item.quantity} {deliveryModalData?.item.unit}</strong> será adicionada ao estoque automaticamente.
                        </p>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setDeliveryModalData(null)} className="flex-1">Cancelar</Button>
                            <Button onClick={confirmDelivery} variant="success" className="flex-1">
                                Sim, Confirmar!
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Stock Validation Modal */}
                <Modal
                    isOpen={!!validationModalData}
                    onClose={() => setValidationModalData(null)}
                    title="Validar Estoque"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">Corrija os valores contados se necessário e confirme para atualizar o estoque oficial.</p>
                        <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2">
                            {validationItems.map((item, idx) => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <label className="font-medium text-sm flex-1">{item.name}</label>
                                    <input
                                        type="number"
                                        className="w-20 p-1 border rounded text-center"
                                        value={item.quantity}
                                        onChange={e => {
                                            const newItems = [...validationItems];
                                            newItems[idx].quantity = Number(e.target.value);
                                            setValidationItems(newItems);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={saveValidation} variant="success" className="flex-1">
                                Confirmar Estoque <ClipboardCheck className="w-4 h-4 ml-1" />
                            </Button>
                            <Button
                                onClick={createOrderFromValidation}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                title="Criar pedido com base na diferença (Máximo - Contado)"
                            >
                                Gerar Pedido <ShoppingCart className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Chat Modal */}
                <Modal isOpen={!!chatOrderDocId} onClose={() => setChatOrderDocId(null)} title="Chat com Setor">
                    <div className="flex flex-col h-[50vh]">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg mb-4">
                            {getChatMessages().length === 0 ? (
                                <p className="text-center text-gray-400 text-sm">Nenhuma mensagem ainda.</p>
                            ) : (
                                getChatMessages().map((msg) => {
                                    const isMe = msg.sender === 'buyer';
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-brand-100 text-brand-900 rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none'}`}>
                                                <p className="font-bold text-xs mb-1">{msg.senderName}</p>
                                                <p>{msg.text}</p>
                                                <p className="text-[10px] mt-1 opacity-70 text-right">
                                                    {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={handleSendChat} className="flex gap-2">
                            <Input
                                value={chatMessage}
                                onChange={e => setChatMessage(e.target.value)}
                                placeholder="Digite sua resposta..."
                                className="flex-1"
                                autoFocus
                            />
                            <Button type="submit"><Send className="w-4 h-4" /></Button>
                        </form>
                    </div>
                </Modal>
            </main>
        </div>
    );
};

// ... (Helpers compressImage and openBase64AsBlob remain same) ...
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
};

const openBase64AsBlob = (base64Data?: string) => {
    if (!base64Data) return alert("Arquivo não disponível.");

    fetch(base64Data)
        .then(res => res.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open(blobUrl, '_blank');
            if (!newWindow) alert("Pop-up bloqueado. Permita pop-ups.");
        })
        .catch(e => { console.error(e); alert("Erro ao abrir arquivo."); });
};

// --- Sub-components ---

// ... (FinancialView remains same) ...
const FinancialView: React.FC<{ companyId: string, config: AppConfig, getRestaurantName: (id: string) => string }> = ({ companyId, config, getRestaurantName }) => {
    const [pendingBills, setPendingBills] = useState<Bill[]>([]);
    const [paidBills, setPaidBills] = useState<Bill[]>([]);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'paid'>('pending');

    const [finFilters, setFinFilters] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return {
            restaurantId: '',
            search: '',
            startDate: d.toLocaleDateString('en-CA'),
            endDate: new Date().toLocaleDateString('en-CA')
        };
    });

    // Payment Modal State
    const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isPaying, setIsPaying] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Query 1: Pendentes
        const qPending = query(
            collection(db, `${BASE_PATH}/companies/${companyId}/bills`),
            where("status", "==", "pending")
        );
        
        const unsubPending = onSnapshot(qPending, (snap) => {
            const list: Bill[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Bill));
            setPendingBills(list);
        });

        return () => {
            unsubPending();
        };
    }, [companyId]);

    useEffect(() => {
        if (!finFilters.startDate || !finFilters.endDate) return;

        const startTimestamp = Timestamp.fromDate(new Date(finFilters.startDate + 'T00:00:00'));
        const endTimestamp = Timestamp.fromDate(new Date(finFilters.endDate + 'T23:59:59'));
        
        const qPaid = query(
            collection(db, `${BASE_PATH}/companies/${companyId}/bills`),
            where("status", "==", "paid"),
            where("paidAt", ">=", startTimestamp),
            where("paidAt", "<=", endTimestamp)
        );

        const unsubPaid = onSnapshot(qPaid, (snap) => {
            const list: Bill[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Bill));
            setPaidBills(list);
        });

        return () => {
            unsubPaid();
        };
    }, [companyId, finFilters.startDate, finFilters.endDate]);

    const openPaymentModal = (bill: Bill) => {
        setPaymentBill(bill);
        setReceiptFile(null);
    };

    const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setReceiptFile(e.target.files[0]);
        }
    };

    const confirmPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentBill) return;

        setIsPaying(true);
        try {
            let receiptBase64 = null;
            if (receiptFile) {
                setIsCompressing(true);
                receiptBase64 = await compressImage(receiptFile);
                setIsCompressing(false);
            }

            await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/bills`, paymentBill.id), {
                status: 'paid',
                paidAt: Timestamp.now(),
                receiptFileName: receiptFile ? receiptFile.name : null,
                receiptFileData: receiptBase64
            });
            alert("Pagamento registrado com sucesso!");
            setPaymentBill(null);
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao finalizar pagamento.");
        }
        setIsPaying(false);
        setIsCompressing(false);
    };

    const shareWhatsApp = () => {
        if (!paymentBill) return;
        const text = `*Pagamento Realizado*\nFornecedor: ${paymentBill.supplier || 'N/A'}\nValor: R$ ${Number(paymentBill.value || 0).toFixed(2)}\nVencimento: ${(paymentBill.dueDate && !isNaN(new Date(paymentBill.dueDate).getTime())) ? new Date(paymentBill.dueDate).toLocaleDateString() : 'N/A'}\nStatus: PAGO`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const billsSource = filterStatus === 'pending' ? pendingBills : paidBills;
    const filtered = billsSource.filter(b => {
        if (finFilters.restaurantId && b.restaurantId !== finFilters.restaurantId) return false;
        if (finFilters.search && !(b.supplier || '').toLowerCase().includes(finFilters.search.toLowerCase())) return false;
        return true;
    }).sort((a, b) => (new Date(a.dueDate || 0).getTime() || 0) - (new Date(b.dueDate || 0).getTime() || 0));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Contas a Pagar</h2>
                <div className="flex flex-wrap gap-2">
                    <Button variant={filterStatus === 'pending' ? 'primary' : 'outline'} onClick={() => setFilterStatus('pending')}>Pendentes</Button>
                    <Button variant={filterStatus === 'paid' ? 'primary' : 'outline'} onClick={() => setFilterStatus('paid')}>Pagas</Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Filtrar por Restaurante"
                        value={finFilters.restaurantId}
                        onChange={e => setFinFilters(p => ({ ...p, restaurantId: e.target.value }))}
                    >
                        <option value="">Todos os Restaurantes (Agrupado)</option>
                        {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    <Input
                        label="Buscar Fornecedor"
                        placeholder="Digite o nome ou código..."
                        value={finFilters.search}
                        onChange={e => setFinFilters(p => ({ ...p, search: e.target.value }))}
                    />
                </div>
                {filterStatus === 'paid' && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                        <Input
                            label="Data Inicial (Pagamento)"
                            type="date"
                            value={finFilters.startDate}
                            onChange={e => setFinFilters(p => ({ ...p, startDate: e.target.value }))}
                        />
                        <Input
                            label="Data Final (Pagamento)"
                            type="date"
                            value={finFilters.endDate}
                            onChange={e => setFinFilters(p => ({ ...p, endDate: e.target.value }))}
                        />
                    </div>
                )}
            </div>

            <div className="space-y-8">
                {Object.entries(
                    filtered.reduce((acc, bill) => {
                        const rId = bill.restaurantId || 'unknown';
                        if (!acc[rId]) acc[rId] = [];
                        acc[rId].push(bill);
                        return acc;
                    }, {} as Record<string, Bill[]>)
                ).map(([rId, rBills]) => (
                    <div key={rId} className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                            {getRestaurantName(rId)}
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-normal">{rBills.length} contas</span>
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {rBills.map(bill => (
                                <Card key={bill.id} className={`border-l-4 ${bill.status === 'paid' ? 'border-l-green-500 bg-gray-50' : 'border-l-red-500'}`}>
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className={`flex-1 ${bill.status === 'paid' ? 'opacity-50' : ''}`}>
                                            <div className={`flex items-center gap-2 ${bill.status === 'paid' ? 'line-through decoration-gray-500' : ''}`}>
                                                <span className="font-bold text-lg text-gray-800">{bill.supplier || 'N/A'}</span>
                                                {/* Removed badge as header now groups */}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-4">
                                                <span>Vencimento: <strong>{(bill.dueDate && !isNaN(new Date(bill.dueDate).getTime())) ? new Date(bill.dueDate).toLocaleDateString('pt-BR') : 'N/A'}</strong></span>
                                                <span>Pagamento: <strong>{(bill.paymentMethod || 'N/A').toUpperCase()}</strong></span>
                                                {bill.pixKey && <span>Pix: <code className="bg-gray-100 px-1 rounded">{bill.pixKey}</code></span>}
                                            </div>
                                            {bill.fileName && (
                                                <button
                                                    onClick={() => openBase64AsBlob(bill.fileData)}
                                                    className="mt-2 text-xs text-blue-600 flex items-center gap-1 hover:underline font-medium"
                                                >
                                                    <Eye className="w-3 h-3" /> Anexo Original: {bill.fileName}
                                                </button>
                                            )}
                                            {bill.receiptFileName && (
                                                <div className="mt-1 text-xs text-green-600 flex items-center gap-1 font-bold">
                                                    <CheckCircle className="w-3 h-3" /> Comprovante: {bill.receiptFileName}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-2 min-w-[150px]">
                                            <span className="text-xl font-bold text-gray-800">R$ {Number(bill.value || 0).toFixed(2)}</span>
                                            {bill.status === 'pending' ? (
                                                <Button onClick={(e) => { e.stopPropagation(); openPaymentModal(bill); }} variant="success" className="w-full text-xs py-1">
                                                    Marcar como Pago
                                                </Button>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                                        <CheckCircle className="w-4 h-4" /> PAGO
                                                    </div>
                                                    {bill.receiptFileData && (
                                                        <button
                                                            onClick={() => openBase64AsBlob(bill.receiptFileData)}
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-bold"
                                                        >
                                                            <Eye className="w-3 h-3" /> Ver Comprovante
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <p className="text-center text-gray-400 py-10">Nenhuma conta encontrada.</p>}
            </div>

            {/* Payment Modal */}
            <Modal isOpen={!!paymentBill} onClose={() => setPaymentBill(null)} title="Finalizar Pagamento">
                {paymentBill && (
                    <form onSubmit={confirmPayment} className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500">Pagamento para:</p>
                            <p className="font-bold text-lg text-gray-800">{paymentBill.supplier || 'N/A'}</p>
                            <div className="mt-2 flex justify-between items-end border-t border-gray-200 pt-2">
                                <span className="text-gray-600">Valor Total:</span>
                                <span className="text-2xl font-bold text-brand-700">R$ {Number(paymentBill.value || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Anexar Comprovante de Pagamento</label>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors gap-2 text-gray-600"
                                >
                                    <Camera className="w-6 h-6 text-brand-500" />
                                    <span className="text-xs font-bold">Usar Câmera</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors gap-2 text-gray-600"
                                >
                                    <Upload className="w-6 h-6 text-blue-500" />
                                    <span className="text-xs font-bold">Carregar Arquivo</span>
                                </button>
                            </div>

                            <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleReceiptChange} className="hidden" />
                            <input type="file" ref={fileInputRef} accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />

                            {receiptFile && (
                                <div className="flex items-center gap-2 bg-green-50 p-2 rounded text-sm text-green-700 border border-green-200 animate-in fade-in">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="font-medium truncate flex-1">{receiptFile.name}</span>
                                    <button type="button" onClick={() => setReceiptFile(null)} className="text-gray-400 hover:text-red-500"><Trash className="w-4 h-4" /></button>
                                </div>
                            )}

                            {isCompressing && <p className="text-xs text-gray-500 animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Preparando arquivo...</p>}
                        </div>

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={shareWhatsApp} className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                                <Share2 className="w-4 h-4 mr-2" /> WhatsApp
                            </Button>
                            <Button type="submit" isLoading={isPaying || isCompressing} className="flex-[2]" disabled={!receiptFile}>
                                Confirmar Baixa
                            </Button>
                        </div>
                        {!receiptFile && <p className="text-xs text-center text-red-500">* Anexe um comprovante para finalizar.</p>}
                    </form>
                )}
            </Modal>
        </div>
    );
};

const ReportView: React.FC<{ companyId: string, config: AppConfig, getRestaurantName: (id: string) => string, stockItems: StockItem[], getSectorName: (id: string) => string }> = ({ companyId, config, getRestaurantName, stockItems, getSectorName }) => {
    const [tab, setTab] = useState<'products' | 'financial' | 'consumption' | 'stock-position'>('products');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toLocaleDateString('en-CA');
    });
    const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));

    // Data States
    const [productData, setProductData] = useState<{ total: number; byCategory: any[]; byItem: any[] } | null>(null);
    const [financialData, setFinancialData] = useState<{ bills: Bill[], summary: any } | null>(null);
    const [consumptionData, setConsumptionData] = useState<any[] | null>(null);
    const [stockPositionData, setStockPositionData] = useState<{ items: any[], summary: any } | null>(null);

    // Filters
    const [finFilters, setFinFilters] = useState({ restaurantId: '', status: 'all', method: 'all', search: '' });
    const [stockPosFilters, setStockPosFilters] = useState({ restaurantId: '' }); // REMOVED SECTOR ID

    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            if (tab === 'stock-position') {
                const reportItems: any[] = [];
                let totalValue = 0;
                let lowStockCount = 0;
                let overStockCount = 0;

                // CHANGED: Flatten the loop. Group only by Company (Restaurant), ignoring sectors.
                stockItems.forEach(item => {
                    const assocs = item.associations || {};
                    Object.keys(assocs).forEach(restId => {
                        // Apply filters
                        if (stockPosFilters.restaurantId && restId !== stockPosFilters.restaurantId) return;

                        // NOTE: If item is associated with multiple restaurants, we list it for each restaurant.
                        // FIX: Use stockByRestaurant
                        const quantity = item.stockByRestaurant?.[restId] || 0;
                        const unitPrice = item.avgPrice || item.lastPrice || 0;
                        const value = quantity * unitPrice;

                        // Status
                        let status = 'ok';
                        if (item.minStock && quantity < item.minStock) { status = 'low'; lowStockCount++; }
                        else if (item.maxStock && quantity > item.maxStock) { status = 'high'; overStockCount++; }

                        reportItems.push({
                            itemId: item.id,
                            name: item.name,
                            unit: item.unit,
                            category: item.category,
                            restaurantId: restId,
                            quantity,
                            unitPrice,
                            totalValue: value,
                            status,
                            min: item.minStock,
                            max: item.maxStock
                        });

                        totalValue += value;
                    });
                });

                reportItems.sort((a, b) => b.totalValue - a.totalValue);

                setStockPositionData({
                    items: reportItems,
                    summary: { totalValue, lowStockCount, overStockCount, totalItems: reportItems.length }
                });

            } else {
                // ... Existing Logic for other tabs ...
                // 1. Fetch Orders for Products & Consumption
                const ordersQ = query(
                    collection(db, `${BASE_PATH}/companies/${companyId}/daily_orders`),
                    where("orderDate", ">=", startDate),
                    where("orderDate", "<=", endDate)
                );
                const ordersSnap = await getDocs(ordersQ);

                // --- Product Report Logic ---
                const items: any[] = [];
                ordersSnap.forEach(doc => {
                    const o = doc.data() as Order;
                    o.items.forEach(i => {
                        const isCarryOver = i.purchased && i.originalDate && i.originalDate !== o.orderDate;
                        if (i.purchased && i.price > 0 && !isCarryOver) {
                            items.push(i);
                        }
                    });
                });

                const catMap: Record<string, number> = {};
                const itemMap: Record<string, { qty: number; total: number; unit: string }> = {};
                let totalProd = 0;

                items.forEach(i => {
                    totalProd += i.price;
                    const cat = i.category || 'Outros';
                    catMap[cat] = (catMap[cat] || 0) + i.price;
                    if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, total: 0, unit: i.unit };
                    itemMap[i.name].qty += (i.purchasedQuantity || i.quantity);
                    itemMap[i.name].total += i.price;
                });

                setProductData({
                    total: totalProd,
                    byCategory: Object.entries(catMap).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value),
                    byItem: Object.entries(itemMap).map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total)
                });

                // --- Consumption & Projection Logic ---
                const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
                const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

                const consList = Object.entries(itemMap).map(([name, data]) => {
                    const dailyAvg = data.qty / daysDiff;
                    return {
                        name,
                        unit: data.unit,
                        totalPurchased: data.qty,
                        dailyAvg,
                        proj7: dailyAvg * 7,
                        proj15: dailyAvg * 15,
                        proj30: dailyAvg * 30
                    };
                }).sort((a, b) => b.totalPurchased - a.totalPurchased);
                setConsumptionData(consList);


                // --- Financial Report Logic ---
                if (tab === 'financial') {
                    let finQ = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`));
                    if (startDate && endDate) {
                        finQ = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`), where("dueDate", ">=", startDate), where("dueDate", "<=", endDate));
                    } else if (startDate) {
                        finQ = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`), where("dueDate", ">=", startDate));
                    } else if (endDate) {
                        finQ = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`), where("dueDate", "<=", endDate));
                    }
                    const finSnap = await getDocs(finQ);
                    let bills = finSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill));

                    bills = bills.filter(b => {
                        if (finFilters.restaurantId && b.restaurantId !== finFilters.restaurantId) return false;
                        if (finFilters.status !== 'all' && b.status !== finFilters.status) return false;
                        if (finFilters.method !== 'all' && b.paymentMethod !== finFilters.method) return false;
                        if (finFilters.search && !(b.supplier || '').toLowerCase().includes(finFilters.search.toLowerCase())) return false;
                        return true;
                    });

                    const summary = {
                        total: bills.reduce((acc, b) => acc + Number(b.value || 0), 0),
                        paid: bills.filter(b => b.status === 'paid').reduce((acc, b) => acc + Number(b.value || 0), 0),
                        pending: bills.filter(b => b.status === 'pending').reduce((acc, b) => acc + Number(b.value || 0), 0),
                    };

                    setFinancialData({ bills, summary });
                }
            }

        } catch (e) {
            console.error(e);
            alert("Erro ao gerar relatório");
        }
        setLoading(false);
    };

    // Trigger fetch on tab switch or filter change
    useEffect(() => {
        fetchReport();
    }, [tab, startDate, endDate, finFilters, stockPosFilters]);

    const print = () => window.print();

    return (
        <div className="space-y-6">
            <div className="flex gap-2 border-b overflow-x-auto">
                <button onClick={() => setTab('products')} className={`px-4 py-2 font-medium whitespace-nowrap ${tab === 'products' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Compras (Produtos)</button>
                <button onClick={() => setTab('financial')} className={`px-4 py-2 font-medium whitespace-nowrap ${tab === 'financial' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Financeiro (Contas)</button>
                <button onClick={() => setTab('consumption')} className={`px-4 py-2 font-medium whitespace-nowrap ${tab === 'consumption' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Consumo & Projeção</button>
                <button onClick={() => setTab('stock-position')} className={`px-4 py-2 font-medium whitespace-nowrap ${tab === 'stock-position' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Posição de Estoque</button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-end">
                {tab !== 'stock-position' && (
                    <>
                        <Input label="De" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
                        <Input label="Até" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
                    </>
                )}

                {tab === 'financial' && (
                    <>
                        <Select label="Empresa" value={finFilters.restaurantId} onChange={e => setFinFilters(p => ({ ...p, restaurantId: e.target.value }))} className="w-40">
                            <option value="">Todas</option>
                            {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>
                        <Select label="Status" value={finFilters.status} onChange={e => setFinFilters(p => ({ ...p, status: e.target.value as any }))} className="w-32">
                            <option value="all">Todos</option>
                            <option value="paid">Pagos</option>
                            <option value="pending">Pendentes</option>
                        </Select>
                        <Input label="Fornecedor" placeholder="Buscar..." value={finFilters.search} onChange={e => setFinFilters(p => ({ ...p, search: e.target.value }))} className="w-40" />
                    </>
                )}

                {tab === 'stock-position' && (
                    <>
                        <Select label="Empresa" value={stockPosFilters.restaurantId} onChange={e => setStockPosFilters(p => ({ ...p, restaurantId: e.target.value }))} className="w-40">
                            <option value="">Todas</option>
                            {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>
                        {/* REMOVED SECTOR FILTER */}
                    </>
                )}

                <Button onClick={fetchReport} isLoading={loading}>Atualizar</Button>
                <Button onClick={print} variant="outline" className="ml-auto">Imprimir</Button>
            </div>

            {/* TAB: PRODUCTS */}
            {tab === 'products' && productData && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="bg-gradient-to-r from-brand-600 to-brand-700 text-white">
                        <div className="text-brand-100 text-sm mb-1">Total Compras no Período</div>
                        <div className="text-4xl font-bold">R$ {productData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card title="Gasto por Categoria">
                            <div className="space-y-3">
                                {productData.byCategory.map((c, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                                            <span>{c.name}</span>
                                        </div>
                                        <span className="font-mono font-medium">R$ {c.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card title="Top Itens (Custo)">
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {productData.byItem.map((i, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                                        <div>
                                            <div className="font-medium">{i.name}</div>
                                            <div className="text-gray-400 text-xs">{i.qty.toFixed(1)} {i.unit}</div>
                                            <div className="text-xs text-gray-500">
                                                Médio: R$ {(i.total / (i.qty || 1)).toFixed(2)} / {i.unit}
                                            </div>
                                        </div>
                                        <span className="font-mono font-medium">R$ {i.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB: CONSUMPTION */}
            {tab === 'consumption' && consumptionData && (
                <div className="space-y-6 animate-in fade-in">
                    <Card title="Consumo e Projeção de Compras">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="p-3">Item</th>
                                        <th className="p-3 text-center">Consumo Total</th>
                                        <th className="p-3 text-center">Média Diária</th>
                                        <th className="p-3 text-center bg-blue-50 text-blue-800">7 Dias</th>
                                        <th className="p-3 text-center bg-blue-50 text-blue-800">15 Dias</th>
                                        <th className="p-3 text-center bg-blue-50 text-blue-800">30 Dias</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {consumptionData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3 text-center">{item.totalPurchased.toFixed(1)} {item.unit}</td>
                                            <td className="p-3 text-center font-bold">{item.dailyAvg.toFixed(2)} {item.unit}</td>
                                            <td className="p-3 text-center bg-blue-50/50">{item.proj7.toFixed(1)}</td>
                                            <td className="p-3 text-center bg-blue-50/50">{item.proj15.toFixed(1)}</td>
                                            <td className="p-3 text-center bg-blue-50/50">{item.proj30.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* TAB: FINANCIAL */}
            {tab === 'financial' && financialData && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <span className="text-sm text-blue-600 font-bold block mb-1">Total Geral</span>
                            <span className="text-2xl font-bold text-blue-900">R$ {financialData.summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <span className="text-sm text-green-600 font-bold block mb-1">Total Pago</span>
                            <span className="text-2xl font-bold text-green-900">R$ {financialData.summary.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <span className="text-sm text-red-600 font-bold block mb-1">Total Pendente</span>
                            <span className="text-2xl font-bold text-red-900">R$ {financialData.summary.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="p-3">Vencimento</th>
                                    <th className="p-3">Fornecedor</th>
                                    <th className="p-3">Empresa</th>
                                    <th className="p-3">Método</th>
                                    <th className="p-3">Valor</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {financialData.bills.map(b => (
                                    <tr key={b.id} className="hover:bg-gray-50">
                                        <td className="p-3">{(b.dueDate && !isNaN(new Date(b.dueDate).getTime())) ? new Date(b.dueDate).toLocaleDateString('pt-BR') : 'N/A'}</td>
                                        <td className="p-3 font-medium">{b.supplier || 'N/A'}</td>
                                        <td className="p-3">{getRestaurantName(b.restaurantId)}</td>
                                        <td className="p-3 uppercase text-xs">{b.paymentMethod || 'N/A'}</td>
                                        <td className="p-3 font-mono">R$ {Number(b.value || 0).toFixed(2)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${b.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {b.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {/* TAB: STOCK POSITION */}
            {tab === 'stock-position' && stockPositionData && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 md:col-span-2">
                            <span className="text-sm text-emerald-600 font-bold block mb-1 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Valor Total em Estoque
                            </span>
                            <span className="text-3xl font-bold text-emerald-900">
                                R$ {stockPositionData.summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <span className="text-sm text-red-600 font-bold block mb-1 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Abaixo do Mínimo
                            </span>
                            <span className="text-2xl font-bold text-red-900">{stockPositionData.summary.lowStockCount} itens</span>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                            <span className="text-sm text-amber-600 font-bold block mb-1 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" /> Acima do Máximo
                            </span>
                            <span className="text-2xl font-bold text-amber-900">{stockPositionData.summary.overStockCount} itens</span>
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3">Empresa</th>
                                    <th className="p-3 text-center">Qtd Atual</th>
                                    <th className="p-3 text-center">Custo Unit.</th>
                                    <th className="p-3 text-center">Valor Total</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stockPositionData.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.category}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="text-xs font-bold">{getRestaurantName(item.restaurantId)}</div>
                                        </td>
                                        <td className="p-3 text-center font-mono">
                                            <span className="font-bold text-lg">{item.quantity}</span> <span className="text-xs">{item.unit}</span>
                                        </td>
                                        <td className="p-3 text-center font-mono text-xs text-gray-500">
                                            R$ {item.unitPrice.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-center font-mono font-bold text-gray-800 bg-gray-50">
                                            R$ {item.totalValue.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-center">
                                            {item.status === 'low' && (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                                                    <TrendingUp className="w-3 h-3 rotate-180" /> Baixo (Min: {item.min})
                                                </span>
                                            )}
                                            {item.status === 'high' && (
                                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">
                                                    <TrendingUp className="w-3 h-3" /> Excesso (Max: {item.max})
                                                </span>
                                            )}
                                            {item.status === 'ok' && (
                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                    <CheckCircle className="w-3 h-3" /> Ideal
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {view === 'production' && (
                <ProductionSettingsView companyId={companyId} config={config} getRestaurantName={getRestaurantName} />
            )}
        </div>
    );
};

// ... (StockManagement, SettingsPanel remain same) ...
const StockManagement: React.FC<{ companyId: string, stockItems: StockItem[], config: AppConfig, suppliers: Supplier[] }> = ({ companyId, stockItems, config, suppliers }) => {
    // ... existing StockManagement code (no changes needed)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<StockItem>>({});
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importStep, setImportStep] = useState(1);
    const [importText, setImportText] = useState('');
    const [batchItems, setBatchItems] = useState<any[]>([]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const ref = collection(db, `${BASE_PATH}/companies/${companyId}/stock_items`);
        if (editingItem.id) {
            await updateDoc(doc(ref, editingItem.id), editingItem as any);
        } else {
            await setDoc(doc(ref), {
                ...editingItem,
                associations: editingItem.associations || {},
                lastPrice: 0, avgPrice: 0, purchaseCount: 0
            });
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Remover item?')) await deleteDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, id));
    };

    const handleParseImport = () => {
        const lines = importText.split('\n').filter(line => line.trim());
        const parsed = lines.map((line, idx) => {
            const parts = line.split(',');
            const name = parts[0]?.trim() || `Item ${idx + 1}`;
            const unit = parts[1]?.trim() || (config.units[0]?.name || '');
            const category = parts[2]?.trim() || (config.categories[0]?.name || '');
            return {
                _id: crypto.randomUUID(),
                name, unit, category, associations: {}
            };
        });
        setBatchItems(parsed);
        setImportStep(2);
    };

    const handleBatchSave = async () => {
        if (!confirm(`Importar ${batchItems.length} itens?`)) return;
        const batch = writeBatch(db);
        const ref = collection(db, `${BASE_PATH}/companies/${companyId}/stock_items`);
        batchItems.forEach(item => {
            const { _id, ...data } = item;
            const processedAssoc: Record<string, string[]> = {};
            Object.keys(data.associations || {}).forEach(restId => {
                if (data.associations[restId]) {
                    // CHANGED: Empty array or minimal value, ignoring specific sectors
                    processedAssoc[restId] = [];
                }
            });
            const newDoc = doc(ref);
            batch.set(newDoc, {
                name: data.name,
                unit: data.unit,
                category: data.category,
                associations: processedAssoc,
                minStock: 0, idealStock: 0, maxStock: 0,
                purchasePeriod: 'semanal',
                purchaseUnitDescription: '',
                lastPrice: 0, avgPrice: 0, purchaseCount: 0
            });
        });
        await batch.commit();
        setIsImportModalOpen(false);
        setImportStep(1);
        setImportText('');
        setBatchItems([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Gestão de Estoque</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setIsImportModalOpen(true)} variant="secondary">
                        <Upload className="w-4 h-4" /> Importar
                    </Button>
                    <Button onClick={() => { setEditingItem({}); setIsModalOpen(true); }}>
                        <Plus className="w-4 h-4" /> Novo Item
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Nome</th>
                            <th className="p-4 font-semibold text-gray-600">Categoria</th>
                            <th className="p-4 font-semibold text-gray-600">Unidade</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {stockItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium">{item.name}</td>
                                <td className="p-4 text-gray-500">{item.category}</td>
                                <td className="p-4 text-gray-500">{item.unit}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="text-blue-600 hover:underline">Editar</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline">Excluir</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Single Item Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem.id ? 'Editar Item' : 'Novo Item'}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome" value={editingItem.name || ''} onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoria" value={editingItem.category || ''} onChange={e => setEditingItem(p => ({ ...p, category: e.target.value }))}>
                            <option value="">Selecione</option>
                            {config.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </Select>
                        <Select label="Unidade" value={editingItem.unit || ''} onChange={e => setEditingItem(p => ({ ...p, unit: e.target.value }))}>
                            <option value="">Selecione</option>
                            {config.units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <Input type="number" label="Mínimo" value={editingItem.minStock || ''} onChange={e => setEditingItem(p => ({ ...p, minStock: Number(e.target.value) }))} />
                        <Input type="number" label="Ideal" value={editingItem.idealStock || ''} onChange={e => setEditingItem(p => ({ ...p, idealStock: Number(e.target.value) }))} />
                        <Input type="number" label="Máximo" value={editingItem.maxStock || ''} onChange={e => setEditingItem(p => ({ ...p, maxStock: Number(e.target.value) }))} />
                    </div>
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                        <p className="font-bold mb-2">Fornecedores:</p>
                        <div className="flex flex-wrap gap-2">
                            {suppliers.map(s => (
                                <label key={s.id} className="flex items-center gap-2 bg-white px-2 py-1 rounded border cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={(editingItem.supplierIds || []).includes(s.id)}
                                        onChange={e => {
                                            const current = editingItem.supplierIds || [];
                                            let newIds;
                                            if (e.target.checked) newIds = [...current, s.id];
                                            else newIds = current.filter(id => id !== s.id);
                                            setEditingItem(p => ({ ...p, supplierIds: newIds }));
                                        }}
                                    />
                                    {s.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-orange-50 p-3 rounded text-sm text-orange-800">
                        <p className="font-bold mb-2">Disponível nas Empresas:</p>
                        <div className="mt-2 space-y-1">
                            {config.restaurants.map(r => (
                                <label key={r.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={!!editingItem.associations?.[r.id]}
                                        onChange={e => {
                                            const newAssoc = { ...(editingItem.associations || {}) };
                                            // CHANGED: Empty array instead of sector map
                                            if (e.target.checked) newAssoc[r.id] = [];
                                            else delete newAssoc[r.id];
                                            setEditingItem(p => ({ ...p, associations: newAssoc }));
                                        }}
                                    />
                                    {r.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                </form>
            </Modal>

            {/* Batch Import Modal */}
            <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportStep(1); }} title="Importar Estoque">
                {importStep === 1 ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">Cole sua lista de itens abaixo. Formato sugerido: <code>Nome, Unidade, Categoria</code> (um por linha).</p>
                        <textarea
                            className="w-full h-64 p-3 border rounded-lg font-mono text-sm"
                            placeholder="Banana Prata, kg, Hortifruti&#10;Detergente, un, Limpeza"
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                        />
                        <Button onClick={handleParseImport} className="w-full">Processar Lista</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">Verifique e edite os itens antes de salvar. Selecione as empresas que usarão estes itens.</p>
                        <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 w-1/3">Nome</th>
                                        <th className="p-2 w-1/6">Unidade</th>
                                        <th className="p-2 w-1/4">Categoria</th>
                                        <th className="p-2">Empresas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {batchItems.map((item, idx) => (
                                        <tr key={item._id}>
                                            <td className="p-2">
                                                <input
                                                    className="w-full border rounded p-1"
                                                    value={item.name}
                                                    onChange={e => {
                                                        const newItems = [...batchItems];
                                                        newItems[idx].name = e.target.value;
                                                        setBatchItems(newItems);
                                                    }}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    className="w-full border rounded p-1"
                                                    value={item.unit}
                                                    onChange={e => {
                                                        const newItems = [...batchItems];
                                                        newItems[idx].unit = e.target.value;
                                                        setBatchItems(newItems);
                                                    }}
                                                >
                                                    {config.units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    className="w-full border rounded p-1"
                                                    value={item.category}
                                                    onChange={e => {
                                                        const newItems = [...batchItems];
                                                        newItems[idx].category = e.target.value;
                                                        setBatchItems(newItems);
                                                    }}
                                                >
                                                    {config.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {config.restaurants.map(r => (
                                                        <label key={r.id} className="flex items-center gap-1 text-xs">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!item.associations?.[r.id]}
                                                                onChange={e => {
                                                                    const newItems = [...batchItems];
                                                                    const assocs = { ...(newItems[idx].associations || {}) };
                                                                    if (e.target.checked) assocs[r.id] = true;
                                                                    else delete assocs[r.id];
                                                                    newItems[idx].associations = assocs;
                                                                    setBatchItems(newItems);
                                                                }}
                                                            />
                                                            {r.name}
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setImportStep(1)} className="flex-1">Voltar</Button>
                            <Button onClick={handleBatchSave} className="flex-1">Salvar Tudo</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const SettingsPanel: React.FC<{ companyId: string, config: AppConfig }> = ({ companyId, config }) => {
    // ... existing SettingsPanel code (no changes needed) ...
    const [newItem, setNewItem] = useState('');
    const [newAdmPass, setNewAdmPass] = useState<{ id: string, pass: string }>({ id: '', pass: '' });
    const [storageSize, setStorageSize] = useState<number | null>(null);
    const [isClearing, setIsClearing] = useState(false);

    // Config Labels Map
    const labels: Record<string, string> = {
        restaurants: "Empresas",
        sectors: "Setores",
        units: "Unidades",
        categories: "Categorias"
    };

    // Calculate approx storage usage of bills with attachments
    useEffect(() => {
        const checkStorage = async () => {
            const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`));
            const snap = await getDocs(q);
            let totalBytes = 0;
            snap.forEach(d => {
                const data = d.data();
                if (data.fileData) totalBytes += data.fileData.length;
                if (data.receiptFileData) totalBytes += data.receiptFileData.length;
            });
            setStorageSize(totalBytes);
        };
        checkStorage();
    }, [companyId]);

    const addItem = async (field: keyof AppConfig) => {
        if (!newItem) return;
        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            [field]: arrayUnion({ id: crypto.randomUUID(), name: newItem })
        });
        setNewItem('');
    };

    const removeItem = async (field: keyof AppConfig, item: any) => {
        if (confirm('Remover?')) await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            [field]: arrayRemove(item)
        });
    };

    const updateAdmPass = async (restaurantId: string, pass: string) => {
        const newPasswords = { ...(config.admPasswords || {}), [restaurantId]: pass };
        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            admPasswords: newPasswords
        });
        alert("Senha ADM atualizada!");
    };

    const downloadBackup = async () => {
        try {
            const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`));
            const snap = await getDocs(q);
            const bills = snap.docs.map(d => d.data());

            // Safe stringify to handle circular refs if any, and remove undefined
            const cache = new Set();
            const json = JSON.stringify(bills, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) return;
                    cache.add(value);
                }
                if (value === undefined) return null;
                return value;
            }, 2);

            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-contas-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (error) {
            console.error("Backup error:", error);
            alert("Erro ao gerar backup. Verifique o console.");
        }
    };

    const clearAttachments = async () => {
        if (!confirm("Isso apagará todas as fotos e comprovantes para liberar espaço. O histórico financeiro (valores, datas) SERÁ MANTIDO. Tem certeza?")) return;

        setIsClearing(true);
        try {
            const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/bills`));
            const snap = await getDocs(q);
            const batch = writeBatch(db);

            snap.docs.forEach(d => {
                const data = d.data();
                if (data.fileData || data.receiptFileData) {
                    batch.update(d.ref, { fileData: null, receiptFileData: null });
                }
            });

            await batch.commit();
            setStorageSize(0);
            alert("Espaço liberado com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao limpar anexos.");
        }
        setIsClearing(false);
    };

    return (
        <div className="space-y-8">
            {/* Storage & Backup */}
            <Card title="Armazenamento e Backup">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <Database className="w-4 h-4" /> Uso de Anexos
                        </h4>
                        <div className="text-3xl font-bold text-blue-700 mb-1">
                            {storageSize !== null ? (storageSize / 1024 / 1024).toFixed(2) : '...'} MB
                        </div>
                        <p className="text-xs text-blue-600">Aproximado (Fotos e PDFs)</p>

                        {(storageSize || 0) > 50 * 1024 * 1024 && (
                            <div className="mt-2 bg-red-100 text-red-700 text-xs p-2 rounded animate-pulse font-bold">
                                Atenção: Seu banco de dados está ficando cheio. Faça backup e limpe os anexos.
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-3">
                        <Button onClick={downloadBackup} variant="outline" className="w-full justify-start">
                            <Download className="w-4 h-4" /> Baixar Backup Completo (.JSON)
                        </Button>
                        <Button onClick={clearAttachments} isLoading={isClearing} variant="danger" className="w-full justify-start bg-red-100 text-red-700 border-red-200 hover:bg-red-200">
                            <Trash2 className="w-4 h-4" /> Limpar Anexos Antigos (Liberar Espaço)
                        </Button>
                        <p className="text-xs text-gray-500">
                            * O backup inclui todos os dados e anexos atuais. A limpeza remove apenas as fotos do banco para evitar custos/bloqueios.
                        </p>
                    </div>
                </div>
            </Card>

            {/* ADM Passwords */}
            <Card title="Senhas de Acesso ADM/Financeiro">
                <p className="text-sm text-gray-500 mb-4">Defina uma senha única para o operador do setor financeiro de cada empresa.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.restaurants.map(r => (
                        <div key={r.id} className="bg-purple-50 p-4 rounded-lg flex items-center justify-between">
                            <span className="font-bold text-purple-900">{r.name}</span>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Senha"
                                    className="w-32 bg-white"
                                    value={newAdmPass.id === r.id ? newAdmPass.pass : (config.admPasswords?.[r.id] || '')}
                                    onChange={e => setNewAdmPass({ id: r.id, pass: e.target.value })}
                                />
                                <Button onClick={() => updateAdmPass(r.id, newAdmPass.id === r.id ? newAdmPass.pass : (config.admPasswords?.[r.id] || ''))} className="bg-purple-600 hover:bg-purple-700">
                                    <Save className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(labels).map((key) => (
                    <Card key={key} title={labels[key]}>
                        <div className="flex gap-2 mb-4">
                            <Input placeholder="Novo item..." value={newItem} onChange={e => setNewItem(e.target.value)} />
                            <Button onClick={() => addItem(key as any)}><Plus className="w-4 h-4" /></Button>
                        </div>
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {((config[key as keyof AppConfig] as any[]) || []).map((item: any) => (
                                <li key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span>{item.name}</span>
                                    <button onClick={() => removeItem(key as any, item)}><Trash className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const ProductionSettingsView: React.FC<{ companyId: string, config: AppConfig, getRestaurantName: (id: string) => string }> = ({ companyId, config, getRestaurantName }) => {
    const [activeTab, setActiveTab] = useState<'progress'|'config'|'schedule'>('progress');
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-CA');
    });

    const [selectedSector, setSelectedSector] = useState((config.sectors || [])[0]?.id || '');
    const [selectedRestaurant, setSelectedRestaurant] = useState((config.restaurants || [])[0]?.id || '');
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskType, setNewTaskType] = useState<'task' | 'production'>('task');
    const [editingTask, setEditingTask] = useState<{id: string, name: string} | null>(null);
    const [dailyProductions, setDailyProductions] = useState<DailyProduction[]>([]);

    const [scheduleDate, setScheduleDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [scheduleQty, setScheduleQty] = useState('');
    const [scheduleUnit, setScheduleUnit] = useState('');

    // Fetch progress for the selected date
    useEffect(() => {
        const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/daily_productions`), where('date', '==', selectedDate));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => d.data() as DailyProduction);
            setDailyProductions(list);
        });
        return () => unsub();
    }, [companyId, selectedDate]);

    const handleScheduleProduction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskName || !selectedSector || !selectedRestaurant || !scheduleDate) return;

        const targetDocId = `${scheduleDate}_${selectedRestaurant}_${selectedSector}`;
        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, targetDocId);
        
        const newProductionItem = {
            id: crypto.randomUUID(),
            name: newTaskName,
            quantity: Number(scheduleQty) || 1,
            unit: scheduleUnit || 'un',
            scheduledDate: scheduleDate,
            originalDate: scheduleDate,
            status: 'pending' as const,
            addedBy: 'buyer' as const
        };

        const snap = await getDoc(docRef);
        if (snap.exists()) {
            await updateDoc(docRef, { productionList: arrayUnion(newProductionItem) });
        } else {
            const fixedTasks = config.productionTasks?.filter(t => t.sectorId === selectedSector && t.restaurantId === selectedRestaurant) || [];
            await setDoc(docRef, {
                restaurantId: selectedRestaurant,
                sectorId: selectedSector,
                date: scheduleDate,
                tasks: fixedTasks.map(t => ({
                    id: crypto.randomUUID(),
                    name: t.name,
                    type: t.type || 'task',
                    status: 'pending',
                    addedBy: 'buyer'
                })),
                productionList: [newProductionItem]
            });
        }

        setNewTaskName('');
        setScheduleQty('');
        setScheduleUnit('');
        alert('Produção agendada com sucesso!');
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskName || !selectedSector || !selectedRestaurant) return;

        const newTasks = [...(config.productionTasks || []), { 
            id: crypto.randomUUID(), 
            restaurantId: selectedRestaurant,
            sectorId: selectedSector, 
            name: newTaskName,
            type: newTaskType
        }];

        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            productionTasks: newTasks
        });
        setNewTaskName('');
    };

    const handleEditTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask || !editingTask.name.trim()) return;

        const newTasks = (config.productionTasks || []).map(t => 
            t.id === editingTask.id ? { ...t, name: editingTask.name } : t
        );

        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            productionTasks: newTasks
        });
        setEditingTask(null);
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Excluir tarefa do checklist fixo?')) return;
        const newTasks = (config.productionTasks || []).filter(t => t.id !== taskId);
        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
            productionTasks: newTasks
        });
    };

    const getSectorName = (id: string) => (config.sectors || []).find(s => s.id === id)?.name || id;
    const tasksBySector = (config.productionTasks || []).filter(t => t.sectorId === selectedSector && t.restaurantId === selectedRestaurant);

    return (
        <div className="space-y-6 animate-in fade-in max-w-5xl">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border gap-4">
                <h2 className="text-2xl font-bold">Produção (Checklists)</h2>
                
                <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap gap-1">
                    <button 
                        onClick={() => setActiveTab('progress')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'progress' ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        Progresso Diário
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'config' ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        Configurar Tarefas Fixas
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'schedule' ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        Agendar Produção
                    </button>
                </div>
            </div>

            {activeTab === 'progress' && (
                <div className="space-y-6">
                    <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border w-fit">
                        <label className="font-semibold text-gray-700">Data:</label>
                        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {dailyProductions.length === 0 ? (
                            <p className="col-span-2 text-center py-12 text-gray-400">Nenhuma produção registrada para esta data.</p>
                        ) : (
                            dailyProductions.map(dp => {
                                const total = dp.tasks?.length || 0;
                                const done = dp.tasks?.filter(t => t.status === 'done').length || 0;
                                const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
                                const isComplete = total > 0 && done === total;

                                return (
                                    <Card key={`${dp.restaurantId}_${dp.sectorId}`} className={`border-l-4 ${isComplete ? 'border-l-green-500' : 'border-l-blue-500'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg">{getRestaurantName(dp.restaurantId)}</h3>
                                                <p className="text-gray-500 text-sm font-medium">{getSectorName(dp.sectorId)}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-2xl font-black ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {percentage}%
                                                </div>
                                                <div className="text-xs text-gray-400">{done} de {total} completas</div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                                            <div className={`h-2 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }}></div>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto pr-2 space-y-2 mt-4 border-t pt-4">
                                            <h4 className="font-bold text-xs text-gray-500 uppercase">Checklist e Tarefas Faltantes</h4>
                                            {(dp.tasks || []).slice().sort((a,b) => (a.status === 'done' ? 1 : -1)).map(t => {
                                                const effectiveType = t.type || config.productionTasks?.find(ct => ct.name === t.name && ct.sectorId === dp.sectorId)?.type || 'task';
                                                return (
                                                <div key={t.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className={`w-4 h-4 ${t.status === 'done' ? 'text-green-500' : (t.status === 'needs_production' ? 'text-amber-500' : 'text-gray-300')}`} />
                                                        <span className={t.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-800'}>
                                                            {t.name}
                                                            {effectiveType === 'production' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Produção</span>}
                                                            {t.status === 'needs_production' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">Falta Produzir</span>}
                                                        </span>
                                                    </div>
                                                    {t.status === 'done' && t.operatorName && (
                                                        <span className="text-[10px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                                                            {t.operatorName}
                                                        </span>
                                                    )}
                                                </div>
                                                );
                                            })}

                                            {dp.productionList && dp.productionList.length > 0 && (
                                                <div className="mt-4 border-t pt-2">
                                                    <h4 className="font-bold text-xs text-blue-500 uppercase mb-2">Lista de Produção (Agendadas)</h4>
                                                    {dp.productionList.map(pl => (
                                                        <div key={pl.id} className="flex items-center justify-between text-sm bg-blue-50 p-2 rounded mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle className={`w-4 h-4 ${pl.status === 'done' ? 'text-blue-500' : 'text-gray-300'}`} />
                                                                <span className={pl.status === 'done' ? 'text-gray-500 line-through' : 'text-blue-800 font-medium'}>
                                                                    {pl.name} - {pl.quantity} {pl.unit}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] text-blue-600 bg-blue-100 px-1 rounded">Data: {pl.scheduledDate.split('-').reverse().join('/')}</span>
                                                                {pl.status === 'done' && pl.operatorName && (
                                                                    <span className="text-[10px] text-gray-500 mt-1">{pl.operatorName}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'config' && (
            <Card title="Configurar Tarefas Fixas por Setor">
                <p className="text-sm text-gray-500 mb-4">
                    Estas tarefas aparecerão automaticamente todos os dias para os colaboradores do setor quando acessarem o módulo de "Produção".
                </p>

                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3">
                        <label className="font-bold text-gray-700 block mb-2">Selecione a Empresa:</label>
                        <Select 
                            value={selectedRestaurant} 
                            onChange={(e) => setSelectedRestaurant(e.target.value)} 
                            className="mb-4"
                        >
                            {(config.restaurants || []).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </Select>

                        <label className="font-bold text-gray-700 block mb-2">Selecione o Setor:</label>
                        <div className="space-y-2">
                            {(config.sectors || []).map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSector(s.id)}
                                    className={`w-full text-left px-4 py-2 rounded-lg border transition ${selectedSector === s.id ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="w-full md:w-2/3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="font-bold text-lg mb-4">Tarefas do Setor: {getSectorName(selectedSector)}</h3>
                        
                        <form onSubmit={handleAddTask} className="flex gap-2 mb-6 flex-wrap">
                            <Input 
                                placeholder="Nome da Tarefa / Produção" 
                                value={newTaskName} 
                                onChange={e => setNewTaskName(e.target.value)} 
                                className="flex-1 min-w-[200px]"
                            />
                            <Select value={newTaskType} onChange={e => setNewTaskType(e.target.value as any)} className="w-32">
                                <option value="task">Tarefa</option>
                                <option value="production">Produção</option>
                            </Select>
                            <Button type="submit"><Plus className="w-4 h-4" /> Adicionar</Button>
                        </form>

                        {tasksBySector.length === 0 ? (
                            <p className="text-center text-gray-400 py-10">Nenhuma tarefa fixa cadastrada para este setor nesta empresa.</p>
                        ) : (
                            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                                {tasksBySector.map(task => (
                                    <li key={task.id} className="flex justify-between items-center bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3 flex-1">
                                            <CheckSquare className="text-gray-400 w-5 h-5" />
                                            {editingTask?.id === task.id ? (
                                                <form onSubmit={handleEditTask} className="flex gap-2 flex-1 mr-2">
                                                    <Input 
                                                        value={editingTask.name} 
                                                        onChange={e => setEditingTask({...editingTask, name: e.target.value})}
                                                        autoFocus
                                                        className="flex-1 py-1 h-8"
                                                    />
                                                    <Button type="submit" variant="success" className="h-8 px-2 py-1"><Save className="w-4 h-4" /></Button>
                                                    <Button type="button" variant="outline" className="h-8 px-2 py-1" onClick={() => setEditingTask(null)}>Cancelar</Button>
                                                </form>
                                            ) : (
                                                <span className="font-medium text-gray-700 flex items-center gap-2">
                                                    {task.name}
                                                    {task.type === 'production' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Produção</span>}
                                                    {task.type !== 'production' && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Tarefa</span>}
                                                </span>
                                            )}
                                        </div>
                                        {editingTask?.id !== task.id && (
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingTask({ id: task.id, name: task.name })} className="text-blue-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteTask(task.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Card>
            )}
            {activeTab === 'schedule' && (
            <Card title="Agendar Produção Extra">
                <p className="text-sm text-gray-500 mb-4">
                    Agende uma produção específica para um setor. Ela aparecerá na "Lista de Produção (A Fazer)" do setor na data selecionada.
                </p>

                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3">
                        <label className="font-bold text-gray-700 block mb-2">Empresa:</label>
                        <Select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)} className="mb-4">
                            {(config.restaurants || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>

                        <label className="font-bold text-gray-700 block mb-2">Setor:</label>
                        <div className="space-y-2">
                            {(config.sectors || []).map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSector(s.id)}
                                    className={`w-full text-left px-4 py-2 rounded-lg border transition ${selectedSector === s.id ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="w-full md:w-2/3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="font-bold text-lg mb-4">Nova Produção: {getSectorName(selectedSector)}</h3>
                        
                        <form onSubmit={handleScheduleProduction} className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">O que produzir?</label>
                                <Input placeholder="Ex: Massa de Pizza" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} required />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-gray-600 block mb-1">Quantidade</label>
                                    <Input type="number" placeholder="Ex: 5" value={scheduleQty} onChange={e => setScheduleQty(e.target.value)} required />
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-gray-600 block mb-1">Unidade</label>
                                    <Input placeholder="Ex: kg" value={scheduleUnit} onChange={e => setScheduleUnit(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-gray-600 block mb-1">Data</label>
                                    <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} required />
                                </div>
                            </div>
                            <Button type="submit" className="mt-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow">
                                <Plus className="w-5 h-5 mr-2" /> Confirmar Agendamento
                            </Button>
                        </form>
                    </div>
                </div>
            </Card>
            )}
        </div>
    );
}

export default BuyerView;

const SuppliersView: React.FC<{ companyId: string, suppliers: Supplier[] }> = ({ companyId, suppliers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Supplier>>({});

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const ref = collection(db, `${BASE_PATH}/companies/${companyId}/suppliers`);
        if (editing.id) {
            await updateDoc(doc(ref, editing.id), editing as any);
        } else {
            await setDoc(doc(ref), { ...editing, id: crypto.randomUUID() });
        }
        setIsModalOpen(false);
        setEditing({});
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir fornecedor?')) {
            await deleteDoc(doc(db, `${BASE_PATH}/companies/${companyId}/suppliers`, id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Fornecedores</h2>
                <Button onClick={() => { setEditing({}); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4" /> Novo Fornecedor
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(s => (
                    <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">{s.name}</h3>
                                <div className="text-sm text-gray-500 space-y-1 mt-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">Contato:</span> {s.contactName}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">Zap:</span> {s.phone}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">Email:</span> {s.email}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => { setEditing(s); setIsModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded text-blue-600">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(s.id)} className="p-1 hover:bg-gray-100 rounded text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Empresa" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} required />
                    <Input label="Nome Contato" value={editing.contactName || ''} onChange={e => setEditing(p => ({ ...p, contactName: e.target.value }))} required />
                    <Input label="WhatsApp (com DDD)" value={editing.phone || ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} required placeholder="5511999999999" />
                    <Input label="Email" value={editing.email || ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
                    <Button type="submit" className="w-full">Salvar</Button>
                </form>
            </Modal>
        </div>
    );
};

function CountListView({ companyId, config, getRestaurantName, getSectorName, stockItems }: { companyId: string, config: AppConfig, getRestaurantName: (id: string) => string, getSectorName: (id: string) => string, stockItems: StockItem[] }) {
    const [counts, setCounts] = useState<any[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, `${BASE_PATH}/companies/${companyId}/stock_counts`), orderBy('countedAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCounts(list);
        });
        return () => unsub();
    }, [companyId]);

    const validateCount = async (count: any) => {
        if (!confirm('Confirmar validação e atualização de estoque?')) return;
        setLoading(true);
        try {
            // 1. Mark as Validated
            await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_counts`, count.id), {
                status: 'validated',
                validatedBy: 'Comprador',
                validatedAt: Timestamp.now()
            });

            // 2. Update Stock Levels
            const batch = writeBatch(db);
            count.items.forEach((item: any) => {
                const stockItem = stockItems.find(si => si.id === item.id);
                if (stockItem) {
                    const ref = doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, stockItem.id);
                    batch.update(ref, { [`stockByRestaurant.${count.restaurantId}`]: Number(item.quantity) });
                }
            });
            await batch.commit();
            alert('Estoque atualizado com sucesso!');
        } catch (e) {
            console.error(e);
            alert('Erro ao validar.');
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold text-gray-800">Listas de Contagem</h2>
            <div className="grid grid-cols-1 gap-4">
                {counts.map(count => (
                    <Card key={count.id} className={`border-l-4 ${count.status === 'validated' ? 'border-l-green-500 bg-gray-50' : 'border-l-amber-500'}`}>
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedId(expandedId === count.id ? null : count.id)}>
                            <div>
                                <h3 className="font-bold text-lg">{getRestaurantName(count.restaurantId)} <span className="text-gray-400">/</span> {getSectorName(count.sectorId)}</h3>
                                <p className="text-sm text-gray-500">
                                    Contado por <strong>{count.countedBy}</strong> em {new Date(count.countedAt?.toDate ? count.countedAt.toDate() : count.countedAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${count.status === 'validated' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {count.status === 'validated' ? 'VALIDADO' : 'PENDENTE'}
                                </span>
                                <ChevronDown className={`w-5 h-5 transition-transform ${expandedId === count.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {expandedId === count.id && (
                            <div className="mt-4 border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-sm text-gray-700">Itens Contados ({count.items.length})</h4>
                                    {count.status !== 'validated' && (
                                        <Button onClick={(e) => { e.stopPropagation(); validateCount(count); }} isLoading={loading} variant="success" className="h-8 text-xs">
                                            Validar Tudo e Atualizar Estoque
                                        </Button>
                                    )}
                                </div>
                                <ul className="space-y-1 bg-white rounded border divide-y max-h-60 overflow-y-auto">
                                    {count.items.map((item: any, idx: number) => (
                                        <li key={idx} className="p-2 flex justify-between text-sm">
                                            <span>{item.name}</span>
                                            <span className="font-bold">{item.quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
            {counts.length === 0 && <p className="text-center text-gray-400 py-10">Nenhuma contagem encontrada.</p>}
        </div>
    );
};
