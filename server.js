// server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const db = require('./db');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

let clients = [];

// Gerencia conexões WebSocket
wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Envia mensagem para todos os clientes conectados
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ========== ROTAS BACK-END ==========

// Página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login simples (grava cookie)
app.post('/login', (req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    const data = JSON.parse(body);
    res.cookie('authUser', data.user, { httpOnly: false });
    res.sendStatus(200);
  });
});

// Logout (apaga cookie)
app.get('/logout', (req, res) => {
  res.clearCookie('authUser');
  res.redirect('/login');
});

// ========== API PRINCIPAL ==========

// Retorna todos os registros
app.get('/api/registros', (req, res) => {
  const rows = db.prepare('SELECT * FROM registros ORDER BY id DESC').all();
  res.json(rows);
});

// Cria ou substitui um registro
app.post('/api/data', (req, res) => {
  const nova = req.body;
  const codigoArquivo = nova.CodigoArquivo;

  db.prepare(`
    INSERT OR REPLACE INTO registros
    (Projeto, TipoObra, TipoProjeto, TipoDoc, Disciplina, Sequencia, Revisao, CodigoArquivo, Data, Autor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nova.Projeto,
    nova.TipoObra,
    nova.TipoProjeto,
    nova.TipoDoc,
    nova.Disciplina,
    nova.Sequencia,
    nova.Revisao,
    codigoArquivo,
    nova.Data,
    req.cookies.authUser || 'DESCONHECIDO'
  );

  broadcast({ action: 'update' });
  res.sendStatus(200);
});

// Apaga registro específico
app.delete('/api/data/:codigoArquivo', (req, res) => {
  const codigo = req.params.codigoArquivo;
  db.prepare('DELETE FROM registros WHERE CodigoArquivo = ?').run(codigo);
  broadcast({ action: 'delete' });
  res.sendStatus(200);
});

// Edita um campo (sequencia ou revisão)
app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  const { campo, valor } = req.body;
  const codigo = req.params.codigoArquivo;

  if (!['Sequencia', 'Revisao'].includes(campo)) return res.sendStatus(400);

  db.prepare(`UPDATE registros SET ${campo} = ? WHERE CodigoArquivo = ?`).run(valor, codigo);
  broadcast({ action: 'update' });
  res.sendStatus(200);
});

// Exporta para CSV
app.get('/api/exportar-csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM registros').all();
  if (rows.length === 0) {
    return res.send('Nenhum registro para exportar.');
  }

  const header = Object.keys(rows[0]).join(',');
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');

  res.header('Content-Type', 'text/csv');
  res.attachment('dados.csv').send(csv);
});

// ========== INICIALIZA SERVIDOR ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
