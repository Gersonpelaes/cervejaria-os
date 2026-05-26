import React, { useState, useEffect } from 'react';
import { LayoutGrid, ShoppingCart, Coffee, Settings, Plus, Minus, Search, Bell, Clock, Utensils, Check, CreditCard, Banknote, Receipt, BarChart2, ArrowLeft, ChevronDown, ChevronUp, Copy, Truck, ShoppingBag } from 'lucide-react';
import { io } from 'socket.io-client';

const HOST = window.location.hostname;
const PORT = window.location.port || '3001';
const API_URL = `http://${HOST}:${PORT}/api`;
// Conecta o WebSocket no Backend
const socket = io(`http://${HOST}:${PORT}`);

function App() {
  const [activeTab, setActiveTab] = useState('tables'); 
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTable, setActiveTable] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados Reais vindos do Banco (SQLite)
  const [tables, setTables] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ id: 'all', name: 'Todos' }]);
  
  // Estado temporário para novos itens na comanda antes de enviar p/ cozinha
  const [tempOrder, setTempOrder] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Módulo de Delivery & Entregadores
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [activeDeliveryOrderId, setActiveDeliveryOrderId] = useState(null);
  const [currentDeliveryData, setCurrentDeliveryData] = useState({
    type: 'MESA', // MESA, DELIVERY, BALCAO
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    deliveryFee: 0,
    driverId: ''
  });
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState({});
  
  // Modais de Cadastro
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [productTab, setProductTab] = useState('basic'); // basic, fraction, fiscal
  
  // Modal de Fracionamento e Observações
  const [fractionConfig, setFractionConfig] = useState(null); // { baseProduct, selectedFlavors: [] }
  const [obsConfig, setObsConfig] = useState(null); // { baseProduct, selectedObs: [] }

  // Autenticação e Caixa
  const [currentUser, setCurrentUser] = useState(null);
  const [passcode, setPasscode] = useState('');
  
  // Modal de Pagamento Avançado
  const [paymentData, setPaymentData] = useState({
    discount: 0,
    useServiceFee: true,
    couvert: 0,
    payments: [] // { method: 'pix', amount: 50 }
  });

  // Transferências e Pagamento Parcial
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [selectedItemsForOp, setSelectedItemsForOp] = useState([]); // { id, maxQty, qtyToOp, price, name }
  const [destinationTableId, setDestinationTableId] = useState('');

  // Estados de Caixa
  const [currentCashRegister, setCurrentCashRegister] = useState(null);
  const [cashReport, setCashReport] = useState(null);
  const [cashHistory, setCashHistory] = useState([]);
  const [declaredBalances, setDeclaredBalances] = useState({
    'Dinheiro': '',
    'PIX': '',
    'Cartão de Crédito': '',
    'Cartão de Débito': '',
    'Vale-Refeição': '',
    'Conta Assinada': ''
  });
  const [initialCash, setInitialCash] = useState('');

  // Estados para Sangria e Suprimento
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('sangria'); // 'sangria' ou 'suprimento'
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');


  // Configurações
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [salesReportData, setSalesReportData] = useState(null);
  const [restaurantConfig, setRestaurantConfig] = useState({
    name: 'CERVEJARIA OS',
    address: 'Rua das Cervejas, 123 - Centro',
    phone: '(11) 99999-9999',
    footerMessage: 'Obrigado pela preferência! Volte sempre!',
    defaultServiceFee: 10,
    defaultCouvert: 0,
    maxTables: 50
  });

  // Configurações de Impressora e Modal Simulador
  const [printerConfig, setPrinterConfig] = useState({
    autoPrint: false,
    printPreBillAlwaysAsk: true,
    printCheckoutAlwaysAsk: true,
    printRegisterCloseEnabled: true,
    sectors: {
      CAIXA: { type: 'SIMULATOR', interface: '' },
      COZINHA: { type: 'SIMULATOR', interface: '' },
      BAR: { type: 'SIMULATOR', interface: '' }
    }
  });
  const [isPrinterPreviewOpen, setIsPrinterPreviewOpen] = useState(false);
  const [printerPreviewText, setPrinterPreviewText] = useState('');
  const [discoveredPrinters, setDiscoveredPrinters] = useState({ localPrinters: [], networkPrinters: [] });
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [activeScanningSector, setActiveScanningSector] = useState(null);

  
  // Filtros do Relatório
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    categoryId: ''
  });

  // Estado para visibilidade dos painéis colapsáveis (accordion) na Retaguarda
  const [expandedCards, setExpandedCards] = useState({
    restaurant: false,
    printer: false,
    categories: false,
    users: false,
    paymentMethods: false,
    products: false,
    drivers: false
  });

  const toggleCard = (cardKey) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  // Estados de filtro para o Catálogo de Produtos na Retaguarda
  const [prodSearchText, setProdSearchText] = useState('');
  const [prodSearchGroup, setProdSearchGroup] = useState('');
  const [prodSearchCategory, setProdSearchCategory] = useState('');

  // Duplicar produto
  const handleDuplicateProduct = (product) => {
    setEditingProduct({
      ...product,
      id: undefined,
      codigo: '',
      name: `${product.name} (Cópia)`
    });
    setProductTab('basic');
    setIsProductModalOpen(true);
  };

  // Carregar dados iniciais do Banco SQLite
  const fetchData = async (targetTab = activeTab, filters = reportFilters) => {
    try {
      // Puxa Produtos
      const prodRes = await fetch(`${API_URL}/products`);
      const prodData = await prodRes.json();
      setProducts(prodData);
      
      // Gera as categorias a partir da API (Modificado para pegar do BD e não gerar dos produtos)
      const catRes = await fetch(`${API_URL}/categories`);
      const catData = await catRes.json();
      setCategories([{ id: 'all', name: 'Todos', icon: '📋' }, ...catData]);

      // Chamadas Paralelas
      const [
        tablesRes, 
        kitchenRes, 
        currentCashRes, 
        historyRes, 
        pmRes, 
        printerRes, 
        restaurantRes,
        deliveryRes,
        driversRes
      ] = await Promise.all([
        fetch(`${API_URL}/tables`),
        fetch(`${API_URL}/kitchen`),
        fetch(`${API_URL}/cash/report/current`),
        fetch(`${API_URL}/cash/history`),
        fetch(`${API_URL}/payment_methods`),
        fetch(`${API_URL}/settings/printer`),
        fetch(`${API_URL}/settings/restaurant`),
        fetch(`${API_URL}/orders/delivery`),
        fetch(`${API_URL}/drivers`)
      ]);

      setTables(await tablesRes.json());
      setKitchenOrders(await kitchenRes.json());
      setDeliveryOrders(await deliveryRes.json());
      setDrivers(await driversRes.json());
      
      const currentCashReport = await currentCashRes.json();
      if (currentCashReport) {
        setCurrentCashRegister(currentCashReport.caixa);
        setCashReport(currentCashReport.totals);
      } else {
        setCurrentCashRegister(null);
        setCashReport(null);
      }
      
      setCashHistory(await historyRes.json());
      setPaymentMethods(await pmRes.json());
      setPrinterConfig(await printerRes.json());
      setRestaurantConfig(await restaurantRes.json());

      if (targetTab === 'reports') {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append('startDate', filters.startDate);
        if (filters.endDate) queryParams.append('endDate', filters.endDate);
        if (filters.categoryId) queryParams.append('categoryId', filters.categoryId);
        
        const repRes = await fetch(`${API_URL}/reports/sales?${queryParams.toString()}`);
        setSalesReportData(await repRes.json());
      }

    } catch (error) {
      console.error("Erro ao buscar dados do servidor local:", error);
    }
  };

  useEffect(() => {
    fetchData();

    // Ouvintes de WebSocket para tempo real
    socket.on('tableUpdate', fetchData);
    socket.on('newKitchenTicket', fetchData);
    socket.on('ticketReady', fetchData);
    socket.on('deliveryUpdate', fetchData);

    return () => {
      socket.off('tableUpdate');
      socket.off('newKitchenTicket');
      socket.off('ticketReady');
      socket.off('deliveryUpdate');
    };
  }, []);

  // Derivados
  const filteredProducts = products.filter(p => {
    const matchCategory = activeCategory === 'all' || p.categoryId === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const currentTableData = tables.find(t => t.id === activeTable);
  const currentOrder = activeTable 
    ? currentTableData?.orders?.[0]
    : (activeDeliveryOrderId ? deliveryOrders.find(o => o.id === activeDeliveryOrderId) : null);
  const existingItems = currentOrder?.items || [];
  
  const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  const existingTotal = calculateTotal(existingItems);
  const tempTotal = calculateTotal(tempOrder);
  const combinedTotal = existingTotal + tempTotal;

  // Ações de Impressão
  const handlePrinterResponse = (res) => {
    if (res.success) {
      if (res.mode === 'SIMULATOR') {
        setPrinterPreviewText(res.text);
        setIsPrinterPreviewOpen(true);
      } else {
        alert("Cupom enviado para a impressora física com sucesso!");
      }
    } else {
      if (res.mode === 'SIMULATOR') {
        setPrinterPreviewText(res.text);
        setIsPrinterPreviewOpen(true);
        console.warn("Impressora física falhou ou não conectada. Exibindo no simulador. Erro: " + res.error);
      } else {
        alert("Erro de impressão: " + (res.error || "Erro desconhecido"));
      }
    }
  };

  const handleDiscoverPrinters = async (sectorKey) => {
    setActiveScanningSector(sectorKey);
    setIsScanningPrinters(true);
    setDiscoveredPrinters({ localPrinters: [], networkPrinters: [] });
    try {
      const res = await fetch(`${API_URL}/settings/printer/discover`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredPrinters({
          localPrinters: data.localPrinters || [],
          networkPrinters: data.networkPrinters || []
        });
      } else {
        alert("Erro ao buscar impressoras. Certifique-se de que o backend está ativo.");
      }
    } catch (err) {
      console.error(err);
      alert("Falha na varredura: " + err.message);
    } finally {
      setIsScanningPrinters(false);
    }
  };

  const printBill = async () => {
    if (!currentOrder) return;
    if (printerConfig.printPreBillAlwaysAsk) {
      const confirmPrint = window.confirm("Deseja realmente imprimir a Pré-Conta/Conferência de Mesa?");
      if (!confirmPrint) return;
    }
    try {
      const res = await fetch(`${API_URL}/orders/${currentOrder.id}/print-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount: paymentData.discount,
          serviceFee: paymentData.useServiceFee ? calculateTotal(selectedItemsForOp.length > 0 ? selectedItemsForOp.map(i => ({ price: i.price, qty: i.qtyToOp })) : existingItems) * ((restaurantConfig.defaultServiceFee || 10) / 100) : 0,
          couvert: paymentData.couvert,
          peopleCount: paymentData.peopleCount || 1
        })
      });
      const data = await res.json();
      handlePrinterResponse(data);
    } catch (err) {
      alert("Erro ao imprimir pré-conta: " + err.message);
    }
  };

  const printKitchen = async () => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${API_URL}/orders/${currentOrder.id}/print-kitchen`, {
        method: 'POST'
      });
      const data = await res.json();
      handlePrinterResponse(data);
    } catch (err) {
      alert("Erro ao re-imprimir cozinha: " + err.message);
    }
  };

  const printReceipt = async (orderId) => {
    if (printerConfig.printCheckoutAlwaysAsk) {
      const confirmPrint = window.confirm("Deseja realmente imprimir o comprovante de pagamento / recibo?");
      if (!confirmPrint) return;
    }
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/print-receipt`, {
        method: 'POST'
      });
      const data = await res.json();
      handlePrinterResponse(data);
    } catch (err) {
      alert("Erro ao imprimir recibo: " + err.message);
    }
  };

  const printCashRegisterClosure = async (cashRegisterId) => {
    try {
      const res = await fetch(`${API_URL}/cash/close/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashRegisterId })
      });
      const data = await res.json();
      handlePrinterResponse(data);
    } catch (err) {
      alert("Erro ao imprimir fechamento de caixa: " + err.message);
    }
  };

  const printTransactionVoucher = async (transactionId) => {
    try {
      const res = await fetch(`${API_URL}/cash/transactions/${transactionId}/print`, {
        method: 'POST'
      });
      const data = await res.json();
      handlePrinterResponse(data);
    } catch (err) {
      alert("Erro ao imprimir comprovante: " + err.message);
    }
  };

  // Ações do PDV
  const addToOrder = (product) => {
    if (product.availableObs && product.availableObs.trim().length > 0) {
      setObsConfig({ baseProduct: product, selectedObs: [] });
      return;
    }
    
    // Se não tem obs, adiciona direto (mesmo que suporte fracionar, pois o cliente quis apenas 1 sabor)
    setTempOrder(prev => {
      const existing = prev.find(item => item.productId === product.id && !item.isFractioned && !item.observations);
      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: Date.now().toString(), productId: product.id, name: product.name, price: product.price, qty: 1, isFractioned: false }];
    });
  };

  const confirmFractionalOrder = () => {
    if (!fractionConfig) return;
    const { baseProduct, selectedFlavors, fractionPriceMode } = fractionConfig;
    
    if (selectedFlavors.length === 0) {
      alert("Selecione pelo menos um sabor!");
      return;
    }

    // Regra da Fração: Maior Valor ou Média
    let finalPrice = 0;
    if (fractionPriceMode === 'average') {
      const sum = selectedFlavors.reduce((acc, f) => acc + f.price, 0);
      finalPrice = sum / selectedFlavors.length;
    } else {
      finalPrice = Math.max(...selectedFlavors.map(f => f.price));
    }
    
    // Monta o nome (Ex: 1/2 Calabresa, 1/2 Frango)
    const fractionName = selectedFlavors.map(f => `1/${selectedFlavors.length} ${f.name}`).join(' + ');
    const finalName = `${baseProduct.name} (${fractionName})`;

    setTempOrder(prev => [
      ...prev, 
      { 
        id: Date.now().toString(),
        productId: baseProduct.id, 
        name: finalName, 
        price: finalPrice, 
        qty: 1, 
        isFractioned: true 
      }
    ]);
    
    setFractionConfig(null);
  };

  const updateTempQty = (id, delta) => {
    setTempOrder(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  // Enviar pedido para a API
  const sendToKitchen = async () => {
    const isDeliveryOrBalcao = currentDeliveryData.type === 'DELIVERY' || currentDeliveryData.type === 'BALCAO';
    if (tempOrder.length === 0) return;
    if (!isDeliveryOrBalcao && !activeTable) return;

    try {
      const payload = {
        items: tempOrder,
        type: currentDeliveryData.type,
        customerName: isDeliveryOrBalcao ? currentDeliveryData.customerName : null,
        customerPhone: isDeliveryOrBalcao ? currentDeliveryData.customerPhone : null,
        customerAddress: currentDeliveryData.type === 'DELIVERY' ? currentDeliveryData.customerAddress : null,
        deliveryFee: currentDeliveryData.type === 'DELIVERY' ? Number(currentDeliveryData.deliveryFee || 0) : 0,
        tableId: isDeliveryOrBalcao ? null : activeTable
      };

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.printerResult) {
          handlePrinterResponse(data.printerResult);
        }
        setTempOrder([]);
        
        // Se for Delivery ou Balcão, limpa os dados e volta para a aba delivery
        if (isDeliveryOrBalcao) {
          setCurrentDeliveryData({
            type: 'MESA',
            customerName: '',
            customerPhone: '',
            customerAddress: '',
            deliveryFee: 0,
            driverId: ''
          });
          setActiveTab('delivery');
        }
      } else {
        const data = await res.json();
        alert("Erro ao enviar pedido: " + (data.error || "Erro desconhecido"));
      }
    } catch (err) {
      alert("Erro ao enviar pedido para o servidor: " + err.message);
    }
  };

  // Ações de Delivery & Balcão (API)
  const handleDispatchOrder = async (orderId) => {
    const driverId = selectedDriverForOrder[orderId];
    if (!driverId) {
      alert("Por favor, selecione um motoboy/entregador para despachar!");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/delivery-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryStatus: 'delivering',
          driverId
        })
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Erro ao despachar pedido.");
      }
    } catch (err) {
      alert("Erro ao despachar: " + err.message);
    }
  };

  const handleUpdateDeliveryStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/delivery-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryStatus: newStatus
        })
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Erro ao atualizar status do pedido.");
      }
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleCheckoutDeliveryOrder = (orderId) => {
    const orderObj = deliveryOrders.find(o => o.id === orderId);
    if (!orderObj) return;

    setActiveTable(null);
    setActiveDeliveryOrderId(orderId);
    
    setPaymentData({
      discount: 0,
      useServiceFee: false,
      couvert: 0,
      deliveryFee: orderObj.type === 'DELIVERY' ? (orderObj.deliveryFee || 0) : 0,
      payments: [],
      peopleCount: 1
    });
    setIsPaymentModalOpen(true);
  };

  // Ações da Cozinha (API)
  const markTicketReady = async (ticketId) => {
    await fetch(`${API_URL}/kitchen/${ticketId}/ready`, { method: 'PUT' });
  };

  // Ações de Pagamento (API) Avançado
  const handleCheckout = (isPartial = false) => {
    if (existingItems.length === 0 && tempOrder.length === 0) return;
    if (tempOrder.length > 0) {
      alert("Existem itens não enviados para a cozinha!");
      return;
    }
    
    if (isPartial && selectedItemsForOp.length === 0) {
      alert("Selecione os itens para pagar!");
      return;
    }

    setPaymentData({
      discount: 0,
      useServiceFee: currentOrder?.type === 'MESA',
      couvert: currentOrder?.type === 'MESA' ? (restaurantConfig.defaultCouvert || 0) : 0,
      deliveryFee: currentOrder?.type === 'DELIVERY' ? (currentOrder?.deliveryFee || 0) : 0,
      payments: [],
      peopleCount: 1 // Adicionado PAX
    });
    setIsPaymentModalOpen(true);
    if(isPartial) setIsPartialModalOpen(false);
  };

  const calculateFinalTotal = () => {
    // Se tiver itens selecionados para operação, usa eles, senão usa tudo
    const baseItems = isPartialModalOpen || selectedItemsForOp.length > 0 ? selectedItemsForOp.map(i => ({ price: i.price, qty: i.qtyToOp })) : existingItems;
    const baseTotal = calculateTotal(baseItems);
    const serviceFee = paymentData.useServiceFee ? baseTotal * ((restaurantConfig.defaultServiceFee || 10) / 100) : 0;
    const deliveryFeeVal = currentOrder?.type === 'DELIVERY' ? Number(paymentData.deliveryFee || 0) : 0;
    return baseTotal + serviceFee + deliveryFeeVal + Number(paymentData.couvert) - Number(paymentData.discount);
  };

  const getRemainingBalance = () => {
    const paid = paymentData.payments.reduce((acc, p) => acc + p.amount, 0);
    return calculateFinalTotal() - paid;
  };

  const addPartialPayment = (method, amount) => {
    const numAmount = Number(amount);
    const rem = getRemainingBalance();
    if (numAmount <= 0 || numAmount > rem + 0.05) { // margem erro float
      alert("Valor inválido ou maior que o restante.");
      return;
    }
    setPaymentData(prev => ({
      ...prev,
      payments: [...prev.payments, { method, amount: numAmount }]
    }));
    
    // Atualiza a caixinha com o saldo que sobrou
    const novoSaldo = rem - numAmount;
    const inputEl = document.getElementById('partialPaymentAmount');
    if (inputEl) {
      inputEl.value = novoSaldo > 0 ? novoSaldo.toFixed(2) : '0.00';
    }
  };

  const finishPayment = async () => {
    if (!currentOrder) return;
    if (getRemainingBalance() > 0.05) {
      alert("Ainda há saldo pendente para fechar a conta!");
      return;
    }
    
    const isPartial = selectedItemsForOp.length > 0;
    const endpoint = isPartial ? `/orders/${currentOrder.id}/partial-checkout` : `/orders/${currentOrder.id}/checkout`;
    
    const baseItems = isPartialModalOpen || selectedItemsForOp.length > 0 ? selectedItemsForOp.map(i => ({ price: i.price, qty: i.qtyToOp })) : existingItems;
    const baseTotal = calculateTotal(baseItems);

    const bodyData = {
      payments: paymentData.payments,
      discount: paymentData.discount,
      serviceFee: paymentData.useServiceFee ? (baseTotal * ((restaurantConfig.defaultServiceFee || 10) / 100)) : 0,
      couvert: paymentData.couvert,
      deliveryFee: currentOrder?.type === 'DELIVERY' ? Number(paymentData.deliveryFee || 0) : 0,
      total: calculateFinalTotal(),
      peopleCount: paymentData.peopleCount || 1
    };

    if (isPartial) {
      bodyData.itemsToPay = selectedItemsForOp.map(i => ({ id: i.id, qty: i.qtyToOp }));
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert("Erro ao fechar conta (Server): " + (errData.error || "Desconhecido"));
        return;
      }

      const resData = await res.json();

      setIsPaymentModalOpen(false);
      setSelectedItemsForOp([]);
      
      if (currentOrder.type === 'DELIVERY' || currentOrder.type === 'BALCAO') {
        setActiveTab('delivery');
      } else {
        setActiveTab('tables');
      }
      setActiveTable(null);
      setActiveDeliveryOrderId(null);

      // Auto-impressão do Recibo de Venda/Pagamento
      const orderIdToPrint = isPartial ? resData.paidOrderId : resData.orderId;
      if (orderIdToPrint) {
        await printReceipt(orderIdToPrint);
      }
    } catch (err) {
      alert("Erro JS ou de Rede ao Finalizar Pagamento: " + err.message);
    }
  };

  const executeTransfer = async () => {
    if (!destinationTableId) { alert('Selecione a mesa destino'); return; }
    if (selectedItemsForOp.length === 0) { alert('Selecione os itens'); return; }

    await fetch(`${API_URL}/orders/${currentOrder.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationTableId,
        itemsToTransfer: selectedItemsForOp.map(i => ({ id: i.id, qty: i.qtyToOp }))
      })
    });

    setIsTransferModalOpen(false);
    setSelectedItemsForOp([]);
    setActiveTab('tables');
    setActiveTable(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      if (!res.ok) {
        alert("Senha incorreta");
        return;
      }
      const user = await res.json();
      setCurrentUser(user);
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar no servidor local.");
    }
  };

  const handleOpenCash = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/cash/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalance: Number(initialCash) || 0, userId: currentUser.id })
    });
    const caixa = await res.json();
    setCurrentCashRegister(caixa);
    fetchData(); // Recarrega o report
  };

  const handleOpenTransactionModal = (type) => {
    setTransactionType(type);
    setTransactionAmount('');
    setTransactionDescription('');
    setIsTransactionModalOpen(true);
  };

  const handleSubmitTransaction = async () => {
    const amount = Number(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor, insira um valor válido maior que zero.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/cash/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashRegisterId: currentCashRegister.id,
          type: transactionType,
          amount: amount,
          description: transactionDescription
        })
      });

      if (res.ok) {
        const createdTransaction = await res.json();
        alert(`${transactionType === 'sangria' ? 'Sangria' : 'Suprimento'} registrado com sucesso!`);
        setIsTransactionModalOpen(false);
        fetchData();

        // Auto-impressão do comprovante
        if (createdTransaction && createdTransaction.id) {
          await printTransactionVoucher(createdTransaction.id);
        }
      } else {
        const errData = await res.json();
        alert("Erro ao registrar: " + (errData.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar ao servidor.");
    }
  };

  const handleCloseCash = async () => {

    if (declaredBalances['Dinheiro'] === '') {
      alert("Informe pelo menos o valor de Dinheiro contado em gaveta!");
      return;
    }

    const finalBalances = {};
    Object.keys(declaredBalances).forEach(m => {
      finalBalances[m] = Number(declaredBalances[m]) || 0;
    });

    try {
      const res = await fetch(`${API_URL}/cash/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cashRegisterId: currentCashRegister.id, 
          declaredBalances: finalBalances 
        })
      });
      
      if (res.ok) {
        const resData = await res.json();
        alert("Caixa Fechado com Sucesso!");

        // Salva o ID do caixa antes de limpar
        const closedId = currentCashRegister.id;

        setDeclaredBalances({
          'Dinheiro': '',
          'PIX': '',
          'Cartão de Crédito': '',
          'Cartão de Débito': '',
          'Vale-Refeição': '',
          'Conta Assinada': ''
        });
        fetchData();

        // Auto-impressão do Fechamento de Caixa
        if (closedId) {
          await printCashRegisterClosure(closedId);
        }
      } else {
        const errData = await res.json();
        alert("Erro ao fechar caixa: " + (errData.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar ao servidor.");
    }
  };

  // TELA DE LOGIN (Se não estiver logado)
  if (!currentUser) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)' }}>
          <Utensils size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
          <h1 style={{ marginBottom: '8px' }}>Colibri Web PDV</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Digite sua senha numérica de operador.</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Senha (ex: 1234)" 
              autoComplete="new-password"
              style={{ width: '100%', padding: '16px', fontSize: '24px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', letterSpacing: '4px', marginBottom: '24px' }}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '18px' }}>Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  // TELA DE ABERTURA DE CAIXA (Se logado, mas sem caixa aberto)
  if (currentUser && !currentCashRegister) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)' }}>
          <Banknote size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
          <h1 style={{ marginBottom: '8px' }}>Abertura de Caixa</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Informe o Fundo de Troco inicial para começar o turno.</p>
          
          <form onSubmit={handleOpenCash}>
            <input 
              type="number" 
              step="0.01"
              value={initialCash}
              onChange={e => setInitialCash(e.target.value)}
              placeholder="Fundo de Troco (R$)" 
              style={{ width: '100%', padding: '16px', fontSize: '24px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginBottom: '24px' }}
              autoFocus
            />
            <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '16px', fontSize: '18px' }}>Abrir Turno</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredCatalogProducts = products.filter(p => {
    const matchText = !prodSearchText || 
      p.name.toLowerCase().includes(prodSearchText.toLowerCase()) || 
      (p.codigo && p.codigo.toLowerCase().includes(prodSearchText.toLowerCase()));
    
    const matchGroup = !prodSearchGroup || p.categoryId === prodSearchGroup;
    const matchCategory = !prodSearchCategory || p.categoria === prodSearchCategory;
    
    return matchText && matchGroup && matchCategory;
  });

  return (
    <div className="app-container">
      {/* Sidebar Principal */}
      <div className="sidebar">
        <div className="nav-item brand-icon">
          <Utensils size={28} />
        </div>
        <div className="nav-menu">
          <div className={`nav-item ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')} title="Mapa de Mesas">
            <LayoutGrid size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => { setActiveTab('pos'); if(!activeTable && tables.length > 0) setActiveTable(tables[0].id) }} title="Frente de Caixa">
            <ShoppingCart size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')} title="Delivery & Balcão">
            <Truck size={24} />
            {deliveryOrders.length > 0 && (
              <span className="badge" style={{ background: 'var(--primary)' }}>{deliveryOrders.length}</span>
            )}
          </div>
          <div className={`nav-item ${activeTab === 'kitchen' ? 'active' : ''}`} onClick={() => setActiveTab('kitchen')} title="Monitor Cozinha (KDS)">
            <Clock size={24} />
            {kitchenOrders.length > 0 && (
              <span className="badge">{kitchenOrders.length}</span>
            )}
          </div>
          
          {/* Menus Restritos a Gerentes e Admins */}
          {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <>
              <div className={`nav-item ${activeTab === 'cash' ? 'active' : ''}`} onClick={() => { setActiveTab('cash'); fetchData('cash'); }} title="Caixa (Fechamento e Relatórios)">
                <Banknote size={24} />
              </div>
              <div className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); fetchData('reports'); }} title="Relatórios Analíticos">
                <BarChart2 size={24} />
              </div>
            </>
          )}
        </div>
        
        {/* Rodapé da Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Configurações (Retaguarda)">
              <Settings size={24} />
            </div>
          )}
          <div className="nav-item" onClick={() => { setCurrentUser(null); window.location.reload(); }} title="Sair do Sistema">
            <span style={{ fontSize: '10px', color: 'var(--danger)' }}>SAIR</span>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="main-content">
        <header className="header">
          <div className="header-title">
            {activeTab === 'pos' && (
              currentDeliveryData.type === 'DELIVERY' ? 'Frente de Caixa - Novo Delivery 🛵' : 
              currentDeliveryData.type === 'BALCAO' ? 'Frente de Caixa - Venda Balcão 🛍️' : 
              `Frente de Caixa - Mesa ${currentTableData ? currentTableData.number.toString().padStart(2, '0') : '--'}`
            )}
            {activeTab === 'tables' && 'Mapa de Mesas / Salão'}
            {activeTab === 'delivery' && 'Módulo de Delivery & Balcão 🛵'}
            {activeTab === 'kitchen' && 'Monitor de Preparo (Cozinha/Bar)'}
            {activeTab === 'settings' && 'Retaguarda & Cadastros'}
          </div>
          <div className="header-actions">
            {activeTab === 'pos' && (
              <div className="search-bar">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar produto..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
            <div className="nav-item">
              <Bell size={20} />
            </div>
            <div className="user-profile">
              <img src={`https://ui-avatars.com/api/?name=${currentUser.name}&background=ff5c35&color=fff`} alt="User" />
              <div>
                <div className="user-name">{currentUser.name}</div>
                <div className="user-status">{currentUser.role === 'admin' ? 'Gerente' : 'Garçom'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* TELA: DELIVERY & BALCÃO */}
        {activeTab === 'delivery' && (
          <div className="content-area scrollable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Atalhos rápidos para Novo Pedido */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, #ff7b5a 100%)', border: 'none', boxShadow: '0 4px 15px rgba(255, 92, 53, 0.3)' }}
                onClick={() => {
                  setActiveTable(null);
                  setCurrentDeliveryData({
                    type: 'DELIVERY',
                    customerName: '',
                    customerPhone: '',
                    customerAddress: '',
                    deliveryFee: restaurantConfig.defaultDeliveryFee || 7,
                    driverId: ''
                  });
                  setTempOrder([]);
                  setActiveTab('pos');
                }}
              >
                <Truck size={28} />
                <span>🛵 Novo Delivery (Entrega)</span>
              </button>
              
              <button 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderRadius: '12px', borderColor: 'var(--primary)', color: 'var(--primary)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                onClick={() => {
                  setActiveTable(null);
                  setCurrentDeliveryData({
                    type: 'BALCAO',
                    customerName: '',
                    customerPhone: '',
                    customerAddress: '',
                    deliveryFee: 0,
                    driverId: ''
                  });
                  setTempOrder([]);
                  setActiveTab('pos');
                }}
              >
                <ShoppingBag size={28} />
                <span>🛍️ Novo Balcão (Retirada)</span>
              </button>
            </div>

            {/* Grid Principal do Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
              
              {/* COLUNA 1: DELIVERY */}
              <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <Truck size={20} /> Módulo Delivery (Entregas)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
                  
                  {/* DELIVERY - EM PREPARO */}
                  <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', tracking: '1px', color: 'var(--warning)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      Em Preparo ({deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'preparing').length})
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                      {deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'preparing').map(order => {
                        const total = calculateTotal(order.items) + (order.deliveryFee || 0);
                        return (
                          <div key={order.id} style={{ background: 'var(--bg-surface-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                              <span>#{order.customerName || 'Avulso'}</span>
                              <span style={{ color: 'var(--primary)' }}>R$ {total.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              📞 {order.customerPhone || 'Sem fone'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              📍 {order.customerAddress || 'Sem endereço'}
                            </div>
                            
                            {/* Despachar inline */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                              <select
                                value={selectedDriverForOrder[order.id] || ''}
                                onChange={e => setSelectedDriverForOrder(prev => ({ ...prev, [order.id]: e.target.value }))}
                                style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-background)', color: 'white', fontSize: '11px' }}
                              >
                                <option value="">Motoboy...</option>
                                {drivers.filter(d => d.active).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                              <button 
                                className="btn btn-success"
                                style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                onClick={() => handleDispatchOrder(order.id)}
                              >
                                Despachar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'preparing').length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '12px', padding: '20px 0' }}>Sem pedidos nesta etapa</div>
                      )}
                    </div>
                  </div>

                  {/* DELIVERY - EM ROTA */}
                  <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', tracking: '1px', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      Em Rota ({deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'delivering').length})
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                      {deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'delivering').map(order => {
                        const total = calculateTotal(order.items) + (order.deliveryFee || 0);
                        return (
                          <div key={order.id} style={{ background: 'var(--bg-surface-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                              <span>#{order.customerName || 'Avulso'}</span>
                              <span style={{ color: 'var(--primary)' }}>R$ {total.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              🛵 <strong>Motoboy: {order.driver?.name || 'Não atribuído'}</strong>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              📍 {order.customerAddress || 'Sem endereço'}
                            </div>
                            
                            <button 
                              className="btn btn-primary"
                              style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '12px' }}
                              onClick={() => handleCheckoutDeliveryOrder(order.id)}
                            >
                              Finalizar e Receber
                            </button>
                          </div>
                        );
                      })}
                      {deliveryOrders.filter(o => o.type === 'DELIVERY' && o.deliveryStatus === 'delivering').length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '12px', padding: '20px 0' }}>Sem entregas em rota</div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* COLUNA 2: BALCÃO */}
              <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <ShoppingBag size={20} /> Módulo Balcão (Retirada)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
                  
                  {/* BALCÃO - EM PREPARO */}
                  <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', tracking: '1px', color: 'var(--warning)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      Em Preparo ({deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'preparing').length})
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                      {deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'preparing').map(order => {
                        const total = calculateTotal(order.items);
                        return (
                          <div key={order.id} style={{ background: 'var(--bg-surface-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                              <span>#{order.customerName || 'Avulso'}</span>
                              <span style={{ color: 'var(--primary)' }}>R$ {total.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              📞 {order.customerPhone || 'Sem fone'}
                            </div>
                            
                            <button 
                              className="btn btn-success"
                              style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '12px' }}
                              onClick={() => handleUpdateDeliveryStatus(order.id, 'delivering')}
                            >
                              Pronto p/ Retirada
                            </button>
                          </div>
                        );
                      })}
                      {deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'preparing').length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '12px', padding: '20px 0' }}>Sem pedidos nesta etapa</div>
                      )}
                    </div>
                  </div>

                  {/* BALCÃO - PRONTO PARA RETIRADA */}
                  <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', tracking: '1px', color: 'var(--success)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      Pronto ({deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'delivering').length})
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                      {deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'delivering').map(order => {
                        const total = calculateTotal(order.items);
                        return (
                          <div key={order.id} style={{ background: 'var(--bg-surface-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                              <span>#{order.customerName || 'Avulso'}</span>
                              <span style={{ color: 'var(--primary)' }}>R$ {total.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              📞 {order.customerPhone || 'Sem fone'}
                            </div>
                            
                            <button 
                              className="btn btn-primary"
                              style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '12px' }}
                              onClick={() => handleCheckoutDeliveryOrder(order.id)}
                            >
                              Entregar e Receber
                            </button>
                          </div>
                        );
                      })}
                      {deliveryOrders.filter(o => o.type === 'BALCAO' && o.deliveryStatus === 'delivering').length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '12px', padding: '20px 0' }}>Sem pedidos prontos</div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* TELA: MAPA DE MESAS */}
        {activeTab === 'tables' && (
          <div className="content-area scrollable">
            <div className="tables-grid">
              {tables.map(table => {
                const isOccupied = table.status === 'occupied';
                const order = table.orders?.[0];
                const tableTotal = order ? calculateTotal(order.items) : 0;
                
                return (
                  <div 
                    key={table.id} 
                    className={`table-card ${table.status}`} 
                    onClick={() => {
                      setActiveTable(table.id);
                      setActiveTab('pos');
                    }}
                  >
                    <Coffee size={32} className="table-icon" />
                    <div className="table-id">{table.number.toString().padStart(2, '0')}</div>
                    <div className="table-status-label">
                      {isOccupied ? `R$ ${(tableTotal * (1 + (restaurantConfig.defaultServiceFee || 10) / 100)).toFixed(2)}` : 'Livre'}
                    </div>
                    {isOccupied && order && (
                      <div className="table-items-count">
                        {order.items.reduce((acc, i) => acc + i.qty, 0)} itens
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TELA: FRENTE DE CAIXA (PDV) */}
        {activeTab === 'pos' && (activeTable || currentDeliveryData.type === 'DELIVERY' || currentDeliveryData.type === 'BALCAO') && (
          <div className="content-area">
            <div className="products-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                {activeCategory !== 'all' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => setActiveCategory('all')}>
                    <ArrowLeft size={24} /> Voltar para Grupos
                  </div>
                ) : (
                  <h2 style={{ margin: 0 }}>Selecione um Grupo</h2>
                )}
                
                {/* Opcional: manter barra de busca visível */}
              </div>
              
              <div className="products-grid">
                {activeCategory === 'all' ? (
                  categories.filter(c => c.id !== 'all').map(cat => (
                    <div 
                      key={cat.id} 
                      className="product-card" 
                      onClick={() => setActiveCategory(cat.id)}
                      style={{ border: '1px solid var(--primary)', background: 'rgba(255,107,107,0.05)' }}
                    >
                      <div className="product-image" style={{ fontSize: '40px' }}>{cat.icon || '📁'}</div>
                      <div className="product-info" style={{ textAlign: 'center', paddingTop: '12px' }}>
                        <div className="product-name" style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{cat.name}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Ícone Especial para Montar Fracionado */}
                    {(() => {
                      const maxPossibleFlavors = filteredProducts.length > 0 ? Math.max(...filteredProducts.map(p => p.maxFlavors)) : 1;
                      const currentCategory = categories.find(c => c.id === activeCategory);
                      if (maxPossibleFlavors > 1 && currentCategory?.allowFractional) {
                        return (
                          <div 
                            className="product-card" 
                            style={{ border: '2px dashed var(--primary)', background: 'rgba(255,107,107,0.05)' }} 
                            onClick={() => {
                              setFractionConfig({ 
                                baseProduct: { id: 'frac-' + Date.now(), name: `Montar ${currentCategory?.name || 'Fracionado'}`, maxFlavors: maxPossibleFlavors, categoryId: activeCategory }, 
                                selectedFlavors: [],
                                fractionPriceMode: currentCategory?.fractionPriceMode || 'highest'
                              });
                            }}
                          >
                            <div className="product-image" style={{ fontSize: '32px' }}>🍕</div>
                            <div className="product-info">
                              <div className="product-name" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Montar Fracionado</div>
                              <div className="product-price" style={{ color: 'var(--text-secondary)' }}>Até {maxPossibleFlavors} sabores</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {filteredProducts.map((product, idx) => (
                      <div 
                        key={product.id} 
                        className="product-card" 
                        style={{ animationDelay: `${idx * 0.02}s` }}
                        onClick={() => addToOrder(product)}
                      >
                        <div className="product-image">{product.icon || '🍽️'}</div>
                        <div className="product-info">
                          <div className="product-name">{product.name}</div>
                          <div className="product-price">R$ {product.price.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="order-sidebar">
              <div className="order-header">
                <div className="order-title">
                  {currentDeliveryData.type === 'DELIVERY' && "🛵 Delivery"}
                  {currentDeliveryData.type === 'BALCAO' && "🛍️ Balcão"}
                  {currentDeliveryData.type === 'MESA' && "Mesa"}
                </div>
                <div className="table-number" onClick={() => setActiveTab(currentDeliveryData.type !== 'MESA' ? 'delivery' : 'tables')} style={{cursor: 'pointer'}}>
                  {currentDeliveryData.type === 'DELIVERY' && "Ver Painel"}
                  {currentDeliveryData.type === 'BALCAO' && "Ver Painel"}
                  {currentDeliveryData.type === 'MESA' && `Mesa ${currentTableData?.number.toString().padStart(2, '0')}`}
                </div>
              </div>
              
              {/* Formulário de Entrega/Cliente para Delivery/Balcão */}
              {(currentDeliveryData.type === 'DELIVERY' || currentDeliveryData.type === 'BALCAO') && (
                <div style={{ padding: '12px', background: 'var(--bg-surface-light)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {currentDeliveryData.type === 'DELIVERY' ? <Truck size={16} /> : <ShoppingBag size={16} />}
                    <span>Dados do Cliente ({currentDeliveryData.type})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Nome do Cliente" 
                      value={currentDeliveryData.customerName}
                      onChange={e => setCurrentDeliveryData(prev => ({ ...prev, customerName: e.target.value }))}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-background)', color: 'white', fontSize: '13px' }}
                    />
                    <input 
                      type="text" 
                      placeholder="Telefone / WhatsApp" 
                      value={currentDeliveryData.customerPhone}
                      onChange={e => setCurrentDeliveryData(prev => ({ ...prev, customerPhone: e.target.value }))}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-background)', color: 'white', fontSize: '13px' }}
                    />
                    {currentDeliveryData.type === 'DELIVERY' && (
                      <>
                        <textarea 
                          placeholder="Endereço de Entrega Completo" 
                          rows="2"
                          value={currentDeliveryData.customerAddress}
                          onChange={e => setCurrentDeliveryData(prev => ({ ...prev, customerAddress: e.target.value }))}
                          style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-background)', color: 'white', fontSize: '13px', resize: 'none', fontFamily: 'inherit' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Taxa de Entrega (R$)</span>
                          <input 
                            type="number" 
                            step="0.1"
                            value={currentDeliveryData.deliveryFee}
                            onChange={e => setCurrentDeliveryData(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                            style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-background)', color: 'white', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Gestão de Entregadores */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('drivers')}>
                      <h3 style={{ margin: 0 }}>Gestão de Entregadores / Motoboys ({drivers.length})</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={(e) => {
                          e.stopPropagation();
                          setEditingDriver({ name: '', phone: '', active: true });
                          setIsDriverModalOpen(true);
                        }}>
                          + Novo Entregador
                        </button>
                        {expandedCards.drivers ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                    {expandedCards.drivers && (
                      <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '12px' }}>Nome</th>
                              <th style={{ padding: '12px' }}>Telefone</th>
                              <th style={{ padding: '12px' }}>Status</th>
                              <th style={{ padding: '12px' }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drivers.length === 0 ? (
                              <tr>
                                <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum entregador cadastrado.</td>
                              </tr>
                            ) : (
                              drivers.map(d => (
                                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{d.name}</td>
                                  <td style={{ padding: '12px' }}>{d.phone || <em style={{ color: 'var(--text-secondary)' }}>Não informado</em>}</td>
                                  <td style={{ padding: '12px' }}>
                                    <span className="status-badge" style={{ background: d.active ? 'var(--success)' : 'var(--danger)', color: '#fff' }}>
                                      {d.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }} onClick={() => {
                                      setEditingDriver(d);
                                      setIsDriverModalOpen(true);
                                    }}>Editar</button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="order-items">
                {existingItems.length === 0 && tempOrder.length === 0 ? (
                  <div className="empty-order">
                    <ShoppingCart size={48} />
                    <p>{currentDeliveryData.type !== 'MESA' ? 'Carrinho vazio' : 'Mesa sem consumo'}</p>
                  </div>
                ) : (
                  <>
                    {/* Itens do SQLite */}
                    {existingItems.map(item => (
                      <div key={`ex-${item.id}`} className="order-item existing">
                        <div className="item-details">
                          <div className="item-name">
                            {item.product?.name}
                            {item.observations && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>Obs: {item.observations}</div>}
                          </div>
                          <div className="item-price">R$ {(item.price * item.qty).toFixed(2)}</div>
                          <div className="item-qty-actions">
                            <span className="qty-badge">{item.qty}x</span>
                            <span className="status-badge">Enviado</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {existingItems.length > 0 && tempOrder.length > 0 && (
                      <div className="order-divider">Novos Itens</div>
                    )}

                    {/* Novos itens temporários */}
                    {tempOrder.map(item => (
                      <div key={`temp-${item.id}`} className="order-item new">
                        <div className="item-details">
                          <div className="item-name">
                            {item.name}
                            {item.observations && <div style={{ fontSize: '12px', color: 'var(--warning)', fontStyle: 'italic', marginTop: '2px' }}>Obs: {item.observations}</div>}
                          </div>
                          <div className="item-price">R$ {(item.price * item.qty).toFixed(2)}</div>
                          <div className="item-qty-actions">
                            <button className="qty-btn" onClick={() => updateTempQty(item.id, -1)}><Minus size={14} /></button>
                            <span className="qty-value">{item.qty}</span>
                            <button className="qty-btn" onClick={() => updateTempQty(item.id, 1)}><Plus size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="order-footer">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>R$ {combinedTotal.toFixed(2)}</span>
                </div>
                {currentDeliveryData.type === 'DELIVERY' ? (
                  <>
                    <div className="summary-row">
                      <span>Taxa de Entrega</span>
                      <span>R$ {Number(currentDeliveryData.deliveryFee || 0).toFixed(2)}</span>
                    </div>
                    <div className="summary-total">
                      <span>Total</span>
                      <span>R$ {(combinedTotal + Number(currentDeliveryData.deliveryFee || 0)).toFixed(2)}</span>
                    </div>
                  </>
                ) : currentDeliveryData.type === 'BALCAO' ? (
                  <div className="summary-total">
                    <span>Total</span>
                    <span>R$ {combinedTotal.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="summary-row">
                      <span>Taxa de Serviço ({restaurantConfig.defaultServiceFee || 10}%)</span>
                      <span>R$ {(combinedTotal * ((restaurantConfig.defaultServiceFee || 10) / 100)).toFixed(2)}</span>
                    </div>
                    <div className="summary-total">
                      <span>Total</span>
                      <span>R$ {(combinedTotal * (1 + (restaurantConfig.defaultServiceFee || 10) / 100)).toFixed(2)}</span>
                    </div>
                  </>
                )}
                
                <div className="action-buttons">
                  {tempOrder.length > 0 ? (
                    <button className="btn btn-primary" onClick={sendToKitchen}>
                      Enviar para Cozinha
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <button 
                        className={`btn btn-success ${existingItems.length === 0 ? 'disabled' : ''}`} 
                        onClick={() => handleCheckout(false)}
                      >
                        Fechar Conta Completa
                      </button>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn btn-outline ${existingItems.length === 0 ? 'disabled' : ''}`} style={{flex: 1, padding: '8px', fontSize: '12px'}} onClick={() => setIsPartialModalOpen(true)}>
                          Pagar por Item
                        </button>
                        <button className={`btn btn-outline ${existingItems.length === 0 ? 'disabled' : ''}`} style={{flex: 1, padding: '8px', fontSize: '12px'}} onClick={() => setIsTransferModalOpen(true)}>
                          Transferir Itens
                        </button>
                      </div>
                      
                      {existingItems.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderColor: 'var(--primary)', color: 'var(--primary)' }} 
                            onClick={printBill}
                          >
                            📄 Pré-Conta
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} 
                            onClick={printKitchen}
                          >
                            🍳 Reimp. Cozinha
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TELA: KDS (COZINHA) */}
        {activeTab === 'kitchen' && (
          <div className="content-area scrollable">
            <div className="kitchen-grid">
              {kitchenOrders.length === 0 ? (
                <div className="empty-state">
                  <Utensils size={64} />
                  <h2>Nenhum pedido pendente</h2>
                </div>
              ) : (
                kitchenOrders.map(ticket => (
                  <div key={ticket.id} className={`ticket-card ${ticket.status}`}>
                    <div className="ticket-header">
                      <h3>Mesa {ticket.order?.table?.number?.toString().padStart(2, '0') || '??'}</h3>
                      <span className="ticket-time">
                        {new Date(ticket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="ticket-items">
                      {ticket.order?.items.map(item => (
                        <div key={item.id} className="ticket-item">
                          <span className="ticket-qty">{item.qty}x</span>
                          <span className="ticket-name">{item.product?.name}</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-success ticket-btn" onClick={() => markTicketReady(ticket.id)}>
                      <Check size={18} /> Marcar como Pronto
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TELA: RELATÓRIOS ANALÍTICOS */}
        {activeTab === 'reports' && (
          <div className="content-area scrollable" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ margin: 0 }}>Relatórios Analíticos de Vendas</h1>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => fetchData('reports')}>Atualizar Relatório</button>
            </div>

            {/* FILTROS DO RELATÓRIO */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg-surface-light)', padding: '16px', borderRadius: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>De:</label>
                <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Até:</label>
                <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Grupo:</label>
                <select value={reportFilters.categoryId} onChange={e => setReportFilters({...reportFilters, categoryId: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'white' }}>
                  <option value="">Todos os Grupos</option>
                  {categories.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={() => fetchData('reports')}>Filtrar Relatório</button>
            </div>
            
            {salesReportData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="settings-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Faturamento Bruto</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.totalRevenue.toFixed(2)}</div>
                  </div>
                  <div className="settings-card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Lucro Bruto (Faturamento - CMV - Taxas)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.netProfit.toFixed(2)}</div>
                  </div>
                  <div className="settings-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Custo de Produtos (CMV)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.totalCmv.toFixed(2)}</div>
                  </div>
                  <div className="settings-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Taxas de Recebimento</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.totalFees.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="settings-card">
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ticket Médio (Mesa)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.averageTicket.toFixed(2)}</div>
                  </div>
                  <div className="settings-card">
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ticket Médio (PAX)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {salesReportData.summary.averageTicketPerPerson.toFixed(2)}</div>
                  </div>
                  <div className="settings-card">
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total de Clientes (PAX)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{salesReportData.summary.totalPeople}</div>
                  </div>
                  <div className="settings-card">
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Produtos Vendidos</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{salesReportData.summary.totalItemsSold} un</div>
                  </div>
                </div>

                <div className="settings-card">
                  <h3>Curva ABC - Produtos mais vendidos</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '16px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px' }}>Produto</th>
                        <th style={{ padding: '12px' }}>Quantidade Vendida</th>
                        <th style={{ padding: '12px' }}>Faturamento (Receita)</th>
                        <th style={{ padding: '12px' }}>Custo (CMV)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesReportData.abcCurve.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.name}</td>
                          <td style={{ padding: '12px' }}>{item.qty} un</td>
                          <td style={{ padding: '12px', color: 'var(--success)' }}>R$ {item.revenue.toFixed(2)}</td>
                          <td style={{ padding: '12px', color: 'var(--danger)' }}>R$ {item.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                      {salesReportData.abcCurve.length === 0 && <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Nenhuma venda registrada ainda.</td></tr>}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando dados...</div>
            )}
          </div>
        )}

        {/* TELA: RETAGUARDA (CADASTRO) */}
        {activeTab === 'settings' && (
          <div className="content-area scrollable">
             <div className="settings-panel">
               <h2>Gestão do Sistema (Retaguarda)</h2>
               <p>Cadastros de Produtos, Categorias e Configurações de Impressão.</p>
               
               <div className="settings-grid">

                  {/* Configurações do Estabelecimento & Salão */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('restaurant')}>
                      <h3 style={{ margin: 0 }}>Configurações do Estabelecimento & Salão</h3>
                      {expandedCards.restaurant ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {expandedCards.restaurant && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          Configure as informações básicas do restaurante, taxas padrão e gerencie dinamicamente o número de mesas do salão.
                        </p>
                        <form 
                          key={restaurantConfig.name + '-' + restaurantConfig.maxTables + '-' + restaurantConfig.defaultServiceFee}
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            const data = {
                              name: fd.get('name'),
                              address: fd.get('address'),
                              phone: fd.get('phone'),
                              footerMessage: fd.get('footerMessage'),
                              defaultServiceFee: Number(fd.get('defaultServiceFee')),
                              defaultCouvert: Number(fd.get('defaultCouvert')),
                              maxTables: Number(fd.get('maxTables'))
                            };
                            
                            try {
                              const res = await fetch(`${API_URL}/settings/restaurant`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                              });
                              const resData = await res.json();
                              if (res.ok) {
                                alert("Configurações salvas com sucesso!");
                                fetchData();
                              } else {
                                alert(resData.error || "Erro ao salvar configurações.");
                              }
                            } catch (err) {
                              alert("Erro de conexão ao salvar configurações: " + err.message);
                            }
                          }} 
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}
                        >
                          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            <div>
                              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nome do Estabelecimento</label>
                              <input name="name" defaultValue={restaurantConfig.name} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} required />
                            </div>
                            <div>
                              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Telefone</label>
                              <input name="phone" defaultValue={restaurantConfig.phone} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                            </div>
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Endereço Completo</label>
                            <input name="address" defaultValue={restaurantConfig.address} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Mensagem de Rodapé nos Recibos</label>
                            <input name="footerMessage" defaultValue={restaurantConfig.footerMessage} placeholder="Ex: Volte Sempre! Muito obrigado!" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                          </div>

                          <div>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Quantidade de Mesas</label>
                            <input type="number" min="1" name="maxTables" defaultValue={restaurantConfig.maxTables} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} required />
                          </div>

                          <div>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Taxa de Serviço Padrão (%)</label>
                            <input type="number" min="0" max="100" step="any" name="defaultServiceFee" defaultValue={restaurantConfig.defaultServiceFee} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} required />
                          </div>

                          <div>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Couvert Artístico Padrão (R$)</label>
                            <input type="number" min="0" step="any" name="defaultCouvert" defaultValue={restaurantConfig.defaultCouvert} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} required />
                          </div>

                          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }}>
                              Salvar Configurações
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                 
                  {/* Configuração da Impressora Térmica (ESC/POS) */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('printer')}>
                      <h3 style={{ margin: 0 }}>Configurações de Impressão e Setorização 🖨️</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }} onClick={() => {
                          const name = window.prompt("Digite o nome do novo setor de impressão (ex: CHAPA, MASSAS, FORNO):");
                          if (name) {
                            const key = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
                            if (printerConfig.sectors && printerConfig.sectors[key]) {
                              alert("Este setor já existe!");
                              return;
                            }
                            setPrinterConfig(prev => ({
                              ...prev,
                              sectors: {
                                ...prev.sectors,
                                [key]: { type: 'SIMULATOR', interface: '' }
                              }
                            }));
                          }
                        }}>
                          + Novo Setor
                        </button>
                        {expandedCards.printer ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                    {expandedCards.printer && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                          Configure a auto-impressão direta (sem caixa de diálogo do navegador) e o mapeamento de impressoras físicas ou virtuais por setores.
                        </p>
                        
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const res = await fetch(`${API_URL}/settings/printer`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(printerConfig)
                          });
                          if (res.ok) {
                            alert("Configurações de impressora salvas com sucesso!");
                            fetchData();
                          } else {
                            alert("Erro ao salvar configurações de impressora.");
                          }
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          
                          {/* Opções Gerais (Switches) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '16px', background: 'var(--bg-surface-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'white' }}>
                              <input type="checkbox" name="autoPrint" checked={printerConfig.autoPrint} onChange={e => setPrinterConfig(prev => ({ ...prev, autoPrint: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                              Habilitar Impressão Automática
                            </label>
                            
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'white' }}>
                              <input type="checkbox" name="printPreBillAlwaysAsk" checked={printerConfig.printPreBillAlwaysAsk} onChange={e => setPrinterConfig(prev => ({ ...prev, printPreBillAlwaysAsk: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                              Sempre Confirmar Pré-Conta
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'white' }}>
                              <input type="checkbox" name="printCheckoutAlwaysAsk" checked={printerConfig.printCheckoutAlwaysAsk} onChange={e => setPrinterConfig(prev => ({ ...prev, printCheckoutAlwaysAsk: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                              Confirmar Impressão no Caixa
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'white' }}>
                              <input type="checkbox" name="printRegisterCloseEnabled" checked={printerConfig.printRegisterCloseEnabled} onChange={e => setPrinterConfig(prev => ({ ...prev, printRegisterCloseEnabled: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                              Habilitar Impressão do Fechamento
                            </label>
                          </div>

                          {/* Setores de Impressão Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            {Object.keys(printerConfig.sectors || {}).map(key => {
                              const sector = printerConfig.sectors[key] || { type: 'SIMULATOR', interface: '' };
                              const isCaixa = key === 'CAIXA';
                              const isCozinha = key === 'COZINHA';
                              const isBar = key === 'BAR';
                              
                              const titleColor = isCaixa ? 'var(--primary)' : isCozinha ? 'var(--warning)' : isBar ? 'var(--secondary)' : '#a855f7';
                              const icon = isCaixa ? '💵' : isCozinha ? '🍳' : isBar ? '🍺' : '🏷️';
                              const displayName = isCaixa ? 'Caixa e Balcão' : isCozinha ? 'Cozinha' : isBar ? 'Bar e Coparia' : key;

                              return (
                                <div key={key} style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  
                                  {/* Título e Botão Excluir */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: titleColor }}>
                                      {icon} {displayName}
                                    </h4>
                                    {!isCaixa && (
                                      <span 
                                        style={{ color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }} 
                                        onClick={() => {
                                          const confirmDelete = window.confirm(`Deseja realmente excluir o setor de impressão ${key}?`);
                                          if (confirmDelete) {
                                            setPrinterConfig(prev => {
                                              const newSectors = { ...prev.sectors };
                                              delete newSectors[key];
                                              return { ...prev, sectors: newSectors };
                                            });
                                          }
                                        }}
                                      >
                                        Excluir
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tipo de Impressora</label>
                                    <select 
                                      value={sector.type || 'SIMULATOR'} 
                                      onChange={e => {
                                        const val = e.target.value;
                                        setPrinterConfig(prev => ({
                                          ...prev,
                                          sectors: {
                                            ...prev.sectors,
                                            [key]: { ...prev.sectors[key], type: val }
                                          }
                                        }));
                                      }} 
                                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}
                                    >
                                      <option value="SIMULATOR">Simulador (Cupom na Tela)</option>
                                      <option value="EPSON">Epson (Rede ESC/POS)</option>
                                      <option value="STAR">Star (Rede ESC/POS)</option>
                                    </select>
                                  </div>
                                  
                                  {sector.type !== 'SIMULATOR' && (
                                    <div>
                                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Interface / IP (ex: tcp://192.168.1.100:9100)</label>
                                      <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
                                        <input 
                                          value={sector.interface || ''} 
                                          onChange={e => {
                                            const val = e.target.value;
                                            setPrinterConfig(prev => ({
                                              ...prev,
                                              sectors: {
                                                ...prev.sectors,
                                                [key]: { ...prev.sectors[key], interface: val }
                                              }
                                            }));
                                          }} 
                                          placeholder="tcp://192.168.1.100:9100" 
                                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white' }} 
                                        />
                                        <button 
                                          type="button" 
                                          className="btn btn-outline" 
                                          onClick={() => handleDiscoverPrinters(key)}
                                          disabled={isScanningPrinters && activeScanningSector === key}
                                          style={{ width: 'auto', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--primary)', color: 'var(--primary)', cursor: 'pointer' }}
                                        >
                                          {isScanningPrinters && activeScanningSector === key ? '...' : '🔍 Buscar'}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              );
                            })}
                          </div>

                          {activeScanningSector && (
                            <div style={{ width: '100%', marginTop: '16px', background: 'var(--bg-surface-light)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                              <style>{`
                                @keyframes spin {
                                  0% { transform: rotate(0deg); }
                                  100% { transform: rotate(360deg); }
                                }
                              `}</style>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '15px' }}>
                                  Busca Automática de Impressoras para o setor: <strong style={{ textTransform: 'uppercase', color: 'white' }}>{activeScanningSector}</strong>
                                </h4>
                                <button type="button" className="btn-close" style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={() => setActiveScanningSector(null)}>×</button>
                              </div>

                              {isScanningPrinters ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                  <div className="spinner" style={{ border: '4px solid rgba(255, 92, 53, 0.1)', borderLeft: '4px solid var(--primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Varrendo a rede local e listando impressoras locais...</div>
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                                  
                                  {/* Coluna 1: Impressoras Locais */}
                                  <div>
                                    <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', color: 'var(--text-secondary)' }}>
                                      💻 No Computador (USB / Spooler)
                                    </h5>
                                    {discoveredPrinters.localPrinters.length === 0 ? (
                                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', padding: '8px' }}>Nenhuma impressora local encontrada.</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {discoveredPrinters.localPrinters.map(p => (
                                          <button
                                            key={p.interface}
                                            type="button"
                                            onClick={() => {
                                              setPrinterConfig(prev => ({
                                                ...prev,
                                                sectors: {
                                                  ...prev.sectors,
                                                  [activeScanningSector]: { ...prev.sectors[activeScanningSector], interface: p.interface }
                                                }
                                              }));
                                              setActiveScanningSector(null);
                                            }}
                                            style={{
                                              textAlign: 'left',
                                              padding: '8px 10px',
                                              background: 'var(--bg-dark)',
                                              border: '1px solid var(--border-color)',
                                              borderRadius: '6px',
                                              color: 'white',
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              width: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                          >
                                            🔌 <span>{p.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Coluna 2: Impressoras de Rede */}
                                  <div>
                                    <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', color: 'var(--text-secondary)' }}>
                                      📡 Na Rede Sem Fio / Cabo (Porta 9100)
                                    </h5>
                                    {discoveredPrinters.networkPrinters.length === 0 ? (
                                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', padding: '8px' }}>Nenhuma impressora de rede encontrada (porta 9100).</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {discoveredPrinters.networkPrinters.map(p => (
                                          <button
                                            key={p.interface}
                                            type="button"
                                            onClick={() => {
                                              setPrinterConfig(prev => ({
                                                ...prev,
                                                sectors: {
                                                  ...prev.sectors,
                                                  [activeScanningSector]: { ...prev.sectors[activeScanningSector], interface: p.interface }
                                                }
                                              }));
                                              setActiveScanningSector(null);
                                            }}
                                            style={{
                                              textAlign: 'left',
                                              padding: '8px 10px',
                                              background: 'var(--bg-dark)',
                                              border: '1px solid var(--border-color)',
                                              borderRadius: '6px',
                                              color: 'white',
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              width: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                          >
                                            🌐 <strong style={{ color: 'var(--primary)' }}>{p.ip}</strong> <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>(Porta 9100)</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              )}
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }}>
                              Salvar Configurações
                            </button>
                          </div>

                        </form>
                      </div>
                    )}
                  </div>
                 
                 {/* Categorias */}
                 <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('categories')}>
                     <h3 style={{ margin: 0 }}>Grupos / Categorias Ativas</h3>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory({ name: '', icon: '' });
                          setIsCategoryModalOpen(true);
                       }}>
                         + Novo Grupo
                       </button>
                       {expandedCards.categories ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                   </div>
                   {expandedCards.categories && (
                     <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                       {categories.filter(c => c.id !== 'all').map(cat => (
                         <div key={cat.id} style={{ padding: '8px 16px', background: 'var(--bg-surface-light)', borderRadius: '20px', fontSize: '14px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                           <span>{cat.icon}</span> {cat.name} 
                           <span style={{color:'var(--text-secondary)', cursor:'pointer', marginLeft: '8px'}} onClick={() => {
                             setEditingCategory(cat);
                             setIsCategoryModalOpen(true);
                           }}>✏️</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Usuários */}
                 <div className="settings-card" style={{ gridColumn: '1 / 2' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('users')}>
                     <h3 style={{ margin: 0 }}>Usuários e Senhas</h3>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={async (e) => {
                         e.stopPropagation();
                         const name = prompt("Nome do Usuário:");
                         if (!name) return;
                         const passcode = prompt("Senha numérica (ex: 1234):");
                         if (!passcode) return;
                         await fetch(`${API_URL}/users`, {
                           method: 'POST',
                           headers: {'Content-Type':'application/json'},
                           body: JSON.stringify({ name, passcode, role: 'waiter' })
                         });
                         alert('Usuário criado. Atualize a página!');
                       }}>
                         + Novo Usuário
                       </button>
                       {expandedCards.users ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                   </div>
                   {expandedCards.users && (
                     <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', flexDirection: 'column' }}>
                       <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                         <div style={{ padding: '8px 16px', background: 'var(--bg-surface-light)', borderRadius: '20px', fontSize: '14px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                           Admin (Padrão) - Senha: 1234
                         </div>
                       </div>
                       <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Recarregue a página para ver a lista atualizada de usuários do banco.</div>
                     </div>
                   )}
                 </div>

                 {/* Formas de Pagamento */}
                 <div className="settings-card" style={{ gridColumn: '2 / -1' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('paymentMethods')}>
                     <h3 style={{ margin: 0 }}>Métodos de Recebimento</h3>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={async (e) => {
                         e.stopPropagation();
                         const name = prompt("Nome da Forma (Ex: Vale Refeição):");
                         if (!name) return;
                         const feePercentage = prompt("Taxa do Cartão/Método em % (Ex: 2.5):", "0");
                         if (feePercentage === null) return;
                         await fetch(`${API_URL}/payment_methods`, {
                           method: 'POST',
                           headers: {'Content-Type':'application/json'},
                           body: JSON.stringify({ name, feePercentage })
                         });
                         fetchData();
                       }}>
                         + Nova Forma
                       </button>
                       {expandedCards.paymentMethods ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                   </div>
                   {expandedCards.paymentMethods && (
                     <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                       {paymentMethods.map(pm => (
                         <div key={pm.id} style={{ padding: '8px 16px', background: 'var(--bg-surface-light)', borderRadius: '20px', fontSize: '14px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                           {pm.name} <span style={{ color: 'var(--danger)' }}>({pm.feePercentage}%)</span>
                            <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: '8px' }} onClick={async () => {
                              const newName = prompt("Editar Nome:", pm.name);
                              if (!newName) return;
                              const newFee = prompt("Editar Taxa (%):", pm.feePercentage);
                              if (newFee === null) return;
                              await fetch(`${API_URL}/payment_methods`, {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ id: pm.id, name: newName, feePercentage: newFee })
                              });
                              fetchData('settings');
                            }}>✏️</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Produtos */}
                 <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCard('products')}>
                     <h3 style={{ margin: 0 }}>Catálogo de Produtos ({products.length})</h3>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={(e) => {
                         e.stopPropagation();
                         setEditingProduct(null);
                         setProductTab('basic');
                         setIsProductModalOpen(true);
                       }}>
                         + Novo Produto
                       </button>
                       {expandedCards.products ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                   </div>
                   {expandedCards.products && (
                     <div style={{ marginTop: '16px' }}>
                       
                       {/* Filtros de busca */}
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px', padding: '16px', background: 'var(--bg-surface-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                         <div>
                           <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nome / Código</label>
                           <input 
                             type="text" 
                             value={prodSearchText} 
                             onChange={e => setProdSearchText(e.target.value)} 
                             placeholder="Buscar por nome ou código..." 
                             style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', marginTop: '4px', fontSize: '14px' }} 
                           />
                         </div>
                         <div>
                           <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Grupo (PDV)</label>
                           <select 
                             value={prodSearchGroup} 
                             onChange={e => setProdSearchGroup(e.target.value)} 
                             style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', marginTop: '4px', fontSize: '14px' }}
                           >
                             <option value="">Todos os Grupos</option>
                             {categories.filter(c => c.id !== 'all').map(c => (
                               <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                           </select>
                         </div>
                         <div>
                           <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Categoria (Filtro/Fiscal)</label>
                           <select 
                             value={prodSearchCategory} 
                             onChange={e => setProdSearchCategory(e.target.value)} 
                             style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', marginTop: '4px', fontSize: '14px' }}
                           >
                             <option value="">Todas as Categorias</option>
                             {Array.from(new Set(products.map(p => p.categoria).filter(Boolean))).map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                             ))}
                           </select>
                         </div>
                       </div>

                       <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                         <thead>
                           <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                             <th style={{ padding: '12px' }}>Cód</th>
                             <th style={{ padding: '12px' }}>Ícone</th>
                             <th style={{ padding: '12px' }}>Nome do Produto</th>
                             <th style={{ padding: '12px' }}>Grupo</th>
                             <th style={{ padding: '12px' }}>Categoria</th>
                             <th style={{ padding: '12px' }}>Preço</th>
                             <th style={{ padding: '12px' }}>Frações</th>
                             <th style={{ padding: '12px' }}>Ações</th>
                           </tr>
                         </thead>
                         <tbody>
                           {filteredCatalogProducts.length === 0 ? (
                             <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum produto cadastrado</td></tr>
                           ) : (
                             filteredCatalogProducts.map(p => (
                               <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                 <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{p.codigo || 'S/C'}</td>
                                 <td style={{ padding: '12px', fontSize: '20px' }}>{p.icon}</td>
                                 <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td>
                                 <td style={{ padding: '12px' }}>{p.category?.name}</td>
                                 <td style={{ padding: '12px' }}>{p.categoria || <em style={{ color: 'var(--text-secondary)' }}>Nenhuma</em>}</td>
                                 <td style={{ padding: '12px', color: 'var(--success)', fontWeight: 'bold' }}>R$ {p.price.toFixed(2)}</td>
                                 <td style={{ padding: '12px' }}>
                                   {p.maxFlavors > 1 ? <span className="status-badge" style={{background: 'var(--warning)', color: '#fff'}}>Até {p.maxFlavors} Sabores</span> : 'Simples'}
                                 </td>
                                 <td style={{ padding: '12px' }}>
                                   <div style={{ display: 'flex', gap: '8px' }}>
                                     <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }} onClick={() => {
                                       setEditingProduct(p);
                                       setProductTab('basic');
                                       setIsProductModalOpen(true);
                                     }}>Editar</button>
                                     <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDuplicateProduct(p)}>
                                       <Copy size={12} /> Duplicar
                                     </button>
                                   </div>
                                 </td>
                               </tr>
                             ))
                           )}
                         </tbody>
                       </table>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* TELA: CAIXA E TURNOS */}
        {activeTab === 'cash' && (
          <div className="content-area scrollable" style={{ padding: '24px' }}>
            <h1 style={{ marginBottom: '24px' }}>Gestão de Caixa e Turnos</h1>
            
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {/* Esquerda: Fechamento Atual */}
              <div style={{ flex: 1, background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Turno Atual (Aberto)</h2>
                
                {currentCashRegister && cashReport ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Fundo de Troco Inicial</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {currentCashRegister.initialBalance.toFixed(2)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Faturamento Bruto</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>R$ {cashReport.total.toFixed(2)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Suprimentos (+)</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--success)' }}>R$ {(cashReport.totalSuprimento || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Sangrias (-)</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--danger)' }}>R$ {(cashReport.totalSangria || 0).toFixed(2)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ flex: 1, borderColor: 'var(--success)', color: 'var(--success)', padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => handleOpenTransactionModal('suprimento')}
                      >
                        📥 Suprimento
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)', padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => handleOpenTransactionModal('sangria')}
                      >
                        📤 Sangria
                      </button>
                    </div>

                    {cashReport.transactions && cashReport.transactions.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Movimentações Recentes</h3>
                        <div style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '12px', maxHeight: '130px', overflowY: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {cashReport.transactions.map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ color: t.type === 'sangria' ? 'var(--danger)' : 'var(--success)' }}>
                                  {t.type === 'sangria' ? 'Sangria' : 'Suprimento'}
                                </strong>
                                {t.description && `(${t.description})`}
                                <span 
                                  style={{ cursor: 'pointer', fontSize: '14px' }} 
                                  title="Re-imprimir comprovante" 
                                  onClick={() => printTransactionVoucher(t.id)}
                                >
                                  🖨️
                                </span>
                              </span>
                              <strong style={{ color: t.type === 'sangria' ? 'var(--danger)' : 'var(--success)' }}>
                                {t.type === 'sangria' ? '-' : '+'} R$ {t.amount.toFixed(2)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-secondary)' }}>Resumo por Método</h3>
                    <div style={{ background: 'var(--bg-surface-light)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Dinheiro (Gaveta Esperado)</span>
                        <strong>R$ {((cashReport.cash || 0) + currentCashRegister.initialBalance + (cashReport.totalSuprimento || 0) - (cashReport.totalSangria || 0)).toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                        Fundo: R$ {currentCashRegister.initialBalance.toFixed(2)} | Vendas: R$ {(cashReport.cash || 0).toFixed(2)} | Suprimentos: +R$ {(cashReport.totalSuprimento || 0).toFixed(2)} | Sangrias: -R$ {(cashReport.totalSangria || 0).toFixed(2)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Cartão de Crédito</span><strong>R$ {(cashReport.credit || 0).toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Cartão de Débito</span><strong>R$ {(cashReport.debit || 0).toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>PIX</span><strong>R$ {(cashReport.pix || 0).toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Vale-Refeição</span><strong>R$ {(cashReport.mealVoucher || 0).toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}><span>Conta Assinada (A Prazo)</span><strong>R$ {(cashReport.signed || 0).toFixed(2)}</strong></div>
                    </div>


                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                      <h3 style={{ marginBottom: '16px' }}>Fechamento e Conciliação de Caixa (Valores Declarados)</h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Informe os valores contados e os relatórios das maquininhas no fechamento do turno:
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                        {Object.keys(declaredBalances).map(method => (
                          <div key={method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{method}:</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              placeholder="R$ 0,00" 
                              value={declaredBalances[method]}
                              onChange={e => setDeclaredBalances(prev => ({ ...prev, [method]: e.target.value }))}
                              style={{ width: '180px', padding: '10px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', textAlign: 'right' }}
                            />
                          </div>
                        ))}
                      </div>

                      <button className="btn btn-primary" style={{ width: '100%', padding: '16px' }} onClick={handleCloseCash}>
                        Efetuar Fechamento e Conciliação
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhum turno aberto no momento.</div>
                )}
              </div>

              {/* Direita: Histórico */}
              <div style={{ flex: 1, background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ marginBottom: '24px' }}>Histórico de Fechamentos</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '750px', overflowY: 'auto', paddingRight: '4px' }}>
                  {cashHistory.map(hist => {
                    let audit = null;
                    try {
                      if (hist.reconciliationData) {
                        audit = JSON.parse(hist.reconciliationData);
                      }
                    } catch (e) {
                      console.error("Erro ao ler dados de reconciliação", e);
                    }

                    const systemBal = hist.systemBalance || 0;
                    const closingBal = hist.closingBalance || 0;
                    const diff = closingBal - systemBal;
                    const statusLabel = audit ? audit.statusGeral : (diff < 0 ? "Quebra de Caixa" : diff > 0 ? "Sobra de Caixa" : "Caixa Batido");
                    const borderCol = statusLabel === "Quebra de Caixa (Falta)" || statusLabel === "Quebra de Caixa" ? 'var(--danger)' : statusLabel === "Sobra de Caixa" ? 'var(--warning)' : 'var(--success)';
                    
                    return (
                      <div key={hist.id} style={{ background: 'var(--bg-surface-light)', padding: '16px', borderRadius: '8px', borderLeft: `4px solid ${borderCol}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '14px' }}>{new Date(hist.closedAt).toLocaleString()}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Operador: {hist.userId.substring(0,6)}</span>
                            <span 
                              style={{ cursor: 'pointer', fontSize: '14px' }} 
                              title="Re-imprimir Auditoria de Fechamento"
                              onClick={() => printCashRegisterClosure(hist.id)}
                            >
                              🖨️
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <span className="status-badge" style={{ background: borderCol, color: 'white', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}>{statusLabel}</span>
                        </div>

                        {audit ? (
                          <>
                            {/* Detalhes de Reconciliação */}
                            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', background: 'var(--bg-dark)', padding: '10px', borderRadius: '6px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                <span>Método</span>
                                <span style={{ textAlign: 'right' }}>Sist.</span>
                                <span style={{ textAlign: 'right' }}>Decl.</span>
                                <span style={{ textAlign: 'right' }}>Dif.</span>
                              </div>
                              {audit.details.map(d => (
                                <div key={d.method} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                                  <span>{d.method}</span>
                                  <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{(d.system || 0).toFixed(2)}</span>
                                  <span style={{ textAlign: 'right' }}>{(d.declared || 0).toFixed(2)}</span>
                                  <span style={{ textAlign: 'right', color: (d.difference || 0) < 0 ? 'var(--danger)' : (d.difference || 0) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                    {(d.difference || 0) > 0 ? `+${(d.difference || 0).toFixed(2)}` : (d.difference || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              {(audit.totalSuprimento > 0 || audit.totalSangria > 0) && (
                                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {audit.totalSuprimento > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Suprimentos (+)</span>
                                      <span style={{ color: 'var(--success)' }}>+ R$ {(audit.totalSuprimento || 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {audit.totalSangria > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Sangrias (-)</span>
                                      <span style={{ color: 'var(--danger)' }}>- R$ {(audit.totalSangria || 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {audit.totalPrazo > 0 && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', fontWeight: 'bold' }}>
                                  <span>Total Vendas a Prazo (A Receber):</span>
                                  <span>R$ {(audit.totalPrazo || 0).toFixed(2)}</span>
                                </div>
                              )}

                            </div>

                            {/* Alertas de Risco */}
                            {audit.alerts && audit.alerts.length > 0 && (
                              <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid var(--danger)' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)', marginBottom: '4px' }}>Alertas de Auditoria:</div>
                                {audit.alerts.map((alerta, idx) => (
                                  <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {alerta}</div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                            <div>Sistema (Dinheiro): <strong>R$ {(hist.systemBalance || 0).toFixed(2)}</strong></div>
                            <div>Gaveta Contada: <strong>R$ {(hist.closingBalance || 0).toFixed(2)}</strong></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cashHistory.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Nenhum fechamento histórico encontrado.</div>}
                </div>
              </div>
            </div>
          </div>
      )}
      </div>

      {/* MODAL DE PAGAMENTO AVANÇADO (DIVISÃO E TAXAS) */}
      {isPaymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', display: 'flex', gap: '24px' }}>
            
            {/* Coluna Esquerda: Extrato e Taxas */}
            <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
              <h2>
                {currentOrder?.type === 'DELIVERY' && `Fechamento - Delivery (${currentOrder?.customerName || 'Avulso'})`}
                {currentOrder?.type === 'BALCAO' && `Fechamento - Balcão (${currentOrder?.customerName || 'Avulso'})`}
                {(!currentOrder?.type || currentOrder?.type === 'MESA') && `Fechamento - Mesa ${currentTableData?.number.toString().padStart(2, '0')}`}
              </h2>
              {selectedItemsForOp.length > 0 && <span className="status-badge" style={{background: 'var(--primary)', color: 'white', marginBottom: '16px'}}>Sub-Conta Parcial Ativa</span>}
              
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal (Itens)</span>
                  <span>R$ {(selectedItemsForOp.length > 0 ? calculateTotal(selectedItemsForOp.map(i => ({ price: i.price, qty: i.qtyToOp }))) : existingTotal).toFixed(2)}</span>
                </div>
                
                {(!currentOrder?.type || currentOrder?.type === 'MESA') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={paymentData.useServiceFee} 
                        onChange={e => setPaymentData(prev => ({ ...prev, useServiceFee: e.target.checked }))} 
                        style={{ width: '18px', height: '18px' }}
                      />
                      Taxa de Serviço ({restaurantConfig.defaultServiceFee || 10}%)
                    </label>
                    <span>R$ {((selectedItemsForOp.length > 0 ? calculateTotal(selectedItemsForOp.map(i => ({ price: i.price, qty: i.qtyToOp }))) : existingTotal) * ((restaurantConfig.defaultServiceFee || 10) / 100)).toFixed(2)}</span>
                  </div>
                )}

                {currentOrder?.type === 'DELIVERY' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Taxa de Entrega (R$)</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={paymentData.deliveryFee} 
                      onChange={e => setPaymentData(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                      style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-surface-light)', color: 'white', textAlign: 'right' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Nº de Pessoas (PAX)</span>
                  <input 
                    type="number" 
                    min="1"
                    value={paymentData.peopleCount} 
                    onChange={e => setPaymentData(prev => ({ ...prev, peopleCount: Number(e.target.value) }))}
                    style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', textAlign: 'center' }}
                  />
                </div>

                {(!currentOrder?.type || currentOrder?.type === 'MESA') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Couvert Artístico (R$)</span>
                    <input 
                      type="number" 
                      value={paymentData.couvert} 
                      onChange={e => setPaymentData(prev => ({ ...prev, couvert: Number(e.target.value) }))}
                      style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', textAlign: 'right' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning)' }}>
                  <span>Desconto (R$)</span>
                  <input 
                    type="number" 
                    value={paymentData.discount} 
                    onChange={e => setPaymentData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                    style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--warning)', background: 'var(--bg-surface-light)', color: 'white', textAlign: 'right' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '24px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}>
                <span>TOTAL A PAGAR</span>
                <span>R$ {calculateFinalTotal().toFixed(2)}</span>
              </div>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderColor: 'var(--primary)', color: 'var(--primary)' }} 
                onClick={printBill}
              >
                🖨️ Imprimir Pré-Conta
              </button>
            </div>

            {/* Coluna Direita: Pagamentos e Troco */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-close" onClick={() => setIsPaymentModalOpen(false)}>×</button>
              </div>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Falta Receber</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: getRemainingBalance() > 0 ? 'white' : 'var(--success)', marginBottom: '24px' }}>
                  R$ {getRemainingBalance().toFixed(2)}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input 
                    type="number" 
                    id="partialPaymentAmount"
                    defaultValue={getRemainingBalance().toFixed(2)}
                    step="0.01"
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', fontSize: '18px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                  {paymentMethods.map(pm => (
                    <button key={pm.id} className="btn btn-outline" onClick={() => addPartialPayment(pm.name, document.getElementById('partialPaymentAmount').value)}>
                      {pm.name}
                    </button>
                  ))}
                  {paymentMethods.length === 0 && <span style={{ color: 'var(--warning)', gridColumn: '1 / -1' }}>Nenhum método cadastrado! Vá na Retaguarda.</span>}
                </div>

                {paymentData.payments.length > 0 && (
                  <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pagamentos Lançados:</div>
                    {paymentData.payments.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                        <span style={{ textTransform: 'uppercase' }}>{p.method}</span>
                        <span style={{ color: 'var(--success)' }}>R$ {p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px' }}>
                <button 
                  className={`btn btn-primary`} 
                  style={{ width: '100%', padding: '16px', fontSize: '18px', opacity: getRemainingBalance() > 0.05 ? 0.5 : 1 }}
                  onClick={finishPayment}
                >
                  <Check size={20} /> FINALIZAR CONTA
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE PRODUTO (CADASTRO/EDIÇÃO) */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button className="btn-close" onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }}>×</button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <button className={`btn btn-outline ${productTab === 'basic' ? 'active-tab' : ''}`} style={{ width: 'auto', padding: '8px 16px', border: productTab === 'basic' ? '1px solid var(--primary)' : '1px solid transparent', color: productTab === 'basic' ? 'var(--primary)' : 'white' }} onClick={() => setProductTab('basic')}>Dados Básicos</button>
              <button className={`btn btn-outline ${productTab === 'fraction' ? 'active-tab' : ''}`} style={{ width: 'auto', padding: '8px 16px', border: productTab === 'fraction' ? '1px solid var(--primary)' : '1px solid transparent', color: productTab === 'fraction' ? 'var(--primary)' : 'white' }} onClick={() => setProductTab('fraction')}>Regras e Obs</button>
              <button className={`btn btn-outline ${productTab === 'fiscal' ? 'active-tab' : ''}`} style={{ width: 'auto', padding: '8px 16px', border: productTab === 'fiscal' ? '1px solid var(--primary)' : '1px solid transparent', color: productTab === 'fiscal' ? 'var(--primary)' : 'white' }} onClick={() => setProductTab('fiscal')}>Fiscal</button>
            </div>

            <form 
              key={editingProduct ? (editingProduct.id || 'copy-' + (editingProduct.name || '')) : 'new'}
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const data = Object.fromEntries(fd.entries());
                if (editingProduct && editingProduct.id) {
                  data.id = editingProduct.id;
                }
                
                try {
                  const res = await fetch(`${API_URL}/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                  });
                  const resData = await res.json();
                  if (res.ok) {
                    alert(editingProduct && editingProduct.id ? "Produto atualizado com sucesso!" : "Produto criado com sucesso!");
                    setIsProductModalOpen(false);
                    setEditingProduct(null);
                    fetchData();
                  } else {
                    alert(resData.error || "Erro ao salvar produto.");
                  }
                } catch (err) {
                  alert("Erro ao conectar ao servidor: " + err.message);
                }
              }}
            >
              
              <div style={{ display: productTab === 'basic' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Código Interno</label>
                    <input 
                      name="codigo" 
                      readOnly 
                      value={editingProduct?.codigo || '(Gerado Automaticamente)'} 
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255, 255, 255, 0.08)', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        color: 'var(--text-secondary)', 
                        marginTop: '4px', 
                        opacity: 0.7, 
                        cursor: 'not-allowed', 
                        pointerEvents: 'none' 
                      }} 
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nome do Produto</label>
                    <input name="name" required defaultValue={editingProduct?.name || ''} placeholder="Ex: Pizza Calabresa" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Preço (Venda)</label>
                    <input name="price" type="number" step="0.01" required defaultValue={editingProduct?.price || ''} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Custo (CMV)</label>
                    <input name="cost" type="number" step="0.01" defaultValue={editingProduct?.cost || ''} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ícone</label>
                    <input name="icon" defaultValue={editingProduct?.icon || '🍽️'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Grupo (PDV)</label>
                    <select name="categoryId" required defaultValue={editingProduct?.categoryId || ''} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}>
                      <option value="">Selecione...</option>
                      {categories.filter(c => c.id !== 'all').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Categoria (Filtro/Fiscal)</label>
                    <input name="categoria" defaultValue={editingProduct?.categoria || ''} placeholder="Ex: Cervejas Especiais, Destilados" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Setor de Impressão</label>
                    <select name="printSector" defaultValue={editingProduct?.printSector || 'CAIXA'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}>
                      {Object.keys(printerConfig.sectors || { CAIXA: {} }).map(key => {
                        const isCaixa = key === 'CAIXA';
                        const isCozinha = key === 'COZINHA';
                        const isBar = key === 'BAR';
                        
                        const icon = isCaixa ? '💵' : isCozinha ? '🍳' : isBar ? '🍺' : '🏷️';
                        const displayName = isCaixa ? 'Caixa (Padrão)' : isCozinha ? 'Cozinha' : isBar ? 'Bar' : key;
                        return (
                          <option key={key} value={key}>
                            {icon} {displayName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: productTab === 'fraction' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Configure se este produto pode ser vendido de forma fracionada (ex: Meio a Meio).</p>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Quantidade Máxima de Sabores</label>
                  <select name="maxFlavors" required defaultValue={editingProduct?.maxFlavors || 1} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}>
                    <option value="1">1 (Produto Simples)</option>
                    <option value="2">Até 2 Sabores (Meio a Meio)</option>
                    <option value="3">Até 3 Sabores</option>
                    <option value="4">Até 4 Sabores</option>
                  </select>
                </div>
                <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '8px', color: 'var(--warning)', fontSize: '14px', marginBottom: '16px' }}>
                  <strong>Atenção:</strong> Ao marcar mais de 1 sabor, o Frente de Caixa (PDV) exigirá que o Garçom escolha os sabores na hora do lançamento. A regra de cobrança padrão será o "Valor da Fração mais Cara" ou a Média, dependendo da configuração geral do sistema.
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Observações Predefinidas (separadas por vírgula)</label>
                  <input name="availableObs" defaultValue={editingProduct?.availableObs || ''} placeholder="Ex: Sem Gelo, Com Limão, Bem Passado" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                </div>
              </div>

              <div style={{ display: productTab === 'fiscal' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Dados para futura integração com NFC-e / SAT Fiscal.</p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>NCM</label>
                    <input name="ncm" defaultValue={editingProduct?.ncm || ''} placeholder="Nomenclatura Comum" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>CEST</label>
                    <input name="cest" defaultValue={editingProduct?.cest || ''} placeholder="Cód. Especificador" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>CFOP Padrão (Venda)</label>
                  <input name="cfop" defaultValue={editingProduct?.cfop || '5102'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" style={{ width: 'auto' }} onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>{editingProduct ? 'Salvar Alterações' : 'Criar Produto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL DE CATEGORIA */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{editingCategory?.id ? 'Editar Grupo' : 'Novo Grupo'}</h2>
              <button className="btn-close" onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const data = Object.fromEntries(fd.entries());
              if (editingCategory?.id) data.id = editingCategory.id;
              
              await fetch(`${API_URL}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setIsCategoryModalOpen(false);
              setEditingCategory(null);
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nome do Grupo</label>
                  <input name="name" required defaultValue={editingCategory?.name || ''} placeholder="Ex: Bebidas" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ícone (Biblioteca)</label>
                  <input type="hidden" name="icon" value={editingCategory?.icon || '📁'} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {['🍕', '🍔', '🍺', '🥤', '🍷', '🥩', '🍟', '🍣', '🍰', '🍮', '☕', '🍲', '📁', '🌶️', '🥦', '🥪', '🥘', '🌭', '🌮', '🥗'].map(emoji => (
                      <div 
                        key={emoji}
                        onClick={() => setEditingCategory(prev => ({ ...prev, icon: emoji }))}
                        style={{ 
                          fontSize: '24px', 
                          padding: '8px', 
                          cursor: 'pointer', 
                          borderRadius: '8px', 
                          background: (editingCategory?.icon || '📁') === emoji ? 'var(--primary)' : 'var(--bg-surface-light)',
                          border: (editingCategory?.icon || '📁') === emoji ? '2px solid white' : '2px solid transparent'
                        }}
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', background: 'var(--bg-surface-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" name="allowFractional" id="allowFractional" checked={editingCategory?.allowFractional || false} onChange={(e) => setEditingCategory(prev => ({ ...prev, allowFractional: e.target.checked }))} style={{ width: '24px', height: '24px', cursor: 'pointer' }} />
                  <label htmlFor="allowFractional" style={{ fontSize: '14px', color: 'white', cursor: 'pointer', userSelect: 'none' }}>Ativar Opção de Produto Fracionado</label>
                </div>

                {editingCategory?.allowFractional && (
                  <div>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Regra de Cobrança da Fração</label>
                    <select name="fractionPriceMode" defaultValue={editingCategory?.fractionPriceMode || 'highest'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}>
                      <option value="highest">Cobrar pelo Sabor Mais Caro</option>
                      <option value="average">Cobrar pela Média dos Sabores</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-outline" style={{ width: 'auto' }} onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Salvar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL DE ENTREGADOR */}
      {isDriverModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{editingDriver?.id ? 'Editar Entregador' : 'Novo Entregador'}</h2>
              <button className="btn-close" onClick={() => { setIsDriverModalOpen(false); setEditingDriver(null); }}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const name = fd.get('name');
              const phone = fd.get('phone');
              const active = fd.get('active') === 'true';
              
              const payload = {
                name,
                phone,
                active
              };
              if (editingDriver?.id) {
                payload.id = editingDriver.id;
              }
              
              try {
                const res = await fetch(`${API_URL}/drivers`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (res.ok) {
                  setIsDriverModalOpen(false);
                  setEditingDriver(null);
                  fetchData('settings');
                } else {
                  alert("Erro ao salvar entregador.");
                }
              } catch (err) {
                alert("Erro de conexão: " + err.message);
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nome do Entregador</label>
                  <input 
                    name="name" 
                    required 
                    defaultValue={editingDriver?.name || ''} 
                    placeholder="Ex: Carlos Silva" 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Telefone / Celular</label>
                  <input 
                    name="phone" 
                    defaultValue={editingDriver?.phone || ''} 
                    placeholder="Ex: (11) 98888-8888" 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Status</label>
                  <select 
                    name="active" 
                    defaultValue={editingDriver?.active !== undefined ? String(editingDriver.active) : 'true'}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', marginTop: '4px' }}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-outline" style={{ width: 'auto' }} onClick={() => { setIsDriverModalOpen(false); setEditingDriver(null); }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Salvar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TRANSAÇÃO DE CAIXA (Sangria ou Suprimento) */}
      {isTransactionModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Registrar {transactionType === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'}</h2>
              <button className="btn-close" onClick={() => setIsTransactionModalOpen(false)}>×</button>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Valor (R$):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  placeholder="R$ 0,00" 
                  value={transactionAmount}
                  onChange={e => setTransactionAmount(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Justificativa / Observação:</label>
                <textarea 
                  placeholder={transactionType === 'sangria' ? 'Descreva o motivo da sangria...' : 'Descreva o motivo do suprimento...'}
                  value={transactionDescription}
                  onChange={e => setTransactionDescription(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ width: 'auto' }} 
                  onClick={() => setIsTransactionModalOpen(false)}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ width: 'auto', background: transactionType === 'sangria' ? 'var(--danger)' : 'var(--success)' }} 
                  onClick={handleSubmitTransaction}
                >
                  Confirmar {transactionType === 'sangria' ? 'Sangria' : 'Suprimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE OPERAÇÕES DE ITEM (Transferência e Pagamento Parcial) */}
      {(isTransferModalOpen || isPartialModalOpen) && (

        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{isTransferModalOpen ? 'Transferir Itens' : 'Pagar por Item (Sub-Conta)'}</h2>
              <button className="btn-close" onClick={() => { setIsTransferModalOpen(false); setIsPartialModalOpen(false); setSelectedItemsForOp([]); }}>×</button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Selecione os itens e a quantidade (use 0.5 para pagar/transferir meia porção).
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px' }}>Selec.</th>
                    <th style={{ padding: '8px' }}>Item</th>
                    <th style={{ padding: '8px' }}>Qtde Original</th>
                    <th style={{ padding: '8px' }}>Qtde Desejada</th>
                  </tr>
                </thead>
                <tbody>
                  {existingItems.map(item => {
                    const selected = selectedItemsForOp.find(i => i.id === item.id);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={!!selected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemsForOp([...selectedItemsForOp, { id: item.id, maxQty: item.qty, qtyToOp: item.qty, price: item.price, name: item.productName || item.product?.name }]);
                              } else {
                                setSelectedItemsForOp(selectedItemsForOp.filter(i => i.id !== item.id));
                              }
                            }}
                            style={{ width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>{item.productName || item.product?.name}</td>
                        <td style={{ padding: '8px' }}>{item.qty}x</td>
                        <td style={{ padding: '8px' }}>
                          {selected ? (
                            <input 
                              type="number" 
                              step="0.1" 
                              min="0.1" 
                              max={item.qty}
                              value={selected.qtyToOp}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if(val > 0 && val <= item.qty) {
                                  setSelectedItemsForOp(selectedItemsForOp.map(i => i.id === item.id ? { ...i, qtyToOp: val } : i));
                                }
                              }}
                              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white' }}
                            />
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isTransferModalOpen && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Mesa Destino:</label>
                <select 
                  value={destinationTableId}
                  onChange={(e) => setDestinationTableId(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-light)', color: 'white' }}
                >
                  <option value="">Selecione a mesa...</option>
                  {tables.filter(t => t.id !== activeTable).map(t => (
                    <option key={t.id} value={t.id}>Mesa {t.number}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => { setIsTransferModalOpen(false); setIsPartialModalOpen(false); setSelectedItemsForOp([]); }}>Cancelar</button>
              {isTransferModalOpen ? (
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={executeTransfer}>Executar Transferência</button>
              ) : (
                <button className="btn btn-success" style={{ width: 'auto' }} onClick={() => handleCheckout(true)}>Ir para Fechamento</button>
              )}
            </div>
          </div>
        </div>
      )}
      {fractionConfig && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Montar {fractionConfig.baseProduct.name}</h2>
              <button className="btn-close" onClick={() => setFractionConfig(null)}>×</button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Selecione até <strong>{fractionConfig.baseProduct.maxFlavors} sabores</strong>. O valor cobrado será o da <strong>{fractionConfig.fractionPriceMode === 'average' ? 'Média dos Sabores' : 'Fração mais cara'}</strong>.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {products.filter(p => p.categoryId === fractionConfig.baseProduct.categoryId && p.id !== fractionConfig.baseProduct.id).map(flavor => {
                const isSelected = fractionConfig.selectedFlavors.find(f => f.id === flavor.id);
                return (
                  <div 
                    key={flavor.id} 
                    onClick={() => {
                      setFractionConfig(prev => {
                        if (isSelected) {
                          return { ...prev, selectedFlavors: prev.selectedFlavors.filter(f => f.id !== flavor.id) };
                        } else if (prev.selectedFlavors.length < prev.baseProduct.maxFlavors) {
                          return { ...prev, selectedFlavors: [...prev.selectedFlavors, flavor] };
                        }
                        return prev;
                      });
                    }}
                    style={{ 
                      padding: '12px 16px', 
                      background: isSelected ? 'rgba(255, 92, 53, 0.15)' : 'var(--bg-surface-light)', 
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                      borderRadius: '12px', 
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--primary)' : 'white' }}>{flavor.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>R$ {flavor.price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--bg-surface-light)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sabores escolhidos:</span>
                <div style={{ fontWeight: 'bold' }}>{fractionConfig.selectedFlavors.length} de {fractionConfig.baseProduct.maxFlavors}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Valor Final:</span>
                <div style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--primary)' }}>
                  R$ {(() => {
                    if (fractionConfig.selectedFlavors.length === 0) return (fractionConfig.baseProduct.price || 0).toFixed(2);
                    if (fractionConfig.fractionPriceMode === 'average') {
                      const sum = fractionConfig.selectedFlavors.reduce((acc, f) => acc + f.price, 0);
                      return (sum / fractionConfig.selectedFlavors.length).toFixed(2);
                    }
                    return Math.max(...fractionConfig.selectedFlavors.map(f => f.price)).toFixed(2);
                  })()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setFractionConfig(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={confirmFractionalOrder}>Confirmar Lançamento</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVAÇÕES */}
      {obsConfig && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Observações: {obsConfig.baseProduct.name}</h2>
              <button className="btn-close" onClick={() => setObsConfig(null)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {obsConfig.baseProduct.availableObs.split(',').map(obs => {
                const obsLimpa = obs.trim();
                const isSelected = obsConfig.selectedObs.includes(obsLimpa);
                return (
                  <div 
                    key={obsLimpa} 
                    onClick={() => {
                      setObsConfig(prev => {
                        if (isSelected) {
                          return { ...prev, selectedObs: prev.selectedObs.filter(o => o !== obsLimpa) };
                        } else {
                          return { ...prev, selectedObs: [...prev.selectedObs, obsLimpa] };
                        }
                      });
                    }}
                    style={{ 
                      padding: '12px 16px', 
                      background: isSelected ? 'rgba(255, 92, 53, 0.15)' : 'var(--bg-surface-light)', 
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                      borderRadius: '12px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none' }} />
                    <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--primary)' : 'white' }}>{obsLimpa}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setObsConfig(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
                setTempOrder([...tempOrder, { 
                  ...obsConfig.baseProduct, 
                  id: Date.now().toString(), 
                  productId: obsConfig.baseProduct.id,
                  qty: 1,
                  observations: obsConfig.selectedObs.join(', ')
                }]);
                setObsConfig(null);
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL SIMULADOR DE IMPRESSORA TÉRMICA */}
      {isPrinterPreviewOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '20px', background: 'var(--bg-dark)', borderRadius: '16px' }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Visualização do Cupom Térmico</h2>
              <button className="btn-close" onClick={() => setIsPrinterPreviewOpen(false)}>×</button>
            </div>
            
            <div className="thermal-preview-container" style={{ maxHeight: '500px', overflowY: 'auto', background: '#fdfbf7', padding: '16px', borderRadius: '8px', border: '1px solid #d8d3c5', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
              <pre className="thermal-paper" style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', color: '#1a1a1a', whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.4', wordBreak: 'break-all' }}>
                {printerPreviewText}
              </pre>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setIsPrinterPreviewOpen(false)}>
                Fechar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ width: 'auto' }} 
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Imprimir Cupom - Colibri Web</title>
                        <style>
                          body {
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 14px;
                            color: #000;
                            margin: 10px;
                            padding: 0;
                            width: 290px; /* Largura padrão de bobina 80mm */
                          }
                          pre {
                            white-space: pre-wrap;
                            margin: 0;
                            word-break: break-all;
                            line-height: 1.3;
                          }
                          @media print {
                            body { margin: 0; }
                            @page { margin: 0; }
                          }
                        </style>
                      </head>
                      <body>
                        <pre>\${printerPreviewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          };
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
              >
                🖨️ Imprimir Local
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
