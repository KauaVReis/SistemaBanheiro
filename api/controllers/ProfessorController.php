<?php
// api/controllers/ProfessorController.php
require_once __DIR__ . '/../config/db.php';

class ProfessorController
{
    public function getAll()
    {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT ID, NOME_PROFESSOR FROM PROFESSORES ORDER BY NOME_PROFESSOR");
        echo json_encode($stmt->fetchAll());
    }

    public function create()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $nome = trim(filter_var($data['nome_professor'] ?? '', FILTER_SANITIZE_STRING));
        if (empty($nome)) {
            throw new Exception('Nome do professor é obrigatório.');
        }
        $pdo = getDbConnection();
        $sql = "INSERT INTO PROFESSORES (NOME_PROFESSOR) VALUES (:nome)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':nome', $nome, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(['success' => true, 'message' => 'Professor cadastrado!']);
    }

    public function update()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        $nome = trim(filter_var($data['nome'] ?? '', FILTER_SANITIZE_STRING));
        if (!$id || empty($nome)) {
            throw new Exception('Dados inválidos para atualizar professor.');
        }
        $pdo = getDbConnection();
        $sql = "UPDATE PROFESSORES SET NOME_PROFESSOR = :nome WHERE ID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':nome', $nome, PDO::PARAM_STR);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode(['success' => true, 'message' => 'Professor atualizado!']);
    }

    public function delete()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            throw new Exception('ID do professor inválido para exclusão.');
        }
        $pdo = getDbConnection();

        // Verifica se o professor está vinculado a alguma turma
        $check_sql = "SELECT COUNT(*) FROM TURMAS WHERE FK_ID_PROFESSOR = :id";
        $check_stmt = $pdo->prepare($check_sql);
        $check_stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $check_stmt->execute();
        if ($check_stmt->fetchColumn() > 0) {
            throw new Exception('Não é possível excluir este professor, pois ele é responsável por uma ou mais turmas. Por favor, reatribua as turmas primeiro.');
        }

        $sql = "DELETE FROM PROFESSORES WHERE ID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode(['success' => true, 'message' => 'Professor excluído.']);
    }
}