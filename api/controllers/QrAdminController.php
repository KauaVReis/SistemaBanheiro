<?php
// api/controllers/QrAdminController.php
require_once __DIR__ . '/../config/db.php';

class QrAdminController {

    public function getTurmas() {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT ID, NOME_TURMA FROM TURMAS ORDER BY NOME_TURMA");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function getUnassignedStudents() {
        $pdo = getDbConnection();
        
        $turma_id = filter_input(INPUT_GET, 'turma_id', FILTER_VALIDATE_INT);

        // Se um ID de turma for fornecido, filtra por essa turma
        if ($turma_id) {
            $sql = "
                SELECT u.ID, u.NOME_USUARIO, t.NOME_TURMA
                FROM USUARIOS u
                JOIN TURMAS t ON u.FK_ID_TURMA = t.ID
                WHERE (u.CODIGO_QR IS NULL OR u.CODIGO_QR = '') AND u.FK_ID_TURMA = :turma_id
                ORDER BY u.NOME_USUARIO
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':turma_id' => $turma_id]);
        } else {
            // Se nenhum ID de turma for fornecido, não retorna nenhum aluno
            // (Força o usuário a selecionar uma turma primeiro)
            $stmt = $pdo->prepare("SELECT * FROM USUARIOS WHERE 1 = 0"); // Query que não retorna nada
            $stmt->execute();
        }
        
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function assignQrCode() {
        $data = json_decode(file_get_contents('php://input'), true);

        $aluno_id = filter_var($data['aluno_id'] ?? null, FILTER_VALIDATE_INT);
        $codigo_qr = trim(filter_var($data['codigo_qr'] ?? '', FILTER_SANITIZE_STRING));

        if (!$aluno_id || empty($codigo_qr)) {
            throw new Exception('ID do aluno e Código QR são obrigatórios.');
        }

        $pdo = getDbConnection();

        $check_stmt = $pdo->prepare("SELECT COUNT(*) FROM USUARIOS WHERE CODIGO_QR = :codigo_qr AND ID != :aluno_id");
        $check_stmt->execute([':codigo_qr' => $codigo_qr, ':aluno_id' => $aluno_id]);
        if ($check_stmt->fetchColumn() > 0) {
            throw new Exception('Este QR Code já está em uso por outro aluno.');
        }

        $sql = "UPDATE USUARIOS SET CODIGO_QR = :codigo_qr WHERE ID = :aluno_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':codigo_qr' => $codigo_qr, ':aluno_id' => $aluno_id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Código QR vinculado com sucesso!']);
        } else {
            throw new Exception('Nenhum aluno foi atualizado. Verifique o ID do aluno.');
        }
    }
}