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
app.use(express.static(__dirname)); // index.html, script.js, etc.

const filePath = path.join(__dirname, 'database.xlsx');
const aba = 'Registros';

function broadcast(data) {
  const mensagem = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(mensagem);
    }
  });
}

app.post('/api/data', (req, res) => {
  const novaEntrada = req.body;

  let dados = [];
  let workbook;
  if (fs.existsSync(filePath)) {
    workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[aba];
    dados = XLSX.utils.sheet_to_json(sheet);
  } else {
    workbook = XLSX.utils.book_new();
  }

  dados.push(novaEntrada);
  const novaPlanilha = XLSX.utils.json_to_sheet(dados);
  const novoWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(novoWorkbook, novaPlanilha, aba);
  XLSX.writeFile(novoWorkbook, filePath);

  broadcast({ action: 'update' }); // notifica todos os clientes

  res.sendStatus(200);
});

app.get('/api/registros', (req, res) => {
  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[aba];
    const dados = XLSX.utils.sheet_to_json(sheet);
    res.json(dados);
  } else {
    res.json([]);
  }
});

app.delete('/api/data/:codigoArquivo', (req, res) => {
  const codigo = req.params.codigoArquivo;

  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[aba];
    let dados = XLSX.utils.sheet_to_json(sheet);

    dados = dados.filter(reg => reg.CodigoArquivo !== codigo);

    const novaPlanilha = XLSX.utils.json_to_sheet(dados);
    const novoWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(novoWorkbook, novaPlanilha, aba);
    XLSX.writeFile(novoWorkbook, filePath);

    broadcast({ action: 'delete' }); // notifica os clientes
  }

  res.sendStatus(200);
});

app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  const { campo, valor } = req.body;
  const codigo = req.params.codigoArquivo;

  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[aba];
  const dados = XLSX.utils.sheet_to_json(sheet);

  const atualizados = dados.map(reg =>
    reg.CodigoArquivo === codigo ? { ...reg, [campo]: valor } : reg
  );

  const novaPlanilha = XLSX.utils.json_to_sheet(atualizados);
  const novoWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(novoWorkbook, novaPlanilha, aba);
  XLSX.writeFile(novoWorkbook, filePath);

  res.sendStatus(200);
});

app.post('/api/exportar-filtro', (req, res) => {
  const dadosFiltrados = req.body;

  if (!Array.isArray(dadosFiltrados) || dadosFiltrados.length === 0) {
    return res.status(400).send('Nenhum dado enviado para exportação.');
  }

  const sheet = XLSX.utils.json_to_sheet(dadosFiltrados);
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
