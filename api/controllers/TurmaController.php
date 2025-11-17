<?php
// api/controllers/TurmaController.php
require_once __DIR__ . '/../config/db.php';

class TurmaController {
    // ... (métodos getAll, create, delete continuam iguais) ...
    public function getAll() {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT t.ID, t.NOME_TURMA, p.NOME_PROFESSOR FROM TURMAS t LEFT JOIN PROFESSORES p ON t.FK_ID_PROFESSOR = p.ID ORDER BY t.NOME_TURMA");
        echo json_encode($stmt->fetchAll());
    }

    public function create() {
        $data = json_decode(file_get_contents('php://input'), true);
        $nome = trim(filter_var($data['nome_turma'] ?? '', FILTER_SANITIZE_STRING));
        $prof_id = filter_var($data['fk_id_professor'] ?? null, FILTER_VALIDATE_INT);
        if (empty($nome) || !$prof_id) {
            throw new Exception('Nome da turma e professor são obrigatórios.');
        }
        $pdo = getDbConnection();
        $sql = "INSERT INTO TURMAS (NOME_TURMA, FK_ID_PROFESSOR) VALUES (:nome, :prof_id)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':nome', $nome, PDO::PARAM_STR);
        $stmt->bindValue(':prof_id', $prof_id, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode(['success' => true, 'message' => 'Turma cadastrada!']);
    }

    public function update() {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        $nome = trim(filter_var($data['nome'] ?? '', FILTER_SANITIZE_STRING));
        $prof_id = filter_var($data['fk_id_professor'] ?? null, FILTER_VALIDATE_INT);

        if (!$id || empty($nome) || !$prof_id) {
            throw new Exception('Dados inválidos para atualizar turma. Nome e professor são obrigatórios.');
        }

        $pdo = getDbConnection();
        $sql = "UPDATE TURMAS SET NOME_TURMA = :nome, FK_ID_PROFESSOR = :prof_id WHERE ID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':nome', $nome, PDO::PARAM_STR);
        $stmt->bindValue(':prof_id', $prof_id, PDO::PARAM_INT);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Turma atualizada!']);
    }

    public function delete() {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            throw new Exception('ID da turma inválido para exclusão.');
        }
        $pdo = getDbConnection();
        $pdo->beginTransaction();
        try {
            $stmt1 = $pdo->prepare("DELETE FROM REGISTROS WHERE FK_ID_USUARIO IN (SELECT ID FROM USUARIOS WHERE FK_ID_TURMA = :turma_id)");
            $stmt1->bindValue(':turma_id', $id, PDO::PARAM_INT);
            $stmt1->execute();
            $stmt2 = $pdo->prepare("DELETE FROM USUARIOS WHERE FK_ID_TURMA = :turma_id");
            $stmt2->bindValue(':turma_id', $id, PDO::PARAM_INT);
            $stmt2->execute();
            $stmt3 = $pdo->prepare("DELETE FROM TURMAS WHERE ID = :turma_id");
            $stmt3->bindValue(':turma_id', $id, PDO::PARAM_INT);
            $stmt3->execute();
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Turma e todos os seus alunos foram excluídos.']);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw new Exception("Erro ao excluir turma: " . $e->getMessage());
        }
    }
}