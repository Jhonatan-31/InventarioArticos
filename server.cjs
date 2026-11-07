'use strict';

/**
 * Hostinger (LiteSpeed lsnode) carga el archivo de entrada con require().
 * Ese require no admite ESM con top-level await, así que este .cjs
 * arranca en CommonJS e importa el inventario con import() dinámico.
 */
async function loadApp() {
  await import('./server/boot.js');
}

loadApp().catch((error) => {
  console.error(error);
  process.exit(1);
});
