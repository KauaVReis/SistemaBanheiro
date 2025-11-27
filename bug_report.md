### Bug Report

*   **File**: `api.php`
*   **Line**: 170 (original location of the bug)
*   **Description**: The `delete_turma` action in `api.php` was not correctly handling the deletion of a class and its associated students. When a class was deleted, the students in that class were not deleted from the `USUARIOS` table, and their associated records in the `REGISTROS` table were also left behind. This resulted in orphaned data in the database and a misleading success message to the user.
*   **Impact**: This bug leads to data inconsistency and database bloat. Over time, the database would accumulate a significant amount of orphaned data, which could lead to unexpected behavior in the application.
*   **Proposed Fix**: The fix implements a cascading delete within the `delete_turma` case. It first deletes all associated records from the `REGISTROS` table, then deletes the students from the `USUARIOS` table, and finally deletes the class from the `TURMAS` table. The entire operation is wrapped in a database transaction to ensure that it is atomic and that the database is left in a consistent state.
