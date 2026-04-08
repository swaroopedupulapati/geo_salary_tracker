// ─── Shared API Utility ──────────────────────────────────────────────────────
// Replace this with your actual ngrok URL every time you restart the tunnel
export const NGROK_URL = 'https://nannie-centrodorsal-disregardfully.ngrok-free.dev';

export const HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
};

export async function apiPost(path, body) {
    const res = await fetch(`${NGROK_URL}${path}`, {
        method: 'POST',
        headers: HEADERS,
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return res.json();
}

export async function apiGet(path) {
    const res = await fetch(`${NGROK_URL}${path}`, {
        method: 'GET',
        headers: HEADERS,
        credentials: 'include',
    });
    return res.json();
}

export async function apiUpload(path, formData) {
    const res = await fetch(`${NGROK_URL}${path}`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
        credentials: 'include',
        body: formData,
    });
    return res.json();
}
