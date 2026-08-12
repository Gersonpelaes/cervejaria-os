
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, Timestamp, increment } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { Order, Item, StockItem, AppConfig, ChatMessage, DailyProduction } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/UI';
import { Trash2, AlertTriangle, MessageCircle, Check, Plus, Send, Truck, CheckCircle, ShoppingCart, ClipboardCheck } from 'lucide-react';

interface Props {
    companyId: string;
    config: AppConfig;
    user: { restaurantId: string; sectorId: string; responsibleName: string };
    stockItems: StockItem[];
    getRestaurantName: (id: string) => string;
    getSectorName: (id: string) => string;
}

const SectorView: React.FC<Props> = ({ companyId, config, user, stockItems, getRestaurantName, getSectorName }) => {
    const [activeModule, setActiveModule] = useState<'selection' | 'order' | 'production'>('selection');
    const [dailyProduction, setDailyProduction] = useState<DailyProduction | null>(null);
    const [newProductionTaskName, setNewProductionTaskName] = useState('');
    const [productionPrompt, setProductionPrompt] = useState<{ id: string, name: string } | null>(null);
    const [scheduleForm, setScheduleForm] = useState({ quantity: '', unit: '', date: new Date().toLocaleDateString('en-CA') });

    const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: '', category: '' });
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showStockCount, setShowStockCount] = useState(false);
    const [stockCounts, setStockCounts] = useState<Record<string, number>>({});

    // Delivery Modal
    const [deliveryModalItem, setDeliveryModalItem] = useState<Item | null>(null);

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Dates
    const getBusinessDateString = () => {
        const d = new Date();
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-CA'); // YYYY-MM-DD local
    };
    const orderDate = getBusinessDateString();
    const orderDocId = `${orderDate}_${user.restaurantId}_${user.sectorId}`;

    useEffect(() => {
        // Set defaults
        if (config.units.length > 0 && !newItem.unit) setNewItem(prev => ({ ...prev, unit: config.units[0].name }));
        if (config.categories.length > 0 && !newItem.category) setNewItem(prev => ({ ...prev, category: config.categories[0].name }));

        // Listen to Order
        const unsub = onSnapshot(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId), async (docSnap) => {
            if (docSnap.exists()) {
                setCurrentOrder(docSnap.data() as Order);
            } else {
                // If order doesn't exist for today, check for carry-over
                setCurrentOrder({ items: [] } as any);
                await checkAndCarryOverItems();
            }
        });
        return () => unsub();
    }, [companyId, orderDocId, config]);

    // Carry Over Logic
    const checkAndCarryOverItems = async () => {
        const currentDoc = await getDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId));
        if (currentDoc.exists()) return;

        let lastOrder: Order | null = null;

        // Check past 30 days in parallel for performance
        const pastPromises = [];
        for (let i = 1; i <= 30; i++) {
            const d = new Date();
            if (d.getHours() < 4) d.setDate(d.getDate() - 1);
            d.setDate(d.getDate() - i);
            const pastDateStr = d.toLocaleDateString('en-CA');

            const pastDocId = `${pastDateStr}_${user.restaurantId}_${user.sectorId}`;
            const pastDocRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, pastDocId);
            pastPromises.push(getDoc(pastDocRef));
        }

        const pastSnaps = await Promise.all(pastPromises);
        for (const pastDocSnap of pastSnaps) {
            if (pastDocSnap.exists()) {
                lastOrder = pastDocSnap.data() as Order;
                break; // Since we created them in chronological descending order (i=1 to 30), the first existing is the most recent
            }
        }

        if (!lastOrder) return;

        // Carry over unpurchased items OR purchased items that haven't been delivered
        const itemsToCarry = lastOrder.items.filter(i => {
            if (!i.purchased) return true; // Keep waiting
            if (i.purchased && i.expectedDeliveryDate && !i.isDelivered) return true; // Purchased but waiting delivery
            return false;
        }).map(i => {
            if (i.purchased) {
                // If purchased and pending delivery, keep state mostly as is
                return { ...i };
            } else {
                // If not purchased, reset price/status
                return {
                    ...i,
                    originalDate: i.originalDate || lastOrder!.orderDate,
                    price: 0,
                    addedAt: `(Pendente)`
                };
            }
        });

        if (itemsToCarry.length > 0) {
            const newOrder: Order = {
                restaurantId: user.restaurantId,
                sectorId: user.sectorId,
                responsibleName: user.responsibleName,
                collaborators: ["Sistema (Pendentes)"],
                orderDate,
                createdAt: Timestamp.now(),
                items: itemsToCarry,
                stockCountRequested: false
            };
            await setDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId), newOrder);
        }
    };

    // Scroll chat
    useEffect(() => {
        if (isChatOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isChatOpen, currentOrder?.messages]);

    // Mark messages as read
    useEffect(() => {
        if (isChatOpen && currentOrder?.hasUnreadBuyerMessage) {
            const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);
            updateDoc(docRef, { hasUnreadBuyerMessage: false });
        }
    }, [isChatOpen, currentOrder, companyId, orderDocId]);

    // Derived Data
    const suggestions = useMemo(() => {
        if (newItem.name.length < 2) return [];
        // CHANGED: Filter by Restaurant ID presence only (Global stock per restaurant, ignoring specific sectors)
        return stockItems.filter(item =>
            item.associations && Object.prototype.hasOwnProperty.call(item.associations, user.restaurantId) &&
            item.name.toLowerCase().includes(newItem.name.toLowerCase())
        );
    }, [newItem.name, stockItems, user]);

    const relevantStockItems = useMemo(() => {
        // CHANGED: Filter by Restaurant ID presence only (Global stock per restaurant, ignoring specific sectors)
        return stockItems.filter(item =>
            item.associations && Object.prototype.hasOwnProperty.call(item.associations, user.restaurantId)
        );
    }, [stockItems, user]);

    // Handlers
    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !newItem.quantity) return;

        const itemPayload: Item = {
            id: crypto.randomUUID(),
            name: newItem.name,
            quantity: Number(newItem.quantity),
            unit: newItem.unit,
            category: newItem.category,
            purchased: false,
            price: 0,
            addedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            originalDate: orderDate
        };

        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);

        try {
            if (currentOrder && currentOrder.createdAt) {
                await updateDoc(docRef, {
                    items: arrayUnion(itemPayload),
                    collaborators: arrayUnion(user.responsibleName)
                });
            } else {
                const newOrder: Order = {
                    restaurantId: user.restaurantId,
                    sectorId: user.sectorId,
                    responsibleName: user.responsibleName,
                    collaborators: [user.responsibleName],
                    orderDate,
                    createdAt: Timestamp.now(),
                    items: [itemPayload],
                    stockCountRequested: false
                };
                await setDoc(docRef, newOrder);
            }
            setNewItem(prev => ({ ...prev, name: '', quantity: '' }));
        } catch (error) {
            console.error("Error adding item", error);
        }
    };

    const handleDeleteItem = async (item: Item) => {
        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);
        await updateDoc(docRef, {
            items: arrayRemove(item),
            collaborators: arrayUnion(user.responsibleName)
        });
    };

    const confirmDelivery = async () => {
        if (!deliveryModalItem) return;

        try {
            const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);

            // Find and Update Item
            if (!currentOrder) return;
            const newItems = currentOrder.items.map(i =>
                i.id === deliveryModalItem.id ? { ...i, isDelivered: true } : i
            );
            await updateDoc(docRef, { items: newItems });

            // Update Stock for SPECIFIC RESTAURANT
            const stockItem = stockItems.find(si => si.name.toLowerCase() === deliveryModalItem.name.toLowerCase());
            if (stockItem) {
                await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_items`, stockItem.id), {
                    [`stockByRestaurant.${user.restaurantId}`]: increment(deliveryModalItem.purchasedQuantity || deliveryModalItem.quantity)
                });
            }

            setDeliveryModalItem(null);
        } catch (error) {
            console.error(error);
            alert("Erro ao confirmar recebimento.");
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMessage.trim()) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: chatMessage.trim(),
            sender: 'sector',
            senderName: user.responsibleName,
            timestamp: Timestamp.now()
        };

        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId);

        try {
            if (!currentOrder || !currentOrder.createdAt) {
                await setDoc(docRef, {
                    restaurantId: user.restaurantId,
                    sectorId: user.sectorId,
                    responsibleName: user.responsibleName,
                    collaborators: [user.responsibleName],
                    orderDate,
                    createdAt: Timestamp.now(),
                    items: [],
                    messages: [newMessage],
                    hasUnreadSectorMessage: true
                });
            } else {
                await updateDoc(docRef, {
                    messages: arrayUnion(newMessage),
                    hasUnreadSectorMessage: true,
                    collaborators: arrayUnion(user.responsibleName)
                });
            }
            setChatMessage('');
        } catch (error) {
            console.error("Error sending message", error);
        }
    };

    const handleSaveStockCount = async () => {
        const itemsToSave = relevantStockItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: stockCounts[item.id] !== undefined ? stockCounts[item.id] : null
        })).filter(i => i.quantity !== null && i.quantity !== undefined); // Strict check

        if (itemsToSave.length === 0) return alert("Preencha ao menos um item.");

        await setDoc(doc(db, `${BASE_PATH}/companies/${companyId}/stock_counts`, orderDocId), {
            restaurantId: user.restaurantId,
            sectorId: user.sectorId,
            countedBy: user.responsibleName,
            countedAt: Timestamp.now(),
            status: 'pending', // Pending buyer validation
            items: itemsToSave
        });

        await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_orders`, orderDocId), { stockCountRequested: false });
        alert("Contagem enviada para validação!");
        setShowStockCount(false);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        if (dateStr === orderDate) return "";
        const [y, m, d] = dateStr.split('-');
        return `(${d}/${m})`;
    };

    const renderDeliveryInfo = (item: Item) => {
        if (!item.purchased) return null;

        if (item.isDelivered) {
            return (
                <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-200 animate-pulse mt-1 w-fit">
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
                        onClick={() => setDeliveryModalItem(item)}
                        className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded border border-red-200 animate-bounce hover:bg-red-100 mt-1"
                        title="Clique para confirmar recebimento"
                    >
                        <AlertTriangle className="w-3 h-3" /> ATENÇÃO NÃO CHEGOU!!!
                    </button>
                );
            } else {
                return (
                    <button
                        onClick={() => setDeliveryModalItem(item)}
                        className="flex items-center gap-1 text-amber-600 font-medium text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200 hover:bg-amber-100 mt-1"
                    >
                        <Truck className="w-3 h-3" /> Previsão: {formatDate(item.expectedDeliveryDate)}
                    </button>
                );
            }
        }
        return null;
    };

    const groupedItems = useMemo(() => {
        if (!currentOrder?.items) return {};
        return currentOrder.items.reduce((acc, item) => {
            const cat = item.category || 'Outros';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {} as Record<string, Item[]>);
    }, [currentOrder]);

    // --- Production Logic ---
    useEffect(() => {
        if (activeModule !== 'production') return;

        const unsub = onSnapshot(doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId), async (docSnap) => {
            if (docSnap.exists()) {
                setDailyProduction(docSnap.data() as DailyProduction);
            } else {
                const fixedTasks = config.productionTasks?.filter(t => t.sectorId === user.sectorId && t.restaurantId === user.restaurantId) || [];
                
                // Fetch carry-over production list in parallel
                let carriedProductionList: any[] = [];
                const prodPromises = [];
                for (let i = 1; i <= 10; i++) {
                    const d = new Date();
                    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
                    d.setDate(d.getDate() - i);
                    const pastDateStr = d.toLocaleDateString('en-CA');
                    prodPromises.push(getDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, `${pastDateStr}_${user.restaurantId}_${user.sectorId}`)));
                }
                const prodSnaps = await Promise.all(prodPromises);
                for (const pastDocSnap of prodSnaps) {
                    if (pastDocSnap.exists()) {
                        const pastData = pastDocSnap.data() as DailyProduction;
                        if (pastData.productionList) {
                            carriedProductionList = [...carriedProductionList, ...pastData.productionList.filter(p => p.status === 'pending')];
                        }
                    }
                }
                
                // deduplicate carried list by id
                carriedProductionList = carriedProductionList.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);

                const newDaily: DailyProduction = {
                    restaurantId: user.restaurantId,
                    sectorId: user.sectorId,
                    date: orderDate,
                    tasks: fixedTasks.map(t => ({
                        id: crypto.randomUUID(),
                        name: t.name,
                        type: t.type || 'task',
                        status: 'pending',
                        addedBy: 'buyer'
                    })),
                    productionList: carriedProductionList
                };
                await setDoc(doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId), newDaily);
                setDailyProduction(newDaily);
            }
        });
        return () => unsub();
    }, [companyId, orderDocId, config, activeModule, user, orderDate]);

    const handleAddProductionTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductionTaskName.trim()) return;
        
        const newTask = {
            id: crypto.randomUUID(),
            name: newProductionTaskName.trim(),
            status: 'pending' as const,
            addedBy: 'operator' as const
        };

        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId);
        await updateDoc(docRef, { tasks: arrayUnion(newTask) });
        setNewProductionTaskName('');
    };

    const handleToggleProductionTask = async (taskId: string, currentStatus: string, taskType?: string, taskName?: string) => {
        if (!dailyProduction) return;

        if (currentStatus === 'pending' && taskType === 'production' && taskName) {
            setProductionPrompt({ id: taskId, name: taskName });
            return;
        }

        const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
        const newTasks = dailyProduction.tasks.map(t => 
            t.id === taskId ? { 
                ...t, 
                status: newStatus as any,
                completedAt: newStatus === 'done' ? Timestamp.now() : null,
                operatorName: newStatus === 'done' ? user.responsibleName : null
            } : t
        );
        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId);
        await updateDoc(docRef, { tasks: newTasks });
    };

    const handleConfirmProductionStatus = async (e: React.FormEvent, status: 'done' | 'needs_production') => {
        e.preventDefault();
        if (!productionPrompt || !dailyProduction) return;
        
        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId);

        if (status === 'done') {
            const newTasks = dailyProduction.tasks.map(t => 
                t.id === productionPrompt.id ? { 
                    ...t, 
                    status: 'done' as any,
                    completedAt: Timestamp.now(),
                    operatorName: user.responsibleName
                } : t
            );
            await updateDoc(docRef, { tasks: newTasks });
        } else {
            const newTasks = dailyProduction.tasks.map(t => 
                t.id === productionPrompt.id ? { ...t, status: 'needs_production' as any } : t
            );
            
            const newProductionItem = {
                id: crypto.randomUUID(),
                name: productionPrompt.name,
                quantity: Number(scheduleForm.quantity) || 1,
                unit: scheduleForm.unit || 'un',
                scheduledDate: scheduleForm.date,
                originalDate: orderDate,
                status: 'pending' as const,
                addedBy: 'operator' as const
            };

            await updateDoc(docRef, { 
                tasks: newTasks,
                productionList: arrayUnion(newProductionItem)
            });
        }

        setProductionPrompt(null);
        setScheduleForm({ quantity: '', unit: '', date: orderDate });
    };

    const handleToggleProductionListItem = async (itemId: string, currentStatus: string) => {
        if (!dailyProduction || !dailyProduction.productionList) return;
        const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
        const newList = dailyProduction.productionList.map(p => 
            p.id === itemId ? {
                ...p,
                status: newStatus as 'pending' | 'done',
                completedAt: newStatus === 'done' ? Timestamp.now() : null,
                operatorName: newStatus === 'done' ? user.responsibleName : null
            } : p
        );
        const docRef = doc(db, `${BASE_PATH}/companies/${companyId}/daily_productions`, orderDocId);
        await updateDoc(docRef, { productionList: newList });
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="bg-brand-50 border-l-4 border-brand-500 p-4 rounded-r-lg flex justify-between items-start">
                <div>
                    <h2 className="font-bold text-brand-900">{getRestaurantName(user.restaurantId)} <span className="text-brand-400 mx-2">/</span> {getSectorName(user.sectorId)}</h2>
                    <p className="text-sm text-brand-700 mt-1">Olá, {user.responsibleName}</p>
                    <p className="text-xs text-brand-500 mt-2">{!isNaN(new Date(orderDate).getTime()) ? new Date(orderDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data Inválida'}</p>
                </div>
                <div className="relative">
                    <Button onClick={() => setIsChatOpen(true)} variant="outline" className="text-sm">
                        <MessageCircle className="w-4 h-4" /> Chat
                    </Button>
                    {currentOrder?.hasUnreadBuyerMessage && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    )}
                </div>
            </div>

            {/* Notifications */}
            {activeModule === 'order' && currentOrder?.stockCountRequested && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-3 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                    <div>
                        <p className="font-bold">Contagem de Estoque Solicitada!</p>
                        <p className="text-sm">O comprador precisa que você conte o estoque hoje.</p>
                    </div>
                    <Button onClick={() => setShowStockCount(true)} className="ml-auto bg-amber-500 hover:bg-amber-600 text-white border-none">
                        Contar
                    </Button>
                </div>
            )}

            {activeModule === 'selection' && (
                <div className="flex flex-col md:flex-row gap-6 mt-10">
                    <button 
                        onClick={() => setActiveModule('order')}
                        className="flex-1 bg-white p-10 rounded-2xl shadow-lg border-2 border-transparent hover:border-brand-500 hover:shadow-xl transition-all flex flex-col items-center justify-center gap-4 group"
                    >
                        <div className="bg-brand-50 p-6 rounded-full group-hover:bg-brand-100 transition-colors">
                            <ShoppingCart className="w-16 h-16 text-brand-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800">Fazer Pedido</h3>
                        <p className="text-gray-500 text-center">Solicitar itens da rua ou almoxarifado</p>
                    </button>
                    <button 
                        onClick={() => setActiveModule('production')}
                        className="flex-1 bg-white p-10 rounded-2xl shadow-lg border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all flex flex-col items-center justify-center gap-4 group"
                    >
                        <div className="bg-blue-50 p-6 rounded-full group-hover:bg-blue-100 transition-colors">
                            <ClipboardCheck className="w-16 h-16 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800">Acessar Produção</h3>
                        <p className="text-gray-500 text-center">Verificar e gerir tarefas de produção diárias</p>
                    </button>
                </div>
            )}

            {activeModule === 'production' && (
                <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
                    <Button variant="secondary" onClick={() => setActiveModule('selection')} className="mb-4">
                        ← Voltar ao Início
                    </Button>
                    <Card title="Checklist de Produção">
                        <form onSubmit={handleAddProductionTask} className="flex gap-2 mb-6">
                            <Input 
                                placeholder="Adicionar tarefa extra / Produção a ser feita..." 
                                value={newProductionTaskName} 
                                onChange={e => setNewProductionTaskName(e.target.value)} 
                                className="flex-1"
                            />
                            <Button type="submit"><Plus className="w-4 h-4" /> Adicionar</Button>
                        </form>
                        
                        {(!dailyProduction?.tasks || dailyProduction.tasks.length === 0) ? (
                            <p className="text-gray-400 text-center py-4">Nenhuma tarefa no checklist para hoje.</p>
                        ) : (
                            <ul className="space-y-3">
                                {dailyProduction.tasks.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map(t => {
                                    const effectiveType = t.type || config.productionTasks?.find(ct => ct.name === t.name && ct.sectorId === user.sectorId)?.type || 'task';
                                    return (
                                    <li key={t.id} className={`flex justify-between items-center p-4 rounded-lg border ${t.status === 'done' ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200 shadow-sm'}`}>
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handleToggleProductionTask(t.id, t.status, effectiveType, t.name)}
                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${t.status === 'done' ? 'bg-green-500 border-green-500 text-white' : (t.status === 'needs_production' ? 'bg-amber-100 border-amber-300 text-amber-500' : 'border-gray-300 hover:border-blue-500 text-transparent hover:text-blue-500')}`}
                                            >
                                                <Check className="w-5 h-5 flex-shrink-0" />
                                            </button>
                                            <div>
                                                <span className={`font-medium ${t.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                    {t.name}
                                                    {effectiveType === 'production' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Produção</span>}
                                                    {t.status === 'needs_production' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">Agendado</span>}
                                                </span>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {t.addedBy === 'buyer' ? 'Fixa' : 'Extra'} 
                                                    {t.status === 'done' && t.operatorName && ` • Finalizado por ${t.operatorName}`}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                    );
                                })}
                            </ul>
                        )}

                        {dailyProduction?.productionList && dailyProduction.productionList.length > 0 && (
                            <div className="mt-8 pt-6 border-t">
                                <h3 className="font-bold text-lg text-blue-800 mb-4">Lista de Produção (A Fazer)</h3>
                                <ul className="space-y-3">
                                    {dailyProduction.productionList.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map(pl => {
                                        const isLate = pl.status === 'pending' && pl.scheduledDate < orderDate;
                                        return (
                                            <li key={pl.id} className={`flex justify-between items-center p-4 rounded-lg border ${pl.status === 'done' ? 'bg-gray-50 border-gray-200' : (isLate ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')} shadow-sm`}>
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => handleToggleProductionListItem(pl.id, pl.status)}
                                                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${pl.status === 'done' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-blue-300 hover:border-blue-500 text-transparent hover:text-blue-500'}`}
                                                    >
                                                        <Check className="w-5 h-5 flex-shrink-0" />
                                                    </button>
                                                    <div>
                                                        <span className={`font-bold ${pl.status === 'done' ? 'text-gray-500 line-through' : 'text-blue-900'}`}>
                                                            {pl.name}
                                                        </span>
                                                        <span className="ml-2 font-mono text-sm text-blue-700 bg-white px-2 py-0.5 rounded border">{pl.quantity} {pl.unit}</span>
                                                        <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                                            <span className={`${isLate ? 'text-red-600 font-bold' : ''}`}>
                                                                Para: {pl.scheduledDate.split('-').reverse().join('/')} {isLate && '(Atrasado)'}
                                                            </span>
                                                            {pl.status === 'done' && pl.operatorName && ` • Produzido por ${pl.operatorName}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {activeModule === 'order' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="col-span-1 lg:col-span-2">
                    <Button variant="secondary" onClick={() => setActiveModule('selection')} className="mb-2">
                        ← Voltar ao Início
                    </Button>
                </div>
                {/* Order Form & List */}
                <div className="space-y-6">
                    <Card title="Adicionar ao Pedido">
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div className="relative">
                                <Input
                                    placeholder="Nome do item (ex: Arroz)"
                                    value={newItem.name}
                                    onChange={e => {
                                        setNewItem(prev => ({ ...prev, name: e.target.value }));
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    autoComplete="off"
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border shadow-lg rounded-lg mt-1 max-h-48 overflow-auto">
                                        {suggestions.map(s => (
                                            <div key={s.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                onClick={() => {
                                                    setNewItem(prev => ({ ...prev, name: s.name, unit: s.unit, category: s.category }));
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {s.name} <span className="text-gray-400 text-xs">({s.unit})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="Qtd" step="any" value={newItem.quantity} onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))} />
                                <Select value={newItem.unit} onChange={e => setNewItem(prev => ({ ...prev, unit: e.target.value }))}>
                                    {config.units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                </Select>
                                <Select value={newItem.category} onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}>
                                    {config.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </Select>
                            </div>
                            <Button type="submit" className="w-full">Adicionar <Plus className="w-4 h-4" /></Button>
                        </form>
                    </Card>

                    <Card title="Lista do Pedido">
                        {(!currentOrder?.items || currentOrder.items.length === 0) ? (
                            <p className="text-gray-400 text-center py-4">Nenhum item adicionado ainda.</p>
                        ) : (
                            <div className="space-y-4">
                                {Object.keys(groupedItems).map(cat => (
                                    <div key={cat}>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b pb-1">{cat}</h4>
                                        <ul className="space-y-2">
                                            {groupedItems[cat].map(item => (
                                                <li key={item.id} className="flex justify-between items-center group bg-gray-50 p-2 rounded hover:bg-gray-100 transition">
                                                    <div className={item.purchased && !item.expectedDeliveryDate ? 'opacity-50 line-through' : ''}>
                                                        <div className="flex items-center gap-1">
                                                            {item.originalDate && item.originalDate !== orderDate && (
                                                                <span className="text-red-500 font-bold mr-1 text-sm">{formatDate(item.originalDate)}</span>
                                                            )}
                                                            <span className="font-medium">{item.name}</span>
                                                        </div>
                                                        <span className="text-sm text-gray-600 ml-2">{item.quantity} {item.unit}</span>
                                                        {item.addedAt && !item.originalDate && <span className="text-xs text-brand-500 ml-2 block sm:inline">{item.addedAt}</span>}
                                                        {renderDeliveryInfo(item)}
                                                    </div>
                                                    {!item.purchased && (
                                                        <button onClick={() => handleDeleteItem(item)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Stock Count Panel */}
                {(showStockCount || currentOrder?.stockCountRequested) && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <Card title="Contagem de Estoque" className="border-l-4 border-l-amber-400 h-full">
                            <div className="mb-4 flex justify-between items-center">
                                <p className="text-sm text-gray-500">Informe a quantidade atual.</p>
                                <Button variant="secondary" onClick={() => setShowStockCount(false)} className="text-xs py-1 h-8">Ocultar</Button>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
                                {relevantStockItems.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4">Nenhum item associado a esta empresa.</p>
                                ) : (
                                    Object.entries(
                                        relevantStockItems.reduce((acc, item) => {
                                            const cat = item.category || 'Outros';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(item);
                                            return acc;
                                        }, {} as Record<string, StockItem[]>)
                                    ).sort((a, b) => a[0].localeCompare(b[0])).map(([category, items]) => (
                                        <div key={category} className="mb-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b pb-1 sticky top-0 bg-white z-10">{category}</h4>
                                            <div className="space-y-3">
                                                {items.sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                                                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                                        <label htmlFor={`count-${item.id}`} className="text-sm font-medium flex-1">{item.name}</label>
                                                        <input
                                                            id={`count-${item.id}`}
                                                            type="number"
                                                            className="w-20 p-1 border rounded text-center"
                                                            placeholder="Qtd"
                                                            value={stockCounts[item.id] !== undefined ? stockCounts[item.id] : ''}
                                                            onChange={e => setStockCounts(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) }))}
                                                        />
                                                        <span className="text-xs text-gray-400 ml-1 w-8">{item.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <Button onClick={handleSaveStockCount} variant="success" className="w-full mt-4">
                                Enviar para Validação <Check className="w-4 h-4" />
                            </Button>
                        </Card>
                    </div>
                )}

                {!showStockCount && !currentOrder?.stockCountRequested && (
                    <div className="flex justify-center items-start pt-10">
                        <Button variant="secondary" onClick={() => setShowStockCount(true)}>
                            Abrir Contagem Manual
                        </Button>
                    </div>
                )}
            </div>
            )}

            {/* Chat Modal */}
            <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} title="Chat com o Comprador">
                <div className="flex flex-col h-[50vh]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg mb-4">
                        {(!currentOrder?.messages || currentOrder.messages.length === 0) ? (
                            <p className="text-center text-gray-400 text-sm">Nenhuma mensagem ainda.</p>
                        ) : (
                            currentOrder.messages.map((msg) => {
                                const isMe = msg.sender === 'sector';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-brand-100 text-brand-900 rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none'}`}>
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
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                            value={chatMessage}
                            onChange={e => setChatMessage(e.target.value)}
                            placeholder="Digite sua mensagem..."
                            className="flex-1"
                            autoFocus
                        />
                        <Button type="submit"><Send className="w-4 h-4" /></Button>
                    </form>
                </div>
            </Modal>

            {/* Confirm Delivery Modal */}
            <Modal isOpen={!!deliveryModalItem} onClose={() => setDeliveryModalItem(null)} title="Confirmar Entrega">
                <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <h3 className="font-bold text-lg text-green-800">Chegou?</h3>
                        <p className="text-sm text-green-700 mt-1">{deliveryModalItem?.name}</p>
                    </div>
                    <p className="text-gray-600 text-sm text-center">
                        Confirme que recebeu <strong>{deliveryModalItem?.purchasedQuantity || deliveryModalItem?.quantity} {deliveryModalItem?.unit}</strong>. O estoque será atualizado automaticamente.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setDeliveryModalItem(null)} className="flex-1">Cancelar</Button>
                        <Button onClick={confirmDelivery} variant="success" className="flex-1">Sim, Recebido!</Button>
                    </div>
                </div>
            </Modal>

            {/* Production Prompt Modal */}
            <Modal isOpen={!!productionPrompt} onClose={() => setProductionPrompt(null)} title="Status da Produção">
                <div className="space-y-6">
                    <p className="text-center text-gray-700">Como está a situação para: <strong>{productionPrompt?.name}</strong>?</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="success" onClick={(e) => handleConfirmProductionStatus(e, 'done')} className="h-16 flex flex-col items-center justify-center text-sm">
                            <CheckCircle className="w-6 h-6 mb-1" /> OK (Pronto / Tem Estoque)
                        </Button>
                        
                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-2 flex flex-col gap-2">
                            <span className="text-center font-bold text-amber-800 text-xs uppercase">Precisa Fazer</span>
                            <form onSubmit={(e) => handleConfirmProductionStatus(e, 'needs_production')} className="flex flex-col gap-2">
                                <div className="flex gap-1">
                                    <Input 
                                        type="number" 
                                        placeholder="Qtd" 
                                        className="w-1/2 text-sm" 
                                        value={scheduleForm.quantity} 
                                        onChange={e => setScheduleForm({...scheduleForm, quantity: e.target.value})}
                                        required 
                                    />
                                    <Input 
                                        placeholder="Un" 
                                        className="w-1/2 text-sm" 
                                        value={scheduleForm.unit} 
                                        onChange={e => setScheduleForm({...scheduleForm, unit: e.target.value})} 
                                    />
                                </div>
                                <Input 
                                    type="date" 
                                    className="text-sm" 
                                    value={scheduleForm.date} 
                                    onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})}
                                    required 
                                />
                                <Button type="submit" className="w-full text-xs h-8 bg-amber-500 hover:bg-amber-600 border-amber-500 text-white">Agendar na Lista</Button>
                            </form>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SectorView;
