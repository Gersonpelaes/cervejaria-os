
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, onSnapshot, addDoc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth, ensureAuth, BASE_PATH } from './services/firebaseConfig';
import { Company, AppConfig, StockItem, Supplier } from './types';
import SectorView from './pages/SectorView';
import BuyerView from './pages/BuyerView';
import AdmView from './pages/AdmView';
import { Button, Input, Card, Select } from './components/UI';
import { ShoppingCart, LogIn, Briefcase, UserCheck, PlayCircle, DollarSign } from 'lucide-react';

// --- Redirect Component for Legacy Links ---
const LegacyRedirect = () => {
    const { code } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (code && code !== 'app') {
            // Redirect from /:code to /app/:code
            navigate(`/app/${code}`, { replace: true });
        }
    }, [code, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
    );
};

// --- Landing Page Component ---
const LandingPage = () => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newCo, setNewCo] = useState({ name: '', code: '', pass: '' });
    const navigate = useNavigate();

    const handleEnter = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await ensureAuth();
            const q = query(collection(db, `${BASE_PATH}/companies`), where("code", "==", code.trim().toUpperCase()));
            const snap = await getDocs(q);
            if (!snap.empty) {
                navigate(`/app/${code.trim().toUpperCase()}`);
            } else {
                alert("Empresa não encontrada.");
            }
        } catch (err) { console.error(err); alert("Erro ao acessar."); }
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await ensureAuth();
            const formattedCode = newCo.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            // Check existence
            const q = query(collection(db, `${BASE_PATH}/companies`), where("code", "==", formattedCode));
            const snap = await getDocs(q);
            if (!snap.empty) { alert("Código já existe."); setLoading(false); return; }

            const ref = await addDoc(collection(db, `${BASE_PATH}/companies`), {
                name: newCo.name, code: formattedCode, buyerPassword: newCo.pass
            });
            // Init config
            await setDoc(doc(db, `${BASE_PATH}/companies/${ref.id}/app_config`, 'main'), { restaurants: [], sectors: [], units: [], categories: [] });

            navigate(`/app/${formattedCode}`);
        } catch (err) { console.error(err); alert("Erro ao criar."); }
        setLoading(false);
    };

    const createDemoCompany = async () => {
        setLoading(true);
        try {
            await ensureAuth();
            const demoCode = "DEMO-" + Math.floor(Math.random() * 10000);

            // 1. Create Company
            const coRef = await addDoc(collection(db, `${BASE_PATH}/companies`), {
                name: "Restaurante Modelo S.A.",
                code: demoCode,
                buyerPassword: "123"
            });
            const coId = coRef.id;

            // 2. IDs setup
            const rest1 = crypto.randomUUID();
            const rest2 = crypto.randomUUID();
            const sec1 = crypto.randomUUID(); // Cozinha
            const sec2 = crypto.randomUUID(); // Bar
            const sec3 = crypto.randomUUID(); // Almoxarifado

            // 3. Config
            await setDoc(doc(db, `${BASE_PATH}/companies/${coId}/app_config`, 'main'), {
                restaurants: [
                    { id: rest1, name: "Bistrô Principal" },
                    { id: rest2, name: "Bar do Terraço" }
                ],
                sectors: [
                    { id: sec1, name: "Cozinha Quente" },
                    { id: sec2, name: "Bar" },
                    { id: sec3, name: "Estoque Seco" }
                ],
                units: [
                    { id: '1', name: 'kg' }, { id: '2', name: 'un' }, { id: '3', name: 'L' }, { id: '4', name: 'cx' }
                ],
                categories: [
                    { id: '1', name: 'Hortifruti' }, { id: '2', name: 'Carnes' }, { id: '3', name: 'Bebidas' }, { id: '4', name: 'Limpeza' }
                ],
                admPasswords: {
                    [rest1]: "123",
                    [rest2]: "123"
                }
            });

            // 4. Batch Stock Items
            const batch = writeBatch(db);
            const stockRef = collection(db, `${BASE_PATH}/companies/${coId}/stock_items`);

            const items = [
                { name: "Arroz Agulhinha", cat: "Estoque Seco", unit: "kg", price: 5.50 },
                { name: "Tomate Italiano", cat: "Hortifruti", unit: "kg", price: 8.90 },
                { name: "Filé Mignon", cat: "Carnes", unit: "kg", price: 69.90 },
                { name: "Detergente", cat: "Limpeza", unit: "un", price: 2.50 },
                { name: "Cerveja Lager", cat: "Bebidas", unit: "un", price: 4.50 },
                { name: "Leite Integral", cat: "Laticínios", unit: "L", price: 4.20 },
            ];

            items.forEach(i => {
                const newDoc = doc(stockRef);
                batch.set(newDoc, {
                    id: newDoc.id,
                    name: i.name,
                    category: i.cat,
                    unit: i.unit,
                    minStock: 5, idealStock: 20, maxStock: 50,
                    purchasePeriod: 'semanal',
                    purchaseUnitDescription: '',
                    lastPrice: i.price,
                    avgPrice: i.price,
                    purchaseCount: 1,
                    associations: {
                        [rest1]: [sec1, sec3],
                        [rest2]: [sec2]
                    }
                });
            });

            // 5. Generate Past Orders (History for Reports)
            const ordersRef = collection(db, `${BASE_PATH}/companies/${coId}/daily_orders`);

            // Function to create historical order
            const addOrder = (daysAgo: number, rId: string, sId: string, itemsList: any[]) => {
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                const dateStr = d.toISOString().split('T')[0];
                const oDoc = doc(ordersRef, `${dateStr}_${rId}_${sId}`);

                batch.set(oDoc, {
                    restaurantId: rId,
                    sectorId: sId,
                    responsibleName: "Sistema Demo",
                    orderDate: dateStr,
                    createdAt: Timestamp.fromDate(d),
                    stockCountRequested: false,
                    items: itemsList.map(item => ({
                        id: crypto.randomUUID(),
                        name: item.name,
                        quantity: item.qtd,
                        unit: item.unit,
                        category: item.cat,
                        purchased: true,
                        price: item.total,
                        addedAt: "10:00"
                    }))
                });
            };

            // Order 1: 2 days ago
            addOrder(2, rest1, sec1, [
                { name: "Tomate Italiano", qtd: 5, unit: "kg", cat: "Hortifruti", total: 45.00 },
                { name: "Filé Mignon", qtd: 10, unit: "kg", cat: "Carnes", total: 690.00 }
            ]);

            // Order 2: 5 days ago
            addOrder(5, rest1, sec3, [
                { name: "Arroz Agulhinha", qtd: 20, unit: "kg", cat: "Estoque Seco", total: 110.00 },
                { name: "Detergente", qtd: 10, unit: "un", cat: "Limpeza", total: 25.00 }
            ]);

            // Order 3: 1 day ago (Bar)
            addOrder(1, rest2, sec2, [
                { name: "Cerveja Lager", qtd: 48, unit: "un", cat: "Bebidas", total: 216.00 }
            ]);

            await batch.commit();

            alert(`Ambiente de Teste Criado!\n\nCódigo: ${demoCode}\nSenha do Comprador: 123\nSenha ADM (Financeiro): 123`);
            navigate(`/app/${demoCode}`);

        } catch (e) {
            console.error(e);
            alert("Erro ao criar demo.");
        }
        setLoading(false);
    };

    if (isCreating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <Card title="Criar Nova Empresa" className="w-full max-w-md">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input label="Nome da Empresa" value={newCo.name} onChange={e => setNewCo(p => ({ ...p, name: e.target.value }))} required />
                        <Input label="Código Único" value={newCo.code} onChange={e => setNewCo(p => ({ ...p, code: e.target.value }))} placeholder="SEM ESPAÇOS" required />
                        <Input label="Senha do Comprador" type="password" value={newCo.pass} onChange={e => setNewCo(p => ({ ...p, pass: e.target.value }))} required />
                        <div className="flex gap-2 mt-4">
                            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} className="w-full">Cancelar</Button>
                            <Button type="submit" isLoading={loading} variant="success" className="w-full">Criar</Button>
                        </div>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
            <div className="mb-8 text-center animate-in slide-in-from-bottom-5 duration-500">
                <div className="bg-white/20 p-4 rounded-full inline-block mb-4 backdrop-blur-sm">
                    <ShoppingCart className="w-12 h-12" />
                </div>
                <h1 className="text-4xl font-bold">Gestão de Compras</h1>
                <p className="mt-2 text-brand-100">Controle de estoque e pedidos centralizado.</p>
            </div>

            <Card className="w-full max-w-md bg-white text-gray-800 shadow-2xl">
                <form onSubmit={handleEnter} className="space-y-4">
                    <h2 className="text-xl font-bold text-center mb-4">Aceder à Empresa</h2>
                    <Input
                        placeholder="Código da Empresa"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        className="text-center text-lg tracking-widest uppercase font-bold"
                    />
                    <Button type="submit" isLoading={loading} className="w-full h-12 text-lg">Entrar</Button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                    <Button
                        type="button"
                        onClick={createDemoCompany}
                        isLoading={loading}
                        variant="outline"
                        className="w-full border-brand-200 text-brand-700 hover:bg-brand-50"
                    >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Criar Empresa de Teste (Demo)
                    </Button>

                    <div className="text-center">
                        <button onClick={() => setIsCreating(true)} className="text-sm text-gray-500 hover:text-brand-600 hover:underline">
                            Criar nova conta vazia
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// --- App Layout & Logic ---
const AppShell = () => {
    const { pathname } = useLocation();
    const code = pathname.split('/')[2]; // /app/:code
    const navigate = useNavigate();

    const [company, setCompany] = useState<Company | null>(null);
    const [config, setConfig] = useState<AppConfig>({ restaurants: [], sectors: [], units: [], categories: [] });
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Auth State
    const [viewMode, setViewMode] = useState<'login' | 'sector' | 'adm' | 'buyer'>('login');
    const [sectorUser, setSectorUser] = useState<any>(null);
    const [admUser, setAdmUser] = useState<any>(null);
    const [buyerPass, setBuyerPass] = useState('');
    const [admPassInput, setAdmPassInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [loginTab, setLoginTab] = useState<'sector' | 'adm' | 'buyer'>('sector');

    useEffect(() => {
        let unsubConfig = () => { };
        let unsubStock = () => { };
        let unsubSuppliers = () => { };

        const init = async () => {
            try {
                await ensureAuth();
                if (!code) return;

                // Load saved sector auth
                const savedAuth = localStorage.getItem(`gestao_compras_auth_${code}`);
                if (savedAuth) {
                    try {
                        const parsed = JSON.parse(savedAuth);
                        if (parsed.restaurantId) setSectorUser((p: any) => ({ ...p, restaurantId: parsed.restaurantId }));
                        if (parsed.sectorId) setSectorUser((p: any) => ({ ...p, sectorId: parsed.sectorId }));
                    } catch (e) {
                        console.error("Error loading saved auth", e);
                    }
                }

                // Resolve Company ID from Code
                const q = query(collection(db, `${BASE_PATH}/companies`), where("code", "==", code));
                const snap = await getDocs(q);

                if (snap.empty) { navigate('/'); return; }
                const coDoc = snap.docs[0];
                setCompany({ id: coDoc.id, ...coDoc.data() } as Company);

                // Listeners
                unsubConfig = onSnapshot(doc(db, `${BASE_PATH}/companies/${coDoc.id}/app_config`, 'main'), s => {
                    if (s.exists()) setConfig(s.data() as AppConfig);
                });

                unsubStock = onSnapshot(collection(db, `${BASE_PATH}/companies/${coDoc.id}/stock_items`), s => {
                    setStockItems(s.docs.map(d => ({ id: d.id, ...d.data() } as StockItem)));
                });

                unsubSuppliers = onSnapshot(collection(db, `${BASE_PATH}/companies/${coDoc.id}/suppliers`), s => {
                    setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
                });

                setLoading(false);
            } catch (error) {
                console.error("Initialization error:", error);
            }
        };

        init();

        return () => {
            unsubConfig();
            unsubStock();
            unsubSuppliers();
        };
    }, [code, navigate]);

    // Helpers
    const getRestaurantName = (id: string) => config.restaurants.find(r => r.id === id)?.name || 'N/A';
    const getSectorName = (id: string) => config.sectors.find(s => s.id === id)?.name || 'N/A';

    // Login Handlers
    const handleSectorLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // Save to LocalStorage
        if (sectorUser?.restaurantId && sectorUser?.sectorId && sectorUser?.responsibleName) {
            const savedRaw = localStorage.getItem(`gestao_compras_auth_${code}`);
            let recentNames: string[] = [];
            if (savedRaw) {
                try {
                    recentNames = JSON.parse(savedRaw).recentNames || [];
                } catch { }
            }

            if (!recentNames.includes(sectorUser.responsibleName)) {
                recentNames = [sectorUser.responsibleName, ...recentNames].slice(0, 5); // Keep last 5
            }

            localStorage.setItem(`gestao_compras_auth_${code}`, JSON.stringify({
                restaurantId: sectorUser.restaurantId,
                sectorId: sectorUser.sectorId,
                recentNames
            }));
        }

        setViewMode('sector');
    };

    const handleAdmLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!admUser.restaurantId || !admUser.responsibleName) return alert("Preencha todos os campos");

        const correctPass = config.admPasswords?.[admUser.restaurantId];

        if (correctPass && admPassInput === correctPass) {
            setViewMode('adm');
        } else {
            alert("Senha do setor ADM incorreta para esta empresa.");
        }
    };

    const handleBuyerLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (buyerPass === company?.buyerPassword) {
            setViewMode('buyer');
        } else {
            alert("Senha incorreta");
        }
    };

    if (loading || !company) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>;

    // --- Views ---

    if (viewMode === 'login') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <h1 className="text-3xl font-bold mb-8 text-brand-900">{company.name}</h1>

                <div className="w-full max-w-md">
                    <div className="flex rounded-t-lg overflow-hidden border-b border-gray-200">
                        <button
                            className={`flex-1 py-3 text-sm font-bold ${loginTab === 'sector' ? 'bg-white text-brand-600 border-t-2 border-brand-600' : 'bg-gray-100 text-gray-500'}`}
                            onClick={() => setLoginTab('sector')}
                        >
                            Setor
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-bold ${loginTab === 'adm' ? 'bg-white text-purple-600 border-t-2 border-purple-600' : 'bg-gray-100 text-gray-500'}`}
                            onClick={() => setLoginTab('adm')}
                        >
                            ADM / Financeiro
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-bold ${loginTab === 'buyer' ? 'bg-white text-gray-800 border-t-2 border-gray-800' : 'bg-gray-100 text-gray-500'}`}
                            onClick={() => setLoginTab('buyer')}
                        >
                            Comprador
                        </button>
                    </div>

                    <div className="bg-white p-6 shadow-lg rounded-b-lg">
                        {loginTab === 'sector' && (
                            <form onSubmit={handleSectorLogin} className="space-y-4 animate-in fade-in">
                                <div className="text-center mb-4 text-brand-100">
                                    <Briefcase className="w-10 h-10 mx-auto text-brand-500 mb-2" />
                                    <p className="text-gray-500 text-sm">Pedidos e Estoque</p>
                                </div>
                                <Select
                                    label="Restaurante"
                                    value={sectorUser?.restaurantId || ''}
                                    onChange={e => setSectorUser((p: any) => ({ ...p, restaurantId: e.target.value }))}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </Select>
                                <Select
                                    label="Setor"
                                    value={sectorUser?.sectorId || ''}
                                    onChange={e => setSectorUser((p: any) => ({ ...p, sectorId: e.target.value }))}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {config.sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </Select>

                                <div>
                                    <Input
                                        label="Seu Nome"
                                        placeholder="João Silva"
                                        value={sectorUser?.responsibleName || ''}
                                        onChange={e => setSectorUser((p: any) => ({ ...p, responsibleName: e.target.value }))}
                                        required
                                    />
                                    {/* Recent Users Chips */}
                                    {(() => {
                                        const saved = localStorage.getItem(`gestao_compras_auth_${code}`);
                                        if (!saved) return null;
                                        try {
                                            const names: string[] = JSON.parse(saved).recentNames || [];
                                            if (names.length === 0) return null;
                                            return (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {names.map(name => (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => setSectorUser((p: any) => ({ ...p, responsibleName: name }))}
                                                            className="text-xs bg-gray-100 hover:bg-brand-50 text-gray-700 px-2 py-1 rounded-full border border-gray-200 transition-colors"
                                                        >
                                                            {name}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        } catch { return null; }
                                    })()}
                                </div>

                                <Button type="submit" className="w-full">Entrar</Button>
                            </form>
                        )}

                        {loginTab === 'adm' && (
                            <form onSubmit={handleAdmLogin} className="space-y-4 animate-in fade-in">
                                <div className="text-center mb-4 text-purple-100">
                                    <DollarSign className="w-10 h-10 mx-auto text-purple-500 mb-2" />
                                    <p className="text-gray-500 text-sm">Contas a Pagar</p>
                                </div>
                                <Select
                                    label="Restaurante"
                                    onChange={e => setAdmUser((p: any) => ({ ...p, restaurantId: e.target.value }))}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {config.restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </Select>
                                <Input
                                    label="Seu Nome"
                                    placeholder="Maria ADM"
                                    onChange={e => setAdmUser((p: any) => ({ ...p, responsibleName: e.target.value }))}
                                    required
                                />
                                <Input
                                    type="password"
                                    label="Senha do Setor ADM"
                                    value={admPassInput}
                                    onChange={e => setAdmPassInput(e.target.value)}
                                    required
                                />
                                {company.code.startsWith('DEMO-') && (
                                    <p className="text-xs text-center text-purple-600 font-medium bg-purple-50 p-2 rounded">
                                        💡 Senha ADM Demo: 123
                                    </p>
                                )}
                                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">Acessar Financeiro</Button>
                            </form>
                        )}

                        {loginTab === 'buyer' && (
                            <form onSubmit={handleBuyerLogin} className="space-y-4 animate-in fade-in">
                                <div className="text-center mb-4 text-gray-100">
                                    <UserCheck className="w-10 h-10 mx-auto text-gray-700 mb-2" />
                                    <p className="text-gray-500 text-sm">Gestão Geral</p>
                                </div>
                                <Input
                                    type="password"
                                    label="Senha Admin"
                                    placeholder="******"
                                    value={buyerPass}
                                    onChange={e => setBuyerPass(e.target.value)}
                                />
                                {company.code.startsWith('DEMO-') && (
                                    <p className="text-xs text-center text-brand-600 font-medium bg-brand-50 p-2 rounded">
                                        💡 Senha Comprador Demo: 123
                                    </p>
                                )}
                                <Button type="submit" variant="secondary" className="w-full">Entrar</Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <header className="bg-white border-b sticky top-0 z-40 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode('login')} className="p-2 hover:bg-gray-100 rounded-full">
                        <LogIn className="w-5 h-5 text-gray-600 rotate-180" />
                    </button>
                    <h1 className="font-bold text-gray-800 hidden sm:block">{company.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {viewMode === 'adm' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">ADM FINANCEIRO</span>}
                    {viewMode === 'buyer' && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold">COMPRADOR</span>}
                </div>
            </header>

            {viewMode === 'sector' && sectorUser && (
                <main className="p-4">
                    <SectorView
                        companyId={company.id}
                        config={config}
                        user={sectorUser}
                        stockItems={stockItems}
                        getRestaurantName={getRestaurantName}
                        getSectorName={getSectorName}
                    />
                </main>
            )}

            {viewMode === 'adm' && admUser && (
                <main className="p-4">
                    <AdmView
                        companyId={company.id}
                        restaurantId={admUser.restaurantId}
                        restaurantName={getRestaurantName(admUser.restaurantId)}
                        userName={admUser.responsibleName}
                    />
                </main>
            )}

            {viewMode === 'buyer' && (
                <BuyerView
                    companyId={company.id}
                    companyCode={company.code}
                    config={config}
                    stockItems={stockItems}
                    getRestaurantName={getRestaurantName}

                    getSectorName={getSectorName}
                    suppliers={suppliers}
                />
            )}
        </div>
    );
};

export default function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/app/:code" element={<AppShell />} />
                {/* Fallback for legacy links shared without /app/ prefix */}
                <Route path="/:code" element={<LegacyRedirect />} />
            </Routes>
        </HashRouter>
    );
}
