// `sockjs-client` (notification temps réel, WebSocket) référence l'objet Node `global` à
// l'exécution de son module — jamais polyfillé automatiquement par le builder esbuild d'Angular
// (contrairement à l'ancien builder webpack). Sans ce fichier, charger n'importe quel écran qui
// utilise le centre de notifications (`/stock`, `/dg`) plante avec « ReferenceError: global is not
// defined ». Doit être chargé avant tout le reste (voir angular.json, premier élément de
// "polyfills").
(window as unknown as { global: typeof globalThis }).global = globalThis;
