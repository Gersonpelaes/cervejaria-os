Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 1. Auto-Elevação de Privilégios (Solicita Admin se necessário)
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process powershell -ArgumentList $argList -Verb RunAs
    exit
}

# 2. Configurações de Estilo (Tema Escuro Premium)
$colorBg = [System.Drawing.ColorTranslator]::FromHtml("#18181b")       # Zinc 900
$colorCard = [System.Drawing.ColorTranslator]::FromHtml("#27272a")     # Zinc 800
$colorText = [System.Drawing.ColorTranslator]::FromHtml("#f4f4f5")     # Zinc 100
$colorMuted = [System.Drawing.ColorTranslator]::FromHtml("#a1a1aa")    # Zinc 400
$colorAccent = [System.Drawing.ColorTranslator]::FromHtml("#8b5cf6")   # Purple 500
$colorSuccess = [System.Drawing.ColorTranslator]::FromHtml("#10b981")  # Emerald 500

# 3. Criação do Formulário
$form = New-Object System.Windows.Forms.Form
$form.Text = "Instalador - PDV RESTAURANTE 2025"
$form.Size = New-Object System.Drawing.Size(620, 560)
$form.BackColor = $colorBg
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

# 4. Cabeçalho (Header)
$header = New-Object System.Windows.Forms.Label
$header.Text = "PDV RESTAURANTE 2025"
$header.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$header.ForeColor = $colorText
$header.Location = New-Object System.Drawing.Point(20, 15)
$header.Size = New-Object System.Drawing.Size(560, 35)
$form.Controls.Add($header)

$subheader = New-Object System.Windows.Forms.Label
$subheader.Text = "Assistente de Instalação e Configuração Automatizada"
$subheader.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$subheader.ForeColor = $colorMuted
$subheader.Location = New-Object System.Drawing.Point(20, 50)
$subheader.Size = New-Object System.Drawing.Size(560, 20)
$form.Controls.Add($subheader)

# Linha divisória
$line = New-Object System.Windows.Forms.Label
$line.BackColor = $colorCard
$line.Location = New-Object System.Drawing.Point(20, 75)
$line.Size = New-Object System.Drawing.Size(560, 2)
$form.Controls.Add($line)

# 5. Seleção de Pasta de Destino
$lblFolder = New-Object System.Windows.Forms.Label
$lblFolder.Text = "Pasta de Destino:"
$lblFolder.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblFolder.ForeColor = $colorText
$lblFolder.Location = New-Object System.Drawing.Point(20, 95)
$lblFolder.Size = New-Object System.Drawing.Size(200, 20)
$form.Controls.Add($lblFolder)

$txtFolder = New-Object System.Windows.Forms.TextBox
$txtFolder.Text = "C:\PDV_Restaurante_2025"
$txtFolder.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$txtFolder.BackColor = $colorCard
$txtFolder.ForeColor = $colorText
$txtFolder.BorderStyle = "FixedSingle"
$txtFolder.Location = New-Object System.Drawing.Point(20, 120)
$txtFolder.Size = New-Object System.Drawing.Size(430, 25)
$form.Controls.Add($txtFolder)

$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Text = "Procurar..."
$btnBrowse.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnBrowse.BackColor = $colorCard
$btnBrowse.ForeColor = $colorText
$btnBrowse.FlatStyle = "Flat"
$btnBrowse.FlatAppearance.BorderSize = 1
$btnBrowse.FlatAppearance.BorderColor = $colorMuted
$btnBrowse.Location = New-Object System.Drawing.Point(460, 119)
$btnBrowse.Size = New-Object System.Drawing.Size(120, 27)
$btnBrowse.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Selecione a pasta de instalação para o PDV"
    $dialog.SelectedPath = $txtFolder.Text
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $txtFolder.Text = $dialog.SelectedPath
    }
})
$form.Controls.Add($btnBrowse)

# 6. Seleção do Banco de Dados (GroupBox e RadioButtons)
$grpDatabase = New-Object System.Windows.Forms.GroupBox
$grpDatabase.Text = " Configuração do Banco de Dados "
$grpDatabase.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$grpDatabase.ForeColor = $colorAccent
$grpDatabase.BackColor = $colorBg
$grpDatabase.Location = New-Object System.Drawing.Point(20, 165)
$grpDatabase.Size = New-Object System.Drawing.Size(560, 110)
$form.Controls.Add($grpDatabase)

$rbClean = New-Object System.Windows.Forms.RadioButton
$rbClean.Text = "BANCO ZERADO / LIMPO (Recomendado para Produção)`nCria apenas a infraestrutura: 50 Mesas, 4 formas de pagamento e Usuário Admin (senha: 1234)."
$rbClean.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$rbClean.ForeColor = $colorText
$rbClean.Checked = $true
$rbClean.Location = New-Object System.Drawing.Point(15, 25)
$rbClean.Size = New-Object System.Drawing.Size(530, 40)
$grpDatabase.Controls.Add($rbClean)

$rbDemo = New-Object System.Windows.Forms.RadioButton
$rbDemo.Text = "BANCO COM DEMONSTRAÇÃO (Para Testes)`nPré-popula o banco com categorias, produtos fictícios e pizzas de demonstração."
$rbDemo.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$rbDemo.ForeColor = $colorText
$rbDemo.Location = New-Object System.Drawing.Point(15, 65)
$rbDemo.Size = New-Object System.Drawing.Size(530, 40)
$grpDatabase.Controls.Add($rbDemo)

# 7. Barra de Progresso
$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(20, 290)
$progressBar.Size = New-Object System.Drawing.Size(560, 15)
$progressBar.Style = "Continuous"
$form.Controls.Add($progressBar)

# 8. Log de Instalação (Caixa de Texto de Saída)
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true
$txtLog.ReadOnly = $true
$txtLog.ScrollBars = "Vertical"
$txtLog.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$txtLog.BackColor = $colorCard
$txtLog.ForeColor = $colorText
$txtLog.BorderStyle = "None"
$txtLog.Location = New-Object System.Drawing.Point(20, 315)
$txtLog.Size = New-Object System.Drawing.Size(560, 130)
$form.Controls.Add($txtLog)

# Função para atualizar logs na UI
function Write-InstallLog($message, $progressValue = -1) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    $txtLog.AppendText("[$timestamp] $message`r`n")
    if ($progressValue -ge 0) {
        $progressBar.Value = $progressValue
    }
    [System.Windows.Forms.Application]::DoEvents()
}

# 9. Botões de Ação
$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Iniciar Instalação"
$btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnInstall.BackColor = $colorAccent
$btnInstall.ForeColor = $colorText
$btnInstall.FlatStyle = "Flat"
$btnInstall.FlatAppearance.BorderSize = 0
$btnInstall.Location = New-Object System.Drawing.Point(20, 465)
$btnInstall.Size = New-Object System.Drawing.Size(270, 40)
$form.Controls.Add($btnInstall)

$btnLaunch = New-Object System.Windows.Forms.Button
$btnLaunch.Text = "Iniciar PDV Restaurante"
$btnLaunch.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnLaunch.BackColor = $colorSuccess
$btnLaunch.ForeColor = $colorText
$btnLaunch.FlatStyle = "Flat"
$btnLaunch.FlatAppearance.BorderSize = 0
$btnLaunch.Enabled = $false
$btnLaunch.Location = New-Object System.Drawing.Point(310, 465)
$btnLaunch.Size = New-Object System.Drawing.Size(270, 40)
$form.Controls.Add($btnLaunch)

# 10. Lógica do Botão Instalar
$btnInstall.Add_Click({
    $btnInstall.Enabled = $false
    $btnBrowse.Enabled = $false
    $txtFolder.ReadOnly = $true
    $rbClean.Enabled = $false
    $rbDemo.Enabled = $false
    
    $destDir = $txtFolder.Text.Trim()
    
    Write-InstallLog "🚀 Iniciando processo de instalação em: $destDir" 5
    
    try {
        # Passo 1: Criar pasta se não existir
        if (-not (Test-Path $destDir)) {
            Write-InstallLog "Criando pasta de destino..."
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        # Passo 2: Copiar arquivos do projeto (do pendrive/origem para o destino)
        Write-InstallLog "Copiando arquivos do sistema (isso pode levar alguns instantes)..." 15
        $sourceDir = $PSScriptRoot
        
        # Copia todos os arquivos excluindo arquivos temporários e o próprio script GUI
        $excludeList = @("node_install.msi", "node-install.msi", "instalar_gui.ps1", ".clean_db")
        Get-ChildItem -Path $sourceDir -Recurse | ForEach-Object {
            $relPath = $_.FullName.Substring($sourceDir.Length + 1)
            $destPath = Join-Path $destDir $relPath
            
            # Pula arquivos da lista de exclusão
            $shouldSkip = $false
            foreach ($ex in $excludeList) {
                if ($_.Name -eq $ex) { $shouldSkip = $true }
            }
            
            if (-not $shouldSkip) {
                if ($_.PSIsContainer) {
                    if (-not (Test-Path $destPath)) {
                        New-Item -ItemType Directory -Path $destPath -Force | Out-Null
                    }
                } else {
                    $parentDir = Split-Path $destPath
                    if (-not (Test-Path $parentDir)) {
                        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
                    }
                    Copy-Item -Path $_.FullName -Destination $destPath -Force | Out-Null
                }
            }
        }
        
        Write-InstallLog "Arquivos copiados com sucesso." 30
        
        # Passo 3: Configurar o sinalizador do banco de dados no destino
        $backendDir = Join-Path $destDir "backend"
        $cleanDbFile = Join-Path $backendDir ".clean_db"
        
        if ($rbClean.Checked) {
            Write-InstallLog "Sinalizando Banco de Dados ZERADO para o primeiro boot..."
            " " | Out-File $cleanDbFile -Encoding utf8
        } else {
            Write-InstallLog "Sinalizando Banco de Dados de DEMONSTRAÇÃO para o primeiro boot..."
            if (Test-Path $cleanDbFile) { Remove-Item $cleanDbFile -Force }
        }
        
        # Passo 4: Verificar e Instalar Node.js
        Write-InstallLog "Verificando se o Node.js está ativo no sistema..." 45
        
        $nodeVersion = ""
        $nodeInstalled = $false
        
        # Adiciona caminhos comuns ao PATH da sessão de instalação
        $env:PATH += ";C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;C:\Users\$env:USERNAME\AppData\Roaming\npm"
        
        try {
            $nodeVersion = & node -v 2>$null
            if ($nodeVersion -match "v\d+") { $nodeInstalled = $true }
        } catch {}
        
        if (-not $nodeInstalled) {
            Write-InstallLog "[AVISO] Node.js não foi encontrado. Iniciando instalação silenciosa..."
            $msiPath = Join-Path $destDir "node-install.msi"
            
            Write-InstallLog "Baixando instalador oficial do Node.js..."
            try {
                # Tenta baixar via curl nativo
                & curl.exe -L -o $msiPath "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" 2>$null
            } catch {
                # Fallback via PowerShell
                Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" -OutFile $msiPath
            }
            
            Write-InstallLog "Executando instalação silenciosa (aguarde)..." 60
            $proc = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
            
            if (Test-Path $msiPath) { Remove-Item $msiPath -Force }
            
            # Recarrega o PATH
            $env:PATH += ";C:\Program Files\nodejs;C:\Program Files (x86)\nodejs"
            Write-InstallLog "Node.js instalado com sucesso." 70
        } else {
            Write-InstallLog "[OK] Node.js já está ativo no sistema: $nodeVersion" 70
        }
        
        # Passo 5: Gerar Prisma Schema localmente
        Write-InstallLog "Gerando o Prisma Client e sincronizando tabelas locais..." 80
        Set-Location $backendDir
        
        & npx.cmd prisma generate 2>&1 | Out-String | ForEach-Object { Write-InstallLog $_.Trim() }
        & npx.cmd prisma db push --accept-data-loss 2>&1 | Out-String | ForEach-Object { Write-InstallLog $_.Trim() }
        
        Set-Location $destDir
        
        # Passo 6: Compilar Frontend React (Vite)
        Write-InstallLog "Compilando arquivos estáticos do Frontend (Vite Build)..." 90
        & npm.cmd run build 2>&1 | Out-String | ForEach-Object { Write-InstallLog $_.Trim() }
        
        # Passo 7: Criar atalhos na Área de Trabalho
        Write-InstallLog "Criando atalhos de Iniciar e Parar na Área de Trabalho..." 95
        & cscript.exe //nologo (Join-Path $destDir "criar_atalhos.vbs")
        
        Write-InstallLog "🎉 PDV RESTAURANTE 2025 INSTALADO COM SUCESSO!" 100
        
        $btnLaunch.Enabled = $true
        
    } catch {
        Write-InstallLog "❌ ERRO CRÍTICO NA INSTALAÇÃO: $_"
        [System.Windows.Forms.MessageBox]::Show("Ocorreu um erro crítico durante a instalação. Detalhes:`n`n$_", "Erro na Instalação", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# 11. Lógica do Botão Iniciar
$btnLaunch.Add_Click({
    $destDir = $txtFolder.Text.Trim()
    $vbsPath = Join-Path $destDir "iniciar.vbs"
    
    Write-InstallLog "Iniciando o PDV Restaurante em segundo plano..."
    
    # Executa o script VBScript silencioso
    Start-Process wscript.exe -ArgumentList "`"$vbsPath`""
    
    # Fecha o formulário
    $form.Close()
})

# Exibir Formulário
$form.ShowDialog() | Out-Null
