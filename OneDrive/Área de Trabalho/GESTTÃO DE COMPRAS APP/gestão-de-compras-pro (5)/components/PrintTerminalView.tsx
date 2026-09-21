import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db, BASE_PATH } from '../services/firebaseConfig';
import { PrintJob } from '../types';
import { Printer, Loader2, CheckCircle } from 'lucide-react';
import { Card } from './UI';

interface Props {
    companyId: string;
}

export const PrintTerminalView: React.FC<Props> = ({ companyId }) => {
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!companyId) return;
        
        const q = query(
            collection(db, `${BASE_PATH}/companies/${companyId}/print_jobs`),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newJobs: PrintJob[] = [];
            snapshot.forEach(doc => {
                newJobs.push({ id: doc.id, ...doc.data() } as PrintJob);
            });
            setJobs(newJobs);
        });

        return () => unsubscribe();
    }, [companyId]);

    useEffect(() => {
        const processNextJob = async () => {
            if (jobs.length === 0 || isPrinting) return;
            
            const job = jobs[0];
            setIsPrinting(true);
            
            try {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    const printDoc = iframeRef.current.contentWindow.document;
                    printDoc.open();
                    printDoc.write(job.htmlContent);
                    printDoc.close();

                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    iframeRef.current.contentWindow.focus();
                    iframeRef.current.contentWindow.print();
                    
                    // Mark as done after issuing print command
                    await updateDoc(doc(db, `${BASE_PATH}/companies/${companyId}/print_jobs`, job.id), {
                        status: 'completed'
                    });
                }
            } catch (err) {
                console.error("Erro ao imprimir job", job.id, err);
            } finally {
                // Remove the job from the local queue to process the next one immediately 
                // in case onSnapshot hasn't updated yet.
                setJobs(prev => prev.filter(j => j.id !== job.id));
                setIsPrinting(false);
            }
        };

        processNextJob();
    }, [jobs, isPrinting, companyId]);

    return (
        <div className="flex items-center justify-center min-h-[50vh] bg-gray-50 rounded-xl border-2 border-dashed p-6">
            <Card className="w-full max-w-lg shadow-lg text-center p-8">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Printer className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Terminal de Impressão</h2>
                <p className="text-gray-500 mb-8">
                    Deixe esta janela aberta. As etiquetas enviadas pelo celular da equipe serão impressas automaticamente aqui.
                </p>

                {jobs.length > 0 || isPrinting ? (
                    <div className="flex flex-col items-center gap-3 text-blue-600 font-bold p-4 bg-blue-50 rounded-lg">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span>Imprimindo {jobs.length} etiqueta(s) pendente(s)...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-green-600 font-bold p-4 bg-green-50 rounded-lg border border-green-100">
                        <CheckCircle className="w-8 h-8" />
                        <span>Aguardando novos pedidos...</span>
                    </div>
                )}
            </Card>
            
            <iframe 
                ref={iframeRef} 
                style={{ position: 'absolute', width: '0', height: '0', border: 'none', right: 0, bottom: 0 }} 
                title="Print Frame"
            />
        </div>
    );
};
