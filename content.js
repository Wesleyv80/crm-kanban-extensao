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

// capturarDadosCompletos() is now removed. Its logic is merged into observadorDeContato.getConsolidatedContactInfo()

function formatarTelefone(numero) {
    if (!numero) return ""; // Handle null, undefined, or empty string input
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

    function getConsolidatedContactInfo() {
        // Para Nome: Lógica do span detalhado
        const nomeSpan = Array.from(document.querySelectorAll('span')).find(el =>
            el.offsetHeight > 0 &&
            el.innerText.trim().length >= 4 &&
            el.innerText.trim().split(' ').length >= 2 &&
            !el.innerText.match(/\d/) &&
            !el.innerText.startsWith('+')
        );
        const nome = nomeSpan ? nomeSpan.innerText.trim() : null;

        // Para Telefone: Múltiplas estratégias
        let telefone = null;
        // 1. div[data-id]
        const painelInfo = document.querySelector('div[data-id]');
        const dataId = painelInfo && painelInfo.getAttribute('data-id');
        if (dataId) {
            const match = dataId.match(/^[^_]*_([^_]+)_/);
            if (match && match[1]) {
                telefone = formatarTelefone(match[1]);
            }
        }
        // 2. a[href^="tel:"]
        if (!telefone) {
            const linkTel = document.querySelector('a[href^="tel:"]');
            if (linkTel) {
                telefone = formatarTelefone(linkTel.innerText.trim());
            }
        }
        // 3. Regex
        if (!telefone) {
            const candidato = Array.from(document.querySelectorAll('div, span'))
                .map(el => el.innerText.trim())
                .find(txt => /^\+\d{2}\s?\d{2}\s?\d{4,5}-\d{4}$/.test(txt));
            if (candidato) {
                telefone = formatarTelefone(candidato);
            }
        }

        // Para Imagem: Múltiplas estratégias
        let imagem = null;
        // 1. div[role="button"] img[src*="whatsapp.net"][src*="s96x96"]
        const imgPainel = document.querySelector('div[role="button"] img[src*="whatsapp.net"][src*="s96x96"]');
        if (imgPainel && imgPainel.src) {
            imagem = imgPainel.src;
        }
        // 2. header img[src*="whatsapp.net"]
        if (!imagem) {
            const imgEl = document.querySelector('header img');
            if (imgEl && imgEl.src.includes('whatsapp.net')) {
                imagem = imgEl.src;
            }
        }

        if (!nome && !telefone && !imagem) {
            // console.log("Nenhum dado de contato encontrado pelas estratégias combinadas."); // Optional: too noisy for MutationObserver
            return null;
        }
        return { nome, telefone, imagem };
    }

    // capturarContatoAtivo agora usa a lógica consolidada.
    function capturarContatoAtivo() {
        try {
            // console.log('📲 Iniciando captura de dados do contato (via wrapper)...');
            return getConsolidatedContactInfo();
        } catch (erro) {
            console.error('Erro ao capturar dados do contato (wrapper):', erro);
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

        globalThis.lastCapturedContact = { name: nome, phone: telefone, photo: imagem };
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

    // Expõe a nova função consolidada e a original (que agora é wrapper)
    return { iniciar, capturarContatoAtivo, getConsolidatedContactInfo };
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

    // Ensure crmData.clients exists
    if (!crmData.clients) {
        crmData.clients = {};
    }

    // Collect all task IDs from the board to preserve tasks correctly
    let allTasksOnBoard = [];
    columns.forEach(columnEl => {
        const cards = columnEl.querySelectorAll('.kanban-card.task-card');
        cards.forEach(cardEl => {
            allTasksOnBoard.push(cardEl.id);
        });
    });

    // Preserve existing tasks from crmData that are still on the board
    let preservedTasks = [];
    if (crmData.columns) {
        crmData.columns.forEach(col => {
            if (col.tasks) {
                col.tasks.forEach(task => {
                    if (allTasksOnBoard.includes(task.id)) {
                        preservedTasks.push(task);
                    }
                });
            }
        });
    }


    let newColumns = [];
    columns.forEach(columnEl => {
        const columnTitle = columnEl.dataset.id;
        const columnObj = { title: columnTitle, clients: [], tasks: [] };
        const cards = columnEl.querySelectorAll('.kanban-card');

        cards.forEach(cardEl => {
            if (cardEl.classList.contains('task-card')) {
                // Find the task from the preserved list
                const task = preservedTasks.find(t => t.id === cardEl.id);
                if (task) {
                    columnObj.tasks.push(task);
                }
            } else {
                // Client card
                const clientId = cardEl.id;
                if (clientId && crmData.clients[clientId]) { // Ensure client exists in global store
                    columnObj.clients.push(clientId); // Store only ID in column
                } else if (clientId) {
                    // This case should ideally not happen if clients are always added to crmData.clients first.
                    // However, as a fallback, if we find a card on the board not in crmData.clients,
                    // we should try to retrieve its data (e.g., from an old structure if necessary)
                    // or log a warning. For now, we'll log and skip.
                    console.warn(`Client card ${clientId} found on board but not in crmData.clients. State might be inconsistent.`);
                }
            }
        });
        newColumns.push(columnObj);
    });

    crmData.columns = newColumns;
    // Client objects are already in crmData.clients and updated there directly.
    // saveBoardState now primarily saves the column structure (with client IDs) and tasks.
    await salvarDados("kanban_data", crmData);
    console.log("Estado do painel salvo.", crmData);
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
    const selection = globalThis.getSelection();
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

    if (columnData.clients && crmData.clients) { // columnData.clients is now an array of IDs
        columnData.clients.forEach(clientId => {
            const clientObject = crmData.clients[clientId];
            if (clientObject) {
                itemsContainer.appendChild(createClientCardElement(clientObject));
            } else {
                console.warn(`Client ID ${clientId} found in column '${columnData.title}' but not in crmData.clients. Card will not be rendered.`);
                // Optionally, remove this orphaned ID from the column to self-heal
                // This would require modifying crmData here and potentially saving,
                // which might be too much for a render function.
                // For now, just skip rendering.
            }
        });
    } else if (columnData.clients && !crmData.clients) {
        console.error("crmData.clients is missing, cannot render client cards for column:", columnData.title);
    }

    column.appendChild(title);
    column.appendChild(countEl);
    if (columnData.title !== 'Tarefas Pendentes') column.appendChild(totalEl);
    column.appendChild(itemsContainer);
    return column;
}
async function updateColumnTotals(crmData) {
    if (!crmData) crmData = await carregarDados('kanban_data');
    if (!crmData || !crmData.clients) { // Ensure crmData.clients is available
        console.warn("updateColumnTotals: crmData.clients is not available. Totals may be inaccurate.");
        return;
    }
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(colEl => {
        const colData = crmData.columns.find(c => c.title === colEl.dataset.id);
        if (!colData || colData.title === 'Tarefas Pendentes') return;

        let totalValor = 0;
        (colData.clients || []).forEach(clientId => { // Iterate over client IDs
            const client = crmData.clients[clientId];
            if (client && client.deals) {
                client.deals.forEach(deal => { totalValor += deal.valor || 0; });
            }
        });
        const totalEl = colEl.querySelector('.column-total');
        if (totalEl) {
            totalEl.textContent = `\uD83D\uDCB5 Total: ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        }
        const countEl = colEl.querySelector('.column-count');
        if (countEl) {
            const clientCount = (colData.clients || []).length;
            const taskCount = (colData.tasks || []).length;
            countEl.textContent = `(${(clientCount + taskCount)} cards)`;
        }
    });
}

async function updateDashboard() {
    const crmData = await carregarDados("kanban_data");
    if (!crmData || !crmData.columns || !crmData.clients) { // Ensure crmData.clients is available
        console.warn("updateDashboard: crmData or its properties (columns/clients) are not available. Dashboard may be inaccurate.");
        return;
    }
    let totalDeals = 0;
    let totalTasks = 0;
    let totalValor = 0;
    crmData.columns.forEach(column => {
        if (column.title === 'Tarefas Pendentes') {
            totalTasks += (column.tasks || []).length;
        }
        // Iterate over client IDs in the column and fetch from crmData.clients
        (column.clients || []).forEach(clientId => {
            const client = crmData.clients[clientId];
            if (client) {
                totalDeals += (client.deals || []).length;
                (client.deals || []).forEach(deal => { totalValor += deal.valor || 0; });
            }
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

    // Migration logic
    if (crmData && crmData.columns) {
        let needsMigration = false;
        if (!crmData.clients) {
            crmData.clients = {};
            needsMigration = true;
        }
        for (const column of crmData.columns) {
            if (column.clients && column.clients.length > 0 && typeof column.clients[0] === 'object' && column.clients[0] !== null && column.clients[0].id) {
                needsMigration = true;
                const clientIds = [];
                for (const clientObj of column.clients) {
                    if (clientObj && clientObj.id) { // Ensure clientObj and its id are valid
                        if (!crmData.clients[clientObj.id]) {
                            crmData.clients[clientObj.id] = clientObj;
                        }
                        clientIds.push(clientObj.id);
                    }
                }
                column.clients = clientIds;
            } else if (column.clients && column.clients.length > 0 && typeof column.clients[0] !== 'string') {
                // This case implies that column.clients[0] is not an object with an id (already string ID or malformed)
                // If it's not an object and not a string, it's likely malformed.
                // Consider if any specific recovery is needed or if clearing is acceptable.
                // For now, let's ensure all elements are strings if the first one suggests it's already migrated or mixed.
                let allStrings = true;
                for(const item of column.clients){
                    if(typeof item !== 'string'){
                        allStrings = false;
                        break;
                    }
                }
                if(!allStrings){
                    console.warn("Coluna com dados de clientes potencialmente malformados:", column.title, column.clients);
                    // Attempt to recover IDs if possible, or clear
                    const recoveredIds = [];
                    for(const item of column.clients){
                        if(typeof item === 'object' && item !== null && item.id){
                             if (!crmData.clients[item.id]) {
                                crmData.clients[item.id] = item;
                            }
                            recoveredIds.push(item.id);
                        } else if (typeof item === 'string'){
                            recoveredIds.push(item);
                        }
                    }
                    column.clients = recoveredIds;
                    if (recoveredIds.length !== column.clients.length) needsMigration = true; // if any recovery happened
                }
            }
        }
        if (needsMigration) {
            console.log("Migrando dados para novo formato...", crmData);
            await salvarDados("kanban_data", crmData);
        }
    } else if (!crmData || !crmData.columns) { // Initialize if no data exists
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
        // Task data retrieval remains unchanged as tasks are still directly in columns
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
    } else { // Client type
        if (crmData.clients && crmData.clients[id]) {
            data = crmData.clients[id];
        } else {
            console.warn(`Client with ID ${id} not found in crmData.clients during openCardEditPanel.`);
            // Optionally, could add back the loop through columns as a fallback for robustness,
            // but the primary source should be crmData.clients.
            // for (const col of crmData.columns || []) {
            //    // This part would be tricky because columns now store IDs.
            //    // You'd have to check if col.clients.includes(id) and then fetch from crmData.clients.
            //    // This implies data inconsistency if it's in a column but not crmData.clients.
            // }
            // For now, if not in crmData.clients, data will be undefined, and the form will be empty.
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
    } else { // Client type
        if (crmData.clients && crmData.clients[id]) {
            let client = crmData.clients[id];
            // Update client object directly in crmData.clients
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
        } else {
            console.warn(`Client with ID ${id} not found in crmData.clients during saveCardEdit. Cannot save changes.`);
            showToast('Erro: Cliente não encontrado. Não foi possível salvar.');
            closeCardEditPanel();
            await renderKanbanBoard(); // Re-render to reflect current state
            return; // Exit to prevent further issues
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
    // Check if the new sidebar is already built to prevent duplication if script re-runs.
    if (document.getElementById('barra-crm-direita')) {
        // If new sidebar exists, assume UI is built by this refactored version.
        // Optionally, also check for 'crm-fab-container' if it should always co-exist.
        return;
    }
    // Simple check for old FAB container to prevent multiple FABs if old logic hasn't been removed yet.
    if (document.getElementById('crm-fab-container')) {
        console.warn("buildUI: crm-fab-container already exists. Consider full cleanup if old sidebar logic is still present.");
        // Not returning here, as we want to proceed to build the NEW sidebar.
        // Old sidebar removal will be a separate step.
    }

    // Helper function for right sidebar buttons (defined inside buildUI)
    function criarBotaoBarraDireita(imgSrc, title, onClickCallback) {
        const button = document.createElement("button");
        button.className = "crm-sidebar-button";
        button.title = title;

        const img = document.createElement("img");
        img.src = chrome.runtime.getURL(imgSrc);
        img.alt = title;
        Object.assign(img.style, {
            width: "32px",
            height: "32px",
        });

        button.appendChild(img);
        button.onclick = onClickCallback;

        Object.assign(button.style, {
            background: "#fff",
            padding: "4px",
            borderRadius: "8px",
            boxShadow: "0 0 5px rgba(0,0,0,0.2)",
            cursor: "pointer",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px"
        });
        return button;
    }

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
    
    // Lines for fabContainer, kanbanBtn, addClientBtn creation and appending are removed.
    console.log("FAB elements (fabContainer, kanbanBtn, addClientBtn) creation and appending removed.");

    // --- Right Sidebar (barra-crm-direita) Creation ---
    const appElement = document.getElementById("app");
    if (appElement) {
        // Ensure this doesn't conflict if old IIFE also runs.
        // The old IIFE has a check for "barra-crm-direita" existence.
        appElement.style.marginRight = "60px";
        appElement.style.width = "calc(100vw - 60px)";
    }

    const barraDireita = document.createElement("div");
    barraDireita.id = "barra-crm-direita"; // This ID is crucial
    Object.assign(barraDireita.style, {
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
        zIndex: "9999999",
        paddingTop: "20px",
        gap: "15px",
    });

    const btnAbrirKanban = criarBotaoBarraDireita(
        "crm.png",
        "Abrir CRM Kanban",
        () => {
            if (typeof renderKanbanBoard === "function") {
                renderKanbanBoard();
                const painel = document.getElementById("kanban-panel-container");
                if (painel) painel.classList.add("visible");
            } else {
                console.error("renderKanbanBoard function not found");
            }
        }
    );
    barraDireita.appendChild(btnAbrirKanban);

    const btnNovoCadastro = criarBotaoBarraDireita(
        "cadastro.png",
        "Novo Cadastro",
        async () => {
            if (typeof observadorDeContato !== 'undefined' && typeof observadorDeContato.getConsolidatedContactInfo === 'function' && typeof showPrecheckPanel === 'function') {
                const delay = ms => new Promise(res => setTimeout(res, ms));
                await delay(800);
                const dados = await observadorDeContato.getConsolidatedContactInfo();
                showPrecheckPanel(dados);
            } else {
                console.error("Required functions for Novo Cadastro not found (getConsolidatedContactInfo or showPrecheckPanel)");
            }
        }
    );
    barraDireita.appendChild(btnNovoCadastro);
    document.body.appendChild(barraDireita);
    console.log("Nova barra lateral direita adicionada por buildUI.");
    // --- End of Right Sidebar Creation ---

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
    globalThis.showPrecheckPanel = showPrecheckPanel;

    function hidePrecheckPanel() {
        document.getElementById('precheck-view').style.display = 'none';
    }

    async function populateClientSelect(selectId = 'task-client', selectedId = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
    select.innerHTML = ''; // Clear existing options
        const crmData = await carregarDados('kanban_data');

    let clientList = [];
    if (crmData && crmData.clients) {
        clientList = Object.values(crmData.clients);
    } else {
        console.warn("populateClientSelect: crmData.clients is not available.");
    }

    // Sort clients by name for better UX
    clientList.sort((a, b) => {
        const nameA = a.name || a.phone || '';
        const nameB = b.name || b.phone || ''; // Corrected: b.phone to b.phone
        return nameA.localeCompare(nameB);
    });

    if (clientList.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Nenhum cliente cadastrado";
        select.appendChild(opt);
        select.disabled = true;
        return;
    }
    select.disabled = false;

    clientList.forEach(c => {
        if (!c || !c.id) { // Basic check for valid client object and ID
            console.warn("populateClientSelect: Invalid client object found", c);
            return;
        }
            const opt = document.createElement('option');
            opt.value = c.id;
        opt.textContent = c.name ? `${c.name} (${c.phone || 'Sem telefone'})` : (c.phone || 'Cliente sem nome/telefone');
            select.appendChild(opt);
        });

    if (selectedId && clientList.some(c => c.id === selectedId)) {
        select.value = selectedId;
    } else if (clientList.length > 0) {
        select.value = clientList[0].id; // Default to first client if no valid selectedId or selectedId not found
    }
    }

    // addClientBtn.onclick and kanbanBtn.onclick handlers for the removed FABs are now deleted.
    // Note: addClientBtn and kanbanBtn variables would be undefined here if the previous step correctly removed their creation.
    // This removal cleans up the orphaned event handler assignments.
    console.log("FAB onclick handlers (addClientBtn.onclick, kanbanBtn.onclick) removed.");

    const quickActions = document.getElementById('crm-quick-actions');
    // The following event listener is for the main kanban panel, not the FAB, so it should remain.
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
        const data = globalThis.lastCapturedContact || precheckData || {};
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
        if (!crmData.clients) {
            crmData.clients = {};
        }
        crmData.clients[clientData.id] = clientData; // Add/update client in the global store
        await salvarDados("kanban_data", crmData);
        // lastSavedClientId is still important for linking a deal or task later
        document.getElementById('client-form-view').style.display = 'none';
        document.getElementById('post-save-view').style.display = 'block';
        document.getElementById('sidebar-title').innerText = 'Próximos Passos';
    };
    
    document.getElementById('sidebar-add-deal-btn').onclick = () => { document.getElementById('post-save-view').style.display = 'none'; document.getElementById('deal-form-view').style.display = 'block'; document.getElementById('sidebar-title').innerText = 'Novo Negócio'; };
    document.getElementById('save-deal-btn').onclick = async () => {
        const dealData = { title: document.getElementById('deal-title').value, valor: parseFloat(document.getElementById('deal-valor').value) || 0, mensalidade: parseFloat(document.getElementById('deal-mensalidade').value) || 0, gordurinha: parseFloat(document.getElementById('deal-gordurinha').value) || 0, creationDate: new Date().toLocaleDateString('pt-BR'), indicatorName: lastSavedIndicatorName };
        const crmData = await carregarDados("kanban_data");

        if (!lastSavedClientId || !crmData.clients || !crmData.clients[lastSavedClientId]) {
            showToast('Erro: Cliente não encontrado para adicionar o negócio. Salve o cliente primeiro.');
            return;
        }
        const clientToUpdate = crmData.clients[lastSavedClientId];
        if (!clientToUpdate.deals) clientToUpdate.deals = [];
        clientToUpdate.deals.push(dealData);

        let dealColumn = crmData.columns.find(col => col.title === "Em Negociação");
        if (!dealColumn) {
            // Find the 'Em Negociação' column or create it if it doesn's exist
            const defaultColumnTitle = "Em Negociação";
            dealColumn = crmData.columns.find(col => col.title === defaultColumnTitle);
            if (!dealColumn) {
                crmData.columns.push({ title: defaultColumnTitle, clients: [], tasks: [] });
                dealColumn = crmData.columns[crmData.columns.length - 1];
            }
        }

        // Add client ID to the column, ensuring no duplicates
        if (!dealColumn.clients.includes(lastSavedClientId)) {
            dealColumn.clients.unshift(lastSavedClientId); // Add ID to the beginning
        }

        // The client object remains in crmData.clients. Do NOT delete crmData.clients[lastSavedClientId].
        // crmData.clients[lastSavedClientId] was already updated with the new deal.

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

        if (typeof globalThis.showPrecheckPanel === 'function') {
            globalThis.showPrecheckPanel(dados);
        } else {
            console.warn('CRM Extensão: Função showPrecheckPanel não disponível.');
        }

    } catch (e) {
        console.error('CRM Extensão: Erro ao capturar dados do contato:', e);
    }
}

// The old IIFE for barra-crm-direita creation is removed by this change.
// Its logic is now handled within buildUI().

// The block of code that adjusted old buttons (`iconeCRM`, `iconeCadastro`, etc.)
// is also removed by this change as it's no longer needed.

