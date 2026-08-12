
import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, orderBy, Timestamp, limit } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { Bill } from '../types';
import { Button, Input, Select, Card } from '../components/UI';
import { Plus, DollarSign, Calendar, Upload, FileText, CheckCircle, Clock, Camera, Loader2, Eye } from 'lucide-react';

interface Props {
    companyId: string;
    restaurantId: string;
    restaurantName: string;
    userName: string;
}

const AdmView: React.FC<Props> = ({ companyId, restaurantId, restaurantName, userName }) => {
    const [bills, setBills] = useState<Bill[]>([]);
    const [newBill, setNewBill] = useState<Partial<Bill>>({
        supplier: '',
        value: undefined,
        paymentMethod: 'boleto',
        pixKey: '',
        dueDate: new Date().toISOString().split('T')[0]
    });
    const [fileName, setFileName] = useState('');
    const [fileData, setFileData] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    
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

        return () => unsub();
    }, [companyId, restaurantId]);

    // --- File Handling Helpers ---

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            // Se for PDF, não comprime, apenas converte
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
                    const MAX_WIDTH = 1024; // Redimensiona para HD (leve)
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
                    
                    // Comprime para JPEG 70%
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
                fileData: fileData || null, // Salva o Base64
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

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-r-lg">
                <h2 className="text-2xl font-bold text-purple-900">ADM / Financeiro</h2>
                <p className="text-purple-700 font-medium text-lg">{restaurantName}</p>
                <p className="text-sm text-purple-600 mt-1">Operador: {userName}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form */}
                <Card title="Lançar Conta a Pagar">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            label="Fornecedor / Favorecido" 
                            placeholder="Ex: Distribuidora Silva"
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
                                    placeholder="CPF, CNPJ, Email ou Celular"
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
                            
                            {/* Inputs Ocultos */}
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
        </div>
    );
};

export default AdmView;
