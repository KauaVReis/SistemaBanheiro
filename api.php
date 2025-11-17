<?php
// api.php
header('Content-Type: application/json');
require_once 'config/db.php';

date_default_timezone_set('America/Sao_Paulo');
$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

try {
    if (in_array($action, ['add_professor', 'add_turma', 'add_aluno', 'registrar_evento', 'update_config', 'update_aluno', 'update_turma', 'delete_aluno', 'delete_turma'])) {
        $pdo->beginTransaction();
    }

    switch ($action) {
        /* ========================================================== */
        /*                       CREATE                               */
        /* ========================================================== */
        case 'add_professor':
            $nome = trim(filter_var($data['nome_professor'] ?? '', FILTER_SANITIZE_STRING));
            if (empty($nome)) { throw new Exception('Nome do professor é obrigatório.'); }
            $sql = "INSERT INTO PROFESSORES (NOME_PROFESSOR) VALUES (?)";
            $pdo->prepare($sql)->execute([$nome]);
            echo json_encode(['success' => true, 'message' => 'Professor cadastrado!']);
            break;

        case 'add_turma':
            $nome = trim(filter_var($data['nome_turma'] ?? '', FILTER_SANITIZE_STRING));
            $prof_id = filter_var($data['fk_id_professor'] ?? null, FILTER_VALIDATE_INT);
            if (empty($nome) || !$prof_id) { throw new Exception('Nome da turma e professor são obrigatórios.'); }
            $sql = "INSERT INTO TURMAS (NOME_TURMA, FK_ID_PROFESSOR) VALUES (?, ?)";
            $pdo->prepare($sql)->execute([$nome, $prof_id]);
            echo json_encode(['success' => true, 'message' => 'Turma cadastrada!']);
            break;

        case 'add_aluno':
            $nome = trim(filter_var($data['nome_aluno'] ?? '', FILTER_SANITIZE_STRING));
            $turma_id = filter_var($data['fk_id_turma'] ?? null, FILTER_VALIDATE_INT);
            if (empty($nome) || !$turma_id) { throw new Exception('Nome do aluno e turma são obrigatórios.'); }
            $sql = "INSERT INTO USUARIOS (NOME_USUARIO, FK_ID_TURMA) VALUES (?, ?)";
            $pdo->prepare($sql)->execute([$nome, $turma_id]);
            echo json_encode(['success' => true, 'message' => 'Aluno cadastrado!']);
            break;

        /* ========================================================== */
        /*                       READ                                 */
        /* ========================================================== */
        case 'get_config':
            $stmt = $pdo->query("SELECT valor FROM CONFIGURACOES WHERE chave = 'max_alunos_banheiro'");
            $valor = $stmt->fetchColumn();
            echo json_encode(['max_alunos_banheiro' => $valor ? (int)$valor : 5]);
            break;
            
        case 'get_professores':
            $stmt = $pdo->query("SELECT ID, NOME_PROFESSOR FROM PROFESSORES ORDER BY NOME_PROFESSOR");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get_turmas':
            $stmt = $pdo->query("SELECT ID, NOME_TURMA FROM TURMAS ORDER BY NOME_TURMA");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get_geral_banheiro':
            $sql = "SELECT u.NOME_USUARIO, t.NOME_TURMA FROM USUARIOS u JOIN TURMAS t ON u.FK_ID_TURMA = t.ID WHERE u.STATUS = 'no_banheiro' ORDER BY t.NOME_TURMA, u.NOME_USUARIO";
            $stmt = $pdo->query($sql);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'get_alunos_por_turma':
            $turma_id = filter_input(INPUT_GET, 'turma_id', FILTER_VALIDATE_INT);
            if (!$turma_id) { throw new Exception('ID da turma inválido.'); }
            $stmt_alunos = $pdo->prepare("SELECT ID, NOME_USUARIO, STATUS FROM USUARIOS WHERE FK_ID_TURMA = ? ORDER BY NOME_USUARIO");
            $stmt_alunos->execute([$turma_id]);
            $stmt_banheiro = $pdo->prepare("SELECT ID, NOME_USUARIO FROM USUARIOS WHERE FK_ID_TURMA = ? AND STATUS = 'no_banheiro'");
            $stmt_banheiro->execute([$turma_id]);
            echo json_encode(['alunos' => $stmt_alunos->fetchAll(PDO::FETCH_ASSOC), 'no_banheiro' => $stmt_banheiro->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'get_historico_aluno':
            $aluno_id = filter_input(INPUT_GET, 'aluno_id', FILTER_VALIDATE_INT);
            if (!$aluno_id) { throw new Exception('ID do aluno inválido.'); }
            $stmt = $pdo->prepare("SELECT ACAO, HORARIO FROM REGISTROS WHERE FK_ID_USUARIO = ? ORDER BY HORARIO ASC");
            $stmt->execute([$aluno_id]);
            $registros = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $historico_formatado = []; $horario_entrada = null;
            foreach ($registros as $reg) {
                $horario_atual = new DateTime($reg['HORARIO']);
                $item = ['ACAO' => $reg['ACAO'], 'HORARIO_FORMATADO' => $horario_atual->format('d/m/Y H:i:s'), 'DURACAO' => null];
                if ($reg['ACAO'] === 'entrou') { $horario_entrada = $horario_atual; } 
                elseif ($reg['ACAO'] === 'saiu' && $horario_entrada) {
                    $item['DURACAO'] = $horario_atual->diff($horario_entrada)->format('%im %ss');
                    $horario_entrada = null;
                }
                $historico_formatado[] = $item;
            }
            echo json_encode(array_reverse($historico_formatado));
            break;

        /* ========================================================== */
        /*                       UPDATE                               */
        /* ========================================================== */
        case 'update_config':
            $novo_limite = filter_var($data['max_alunos_banheiro'] ?? 0, FILTER_VALIDATE_INT);
            if ($novo_limite === false || $novo_limite < 1) { throw new Exception('Limite inválido.'); }
            $sql = "UPDATE CONFIGURACOES SET valor = ? WHERE chave = 'max_alunos_banheiro'";
            $pdo->prepare($sql)->execute([$novo_limite]);
            echo json_encode(['success' => true, 'message' => 'Limite de alunos no banheiro atualizado para ' . $novo_limite]);
            break;

        case 'update_turma':
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $nome = trim(filter_var($data['nome'] ?? '', FILTER_SANITIZE_STRING));
            if (!$id || empty($nome)) { throw new Exception('Dados inválidos para atualizar turma.'); }
            $sql = "UPDATE TURMAS SET NOME_TURMA = ? WHERE ID = ?";
            $pdo->prepare($sql)->execute([$nome, $id]);
            echo json_encode(['success' => true, 'message' => 'Turma atualizada!']);
            break;

        case 'update_aluno':
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $nome = trim(filter_var($data['nome'] ?? '', FILTER_SANITIZE_STRING));
            if (!$id || empty($nome)) { throw new Exception('Dados inválidos para atualizar aluno.'); }
            $sql = "UPDATE USUARIOS SET NOME_USUARIO = ? WHERE ID = ?";
            $pdo->prepare($sql)->execute([$nome, $id]);
            echo json_encode(['success' => true, 'message' => 'Aluno atualizado!']);
            break;

        /* ========================================================== */
        /*                       DELETE                               */
        /* ========================================================== */
        case 'delete_turma':
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) { throw new Exception('ID da turma inválido para exclusão.'); }
            $sql = "DELETE FROM TURMAS WHERE ID = ?";
            $pdo->prepare($sql)->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Turma e todos os seus alunos foram excluídos.']);
            break;

        case 'delete_aluno':
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) { throw new Exception('ID do aluno inválido para exclusão.'); }
            $sql = "DELETE FROM USUARIOS WHERE ID = ?";
            $pdo->prepare($sql)->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Aluno excluído.']);
            break;

        /* ========================================================== */
        /*                       LOGIC                                */
        /* ========================================================== */
        case 'registrar_evento':
            $aluno_id = filter_var($data['aluno_id'] ?? null, FILTER_VALIDATE_INT);
            $acao = filter_var($data['acao'] ?? '', FILTER_SANITIZE_STRING);
            if (!$aluno_id || !in_array($acao, ['entrou', 'saiu'])) { throw new Exception('Dados inválidos.'); }
            
            if ($acao === 'entrou') {
                $stmt_limite = $pdo->query("SELECT valor FROM CONFIGURACOES WHERE chave = 'max_alunos_banheiro'");
                $limite_max = (int)$stmt_limite->fetchColumn();
                $stmt_contagem = $pdo->query("SELECT COUNT(*) FROM USUARIOS WHERE STATUS = 'no_banheiro'");
                $contagem_atual = (int)$stmt_contagem->fetchColumn();
                if ($contagem_atual >= $limite_max) {
                    throw new Exception("Limite de $limite_max aluno(s) no banheiro foi atingido. Aguarde.");
                }
            }
            
            $sql_registro = "INSERT INTO REGISTROS (FK_ID_USUARIO, ACAO, HORARIO) VALUES (?, ?, NOW())";
            $pdo->prepare($sql_registro)->execute([$aluno_id, $acao]);
            $novo_status = ($acao === 'entrou') ? 'no_banheiro' : 'na_sala';
            $sql_update = "UPDATE USUARIOS SET STATUS = ? WHERE ID = ?";
            $pdo->prepare($sql_update)->execute([$novo_status, $aluno_id]);
            echo json_encode(['success' => true, 'message' => 'Registro salvo.']);
            break;

        default:
            throw new Exception('Ação não encontrada.');
    }

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}