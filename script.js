document.addEventListener('DOMContentLoaded', () => {
    // === ELEMENTOS DO DOM ===
    const telas = {
        geral: document.getElementById('tela-geral'),
        escolha: document.getElementById('tela-escolha-turma'),
        principal: document.getElementById('tela-principal'),
        relatorios: document.getElementById('tela-relatorios'),
        scanner: document.getElementById('tela-scanner')
    };
    const listaGeralBanheiroDiv = document.getElementById('lista-geral-banheiro'), inputMaxAlunos = document.getElementById('input-max-alunos'), btnSalvarConfig = document.getElementById('btn-salvar-config');
    const inputNomeProfessor = document.getElementById('input-nome-professor'), btnAddProfessor = document.getElementById('btn-add-professor'), listaProfessoresAdminDiv = document.getElementById('lista-professores-admin');
    const inputNomeTurma = document.getElementById('input-nome-turma'), selectProfessorTurma = document.getElementById('select-professor-turma'), btnAddTurma = document.getElementById('btn-add-turma');
    const listaTurmasDiv = document.getElementById('lista-turmas');
    const nomeTurmaHeader = document.getElementById('nome-turma-header'), gridAlunosDiv = document.getElementById('grid-alunos'), listaBanheiroTurmaDiv = document.getElementById('lista-banheiro-turma');
    const inputNomeAluno = document.getElementById('input-nome-aluno'), btnAddAluno = document.getElementById('btn-add-aluno');
    const modal = document.getElementById('modal'), modalClose = document.querySelector('.modal-close'), modalTitle = document.getElementById('modalTitle'), modalBody = document.getElementById('modalBody'), modalFooter = document.getElementById('modalFooter'), btnModalCancel = document.getElementById('btn-modal-cancel'), btnModalSave = document.getElementById('btn-modal-save');
    const btnIrParaTurmas = document.getElementById('btn-ir-para-turmas'), btnVoltarParaGeral = document.getElementById('btn-voltar-para-geral'), btnVoltarParaEscolha = document.getElementById('btn-voltar-para-escolha');
    const themeToggleBtn = document.getElementById('theme-toggle-btn'), themeIcon = document.getElementById('theme-icon');
    const btnIrParaRelatorios = document.getElementById('btn-ir-para-relatorios'), btnVoltarParaGeralRelatorios = document.getElementById('btn-voltar-para-geral-relatorios');
    const inputSearchTurmas = document.getElementById('input-search-turmas'), inputSearchAlunos = document.getElementById('input-search-alunos');
    const reportStartDate = document.getElementById('report-start-date'), reportEndDate = document.getElementById('report-end-date');
    const reportPresetButtons = document.querySelector('.preset-buttons');
    const relatoriosContentDiv = document.getElementById('relatorios-content');
    const btnAbrirScanner = document.getElementById('btn-abrir-scanner');
    const btnVoltarParaGeralScanner = document.getElementById('btn-voltar-para-geral-scanner');
    const scannerFeedbackDiv = document.getElementById('scanner-feedback');
    const btnVerGraficos = document.getElementById('btn-ver-graficos');

    // === ESTADO DA APLICAÇÃO ===
    let turmaAtualId = null, autoUpdateInterval = null, todosProfessores = [];
    let qrCodeScanner = null;
    let dadosRelatoriosCache = null;
    const API_BASE_URL = 'api/index.php';

    // === LÓGICA DE TEMA ===
    function applyTheme(theme) {
        if (theme === 'dark') document.body.classList.add('dark-theme');
        else document.body.classList.remove('dark-theme');
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('escola-theme', theme);
    }

    // === FUNÇÕES DE API ===
    async function apiRequest(endpoint, method = 'GET', body = null) {
        try {
            const [route, queryString] = endpoint.split('?');
            let url = `${API_BASE_URL}?route=${route}`;
            if (queryString) url += `&${queryString}`;
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) options.body = JSON.stringify(body);
            const response = await fetch(url, options);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Ocorreu um erro.');
            return data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    // === FUNÇÕES DO SCANNER ===
    function onScanSuccess(decodedText, decodedResult) {
        qrCodeScanner.pause(true);
        setScannerFeedback('processando', 'Processando código...');
        handleQrCode(decodedText);
    }

    async function handleQrCode(codigo) {
        try {
            const result = await apiRequest('/eventos/scan', 'POST', { codigo_qr: codigo });
            if (result && result.success) {
                setScannerFeedback('success', result.message);
            }
        } catch (error) {
            const message = error.message;
            if (message.includes('Aluno com este código QR não encontrado.')) {
                setScannerFeedback('error', 'ALUNO NÃO ENCONTRADO');
            } else {
                setScannerFeedback('warning', message);
            }
        }

        setTimeout(() => {
            setScannerFeedback('default', 'Aponte a câmera para o QR Code do aluno.');
            if (qrCodeScanner) qrCodeScanner.resume();
        }, 2500);
    }

    function setScannerFeedback(type, message) {
        scannerFeedbackDiv.textContent = message;
        scannerFeedbackDiv.className = `scanner-feedback ${type}`;
    }

    function startScanner() {
        if (!qrCodeScanner) {
            qrCodeScanner = new Html5Qrcode("qr-reader");
        }
        if (qrCodeScanner.isScanning) return;
        qrCodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess)
            .catch(err => {
                setScannerFeedback('error', 'Não foi possível iniciar a câmera. Verifique as permissões.');
            });
    }

    function stopScanner() {
        if (qrCodeScanner && qrCodeScanner.isScanning) {
            qrCodeScanner.stop().catch(err => { });
        }
    }

    // === NAVEGAÇÃO E RENDERIZAÇÃO ===
    function showTela(nomeTela) {
        Object.values(telas).forEach(tela => tela.style.display = 'none');
        telas[nomeTela].style.display = 'block';
        if (autoUpdateInterval) clearInterval(autoUpdateInterval);
        stopScanner();
        if (nomeTela === 'geral') { carregarVisaoGeral(); autoUpdateInterval = setInterval(carregarVisaoGeral, 10000); }
        else if (nomeTela === 'principal') { updateDadosTurma(); autoUpdateInterval = setInterval(updateDadosTurma, 5000); }
        else if (nomeTela === 'scanner') { startScanner(); }
    }

    function showLoading(element) {
        element.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;
    }

    async function carregarVisaoGeral() {
        try {
            const [professores, config, geralBanheiro] = await Promise.all([apiRequest('/professores'), apiRequest('/config'), apiRequest('/geral-banheiro')]);
            if (professores) {
                todosProfessores = professores;
                renderSelectProfessores(professores);
                renderListaProfessores(professores);
            }
            if (config) inputMaxAlunos.value = config.max_alunos_banheiro;
            if (geralBanheiro) renderListaGeralBanheiro(geralBanheiro);
        } catch (error) {
            showModal('Erro de Comunicação', `<p>${error.message}</p>`);
        }
    }

    function renderListaProfessores(professores) {
        listaProfessoresAdminDiv.innerHTML = '';
        if (professores.length === 0) {
            listaProfessoresAdminDiv.innerHTML = '<p class="empty-list">Nenhum professor cadastrado.</p>';
            return;
        }
        professores.forEach(prof => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.innerHTML = `
                <span><i class="fas fa-user-tie"></i> ${prof.NOME_PROFESSOR}</span>
                <div class="item-actions">
                    <button class="btn-action edit" data-action="edit-professor" data-id="${prof.ID}" data-nome="${prof.NOME_PROFESSOR}" title="Editar Professor"><i class="fas fa-edit"></i></button>
                    <button class="btn-action delete" data-action="delete-professor" data-id="${prof.ID}" data-nome="${prof.NOME_PROFESSOR}" title="Excluir Professor"><i class="fas fa-trash"></i></button>
                </div>`;
            listaProfessoresAdminDiv.appendChild(div);
        });
    }

    function renderListaGeralBanheiro(alunos) {
        listaGeralBanheiroDiv.innerHTML = alunos.length === 0 ? '<p>Nenhum aluno no banheiro no momento.</p>' : '';
        alunos.forEach(aluno => {
            let bathroomTime = '';
            if (aluno.HORA_ENTRADA_BANHEIRO) {
                const entryTime = new Date(aluno.HORA_ENTRADA_BANHEIRO.replace(' ', 'T'));
                let diffSeconds = Math.round((new Date() - entryTime) / 1000);
                if (diffSeconds < 0) diffSeconds = 0;
                const minutes = Math.floor(diffSeconds / 60);
                const seconds = diffSeconds % 60;
                bathroomTime = `<span class="time-in-bathroom"><i class="far fa-clock"></i> ${minutes}:${seconds.toString().padStart(2, '0')}</span>`;
            }
            listaGeralBanheiroDiv.innerHTML += `<div class="item-geral"><div class="info-aluno"><h4><i class="fas fa-user"></i> ${aluno.NOME_USUARIO}</h4><small>${aluno.NOME_TURMA}</small></div>${bathroomTime}</div>`;
        });
    }

    function renderSelectProfessores(professores) {
        selectProfessorTurma.innerHTML = '<option value="">Selecione um professor...</option>';
        professores.forEach(prof => selectProfessorTurma.innerHTML += `<option value="${prof.ID}">${prof.NOME_PROFESSOR}</option>`);
    }

    async function carregarTurmas() {
        showLoading(listaTurmasDiv);
        const turmas = await apiRequest('/turmas');
        if (!turmas) return;
        listaTurmasDiv.innerHTML = turmas.length === 0 ? '<p>Nenhuma turma cadastrada.</p>' : '';
        turmas.forEach(turma => {
            const div = document.createElement('div');
            div.className = 'btn-turma';
            div.dataset.action = 'select-turma';
            div.dataset.id = turma.ID;
            div.dataset.nome = turma.NOME_TURMA;
            div.innerHTML = `
                <div class="turma-info">
                    <span class="turma-nome"><i class="fas fa-users"></i>${turma.NOME_TURMA}</span>
                    <small class="turma-professor">Prof: ${turma.NOME_PROFESSOR || 'N/A'}</small>
                </div>
                <div class="actions-container">
                    <button class="btn-action edit" data-action="edit-turma" data-id="${turma.ID}" data-nome="${turma.NOME_TURMA}" title="Editar Turma"><i class="fas fa-edit"></i></button>
                    <button class="btn-action delete" data-action="delete-turma" data-id="${turma.ID}" data-nome="${turma.NOME_TURMA}" title="Excluir Turma"><i class="fas fa-trash"></i></button>
                </div>`;
            listaTurmasDiv.appendChild(div);
        });
    }

    async function updateDadosTurma() {
        if (!turmaAtualId) return;
        const data = await apiRequest(`/alunos?turma_id=${turmaAtualId}`);
        if (!data) return;
        gridAlunosDiv.innerHTML = data.alunos.length === 0 ? '<p>Nenhum aluno cadastrado.</p>' : '';
        data.alunos.forEach(aluno => {
            const isInBathroom = aluno.STATUS === 'no_banheiro';
            let timeAlertClass = '', bathroomTime = '';
            if (isInBathroom && aluno.HORA_ENTRADA_BANHEIRO) {
                const entryTime = new Date(aluno.HORA_ENTRADA_BANHEIRO.replace(' ', 'T'));
                let diffSeconds = Math.round((new Date() - entryTime) / 1000);
                if (diffSeconds < 0) diffSeconds = 0;
                const minutes = Math.floor(diffSeconds / 60);
                const seconds = diffSeconds % 60;
                bathroomTime = `<span class="time-in-bathroom"><i class="far fa-clock"></i> ${minutes}:${seconds.toString().padStart(2, '0')}</span>`;
                if (minutes >= 5) timeAlertClass = 'time-alert';
            }

            gridAlunosDiv.innerHTML += `
            <div class="person-card ${isInBathroom ? 'in-bathroom' : ''} ${timeAlertClass}">
                <div class="person-header">
                    <div class="person-info">
                        <h4>${aluno.NOME_USUARIO}</h4>
                        ${bathroomTime}
                    </div>
                    <div class="person-status">
                        <span class="status">${isInBathroom ? 'No banheiro' : 'Disponível'}</span>
                    </div>
                </div>
                <div class="person-actions">
                    ${isInBathroom ? `<button data-action="saiu" data-aluno-id="${aluno.ID}" class="btn-success"><i class="fas fa-sign-out-alt"></i> Marcar Saída</button>` : `<button data-action="entrou" data-aluno-id="${aluno.ID}" class="btn-danger"><i class="fas fa-sign-in-alt"></i> Marcar Entrada</button>`}
                    <button data-action="historico" data-aluno-id="${aluno.ID}" data-aluno-nome="${aluno.NOME_USUARIO}" class="btn-secondary"><i class="fas fa-history"></i> Histórico</button>
                </div>
                <div class="actions-container">
                    <button class="btn-action edit" data-action="edit-aluno" data-id="${aluno.ID}" data-nome="${aluno.NOME_USUARIO}" title="Editar Aluno"><i class="fas fa-edit"></i></button>
                    <button class="btn-action delete" data-action="delete-aluno" data-id="${aluno.ID}" data-nome="${aluno.NOME_USUARIO}" title="Excluir Aluno"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        });
        listaBanheiroTurmaDiv.innerHTML = data.no_banheiro.length === 0 ? '<p>Ninguém desta turma.</p>' : '';
        data.no_banheiro.forEach(aluno => listaBanheiroTurmaDiv.innerHTML += `<div class="aluno-na-lista">${aluno.NOME_USUARIO}</div>`);
    }

    function renderChart(canvasId, data, label) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        const values = new Array(24).fill(0);
        data.forEach(item => { values[parseInt(item.hora)] = parseInt(item.qtd); });
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    async function carregarRelatorios() {
        showLoading(relatoriosContentDiv);
        const start = reportStartDate.value, end = reportEndDate.value;
        let query = (start && end) ? `?start_date=${start}&end_date=${end}` : '';
        const data = await apiRequest(`/relatorios${query}`);
        if (data) {
            dadosRelatoriosCache = data; // Salva no cache
            relatoriosContentDiv.innerHTML = `
                <div class="relatorio-card">
                    <h4><i class="fas fa-medal"></i> Ranking de Turmas (Mais idas)</h4>
                    <ul>${data.top_turmas.map(turma => `<li>${turma.NOME_TURMA}<span>${turma.total_idas} idas</span></li>`).join('') || '<li>Nenhum registro no período.</li>'}</ul>
                </div>
                <div class="relatorio-card">
                    <h4><i class="fas fa-trophy"></i> Top 10 Alunos com Mais Idas</h4>
                    <ul>${data.top_alunos.map(aluno => `<li>
                        <div class="aluno-info">${aluno.NOME_USUARIO}<small>${aluno.NOME_TURMA}</small></div>
                        <div class="actions">
                            <span>${aluno.total_idas} idas</span>
                            <button class="btn-ver-historico" data-aluno-id="${aluno.aluno_id}" data-aluno-nome="${aluno.NOME_USUARIO}"><i class="fas fa-history"></i></button>
                        </div>
                    </li>`).join('') || '<li>Nenhum registro no período.</li>'}</ul>
                </div>`;
        } else { relatoriosContentDiv.innerHTML = '<p>Erro ao carregar os relatórios.</p>'; }
    }

    function abrirModalGraficos() {
        if (!dadosRelatoriosCache || !dadosRelatoriosCache.pico_horas) {
            showModal('Aviso', '<p>Nenhum dado de gráfico disponível. Carregue os relatórios primeiro.</p>');
            return;
        }

        const html = `
            <div class="relatorio-card" style="width: 100%; height: 400px;">
                <canvas id="chart-pico-modal"></canvas>
            </div>
        `;
        showModal('Gráficos - Horários de Pico (Geral)', html);

        setTimeout(() => {
            renderChart('chart-pico-modal', dadosRelatoriosCache.pico_horas, 'Idas ao Banheiro');
        }, 100);
    }

    function setDateFilter(range) {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        if (range === 'today') { }
        else if (range === 'week') { start.setDate(today.getDate() - today.getDay()); }
        else if (range === 'month') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
        else if (range === 'all') { reportStartDate.value = ''; reportEndDate.value = ''; return; }
        reportStartDate.value = start.toISOString().split('T')[0];
        reportEndDate.value = end.toISOString().split('T')[0];
    }

    function filterItems(query, container, selector) {
        const items = container.querySelectorAll(selector);
        const lowerCaseQuery = query.toLowerCase();
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(lowerCaseQuery)) item.style.display = '';
            else item.style.display = 'none';
        });
    }

    // === AÇÕES DE CRUD E LÓGICA ===
    async function handleAcaoAluno(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const { action, alunoId, alunoNome } = btn.dataset;
        if (action === 'entrou' || action === 'saiu') {
            try {
                const resultado = await apiRequest('/eventos', 'POST', { aluno_id: parseInt(alunoId), acao: action });
                if (resultado && resultado.success) updateDadosTurma();
            } catch (error) {
                showModal('Aviso', `<p>${error.message}</p>`);
            }
        } else if (action === 'historico') {
            mostrarHistorico(alunoId, alunoNome);
        }
    }

    function handleGerenciamento(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id, nome } = btn.dataset;
        if (action === 'select-turma') {
            turmaAtualId = id;
            nomeTurmaHeader.innerHTML = `<i class="fas fa-chalkboard-teacher"></i> Turma ${nome}`;
            showTela('principal');
            return;
        }
        if (action.includes('edit') || action.includes('delete')) {
            e.stopPropagation();
            const type = action.split('-')[1];
            if (action.includes('edit')) {
                showEditModal(type, id, nome);
            } else {
                handleDelete(type, id, nome);
            }
        }
    }

    async function handleDelete(type, id, name) {
        const endpointMap = { aluno: '/alunos', turma: '/turmas', professor: '/professores' };
        const endpoint = endpointMap[type];
        let warning = '';
        if (type === 'turma') warning = '\n\nAVISO: Todos os alunos e registros desta turma também serão excluídos.';
        if (type === 'professor') warning = '\n\nAVISO: Esta ação só funcionará se o professor não estiver responsável por nenhuma turma.';
        if (confirm(`Tem certeza que deseja excluir "${name}"?${warning}`)) {
            try {
                const result = await apiRequest(endpoint, 'DELETE', { id: parseInt(id) });
                if (result && result.success) {
                    showModal('Sucesso', result.message);
                    if (type === 'turma') carregarTurmas();
                    else if (type === 'professor') carregarVisaoGeral();
                    else updateDadosTurma();
                }
            } catch (error) {
                showModal('Erro', `<p>${error.message}</p>`);
            }
        }
    }

    // === MODAL ===
    function showModal(title, content) {
        modalTitle.innerHTML = title;
        modalBody.innerHTML = content;
        modalFooter.style.display = 'none';
        modal.style.display = 'flex';
    }
    function closeModal() {
        modal.style.display = 'none';
    }

    async function showEditModal(type, id, currentName) {
        modalTitle.textContent = `Editar - ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        let bodyHTML = `<label>Nome:</label><input type="text" id="modal-edit-input" value="${currentName}" class="modal-input">`;
        let onSave;
        const endpointMap = { aluno: '/alunos', turma: '/turmas', professor: '/professores' };
        const endpoint = endpointMap[type];

        if (type === 'aluno' || type === 'professor') {
            onSave = async () => {
                const newName = document.getElementById('modal-edit-input').value.trim();
                if (newName && newName !== currentName) {
                    try {
                        const result = await apiRequest(endpoint, 'PUT', { id: parseInt(id), nome: newName });
                        if (result && result.success) {
                            closeModal();
                            if (type === 'professor') carregarVisaoGeral();
                            else updateDadosTurma();
                        }
                    } catch (error) { showModal('Erro', `<p>${error.message}</p>`); }
                } else { closeModal(); }
            };
        } else if (type === 'turma') {
            const turmas = await apiRequest('/turmas');
            const turmaAtual = turmas.find(t => t.ID == id);
            let professorOptions = todosProfessores.map(p => `<option value="${p.ID}" ${turmaAtual && p.NOME_PROFESSOR === turmaAtual.NOME_PROFESSOR ? 'selected' : ''}>${p.NOME_PROFESSOR}</option>`).join('');
            bodyHTML += `<label>Professor Responsável:</label><select id="modal-select-professor" class="modal-input">${professorOptions}</select>`;
            onSave = async () => {
                const newName = document.getElementById('modal-edit-input').value.trim();
                const newProfId = document.getElementById('modal-select-professor').value;
                if (newName && newProfId) {
                    try {
                        const result = await apiRequest(endpoint, 'PUT', { id: parseInt(id), nome: newName, fk_id_professor: parseInt(newProfId) });
                        if (result && result.success) { closeModal(); carregarTurmas(); }
                    } catch (error) { showModal('Erro', `<p>${error.message}</p>`); }
                } else { showModal('Erro', '<p>Nome da turma e professor são obrigatórios.</p>'); }
            };
        }

        modalBody.innerHTML = bodyHTML;
        modalFooter.style.display = 'flex';
        btnModalSave.onclick = onSave;
        modal.style.display = 'flex';
    }

    async function mostrarHistorico(alunoId, alunoNome) {
        showModal(`Histórico de ${alunoNome}`, '<p>Carregando...</p>');
        try {
            const historico = await apiRequest(`/alunos/historico?aluno_id=${alunoId}`);
            if (!historico) return;
            if (historico.length === 0) {
                modalBody.innerHTML = '<p>Nenhum registro encontrado.</p>';
                return;
            }

            // === SOMA DO TEMPO TOTAL ===
            let totalSegundos = 0;
            historico.forEach(reg => {
                if (reg.DURACAO) {
                    const match = reg.DURACAO.match(/(\d+)m\s*(\d+)s/);
                    if (match) {
                        const minutos = parseInt(match[1], 10);
                        const segundos = parseInt(match[2], 10);
                        totalSegundos += minutos * 60 + segundos;
                    }
                }
            });

            const horas = Math.floor(totalSegundos / 3600);
            const minutos = Math.floor((totalSegundos % 3600) / 60);
            const segundos = totalSegundos % 60;
            const totalFormatado = `${horas > 0 ? horas + 'h ' : ''}${minutos}m ${segundos}s`;

            // === QUANTIDADE DE IDAS ===
            const qtdIdas = historico.filter(reg => reg.ACAO === 'saiu').length;

            // === TABELA ===
            let tableHtml = `
            <p><strong>Total de tempo no banheiro:</strong> ${totalFormatado}</p>
            <p><strong>Quantidade de idas ao banheiro:</strong> ${qtdIdas}</p>
        `;
            tableHtml += `<table class="history-table"><thead><tr><th>Ação</th><th>Data e Hora</th><th>Duração</th></tr></thead><tbody>`;
            historico.forEach(reg => {
                const icon = reg.ACAO === 'entrou' ? 'fa-sign-in-alt' : 'fa-sign-out-alt';
                const color = reg.ACAO === 'entrou' ? 'var(--danger)' : 'var(--success)';
                tableHtml += `<tr>
                <td style="color: ${color};"><i class="fas ${icon}"></i> ${reg.ACAO.charAt(0).toUpperCase() + reg.ACAO.slice(1)}</td>
                <td>${reg.HORARIO_FORMATADO}</td>
                <td>${reg.DURACAO || '---'}</td>
            </tr>`;
            });
            modalBody.innerHTML = tableHtml + '</tbody></table>';
        } catch (error) {
            showModal('Erro', `<p>${error.message}</p>`);
        }
    }

    async function mostrarRelatorioTurma(range = 'month', customStart = null, customEnd = null) {
        if (!turmaAtualId) return;

        if (typeof range !== 'string') range = 'month';

        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (range === 'today') { }
        else if (range === 'week') { start.setDate(today.getDate() - today.getDay()); }
        else if (range === 'month') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
        else if (range === 'all') { start = null; end = null; }
        else if (range === 'custom' && customStart && customEnd) {
            start = new Date(customStart + 'T00:00:00');
            end = new Date(customEnd + 'T23:59:59');
        }

        const startDateStr = start ? start.toISOString().split('T')[0] : '';
        const endDateStr = end ? end.toISOString().split('T')[0] : '';

        const inputStartVal = customStart || startDateStr;
        const inputEndVal = customEnd || endDateStr;

        showModal('Relatório da Sala', '<p>Carregando...</p>');

        try {
            let query = `?turma_id=${turmaAtualId}`;
            if (startDateStr && endDateStr) query += `&start_date=${startDateStr}&end_date=${endDateStr}`;

            const data = await apiRequest(`/relatorios/turma${query}`);

            if (!data) {
                modalBody.innerHTML = '<p>Erro ao carregar dados.</p>';
                return;
            }

            let html = `
                <div class="modal-filters" style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-filter ${range === 'today' ? 'active' : ''}" onclick="window.filtrarRelatorioTurma('today')">Hoje</button>
                        <button class="btn-filter ${range === 'week' ? 'active' : ''}" onclick="window.filtrarRelatorioTurma('week')">Semana</button>
                        <button class="btn-filter ${range === 'month' ? 'active' : ''}" onclick="window.filtrarRelatorioTurma('month')">Mês</button>
                        <button class="btn-filter ${range === 'all' ? 'active' : ''}" onclick="window.filtrarRelatorioTurma('all')">Tudo</button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                        <label>De: <input type="date" id="modal-report-start" value="${inputStartVal}" style="padding: 5px; border-radius: 5px; border: 1px solid var(--border-color);"></label>
                        <label>Até: <input type="date" id="modal-report-end" value="${inputEndVal}" style="padding: 5px; border-radius: 5px; border: 1px solid var(--border-color);"></label>
                        <button onclick="window.filtrarRelatorioTurma('custom')" style="padding: 5px 10px; border-radius: 5px; border: none; background: var(--primary); color: white; cursor: pointer;">Filtrar</button>
                    </div>
                </div>
            `;

            if (data.destaque) {
                html += `
                <div class="destaque-card" style="background: var(--bg-secondary); padding: 15px; border-radius: 10px; text-align: center; margin-bottom: 20px; border: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 10px 0; color: var(--primary);"><i class="fas fa-trophy"></i> Aluno que mais saiu</h4>
                    <h2 style="margin: 0;">${data.destaque.nome}</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.8;">${data.destaque.total_idas} saídas | Tempo total: ${data.destaque.tempo_formatado}</p>
                </div>`;
            }

            html += `
            <div class="tabs" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 15px;">
                <button class="tab-btn active" onclick="window.switchTab('stats')" id="tab-btn-stats" style="flex: 1; padding: 10px; background: none; border: none; cursor: pointer; border-bottom: 3px solid #007bff; font-weight: bold; color: #007bff;">Estatísticas</button>
                <button class="tab-btn" onclick="window.switchTab('history')" id="tab-btn-history" style="flex: 1; padding: 10px; background: none; border: none; cursor: pointer; opacity: 0.6; color: var(--text-color);">Histórico Detalhado</button>
            </div>`;

            html += `<div id="tab-content-stats">`;

            html += `
                <div class="relatorio-card" style="margin-bottom: 20px;">
                    <h4><i class="fas fa-chart-line"></i> Horários de Pico (Turma)</h4>
                    <canvas id="chart-pico-turma"></canvas>
                </div>`;

            if (data.stats.length === 0) {
                html += '<p>Nenhum registro no período.</p>';
            } else {
                html += `<table class="history-table"><thead><tr><th>Aluno</th><th>Qtd. Saídas</th><th>Tempo Total</th></tr></thead><tbody>`;
                data.stats.forEach(s => {
                    html += `<tr><td>${s.nome}</td><td>${s.total_idas}</td><td>${s.tempo_formatado}</td></tr>`;
                });
                html += `</tbody></table>`;
            }
            html += `</div>`;

            html += `<div id="tab-content-history" style="display: none;">`;
            if (data.history.length === 0) {
                html += '<p>Nenhum registro no período.</p>';
            } else {
                html += `<table class="history-table"><thead><tr><th>Aluno</th><th>Entrada</th><th>Saída</th><th>Duração</th></tr></thead><tbody>`;
                data.history.forEach(reg => {
                    html += `<tr><td>${reg.NOME_USUARIO}</td><td>${reg.ENTRADA}</td><td>${reg.SAIDA}</td><td>${reg.DURACAO}</td></tr>`;
                });
                html += `</tbody></table>`;
            }
            html += `</div>`;

            modalBody.innerHTML = html;

            if (data.pico_horas) {
                setTimeout(() => {
                    renderChart('chart-pico-turma', data.pico_horas, 'Idas ao Banheiro (Turma)');
                }, 100);
            }

        } catch (error) {
            showModal('Erro', `<p>${error.message}</p>`);
        }
    }

    window.filtrarRelatorioTurma = (range) => {
        let start = null;
        let end = null;
        if (range === 'custom') {
            const inputStart = document.getElementById('modal-report-start');
            const inputEnd = document.getElementById('modal-report-end');
            if (inputStart && inputEnd) {
                start = inputStart.value;
                end = inputEnd.value;
            }
        }
        mostrarRelatorioTurma(range, start, end);
    };

    window.switchTab = (tab) => {
        document.getElementById('tab-content-stats').style.display = tab === 'stats' ? 'block' : 'none';
        document.getElementById('tab-content-history').style.display = tab === 'history' ? 'block' : 'none';

        const btnStats = document.getElementById('tab-btn-stats');
        const btnHistory = document.getElementById('tab-btn-history');

        if (tab === 'stats') {
            btnStats.style.borderBottom = '3px solid #007bff';
            btnStats.style.color = '#007bff';
            btnStats.style.opacity = '1';

            btnHistory.style.borderBottom = 'none';
            btnHistory.style.color = 'var(--text-color)';
            btnHistory.style.opacity = '0.6';
        } else {
            btnHistory.style.borderBottom = '3px solid #007bff';
            btnHistory.style.color = '#007bff';
            btnHistory.style.opacity = '1';

            btnStats.style.borderBottom = 'none';
            btnStats.style.color = 'var(--text-color)';
            btnStats.style.opacity = '0.6';
        }
    };

    // === EVENT LISTENERS ===
    themeToggleBtn.addEventListener('click', () => { const currentTheme = localStorage.getItem('escola-theme') || 'light'; applyTheme(currentTheme === 'light' ? 'dark' : 'light'); });
    btnIrParaTurmas.addEventListener('click', () => { carregarTurmas(); showTela('escolha'); });
    btnVoltarParaGeral.addEventListener('click', () => showTela('geral'));
    btnVoltarParaEscolha.addEventListener('click', () => { carregarTurmas(); showTela('escolha'); });
    btnIrParaRelatorios.addEventListener('click', () => { setDateFilter('month'); carregarRelatorios(); showTela('relatorios'); });
    btnVoltarParaGeralRelatorios.addEventListener('click', () => showTela('geral'));
    btnAbrirScanner.addEventListener('click', () => showTela('scanner'));
    btnVoltarParaGeralScanner.addEventListener('click', () => showTela('geral'));
    document.getElementById('btn-relatorio-turma').addEventListener('click', mostrarRelatorioTurma);
    reportPresetButtons.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { document.querySelectorAll('.preset-buttons button').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); setDateFilter(e.target.dataset.range); carregarRelatorios(); } });
    [reportStartDate, reportEndDate].forEach(input => input.addEventListener('change', carregarRelatorios));
    relatoriosContentDiv.addEventListener('click', e => { const btn = e.target.closest('.btn-ver-historico'); if (btn) { const { alunoId, alunoNome } = btn.dataset; mostrarHistorico(alunoId, alunoNome); } });
    inputSearchTurmas.addEventListener('keyup', () => filterItems(inputSearchTurmas.value, listaTurmasDiv, '.btn-turma'));
    inputSearchAlunos.addEventListener('keyup', () => filterItems(inputSearchAlunos.value, gridAlunosDiv, '.person-card'));
    btnSalvarConfig.addEventListener('click', async () => { try { const result = await apiRequest('/config', 'POST', { max_alunos_banheiro: parseInt(inputMaxAlunos.value, 10) }); if (result && result.success) showModal('Sucesso', result.message); } catch (error) { showModal('Erro', `<p>${error.message}</p>`); } });
    btnAddProfessor.addEventListener('click', async () => { try { const result = await apiRequest('/professores', 'POST', { nome_professor: inputNomeProfessor.value }); if (result && result.success) { showModal('Sucesso', result.message); inputNomeProfessor.value = ''; carregarVisaoGeral(); } } catch (error) { showModal('Erro', `<p>${error.message}</p>`); } });
    btnAddTurma.addEventListener('click', async () => { try { const result = await apiRequest('/turmas', 'POST', { nome_turma: inputNomeTurma.value, fk_id_professor: selectProfessorTurma.value }); if (result && result.success) { showModal('Sucesso', result.message); inputNomeTurma.value = ''; selectProfessorTurma.selectedIndex = 0; carregarTurmas(); carregarVisaoGeral(); } } catch (error) { showModal('Erro', `<p>${error.message}</p>`); } });
    btnAddAluno.addEventListener('click', async () => { try { const result = await apiRequest('/alunos', 'POST', { nome_aluno: inputNomeAluno.value, fk_id_turma: turmaAtualId }); if (result && result.success) { showModal('Sucesso', result.message); inputNomeAluno.value = ''; updateDadosTurma(); } } catch (error) { showModal('Erro', `<p>${error.message}</p>`); } });
    gridAlunosDiv.addEventListener('click', handleAcaoAluno);
    listaTurmasDiv.addEventListener('click', handleGerenciamento);
    listaProfessoresAdminDiv.addEventListener('click', handleGerenciamento);
    gridAlunosDiv.addEventListener('click', handleGerenciamento);
    modalClose.addEventListener('click', closeModal);
    btnModalCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    btnVerGraficos.addEventListener('click', abrirModalGraficos);

    // === INICIALIZAÇÃO ===
    const savedTheme = localStorage.getItem('escola-theme') || 'light';
    applyTheme(savedTheme);
    showTela('geral');
});