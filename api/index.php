<?php
// api/index.php
header('Content-Type: application/json');
date_default_timezone_set('America/Sao_Paulo');

foreach (glob("controllers/*.php") as $filename) {
    include_once $filename;
}

$route = $_GET['route'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'];

// --- MAPA DE ROTAS ---
$routes = [
    'GET /config' => [ConfigController::class, 'get'],
    'POST /config' => [ConfigController::class, 'update'],
    'GET /professores' => [ProfessorController::class, 'getAll'],
    'POST /professores' => [ProfessorController::class, 'create'],
    'PUT /professores' => [ProfessorController::class, 'update'],
    'DELETE /professores' => [ProfessorController::class, 'delete'],
    'GET /turmas' => [TurmaController::class, 'getAll'],
    'POST /turmas' => [TurmaController::class, 'create'],
    'PUT /turmas' => [TurmaController::class, 'update'],
    'DELETE /turmas' => [TurmaController::class, 'delete'],
    'GET /alunos' => [AlunoController::class, 'getByTurma'],
    'POST /alunos' => [AlunoController::class, 'create'],
    'PUT /alunos' => [AlunoController::class, 'update'],
    'DELETE /alunos' => [AlunoController::class, 'delete'],
    'GET /alunos/historico' => [AlunoController::class, 'getHistory'],
    'POST /eventos' => [AlunoController::class, 'registerEvent'],
    'POST /eventos/scan' => [AlunoController::class, 'registerEventByQr'],
    'GET /geral-banheiro' => [AlunoController::class, 'getGeralBanheiro'],
    'GET /relatorios' => [AlunoController::class, 'getReports'],
    'GET /turmas-admin' => [QrAdminController::class, 'getTurmas'],
    'GET /alunos-sem-qr' => [QrAdminController::class, 'getUnassignedStudents'],
    'POST /vincular-qr' => [QrAdminController::class, 'assignQrCode'],
    'GET /relatorios/turma' => [AlunoController::class, 'getTurmaReport'],
];

try {
    $routeKey = "$method $route";
    if (array_key_exists($routeKey, $routes)) {
        [$class, $function] = $routes[$routeKey];
        $controller = new $class();
        $controller->$function();
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Rota não encontrada: ' . $routeKey]);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()]);
}
