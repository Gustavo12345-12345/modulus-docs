

// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao abrir banco:', err);
});

db.serialize(() => {
  db.run(`
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
  `, (err) => {
    if (err) console.error('Erro ao criar tabela:', err);
  });
});

module.exports = db;
