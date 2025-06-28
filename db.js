// db.js
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

// Inicializa arquivo se não existir
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

function readAll() {
  const data = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(data);
}

function writeAll(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function addOrReplace(registro) {
  const all = readAll();
  const index = all.findIndex(r => r.CodigoArquivo === registro.CodigoArquivo);
  if (index !== -1) {
    all[index] = registro;
  } else {
    all.push(registro);
  }
  writeAll(all);
}

function remove(codigoArquivo) {
  const all = readAll();
  const filtered = all.filter(r => r.CodigoArquivo !== codigoArquivo);
  writeAll(filtered);
}

function updateField(codigoArquivo, campo, valor) {
  const all = readAll();
  const index = all.findIndex(r => r.CodigoArquivo === codigoArquivo);
  if (index !== -1) {
    all[index][campo] = valor;
    writeAll(all);
  }
}

module.exports = {
  readAll,
  addOrReplace,
  remove,
  updateField
};
