/*
  Race VMG Tide service worker

  Change CACHE_VERSION whenever any app file changes,
  so phones download the new files.

  The cache names all start with "race-vmg-tide-" so this
  app never deletes the caches used by the original
  Race VMG app on the same github.io address.
*/

const CACHE_VERSION = "race-vmg-tide-v1";

const CORE_FILES = [
  "./",
  "./index.html",
  "./courses.js",
  "./tides.js",
  "./tide-incoming.jpg",
  "./tide-outgoing.jpg"
];

/* Tide files are cached if present; a missing year is not an error */
const OPTIONAL_FILES = [
  "./tides/auckland-2026.csv",
  "./tides/auckland-2027.csv"
];


self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(CORE_FILES).then(function() {
        return Promise.all(
          OPTIONAL_FILES.map(function(file) {
            return cache.add(file).catch(function() {
              return null;
            });
          })
        );
      });
    })
  );

  self.skipWaiting();
});


self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) {
            return (
              key.indexOf("race-vmg-tide-") === 0 &&
              key !== CACHE_VERSION
            );
          })
          .map(function(key) {
            return caches.delete(key);
          })
      );
    })
  );

  self.clients.claim();
});


/* Cache first, then network. Anything new that loads is cached too. */
self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(function(response) {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(event.request, copy);
          });
        }

        return response;
      });
    })
  );
});
