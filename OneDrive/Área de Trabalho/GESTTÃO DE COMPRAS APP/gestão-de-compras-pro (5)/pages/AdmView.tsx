
import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, orderBy, Timestamp, limit, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { Bill, Beneficiary } from '../types';
import { Button, Input, Select, Card, Modal } from '../components/UI';
import { Plus, DollarSign, Calendar, Upload, FileText, CheckCircle, Clock, Camera, Loader2, Eye, Users, Edit3, Trash2, Phone, Key, Briefcase } from 'lucide-react';

interface Props {
    companyId: string;
    restaurantId: string;
    restaurantName: string;
    userName: string;
}

const AdmView: React.FC<Props> = ({ companyId, restaurantId, restaurantName, userName }) => {
    const [activeTab, setActiveTab] = useState<'launch' | 'beneficiaries'>('launch');
    const [bills, setBills] = useState<Bill[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

    const [newBill, setNewBill] = useState<Partial<Bill>>({
        supplier: '',
        value: undefined,
        paymentMethod: 'boleto',
        pixKey: '',
        dueDate: new Date().toISOString().split('T')[0]
    });
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>('');
    const [daysWorked, setDaysWorked] = useState<string>('1');

    const [fileName, setFileName] = useState('');
    const [fileData, setFileData] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    
    // Beneficiary Form State
    const [isBenModalOpen, setIsBenModalOpen] = useState(false);
    const [editingBen, setEditingBen] = useState<Partial<Beneficiary>>({
        type: 'collaborator',
        name: '',
        roleOrCategory: '',
        phone: '',
        pixKey: '',
        dailyRate: undefined
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(
            collection(db, `${BASE_PATH}/companies/${companyId}/bills`),
            orderBy("createdAt", "desc"),
            limit(100)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list: Bill[] = [];
            snap.forEach(doc => {
                 const data = doc.data();
                 if (data.restaurantId === restaurantId) {
                     list.push({ id: doc.id, ...data } as Bill);
                 }
            });
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setBills(list);
        });

        const unsubBen = onSnapshot(collection(db, `${BASE_PATH}/companies/${companyId}/beneficiaries`), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Beneficiary));
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setBeneficiaries(list);
        });

        return () => {
            unsub();
            unsubBen();
        };
    }, [companyId, restaurantId]);

    // --- Beneficiary Selection Handler ---
    const handleSelectBeneficiary = (benId: string) => {
        setSelectedBeneficiaryId(benId);
        if (!benId) return;

        const ben = beneficiaries.find(b => b.id === benId);
        if (ben) {
            setDaysWorked('1');
            setNewBill(prev => ({
                ...prev,
                supplier: ben.name,
                pixKey: ben.pixKey || prev.pixKey || '',
                paymentMethod: ben.pixKey ? 'pix' : prev.paymentMethod,
                value: (ben.type === 'collaborator' && ben.dailyRate) ? ben.dailyRate : prev.value
            }));
        }
    };

    const handleDaysChange = (daysStr: string) => {
        setDaysWorked(daysStr);
        const ben = beneficiaries.find(b => b.id === selectedBeneficiaryId);
        if (ben && ben.type === 'collaborator' && ben.dailyRate) {
            const d = parseFloat(daysStr) || 0;
            setNewBill(prev => ({
                ...prev,
                value: Number((ben.dailyRate! * d).toFixed(2))
            }));
        }
    };

    // --- Beneficiary CRUD ---
    const handleSaveBeneficiary = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBen.name) return;

        try {
            const ref = collection(db, `${BASE_PATH}/companies/${companyId}/beneficiaries`);
            const payload = {
                name: editingBen.name,
                type: editingBen.type || 'collaborator',
                roleOrCategory: editingBen.roleOrCategory || '',
                phone: editingBen.phone || '',
                pixKey: editingBen.pixKey || '',
                dailyRate: editingBen.type === 'collaborator' && editingBen.dailyRate ? Number(editingBen.dailyRate) : null
            };

            if (editingBen.id) {
                await updateDoc(doc(ref, editingBen.id), payload);
            } else {
                const newId = crypto.randomUUID();
                await setDoc(doc(ref, newId), { ...payload, id: newId });
            }
            setIsBenModalOpen(false);
            setEditingBen({ type: 'collaborator', name: '', roleOrCategory: '', phone: '', pixKey: '', dailyRate: undefined });
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar beneficiário.");
        }
    };

    const handleDeleteBeneficiary = async (id: string) => {
        if (confirm('Deseja realmente excluir este beneficiário?')) {
            await deleteDoc(doc(db, `${BASE_PATH}/companies/${companyId}/beneficiaries`, id));
        }
    };

    // --- File Handling Helpers ---

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFileName(file.name);
            setIsCompressing(true);
            try {
                const base64 = await compressImage(file);
                setFileData(base64);
            } catch (error) {
                console.error("Erro ao processar imagem", error);
                alert("Erro ao processar arquivo.");
                setFileName('');
            }
            setIsCompressing(false);
        }
    };

    const openBase64AsBlob = (base64Data?: string) => {
        if (!base64Data) return alert("Arquivo não disponível.");
        
        fetch(base64Data)
            .then(res => res.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                const newWindow = window.open(blobUrl, '_blank');
                if (!newWindow) alert("Pop-up bloqueado. Permita pop-ups para ver o arquivo.");
            })
            .catch(e => {
                console.error(e);
                alert("Erro ao abrir arquivo.");
            });
    };

    // --- Submit ---

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBill.supplier || !newBill.value || !newBill.dueDate) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, `${BASE_PATH}/companies/${companyId}/bills`), {
                ...newBill,
                restaurantId,
                value: Number(newBill.value),
                fileName: fileName || null,
                fileData: fileData || null,
                status: 'pending',
                createdAt: Timestamp.now(),
                createdBy: userName
            });

            setNewBill({
                supplier: '',
                value: undefined,
                paymentMethod: 'boleto',
                pixKey: '',
                dueDate: new Date().toISOString().split('T')[0]
            });
            setSelectedBeneficiaryId('');
            setDaysWorked('1');
            setFileName('');
            setFileData(null);
            alert("Conta enviada com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar conta. O arquivo pode ser muito grande.");
        }
        setIsSubmitting(false);
    };

    const triggerCamera = () => { if (cameraInputRef.current) cameraInputRef.current.click(); };
    const triggerFile = () => { if (fileInputRef.current) fileInputRef.current.click(); };

    const selectedBenObj = beneficiaries.find(b => b.id === selectedBeneficiaryId);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-r-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-purple-900">ADM / Financeiro</h2>
                    <p className="text-purple-700 font-medium text-lg">{restaurantName}</p>
                    <p className="text-sm text-purple-600 mt-1">Operador: {userName}</p>
                </div>
                <div className="flex bg-white p-1 rounded-lg border shadow-sm">
                    <button
                        type="button"
                        onClick={() => setActiveTab('launch')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'launch' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <DollarSign className="w-4 h-4" /> Lançar Contas
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('beneficiaries')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'beneficiaries' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Users className="w-4 h-4" /> Beneficiários ({beneficiaries.length})
                    </button>
                </div>
            </div>

            {activeTab === 'launch' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Form */}
                    <Card title="Lançar Conta a Pagar">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="bg-purple-50/70 p-3 rounded-lg border border-purple-100 space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-purple-800 uppercase tracking-wider">Selecionar Beneficiário Cadastrado</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingBen({ type: 'collaborator', name: '', roleOrCategory: '', phone: '', pixKey: '', dailyRate: undefined });
                                            setIsBenModalOpen(true);
                                        }}
                                        className="text-xs text-purple-700 hover:underline font-bold flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Novo Cadastro
                                    </button>
                                </div>
                                <Select
                                    value={selectedBeneficiaryId}
                                    onChange={e => handleSelectBeneficiary(e.target.value)}
                                >
                                    <option value="">-- Escolha para preencher automático (ou digite abaixo) --</option>
                                    {beneficiaries.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} ({b.type === 'collaborator' ? `Colab. - ${b.roleOrCategory || 'Geral'}` : `Forn. - ${b.roleOrCategory || 'Geral'}`})
                                        </option>
                                    ))}
                                </Select>

                                {selectedBenObj && selectedBenObj.type === 'collaborator' && selectedBenObj.dailyRate && (
                                    <div className="flex items-center justify-between bg-white p-2 rounded border border-purple-200 text-sm">
                                        <span className="text-purple-900 font-medium">
                                            Diária: <strong>R$ {Number(selectedBenObj.dailyRate).toFixed(2)}</strong>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 font-bold">Qtd Diárias:</label>
                                            <input
                                                type="number"
                                                min="0.5"
                                                step="0.5"
                                                value={daysWorked}
                                                onChange={e => handleDaysChange(e.target.value)}
                                                className="w-16 px-2 py-1 border rounded text-center font-bold text-purple-900"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Input 
                                label="Fornecedor / Favorecido" 
                                placeholder="Ex: Distribuidora Silva ou Nome do Colaborador"
                                value={newBill.supplier} 
                                onChange={e => setNewBill(p => ({...p, supplier: e.target.value}))}
                                required
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Valor (R$)" 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00"
                                    value={newBill.value || ''}
                                    onChange={e => setNewBill(p => ({...p, value: e.target.value as any}))}
                                    required
                                />
                                <Input 
                                    label="Vencimento" 
                                    type="date" 
                                    value={newBill.dueDate}
                                    onChange={e => setNewBill(p => ({...p, dueDate: e.target.value}))}
                                    required
                                />
                            </div>

                            <Select 
                                label="Forma de Pagamento" 
                                value={newBill.paymentMethod}
                                onChange={e => setNewBill(p => ({...p, paymentMethod: e.target.value as any}))}
                            >
                                <option value="boleto">Boleto Bancário</option>
                                <option value="pix">PIX</option>
                                <option value="dinheiro">Dinheiro / Espécie</option>
                            </Select>

                            {newBill.paymentMethod === 'pix' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <Input 
                                        label="Chave PIX" 
                                        placeholder="CPF, CNPJ, Email, Celular ou Aleatória"
                                        value={newBill.pixKey}
                                        onChange={e => setNewBill(p => ({...p, pixKey: e.target.value}))}
                                        className="border-purple-300 ring-purple-200"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Anexar Comprovante / Nota</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button" 
                                        onClick={triggerCamera}
                                        className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-purple-700 font-medium"
                                    >
                                        <Camera className="w-6 h-6" />
                                        Fotografar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={triggerFile}
                                        className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 font-medium"
                                    >
                                        <Upload className="w-6 h-6" />
                                        Arquivo
                                    </button>
                                </div>
                                
                                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" />
                                <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

                                {isCompressing && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Processando imagem...
                                    </div>
                                )}

                                {!isCompressing && fileName && (
                                    <div className="text-sm text-green-600 flex items-center gap-2 mt-2 bg-green-50 p-2 rounded border border-green-200">
                                        <CheckCircle className="w-4 h-4" />
                                        Anexo: {fileName}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" isLoading={isSubmitting} disabled={isCompressing} className="w-full bg-purple-600 hover:bg-purple-700">
                                Enviar para Pagamento <Plus className="w-4 h-4" />
                            </Button>
                        </form>
                    </Card>

                    {/* History List */}
                    <Card title="Histórico Recente">
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                            {bills.length === 0 ? (
                                <p className="text-center text-gray-400 py-10">Nenhuma conta lançada.</p>
                            ) : (
                                bills.map(bill => (
                                    <div key={bill.id} className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-gray-800">{bill.supplier}</div>
                                            <div className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {bill.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {bill.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="w-3 h-3" />
                                                <span className="font-semibold">R$ {Number(bill.value || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>{(bill.dueDate && !isNaN(new Date(bill.dueDate).getTime())) ? new Date(bill.dueDate).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                            </div>
                                        </div>

                                        {bill.pixKey && (
                                            <div className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                                PIX: <strong>{bill.pixKey}</strong>
                                            </div>
                                        )}

                                        <div className="text-xs text-gray-500 border-t pt-2 mt-1 flex justify-between items-center">
                                            <span>{(bill.paymentMethod || 'N/A').toUpperCase()}</span>
                                            <div className="flex gap-2">
                                                {bill.fileData && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => openBase64AsBlob(bill.fileData)}
                                                        className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                                                    >
                                                        <Eye className="w-3 h-3" /> Ver Anexo
                                                    </button>
                                                )}
                                                {bill.receiptFileData && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => openBase64AsBlob(bill.receiptFileData)}
                                                        className="flex items-center gap-1 text-green-600 hover:underline cursor-pointer font-bold"
                                                    >
                                                        <CheckCircle className="w-3 h-3" /> Recibo
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Cadastro de Beneficiários</h3>
                            <p className="text-sm text-gray-500">Cadastre colaboradores e fornecedores para agilizar o lançamento com PIX e diárias.</p>
                        </div>
                        <Button
                            onClick={() => {
                                setEditingBen({ type: 'collaborator', name: '', roleOrCategory: '', phone: '', pixKey: '', dailyRate: undefined });
                                setIsBenModalOpen(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Novo Beneficiário
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {beneficiaries.length === 0 ? (
                            <p className="col-span-2 text-center text-gray-400 py-10 bg-white rounded-lg border">Nenhum beneficiário cadastrado ainda.</p>
                        ) : (
                            beneficiaries.map(b => (
                                <Card key={b.id} className={`border-l-4 ${b.type === 'collaborator' ? 'border-l-purple-500' : 'border-l-blue-500'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-800 text-lg">{b.name}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${b.type === 'collaborator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {b.type === 'collaborator' ? 'Colaborador' : 'Fornecedor'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{b.type === 'collaborator' ? 'Função:' : 'Tipo:'} <strong>{b.roleOrCategory || 'N/A'}</strong></span>
                                            </p>
                                            {b.phone && (
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                    <span>{b.phone}</span>
                                                </p>
                                            )}
                                            {b.pixKey && (
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <Key className="w-3.5 h-3.5 text-purple-500" />
                                                    <span>PIX: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{b.pixKey}</code></span>
                                                </p>
                                            )}
                                            {b.type === 'collaborator' && b.dailyRate && (
                                                <p className="text-sm text-green-700 font-bold pt-1">
                                                    Valor da Diária: R$ {Number(b.dailyRate).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setEditingBen(b); setIsBenModalOpen(true); }}
                                                className="p-1.5 hover:bg-gray-100 rounded text-blue-600"
                                                title="Editar"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBeneficiary(b.id)}
                                                className="p-1.5 hover:bg-gray-100 rounded text-red-500"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Cadastro de Beneficiário */}
            <Modal
                isOpen={isBenModalOpen}
                onClose={() => setIsBenModalOpen(false)}
                title={editingBen.id ? 'Editar Beneficiário' : 'Novo Beneficiário'}
            >
                <form onSubmit={handleSaveBeneficiary} className="space-y-4">
                    <Select
                        label="Tipo de Cadastro"
                        value={editingBen.type || 'collaborator'}
                        onChange={e => setEditingBen(p => ({ ...p, type: e.target.value as 'collaborator' | 'supplier' }))}
                    >
                        <option value="collaborator">Colaborador (Diarista / Funcionário)</option>
                        <option value="supplier">Fornecedor / Prestador de Serviço</option>
                    </Select>

                    <Input
                        label="Nome Completo / Razão Social"
                        placeholder="Ex: João da Silva ou Gás Express"
                        value={editingBen.name || ''}
                        onChange={e => setEditingBen(p => ({ ...p, name: e.target.value }))}
                        required
                    />

                    <Input
                        label={editingBen.type === 'collaborator' ? 'Função' : 'Tipo de Fornecedor'}
                        placeholder={editingBen.type === 'collaborator' ? 'Ex: Cozinheiro, Garçom, Segurança' : 'Ex: Bebidas, Manutenção, Hortifruti'}
                        value={editingBen.roleOrCategory || ''}
                        onChange={e => setEditingBen(p => ({ ...p, roleOrCategory: e.target.value }))}
                        required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Telefone / WhatsApp"
                            placeholder="Ex: (11) 99999-9999"
                            value={editingBen.phone || ''}
                            onChange={e => setEditingBen(p => ({ ...p, phone: e.target.value }))}
                        />
                        <Input
                            label="Número / Chave do PIX"
                            placeholder="CPF, CNPJ, Celular, Email..."
                            value={editingBen.pixKey || ''}
                            onChange={e => setEditingBen(p => ({ ...p, pixKey: e.target.value }))}
                            required
                        />
                    </div>

                    {editingBen.type === 'collaborator' && (
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <Input
                                label="Valor da Diária (R$)"
                                type="number"
                                step="0.01"
                                placeholder="Ex: 120.00"
                                value={editingBen.dailyRate || ''}
                                onChange={e => setEditingBen(p => ({ ...p, dailyRate: e.target.value as any }))}
                            />
                            <p className="text-xs text-purple-700 mt-1">
                                Ao selecionar este colaborador no lançamento, o valor da diária e o PIX serão preenchidos automaticamente.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsBenModalOpen(false)} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">
                            Salvar Cadastro
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AdmView;
