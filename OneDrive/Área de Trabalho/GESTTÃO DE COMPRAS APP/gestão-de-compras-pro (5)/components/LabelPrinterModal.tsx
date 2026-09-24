import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from './UI';
import { Printer } from 'lucide-react';

import { AppConfig, LabelTemplate } from '../types';
import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { Save } from 'lucide-react';

interface LabelPrinterModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProductName?: string;
    config?: AppConfig;
    companyId?: string;
    canSaveTemplate?: boolean;
}

export const LabelPrinterModal: React.FC<LabelPrinterModalProps> = ({ isOpen, onClose, initialProductName, config, companyId, canSaveTemplate }) => {
    const [productName, setProductName] = useState('');
    const [manufactureDate, setManufactureDate] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [responsible, setResponsible] = useState('');
    const [validityDays, setValidityDays] = useState<number | ''>('');
    const [copies, setCopies] = useState<number>(1);
    const [storageForm, setStorageForm] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [observations, setObservations] = useState('');
    
    // Templates
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setProductName(initialProductName || '');
            const today = new Date().toISOString().split('T')[0];
            setManufactureDate(today);
            setExpirationDate('');
            setValidityDays('');
            setStorageForm('');
            setIngredients('');
            setObservations('');
            setSelectedTemplateId('');
            setResponsible(localStorage.getItem('userName') || ''); // Attempt to prefill if stored somewhere, else empty
            
            // Try to auto-select template if name matches exactly
            if (initialProductName && config?.labelTemplates) {
                const match = config.labelTemplates.find(t => t.name.toLowerCase() === initialProductName.toLowerCase());
                if (match) {
                    handleSelectTemplate(match);
                }
            }
        }
    }, [isOpen, initialProductName, config]);

    const handleSelectTemplate = (template: LabelTemplate) => {
        setSelectedTemplateId(template.id);
        setProductName(template.name);
        setValidityDays(template.validityDays);
        setStorageForm(template.storageForm || '');
        setIngredients(template.ingredients || '');
        setObservations(template.observations || '');
        
        const today = new Date().toISOString().split('T')[0];
        setManufactureDate(today);
        
        if (template.validityDays > 0) {
            const date = new Date(today);
            date.setDate(date.getDate() + template.validityDays);
            setExpirationDate(date.toISOString().split('T')[0]);
        }
    };

    const handleProductNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setProductName(val);
        if (config?.labelTemplates) {
            const match = config.labelTemplates.find(t => t.name.toLowerCase() === val.toLowerCase());
            if (match) {
                handleSelectTemplate(match);
            }
        }
    };


    const handleSaveTemplate = async () => {
        if (!config || !companyId || !productName || !validityDays) {
            alert('Preencha o nome do produto e a validade (dias) para salvar o template.');
            return;
        }
        
        try {
            const newTemplate: LabelTemplate = {
                id: crypto.randomUUID(),
                name: productName,
                validityDays: Number(validityDays),
                storageForm,
                ingredients,
                observations
            };
            
            await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/app_config`, 'main'), {
                labelTemplates: arrayUnion(newTemplate)
            });
            
            alert('Template salvo com sucesso!');
            setSelectedTemplateId(newTemplate.id);
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar template.');
        }
    };

    // Calculate expiration date based on validity days
    useEffect(() => {
        if (manufactureDate && typeof validityDays === 'number') {
            const date = new Date(manufactureDate);
            date.setDate(date.getDate() + validityDays);
            setExpirationDate(date.toISOString().split('T')[0]);
        }
    }, [validityDays, manufactureDate]);

    const handlePrint = async (printDetailed: boolean) => {
        // Formata as datas para o padrão brasileiro (DD/MM/YYYY)
        const formatBR = (dateStr: string) => {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        };

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiqueta - ${productName}</title>
                <style>
                    /* Tamanho padrão de etiqueta de cozinha (ex: 60x40mm) */
                    @page {
                        margin: 0;
                        size: 60mm 40mm;
                    }
                    body {
                        margin: 0;
                        background: #fff;
                    }
                    .page {
                        margin: 0;
                        padding: 4px;
                        font-family: Arial, sans-serif;
                        font-size: 10px;
                        color: #000;
                        background: #fff;
                        width: 58mm;
                        height: 38mm;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-after: always;
                    }
                    .title {
                        font-size: 12px;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 4px;
                        border-bottom: 1px solid #000;
                        padding-bottom: 2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 2px;
                    }
                    .label {
                        font-weight: bold;
                    }
                    .value {
                        text-align: right;
                    }
                    .footer {
                        font-size: 8px;
                        text-align: center;
                        border-top: 1px dashed #000;
                        padding-top: 2px;
                        margin-top: 4px;
                    }
                </style>
            </head>
            <body>
                ${Array(copies).fill(`
                <div class="page">
                    <div class="title">${productName.toUpperCase()}</div>
                    
                    <div class="row">
                        <span class="label">FABRIC.:</span>
                        <span class="value">${formatBR(manufactureDate)}</span>
                    </div>
                    
                    <div class="row">
                        <span class="label">VALID.:</span>
                        <span class="value">${formatBR(expirationDate)}</span>
                    </div>
                    
                    <div class="row">
                        <span class="label">RESP.:</span>
                        <span class="value">${responsible.toUpperCase()}</span>
                    </div>
                    
                    ${printDetailed && storageForm ? `
                    <div class="row">
                        <span class="label">ARMAZ.:</span>
                        <span class="value" style="font-size: 9px;">${storageForm}</span>
                    </div>
                    ` : ''}

                    ${printDetailed && ingredients ? `
                    <div style="font-size: 8px; margin-top: 2px; line-height: 1;">
                        <span class="label">INGR.:</span> ${ingredients}
                    </div>
                    ` : ''}

                    ${printDetailed && observations ? `
                    <div style="font-size: 8px; margin-top: 2px; line-height: 1;">
                        <span class="label">OBS.:</span> ${observations}
                    </div>
                    ` : ''}
                    
                    <div class="footer">
                        USO INTERNO
                    </div>
                </div>
                `).join('\n')}
            </body>
            </html>
        `;

        if (config?.useRemotePrinter && companyId) {
            try {
                await addDoc(collection(db, `${BASE_PATH}/companies/${companyId}/print_jobs`), {
                    htmlContent: html,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    createdBy: responsible
                });
                alert('Etiqueta enviada para o Servidor de Impressão Remota com sucesso!');
            } catch (e) {
                console.error(e);
                alert('Erro ao enviar etiqueta para o servidor de impressão.');
            }
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const printDoc = iframe.contentWindow?.document;
        if (printDoc) {
            printDoc.open();
            printDoc.write(html);
            printDoc.close();
            
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 300);
        } else {
            alert('Erro ao gerar impressão da etiqueta.');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Etiqueta de Validade">
            <div className="space-y-4">
                {config?.labelTemplates && (
                    <datalist id="templates-datalist">
                        {config.labelTemplates.map(t => (
                            <option key={t.id} value={t.name} />
                        ))}
                    </datalist>
                )}
                
                <Input 
                    label="Produto / Receita" 
                    value={productName} 
                    onChange={handleProductNameChange} 
                    placeholder="Ex: Molho de Tomate"
                    list="templates-datalist"
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                        type="date"
                        label="Data de Fabricação" 
                        value={manufactureDate} 
                        onChange={e => setManufactureDate(e.target.value)} 
                    />
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Validade (Dias)</label>
                        <input 
                            type="number"
                            min="1"
                            value={validityDays}
                            onChange={e => setValidityDays(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                        type="date"
                        label="Data de Validade (Cálculo)" 
                        value={expirationDate} 
                        onChange={e => setExpirationDate(e.target.value)} 
                    />
                    <Input 
                        label="Responsável" 
                        value={responsible} 
                        onChange={e => setResponsible(e.target.value)} 
                        placeholder="Iniciais ou Nome"
                    />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    <Input 
                        label="Forma de Armazenamento" 
                        value={storageForm} 
                        onChange={e => setStorageForm(e.target.value)} 
                        placeholder="Ex: Geladeira (4°C), Freezer, etc"
                    />
                    <Input 
                        label="Ingredientes (opcional)" 
                        value={ingredients} 
                        onChange={e => setIngredients(e.target.value)} 
                        placeholder="Ex: Tomate, cebola, alho..."
                    />
                    <Input 
                        label="Observações (opcional)" 
                        value={observations} 
                        onChange={e => setObservations(e.target.value)} 
                        placeholder="Ex: Sem glúten, etc."
                    />
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                        {canSaveTemplate && (
                            <Button variant="outline" onClick={handleSaveTemplate} disabled={!productName || !validityDays || !config}>
                                <Save className="w-4 h-4 mr-2" /> Salvar Template
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap justify-end items-center gap-2">
                        <div className="flex items-center gap-2 mr-2">
                            <label className="text-sm text-gray-700 font-medium">Cópias:</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={copies} 
                                onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-center focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button 
                            variant="secondary"
                            onClick={() => handlePrint(false)}
                            disabled={!productName || !manufactureDate || !expirationDate}
                        >
                            <Printer className="w-4 h-4" />
                            Simples
                        </Button>
                        <Button 
                            onClick={() => handlePrint(true)}
                            disabled={!productName || !manufactureDate || !expirationDate}
                        >
                            <Printer className="w-4 h-4" />
                            Completa
                        </Button>
                    </div>
                    <div className="flex justify-end w-full">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            Status do Destino: {config?.useRemotePrinter ? <span className="text-green-600 font-bold">Terminal Remoto (Nuvem)</span> : <span className="text-blue-600 font-bold">Impressora do Celular</span>}
                        </span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};



