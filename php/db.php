<?php
// setting up the SQLite database — used server-side for rate limiting logs and any future server-only data
// Firebase Firestore handles all user-facing data; this is purely for backend internals

function get_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dir = __DIR__ . '/../database';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $pdo = new PDO('sqlite:' . $dir . '/finsite.sqlite', null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // WAL mode gives better concurrent read performance
    $pdo->exec('PRAGMA journal_mode=WAL');

    // rate limit log table — stores per-IP request timestamps
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rate_log (
            ip         TEXT    NOT NULL,
            endpoint   TEXT    NOT NULL DEFAULT 'analyze',
            hit_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        )
    ");

    // creating an index for fast IP + time lookups
    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_rate_log_ip_time ON rate_log (ip, hit_at)
    ");

    return $pdo;
}
