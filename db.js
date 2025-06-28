// db.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Cria tabela se não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Projeto TEXT,
    TipoObra TEXT,
    TipoProjeto TEXT,
    TipoDoc TEXT,
    Disciplina TEXT,
    Sequencia TEXT,
    Revisao TEXT,
    CodigoArquivo TEXT UNIQUE,
    Data TEXT,
    Autor TEXT
  )
`).run();

module.exports = db;
