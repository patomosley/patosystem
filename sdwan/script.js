// Variáveis globais
let selectedRequestType = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeThemeToggle();
    initializeRequestTypeSelector();
    initializeFormValidation();
    initializeModalEvents();
});

// Controle de tema
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
    });
}

// Seletor de tipo de solicitação
function initializeRequestTypeSelector() {
    const cards = document.querySelectorAll('.request-type-card');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove seleção anterior
            cards.forEach(c => c.classList.remove('selected'));
            
            // Adiciona seleção atual
            this.classList.add('selected');
            
            // Armazena tipo selecionado
            selectedRequestType = this.getAttribute('data-type');
            
            // Mostra campos apropriados
            showFormFields(selectedRequestType);
            
            // Habilita botão de gerar
            updateGenerateButton();
        });
    });
}

// Mostra campos do formulário baseado no tipo
function showFormFields(type) {
    const commonFields = document.getElementById('commonFields');
    const configFields = document.getElementById('configFields');
    const transportFields = document.getElementById('transportFields');
    
    // Mostra campos comuns
    commonFields.classList.add('active');
    
    // Mostra campos específicos
    if (type === 'configuracao') {
        configFields.classList.add('active');
        transportFields.classList.remove('active');
        
        // Limpa campos de transporte
        document.getElementById('configTicket').value = '';
        document.getElementById('additionalItems').value = '';
        
        // Remove required dos campos de transporte
        document.getElementById('configTicket').removeAttribute('required');
        document.getElementById('additionalItems').removeAttribute('required');
        
        // Adiciona required aos campos de configuração
        document.getElementById('equipment').setAttribute('required', '');
        document.getElementById('howToDo').setAttribute('required', '');
        document.getElementById('licenseType').setAttribute('required', '');
        
    } else if (type === 'transporte') {
        transportFields.classList.add('active');
        configFields.classList.remove('active');
        
        // Limpa campos de configuração
        document.getElementById('equipment').value = '';
        document.getElementById('howToDo').value = '';
        document.getElementById('licenseType').value = '';
        
        // Remove required dos campos de configuração
        document.getElementById('equipment').removeAttribute('required');
        document.getElementById('howToDo').removeAttribute('required');
        document.getElementById('licenseType').removeAttribute('required');
        
        // Adiciona required aos campos de transporte
        document.getElementById('configTicket').setAttribute('required', '');
    }
}

// Validação do formulário
function initializeFormValidation() {
    const form = document.getElementById('sdwanForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('input', updateGenerateButton);
        input.addEventListener('change', updateGenerateButton);
    });
    
    form.addEventListener('submit', handleFormSubmit);
}

// Atualiza estado do botão gerar
function updateGenerateButton() {
    const generateBtn = document.getElementById('generateBtn');
    
    if (!selectedRequestType) {
        generateBtn.disabled = true;
        return;
    }
    
    // Verifica campos obrigatórios
    const requiredFields = document.querySelectorAll('input[required], select[required], textarea[required]');
    let allValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            allValid = false;
        }
    });
    
    generateBtn.disabled = !allValid;
}

// Manipula envio do formulário
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!selectedRequestType) {
        showNotification('Por favor, selecione o tipo de solicitação.', 'error');
        return;
    }
    
    const formData = getFormData();
    
    if (!validateFormData(formData)) {
        showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    const result = generateSolicitation(formData);
    showResult(result);
}

// Coleta dados do formulário
function getFormData() {
    return {
        type: selectedRequestType,
        clientName: document.getElementById('clientName').value.trim(),
        project: document.getElementById('project').value.trim(),
        city: document.getElementById('city').value.trim(),
        diagramMaterial: document.getElementById('diagramMaterial').value.trim(),
        diagramWork: document.getElementById('diagramWork').value.trim(),
        equipment: document.getElementById('equipment').value.trim(),
        howToDo: document.getElementById('howToDo').value.trim(),
        licenseType: document.getElementById('licenseType').value,
        configTicket: document.getElementById('configTicket').value.trim(),
        additionalItems: document.getElementById('additionalItems').value.trim()
    };
}

// Valida dados do formulário
function validateFormData(data) {
    // Campos obrigatórios comuns
    if (!data.clientName || !data.project || !data.city || !data.diagramMaterial || !data.diagramWork) {
        return false;
    }
    
    // Validação específica por tipo
    if (data.type === 'configuracao') {
        return data.equipment && data.howToDo && data.licenseType;
    } else if (data.type === 'transporte') {
        return data.configTicket;
    }
    
    return false;
}

// Gera título e descrição da solicitação
function generateSolicitation(data) {
    let title, description;
    
    if (data.type === 'configuracao') {
        title = `SOLICITAÇÃO DE CONFIGURAÇÃO-CLIENTE ${data.clientName.toUpperCase()}-${data.project.toUpperCase()}`;
        
        description = `Peço que seja realizado o envio para o laboratório para configuração
do equipamento de SD-WAN onde posteriormente será necessário o
transporte do material até a localidade para implementação

Dados do Cliente:
Nome: ${data.clientName}
Cidade: ${data.city}

Projeto: ${data.project}
Diagrama material: ${data.diagramMaterial}
Diagrama de mão de Obra: ${data.diagramWork}

Equipamento: ${data.equipment}

Como deve ser feito: ${data.howToDo}

Tipo de licença: ${data.licenseType}`;
        
    } else if (data.type === 'transporte') {
        title = `SOLICITAÇÃO DE TRANSPORTE-CLIENTE ${data.clientName.toUpperCase()}-${data.project.toUpperCase()}`;
        
        description = `Peço que seja realizado o transporte dos seguintes itens para
ativação do serviço de SD-WAN do cliente no qual foram feitas as
configurações pelo Time de Laboratório.

Dados do Cliente:
Nome: ${data.clientName}
Cidade: ${data.city}

Projeto: ${data.project}
Diagrama material: ${data.diagramMaterial}
Diagrama de mão de Obra: ${data.diagramWork}

TICKET REFERENTE A CONFIGURAÇÃO LABORATORIAL: ${data.configTicket}

ITENS ADICIONAIS NO TRANSPORTE: ${data.additionalItems || 'Nenhum item adicional especificado'}`;
    }
    
    return { title, description };
}

// Mostra resultado no modal
function showResult(result) {
    document.getElementById('titleText').textContent = result.title;
    document.getElementById('descriptionText').textContent = result.description;
    document.getElementById('resultModal').style.display = 'flex';
    showNotification('Solicitação gerada com sucesso!', 'success');
}

// Eventos do modal
function initializeModalEvents() {
    const modal = document.getElementById('resultModal');
    
    // Fechar com ESC
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
    
    // Fechar clicando fora
    modal.addEventListener('click', function(event) {
        if (event.target === this) {
            closeModal();
        }
    });
}

// Fecha modal
function closeModal() {
    document.getElementById('resultModal').style.display = 'none';
}

// Gera nova solicitação
function generateNew() {
    closeModal();
    resetForm();
}

// Reset do formulário
function resetForm() {
    // Limpa seleção de tipo
    document.querySelectorAll('.request-type-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    selectedRequestType = null;
    
    // Esconde seções do formulário
    document.getElementById('commonFields').classList.remove('active');
    document.getElementById('configFields').classList.remove('active');
    document.getElementById('transportFields').classList.remove('active');
    
    // Limpa todos os campos
    document.getElementById('sdwanForm').reset();
    
    // Desabilita botão
    document.getElementById('generateBtn').disabled = true;
    
    showNotification('Formulário limpo com sucesso!', 'success');
}

// Copia texto para área de transferência
function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Texto copiado para a área de transferência!', 'success');
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

// Fallback para copiar texto
function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Texto copiado para a área de transferência!', 'success');
    } catch (err) {
        showNotification('Erro ao copiar texto. Selecione e copie manualmente.', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Mostra notificações
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

