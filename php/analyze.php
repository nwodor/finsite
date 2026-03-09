<?php
// using this as a server-side proxy for the AI API
// keeping the API key out of the browser — receiving the prompt via POST and returning JSON

require_once __DIR__ . '/config.php';

// setting response headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');

// handling CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Method not allowed.', 405);
}

// strict exact-match origin check — str_starts_with was vulnerable to subdomain spoofing
// e.g. http://localhost-evil.com would have passed the old prefix check
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin) && $origin !== ALLOWED_ORIGIN) {
    respond_error('Forbidden.', 403);
}

// rate limiting — 5 requests per minute, 20 per day, per hashed IP
_check_rate_limit();

$prompt = trim($_POST['prompt'] ?? '');
if (empty($prompt)) {
    respond_error('No prompt provided.');
}

if (strlen($prompt) > 20000) {
    respond_error('Prompt too large. Please upload a smaller file.');
}

// making sure the key is actually set before going further
$apiKey = ANTHROPIC_API_KEY;
if (empty($apiKey) || $apiKey === 'YOUR_KEY_HERE') {
    respond_error('API key not configured. Paste your Anthropic key into php/config.php.');
}

// building the payload and sending it to the AI
$payload = json_encode([
    'model'      => ANTHROPIC_MODEL,
    'max_tokens' => ANTHROPIC_MAX_TOKENS,
    'messages'   => [
        ['role' => 'user', 'content' => $prompt]
    ]
]);

$ch = curl_init(ANTHROPIC_API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        "x-api-key: {$apiKey}",
        "anthropic-version: " . ANTHROPIC_VERSION,
    ],
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    // logging the real curl error internally, not exposing it to the client
    if (DEBUG_MODE) error_log("FinSite curl error: {$curlError}");
    respond_error('Network error — unable to reach the AI service. Please try again.');
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
    // logging the real API error internally, returning a safe generic message to the browser
    $internalMsg = $data['error']['message'] ?? "HTTP {$httpCode}";
    if (DEBUG_MODE) error_log("FinSite API error [{$httpCode}]: {$internalMsg}");

    // surface rate limit and auth errors so the user knows what happened, hide everything else
    if ($httpCode === 429) respond_error('AI rate limit reached. Please wait a moment and try again.', 429);
    if ($httpCode === 401) respond_error('AI service authentication failed. Check your API key.', 401);
    respond_error('AI service returned an error. Please try again.', 500);
}

$result = $data['content'][0]['text'] ?? null;
if (!$result) {
    respond_error('Empty response from AI.');
}

echo json_encode(['result' => $result, 'error' => null]);
exit;


// sending back a JSON error and stopping execution
function respond_error(string $message, int $code = 400): never {
    if (DEBUG_MODE) error_log("FinSite error [{$code}]: $message");
    http_response_code($code);
    echo json_encode(['result' => null, 'error' => $message]);
    exit;
}

// dual-window rate limiter — 5 requests per minute, 20 per day, per hashed IP
function _check_rate_limit(): void {
    $ip   = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = sys_get_temp_dir() . '/finsite_rl_' . $ip;
    $now  = time();

    $fp = @fopen($file, 'c+');
    if (!$fp) {
        // i'm failing CLOSED here — if tmp isn't writable i'd rather block the request
        // than silently let unlimited requests through
        respond_error('Server configuration error — rate limiter unavailable.', 503);
    }

    flock($fp, LOCK_EX);
    $raw      = stream_get_contents($fp);
    $requests = ($raw && is_array(json_decode($raw, true))) ? json_decode($raw, true) : [];

    // keeping only timestamps from the last 24 hours
    $requests = array_values(array_filter($requests, fn($t) => is_int($t) && $now - $t < 86400));

    // checking per-minute limit (last 60 seconds)
    $last_minute = array_filter($requests, fn($t) => $now - $t < 60);
    if (count($last_minute) >= 5) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond_error('Too many requests — please wait a minute before analyzing again.', 429);
    }

    // checking per-day limit
    if (count($requests) >= 20) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond_error('Daily analysis limit reached. Come back tomorrow.', 429);
    }

    $requests[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($requests));
    flock($fp, LOCK_UN);
    fclose($fp);
}
