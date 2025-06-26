const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const filePath = path.join(__dirname, 'database.xlsx');
const aba = 'Registros';

const COLUNAS_PADRAO = [
  'Projeto', 'TipoObra', 'TipoProjeto', 'TipoDoc',
  'Disciplina', 'Sequencia', 'Revisao',
  'CodigoArquivo', 'Data', 'Autor'
];

// Banco de usuários (usuário → senha)
const users = {
  modulus01: '0001',
  modulus02: '0002',
  modulus03: '0003',
  modulus04: '0004',
  modulus05: '0005',
  modulus06: '0006',
  modulus07: '0007',
  modulus08: '0008',
  modulus09: '0009',
  modulus10: '0010'
};

// Middlewares
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Autenticação
function requireAuth(req, res, next) {
  const { authUser } = req.cookies;
  if (authUser && users[authUser]) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] === password) {
    res.cookie('authUser', username, { httpOnly: true });
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('authUser');
  res.redirect('/login.html');
});

// Página protegida
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Funções auxiliares
function normalizarRegistro(registro) {
  const novo = {};
  COLUNAS_PADRAO.forEach(col => {
    novo[col] = registro[col] || '';
  });
  return novo;
}

function broadcast(data) {
  const mensagem = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(mensagem);
    }
  });
}

function salvarDadosNaPlanilha(dados) {
  const dadosNormalizados = dados.map(normalizarRegistro);
  const sheet = XLSX.utils.json_to_sheet(dadosNormalizados, { header: COLUNAS_PADRAO });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, aba);
  XLSX.writeFile(wb, filePath);
}

// Rotas de API
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

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
