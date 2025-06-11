console.log("CRM Kanban v15.0 - Versão Final Montada");

// --- FUNÇÕES DE COMUNICAÇÃO COM O BACKGROUND ---
async function salvarDados(uid, data) { try { const response = await chrome.runtime.sendMessage({ action: "salvarDados", uid, data }); return response; } catch (e) { console.error("Falha ao enviar mensagem para salvar dados:", e); } }
async function carregarDados(uid) { try { const response = await chrome.runtime.sendMessage({ action: "carregarDados", uid }); return response; } catch (e) { console.error("Falha ao enviar mensagem para carregar dados:", e); return null; } }

// --- FUNÇÕES HELPERS ---
function resetSidebarForm() { document.getElementById('crm-client-name').value = ''; document.getElementById('crm-client-phone').value = ''; document.getElementById('crm-client-origin').selectedIndex = 0; document.getElementById('crm-indicator-name').value = ''; document.getElementById('crm-indicator-phone').value = ''; document.getElementById('crm-indicacao-details').style.display = 'none'; document.querySelectorAll('input[name="crm-client-tags"]').forEach(tag => tag.checked = false); }

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
async function handleAddNewColumn() { const newColumnName = prompt("Digite o nome da nova coluna:"); if (!newColumnName || !newColumnName.trim()) return; const crmData = await carregarDados("kanban_data"); if (crmData.columns.some(c => c.title.toLowerCase() === newColumnName.trim().toLowerCase())) { alert("Já existe uma coluna com este nome."); return; } crmData.columns.push({ title: newColumnName.trim(), clients: [], tasks: [] }); await salvarDados("kanban_data", crmData); await renderKanbanBoard(); }
async function handleColumnRename(titleElement, oldName) { if (oldName === "Tarefas Pendentes") return; titleElement.contentEditable = true; titleElement.focus(); const originalHTML = titleElement.innerHTML; const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(titleElement); const deleteBtn = titleElement.querySelector('.delete-column-btn'); if (deleteBtn) range.setEndBefore(deleteBtn); selection.removeAllRanges(); selection.addRange(range); const saveName = async () => { titleElement.contentEditable = false; const newName = titleElement.innerText.trim(); if (newName && newName !== oldName) { const crmData = await carregarDados("kanban_data"); const columnToRename = crmData.columns.find(col => col.title === oldName); if (crmData.columns.some(c => c.title.toLowerCase() === newName.toLowerCase())) { alert("Já existe uma coluna com este nome."); titleElement.innerHTML = originalHTML; } else if (columnToRename) { columnToRename.title = newName; await salvarDados("kanban_data", crmData); await renderKanbanBoard(); } } else { titleElement.innerHTML = originalHTML; } }; titleElement.addEventListener('blur', saveName, { once: true }); titleElement.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); titleElement.blur(); } else if (e.key === 'Escape') { titleElement.innerHTML = originalHTML; titleElement.blur(); } }, { once: true }); }
async function handleColumnDelete(columnName) { if (columnName === "Tarefas Pendentes") { alert("A coluna de tarefas não pode ser excluída."); return; } const crmData = await carregarDados("kanban_data"); const columnToDelete = crmData.columns.find(col => col.title === columnName); if (columnToDelete && (columnToDelete.clients?.length > 0 || columnToDelete.tasks?.length > 0)) { alert("Apenas colunas vazias podem ser excluídas."); return; } if (confirm(`Tem certeza que deseja excluir a coluna "${columnName}"?`)) { crmData.columns = crmData.columns.filter(col => col.title !== columnName); await salvarDados("kanban_data", crmData); await renderKanbanBoard(); } }

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function createClientCardElement(clientData) { const card = document.createElement('div'); card.className = 'kanban-card'; card.id = clientData.id; card.draggable = true; const tagsHTML = (clientData.tags || []).map(tag => `<span class="card-tag">${tag}</span>`).join(''); const dealsHTML = (clientData.deals || []).map(deal => `<div class="deal-item"><strong>${deal.title || 'Negócio'}</strong> (${deal.creationDate})<br>Adesão: R$${(deal.valor || 0).toFixed(2)} | Mensal: R$${(deal.mensalidade || 0).toFixed(2)}</div>`).join(''); card.innerHTML = `<div class="card-header"><div class="card-info"><h4>${clientData.name || 'Sem Nome'}</h4><p>${clientData.phone || ''}</p></div></div><div class="card-tags">${tagsHTML}</div>${dealsHTML ? `<div class="card-deals-container">${dealsHTML}</div>` : ''}`; card.addEventListener('dragstart', handleDragStart); card.addEventListener('dragend', handleDragEnd); card.addEventListener('dblclick', () => openCardEditPanel(clientData.id, 'client')); return card; }
function createTaskCardElement(taskData) { const card = document.createElement('div'); card.className = 'kanban-card task-card'; card.id = taskData.id; card.dataset.taskId = taskData.id; card.draggable = false; card.innerHTML = `<button class="delete-task-btn" title="Concluir/Excluir Tarefa">&times;</button><div class="card-highlight">${taskData.highlight}</div><div class="card-notes">${taskData.notes}</div><div class="card-creation-date">Criado em: ${taskData.creationDate}</div>`; card.addEventListener('dblclick', () => openCardEditPanel(taskData.id, 'task')); return card; }
function createColumnElement(columnData) { const column = document.createElement('div'); column.className = 'kanban-column'; column.dataset.id = columnData.title; if (columnData.title === 'Tarefas Pendentes') column.id = 'task-column'; const title = document.createElement('h3'); title.innerText = columnData.title; if (columnData.title !== 'Tarefas Pendentes') { const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-column-btn'; deleteBtn.innerHTML = '&times;'; deleteBtn.title = 'Excluir Coluna'; deleteBtn.onclick = (e) => { e.stopPropagation(); handleColumnDelete(columnData.title); }; title.appendChild(deleteBtn); title.addEventListener('dblclick', () => handleColumnRename(title, columnData.title)); column.addEventListener('dragover', handleDragOver); column.addEventListener('drop', handleDrop); } const itemsContainer = document.createElement('div'); itemsContainer.className = 'kanban-items'; if (columnData.tasks) { columnData.tasks.forEach(task => itemsContainer.appendChild(createTaskCardElement(task))); } if (columnData.clients) { columnData.clients.forEach(client => itemsContainer.appendChild(createClientCardElement(client))); } column.appendChild(title); column.appendChild(itemsContainer); return column; }
async function updateDashboard() { const dashboardCanvas = document.getElementById('financial-chart'); if (!dashboardCanvas) return; const ctx = dashboardCanvas.getContext('2d'); const crmData = await carregarDados("kanban_data"); if (!crmData || !crmData.columns) return; const labels = []; const datasets = { valor: [], mensalidade: [], gordurinha: [] }; crmData.columns.forEach(column => { if (column.title === 'Tarefas Pendentes') return; labels.push(column.title); let totalValor = 0; let totalMensalidade = 0; let totalGordurinha = 0; (column.clients || []).forEach(client => { (client.deals || []).forEach(deal => { totalValor += deal.valor || 0; totalMensalidade += deal.mensalidade || 0; totalGordurinha += deal.gordurinha || 0; }); }); datasets.valor.push(totalValor); datasets.mensalidade.push(totalMensalidade); datasets.gordurinha.push(totalGordurinha); }); if (window.myFinancialChart) window.myFinancialChart.destroy(); window.myFinancialChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Adesão (R$)', data: datasets.valor, backgroundColor: 'rgba(75, 192, 192, 0.8)' }, { label: 'Mensalidade (R$)', data: datasets.mensalidade, backgroundColor: 'rgba(54, 162, 235, 0.8)' }, { label: 'Gordurinha (R$)', data: datasets.gordurinha, backgroundColor: 'rgba(255, 206, 86, 0.8)' } ] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: 'white' } }, x: { ticks: { color: 'white' } } }, plugins: { legend: { labels: { color: 'white' } } } } }); }
async function renderKanbanBoard() { const boardContainer = document.querySelector('.kanban-board'); if (!boardContainer) return; boardContainer.innerHTML = '<p>Carregando...</p>'; let crmData = await carregarDados("kanban_data"); if (!crmData || !crmData.columns) { crmData = { clients: {}, columns: [{ title: 'Tarefas Pendentes', tasks: [] }, { title: 'Em Negociação', clients: [] }] }; await salvarDados("kanban_data", crmData); } boardContainer.innerHTML = ''; crmData.columns.forEach(columnData => boardContainer.appendChild(createColumnElement(columnData))); const addColumnContainer = document.createElement('div'); addColumnContainer.className = 'add-column-container'; addColumnContainer.innerHTML = `<button id="add-new-column-btn" class="add-column-btn">+ Adicionar Nova Coluna</button>`; boardContainer.appendChild(addColumnContainer); document.getElementById('add-new-column-btn').onclick = handleAddNewColumn; await updateDashboard(); }
async function openCardEditPanel(id, type) {
    const panel = document.getElementById('card-edit-panel');
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
        document.getElementById('edit-origin').parentElement.style.display = '';
        document.querySelector('#edit-panel-tags').style.display = '';
        document.getElementById('edit-valor').parentElement.style.display = '';
        document.getElementById('edit-name').value = data?.name || '';
        document.getElementById('edit-phone').value = data?.phone || '';
        document.getElementById('edit-origin').value = data?.origin || '';
        document.querySelectorAll('input[name="edit-tags"]').forEach(cb => {
            cb.checked = (data?.tags || []).includes(cb.value);
        });
        document.getElementById('edit-valor').value = data?.deals?.[0]?.valor || '';
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
            client.tags = Array.from(document.querySelectorAll('input[name="edit-tags"]:checked')).map(cb => cb.value);
            const valor = parseFloat(document.getElementById('edit-valor').value) || 0;
            if (client.deals && client.deals[0]) client.deals[0].valor = valor;
        }
    }
    await salvarDados('kanban_data', crmData);
    closeCardEditPanel();
    await renderKanbanBoard();
}

function closeCardEditPanel() {
    const panel = document.getElementById('card-edit-panel');
    panel.classList.remove('visible');
    panel.dataset.cardId = '';
    panel.dataset.cardType = '';
}
// --- FUNÇÃO PRINCIPAL QUE CONSTRÓI A UI ---
function buildUI() {
    if (document.getElementById('crm-fab-container')) return;

    const mainHTML = `
        <div id="crm-sidebar">
            <div class="sidebar-header"><button class="close-btn">&times;</button><h2 id="sidebar-title">Adicionar Cliente</h2></div>
            <div class="sidebar-content">
                <div id="client-form-view">
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
                    <div class="form-group"><label for="task-highlight">Destaque da Tarefa</label><input type="text" id="task-highlight"></div>
                    <div class="form-group"><label for="task-notes">Observações</label><textarea id="task-notes" rows="4"></textarea></div>
                    <button id="save-task-btn" class="action-button">Salvar Tarefa</button>
                </div>
            </div>
        </div>
        <div id="card-edit-panel" class="card-edit-panel">
            <div class="sidebar-header"><button class="close-btn">&times;</button><h2>Editar Card</h2></div>
            <div class="sidebar-content">
                <div class="form-group"><label for="edit-name">Nome</label><input type="text" id="edit-name"></div>
                <div class="form-group"><label for="edit-phone">Telefone</label><input type="text" id="edit-phone"></div>
                <div class="form-group"><label for="edit-origin">Origem</label><select id="edit-origin"><option value="">Selecione...</option><option value="Indicação">Indicação</option><option value="Já é cliente">Já é cliente</option><option value="Captação">Captação</option></select></div>
                <div id="edit-panel-tags" class="fieldset"><legend>Categoria (Tags)</legend><div class="tags-group"><label><input type="checkbox" name="edit-tags" value="Em negociação"> Em negociação</label><label><input type="checkbox" name="edit-tags" value="Fechou"> Fechou</label><label><input type="checkbox" name="edit-tags" value="Esfriou"> Esfriou</label></div></div>
                <div class="form-group"><label for="edit-valor">Valor</label><input type="number" id="edit-valor"></div>
            </div>
            <button id="save-edit-btn" class="action-button">Salvar alterações</button>
        </div>
        <div id="kanban-panel-container">
            <div id="kanban-panel-content">
                <div class="kanban-header">
                    <div class="kanban-header-top-row"><h2>CRM Kanban</h2><button class="close-btn">&times;</button></div>
                    <div id="kanban-dashboard"><canvas id="financial-chart"></canvas></div>
                </div>
                <div class="kanban-board"></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', mainHTML);
    
    const fabContainer = document.createElement('div'); fabContainer.className = 'fab-container'; fabContainer.id = 'crm-fab-container';
    const kanbanBtn = document.createElement('button'); kanbanBtn.className = 'crm-action-button'; kanbanBtn.title = 'Abrir CRM Kanban'; kanbanBtn.innerHTML = `<img src="${chrome.runtime.getURL('panel_icon.svg')}" alt="Abrir CRM">`;
    const addClientBtn = document.createElement('button'); addClientBtn.className = 'crm-action-button'; addClientBtn.title = 'Adicionar Cliente'; addClientBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>`;
    fabContainer.appendChild(addClientBtn); fabContainer.appendChild(kanbanBtn);
    document.body.appendChild(fabContainer);
    
    let lastSavedClientId = null; let lastSavedIndicatorName = '';

    addClientBtn.onclick = () => { document.getElementById('client-form-view').style.display = 'block'; document.getElementById('post-save-view').style.display = 'none'; document.getElementById('deal-form-view').style.display = 'none'; document.getElementById('task-form-view').style.display = 'none'; document.getElementById('sidebar-title').innerText = 'Adicionar Cliente'; resetSidebarForm(); document.getElementById('crm-sidebar').classList.add('visible'); };
    kanbanBtn.onclick = () => { renderKanbanBoard(); document.getElementById('kanban-panel-container').classList.add('visible'); };
    document.querySelector('#crm-sidebar .close-btn').onclick = () => { document.getElementById('crm-sidebar').classList.remove('visible'); };
    document.querySelector('#kanban-panel-container .close-btn').onclick = () => { document.getElementById('kanban-panel-container').classList.remove('visible'); };
    document.querySelector('#card-edit-panel .close-btn').onclick = closeCardEditPanel;
    document.getElementById('save-edit-btn').onclick = saveCardEdit;
    document.getElementById('crm-client-origin').onchange = (e) => { document.getElementById('crm-indicacao-details').style.display = (e.target.value === 'Indicação') ? 'block' : 'none'; };
    
    document.getElementById('save-client-btn').onclick = async () => {
        const clientData = { id: 'client_' + Date.now(), name: document.getElementById('crm-client-name').value, phone: document.getElementById('crm-client-phone').value, origin: document.getElementById('crm-client-origin').value, indicator: (document.getElementById('crm-client-origin').value === 'Indicação') ? { name: document.getElementById('crm-indicator-name').value, phone: document.getElementById('crm-indicator-phone').value } : null, tags: Array.from(document.querySelectorAll('input[name="crm-client-tags"]:checked')).map(cb => cb.value), deals: [], tasks: [] };
        if (!clientData.name && !clientData.phone) { alert("É preciso ter ao menos um Nome ou Telefone."); return; }
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
        if (!newClient) { alert("Erro: Cliente não encontrado para adicionar o negócio."); return; }
        if (!newClient.deals) newClient.deals = []; newClient.deals.push(dealData);
        let dealColumn = crmData.columns.find(col => col.title === "Em Negociação");
        if (!dealColumn) { crmData.columns.push({ title: "Em Negociação", clients: [] }); dealColumn = crmData.columns[crmData.columns.length - 1]; }
        dealColumn.clients.unshift(newClient); delete crmData.clients[lastSavedClientId];
        await salvarDados("kanban_data", crmData); await renderKanbanBoard();
        document.getElementById('deal-form-view').style.display = 'none'; document.getElementById('crm-sidebar').classList.remove('visible');
        alert('Cliente e Negócio salvos com sucesso!');
    };

    document.getElementById('sidebar-add-task-btn').onclick = () => { document.getElementById('post-save-view').style.display = 'none'; document.getElementById('task-form-view').style.display = 'block'; document.getElementById('sidebar-title').innerText = 'Nova Tarefa'; };
    document.getElementById('save-task-btn').onclick = async () => {
        const taskData = { id: 'task_' + Date.now(), highlight: document.getElementById('task-highlight').value, notes: document.getElementById('task-notes').value, creationDate: new Date().toLocaleDateString('pt-BR'), clientId: lastSavedClientId };
        if (!taskData.highlight) { alert("O Destaque da Tarefa é obrigatório."); return; }
        const crmData = await carregarDados("kanban_data");
        let taskColumn = crmData.columns.find(col => col.title === 'Tarefas Pendentes');
        if (!taskColumn) { taskColumn = { title: 'Tarefas Pendentes', tasks: [] }; crmData.columns.unshift(taskColumn); }
        if (!taskColumn.tasks) taskColumn.tasks = [];
        taskColumn.tasks.push(taskData);
        await salvarDados("kanban_data", crmData);
        await renderKanbanBoard();
        document.getElementById('task-highlight').value = ''; document.getElementById('task-notes').value = '';
        document.getElementById('task-form-view').style.display = 'none';
        document.getElementById('crm-sidebar').classList.remove('visible');
        alert('Tarefa adicionada com sucesso!');
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

function loadScript(src, callback) {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
        if (callback) callback();
        return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
}

window.addEventListener('load', () => {
    loadScript(chrome.runtime.getURL('chart.min.js'), () => {
        console.log('Chart.js carregado.');
        setTimeout(buildUI, 2000);
    });
});
