import { app } from './index.js';
import { dbFilePath } from './db.js';

const port = process.env.PORT || 3000;

console.log(`Calzado Evalook arranque node=${process.version} PORT=${process.env.PORT || '(no definido)'}`);

const server = app.listen(port, () => {
  console.log(`Calzado Evalook escuchando en el puerto ${port}`);
  console.log(`Base de datos local: ${dbFilePath()}`);
});

server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
