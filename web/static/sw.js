// Immediately take control
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const title = data.title || "Attendance Alert";
            const options = {
                body: data.body || "Are you still active?",
                vibrate: [200, 100, 200, 100, 200],
                requireInteraction: true,
                actions: [
                    { action: 'yes', title: 'Yes, I am working' },
                    { action: 'no', title: 'No (Stop)' }
                ]
            };
            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            console.error("Push parse error:", e);
        }
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const action = event.action || 'yes'; // Default click = yes

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Try to find and focus an existing employee tab
            for (let client of windowClients) {
                if (client.url.includes('/employee')) {
                    return client.focus().then(c => {
                        c.postMessage({ action: action === 'no' ? 'stop_work' : 'verify_presence' });
                    });
                }
            }
            // No existing tab found — open a dedicated verification or stop action
            if (action === 'no') {
                return clients.openWindow('/employee?action=stop');
            } else {
                return clients.openWindow('/verify-presence');
            }
        })
    );
});
