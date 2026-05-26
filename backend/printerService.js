import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'printer_config.json');
const REST_CONFIG_FILE = path.join(__dirname, 'restaurant_config.json');

const DEFAULT_CONFIG = {
  autoPrint: false,
  printPreBillAlwaysAsk: true,
  printCheckoutAlwaysAsk: true,
  printRegisterCloseEnabled: true,
  sectors: {
    CAIXA: { type: 'SIMULATOR', interface: '' },
    COZINHA: { type: 'SIMULATOR', interface: '' },
    BAR: { type: 'SIMULATOR', interface: '' }
  }
};

// Carregar ou criar configuração padrão
export function getPrinterConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(data);
      // Garante retrocompatibilidade se for o formato antigo
      if (parsed.type && !parsed.sectors) {
        return {
          ...DEFAULT_CONFIG,
          autoPrint: parsed.autoPrint !== undefined ? parsed.autoPrint : false,
          sectors: {
            CAIXA: { type: parsed.type, interface: parsed.interface || '' },
            COZINHA: { type: 'SIMULATOR', interface: '' },
            BAR: { type: 'SIMULATOR', interface: '' }
          }
        };
      }
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        sectors: {
          ...DEFAULT_CONFIG.sectors,
          ...(parsed.sectors || {})
        }
      };
    }
  } catch (err) {
    console.error("Erro ao carregar printer_config.json:", err);
  }
  return DEFAULT_CONFIG;
}

export function savePrinterConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error("Erro ao salvar printer_config.json:", err);
    return { success: false, error: err.message };
  }
}

export function getRestaurantConfig() {
  try {
    if (fs.existsSync(REST_CONFIG_FILE)) {
      const data = fs.readFileSync(REST_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Erro ao carregar restaurant_config.json:", err);
  }
  return {
    name: "CERVEJARIA OS",
    address: "Rua das Cervejas, 123 - Centro",
    phone: "(11) 99999-9999",
    footerMessage: "Obrigado pela preferência! Volte sempre!",
    defaultServiceFee: 10,
    defaultCouvert: 0,
    defaultDeliveryFee: 7
  };
}

export function saveRestaurantConfig(config) {
  try {
    fs.writeFileSync(REST_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error("Erro ao salvar restaurant_config.json:", err);
    return { success: false, error: err.message };
  }
}

// Auxiliares de formatação de string (42 colunas)
const COLS = 42;

function padRight(str, len) {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  return ' '.repeat(len - str.length) + str;
}

function formatCenter(text, width = COLS) {
  text = String(text);
  if (text.length >= width) return text.substring(0, width);
  const leftSpaces = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftSpaces) + text;
}

function formatLeftRight(leftText, rightText, width = COLS) {
  leftText = String(leftText);
  rightText = String(rightText);
  const totalLen = leftText.length + rightText.length;
  if (totalLen >= width) {
    // Se estourar a largura, corta o texto da esquerda
    const maxLeftLen = width - rightText.length - 1;
    leftText = leftText.substring(0, maxLeftLen);
  }
  const spaces = width - leftText.length - rightText.length;
  return leftText + ' '.repeat(spaces) + rightText;
}

function formatLineBreak(text, width = COLS) {
  // Quebra um texto longo em linhas de tamanho fixo
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatDate(date) {
  const d = new Date(date);
  const day = padLeft(d.getDate(), 2);
  const month = padLeft(d.getMonth() + 1, 2);
  const year = d.getFullYear();
  const hours = padLeft(d.getHours(), 2);
  const minutes = padLeft(d.getMinutes(), 2);
  const seconds = padLeft(d.getSeconds(), 2);
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Serviço de envio real ou simulado por setores com fallback para Simulador
export async function sendPrintJob(receiptText, sector = 'CAIXA') {
  const config = getPrinterConfig();
  
  // Se a autoPrint estiver desativada globalmente, age sempre como Simulador
  if (!config.autoPrint) {
    console.log(`[PrinterService] Impressão Automática Desabilitada. Simulação para o setor ${sector}.`);
    return { success: true, mode: 'SIMULATOR', text: receiptText };
  }

  const sectorConfig = config.sectors?.[sector] || { type: 'SIMULATOR', interface: '' };
  console.log(`[PrinterService] Enviando job de impressão para o setor: ${sector}. Tipo: ${sectorConfig.type}`);
  
  if (sectorConfig.type === 'SIMULATOR') {
    return { success: true, mode: 'SIMULATOR', text: receiptText };
  }

  try {
    let printerType = PrinterTypes.EPSON;
    if (sectorConfig.type === 'STAR') {
      printerType = PrinterTypes.STAR;
    }

    const printer = new ThermalPrinter({
      type: printerType,
      interface: sectorConfig.interface,
      removeSpecialCharacters: false,
      options: {
        timeout: 3000
      }
    });

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.warn(`[PrinterService] Impressora física do setor ${sector} configurada mas não conectada.`);
      return { 
        success: false, 
        error: `Impressora do setor ${sector} indisponível na rede.`, 
        mode: 'SIMULATOR', 
        text: receiptText 
      };
    }

    // Envia o texto linha por linha
    const lines = receiptText.split('\n');
    for (const line of lines) {
      printer.println(line);
    }
    printer.cut();
    
    await printer.execute();
    return { success: true, mode: 'PHYSICAL' };
  } catch (error) {
    console.error(`[PrinterService] Erro ao enviar para impressora física do setor ${sector}:`, error);
    return { 
      success: false, 
      error: error.message, 
      mode: 'SIMULATOR', 
      text: receiptText 
    };
  }
}

// ----------------------------------------------------
// GERADORES DE TEXTO DE RECIBOS
// ----------------------------------------------------

// 1. Ticket de Cozinha
export function generateKitchenTicketText(orderOrTable, items) {
  let lines = [];
  lines.push("==========================================");
  
  let headerText = "NOVO PEDIDO - COZINHA";
  let infoLine = "";
  let customerDetails = [];

  if (orderOrTable && typeof orderOrTable === 'object') {
    const type = orderOrTable.type || "MESA";
    if (type === "DELIVERY") {
      headerText = "🛵 TICKET DELIVERY 🛵";
      infoLine = "PEDIDO DELIVERY";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
      if (orderOrTable.customerAddress) {
        customerDetails.push("ENDEREÇO:");
        const addrLines = formatLineBreak(orderOrTable.customerAddress, COLS - 4);
        addrLines.forEach(al => customerDetails.push("  " + al));
      }
    } else if (type === "BALCAO") {
      headerText = "🛍️ TICKET BALCÃO 🛍️";
      infoLine = "PEDIDO BALCÃO";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
    } else {
      headerText = "NOVO PEDIDO - COZINHA";
      infoLine = `MESA: ${orderOrTable.table?.number || "Avulso"}`;
    }
  } else {
    infoLine = `MESA: ${orderOrTable}`;
  }

  lines.push(formatCenter(headerText));
  lines.push("==========================================");
  lines.push(formatLeftRight(infoLine, formatDate(new Date())));
  
  if (customerDetails.length > 0) {
    lines.push("------------------------------------------");
    customerDetails.forEach(cd => lines.push(cd));
  }
  
  lines.push("------------------------------------------");
  
  items.forEach(item => {
    const itemName = item.productName || item.name || (item.product ? item.product.name : "Item");
    lines.push(`${padRight(item.qty + "x", 4)} ${itemName}`);
    if (item.observations) {
      // Formata a observação com quebra de linha se necessário
      const obsLines = formatLineBreak(`* Obs: ${item.observations}`, COLS - 5);
      obsLines.forEach(obs => lines.push("    " + obs));
    }
  });

  lines.push("------------------------------------------");
  lines.push(formatCenter("Produzir em ordem de chegada"));
  lines.push("==========================================");
  lines.push("\n\n\n");
  
  return lines.join('\n');
}

// 2. Pré-conta / Conferência
export function generateCustomerBillText(orderOrTable, items, calculations) {
  const { subtotal, serviceFee, couvert, discount, total, peopleCount, deliveryFee } = calculations;
  const config = getRestaurantConfig();
  
  let lines = [];
  lines.push(formatCenter(config.name || "CERVEJARIA OS"));
  if (config.address) {
    const addrLines = formatLineBreak(config.address, COLS);
    addrLines.forEach(l => lines.push(formatCenter(l)));
  }
  if (config.phone) {
    lines.push(formatCenter(`Tel: ${config.phone}`));
  }
  lines.push("==========================================");
  
  let headerText = "CONFERENCIA DE CONTA";
  let infoLine = "";
  let customerDetails = [];

  if (orderOrTable && typeof orderOrTable === 'object') {
    const type = orderOrTable.type || "MESA";
    if (type === "DELIVERY") {
      headerText = "🛵 CONTA DELIVERY 🛵";
      infoLine = "PEDIDO DELIVERY";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
      if (orderOrTable.customerAddress) {
        customerDetails.push("ENDEREÇO DE ENTREGA:");
        const addrLines = formatLineBreak(orderOrTable.customerAddress, COLS - 4);
        addrLines.forEach(al => customerDetails.push("  " + al));
      }
    } else if (type === "BALCAO") {
      headerText = "🛍️ CONTA BALCÃO 🛍️";
      infoLine = "PEDIDO BALCÃO";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
    } else {
      headerText = "CONFERENCIA DE CONTA";
      infoLine = `MESA: ${orderOrTable.table?.number || "Avulso"}`;
    }
  } else {
    infoLine = `MESA: ${orderOrTable}`;
  }

  lines.push(formatCenter(headerText));
  lines.push("==========================================");
  lines.push(formatLeftRight(infoLine, formatDate(new Date())));
  
  if (customerDetails.length > 0) {
    lines.push("------------------------------------------");
    customerDetails.forEach(cd => lines.push(cd));
  }
  
  lines.push("------------------------------------------");
  lines.push("QTD  ITEM                       UNIT TOTAL");
  lines.push("------------------------------------------");

  items.forEach(item => {
    const qtyStr = padRight(item.qty, 4);
    const unitPrice = item.price.toFixed(2);
    const itemTotal = (item.price * item.qty).toFixed(2);
    
    // Nome do item (limita a 20 chars para caber na tabela)
    const itemName = item.productName || item.name || (item.product ? item.product.name : "Item");
    const nameStr = padRight(itemName.substring(0, 20), 20);
    const unitStr = padLeft(unitPrice, 7);
    const totalStr = padLeft(itemTotal, 9);
    
    lines.push(`${qtyStr}${nameStr}${unitStr}${totalStr}`);
    
    if (item.observations) {
      lines.push(`    * ${item.observations}`);
    }
  });

  lines.push("------------------------------------------");
  lines.push(formatLeftRight("Subtotal:", `R$ ${subtotal.toFixed(2)}`));
  if (serviceFee > 0) {
    lines.push(formatLeftRight(`Taxa de Servico (${config.defaultServiceFee}%):`, `R$ ${serviceFee.toFixed(2)}`));
  }
  
  const dFee = Number(deliveryFee) || 0;
  if (dFee > 0) {
    lines.push(formatLeftRight("Taxa de Entrega:", `R$ ${dFee.toFixed(2)}`));
  }

  if (couvert > 0) {
    lines.push(formatLeftRight("Couvert Artistico:", `R$ ${couvert.toFixed(2)}`));
  }
  if (discount > 0) {
    lines.push(formatLeftRight("Desconto:", `-R$ ${discount.toFixed(2)}`));
  }
  lines.push("------------------------------------------");
  lines.push(formatLeftRight("TOTAL:", `R$ ${total.toFixed(2)}`));
  
  const pCount = Number(peopleCount) || 1;
  if (pCount > 1) {
    const perPerson = total / pCount;
    lines.push("------------------------------------------");
    lines.push(formatLeftRight(`Dividido por ${pCount} pessoas:`, `R$ ${perPerson.toFixed(2)}`));
  }
  
  lines.push("==========================================");
  lines.push(formatCenter("Este documento nao e cupom fiscal"));
  if (config.footerMessage) {
    const footerLines = formatLineBreak(config.footerMessage, COLS);
    footerLines.forEach(l => lines.push(formatCenter(l)));
  }
  lines.push("==========================================");
  lines.push("\n\n\n");
  
  return lines.join('\n');
}

// 3. Recibo de Venda / Pagamento
export function generatePaymentReceiptText(orderOrTable, items, payments, calculations) {
  const { subtotal, serviceFee, couvert, discount, total, deliveryFee } = calculations;
  const config = getRestaurantConfig();
  
  let lines = [];
  lines.push(formatCenter(config.name || "CERVEJARIA OS"));
  if (config.address) {
    const addrLines = formatLineBreak(config.address, COLS);
    addrLines.forEach(l => lines.push(formatCenter(l)));
  }
  if (config.phone) {
    lines.push(formatCenter(`Tel: ${config.phone}`));
  }
  lines.push("==========================================");
  
  let headerText = "RECIBO DE PAGAMENTO";
  let infoLine = "";
  let customerDetails = [];

  if (orderOrTable && typeof orderOrTable === 'object') {
    const type = orderOrTable.type || "MESA";
    if (type === "DELIVERY") {
      headerText = "🛵 RECIBO DELIVERY 🛵";
      infoLine = "PEDIDO DELIVERY";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
      if (orderOrTable.customerAddress) {
        customerDetails.push("ENDEREÇO DE ENTREGA:");
        const addrLines = formatLineBreak(orderOrTable.customerAddress, COLS - 4);
        addrLines.forEach(al => customerDetails.push("  " + al));
      }
      if (orderOrTable.driver) {
        customerDetails.push(`ENTREGADOR: ${orderOrTable.driver.name}`);
      }
    } else if (type === "BALCAO") {
      headerText = "🛍️ RECIBO BALCÃO 🛍️";
      infoLine = "PEDIDO BALCÃO";
      customerDetails.push(`CLIENTE: ${orderOrTable.customerName || "Não inf."}`);
      if (orderOrTable.customerPhone) customerDetails.push(`FONE: ${orderOrTable.customerPhone}`);
    } else {
      headerText = "RECIBO DE PAGAMENTO";
      infoLine = `MESA/COMANDA: ${orderOrTable.table?.number || "Avulso"}`;
    }
  } else {
    infoLine = `MESA/COMANDA: ${orderOrTable}`;
  }

  lines.push(formatCenter(headerText));
  lines.push("==========================================");
  lines.push(formatLeftRight(infoLine, formatDate(new Date())));
  
  if (customerDetails.length > 0) {
    lines.push("------------------------------------------");
    customerDetails.forEach(cd => lines.push(cd));
  }
  
  lines.push("------------------------------------------");
  lines.push("QTD  ITEM                       UNIT TOTAL");
  lines.push("------------------------------------------");

  items.forEach(item => {
    const qtyStr = padRight(item.qty, 4);
    const unitPrice = item.price.toFixed(2);
    const itemTotal = (item.price * item.qty).toFixed(2);
    const itemName = item.productName || item.name || (item.product ? item.product.name : "Item");
    const nameStr = padRight(itemName.substring(0, 20), 20);
    const unitStr = padLeft(unitPrice, 7);
    const totalStr = padLeft(itemTotal, 9);
    
    lines.push(`${qtyStr}${nameStr}${unitStr}${totalStr}`);
  });

  lines.push("------------------------------------------");
  lines.push(formatLeftRight("Subtotal:", `R$ ${subtotal.toFixed(2)}`));
  if (serviceFee > 0) {
    lines.push(formatLeftRight("Taxa de Servico:", `R$ ${serviceFee.toFixed(2)}`));
  }
  
  const dFee = Number(deliveryFee) || 0;
  if (dFee > 0) {
    lines.push(formatLeftRight("Taxa de Entrega:", `R$ ${dFee.toFixed(2)}`));
  }

  if (couvert > 0) {
    lines.push(formatLeftRight("Couvert Artistico:", `R$ ${couvert.toFixed(2)}`));
  }
  if (discount > 0) {
    lines.push(formatLeftRight("Desconto:", `-R$ ${discount.toFixed(2)}`));
  }
  lines.push("------------------------------------------");
  lines.push(formatLeftRight("TOTAL:", `R$ ${total.toFixed(2)}`));
  lines.push("------------------------------------------");
  
  lines.push(formatCenter("PAGAMENTOS EFETUADOS"));
  let totalPaid = 0;
  payments.forEach(p => {
    lines.push(formatLeftRight(p.method, `R$ ${p.amount.toFixed(2)}`));
    totalPaid += p.amount;
  });

  const troco = totalPaid - total;
  if (troco > 0.01) {
    lines.push(formatLeftRight("Troco:", `R$ ${troco.toFixed(2)}`));
  }

  lines.push("==========================================");
  lines.push(formatCenter("Comprovante de pagamento nao fiscal"));
  if (config.footerMessage) {
    const footerLines = formatLineBreak(config.footerMessage, COLS);
    footerLines.forEach(l => lines.push(formatCenter(l)));
  }
  lines.push("==========================================");
  lines.push("\n\n\n");
  
  return lines.join('\n');
}

// 4. Fechamento de Caixa Analítico
export function generateCashRegisterClosureText(caixa, auditReport) {
  const { statusGeral, details, alerts, totalPrazo, netDifference, totalSangria, totalSuprimento } = auditReport || {};
  
  let lines = [];
  lines.push("==========================================");
  lines.push(formatCenter("CONCILIACAO E FECHAMENTO DE CAIXA"));
  lines.push("==========================================");
  lines.push(formatLeftRight(`CAIXA ID: #${caixa.id}`, `Status: ${(caixa.status || '').toUpperCase()}`));
  lines.push(formatLeftRight(`Abertura:`, formatDate(caixa.openedAt)));
  lines.push(formatLeftRight(`Fechamento:`, formatDate(caixa.closedAt || new Date())));
  lines.push("------------------------------------------");
  lines.push("MEIO          SISTEMA   DECLARADO     DIFF");
  lines.push("------------------------------------------");

  const detailsList = details || [];
  detailsList.forEach(d => {
    const methodName = d.method || "";
    const systemVal = d.system || 0;
    const declaredVal = d.declared || 0;
    const differenceVal = d.difference || 0;

    const nameStr = padRight(methodName.substring(0, 12), 12);
    const sysStr = padLeft(systemVal.toFixed(2), 9);
    const decStr = padLeft(declaredVal.toFixed(2), 11);
    const diffStr = padLeft(differenceVal.toFixed(2), 9);
    lines.push(`${nameStr}${sysStr}${decStr}${diffStr}`);
  });

  lines.push("------------------------------------------");
  lines.push(formatLeftRight("Fundo de Troco Inicial:", `R$ ${(caixa.initialBalance || 0).toFixed(2)}`));
  lines.push(formatLeftRight("(+) Total Suprimentos:", `R$ ${(totalSuprimento || 0).toFixed(2)}`));
  lines.push(formatLeftRight("(-) Total Sangrias:", `R$ ${(totalSangria || 0).toFixed(2)}`));
  
  // Apenas dinheiro físico esperado
  const expectedCash = (detailsList.find(d => d.method === 'Dinheiro')?.system) || 0;
  const declaredCash = (detailsList.find(d => d.method === 'Dinheiro')?.declared) || 0;
  
  lines.push(formatLeftRight("(=) Dinheiro Esperado:", `R$ ${expectedCash.toFixed(2)}`));
  lines.push(formatLeftRight("(=) Dinheiro Declarado:", `R$ ${declaredCash.toFixed(2)}`));
  lines.push("------------------------------------------");
  lines.push(formatLeftRight("DIFERENCA FISICA (Dinheiro):", `R$ ${(netDifference || 0).toFixed(2)}`));
  lines.push(formatLeftRight("STATUS GERAL CAIXA:", statusGeral || "N/A"));
  lines.push("------------------------------------------");
  lines.push(formatLeftRight("Vendas Conta Assinada:", `R$ ${(totalPrazo || 0).toFixed(2)}`));
  
  if (alerts && alerts.length > 0) {
    lines.push("------------------------------------------");
    lines.push(formatCenter("!!! ALERTAS DE RISCO FINANCEIRO !!!"));
    alerts.forEach(alert => {
      const wrapped = formatLineBreak(`- ${alert}`, COLS);
      wrapped.forEach(w => lines.push(w));
    });
  }

  lines.push("------------------------------------------");
  lines.push("\n");
  lines.push("__________________________________________");
  lines.push(formatCenter("Assinatura do Operador de Caixa"));
  lines.push("\n\n");
  lines.push("__________________________________________");
  lines.push(formatCenter("Assinatura do Perito/Gerente"));
  lines.push("==========================================");
  lines.push("\n\n\n");
  
  return lines.join('\n');
}

// 5. Sangria / Suprimento
export function generateTransactionVoucherText(caixa, transaction) {
  const isSangria = transaction.type === 'sangria';
  const title = isSangria ? "RECIBO DE SANGRIA" : "RECIBO DE SUPRIMENTO";
  
  let lines = [];
  lines.push("==========================================");
  lines.push(formatCenter(title));
  lines.push("==========================================");
  lines.push(formatLeftRight(`CAIXA ID: #${caixa.id}`, formatDate(transaction.createdAt || new Date())));
  lines.push(formatLeftRight(`Operador ID:`, `#${caixa.userId}`));
  lines.push("------------------------------------------");
  lines.push(formatLeftRight("VALOR DA TRANSACAO:", `R$ ${transaction.amount.toFixed(2)}`));
  
  if (transaction.description) {
    lines.push("------------------------------------------");
    lines.push("Justificativa:");
    const descLines = formatLineBreak(transaction.description, COLS);
    descLines.forEach(l => lines.push(l));
  }
  
  lines.push("------------------------------------------");
  lines.push("\n");
  lines.push("__________________________________________");
  lines.push(formatCenter("Assinatura do Operador"));
  lines.push("\n\n");
  lines.push("__________________________________________");
  lines.push(formatCenter("Assinatura do Gerente/Responsavel"));
  lines.push("==========================================");
  lines.push("\n\n\n");
  
  return lines.join('\n');
}
