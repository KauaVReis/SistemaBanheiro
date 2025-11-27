<?php
// test_delete_turma.php

function getTestDbConnection() {
    $host = getenv('DB_HOST') ?: 'localhost';
    $dbname = getenv('DB_NAME') ?: 'escola_controle';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASS') ?: '';
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (\PDOException $e) {
        throw new \PDOException($e->getMessage(), (int)$e->getCode());
    }
}

function run_test() {
    $pdo = getTestDbConnection();
    $pdo->beginTransaction();

    try {
        // 1. Setup test data
        // Insert Professor
        $stmt = $pdo->prepare("INSERT INTO PROFESSORES (NOME_PROFESSOR) VALUES (?)");
        $stmt->execute(['Professor Teste']);
        $prof_id = $pdo->lastInsertId();

        // Insert Turma
        $stmt = $pdo->prepare("INSERT INTO TURMAS (NOME_TURMA, FK_ID_PROFESSOR) VALUES (?, ?)");
        $stmt->execute(['Turma Teste', $prof_id]);
        $turma_id = $pdo->lastInsertId();

        // Insert Alunos
        $stmt = $pdo->prepare("INSERT INTO USUARIOS (NOME_USUARIO, FK_ID_TURMA) VALUES (?, ?)");
        $stmt->execute(['Aluno Teste 1', $turma_id]);
        $aluno1_id = $pdo->lastInsertId();
        $stmt->execute(['Aluno Teste 2', $turma_id]);
        $aluno2_id = $pdo->lastInsertId();

        echo "Test data created (Professor ID: $prof_id, Turma ID: $turma_id, Aluno IDs: $aluno1_id, $aluno2_id)\n";

        // 2. Run the fixed delete logic directly
        // First, find all student IDs associated with the class
        $stmt_find_students = $pdo->prepare("SELECT ID FROM USUARIOS WHERE FK_ID_TURMA = ?");
        $stmt_find_students->execute([$turma_id]);
        $student_ids = $stmt_find_students->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($student_ids)) {
            // Create placeholders for the IN clause to delete records
            $placeholders = implode(',', array_fill(0, count($student_ids), '?'));

            // Delete associated records from REGISTROS table
            $sql_delete_registros = "DELETE FROM REGISTROS WHERE FK_ID_USUARIO IN ($placeholders)";
            $pdo->prepare($sql_delete_registros)->execute($student_ids);

            // Now, delete the students
            $sql_delete_usuarios = "DELETE FROM USUARIOS WHERE FK_ID_TURMA = ?";
            $pdo->prepare($sql_delete_usuarios)->execute([$turma_id]);
        }

        // Finally, delete the class itself
        $sql_delete_turma = "DELETE FROM TURMAS WHERE ID = ?";
        $pdo->prepare($sql_delete_turma)->execute([$turma_id]);

        echo "Executed delete on Turma ID: $turma_id\n";


        // 3. Verify the fix
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM USUARIOS WHERE FK_ID_TURMA = ?");
        $stmt->execute([$turma_id]);
        $remaining_students = $stmt->fetchColumn();

        if ($remaining_students > 0) {
            echo "\nTEST FAILED: $remaining_students student(s) were not deleted.\n";
        } else {
            echo "\nTEST PASSED: All students were deleted.\n";
        }

    } catch (Exception $e) {
        echo "An error occurred during test execution: " . $e->getMessage() . "\n";
    } finally {
        // 4. Cleanup
        echo "Cleaning up...\n";
        $pdo->rollBack(); // Rollback to undo all changes, ensuring a clean state
        echo "Cleanup complete.\n";
    }
}

run_test();
