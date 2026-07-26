const CACHE_NAME = 'hansalmae-voca-v31';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(function () {
        // 일부 아이콘이 없어도 서비스워커 설치는 계속합니다.
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('message', function (event) {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Apps Script API 요청은 서비스워커가 건드리지 않습니다.
  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com'
  ) {
    return;
  }

  const acceptsHtml =
    request.mode === 'navigate' ||
    (
      request.headers.get('accept') || ''
    ).includes('text/html');

  // HTML은 반드시 네트워크를 먼저 확인합니다.
  if (acceptsHtml) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store'
      })
        .then(function (response) {
          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then(function (cache) {
              cache.put(request, copy);
            });

          return response;
        })
        .catch(function () {
          return caches
            .match(request)
            .then(function (cached) {
              return (
                cached ||
                caches.match('./index.html')
              );
            });
        })
    );

    return;
  }

  // 이미지·manifest 등은 캐시 우선 후 백그라운드 갱신합니다.
  event.respondWith(
    caches
      .match(request)
      .then(function (cached) {
        const networkRequest =
          fetch(request)
            .then(function (response) {
              if (
                response &&
                response.ok
              ) {
                const copy =
                  response.clone();

                caches
                  .open(CACHE_NAME)
                  .then(function (cache) {
                    cache.put(
                      request,
                      copy
                    );
                  });
              }

              return response;
            })
            .catch(function () {
              return cached;
            });

        return cached || networkRequest;
      })
  );
});
