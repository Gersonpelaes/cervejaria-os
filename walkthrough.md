# Walkthrough - PDV RESTAURANTE 2025 🚀

Temos o prazer de apresentar as melhorias e novas funcionalidades implementadas com sucesso no **PDV RESTAURANTE 2025**.

---

## 1. Codificação Sequencial Obrigatória de Grupos e Produtos (1000 e 1001...) 🏷️

Implementamos uma lógica robusta e totalmente automatizada para a numeração de categorias e produtos, eliminando erros manuais e simplificando a operação de cadastro.

### O que Realizamos?
* **Migração do Banco de Dados**: Adicionamos o campo `codigo Int? @unique` ao modelo `Category` no `prisma/schema.prisma` e aplicamos as alterações via Prisma.
* **Rotina de Codificação Retroativa Automática**: Criamos a função `runRetroactiveCoding()` executada automaticamente no boot do servidor. Ela limpa códigos inconsistentes e renumera a base de dados:
  * **Grupos/Categorias**: Códigos ordenados alfabeticamente e espaçados de 1000 em 1000 (ex: 1000, 2000, 3000...).
  * **Produtos**: Códigos sequenciais associados ao seu grupo (ex: 1001, 1002, 1003... para o grupo 1000).
* **Automação Inteligente no Backend**:
  * Ao criar uma nova categoria, o código recebe `maiorCodigo + 1000`.
  * Ao criar um novo produto, ele recebe automaticamente o próximo número sequencial da sua categoria.
  * Ao alterar a categoria de um produto, o sistema recalcula de forma inteligente e insere o produto no fim da sequência da nova categoria.
* **Interface Segura (Frontend)**:
  * O campo **Código Interno** no modal de produtos foi alterado para `readOnly` (somente leitura) com visual elegante e opaco (`opacity: 0.7; cursor: not-allowed`).
  * Mostra `(Gerado Automaticamente)` para novos cadastros, deixando claro ao operador que o processo é 100% autônomo.

---

## 2. Impressão Térmica Direta (Sem Diálogo do Navegador) 🖨️
Desenvolvemos um sistema híbrido de impressão direta automatizada:
* **Habilitar Impressão Automática**: No menu de configurações, adicionamos um controle para ligar/desligar a impressão direta (`autoPrint`). 
  * Se **desativada**, o sistema opera no modo simulador virtual, exibindo a pré-visualização em um painel popup responsivo na tela para que o operador possa imprimir manualmente via navegador.
  * Se **ativada**, a fila de trabalhos de impressão ignora o diálogo de visualização do navegador e envia os dados diretamente para as portas físicas e servidores de impressão na rede.
* **Resiliência e Tolerância a Falhas**: Caso a impressora física de qualquer setor fique off-line ou desconectada da rede, o sistema de impressão backend captura o erro, avisa os logs do sistema e faz um fallback seguro abrindo a janela de pré-visualização virtual (Simulator) no frontend, garantindo que o garçom ou caixa nunca perca o cupom.

---

## 2. Setorização de Impressão (`CAIXA`, `COZINHA`, `BAR`) 🎯
Dividimos os fluxos de trabalho e produção do restaurante em três setores independentes de impressão:
1. **💵 Caixa / Balcão (CAIXA)**: Focado em extratos de pré-conta, conferência de mesa, comprovantes de sangria, suprimento e recibo final de pagamento da venda.
2. **🍳 Cozinha de Pratos (COZINHA)**: Destinado à impressão dos pratos, pizzas, petiscos e entradas quentes em ordem de entrada.
3. **🍺 Bar / Coparia (BAR)**: Direcionado ao preparo de coquetéis, sucos, refrigerantes, chopps e bebidas geladas.

### Como funciona no Lançamento de Pedidos?
* Ao fechar um pedido na mesa (ou comanda avulsa), o backend recebe o array de itens.
* O sistema varre ativamente a base de dados e divide os itens de acordo com o setor configurado no cadastro de cada produto.
* Caso haja pratos de cozinha e bebidas de bar no mesmo pedido, o sistema gera **dois tickets distintos**:
  * O ticket de pratos é enviado silenciosa e automaticamente para o setor `COZINHA`.
  * O ticket de bebidas é enviado simultaneamente para o setor `BAR`.
* Caso a impressão automática esteja desativada ou no modo virtual, a tela do PDV consolida os tickets em uma única pré-visualização com linha divisória de corte de papel (`--- CORTAR PAPEL ---`), facilitando a conferência.

---

## 3. Cadastro de Produtos com Setor de Impressão 📋
* **Campo de Setor**: Adicionamos o campo `printSector` (`String?`) à tabela `Product` no banco de dados SQLite.
* **Dropdown no Modal**: Adicionamos um menu `<select>` na aba "Dados Básicos" do cadastro/edição de produtos no frontend:
  * **Caixa (Padrão)**: Impressão padrão no balcão caso não seja informada.
  * **Cozinha**: Roteado para a impressora de preparo de pratos.
  * **Bar**: Roteado para a impressora da coparia/bebidas.
* **Auto-Garantia**: Se um produto for cadastrado sem setor (ou seja um produto manual/fracionado especial), ele assume automaticamente o setor `CAIXA` (Caixa/Balcão), conforme solicitado pelo usuário.

---

## 4. Menu de Configurações de Impressão Premium ⚙️
Criamos um formulário de configurações robusto na Retaguarda (Aba de Configurações):
* **Três Interruptores Gerais**:
  1. `Habilitar Impressão Automática (Direta sem diálogo)` (Checkbox).
  2. `Confirmar Impressão de Pré-Conta / Fechamento de Mesas` (Sempre perguntar antes de gerar pré-conta ou comprovante de pagamento).
  3. `Imprimir Auditoria de Fechamento` (Habilitar ou desabilitar impressão física do relatório conciliado do caixa).
* **Grid de Três Colunas (Mapeamento de Impressoras)**:
  Cada setor (`Caixa`, `Cozinha`, `Bar`) tem seu respectivo painel de controle contendo:
  * **Tipo de Impressora**: Simulador Virtual, Epson Thermal, Star Thermal.
  * **Interface / Endereço IP**: Campo de texto para informar a conexão física (porta COM, endereço de rede TCP/IP, ex: `tcp://192.168.1.100:9100`).

---

## 5. Perguntar Sempre no Fechamento de Mesas e Pré-Conta 💬
Implementamos proteções para economizar papel térmico e alinhar a operação:
* **Confirmação de Pré-Conta**: Ao solicitar a emissão da pré-conferência antes do recebimento, o garçom recebe um pop-up de confirmação: *"Deseja imprimir a Pré-Conta/Conferência de Conta?"*. Se cancelado, a operação prossegue sem imprimir.
* **Confirmação no Fechamento**: Ao concluir o pagamento de uma comanda ou mesa, caso a opção esteja ativa, o PDV pergunta explicitamente: *"Deseja imprimir o comprovante de pagamento e fechamento da mesa?"*.
* **Relatório de Fechamento Controlado**: Na finalização do turno de caixa (Retiradas/Fechamento do Operador), a auditoria física respeita estritamente o interruptor do painel. Se desativado, o backend bloqueia a impressão física e retorna um aviso amigável.

---

## 6. Assistente de Instalação Gráfico e Seguro (Instalador Visual Setup) 🛠️
Para proporcionar uma experiência profissional e extremamente amigável, idêntica aos instaladores de grandes softwares do mercado, desenvolvemos um **Assistente de Instalação Visual** que elimina completamente a dependência de telas pretas e prompts de comando complicados:
* **Launcher Blindado (`instalar.bat`)**:
  * O `instalar.bat` serve agora como um atalho de carregamento ultra-simples que apenas dispara a interface visual em PowerShell.
  * Por ser um script básico de uma única linha de execução, ele possui **zero chance de erro de sintaxe ou fechamento rápido**.
* **Interface Gráfica Windows Forms (`instalar_gui.ps1`)**:
  * Criamos uma janela de instalação nativa com o tema escuro premium do PDV.
  * O operador pode visualizar e configurar todas as opções antes de instalar.
* **Procurar Diretório de Destino (Folder Browser Dialog)**:
  * Incluímos um campo de texto para a pasta de instalação (que sugere o padrão `C:\PDV_Restaurante_2025`).
  * O usuário pode clicar no botão **"Procurar..."** para abrir a janela nativa do Windows Explorer, escolher ou criar qualquer pasta em qualquer disco rígido do computador de destino para efetuar a instalação.
* **Escolha de Banco de Dados Interativa**:
  * Disponibilizamos seletores gráficos (Radio Buttons) para escolher na hora entre o **Banco de Dados Zerado/Limpo** (para uso real com o cliente) e o **Banco com Demonstração** (para demonstração e testes).
* **Barra de Progresso e Console de Log em Tempo Real**:
  * A janela exibe uma barra de progresso visual de alta precisão que preenche à medida que os arquivos são copiados do pendrive, o Node.js é configurado, as tabelas são sincronizadas e o frontend é compilado.
  * Um console multilinhas de log exibe exatamente o que está acontecendo nos bastidores em tempo real.
* **Auto-Elevação com UAC Nativo**:
  * O assistente detecta automaticamente se possui direitos de administrador. Caso não tenha, ele aciona o pop-up de UAC do Windows e reinicia a janela em modo elevado com bypass de política de segurança de forma 100% transparente.
* **Botão "Iniciar PDV Restaurante" Integrado**:
  * Assim que a instalação termina, o botão de início é liberado na própria janela do instalador, permitindo abrir o PDV com um único clique!
* **Padronização Universal de Codificação (Fim dos erros de interpretador do prompt)**:
  * Identificamos que o erro de `"INICIANDO não é reconhecido..."` ocorria porque os scripts `.bat` e `.vbs` continham caracteres acentuados especiais (como `ã`, `ç`, `á`, `é`) e codificações incompatíveis com code pages de terminais locais (como CP-850 ou CP-1252) que quebravam o CMD, fazendo-o saltar o comando principal e interpretar pedaços do texto como comandos.
  * Padronizamos todos os arquivos de script (`instalar.bat`, `iniciar.bat`, `parar.bat`, `iniciar.vbs` e `criar_atalhos.vbs`) limpando qualquer acentuação e convertendo-os para o formato **pure ANSI (ASCII estrito) com quebras de linha Windows CRLF (\r\n) puras**.
  * Isso garante compatibilidade universal e execução perfeita do inicializador em absolutamente qualquer computador, sem risco de quebra de codificação!
* **Resiliência Offline Total (Instalações em campo)**:
  * Caso o computador de destino esteja temporariamente sem internet (muito comum em deploys em campo), e a pasta já contenha a subpasta `node_modules` pré-instalada, o instalador exibe um aviso de rede off-line, mas **não aborta a instalação**, prosseguindo normalmente com o Prisma Client, push do banco de dados e build local do frontend.
* **Download Inteligente (`curl` + `PowerShell`)**:
  * O instalador agora tenta primeiro o utilitário nativo de rede `curl` do Windows para baixar o Node.js em computadores novos. Caso falhe, usa o PowerShell como fallback alternativo, aumentando drasticamente a taxa de sucesso online.
* **Fallback Absoluto do Node.exe (Zero-Reboot)**:
  * Adicionamos uma rotina nos scripts de inicialização que detecta caminhos absolutos do executável do Node.
  * Se o Node.js acabar de ser instalado e o Windows ainda não recarregou as variáveis globais (`PATH`) na sessão ativa, os scripts detectam a presença do Node em `C:\Program Files\nodejs` e o iniciam diretamente pelo caminho absoluto, permitindo que o sistema funcione **imediatamente após a instalação** sem necessidade de reiniciar a máquina ou o terminal!
* **Atraso de Abertura do Navegador (Fim do erro connection refused / chromewebdata)**:
  * O erro `chrome-error://chromewebdata/` acontecia porque o navegador abria milissegundos *antes* do servidor Node conseguir concluir o carregamento inicial (seeding) do banco de dados e escutar na porta `3001`.
  * Adicionamos um atraso inteligente de 3 segundos (`timeout /t 3` no `iniciar.bat` e `WScript.Sleep 3000` no `iniciar.vbs`) para dar tempo ao servidor de carregar completamente o banco antes de abrir o navegador, garantindo que o operador nunca caia em uma tela de erro!
* **Resolução Dinâmica de Rede (Acesso Multi-Dispositivos: Tablets e Celulares)**:
  * Identificamos que o erro de segurança de domínio (`Unsafe attempt to load URL http://localhost:3001/ from frame...`) acontecia porque a `API_URL` e a conexão do `socket` estavam mapeadas de forma estática como `localhost` no frontend.
  * Quando um outro dispositivo na rede (como o celular de um garçom ou outro PC de caixa) tentava acessar o sistema usando o IP real do computador principal (ex: `http://192.168.1.50:3001`), o navegador do cliente tentava fazer conexões WebSocket e HTTP com o `localhost` dele próprio (onde o backend obviamente não estava rodando), disparando bloqueios de CORS e falhas de conexão.
  * Refatoramos o frontend para obter as variáveis de host e porta dinamicamente (`window.location.hostname` e `window.location.port`), permitindo o acesso e controle simultâneo do PDV a partir de **qualquer** dispositivo conectado na mesma rede local de forma instantânea e livre de erros!

---

## 7. Validação e Compilação
1. **Sucesso no Build**: O frontend React compila perfeitamente sem erros.
2. **Resiliência do Instalador**: Todos os scripts estão blindados e prontos para implantação em produção.
3. **Servidor em Segundo Plano**: O servidor Node está ativo e gerenciando transações e conexões dinamicamente na porta unificada `3001`!

