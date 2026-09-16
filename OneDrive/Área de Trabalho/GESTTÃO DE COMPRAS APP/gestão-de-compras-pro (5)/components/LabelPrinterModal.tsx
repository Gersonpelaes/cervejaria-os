import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from './UI';
import { Printer } from 'lucide-react';

interface LabelPrinterModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProductName?: string;
}

export const LabelPrinterModal: React.FC<LabelPrinterModalProps> = ({ isOpen, onClose, initialProductName }) => {
    const [productName, setProductName] = useState('');
    const [manufactureDate, setManufactureDate] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [responsible, setResponsible] = useState('');
    const [validityDays, setValidityDays] = useState<number | ''>('');

    useEffect(() => {
        if (isOpen) {
            setProductName(initialProductName || '');
            const today = new Date().toISOString().split('T')[0];
            setManufactureDate(today);
            setExpirationDate('');
            setValidityDays('');
            setResponsible(localStorage.getItem('userName') || ''); // Attempt to prefill if stored somewhere, else empty
        }
    }, [isOpen, initialProductName]);

    // Calculate expiration date based on validity days
    useEffect(() => {
        if (manufactureDate && typeof validityDays === 'number') {
            const date = new Date(manufactureDate);
            date.setDate(date.getDate() + validityDays);
            setExpirationDate(date.toISOString().split('T')[0]);
        }
    }, [validityDays, manufactureDate]);

    const handlePrint = () => {
        // Formata as datas para o padrão brasileiro (DD/MM/YYYY)
        const formatBR = (dateStr: string) => {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        };

        const printWindow = window.open('', '_blank', 'width=400,height=400');
        if (!printWindow) {
            alert('Por favor, permita pop-ups para imprimir a etiqueta.');
            return;
        }

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
                        font-size: 11px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 9px;
                        margin-top: 2px;
                        border-top: 1px dotted #000;
                        padding-top: 2px;
                    }
                </style>
            </head>
            <body>
                <div class="title">${productName.toUpperCase()}</div>
                
                <div class="row">
                    <span class="label">FABRIC.:</span>
                    <span class="value">${formatBR(manufactureDate)}</span>
                </div>
                
                <div class="row">
                    <span class="label">VALID.:</span>
                    <span class="value" style="font-weight:bold;">${formatBR(expirationDate)}</span>
                </div>

                <div class="row">
                    <span class="label">RESP.:</span>
                    <span class="value">${responsible.toUpperCase()}</span>
                </div>
                
                <div class="footer">
                    USO INTERNO
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Etiqueta de Validade">
            <div className="space-y-4">
                <Input 
                    label="Produto / Receita" 
                    value={productName} 
                    onChange={e => setProductName(e.target.value)} 
                    placeholder="Ex: Molho de Tomate"
                />
                
                <div className="grid grid-cols-2 gap-4">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="Ex: 3"
                            value={validityDays}
                            onChange={e => setValidityDays(e.target.value ? parseInt(e.target.value) : '')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        type="date"
                        label="Data de Validade" 
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

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button 
                        onClick={handlePrint}
                        disabled={!productName || !manufactureDate || !expirationDate}
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir Etiqueta
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
