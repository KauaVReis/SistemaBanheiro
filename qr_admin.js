document.addEventListener('DOMContentLoaded', () => {
    const feedbackDiv = document.getElementById('scanner-feedback');
    const scannedCodeInput = document.getElementById('scanned-code');
    const turmaSelect = document.getElementById('turma-select');
    const studentSelect = document.getElementById('student-select');
    const assignButton = document.getElementById('assign-button');
    let qrCodeScanner;

    const API_BASE_URL = 'api/index.php';

    async function fetchTurmas() {
        try {
            const response = await fetch(`${API_BASE_URL}?route=/turmas-admin`);
            const turmas = await response.json();
            
            turmaSelect.innerHTML = '<option value="">-- Selecione uma turma --</option>';
            turmas.forEach(turma => {
                const option = document.createElement('option');
                option.value = turma.ID;
                option.textContent = turma.NOME_TURMA;
                turmaSelect.appendChild(option);
            });
        } catch (error) {
            setFeedback('error', 'Erro ao buscar turmas.');
        }
    }

    async function fetchUnassignedStudents(turmaId) {
        studentSelect.innerHTML = '<option value="">Carregando alunos...</option>';
        studentSelect.disabled = true;

        if (!turmaId) {
            studentSelect.innerHTML = '<option value="">Aguardando seleção da turma...</option>';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}?route=/alunos-sem-qr&turma_id=${turmaId}`);
            const students = await response.json();
            
            studentSelect.innerHTML = '<option value="">-- Selecione um aluno --</option>';
            if (students.length > 0) {
                students.forEach(student => {
                    const option = document.createElement('option');
                    option.value = student.ID;
                    option.textContent = student.NOME_USUARIO;
                    studentSelect.appendChild(option);
                });
                studentSelect.disabled = false;
            } else {
                studentSelect.innerHTML = '<option value="">Nenhum aluno sem QR code nesta turma.</option>';
            }
        } catch (error) {
            setFeedback('error', 'Erro ao buscar alunos.');
        }
    }

    async function assignQrCode() {
        const studentId = studentSelect.value;
        const qrCode = scannedCodeInput.value;

        if (!studentId || !qrCode) {
            alert('Por favor, escaneie um código e selecione um aluno.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}?route=/vincular-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aluno_id: studentId, codigo_qr: qrCode })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            setFeedback('success', `Sucesso! Código vinculado ao aluno.`);
            scannedCodeInput.value = '';
            assignButton.disabled = true;
            
            // Recarrega a lista de alunos da turma selecionada
            fetchUnassignedStudents(turmaSelect.value);

        } catch (error) {
            setFeedback('error', `Erro: ${error.message}`);
        }
    }

    function onScanSuccess(decodedText) {
        setFeedback('success', `Código lido: ${decodedText}`);
        scannedCodeInput.value = decodedText;
        if (studentSelect.value) { // Habilita o botão apenas se um aluno já estiver selecionado
            assignButton.disabled = false;
        }
        qrCodeScanner.pause(true);
        setTimeout(() => qrCodeScanner.resume(), 2000);
    }

    function setFeedback(type, message) {
        feedbackDiv.textContent = message;
        feedbackDiv.className = `feedback-box ${type}`;
    }

    function startScanner() {
        qrCodeScanner = new Html5Qrcode("qr-reader");
        qrCodeScanner.start({ facingMode: "environment" }, { fps: 5, qrbox: { width: 250, height: 250 } }, onScanSuccess)
            .catch(err => setFeedback('error', 'Não foi possível iniciar a câmera.'));
    }

    // Event Listeners
    turmaSelect.addEventListener('change', (e) => {
        fetchUnassignedStudents(e.target.value);
    });
    
    studentSelect.addEventListener('change', () => {
        // Habilita o botão de vincular se um aluno for selecionado e um código já tiver sido lido
        if (studentSelect.value && scannedCodeInput.value) {
            assignButton.disabled = false;
        } else {
            assignButton.disabled = true;
        }
    });

    assignButton.addEventListener('click', assignQrCode);

    // Inicialização
    startScanner();
    fetchTurmas();
});