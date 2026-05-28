import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { exec } from 'child_process';
import { 
  getPrinterConfig, 
  savePrinterConfig, 
  getRestaurantConfig,
  saveRestaurantConfig,
  sendPrintJob, 
  generateKitchenTicketText, 
  generateCustomerBillText, 
  generatePaymentReceiptText, 
  generateCashRegisterClosureText, 
  generateTransactionVoucherText 
} from './printerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Permite acesso do Front-end Vite local e celulares
    methods: ["GET", "POST", "PUT"]
  }
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// ==========================================
// SEED (POPULAR BANCO DE DADOS INICIAL)
// ==========================================
const seedDatabase = async () => {
  const cleanDbFile = path.join(__dirname, '.clean_db');
  const isCleanDB = fs.existsSync(cleanDbFile) || process.env.CLEAN_DB === 'true' || process.argv.includes('--clean');

  // Garante que o Admin existe
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log("👤 Criando usuário Admin padrão (Senha: 1234)");
    await prisma.user.create({
      data: { name: 'Admin/Gerente', role: 'admin', passcode: '1234' }
    });
  }

  const tableCount = await prisma.table.count();
  if (tableCount === 0) {
    if (isCleanDB) {
      console.log("🌱 [CleanDB] Populando banco de dados ZERADO (Apenas infraestrutura necessária)...");
      
      // Mesas (Aumentado para 50)
      const tablesData = Array.from({ length: 50 }, (_, i) => ({ number: i + 1, status: 'free' }));
      await prisma.table.createMany({ data: tablesData });
      
      // Formas de Pagamento Padrões
      await prisma.paymentMethod.createMany({
        data: [
          { name: 'Dinheiro', feePercentage: 0 },
          { name: 'PIX', feePercentage: 0.99 },
          { name: 'Cartão de Crédito', feePercentage: 2.99 },
          { name: 'Cartão de Débito', feePercentage: 1.50 }
        ]
      });
      
      console.log("✅ [CleanDB] Banco de dados limpo inicializado com sucesso!");
    } else {
      console.log("🌱 Populando banco de dados com Mesas e Produtos iniciais...");
      
      // Mesas (Aumentado para 50)
      const tablesData = Array.from({ length: 50 }, (_, i) => ({ number: i + 1, status: 'free' }));
      await prisma.table.createMany({ data: tablesData });

      // Categorias
      const catBebidas = await prisma.category.create({ data: { name: 'Bebidas' } });
      const catEntradas = await prisma.category.create({ data: { name: 'Entradas' } });
      const catPratos = await prisma.category.create({ data: { name: 'Pratos Principais' } });
      const catSobremesas = await prisma.category.create({ data: { name: 'Sobremesas' } });

      // Produtos
      await prisma.product.createMany({
        data: [
          { codigo: '001', name: 'Chopp Pilsen 500ml', price: 12.90, categoryId: catBebidas.id, icon: '🍺', maxFlavors: 1 },
          { codigo: '002', name: 'Refrigerante Lata', price: 6.50, categoryId: catBebidas.id, icon: '🥤', maxFlavors: 1 },
          { codigo: '003', name: 'Porção de Fritas', price: 28.00, categoryId: catEntradas.id, icon: '🍟', maxFlavors: 1 },
          { codigo: '004', name: 'Filé Mignon c/ Fritas', price: 89.90, categoryId: catPratos.id, icon: '🥩', maxFlavors: 1 },
          { codigo: '005', name: 'Pizza Grande', price: 55.00, categoryId: catPratos.id, icon: '🍕', maxFlavors: 4 }, // Suporta até 4 sabores
          { codigo: '006', name: 'Pudim de Leite', price: 15.00, categoryId: catSobremesas.id, icon: '🍮', maxFlavors: 1 }
        ]
      });
      
      // Formas de Pagamento Padrões
      await prisma.paymentMethod.createMany({
        data: [
          { name: 'Dinheiro', feePercentage: 0 },
          { name: 'PIX', feePercentage: 0.99 },
          { name: 'Cartão de Crédito', feePercentage: 2.99 },
          { name: 'Cartão de Débito', feePercentage: 1.50 }
        ]
      });
      
      console.log("✅ Banco de dados populado com sucesso!");
    }
  }
  
  // Seed Extra para Pizzas Fracionadas (apenas se NÃO for banco limpo)
  if (!isCleanDB) {
    const pizzaCount = await prisma.product.count({ where: { name: { contains: 'Pizza de Mussarela' } } });
    if (pizzaCount === 0) {
      console.log("🍕 Criando sabores de Pizza para teste de Fracionamento...");
      const catPizzas = await prisma.category.create({ data: { name: 'Pizzas', icon: '🍕', fractionPriceMode: 'average', allowFractional: true } });
      await prisma.product.createMany({
        data: [
          { codigo: 'P01', name: 'Pizza de Mussarela', price: 40.00, cost: 15.00, categoryId: catPizzas.id, icon: '🧀', maxFlavors: 4 },
          { codigo: 'P02', name: 'Pizza de Calabresa', price: 45.00, cost: 18.00, categoryId: catPizzas.id, icon: '🌭', maxFlavors: 4 },
          { codigo: 'P03', name: 'Pizza Quatro Queijos', price: 60.00, cost: 25.00, categoryId: catPizzas.id, icon: '🧀', maxFlavors: 4 },
          { codigo: 'P04', name: 'Pizza de Frango c/ Catupiry', price: 55.00, cost: 22.00, categoryId: catPizzas.id, icon: '🍗', maxFlavors: 4 },
          { codigo: 'P05', name: 'Pizza Portuguesa', price: 58.00, cost: 24.00, categoryId: catPizzas.id, icon: '🥚', maxFlavors: 4 },
          { codigo: 'P06', name: 'Pizza Doce de Morango c/ Nutella', price: 70.00, cost: 30.00, categoryId: catPizzas.id, icon: '🍓', maxFlavors: 4 }
        ]
      });
    }
  }

  // Deleta o arquivo temporário de sinalização se ele existir
  if (fs.existsSync(cleanDbFile)) {
    try {
      fs.unlinkSync(cleanDbFile);
      console.log("🗑️  Sinalizador .clean_db removido com sucesso.");
    } catch (err) {
      console.error("Erro ao remover .clean_db:", err);
    }
  }
};
// ==========================================
// ROTINA DE CODIFICAÇÃO RETROATIVA OBRIGATÓRIA
// ==========================================
const runRetroactiveCoding = async () => {
  console.log("🔄 [RetroactiveCoding] Iniciando rotina de codificação sequencial obrigatória...");
  try {
    // 1. Obter todas as categorias ordenadas pelo nome
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`🔄 [RetroactiveCoding] Encontradas ${categories.length} categorias para codificar.`);

    // 2. Limpar códigos temporariamente para evitar colisões de Unique Constraints
    await prisma.category.updateMany({
      data: { codigo: null }
    });

    const allProducts = await prisma.product.findMany();
    for (const p of allProducts) {
      await prisma.product.update({
        where: { id: p.id },
        data: { codigo: `TEMP-${p.id.substring(0, 8)}` }
      });
    }

    // 3. Gravar códigos de 1000 em 1000 nas categorias e sequencial (1001, 1002...) nos produtos
    let currentCategoryCode = 1000;
    for (const category of categories) {
      console.log(`🏷️  [RetroactiveCoding] Codificando Categoria: ${category.name} -> Código: ${currentCategoryCode}`);
      await prisma.category.update({
        where: { id: category.id },
        data: { codigo: currentCategoryCode }
      });

      const products = await prisma.product.findMany({
        where: { categoryId: category.id },
        orderBy: { name: 'asc' }
      });

      let currentProductSequence = 1;
      for (const product of products) {
        const finalProductCode = String(currentCategoryCode + currentProductSequence);
        console.log(`   📦 [RetroactiveCoding] Codificando Produto: ${product.name} -> Código: ${finalProductCode}`);
        await prisma.product.update({
          where: { id: product.id },
          data: { codigo: finalProductCode }
        });
        currentProductSequence++;
      }

      currentCategoryCode += 1000;
    }

    console.log("✅ [RetroactiveCoding] Codificação retroativa sequencial concluída com absoluto sucesso!");
  } catch (error) {
    console.error("❌ [RetroactiveCoding] Erro crítico na codificação retroativa:", error);
  }
};

const initServer = async () => {
  await seedDatabase();
  await runRetroactiveCoding();
  // Garante que "Conta Assinada" sempre exista nos métodos de pagamento
  try {
    const pm = await prisma.paymentMethod.findFirst({ where: { name: 'Conta Assinada' } });
    if (!pm) {
      await prisma.paymentMethod.create({ data: { name: 'Conta Assinada', feePercentage: 0 } });
      console.log("   💳 Forma de pagamento 'Conta Assinada' criada com sucesso!");
    }
  } catch (err) {
    console.error("Erro ao verificar/criar Conta Assinada:", err);
  }
};
initServer();

// ==========================================
// CONFIGURAÇÃO DE IMPRESSORA
// ==========================================
app.get('/api/settings/printer', (req, res) => {
  res.json(getPrinterConfig());
});

// DESCOBERTA AUTOMÁTICA DE IMPRESSORAS DE REDE E LOCAIS (WINDOWS SPOOLER)
app.get('/api/settings/printer/discover', async (req, res) => {
  console.log("🔍 [PrinterDiscover] Iniciando busca automatica de impressoras...");
  try {
    // 1. Buscar impressoras locais instaladas no Windows Spooler
    const getLocalPrinters = () => {
      return new Promise((resolve) => {
        if (process.platform !== 'win32') {
          return resolve([]);
        }
        exec('powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout, stderr) => {
          if (error) {
            // Fallback para wmic se powershell falhar
            exec('wmic printer get name', (wmicErr, wmicStdout) => {
              if (wmicErr) return resolve([]);
              const lines = wmicStdout.split('\r\r\n');
              const printers = [];
              for (let i = 1; i < lines.length; i++) {
                const name = lines[i].trim();
                if (name && name !== 'Name' && name !== '') {
                  printers.push(name);
                }
              }
              resolve(printers);
            });
          } else {
            try {
              const parsed = JSON.parse(stdout);
              const printers = [];
              if (Array.isArray(parsed)) {
                parsed.forEach(p => { if (p && p.Name) printers.push(p.Name); });
              } else if (parsed && parsed.Name) {
                printers.push(parsed.Name);
              }
              resolve(printers);
            } catch (e) {
              resolve([]);
            }
          }
        });
      });
    };

    // 2. Realizar varredura de subrede na porta 9100 (TCP Raw Printing)
    const getLocalSubnets = () => {
      const interfaces = os.networkInterfaces();
      const subnets = [];
      for (const name of Object.keys(interfaces)) {
        for (const netInterface of interfaces[name]) {
          if (netInterface.family === 'IPv4' && !netInterface.internal) {
            const ip = netInterface.address;
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              const parts = ip.split('.');
              parts.pop(); // Remove o ultimo octeto
              subnets.push(parts.join('.'));
            }
          }
        }
      }
      return [...new Set(subnets)]; // Subredes unicas
    };

    const scanIP = (base, octet) => {
      return new Promise((resolve) => {
        const ip = `${base}.${octet}`;
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(250); // Timeout rápido para varredura ágil

        socket.connect(9100, ip, () => {
          resolved = true;
          socket.destroy();
          resolve({ ip, open: true });
        });

        const fail = () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve({ ip, open: false });
          }
        };

        socket.on('error', fail);
        socket.on('timeout', fail);
      });
    };

    const runSubnetScan = async (subnets) => {
      const foundNetworkPrinters = [];
      // Varre as subredes em lotes para evitar sobrecarga
      for (const subnet of subnets) {
        console.log(`🔍 [PrinterDiscover] Varrendo subrede: ${subnet}.X na porta 9100...`);
        const chunkSize = 50;
        for (let i = 1; i <= 254; i += chunkSize) {
          const promises = [];
          for (let j = i; j < i + chunkSize && j <= 254; j++) {
            promises.push(scanIP(subnet, j));
          }
          const results = await Promise.all(promises);
          results.forEach(r => {
            if (r.open) {
              foundNetworkPrinters.push({
                ip: r.ip,
                interface: `tcp://${r.ip}:9100`,
                name: `Impressora TCP/IP (${r.ip})`
              });
            }
          });
        }
      }
      return foundNetworkPrinters;
    };

    // Executa as duas buscas concorrentemente
    const subnets = getLocalSubnets();
    const [localPrintersList, networkPrintersList] = await Promise.all([
      getLocalPrinters(),
      runSubnetScan(subnets)
    ]);

    const localPrintersMapped = localPrintersList.map(name => ({
      name: name,
      interface: name
    }));

    console.log(`✅ [PrinterDiscover] Descobertas: ${localPrintersMapped.length} locais e ${networkPrintersList.length} de rede.`);
    
    res.json({
      success: true,
      localPrinters: localPrintersMapped,
      networkPrinters: networkPrintersList
    });
  } catch (err) {
    console.error("Erro na busca de impressoras:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/printer', (req, res) => {
  const body = req.body;
  
  // Converte as flags booleanas (que podem vir como booleano ou string 'on' / 'true')
  const autoPrint = body.autoPrint === true || body.autoPrint === 'on' || body.autoPrint === 'true';
  const printPreBillAlwaysAsk = body.printPreBillAlwaysAsk === true || body.printPreBillAlwaysAsk === 'on' || body.printPreBillAlwaysAsk === 'true';
  const printCheckoutAlwaysAsk = body.printCheckoutAlwaysAsk === true || body.printCheckoutAlwaysAsk === 'on' || body.printCheckoutAlwaysAsk === 'true';
  const printRegisterCloseEnabled = body.printRegisterCloseEnabled === true || body.printRegisterCloseEnabled === 'on' || body.printRegisterCloseEnabled === 'true';
  
  let sectors = body.sectors || {};
  
  // Se não veio sectors estruturado no body (como em submissões antigas/planas)
  if (typeof sectors !== 'object' || Object.keys(sectors).length === 0) {
    sectors = {
      CAIXA: {
        type: body.caixa_type || body.type || 'SIMULATOR',
        interface: body.caixa_interface !== undefined ? body.caixa_interface : (body.interface || '')
      },
      COZINHA: {
        type: body.cozinha_type || 'SIMULATOR',
        interface: body.cozinha_interface || ''
      },
      BAR: {
        type: body.bar_type || 'SIMULATOR',
        interface: body.bar_interface || ''
      }
    };
  }

  // Garante que o setor padrão CAIXA sempre exista
  if (!sectors.CAIXA) {
    sectors.CAIXA = { type: 'SIMULATOR', interface: '' };
  }

  const config = {
    autoPrint,
    printPreBillAlwaysAsk,
    printCheckoutAlwaysAsk,
    printRegisterCloseEnabled,
    sectors
  };

  const result = savePrinterConfig(config);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ==========================================
// CONFIGURAÇÕES DO RESTAURANTE E MESAS
// ==========================================
app.get('/api/settings/restaurant', async (req, res) => {
  try {
    const config = getRestaurantConfig();
    const tableCount = await prisma.table.count();
    res.json({
      ...config,
      maxTables: tableCount
    });
  } catch (err) {
    console.error("Erro ao obter configurações do restaurante:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/restaurant', async (req, res) => {
  try {
    const { name, address, phone, footerMessage, defaultServiceFee, defaultCouvert, maxTables } = req.body;
    
    const configData = {
      name: name || "CERVEJARIA OS",
      address: address || "",
      phone: phone || "",
      footerMessage: footerMessage || "",
      defaultServiceFee: Number(defaultServiceFee) >= 0 ? Number(defaultServiceFee) : 10,
      defaultCouvert: Number(defaultCouvert) >= 0 ? Number(defaultCouvert) : 0
    };
    
    const saveRes = saveRestaurantConfig(configData);
    if (!saveRes.success) {
      return res.status(500).json({ error: saveRes.error });
    }

    if (maxTables !== undefined) {
      const newMaxTables = Number(maxTables);
      if (isNaN(newMaxTables) || newMaxTables <= 0) {
        return res.status(400).json({ error: "Quantidade de mesas inválida." });
      }

      const existingTables = await prisma.table.findMany({
        orderBy: { number: 'asc' }
      });
      const currentCount = existingTables.length;

      if (newMaxTables > currentCount) {
        const tablesToCreate = [];
        for (let i = currentCount + 1; i <= newMaxTables; i++) {
          tablesToCreate.push({ number: i, status: 'free' });
        }
        if (tablesToCreate.length > 0) {
          await prisma.table.createMany({ data: tablesToCreate });
        }
      } else if (newMaxTables < currentCount) {
        const blockedTables = existingTables.filter(t => t.number > newMaxTables && t.status !== 'free');
        const blockedTableIds = existingTables.filter(t => t.number > newMaxTables).map(t => t.id);
        const activeOrders = await prisma.order.findMany({
          where: {
            tableId: { in: blockedTableIds },
            status: 'open'
          },
          include: { table: true }
        });

        if (blockedTables.length > 0 || activeOrders.length > 0) {
          const numbers = new Set([
            ...blockedTables.map(t => t.number),
            ...activeOrders.map(o => o.table?.number).filter(Boolean)
          ]);
          return res.status(400).json({
            error: `Não é possível reduzir para ${newMaxTables} mesas. As mesas excedentes [${Array.from(numbers).sort((a,b)=>a-b).join(', ')}] estão ocupadas ou possuem comandas ativas.`
          });
        }

        await prisma.table.deleteMany({
          where: {
            number: { gt: newMaxTables }
          }
        });
      }
    }

    io.emit('tableUpdate');
    res.json({ success: true, config: { ...configData, maxTables } });
  } catch (err) {
    console.error("Erro ao salvar configurações do restaurante:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// ROTAS DE IMPRESSÃO TÉRMICA
// ==========================================

// Imprimir Pré-conta / Conferência
app.post('/api/orders/:id/print-bill', async (req, res) => {
  try {
    const { discount = 0, serviceFee = 0, couvert = 0, peopleCount = 1 } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { table: true, items: true }
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    let subtotal = 0;
    order.items.forEach(item => {
      if (!item.isCancelled) {
        subtotal += item.price * item.qty;
      }
    });

    const calcs = {
      subtotal,
      serviceFee: Number(serviceFee),
      couvert: Number(couvert),
      discount: Number(discount),
      deliveryFee: Number(order.deliveryFee || 0),
      total: subtotal + Number(serviceFee) + Number(couvert) + Number(order.deliveryFee || 0) - Number(discount),
      peopleCount: Number(peopleCount)
    };

    const activeItems = order.items.filter(i => !i.isCancelled);

    const text = generateCustomerBillText(order, activeItems, calcs);
    const result = await sendPrintJob(text);
    res.json(result);
  } catch (err) {
    console.error("Erro na impressão de conferência:", err);
    res.status(500).json({ error: err.message });
  }
});

// Imprimir Recibo de Venda / Pagamento
app.post('/api/orders/:id/print-receipt', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { table: true, items: true, payments: true, driver: true }
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    let subtotal = 0;
    order.items.forEach(item => {
      if (!item.isCancelled) {
        subtotal += item.price * item.qty;
      }
    });

    const calcs = {
      subtotal,
      serviceFee: order.serviceFee,
      couvert: order.couvert,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total
    };

    const activeItems = order.items.filter(i => !i.isCancelled);

    const text = generatePaymentReceiptText(order, activeItems, order.payments, calcs);
    const result = await sendPrintJob(text);
    res.json(result);
  } catch (err) {
    console.error("Erro na impressão de recibo:", err);
    res.status(500).json({ error: err.message });
  }
});

// Imprimir Ticket de Cozinha (Re-impressão manual)
app.post('/api/orders/:id/print-kitchen', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { table: true, items: true }
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    const activeItems = order.items.filter(i => !i.isCancelled);
    const text = generateKitchenTicketText(order, activeItems);
    const result = await sendPrintJob(text);
    res.json(result);
  } catch (err) {
    console.error("Erro na impressão de cozinha:", err);
    res.status(500).json({ error: err.message });
  }
});

// Imprimir Fechamento de Caixa (Conferência Analítica)
app.post('/api/cash/close/print', async (req, res) => {
  try {
    const { cashRegisterId } = req.body;
    const caixa = await prisma.cashRegister.findUnique({
      where: { id: cashRegisterId }
    });
    if (!caixa) return res.status(404).json({ error: "Caixa não encontrado" });

    if (!caixa.reconciliationData) {
      return res.status(400).json({ error: "Este caixa não possui dados de reconciliação de auditoria." });
    }

    const auditReport = JSON.parse(caixa.reconciliationData);
    const text = generateCashRegisterClosureText(caixa, auditReport);
    const result = await sendPrintJob(text);
    res.json(result);
  } catch (err) {
    console.error("Erro na impressão de fechamento:", err);
    res.status(500).json({ error: err.message });
  }
});

// Imprimir Recibo de Sangria / Suprimento
app.post('/api/cash/transactions/:id/print', async (req, res) => {
  try {
    const transaction = await prisma.cashTransaction.findUnique({
      where: { id: req.params.id },
      include: { cashRegister: true }
    });
    if (!transaction) return res.status(404).json({ error: "Transação não encontrada" });

    const text = generateTransactionVoucherText(transaction.cashRegister, transaction);
    const result = await sendPrintJob(text);
    res.json(result);
  } catch (err) {
    console.error("Erro na impressão de sangria/suprimento:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// ROTAS REST API
// ==========================================

// 1. Obter todos os Produtos e Categorias
app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany({
    include: { category: true }
  });
  res.json(products);
});

app.post('/api/products', async (req, res) => {
  const { id, name, price, cost, icon, categoria, categoryId, maxFlavors, ncm, cest, cfop, availableObs, printSector } = req.body;
  try {
    // Validar se nome já existe em outro produto
    if (name) {
      const existingName = await prisma.product.findFirst({
        where: {
          name: name,
          NOT: id ? { id: id } : undefined
        }
      });
      if (existingName) {
        return res.status(400).json({ error: `Já existe um produto com o nome '${name}'.` });
      }
    }

    const parsedPrice = Number(price);
    const parsedCost = Number(cost);
    const parsedMaxFlavors = Number(maxFlavors);

    let finalCode = '';

    if (!id) {
      // NOVO PRODUTO -> Calcular código automático sequencial no grupo
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(400).json({ error: "Categoria associada não encontrada." });
      }
      
      const categoryCode = category.codigo || 1000;
      
      // Encontra o maior código de produto existente nesta categoria
      const allCategoryProducts = await prisma.product.findMany({
        where: { categoryId }
      });
      
      let maxNumericCode = categoryCode;
      for (const p of allCategoryProducts) {
        const num = Number(p.codigo);
        if (!isNaN(num) && num > maxNumericCode) {
          maxNumericCode = num;
        }
      }
      finalCode = String(maxNumericCode + 1);
    } else {
      // PRODUTO EXISTENTE -> Verificar se a categoria mudou
      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (!existingProduct) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      if (existingProduct.categoryId !== categoryId) {
        // Categoria mudou -> Recalcular código na nova categoria
        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) {
          return res.status(400).json({ error: "Nova categoria associada não encontrada." });
        }
        
        const categoryCode = category.codigo || 1000;
        
        const allCategoryProducts = await prisma.product.findMany({
          where: { categoryId }
        });
        
        let maxNumericCode = categoryCode;
        for (const p of allCategoryProducts) {
          const num = Number(p.codigo);
          if (!isNaN(num) && num > maxNumericCode) {
            maxNumericCode = num;
          }
        }
        finalCode = String(maxNumericCode + 1);
      } else {
        // Categoria inalterada -> Manter o código atual
        finalCode = existingProduct.codigo;
      }
    }

    const productData = {
      codigo: finalCode,
      name,
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      cost: isNaN(parsedCost) ? 0 : parsedCost,
      icon,
      categoria: categoria || null,
      categoryId,
      maxFlavors: isNaN(parsedMaxFlavors) ? 1 : parsedMaxFlavors,
      ncm,
      cest,
      cfop,
      availableObs,
      printSector: printSector || 'CAIXA'
    };

    let product;
    if (id) {
      product = await prisma.product.update({
        where: { id },
        data: productData
      });
    } else {
      product = await prisma.product.create({
        data: productData
      });
    }
    io.emit('tableUpdate'); // Avisa frontend para recarregar produtos
    res.json(product);
  } catch (error) {
    console.error("Erro ao salvar produto:", error);
    res.status(500).json({ error: "Erro interno ao salvar produto: " + error.message });
  }
});

// 1.2 Obter Categorias
app.get('/api/categories', async (req, res) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});

// 1.3 Criar ou Atualizar Categoria
app.post('/api/categories', async (req, res) => {
  const { id, name, icon, fractionPriceMode, allowFractional } = req.body;
  const isFractional = allowFractional === true || allowFractional === 'on' || allowFractional === 'true';
  let category;
  if (id) {
    category = await prisma.category.update({ where: { id }, data: { name, icon, fractionPriceMode: fractionPriceMode || 'highest', allowFractional: isFractional } });
  } else {
    // Buscar o maior código de categoria existente no banco
    const maxCategory = await prisma.category.findFirst({
      orderBy: { codigo: 'desc' }
    });
    const newCode = maxCategory && maxCategory.codigo ? maxCategory.codigo + 1000 : 1000;

    category = await prisma.category.create({ 
      data: { 
        name, 
        icon, 
        codigo: newCode, 
        fractionPriceMode: fractionPriceMode || 'highest', 
        allowFractional: isFractional 
      } 
    });
  }
  io.emit('tableUpdate');
  res.json(category);
});

// 1.4 Usuários
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany({ where: { active: true } });
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { id, name, role, passcode } = req.body;
  let user;
  if (id) user = await prisma.user.update({ where: { id }, data: { name, role, passcode } });
  else user = await prisma.user.create({ data: { name, role, passcode } });
  res.json(user);
});

// ==========================================
// MÓDULO DE CLIENTES E CONTAS ASSINADAS
// ==========================================

// Listar todos os clientes
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// Cadastrar ou atualizar cliente
app.post('/api/customers', async (req, res) => {
  const { id, name, phone, address, signedLimit } = req.body;
  try {
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "O nome do cliente é obrigatório." });
    }

    const limit = signedLimit !== undefined ? Number(signedLimit) : 500;

    let customer;
    if (id) {
      customer = await prisma.customer.update({
        where: { id },
        data: { name, phone, address, signedLimit: limit }
      });
    } else {
      customer = await prisma.customer.create({
        data: { name, phone, address, signedLimit: limit, signedBalance: 0, active: true }
      });
    }
    res.json(customer);
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    res.status(500).json({ error: "Erro ao salvar cliente: " + error.message });
  }
});

// Exclusão lógica (desativar cliente)
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.update({
      where: { id },
      data: { active: false }
    });
    res.json({ success: true, customer });
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    res.status(500).json({ error: "Erro ao deletar cliente." });
  }
});

// Obter extrato de transações do cliente
app.get('/api/customers/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const transactions = await prisma.customerTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    res.status(500).json({ error: "Erro ao buscar transações" });
  }
});

// Registrar reembolso / pagamento de fiado
app.post('/api/customers/:id/repay', async (req, res) => {
  const { id } = req.params;
  const { amount, method, description } = req.body;
  try {
    const repayAmount = Number(amount);
    if (isNaN(repayAmount) || repayAmount <= 0) {
      return res.status(400).json({ error: "O valor do pagamento deve ser maior que zero." });
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const newBalance = Number((customer.signedBalance - repayAmount).toFixed(2));

    const [updatedCustomer, tx] = await prisma.$transaction([
      prisma.customer.update({
        where: { id },
        data: { signedBalance: newBalance }
      }),
      prisma.customerTransaction.create({
        data: {
          customerId: id,
          type: 'credit',
          amount: repayAmount,
          description: description || `Pagamento fiado via ${method || 'Dinheiro'}`
        }
      })
    ]);

    const canonical = getCanonicalMethod(method);
    if (canonical === 'Dinheiro' || canonical === 'PIX') {
      const openCaixa = await prisma.cashRegister.findFirst({ where: { status: 'open' } });
      if (openCaixa) {
        await prisma.cashTransaction.create({
          data: {
            cashRegisterId: openCaixa.id,
            type: 'suprimento',
            amount: repayAmount,
            description: `Recebimento Fiado: ${customer.name} - ${method || 'Dinheiro'}`
          }
        });
      }
    }

    res.json({ success: true, customer: updatedCustomer, transaction: tx });
  } catch (error) {
    console.error("Erro ao registrar pagamento de fiado:", error);
    res.status(500).json({ error: "Erro interno ao registrar pagamento: " + error.message });
  }
});

// 1.5 Métodos de Pagamento
app.get('/api/payment_methods', async (req, res) => {
  const methods = await prisma.paymentMethod.findMany({ where: { active: true } });
  res.json(methods);
});

app.post('/api/payment_methods', async (req, res) => {
  try {
    const { id, name, feePercentage } = req.body;
    let feeNum = 0;
    if (feePercentage) {
      feeNum = Number(String(feePercentage).replace(',', '.'));
      if (isNaN(feeNum)) feeNum = 0;
    }
    
    let method;
    if (id) method = await prisma.paymentMethod.update({ where: { id }, data: { name, feePercentage: feeNum } });
    else method = await prisma.paymentMethod.create({ data: { name, feePercentage: feeNum } });
    res.json(method);
  } catch (error) {
    console.error("Erro ao salvar método de pagamento:", error);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ==========================================
// MÓDULO DE DELIVERY / BALCÃO & ENTREGADORES
// ==========================================

// Obter Entregadores
app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(drivers);
  } catch (error) {
    console.error("Erro ao listar entregadores:", error);
    res.status(500).json({ error: "Erro interno." });
  }
});

// Cadastrar/Editar Entregador
app.post('/api/drivers', async (req, res) => {
  try {
    const { id, name, phone, active } = req.body;
    let driver;
    if (id) {
      driver = await prisma.driver.update({
        where: { id },
        data: { name, phone, active: active !== undefined ? active : true }
      });
    } else {
      driver = await prisma.driver.create({
        data: { name, phone, active: active !== undefined ? active : true }
      });
    }
    res.json(driver);
  } catch (error) {
    console.error("Erro ao salvar entregador:", error);
    res.status(500).json({ error: "Erro interno." });
  }
});

// Listar Pedidos de Delivery e Balcão ativos
app.get('/api/orders/delivery', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        type: { in: ['DELIVERY', 'BALCAO'] },
        status: 'open'
      },
      include: {
        items: { include: { product: true } },
        driver: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Erro ao listar pedidos de delivery/balcão:", error);
    res.status(500).json({ error: "Erro interno." });
  }
});

// Atualizar Status da Entrega e Atribuir Entregador
app.put('/api/orders/:id/delivery-status', async (req, res) => {
  try {
    const { deliveryStatus, driverId } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        deliveryStatus,
        driverId: driverId || null
      },
      include: { driver: true }
    });
    
    io.emit('deliveryUpdate');
    res.json(order);
  } catch (error) {
    console.error("Erro ao atualizar status do delivery:", error);
    res.status(500).json({ error: "Erro interno." });
  }
});

// 2. Obter Mesas e seus Pedidos Ativos
app.get('/api/tables', async (req, res) => {
  const tables = await prisma.table.findMany({
    include: {
      orders: {
        where: { status: 'open' },
        include: { items: { include: { product: true } } }
      }
    }
  });
  res.json(tables);
});

// 3. Obter Tickets da Cozinha Pendentes
app.get('/api/kitchen', async (req, res) => {
  const tickets = await prisma.kitchenTicket.findMany({
    where: { status: 'pending' },
    include: { order: { include: { items: { include: { product: true } } } } }
  });
  res.json(tickets);
});

// 3. Receber Pedido na Mesa
// 3. Receber Pedido na Mesa / Delivery / Balcão
app.post('/api/orders', async (req, res) => {
  const { 
    tableId, 
    items, 
    type = "MESA", 
    customerName = null, 
    customerPhone = null, 
    customerAddress = null, 
    deliveryFee = 0 
  } = req.body;
  
  try {
    let order;
    
    if (type === "DELIVERY" || type === "BALCAO") {
      order = await prisma.order.create({
        data: {
          type,
          customerName,
          customerPhone,
          customerAddress,
          deliveryFee: Number(deliveryFee) || 0,
          deliveryStatus: "preparing"
        }
      });
    } else {
      // Buscar se mesa ja tem comanda aberta
      order = await prisma.order.findFirst({
        where: { tableId, status: 'open' }
      });

      if (!order) {
        order = await prisma.order.create({ data: { tableId } });
        await prisma.table.update({
          where: { id: tableId },
          data: { status: 'occupied' }
        });
      }
    }

    // Criar itens
    for (const item of items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId && item.productId.includes('-') ? null : item.productId,
          productName: item.name,
          qty: Number(item.qty),
          price: item.price,
          observations: item.observations || null,
          isFractioned: item.isFractioned || false
        }
      });
    }

    // Manda pra cozinha
    await prisma.kitchenTicket.create({ data: { orderId: order.id } });
    
    // Auto-impressão de tickets segmentados por setor (COZINHA, BAR, CAIXA)
    let printerResult = { success: true, mode: 'PHYSICAL', text: '' };
    const simulatorTexts = [];
    
    try {
      const orderWithRelations = await prisma.order.findUnique({
        where: { id: order.id },
        include: { table: true }
      });

      // Buscar produtos correspondentes do banco para identificar os setores
      const productIds = items.map(i => i.productId).filter(Boolean);
      const productsFromDb = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });

      const sectorItems = {
        COZINHA: [],
        BAR: [],
        CAIXA: []
      };

      for (const item of items) {
        const dbProduct = productsFromDb.find(p => p.id === item.productId);
        const sector = (dbProduct?.printSector || 'CAIXA').toUpperCase();
        if (sectorItems[sector]) {
          sectorItems[sector].push(item);
        } else {
          sectorItems['CAIXA'].push(item);
        }
      }

      // Enviar os jobs de impressão para cada setor que tiver itens
      for (const [sector, sItems] of Object.entries(sectorItems)) {
        if (sItems.length > 0) {
          const ticketText = generateKitchenTicketText(orderWithRelations, sItems);
          const jobRes = await sendPrintJob(ticketText, sector);
          
          if (jobRes.mode === 'SIMULATOR') {
            simulatorTexts.push(jobRes.text);
            printerResult.mode = 'SIMULATOR';
          }
          if (!jobRes.success) {
            printerResult.success = false;
            printerResult.error = jobRes.error;
          }
        }
      }

      if (simulatorTexts.length > 0) {
        printerResult.text = simulatorTexts.join('\n\n--- CORTAR PAPEL ---\n\n');
      }
    } catch (printErr) {
      console.error("Erro na auto-impressão de cozinha por setores:", printErr);
    }

    io.emit('tableUpdate');
    io.emit('newKitchenTicket');
    io.emit('deliveryUpdate');
    res.json({ ...order, printerResult });
  } catch (err) {
    console.error("Erro ao criar comanda/pedido:", err);
    res.status(500).json({ error: "Erro interno: " + err.message });
  }
});

// 4. Fechamento de Conta (AVANÇADO)
app.post('/api/orders/:id/checkout', async (req, res) => {
  const { payments, discount, serviceFee, couvert, total, peopleCount, customerId } = req.body;
  
  try {
    const existingOrder = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existingOrder) return res.status(404).json({ error: "Pedido não encontrado" });

    // Validar limite de Conta Assinada (Fiado) se aplicável
    let signedAmount = 0;
    if (payments && payments.length > 0) {
      payments.forEach(p => {
        if (getCanonicalMethod(p.method) === 'Conta Assinada') {
          signedAmount += Number(p.amount);
        }
      });
    }

    if (signedAmount > 0) {
      if (!customerId) {
        return res.status(400).json({ error: "Um cliente cadastrado deve ser selecionado para vendas em Conta Assinada (Fiado)." });
      }
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: "Cliente selecionado não foi encontrado." });
      }
      if (!customer.active) {
        return res.status(400).json({ error: "O cliente selecionado está inativo." });
      }
      
      const newSignedBalance = Number((customer.signedBalance + signedAmount).toFixed(2));
      if (newSignedBalance > customer.signedLimit) {
        return res.status(400).json({
          error: `Limite de fiado excedido para ${customer.name}! Limite: R$ ${customer.signedLimit.toFixed(2)}. Saldo devedor atual: R$ ${customer.signedBalance.toFixed(2)}. Tentativa de compra: R$ ${signedAmount.toFixed(2)}.`
        });
      }

      // Atualiza o saldo do cliente e cria a transação de débito
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customerId },
          data: { signedBalance: newSignedBalance }
        }),
        prisma.customerTransaction.create({
          data: {
            customerId,
            type: 'debit',
            amount: signedAmount,
            orderId: req.params.id,
            description: `Venda Comanda/Pedido #${existingOrder.tableId ? 'Mesa' : 'Delivery'}`
          }
        })
      ]);
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { 
        status: 'paid',
        discount: Number(discount) || 0,
        serviceFee: Number(serviceFee) || 0,
        couvert: Number(couvert) || 0,
        deliveryFee: req.body.deliveryFee !== undefined ? Number(req.body.deliveryFee) : (existingOrder.deliveryFee || 0),
        deliveryStatus: existingOrder.type === 'DELIVERY' || existingOrder.type === 'BALCAO' ? 'completed' : existingOrder.deliveryStatus,
        total: Number(total) || 0,
        peopleCount: Number(peopleCount) || 1,
        customerId: customerId || null
      }
    });

    // Registra os múltiplos pagamentos e calcula as taxas
    if (payments && payments.length > 0) {
      const activeMethods = await prisma.paymentMethod.findMany();
      
      const paymentsData = payments.map(p => {
        const amount = Number(p.amount);
        // Busca a taxa do método pelo nome (ignorando case) ou assume 0 se não achar
        const methodDb = activeMethods.find(m => m.name.toLowerCase() === p.method.toLowerCase());
        const feePercentage = methodDb ? methodDb.feePercentage : 0;
        const feeAmount = amount * (feePercentage / 100);
        
        return {
          orderId: order.id,
          method: p.method,
          amount: amount,
          feeAmount: feeAmount
        };
      });
      await Promise.all(paymentsData.map(data => prisma.payment.create({ data })));
    }

    // Libera a mesa
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'free' }
      });
    }

    io.emit('tableUpdate');
    io.emit('deliveryUpdate');
    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error("ERRO NO CHECKOUT:", err);
    res.status(500).json({ error: "Erro no fechamento: " + err.message });
  }
});

// 4.1 Pagamento Parcial (Receber por Item)
app.post('/api/orders/:id/partial-checkout', async (req, res) => {
  const { itemsToPay, payments, discount, serviceFee, couvert, total, peopleCount, customerId } = req.body;
  const originalOrderId = req.params.id;

  try {
    // 1. Cria uma nova "Sub-Comanda" paga para a mesma mesa
    const originalOrder = await prisma.order.findUnique({ where: { id: originalOrderId } });
    
    // Validar limite de Conta Assinada (Fiado) se aplicável
    let signedAmount = 0;
    if (payments && payments.length > 0) {
      payments.forEach(p => {
        if (getCanonicalMethod(p.method) === 'Conta Assinada') {
          signedAmount += Number(p.amount);
        }
      });
    }

    let customer = null;
    if (signedAmount > 0) {
      if (!customerId) {
        return res.status(400).json({ error: "Um cliente cadastrado deve ser selecionado para vendas em Conta Assinada (Fiado)." });
      }
      customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: "Cliente selecionado não foi encontrado." });
      }
      if (!customer.active) {
        return res.status(400).json({ error: "O cliente selecionado está inativo." });
      }
      
      const newSignedBalance = Number((customer.signedBalance + signedAmount).toFixed(2));
      if (newSignedBalance > customer.signedLimit) {
        return res.status(400).json({
          error: `Limite de fiado excedido para ${customer.name}! Limite: R$ ${customer.signedLimit.toFixed(2)}. Saldo devedor atual: R$ ${customer.signedBalance.toFixed(2)}. Tentativa de compra: R$ ${signedAmount.toFixed(2)}.`
        });
      }
    }

    const paidOrder = await prisma.order.create({
      data: {
        tableId: originalOrder.tableId,
        status: 'paid',
        discount: Number(discount) || 0,
        serviceFee: Number(serviceFee) || 0,
        couvert: Number(couvert) || 0,
        total: Number(total) || 0,
        peopleCount: Number(peopleCount) || 1,
        customerId: customerId || null
      }
    });

    if (signedAmount > 0 && customer) {
      const newSignedBalance = Number((customer.signedBalance + signedAmount).toFixed(2));
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customerId },
          data: { signedBalance: newSignedBalance }
        }),
        prisma.customerTransaction.create({
          data: {
            customerId,
            type: 'debit',
            amount: signedAmount,
            orderId: paidOrder.id,
            description: `Venda Parcial Comanda/Pedido #${originalOrder.tableId ? 'Mesa' : 'Delivery'}`
          }
        })
      ]);
    }

    // 2. Transfere ou divide os itens
    for (const item of itemsToPay) {
      const dbItem = await prisma.orderItem.findUnique({ where: { id: item.id } });
      const qtyToPay = Number(item.qty);

      if (qtyToPay >= dbItem.qty) {
        // Move o item inteiro para a comanda paga
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { orderId: paidOrder.id }
        });
      } else {
        // Fraciona o item
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { qty: dbItem.qty - qtyToPay } // Diminui da original
        });
        
        // Cria a parte paga
        await prisma.orderItem.create({
          data: {
            orderId: paidOrder.id,
            productId: dbItem.productId,
            productName: dbItem.productName,
            qty: qtyToPay,
            price: dbItem.price,
            observations: dbItem.observations,
            isFractioned: dbItem.isFractioned,
            fractionData: dbItem.fractionData
          }
        });
      }
    }

    // 3. Registra os pagamentos e calcula as taxas
    if (payments && payments.length > 0) {
      const activeMethods = await prisma.paymentMethod.findMany();
      const paymentsData = payments.map(p => {
        const amount = Number(p.amount);
        const methodDb = activeMethods.find(m => m.name.toLowerCase() === p.method.toLowerCase());
        const feePercentage = methodDb ? methodDb.feePercentage : 0;
        const feeAmount = amount * (feePercentage / 100);
        return {
          orderId: paidOrder.id,
          method: p.method,
          amount: amount,
          feeAmount: feeAmount
        };
      });
      await Promise.all(paymentsData.map(data => prisma.payment.create({ data })));
    }

    // 4. Verifica se a comanda original ficou vazia, se sim, libera a mesa e fecha a comanda original
    const remainingItems = await prisma.orderItem.count({ where: { orderId: originalOrderId } });
    if (remainingItems === 0) {
      await prisma.order.update({ where: { id: originalOrderId }, data: { status: 'closed' } });
      await prisma.table.update({ where: { id: originalOrder.tableId }, data: { status: 'free' } });
    }

    io.emit('tableUpdate');
    res.json({ success: true, paidOrderId: paidOrder.id });
  } catch (err) {
    console.error("ERRO NO CHECKOUT PARCIAL:", err);
    res.status(500).json({ error: "Erro no pagamento parcial: " + err.message });
  }
});

// 4.2 Transferência de Itens para Outra Mesa
app.post('/api/orders/:id/transfer', async (req, res) => {
  const { destinationTableId, itemsToTransfer } = req.body;
  const originalOrderId = req.params.id;

  try {
    const destTable = await prisma.table.findUnique({ where: { id: destinationTableId } });
    if (!destTable) return res.status(404).json({ error: "Mesa destino não encontrada" });

    // Busca ou cria comanda na mesa destino
    let destOrder = await prisma.order.findFirst({ where: { tableId: destinationTableId, status: 'open' } });
    if (!destOrder) {
      destOrder = await prisma.order.create({ data: { tableId: destinationTableId, status: 'open' } });
      await prisma.table.update({ where: { id: destinationTableId }, data: { status: 'occupied' } });
    }

    // Move ou divide itens
    for (const item of itemsToTransfer) {
      const dbItem = await prisma.orderItem.findUnique({ where: { id: item.id } });
      const qtyToMove = Number(item.qty);

      if (qtyToMove >= dbItem.qty) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { orderId: destOrder.id }
        });
      } else {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { qty: dbItem.qty - qtyToMove }
        });
        await prisma.orderItem.create({
          data: {
            orderId: destOrder.id,
            productId: dbItem.productId,
            productName: dbItem.productName,
            qty: qtyToMove,
            price: dbItem.price,
            isFractioned: dbItem.isFractioned,
            fractionData: dbItem.fractionData
          }
        });
      }
    }

    // Verifica se a mesa original ficou vazia
    const remainingItems = await prisma.orderItem.count({ where: { orderId: originalOrderId } });
    if (remainingItems === 0) {
      const origOrder = await prisma.order.findUnique({ where: { id: originalOrderId } });
      await prisma.order.update({ where: { id: originalOrderId }, data: { status: 'closed' } });
      await prisma.table.update({ where: { id: origOrder.tableId }, data: { status: 'free' } });
    }

    io.emit('tableUpdate');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro na transferência" });
  }
});

// ==========================================
// ROTAS DE CAIXA E AUTENTICAÇÃO
// ==========================================

// Login com Senha
app.post('/api/auth/login', async (req, res) => {
  const { passcode } = req.body;
  const user = await prisma.user.findUnique({ where: { passcode } });
  if (!user) return res.status(401).json({ error: 'Senha incorreta' });
  res.json(user);
});

// Função de normalização de meios de pagamento para formatos canônicos
function getCanonicalMethod(methodName) {
  if (!methodName) return 'Dinheiro';
  const norm = methodName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (norm.includes('CASH') || norm.includes('DINHEIRO')) return 'Dinheiro';
  if (norm.includes('PIX')) return 'PIX';
  if (norm.includes('CREDIT') || norm.includes('CREDITO')) return 'Cartão de Crédito';
  if (norm.includes('DEBIT') || norm.includes('DEBITO')) return 'Cartão de Débito';
  if (norm.includes('VALE') || norm.includes('REFEICAO') || norm.includes('VR')) return 'Vale-Refeição';
  if (norm.includes('ASSINADA') || norm.includes('FIADO') || norm.includes('PENDURA')) return 'Conta Assinada';
  
  return 'Dinheiro'; // Fallback padrão
}

// Checar Caixa Aberto
app.get('/api/cash/current', async (req, res) => {
  const caixa = await prisma.cashRegister.findFirst({ where: { status: 'open' } });
  res.json(caixa || null);
});

// Abrir Caixa
app.post('/api/cash/open', async (req, res) => {
  const { initialBalance, userId } = req.body;
  const caixa = await prisma.cashRegister.create({
    data: { initialBalance: Number(initialBalance), userId, status: 'open' }
  });
  res.json(caixa);
});

// Registrar Sangria ou Suprimento de Caixa
app.post('/api/cash/transactions', async (req, res) => {
  const { cashRegisterId, type, amount, description } = req.body;

  if (!cashRegisterId) {
    return res.status(400).json({ error: "ID do caixa é obrigatório." });
  }
  if (!type || (type !== 'sangria' && type !== 'suprimento')) {
    return res.status(400).json({ error: "Tipo inválido. Deve ser 'sangria' ou 'suprimento'." });
  }
  const amtNum = Number(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: "O valor deve ser maior que zero." });
  }

  try {
    const transaction = await prisma.cashTransaction.create({
      data: {
        cashRegisterId,
        type,
        amount: amtNum,
        description: description || null
      }
    });

    io.emit('tableUpdate'); // Notifica o frontend para atualizar as informações
    res.json(transaction);
  } catch (error) {
    console.error("Erro ao registrar transação de caixa:", error);
    res.status(500).json({ error: "Erro interno ao registrar transação." });
  }
});


// Fechar Caixa (Conferência Analítica)
app.post('/api/cash/close', async (req, res) => {
  const { cashRegisterId, declaredBalances } = req.body;

  try {
    const caixa = await prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
    if (!caixa) {
      return res.status(404).json({ error: "Caixa não encontrado" });
    }

    // Busca todos os pagamentos feitos durante o período do caixa
    const paymentsRaw = await prisma.payment.findMany({
      where: {
        createdAt: { gte: caixa.openedAt }
      }
    });

    // Busca todas as transações de Sangria e Suprimento
    const transactions = await prisma.cashTransaction.findMany({
      where: { cashRegisterId }
    });

    let totalSangria = 0;
    let totalSuprimento = 0;
    transactions.forEach(t => {
      if (t.type === 'sangria') totalSangria += t.amount;
      else if (t.type === 'suprimento') totalSuprimento += t.amount;
    });

    // 1. Limpeza de Dados Incompletos: Se a informação de valor ou método não estiver completa, exclui
    const payments = paymentsRaw.filter(p => {
      if (p.amount === null || p.amount === undefined || isNaN(p.amount)) return false;
      if (!p.method || p.method.trim() === '') return false;
      return true;
    });

    // Métodos esperados no fechamento
    const methodsList = [
      'Dinheiro',
      'PIX',
      'Cartão de Crédito',
      'Cartão de Débito',
      'Vale-Refeição',
      'Conta Assinada'
    ];

    // Inicializa os totais do sistema
    const systemTotals = {};
    methodsList.forEach(m => {
      systemTotals[m] = 0;
    });

    // Soma as vendas registradas no sistema agrupadas pelo método canônico
    payments.forEach(p => {
      const canonical = getCanonicalMethod(p.method);
      if (systemTotals[canonical] !== undefined) {
        systemTotals[canonical] += p.amount;
      } else {
        systemTotals['Dinheiro'] += p.amount;
      }
    });

    // O Dinheiro do sistema inclui o Fundo de Troco Inicial, soma os Suprimentos e subtrai as Sangrias
    systemTotals['Dinheiro'] += caixa.initialBalance + totalSuprimento - totalSangria;

    // Converte os valores declarados pelo operador (garantindo Number)
    const declared = {};
    methodsList.forEach(m => {
      declared[m] = Number(declaredBalances?.[m]) || 0;
    });

    // Lógica de conciliação: [Valor Declarado] - [Valor Registrado] = [Diferença]
    const details = [];
    let netDifference = 0;

    methodsList.forEach(m => {
      const sysVal = systemTotals[m];
      const decVal = declared[m];
      const diff = Number((decVal - sysVal).toFixed(2));
      
      // O Dinheiro é o principal que determina quebra física de caixa no fechamento
      if (m === 'Dinheiro') {
        netDifference += diff;
      }

      details.push({
        method: m,
        system: sysVal,
        declared: decVal,
        difference: diff
      });
    });

    // Determina o status geral do caixa baseado na diferença do Dinheiro
    let statusGeral = "Caixa Batido";
    if (netDifference < 0) {
      statusGeral = "Quebra de Caixa (Falta)";
    } else if (netDifference > 0) {
      statusGeral = "Sobra de Caixa";
    }

    // Alertas de Risco: Divergência maior que 0.00 em cartões, PIX ou dinheiro
    const alerts = [];
    details.forEach(d => {
      if (d.difference !== 0) {
        if (d.method === 'Dinheiro') {
          alerts.push(`Divergência em Dinheiro de R$ ${d.difference.toFixed(2)}: verificar possível troco incorreto ou sangria não registrada.`);
        } else if (d.method === 'PIX' || d.method.startsWith('Cartão')) {
          alerts.push(`Divergência em ${d.method} de R$ ${d.difference.toFixed(2)}: verificar possível erro de lançamento no PDV ou transação não processada na adquirente.`);
        } else if (d.method === 'Vale-Refeição') {
          alerts.push(`Divergência em Vale-Refeição de R$ ${d.difference.toFixed(2)}: conferir os cartões alimentares passados.`);
        } else if (d.method === 'Conta Assinada') {
          alerts.push(`Divergência em Conta Assinada de R$ ${d.difference.toFixed(2)}: conferir assinaturas de fiado pendentes.`);
        }
      }
    });

    // Total de Vendas a Prazo consolidado das Contas Assinadas
    const totalPrazo = systemTotals['Conta Assinada'];

    // Relatório consolidado final
    const auditReport = {
      statusGeral,
      details,
      alerts,
      totalPrazo,
      netDifference,
      totalSangria,
      totalSuprimento,
      closedAt: new Date()
    };

    const fechado = await prisma.cashRegister.update({
      where: { id: cashRegisterId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closingBalance: declared['Dinheiro'], // Salva o dinheiro contado da gaveta
        systemBalance: systemTotals['Dinheiro'], // Salva o dinheiro esperado
        reconciliationData: JSON.stringify(auditReport) // Salva todo o relatório JSON detalhado
      }
    });

    res.json({
      success: true,
      fechado,
      auditReport
    });
  } catch (error) {
    console.error("ERRO NO FECHAMENTO ANALÍTICO:", error);
    res.status(500).json({ error: "Erro ao fechar caixa: " + error.message });
  }
});

// Relatório do Caixa Atual (Totais por Método)
app.get('/api/cash/report/current', async (req, res) => {
  try {
    const caixa = await prisma.cashRegister.findFirst({ where: { status: 'open' } });
    if (!caixa) return res.json(null);

    const paymentsRaw = await prisma.payment.findMany({
      where: { createdAt: { gte: caixa.openedAt } }
    });

    const transactions = await prisma.cashTransaction.findMany({
      where: { cashRegisterId: caixa.id },
      orderBy: { createdAt: 'desc' }
    });

    let totalSangria = 0;
    let totalSuprimento = 0;
    transactions.forEach(t => {
      if (t.type === 'sangria') totalSangria += t.amount;
      else if (t.type === 'suprimento') totalSuprimento += t.amount;
    });

    // Limpeza de dados incompletos
    const payments = paymentsRaw.filter(p => {
      if (p.amount === null || p.amount === undefined || isNaN(p.amount)) return false;
      if (!p.method || p.method.trim() === '') return false;
      return true;
    });

    const totals = {
      cash: 0,
      pix: 0,
      credit: 0,
      debit: 0,
      mealVoucher: 0,
      signed: 0,
      total: 0,
      totalSangria,
      totalSuprimento,
      transactions
    };

    payments.forEach(p => {
      const canonical = getCanonicalMethod(p.method);
      if (canonical === 'Dinheiro') totals.cash += p.amount;
      else if (canonical === 'PIX') totals.pix += p.amount;
      else if (canonical === 'Cartão de Crédito') totals.credit += p.amount;
      else if (canonical === 'Cartão de Débito') totals.debit += p.amount;
      else if (canonical === 'Vale-Refeição') totals.mealVoucher += p.amount;
      else if (canonical === 'Conta Assinada') totals.signed += p.amount;
      
      totals.total += p.amount;
    });

    res.json({ caixa, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

// Histórico de Caixas Fechados
app.get('/api/cash/history', async (req, res) => {
  const history = await prisma.cashRegister.findMany({
    where: { status: 'closed' },
    orderBy: { closedAt: 'desc' },
    take: 10
  });
  res.json(history);
});

// 5. Marcar Pedido como Pronto na Cozinha
app.put('/api/kitchen/:ticketId/ready', async (req, res) => {
  const { ticketId } = req.params;
  
  await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data: { status: 'ready' }
  });

  io.emit('ticketReady', { ticketId });
  res.json({ success: true });
});

// 6. Relatório Avançado de Vendas (Retaguarda)
app.get('/api/reports/sales', async (req, res) => {
  try {
    const { startDate, endDate, categoryId } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) dateFilter.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const paidOrders = await prisma.order.findMany({
      where: { 
        status: 'paid',
        ...dateFilter
      },
      include: {
        items: { include: { product: true } },
        payments: true
      }
    });

    let totalRevenue = 0;
    let totalPeople = 0;
    let totalCmv = 0; // Custo Mercadoria Vendida
    let totalFees = 0; // Custos de Recebimento
    let totalItemsSold = 0;
    
    // Para Curva ABC
    const productSales = {}; 

    paidOrders.forEach(order => {
      // Se não for filtro de categoria específica, soma faturamento geral, taxas e pessoas
      if (!categoryId) {
        totalRevenue += order.total;
        totalPeople += order.peopleCount;
        order.payments.forEach(p => { totalFees += p.feeAmount; });
      }

      // Calcula CMV e agrupa para Curva ABC
      order.items.forEach(item => {
        // Se houver filtro de categoria e o produto não pertencer a ela, ignora o item
        if (categoryId && item.product?.categoryId !== categoryId) return;

        const itemQty = item.qty;
        const itemRevenue = item.price * itemQty;
        const itemCost = (item.product?.cost || 0) * itemQty;
        
        totalCmv += itemCost;
        totalItemsSold += itemQty;

        // Se a gente filtrou por categoria, a receita é somada só dos itens da categoria
        if (categoryId) {
          totalRevenue += itemRevenue;
        }

        const prodId = item.productId || item.productName || 'avulso';
        if (!productSales[prodId]) {
          productSales[prodId] = {
            name: item.productName || item.product?.name || 'Desconhecido',
            qty: 0,
            revenue: 0,
            cost: 0
          };
        }
        productSales[prodId].qty += itemQty;
        productSales[prodId].revenue += itemRevenue;
        productSales[prodId].cost += itemCost;
      });
    });

    // Se filtrou por categoria, não aplicamos taxa de recebimento, pois ela é no nível do pedido total
    const finalFees = categoryId ? 0 : totalFees;
    const finalPeople = categoryId ? 0 : totalPeople;

    const averageTicket = categoryId ? 0 : (paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0);
    const averageTicketPerPerson = categoryId ? 0 : (finalPeople > 0 ? totalRevenue / finalPeople : 0);
    const netProfit = totalRevenue - totalCmv - finalFees;

    // Converte Curva ABC para Array e ordena por Faturamento
    const abcCurve = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);

    res.json({
      summary: {
        totalOrders: categoryId ? 0 : paidOrders.length,
        totalRevenue,
        totalPeople: finalPeople,
        totalCmv,
        totalFees: finalFees,
        netProfit,
        totalItemsSold,
        averageTicket,
        averageTicketPerPerson
      },
      abcCurve
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar relatório avançado" });
  }
});


// Fallback para Single Page Application (serve index.html)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ==========================================
// WEBSOCKETS (TEMPO REAL)
// ==========================================
io.on('connection', (socket) => {
  console.log(`🔌 Novo dispositivo conectado (KDS/PDV): ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`❌ Dispositivo desconectado: ${socket.id}`);
  });
});

// Inicia Servidor
const PORT = 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Colibri Backend rodando em http://localhost:${PORT}`);
  console.log(`📱 Disponível na rede para Smartphones na porta ${PORT}`);
});
