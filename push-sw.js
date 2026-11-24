/*
 * Push handlers for the planner's service worker. Plain JS: vite-plugin-pwa's generated sw.js loads this
 * file with importScripts('push-sw.js') (vite.config.ts, workbox.importScripts).
 *
 * Payload from the planner server (docs/SERVER-API.md): JSON { title, body, url, tag }.
 * - Every push shows a notification (iOS revokes subscriptions that receive silent pushes).
 * - The pomodoro timer push ("timer-pomodoro") reuses the tag of the in-page study notification
 *   ("planner-study"), so when both fire they replace each other instead of stacking.
 * - Tapping focuses an open planner window (and routes it to data.url, e.g. "/#/ai"), or opens one.
 */
/* eslint-env serviceworker */

var STUDY_TAG = 'planner-study';

function scopeUrl(path) {
  try {
    return new URL(path || './', self.registration.scope).href;
  } catch (e) {
    return self.registration.scope;
  }
}

function readPayload(event) {
  if (!event.data) return {};
  try {
    var json = event.data.json();
    return json && typeof json === 'object' ? json : {};
  } catch (e) {
    try {
      return { body: event.data.text() };
    } catch (e2) {
      return {};
    }
  }
}

self.addEventListener('push', function (event) {
  var data = readPayload(event);
  var tag = data.tag === 'timer-pomodoro' ? STUDY_TAG : typeof data.tag === 'string' && data.tag ? data.tag : undefined;
  var options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: scopeUrl('icons/icon-192.png'),
    badge: scopeUrl('icons/icon-192.png'),
    data: { url: scopeUrl(typeof data.url === 'string' && data.url ? data.url : './') },
  };
  if (tag) {
    options.tag = tag;
    options.renotify = true;
  }
  var title = typeof data.title === 'string' && data.title ? data.title : 'Planner';
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
          // Hash routes (#/ai, #/study/...) change in place; the page listens for this message.
          client.postMessage({ type: 'planner:navigate', url: target });
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
