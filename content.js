console.log("CRM Kanban v15.0 - Versão Final Montada");
const PLACEHOLDER_IMG = chrome.runtime.getURL("placeholder.png");

// --- FUNÇÕES DE COMUNICAÇÃO COM O BACKGROUND ---
async function salvarDados(uid, data) { try { const response = await chrome.runtime.sendMessage({ action: "salvarDados", uid, data }); return response; } catch (e) { console.error("Falha ao enviar mensagem para salvar dados:", e); } }
async function carregarDados(uid) { try { const response = await chrome.runtime.sendMessage({ action: "carregarDados", uid }); return response; } catch (e) { console.error("Falha ao enviar mensagem para carregar dados:", e); return null; } }

// --- FUNÇÕES HELPERS ---
function resetSidebarForm() {
    document.getElementById('crm-client-name').value = '';
    document.getElementById('crm-client-phone').value = '';
    document.getElementById('crm-client-origin').selectedIndex = 0;
    document.getElementById('crm-indicator-name').value = '';
    document.getElementById('crm-indicator-phone').value = '';
    document.getElementById('crm-indicacao-details').style.display = 'none';
    document.querySelectorAll('input[name="crm-client-tags"]').forEach(tag => tag.checked = false);
    const img = document.getElementById('client-photo-preview');
    if (img) img.src = PLACEHOLDER_IMG;
}

function showToast(message) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function resetCardEditForm() {
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-phone').value = '';
    document.getElementById('edit-origin').value = '';
    document.getElementById('edit-indicator-name').value = '';
    document.getElementById('edit-indicator-phone').value = '';
    document.getElementById('edit-indicacao-details').style.display = 'none';
    document.querySelectorAll('input[name="edit-tags"]').forEach(cb => cb.checked = false);
    document.getElementById('edit-valor').value = '';
    document.getElementById('edit-mensalidade').value = '';
    document.getElementById('edit-gordurinha').value = '';
}

async function capturarDadosCompletos() {
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(800);

    const nomeSpan = Array.from(document.querySelectorAll('span')).find(el =>
        el.offsetHeight > 0 &&
        el.innerText.trim().length >= 4 &&
        el.innerText.trim().split(' ').length >= 2 &&
        !el.innerText.match(/\d/) &&
        !el.innerText.startsWith('+')
    );
    const nome = nomeSpan ? nomeSpan.innerText.trim() : null;

    let telefone = null;
    const painelInfo = document.querySelector('div[data-id]');
    const dataId = painelInfo && painelInfo.getAttribute('data-id');
    if (dataId) {
        const match = dataId.match(/^[^_]*_([^_]+)_/);
        if (match) {
            telefone = formatarTelefone(match[1]);
        }
    }

    let imagem = null;
    const imgPainel = document.querySelector('div[role="button"] img[src*="whatsapp.net"][src*="s96x96"]');
    if (imgPainel && imgPainel.src) {
        imagem = imgPainel.src;
    }

    return { nome, telefone, imagem };
}

function formatarTelefone(numero) {
    const apenasNumeros = numero.replace(/\D/g, '');
    if (apenasNumeros.length === 11) {
        return `(${apenasNumeros.slice(2, 4)}) ${apenasNumeros.slice(4, 9)}-${apenasNumeros.slice(9)}`;
    } else if (apenasNumeros.length === 10) {
        return `(${apenasNumeros.slice(2, 4)}) ${apenasNumeros.slice(4, 8)}-${apenasNumeros.slice(8)}`;
    }
    return numero;
}

// --- MÓDULO: OBSERVADOR DE CONTATO ---
const observadorDeContato = (() => {
    let captureInterval = null;
    function capturarContatoAtivo() {
        try {
            console.log('📲 Iniciando captura de dados do contato...');

            const nomeSpan = Array.from(document.querySelectorAll('span')).find(el =>
                el.offsetHeight > 0 &&
                el.innerText.trim().length >= 4 &&
                el.innerText.trim().split(' ').length >= 2 &&
                !el.innerText.match(/\d/) &&
                !el.innerText.startsWith('+')
            );
            const nome = nomeSpan ? nomeSpan.innerText.trim() : null;

            const imgEl = document.querySelector('header img');
            const imagem = imgEl && imgEl.src.includes('whatsapp.net') ? imgEl.src : null;

            let telefone = null;
            const linkTel = document.querySelector('a[href^="tel:"]');
            if (linkTel) {
                telefone = linkTel.innerText.trim();
            } else {
                const candidato = Array.from(document.querySelectorAll('div, span'))
                    .map(el => el.innerText.trim())
                    .find(txt => /^\+\d{2}\s?\d{2}\s?\d{4,5}-\d{4}$/.test(txt));
                telefone = candidato || null;
            }

            if (!nome && !telefone && !imagem) return null;

            return { imagem, nome, telefone };
        } catch (erro) {
            console.error('Erro ao capturar dados do contato:', erro);
            return null;
        }
    }

    function preencherPainelLateral({ imagem, nome, telefone }) {
        const sidebar = document.getElementById('crm-sidebar');
        const precheckView = document.getElementById('precheck-view');
        if (!sidebar || !precheckView) return;

        document.getElementById('precheck-name').value = nome || '';
        document.getElementById('precheck-phone').value = telefone || '';
        const img = document.getElementById('precheck-photo');
        if (img) img.src = imagem || PLACEHOLDER_IMG;

        document.getElementById('client-form-view').style.display = 'none';
        document.getElementById('deal-form-view').style.display = 'none';
        document.getElementById('task-form-view').style.display = 'none';
        document.getElementById('post-save-view').style.display = 'none';
        precheckView.style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Verificação Automática';
        sidebar.classList.add('visible');

        window.lastCapturedContact = { name: nome, phone: telefone, photo: imagem };
    }

    function tentarCapturarContatoRepetidamente() {
        if (captureInterval) clearInterval(captureInterval);
        captureInterval = setInterval(() => {
            const dados = capturarContatoAtivo();
            if (dados && dados.imagem && dados.nome && dados.telefone) {
                console.log('Dados capturados com sucesso:', dados);
                preencherPainelLateral(dados);
                clearInterval(captureInterval);
                captureInterval = null;
            }
        }, 1000);
    }

    // 🧠 Atualização do content.js para execução somente via clique do botão da extensão
    function iniciar() {
        const botaoCaptura = document.querySelector("#abrirPainelCRM");
        if (botaoCaptura) {
            botaoCaptura.addEventListener("click", () => {
                console.log("📥 Botão clicado: iniciando captura do contato...");
                tentarCapturarContatoRepetidamente();
            });
        } else {
            console.warn("⚠️ Botão #abrirPainelCRM não encontrado. Verifique se está carregado.");
        }
    }

    return { iniciar, capturarContatoAtivo };
})();
function openClientForm(data = {}) {
    document.getElementById('precheck-view').style.display = 'none';
    document.getElementById('client-form-view').style.display = 'block';
    document.getElementById('post-save-view').style.display = 'none';
    document.getElementById('deal-form-view').style.display = 'none';
    document.getElementById('task-form-view').style.display = 'none';
    document.getElementById('sidebar-title').innerText = 'Adicionar Cliente';
    resetSidebarForm();
    document.getElementById('crm-client-name').value = data.name || '';
    document.getElementById('crm-client-phone').value = data.phone || '';
    const img = document.getElementById('client-photo-preview');
    if (img) img.src = data.photo || PLACEHOLDER_IMG;
    document.getElementById('crm-sidebar').classList.add('visible');
}

// --- FUNÇÕES DRAG-AND-DROP ---
function handleDragStart(event) { event.dataTransfer.setData("text/plain", event.target.id); setTimeout(() => { event.target.classList.add('dragging'); }, 0); }
function handleDragEnd(event) { event.target.classList.remove('dragging'); }
function handleDragOver(event) { event.preventDefault(); }
async function handleDrop(event) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text");
    const draggedCard = document.getElementById(cardId);
    const targetColumnElement = event.target.closest('.kanban-column');
    if (!targetColumnElement || !draggedCard) return;
    if (targetColumnElement.dataset.id === 'Tarefas Pendentes') { return; }
    const itemsContainer = targetColumnElement.querySelector('.kanban-items');
    if (itemsContainer && !itemsContainer.contains(draggedCard)) {
        itemsContainer.appendChild(draggedCard);
        await saveBoardState();
    }
}
async function saveBoardState() {
    const board = document.querySelector('.kanban-board');
    const columns = board.querySelectorAll('.kanban-column');
    let crmData = await carregarDados("kanban_data");
    let allClients = []; (crmData.columns || []).forEach(col => { if(col.clients) allClients.push(...col.clients); }); Object.values(crmData.clients || {}).forEach(client => { if(!allClients.find(c => c.id === client.id)) allClients.push(client); });
    let allTasks = []; (crmData.columns || []).forEach(col => { if(col.tasks) allTasks.push(...col.tasks); });
    let newColumns = [];
    columns.forEach(columnEl => {
        const columnTitle = columnEl.dataset.id;
        const columnObj = { title: columnTitle, clients: [], tasks: [] };
        const cards = columnEl.querySelectorAll('.kanban-card');
        cards.forEach(cardEl => {
            if (cardEl.classList.contains('task-card')) { const task = allTasks.find(t => t.id === cardEl.id); if(task) columnObj.tasks.push(task); }
            else { const client = allClients.find(c => c.id === cardEl.id); if (client) columnObj.clients.push(client); }
        });
        newColumns.push(columnObj);
    });
    crmData.columns = newColumns;
    await salvarDados("kanban_data", crmData);
    console.log("Estado do painel salvo.");
    await updateDashboard();
}

// --- FUNÇÕES DE GERENCIAMENTO DE COLUNAS ---
async function handleAddNewColumn() {
    const newColumnName = prompt("Digite o nome da nova coluna:");
    if (!newColumnName || !newColumnName.trim()) return;
    const crmData = await carregarDados("kanban_data");
    if (crmData.columns.some(c => c.title.toLowerCase() === newColumnName.trim().toLowerCase())) {
        showToast('Já existe uma coluna com este nome.');
        return;
    }
    crmData.columns.push({ title: newColumnName.trim(), clients: [], tasks: [] });
    await salvarDados("kanban_data", crmData);
    await renderKanbanBoard();
}
async function handleColumnRename(titleElement, oldName) {
    if (oldName === "Tarefas Pendentes") return;
    titleElement.contentEditable = true;
    titleElement.focus();
    const originalHTML = titleElement.innerHTML;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(titleElement);
    const deleteBtn = titleElement.querySelector('.delete-column-btn');
    if (deleteBtn) range.setEndBefore(deleteBtn);
    selection.removeAllRanges();
    selection.addRange(range);
    const saveName = async () => {
        titleElement.contentEditable = false;
        const newName = titleElement.innerText.trim();
        if (newName && newName !== oldName) {
            const crmData = await carregarDados("kanban_data");
            const columnToRename = crmData.columns.find(col => col.title === oldName);
            if (crmData.columns.some(c => c.title.toLowerCase() === newName.toLowerCase())) {
                showToast('Já existe uma coluna com este nome.');
                titleElement.innerHTML = originalHTML;
            } else if (columnToRename) {
                columnToRename.title = newName;
                await salvarDados("kanban_data", crmData);
                await renderKanbanBoard();
            }
        } else {
            titleElement.innerHTML = originalHTML;
        }
    };
    titleElement.addEventListener('blur', saveName, { once: true });
    titleElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleElement.blur();
        } else if (e.key === 'Escape') {
            titleElement.innerHTML = originalHTML;
            titleElement.blur();
        }
    }, { once: true });
}
async function handleColumnDelete(columnName) {
    if (columnName === "Tarefas Pendentes") {
        showToast('A coluna de tarefas não pode ser excluída.');
        return;
    }
    const crmData = await carregarDados("kanban_data");
    const columnToDelete = crmData.columns.find(col => col.title === columnName);
    if (columnToDelete && (columnToDelete.clients?.length > 0 || columnToDelete.tasks?.length > 0)) {
        showToast('Apenas colunas vazias podem ser excluídas.');
        return;
    }
    if (confirm(`Tem certeza que deseja excluir a coluna "${columnName}"?`)) {
        crmData.columns = crmData.columns.filter(col => col.title !== columnName);
        await salvarDados("kanban_data", crmData);
        await renderKanbanBoard();
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function createClientCardElement(clientData) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.id = clientData.id;
    card.draggable = true;
    const tagsHTML = (clientData.tags || [])
        .map(tag => `<span class="card-tag">${tag}</span>`)
        .join('');
    const dealsHTML = (clientData.deals || [])
        .map(deal => `<div class="deal-item"><strong>${deal.title || 'Negócio'}</strong> (${deal.creationDate})<br>Adesão: R$${(deal.valor || 0).toFixed(2)} | Mensal: R$${(deal.mensalidade || 0).toFixed(2)}</div>`)
        .join('');
    card.innerHTML = `
        <div class="card-header">
            <img class="card-photo" src="${clientData.photo || PLACEHOLDER_IMG}" alt="Foto">
            <div class="card-info"><h4>${clientData.name || 'Sem Nome'}</h4><p>${clientData.phone || ''}</p></div>
        </div>
        <div class="card-tags">${tagsHTML}</div>
        ${dealsHTML ? `<div class="card-deals-container">${dealsHTML}</div>` : ''}`;
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dblclick', () => openCardEditPanel(clientData.id, 'client'));
    return card;
}
function createTaskCardElement(taskData, crmData) {
    const card = document.createElement('div');
    card.className = 'kanban-card task-card';
    card.id = taskData.id;
    card.dataset.taskId = taskData.id;
    card.draggable = false;
    let clientName = '';
    if (crmData) {
        clientName = crmData.clients?.[taskData.clientId]?.name || '';
        if (!clientName) {
            for (const col of crmData.columns || []) {
                const c = (col.clients || []).find(cl => cl.id === taskData.clientId);
                if (c) { clientName = c.name; break; }
            }
        }
    }
    card.innerHTML = `<button class="delete-task-btn" title="Concluir/Excluir Tarefa">&times;</button><div class="card-highlight">${taskData.highlight}</div>${clientName ? `<div class="task-client-name">${clientName}</div>` : ''}<div class="card-notes">${taskData.notes}</div><div class="card-creation-date">Criado em: ${taskData.creationDate}</div>`;
    card.addEventListener('dblclick', () => openCardEditPanel(taskData.id, 'task'));
    return card;
}
function createColumnElement(columnData, crmData) {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.id = columnData.title;
    if (columnData.title === 'Tarefas Pendentes') column.id = 'task-column';
    const title = document.createElement('h3');
    title.innerText = columnData.title;
    if (columnData.title !== 'Tarefas Pendentes') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-column-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Excluir Coluna';
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleColumnDelete(columnData.title); };
        title.appendChild(deleteBtn);
        title.addEventListener('dblclick', () => handleColumnRename(title, columnData.title));
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
    }
    const totalEl = document.createElement('div');
    totalEl.className = 'column-total';
    if (columnData.title !== 'Tarefas Pendentes') {
        let totalValor = 0;
        (columnData.clients || []).forEach(client => {
            (client.deals || []).forEach(deal => { totalValor += deal.valor || 0; });
        });
        totalEl.textContent = `💵 Total: ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }
    const countEl = document.createElement('div');
    countEl.className = 'column-count';
    countEl.textContent = `(${((columnData.clients || []).length + (columnData.tasks || []).length)} cards)`;
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'kanban-items';
    if (columnData.tasks) {
        columnData.tasks.forEach(task => itemsContainer.appendChild(createTaskCardElement(task, crmData)));
    }
    if (columnData.clients) {
        columnData.clients.forEach(client => itemsContainer.appendChild(createClientCardElement(client)));
    }
    column.appendChild(title);
    column.appendChild(countEl);
    if (columnData.title !== 'Tarefas Pendentes') column.appendChild(totalEl);
    column.appendChild(itemsContainer);
    return column;
}
async function updateColumnTotals(crmData) {
    if (!crmData) crmData = await carregarDados('kanban_data');
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(colEl => {
        const colData = crmData.columns.find(c => c.title === colEl.dataset.id);
        if (!colData || colData.title === 'Tarefas Pendentes') return;
        let totalValor = 0;
        (colData.clients || []).forEach(client => {
            (client.deals || []).forEach(deal => { totalValor += deal.valor || 0; });
        });
        const totalEl = colEl.querySelector('.column-total');
        if (totalEl) {
            totalEl.textContent = `\uD83D\uDCB5 Total: ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        }
        const countEl = colEl.querySelector('.column-count');
        if (countEl) {
            countEl.textContent = `(${((colData.clients || []).length + (colData.tasks || []).length)} cards)`;
        }
    });
}

async function updateDashboard() {
    const crmData = await carregarDados("kanban_data");
    if (!crmData || !crmData.columns) return;
    let totalDeals = 0;
    let totalTasks = 0;
    let totalValor = 0;
    crmData.columns.forEach(column => {
        if (column.title === 'Tarefas Pendentes') {
            totalTasks += (column.tasks || []).length;
        }
        (column.clients || []).forEach(client => {
            totalDeals += (client.deals || []).length;
            (client.deals || []).forEach(deal => { totalValor += deal.valor || 0; });
        });
    });
    const dealsEl = document.querySelector('#indicator-deals strong');
    const tasksEl = document.querySelector('#indicator-tasks strong');
    const valueEl = document.querySelector('#indicator-value strong');
    if (dealsEl) dealsEl.textContent = totalDeals;
    if (tasksEl) tasksEl.textContent = totalTasks;
    if (valueEl) valueEl.textContent = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await updateColumnTotals(crmData);
}
async function renderKanbanBoard() {
    const boardContainer = document.querySelector('.kanban-board');
    if (!boardContainer) return;
    boardContainer.innerHTML = '<p>Carregando...</p>';
    let crmData = await carregarDados("kanban_data");
    if (!crmData || !crmData.columns) {
        crmData = { clients: {}, columns: [{ title: 'Tarefas Pendentes', tasks: [] }, { title: 'Em Negociação', clients: [] }] };
        await salvarDados("kanban_data", crmData);
    }
    boardContainer.innerHTML = '';
    crmData.columns.forEach(columnData => boardContainer.appendChild(createColumnElement(columnData, crmData)));
    const addColumnContainer = document.createElement('div');
    addColumnContainer.className = 'add-column-container';
    addColumnContainer.innerHTML = `<button id="add-new-column-btn" class="add-column-btn">+ Adicionar Nova Coluna</button>`;
    boardContainer.appendChild(addColumnContainer);
    document.getElementById('add-new-column-btn').onclick = handleAddNewColumn;
    await updateDashboard();
}
async function openCardEditPanel(id, type) {
    const panel = document.getElementById('card-edit-panel');
    resetCardEditForm();
    panel.dataset.cardId = id;
    panel.dataset.cardType = type;
    const crmData = await carregarDados('kanban_data');
    let data;
    if (type === 'task') {
        for (const col of crmData.columns || []) {
            const t = (col.tasks || []).find(tsk => tsk.id === id);
            if (t) { data = t; break; }
        }
        document.getElementById('edit-origin').parentElement.style.display = 'none';
        document.querySelector('#edit-panel-tags').style.display = 'none';
        document.getElementById('edit-valor').parentElement.style.display = 'none';
        document.getElementById('edit-mensalidade').parentElement.style.display = 'none';
        document.getElementById('edit-gordurinha').parentElement.style.display = 'none';
        document.getElementById('edit-indicacao-details').style.display = 'none';
        document.getElementById('edit-task-client-group').style.display = 'block';
        await populateClientSelect('edit-task-client', data?.clientId);
        document.querySelector("label[for='edit-name']").textContent = 'Assunto';
        document.querySelector("label[for='edit-phone']").textContent = 'Informações';
        document.getElementById('edit-name').value = data?.highlight || '';
        document.getElementById('edit-phone').value = data?.notes || '';
    } else {
        data = crmData.clients?.[id];
        if (!data) {
            for (const col of crmData.columns || []) {
                data = (col.clients || []).find(c => c.id === id);
                if (data) break;
            }
        }
        document.getElementById('edit-task-client-group').style.display = 'none';
        document.querySelector("label[for='edit-name']").textContent = 'Nome';
        document.querySelector("label[for='edit-phone']").textContent = 'Telefone';
        document.getElementById('edit-origin').parentElement.style.display = '';
        document.querySelector('#edit-panel-tags').style.display = '';
        document.getElementById('edit-valor').parentElement.style.display = '';
        document.getElementById('edit-mensalidade').parentElement.style.display = '';
        document.getElementById('edit-gordurinha').parentElement.style.display = '';
        document.getElementById('edit-name').value = data?.name || '';
        document.getElementById('edit-phone').value = data?.phone || '';
        document.getElementById('edit-origin').value = data?.origin || '';
        document.getElementById('edit-indicator-name').value = data?.indicator?.name || '';
        document.getElementById('edit-indicator-phone').value = data?.indicator?.phone || '';
        document.getElementById('edit-indicacao-details').style.display = (data?.origin === 'Indicação') ? 'block' : 'none';
        document.querySelectorAll('input[name="edit-tags"]').forEach(cb => {
            cb.checked = (data?.tags || []).includes(cb.value);
        });
        document.getElementById('edit-valor').value = data?.deals?.[0]?.valor || '';
        document.getElementById('edit-mensalidade').value = data?.deals?.[0]?.mensalidade || '';
        document.getElementById('edit-gordurinha').value = data?.deals?.[0]?.gordurinha || '';
    }
    panel.classList.add('visible');
}

async function saveCardEdit() {
    const panel = document.getElementById('card-edit-panel');
    const id = panel.dataset.cardId;
    const type = panel.dataset.cardType;
    const crmData = await carregarDados('kanban_data');
    if (type === 'task') {
        for (const col of crmData.columns || []) {
            const t = (col.tasks || []).find(tsk => tsk.id === id);
            if (t) {
                t.highlight = document.getElementById('edit-name').value;
                t.notes = document.getElementById('edit-phone').value;
                t.clientId = document.getElementById('edit-task-client').value;
                break;
            }
        }
    } else {
        let client = crmData.clients?.[id];
        if (!client) {
            for (const col of crmData.columns || []) {
                client = (col.clients || []).find(c => c.id === id);
                if (client) break;
            }
        }
        if (client) {
            client.name = document.getElementById('edit-name').value;
            client.phone = document.getElementById('edit-phone').value;
            client.origin = document.getElementById('edit-origin').value;
            client.indicator = (client.origin === 'Indicação') ? {
                name: document.getElementById('edit-indicator-name').value,
                phone: document.getElementById('edit-indicator-phone').value
            } : null;
            client.tags = Array.from(document.querySelectorAll('input[name="edit-tags"]:checked')).map(cb => cb.value);
            const valor = parseFloat(document.getElementById('edit-valor').value) || 0;
            const mensalidade = parseFloat(document.getElementById('edit-mensalidade').value) || 0;
            const gordurinha = parseFloat(document.getElementById('edit-gordurinha').value) || 0;
            if (!client.deals) client.deals = [{}];
            if (!client.deals[0]) client.deals[0] = {};
            client.deals[0].valor = valor;
            client.deals[0].mensalidade = mensalidade;
            client.deals[0].gordurinha = gordurinha;
        }
    }
    await salvarDados('kanban_data', crmData);
    showToast('Salvo com sucesso ✅');
    closeCardEditPanel();
    await renderKanbanBoard();
}

function closeCardEditPanel() {
    const panel = document.getElementById('card-edit-panel');
    panel.classList.remove('visible');
    panel.dataset.cardId = '';
    panel.dataset.cardType = '';
    resetCardEditForm();
}
// --- FUNÇÃO PRINCIPAL QUE CONSTRÓI A UI ---
function buildUI() {
    if (document.getElementById('crm-fab-container')) return;

    const mainHTML = `
        <div id="crm-sidebar">
            <div class="sidebar-header"><button class="close-btn">&times;</button><h2 id="sidebar-title">Adicionar Cliente</h2></div>
            <div class="sidebar-content">
                <div id="precheck-view" style="display:none;">
                    <img id="precheck-photo" src="${PLACEHOLDER_IMG}" alt="Foto" style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin:0 auto 20px;display:block;">
                    <div class="form-group"><label>Nome</label><input type="text" id="precheck-name" readonly></div>
                    <div class="form-group"><label>Telefone</label><input type="text" id="precheck-phone" readonly></div>
                    <button id="precheck-start-btn" class="action-button">Iniciar Cadastro</button>
                </div>
                <div id="client-form-view">
                    <img id="client-photo-preview" src="${PLACEHOLDER_IMG}" alt="Foto" style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin:0 auto 20px;display:block;">
                    <div class="form-group"><label for="crm-client-name">Nome</label><input type="text" id="crm-client-name"></div>
                    <div class="form-group"><label for="crm-client-phone">Telefone</label><input type="text" id="crm-client-phone"></div>
                    <div class="form-group"><label for="crm-client-origin">Origem</label><select id="crm-client-origin"><option value="">Selecione...</option><option value="Indicação">Indicação</option><option value="Já é cliente">Já é cliente</option><option value="Captação">Captação</option></select></div>
                    <div id="crm-indicacao-details" class="fieldset" style="display:none;"><legend>Dados da Indicação</legend><div class="form-group"><label for="crm-indicator-name">Nome de quem indicou</label><input type="text" id="crm-indicator-name"></div><div class="form-group"><label for="crm-indicator-phone">Telefone</label><input type="text" id="crm-indicator-phone"></div></div>
                    <div class="fieldset"><legend>Categoria (Tags)</legend><div class="tags-group"><label><input type="checkbox" name="crm-client-tags" value="Em negociação"> Em negociação</label><label><input type="checkbox" name="crm-client-tags" value="Fechou"> Fechou</label><label><input type="checkbox" name="crm-client-tags" value="Esfriou"> Esfriou</label></div></div>
                    <button id="save-client-btn" class="action-button">Salvar Cliente</button>
                </div>
                <div id="post-save-view" style="display: none;">
                    <h3>Cliente Salvo!</h3><p>Qual o próximo passo?</p>
                    <div class="post-save-actions"><button id="sidebar-add-task-btn" class="post-save-action-btn">Adicionar Tarefa</button><button id="sidebar-add-deal-btn" class="post-save-action-btn">Cadastrar Novo Negócio</button></div>
                </div>
                <div id="deal-form-view" style="display: none;">
                    <div class="form-group"><label for="deal-title">Título do Negócio</label><input type="text" id="deal-title"></div>
                    <div class="form-group"><label for="deal-valor">Valor (Adesão)</label><input type="number" id="deal-valor"></div>
                    <div class="form-group"><label for="deal-mensalidade">Mensalidade</label><input type="number" id="deal-mensalidade"></div>
                    <div class="form-group"><label for="deal-gordurinha">Gordurinha</label><input type="number" id="deal-gordurinha"></div>
                    <button id="save-deal-btn" class="action-button">Salvar Negócio</button>
                </div>
                <div id="task-form-view" style="display: none;">
                    <div class="form-group"><label for="task-client">Cliente</label><select id="task-client"></select></div>
                    <div class="form-group"><label for="task-highlight">Destaque da Tarefa</label><input type="text" id="task-highlight"></div>
                    <div class="form-group"><label for="task-notes">Observações</label><textarea id="task-notes" rows="4"></textarea></div>
                    <button id="save-task-btn" class="action-button">Salvar Tarefa</button>
                </div>
            </div>
        </div>
        <div id="card-edit-panel" class="card-edit-panel">
            <div class="sidebar-header"><button class="close-btn">&times;</button><h2>Editar Card</h2></div>
            <div class="sidebar-content">
                <div id="edit-task-client-group" class="form-group"><label for="edit-task-client">Cliente</label><select id="edit-task-client"></select></div>
                <div class="form-group"><label for="edit-name">Nome</label><input type="text" id="edit-name"></div>
                <div class="form-group"><label for="edit-phone">Telefone</label><input type="text" id="edit-phone"></div>
                <div class="form-group"><label for="edit-origin">Origem</label><select id="edit-origin"><option value="">Selecione...</option><option value="Indicação">Indicação</option><option value="Já é cliente">Já é cliente</option><option value="Captação">Captação</option></select></div>
                <div id="edit-indicacao-details" class="fieldset" style="display:none;"><legend>Dados da Indicação</legend><div class="form-group"><label for="edit-indicator-name">Nome de quem indicou</label><input type="text" id="edit-indicator-name"></div><div class="form-group"><label for="edit-indicator-phone">Telefone de quem indicou</label><input type="text" id="edit-indicator-phone"></div></div>
                <div id="edit-panel-tags" class="fieldset"><legend>Categoria (Tags)</legend><div class="tags-group"><label><input type="checkbox" name="edit-tags" value="Em negociação"> Em negociação</label><label><input type="checkbox" name="edit-tags" value="Fechou"> Fechou</label><label><input type="checkbox" name="edit-tags" value="Esfriou"> Esfriou</label></div></div>
                <div class="form-group"><label for="edit-valor">Valor</label><input type="number" id="edit-valor"></div>
                <div class="form-group"><label for="edit-mensalidade">Mensalidade</label><input type="number" id="edit-mensalidade"></div>
                <div class="form-group"><label for="edit-gordurinha">Gordurinha</label><input type="number" id="edit-gordurinha"></div>
            </div>
            <button id="save-edit-btn" class="action-button">Salvar alterações</button>
        </div>
        <div id="kanban-panel-container">
            <div id="kanban-panel-content">
                <div class="kanban-header">
                    <h2 class="kanban-title">Wesley — Consultor Especializado em Proteção Veicular</h2>
                    <div class="kanban-search"><input type="text" id="kanban-search-input" placeholder="Buscar cliente..."><button id="kanban-search-btn">🔍</button><button id="kanban-search-clear">✖</button></div>
                    <div class="kanban-indicators">
                        <span id="indicator-deals">Negócios: <strong>0</strong></span>
                        <span id="indicator-tasks">Tarefas: <strong>0</strong></span>
                        <span id="indicator-value">💰 <strong>R$0,00</strong></span>
                    </div>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="kanban-board"></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', mainHTML);
    document.body.insertAdjacentHTML("beforeend", "<div id=\"toast-message\"></div>");
    
    const fabContainer = document.createElement('div'); fabContainer.className = 'fab-container'; fabContainer.id = 'crm-fab-container';
    const kanbanBtn = document.createElement('button'); kanbanBtn.className = 'crm-action-button'; kanbanBtn.title = 'Abrir CRM Kanban'; kanbanBtn.innerHTML = `<img src="${chrome.runtime.getURL('panel_icon.svg')}" alt="Abrir CRM">`;
    const addClientBtn = document.createElement('button'); addClientBtn.className = 'crm-action-button'; addClientBtn.title = 'Adicionar Cliente'; addClientBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>`;
    fabContainer.appendChild(addClientBtn); fabContainer.appendChild(kanbanBtn);
    document.body.appendChild(fabContainer);

    const quick = document.createElement('div');
    quick.className = 'quick-actions';
    quick.id = 'crm-quick-actions';
    quick.innerHTML = `
        <button id="quick-deal-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 7v2m1-1H7" stroke="currentColor"/></svg> Novo Negócio</button>
        <button id="quick-task-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 7v2m1-1H7" stroke="currentColor"/></svg> Nova Tarefa</button>`;
    document.body.appendChild(quick);
    quick.style.display = 'none';
    
    let lastSavedClientId = null;
    let lastSavedIndicatorName = '';
    let precheckData = null;

    function showPrecheckPanel(data) {
        if (!data) {
            showToast("Nenhuma conversa ativa para capturar.");
            return;
        }
        const nome = data.nome || data.name || "";
        const telefone = data.telefone || data.phone || "";
        const imagem = data.imagem || data.photo || PLACEHOLDER_IMG;
        document.getElementById("precheck-name").value = nome;
        document.getElementById("precheck-phone").value = telefone;
        document.getElementById("precheck-photo").src = imagem;
        document.getElementById("client-form-view").style.display = "none";
        document.getElementById("deal-form-view").style.display = "none";
        document.getElementById("task-form-view").style.display = "none";
        document.getElementById("post-save-view").style.display = "none";
        document.getElementById("precheck-view").style.display = "block";
        document.getElementById("sidebar-title").innerText = "Verificação Automática";
        document.getElementById("crm-sidebar").classList.add("visible");
        precheckData = { name: nome, phone: telefone, photo: imagem };
    }

    // Torna a função acessível globalmente para outros módulos
    window.showPrecheckPanel = showPrecheckPanel;

    function hidePrecheckPanel() {
        document.getElementById('precheck-view').style.display = 'none';
    }

    async function populateClientSelect(selectId = 'task-client', selectedId = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '';
        const crmData = await carregarDados('kanban_data');
        const clients = [];
        if (crmData.clients) clients.push(...Object.values(crmData.clients));
        (crmData.columns || []).forEach(col => { if (col.clients) clients.push(...col.clients); });
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name ? `${c.name} - ${c.phone}` : c.phone;
            select.appendChild(opt);
        });
        if (clients.length > 0) select.value = selectedId || clients[0].id;
    }

    addClientBtn.onclick = async () => {
        const dados = await capturarDadosCompletos();
        console.log('🎯 Resultado final:', dados);
        showPrecheckPanel(dados);
    };
    const quickActions = document.getElementById('crm-quick-actions');
    kanbanBtn.onclick = () => {
        renderKanbanBoard();
        document.getElementById('kanban-panel-container').classList.add('visible');
        if (quickActions) quickActions.style.display = 'flex';
    };
    document.getElementById('kanban-panel-content').addEventListener('click', (e) => {
        if (quickActions && !quickActions.contains(e.target)) quickActions.style.display = 'none';
    });
    document.querySelector('#crm-sidebar .close-btn').onclick = () => {
        hidePrecheckPanel();
        document.getElementById('crm-sidebar').classList.remove('visible');
    };
    document.querySelector('#kanban-panel-container .close-btn').onclick = () => {
        document.getElementById('kanban-panel-container').classList.remove('visible');
        if (quickActions) quickActions.style.display = 'none';
    };
    document.getElementById('precheck-start-btn').onclick = () => {
        const data = window.lastCapturedContact || precheckData || {};
        openClientForm(data);
        hidePrecheckPanel();
    };
    document.querySelector('#card-edit-panel .close-btn').onclick = closeCardEditPanel;
    document.getElementById('save-edit-btn').onclick = saveCardEdit;
    document.getElementById('crm-client-origin').onchange = (e) => { document.getElementById('crm-indicacao-details').style.display = (e.target.value === 'Indicação') ? 'block' : 'none'; };
    document.getElementById('edit-origin').onchange = (e) => { document.getElementById('edit-indicacao-details').style.display = (e.target.value === 'Indicação') ? 'block' : 'none'; };

    document.getElementById('quick-task-btn').onclick = async () => {
        document.getElementById('deal-form-view').style.display = 'none';
        document.getElementById('client-form-view').style.display = 'none';
        document.getElementById('post-save-view').style.display = 'none';
        document.getElementById('task-form-view').style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Nova Tarefa';
        await populateClientSelect('task-client');
        document.getElementById('crm-sidebar').classList.add('visible');
    };
    document.getElementById('quick-deal-btn').onclick = () => {
        document.getElementById('task-form-view').style.display = 'none';
        document.getElementById('client-form-view').style.display = 'none';
        document.getElementById('post-save-view').style.display = 'none';
        document.getElementById('deal-form-view').style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Novo Negócio';
        document.getElementById('crm-sidebar').classList.add('visible');
    };

    document.getElementById('kanban-search-btn').onclick = () => {
        const term = document.getElementById('kanban-search-input').value.toLowerCase();
        document.querySelectorAll('.kanban-card').forEach(card => {
            const nameEl = card.querySelector('.card-info h4') || card.querySelector('.task-client-name');
            const text = nameEl ? nameEl.textContent.toLowerCase() : '';
            card.style.display = term && !text.includes(term) ? 'none' : '';
        });
    };
    document.getElementById('kanban-search-clear').onclick = () => {
        document.getElementById('kanban-search-input').value = '';
        document.querySelectorAll('.kanban-card').forEach(card => card.style.display = '');
    };
    
    document.getElementById('save-client-btn').onclick = async () => {
        const clientData = { id: 'client_' + Date.now(), name: document.getElementById('crm-client-name').value, phone: document.getElementById('crm-client-phone').value, photo: document.getElementById('client-photo-preview').src, origin: document.getElementById('crm-client-origin').value, indicator: (document.getElementById('crm-client-origin').value === 'Indicação') ? { name: document.getElementById('crm-indicator-name').value, phone: document.getElementById('crm-indicator-phone').value } : null, tags: Array.from(document.querySelectorAll('input[name="crm-client-tags"]:checked')).map(cb => cb.value), deals: [], tasks: [] };
        if (!clientData.name && !clientData.phone) {
            showToast('É preciso ter ao menos um Nome ou Telefone.');
            return;
        }
        lastSavedClientId = clientData.id; lastSavedIndicatorName = clientData.indicator ? clientData.indicator.name : '';
        const crmData = await carregarDados("kanban_data") || { clients: {}, columns: [] };
        if (!crmData.clients) crmData.clients = {}; crmData.clients[lastSavedClientId] = clientData;
        await salvarDados("kanban_data", crmData);
        document.getElementById('client-form-view').style.display = 'none';
        document.getElementById('post-save-view').style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Próximos Passos';
    };
    
    document.getElementById('sidebar-add-deal-btn').onclick = () => { document.getElementById('post-save-view').style.display = 'none'; document.getElementById('deal-form-view').style.display = 'block'; document.getElementById('sidebar-title').innerText = 'Novo Negócio'; };
    document.getElementById('save-deal-btn').onclick = async () => {
        const dealData = { title: document.getElementById('deal-title').value, valor: parseFloat(document.getElementById('deal-valor').value) || 0, mensalidade: parseFloat(document.getElementById('deal-mensalidade').value) || 0, gordurinha: parseFloat(document.getElementById('deal-gordurinha').value) || 0, creationDate: new Date().toLocaleDateString('pt-BR'), indicatorName: lastSavedIndicatorName };
        const crmData = await carregarDados("kanban_data"); const newClient = crmData.clients[lastSavedClientId];
        if (!newClient) { showToast('Erro: Cliente não encontrado para adicionar o negócio.'); return; }
        if (!newClient.deals) newClient.deals = []; newClient.deals.push(dealData);
        let dealColumn = crmData.columns.find(col => col.title === "Em Negociação");
        if (!dealColumn) { crmData.columns.push({ title: "Em Negociação", clients: [] }); dealColumn = crmData.columns[crmData.columns.length - 1]; }
        dealColumn.clients.unshift(newClient); delete crmData.clients[lastSavedClientId];
        await salvarDados("kanban_data", crmData);
        await renderKanbanBoard();
        document.getElementById('deal-form-view').style.display = 'none';
        document.getElementById('crm-sidebar').classList.remove('visible');
        showToast('Salvo com sucesso ✅');
    };

    document.getElementById('sidebar-add-task-btn').onclick = async () => {
        document.getElementById('post-save-view').style.display = 'none';
        document.getElementById('task-form-view').style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Nova Tarefa';
        await populateClientSelect('task-client', lastSavedClientId);
    };
    document.getElementById('save-task-btn').onclick = async () => {
        const taskData = { id: 'task_' + Date.now(), highlight: document.getElementById('task-highlight').value, notes: document.getElementById('task-notes').value, creationDate: new Date().toLocaleDateString('pt-BR'), clientId: document.getElementById('task-client').value || lastSavedClientId };
        if (!taskData.highlight) {
            showToast('O Destaque da Tarefa é obrigatório.');
            return;
        }
        const crmData = await carregarDados("kanban_data");
        let taskColumn = crmData.columns.find(col => col.title === 'Tarefas Pendentes');
        if (!taskColumn) { taskColumn = { title: 'Tarefas Pendentes', tasks: [] }; crmData.columns.unshift(taskColumn); }
        if (!taskColumn.tasks) taskColumn.tasks = [];
        taskColumn.tasks.unshift(taskData);
        await salvarDados("kanban_data", crmData);
        await renderKanbanBoard();
        document.getElementById('task-highlight').value = ''; document.getElementById('task-notes').value = '';
        document.getElementById('task-form-view').style.display = 'none';
        document.getElementById('crm-sidebar').classList.remove('visible');
        showToast('Salvo com sucesso ✅');
    };
    
    document.querySelector('.kanban-board').addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-task-btn')) {
            const card = event.target.closest('.task-card');
            if (card) {
                const taskId = card.dataset.taskId;
                if (confirm("Tem certeza que deseja concluir e excluir esta tarefa?")) {
                    const crmData = await carregarDados("kanban_data");
                    const taskColumn = crmData.columns.find(col => col.title === 'Tarefas Pendentes');
                    if (taskColumn && taskColumn.tasks) {
                        taskColumn.tasks = taskColumn.tasks.filter(t => t.id !== taskId);
                        await salvarDados("kanban_data", crmData);
                        card.remove();
                    }
                }
            }
        }
    });
console.log("UI do CRM injetada e eventos configurados com sucesso!");
}

// --- MONITORAMENTO DE CONVERSAS NO WHATSAPP ---
let currentMonitoredContact = null;

function iniciarMonitoramentoDeConversa() {
    console.log('CRM Extensão: Iniciando monitoramento de conversas...');

    const painelPrincipal = document.querySelector('#main');
    if (!painelPrincipal) {
        setTimeout(iniciarMonitoramentoDeConversa, 1000);
        return;
    }

    const observer = new MutationObserver(() => {
        const headerDaConversa = document.querySelector('[data-testid="conversation-header"]');
        if (headerDaConversa) {
            capturarEPreencherDadosDoContato();
        }
    });

    observer.observe(painelPrincipal, { childList: true, subtree: true });

    console.log('CRM Extensão: Monitoramento ativo.');
}

function capturarEPreencherDadosDoContato() {
    try {
        const dados = observadorDeContato.capturarContatoAtivo();
        if (!dados) return;

        if (currentMonitoredContact === dados.nome) return;
        currentMonitoredContact = dados.nome || null;

        console.log('CRM Extensão: Novo contato ativo detectado -', dados.nome);

        if (typeof window.showPrecheckPanel === 'function') {
            window.showPrecheckPanel(dados);
        } else {
            console.warn('CRM Extensão: Função showPrecheckPanel não disponível.');
        }

    } catch (e) {
        console.error('CRM Extensão: Erro ao capturar dados do contato:', e);
    }
}

(function () {
    if (document.getElementById("barra-crm-direita")) {
        console.log("🔄 Barra lateral direita já existe.");
        return;
    }

    const app = document.getElementById("app");
    if (app) {
        app.style.marginRight = "60px";
        app.style.width = "calc(100vw - 60px)";
    }

    const barra = document.createElement("div");
    barra.id = "barra-crm-direita";
    Object.assign(barra.style, {
        position: "fixed",
        top: "0",
        right: "0",
        width: "60px",
        height: "100vh",
        backgroundColor: "#f0f2f5",
        borderLeft: "1px solid #ccc",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        flexDirection: "column",
        zIndex: "999999",
        paddingTop: "10px",
        gap: "10px",
    });

    function criarBotaoImagem(src, title, onClick) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = title;
        img.title = title;
        Object.assign(img.style, {
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            cursor: "pointer",
            background: "#fff",
            padding: "4px",
            boxShadow: "0 0 5px rgba(0,0,0,0.2)",
        });
        img.onclick = onClick;
        return img;
    }

    const btnCRM = criarBotaoImagem("crm.png", "Abrir CRM", () => {
        const painel = document.getElementById("painel-crm-kanban");
        if (painel) {
            painel.classList.add("visible");
            painel.style.display = "block";
        }
    });

    const btnCadastro = criarBotaoImagem("cadastro.png", "Novo Cadastro", () => {
        if (window.openClientForm) {
            window.openClientForm();
        }
    });

    barra.appendChild(btnCRM);
    barra.appendChild(btnCadastro);
    document.body.appendChild(barra);
})();

// 🔧 Ajusta botões já existentes com imagens e ações

const iconeCRM = document.createElement("img");
iconeCRM.src = chrome.runtime.getURL("crm.png");
iconeCRM.alt = "CRM";
iconeCRM.style.width = "32px";
iconeCRM.style.height = "32px";
iconeCRM.style.marginBottom = "6px";

const iconeCadastro = document.createElement("img");
iconeCadastro.src = chrome.runtime.getURL("cadastro.png");
iconeCadastro.alt = "Cadastro";
iconeCadastro.style.width = "32px";
iconeCadastro.style.height = "32px";
iconeCadastro.style.marginBottom = "6px";

const botoes = document.querySelectorAll("#barra-crm-direita .crm-action-button");

if (botoes.length >= 2) {
    const btnCRM = botoes[0];
    const btnCadastro = botoes[1];

    btnCRM.title = "Kanban";
    btnCRM.innerHTML = "";
    btnCRM.appendChild(iconeCRM);
    btnCRM.onclick = () => {
        if (typeof renderKanbanBoard === "function") {
            renderKanbanBoard();
            const painel = document.getElementById("kanban-panel-container");
            if (painel) painel.classList.add("visible");
        }
    };

    btnCadastro.title = "Cadastro";
    btnCadastro.innerHTML = "";
    btnCadastro.appendChild(iconeCadastro);
    btnCadastro.onclick = async () => {
        if (typeof capturarDadosCompletos === "function" && typeof showPrecheckPanel === "function") {
            const dados = await capturarDadosCompletos();
            showPrecheckPanel(dados);
        }
    };
} else {
    console.warn("⚠️ Botões da barra lateral não encontrados ou incompletos.");
}

