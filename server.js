const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(__dirname));

const filePath = path.join(__dirname, 'database.xlsx');
const aba = 'Registros';

// Estrutura padrão de colunas
const COLUNAS_PADRAO = [
  'Projeto', 'TipoObra', 'TipoProjeto', 'TipoDoc',
  'Disciplina', 'Sequencia', 'Revisao',
  'CodigoArquivo', 'Data', 'Autor'
];

// Normaliza um registro para conter todos os campos esperados
function normalizarRegistro(registro) {
  const novo = {};
  COLUNAS_PADRAO.forEach(col => {
    novo[col] = registro[col] || '';
  });
  return novo;
}

// Envia mensagens via WebSocket para todos os clientes
function broadcast(data) {
  const mensagem = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(mensagem);
    }
  });
}

// Cria planilha com colunas fixas
function salvarDadosNaPlanilha(dados) {
  const dadosNormalizados = dados.map(normalizarRegistro);
  const sheet = XLSX.utils.json_to_sheet(dadosNormalizados, { header: COLUNAS_PADRAO });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, aba);
  XLSX.writeFile(wb, filePath);
}

app.post('/api/data', (req, res) => {
  const novaEntrada = normalizarRegistro(req.body);
  let dados = [];

  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[aba];
    dados = XLSX.utils.sheet_to_json(sheet);
  }

  dados.push(novaEntrada);
  salvarDadosNaPlanilha(dados);
  broadcast({ action: 'update' });
  res.sendStatus(200);
});

app.get('/api/registros', (req, res) => {
  if (!fs.existsSync(filePath)) return res.json([]);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[aba];
  const dados = XLSX.utils.sheet_to_json(sheet);
  res.json(dados.map(normalizarRegistro));
});

app.delete('/api/data/:codigoArquivo', (req, res) => {
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  const codigo = req.params.codigoArquivo;

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[aba];
  let dados = XLSX.utils.sheet_to_json(sheet);
  dados = dados.filter(reg => reg.CodigoArquivo !== codigo);

  salvarDadosNaPlanilha(dados);
  broadcast({ action: 'delete' });
  res.sendStatus(200);
});

app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const { campo, valor } = req.body;
  const codigo = req.params.codigoArquivo;

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[aba];
  const dados = XLSX.utils.sheet_to_json(sheet);

  const atualizados = dados.map(reg =>
    reg.CodigoArquivo === codigo ? { ...reg, [campo]: valor } : reg
  );

  salvarDadosNaPlanilha(atualizados);
  res.sendStatus(200);
});

app.post('/api/exportar-filtro', (req, res) => {
  const dados = req.body.map(normalizarRegistro);

  const sheet = XLSX.utils.json_to_sheet(dados, { header: COLUNAS_PADRAO });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Filtrado');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="dados-filtrados.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
