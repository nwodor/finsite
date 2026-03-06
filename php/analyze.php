<?php
// i use this as a server-side proxy for the claude API
// i keep the API key out of the browser — i receive the prompt via POST and return JSON

require_once __DIR__ . '/config.php';

// i set my headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

// i handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Method not allowed.', 405);
}

$prompt = trim($_POST['prompt'] ?? '');
if (empty($prompt)) {
    respond_error('No prompt provided.');
}

if (strlen($prompt) > 20000) {
    respond_error('Prompt too large. Please upload a smaller file.');
}

// i make sure my key is actually set before going further
$apiKey = ANTHROPIC_API_KEY;
if (empty($apiKey) || $apiKey === 'YOUR_API_KEY_HERE') {
    respond_error('API key not configured. Set ANTHROPIC_API_KEY in php/config.php.');
}

// i build the payload and send it to claude
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

if ($curlError) {
    respond_error("Network error: {$curlError}");
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
    $errMsg = $data['error']['message'] ?? "HTTP {$httpCode} from Anthropic API";
    respond_error($errMsg, $httpCode);
}

$result = $data['content'][0]['text'] ?? null;
if (!$result) {
    respond_error('Empty response from AI.');
}

echo json_encode(['result' => $result, 'error' => null]);
exit;


// i use this to send back a JSON error and stop execution
function respond_error(string $message, int $code = 400): never {
    if (DEBUG_MODE) error_log("FinSite error: $message");
    http_response_code($code);
    echo json_encode(['result' => null, 'error' => $message]);
    exit;
}
