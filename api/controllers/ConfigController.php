<?php
// api/controllers/ConfigController.php
require_once __DIR__ . '/../config/db.php';

class ConfigController {
    public function get() {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT valor FROM CONFIGURACOES WHERE chave = 'max_alunos_banheiro'");
        $valor = $stmt->fetchColumn();
        echo json_encode(['max_alunos_banheiro' => $valor ? (int)$valor : 5]);
    }
    
    public function update() {
        $data = json_decode(file_get_contents('php://input'), true);
        $novo_limite = filter_var($data['max_alunos_banheiro'] ?? 0, FILTER_VALIDATE_INT);
        if ($novo_limite === false || $novo_limite < 1) {
            throw new Exception('Limite inválido.');
        }

        $pdo = getDbConnection();
        $sql = "UPDATE CONFIGURACOES SET valor = :limite WHERE chave = 'max_alunos_banheiro'";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limite', $novo_limite, PDO::PARAM_INT);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Limite de alunos no banheiro atualizado para ' . $novo_limite]);
    }
}