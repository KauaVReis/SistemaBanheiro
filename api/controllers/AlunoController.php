<?php
// api/controllers/AlunoController.php
require_once __DIR__ . '/../config/db.php';

class AlunoController
{

    public function getByTurma()
    {
        $turma_id = filter_input(INPUT_GET, 'turma_id', FILTER_VALIDATE_INT);
        if (!$turma_id && $turma_id !== 0) {
            throw new Exception('ID da turma inválido.');
        }
        $pdo = getDbConnection();
        $stmt_alunos = $pdo->prepare("SELECT ID, NOME_USUARIO, STATUS, HORA_ENTRADA_BANHEIRO FROM USUARIOS WHERE FK_ID_TURMA = :turma_id ORDER BY NOME_USUARIO");
        $stmt_alunos->bindValue(':turma_id', $turma_id, PDO::PARAM_INT);
        $stmt_alunos->execute();
        $stmt_banheiro = $pdo->prepare("SELECT ID, NOME_USUARIO FROM USUARIOS WHERE FK_ID_TURMA = :turma_id AND STATUS = 'no_banheiro'");
        $stmt_banheiro->bindValue(':turma_id', $turma_id, PDO::PARAM_INT);
        $stmt_banheiro->execute();
        echo json_encode(['alunos' => $stmt_alunos->fetchAll(), 'no_banheiro' => $stmt_banheiro->fetchAll()]);
    }

    public function create()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $nome = trim(filter_var($data['nome_aluno'] ?? '', FILTER_SANITIZE_STRING));
        $turma_id = filter_var($data['fk_id_turma'] ?? null, FILTER_VALIDATE_INT);
        if (empty($nome) || !$turma_id) {
            throw new Exception('Nome do aluno e turma são obrigatórios.');
        }
        $pdo = getDbConnection();
        $sql = "INSERT INTO USUARIOS (NOME_USUARIO, FK_ID_TURMA) VALUES (:nome, :turma_id)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':nome' => $nome, ':turma_id' => $turma_id]);
        echo json_encode(['success' => true, 'message' => 'Aluno cadastrado!']);
    }

    public function update()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        $nome = trim(filter_var($data['nome'] ?? '', FILTER_SANITIZE_STRING));
        if (!$id || empty($nome)) {
            throw new Exception('Dados inválidos para atualizar aluno.');
        }
        $pdo = getDbConnection();
        $sql = "UPDATE USUARIOS SET NOME_USUARIO = :nome WHERE ID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':nome' => $nome, ':id' => $id]);
        echo json_encode(['success' => true, 'message' => 'Aluno atualizado!']);
    }

    public function delete()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            throw new Exception('ID do aluno inválido para exclusão.');
        }
        $pdo = getDbConnection();
        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM REGISTROS WHERE FK_ID_USUARIO = :id")->execute([':id' => $id]);
            $pdo->prepare("DELETE FROM USUARIOS WHERE ID = :id")->execute([':id' => $id]);
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Aluno excluído.']);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw new Exception("Erro ao excluir aluno: " . $e->getMessage());
        }
    }

    public function getHistory()
    {
        $aluno_id = filter_input(INPUT_GET, 'aluno_id', FILTER_VALIDATE_INT);
        if (!$aluno_id) {
            throw new Exception('ID do aluno inválido.');
        }
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("SELECT ACAO, HORARIO FROM REGISTROS WHERE FK_ID_USUARIO = :aluno_id ORDER BY HORARIO ASC");
        $stmt->execute([':aluno_id' => $aluno_id]);
        $registros = $stmt->fetchAll();
        $historico_formatado = [];
        $horario_entrada = null;
        foreach ($registros as $reg) {
            $horario_atual = new DateTime($reg['HORARIO']);
            $item = ['ACAO' => $reg['ACAO'], 'HORARIO_FORMATADO' => $horario_atual->format('d/m/Y H:i:s'), 'DURACAO' => null];
            if ($reg['ACAO'] === 'entrou') {
                $horario_entrada = $horario_atual;
            } elseif ($reg['ACAO'] === 'saiu' && $horario_entrada) {
                $item['DURACAO'] = $horario_atual->diff($horario_entrada)->format('%im %ss');
                $horario_entrada = null;
            }
            $historico_formatado[] = $item;
        }
        echo json_encode(array_reverse($historico_formatado));
    }

    public function registerEvent()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $aluno_id = filter_var($data['aluno_id'] ?? null, FILTER_VALIDATE_INT);
        $acao = filter_var($data['acao'] ?? '', FILTER_SANITIZE_STRING);
        if (!$aluno_id || !in_array($acao, ['entrou', 'saiu'])) {
            throw new Exception('Dados inválidos para registrar evento.');
        }
        $this->processRegistration($aluno_id, $acao);
    }

    private function processRegistration($aluno_id, $acao)
    {
        $pdo = getDbConnection();
        $pdo->beginTransaction();
        try {
            if ($acao === 'entrou') {
                $stmt_aluno = $pdo->prepare("SELECT FK_ID_TURMA FROM USUARIOS WHERE ID = :aluno_id");
                $stmt_aluno->execute([':aluno_id' => $aluno_id]);
                $fk_id_turma = $stmt_aluno->fetchColumn();
                if (!$fk_id_turma) {
                    throw new Exception('Aluno não encontrado.');
                }

                $stmt_limite = $pdo->query("SELECT valor FROM CONFIGURACOES WHERE chave = 'max_alunos_banheiro'");
                $limite_max = (int) $stmt_limite->fetchColumn();
                $stmt_contagem = $pdo->query("SELECT COUNT(*) FROM USUARIOS WHERE STATUS = 'no_banheiro'");
                if ($stmt_contagem->fetchColumn() >= $limite_max) {
                    throw new Exception("Limite GERAL de $limite_max aluno(s) no banheiro foi atingido. Aguarde.");
                }

                $stmt_turma_contagem = $pdo->prepare("SELECT COUNT(*) FROM USUARIOS WHERE STATUS = 'no_banheiro' AND FK_ID_TURMA = :turma_id");
                $stmt_turma_contagem->execute([':turma_id' => $fk_id_turma]);
                if ($stmt_turma_contagem->fetchColumn() > 0) {
                    throw new Exception('Já existe um aluno desta turma no banheiro. Por favor, aguarde.');
                }
            }

            $pdo->prepare("INSERT INTO REGISTROS (FK_ID_USUARIO, ACAO, HORARIO) VALUES (:aluno_id, :acao, NOW())")->execute([':aluno_id' => $aluno_id, ':acao' => $acao]);
            $novo_status = ($acao === 'entrou') ? 'no_banheiro' : 'na_sala';
            $hora_entrada = ($acao === 'entrou') ? date('Y-m-d H:i:s') : null;
            $pdo->prepare("UPDATE USUARIOS SET STATUS = :status, HORA_ENTRADA_BANHEIRO = :hora_entrada WHERE ID = :aluno_id")->execute([':status' => $novo_status, ':hora_entrada' => $hora_entrada, ':aluno_id' => $aluno_id]);
            $pdo->commit();

            $stmt_nome = $pdo->prepare("SELECT NOME_USUARIO FROM USUARIOS WHERE ID = :aluno_id");
            $stmt_nome->execute([':aluno_id' => $aluno_id]);
            $nome_aluno = $stmt_nome->fetchColumn();
            echo json_encode(['success' => true, 'message' => "Ação '$acao' registrada para $nome_aluno."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function registerEventByQr()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $codigo_qr = trim(filter_var($data['codigo_qr'] ?? '', FILTER_SANITIZE_STRING));
        if (empty($codigo_qr)) {
            throw new Exception('Código QR não fornecido.');
        }
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("SELECT ID, STATUS FROM USUARIOS WHERE CODIGO_QR = :codigo_qr");
        $stmt->execute([':codigo_qr' => $codigo_qr]);
        $aluno = $stmt->fetch();
        if (!$aluno) {
            throw new Exception('Aluno com este código QR não encontrado.');
        }
        $acao = ($aluno['STATUS'] === 'no_banheiro') ? 'saiu' : 'entrou';
        $this->processRegistration($aluno['ID'], $acao);
    }

    public function getGeralBanheiro()
    {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT u.NOME_USUARIO, t.NOME_TURMA, u.HORA_ENTRADA_BANHEIRO FROM USUARIOS u JOIN TURMAS t ON u.FK_ID_TURMA = t.ID WHERE u.STATUS = 'no_banheiro' ORDER BY t.NOME_TURMA, u.NOME_USUARIO");
        echo json_encode($stmt->fetchAll());
    }

    public function getReports()
    {
        $pdo = getDbConnection();

        // Pega as datas do filtro, se existirem
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;

        // Constrói a cláusula WHERE para o filtro de data
        $date_filter_sql = "";
        $params = [];
        if ($start_date && $end_date) {
            $date_filter_sql = " AND DATE(r.HORARIO) BETWEEN :start_date AND :end_date ";
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        }

        // 1. Relatório: Ranking de turmas que mais usaram o banheiro
        $sql_turmas = "
            SELECT t.NOME_TURMA, COUNT(r.ID) AS total_idas 
            FROM REGISTROS r
            JOIN USUARIOS u ON r.FK_ID_USUARIO = u.ID
            JOIN TURMAS t ON u.FK_ID_TURMA = t.ID
            WHERE r.ACAO = 'entrou' {$date_filter_sql}
            GROUP BY t.ID
            ORDER BY total_idas DESC
        ";
        $stmt_turmas = $pdo->prepare($sql_turmas);
        $stmt_turmas->execute($params);
        $top_turmas = $stmt_turmas->fetchAll();

        // 2. Relatório: Top 10 alunos que mais usaram o banheiro
        $sql_alunos = "
            SELECT u.ID as aluno_id, u.NOME_USUARIO, t.NOME_TURMA, COUNT(r.ID) AS total_idas 
            FROM REGISTROS r 
            JOIN USUARIOS u ON r.FK_ID_USUARIO = u.ID 
            JOIN TURMAS t ON u.FK_ID_TURMA = t.ID
            WHERE r.ACAO = 'entrou' {$date_filter_sql}
            GROUP BY u.ID 
            ORDER BY total_idas DESC 
            LIMIT 10
        ";
        $stmt_alunos = $pdo->prepare($sql_alunos);
        $stmt_alunos->execute($params);
        $top_alunos = $stmt_alunos->fetchAll();

        echo json_encode([
            'top_turmas' => $top_turmas,
            'top_alunos' => $top_alunos,
        ]);
    }
}