const CACHE='naknak-shell-v5';
const RUNTIME='naknak-runtime-v5';
const SHELL=[
  './',
  './index.html',
  './dashboard.html',
  './app.html',
  './naknak-app.html',
  './app-v15.html',
  './manifest.webmanifest',
  './Assets/icon-192.png',
  './Assets/icon-512.png',
  './Assets/apple-touch-icon.png'
];
const OPTIONAL_RUNTIME=[
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(c=>c.addAll(SHELL)),
    caches.open(RUNTIME).then(c=>Promise.allSettled(OPTIONAL_RUNTIME.map(url=>c.add(url))))
  ]));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('naknak-')&&!([CACHE,RUNTIME].includes(k))).map(k=>caches.delete(k))))
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const request=event.request;
  const url=new URL(request.url);

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request).then(response=>{
        const copy=response.clone();
        caches.open(RUNTIME).then(cache=>cache.put(request,copy));
        return response;
      }).catch(async()=>
        (await caches.match(request,{ignoreSearch:true})) ||
        (await caches.match('./naknak-app.html')) ||
        (await caches.match('./app.html'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request,{ignoreSearch:url.origin===self.location.origin}).then(cached=>{
      const network=fetch(request).then(response=>{
        if(response.ok||response.type==='opaque'){
          const copy=response.clone();
          caches.open(RUNTIME).then(cache=>cache.put(request,copy));
        }
        return response;
      });
      return cached||network;
    }).catch(()=>caches.match(request,{ignoreSearch:true}))
  );
});

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type!=='NAKNAK_NOTIFY')return;
  event.waitUntil(self.registration.showNotification(d.title||'NakNak',{
    body:d.body||'',tag:d.tag||'naknak',requireInteraction:!!d.requireInteraction,data:d.data||{},vibrate:[250,100,250,100,450]
  }));
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){data={body:event.data?event.data.text():''};}
  event.waitUntil(self.registration.showNotification(data.title||'NakNak Alert',{
    body:data.body||'May bagong alert mula sa iyong kapamilya.',tag:data.tag||'naknak-remote-alert',requireInteraction:data.requireInteraction!==false,data:data.data||{},vibrate:[300,100,300,100,500]
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(c=>c.url.includes('/Naknak/'));
    if(existing){existing.postMessage({type:'NAKNAK_NOTIFICATION_OPENED',data:event.notification.data||{}});return existing.focus();}
    return clients.openWindow('./app.html');
  }));
});
