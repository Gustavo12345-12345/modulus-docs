// server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ========= MIDDLEWARE =========
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// ========= WEBSOCKETS =========
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

function broadcast(message) {
  const msg = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ========= ROTAS DE LOGIN =========
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      res.cookie('authUser', data.user, { httpOnly: false });
      res.sendStatus(200);
    } catch {
      res.sendStatus(400);
    }
  });
});

app.get('/logout', (req, res) => {
  res.clearCookie('authUser');
  res.redirect('/login');
});

// ========= API PRINCIPAL =========

// GET TODOS REGISTROS
app.get('/api/registros', (req, res) => {
  const rows = db.prepare('SELECT * FROM registros ORDER BY id DESC').all();
  res.json(rows);
});

// POST SALVAR NOVO REGISTRO
app.post('/api/data', (req, res) => {
  const data = req.body;
  const autor = req.cookies.authUser || 'DESCONHECIDO';

  // Validação
  const required = ['Projeto','TipoObra','TipoProjeto','TipoDoc','Disciplina','Sequencia','Revisao','CodigoArquivo','Data'];
  for (let field of required) {
    if (!data[field]) {
      return res.status(400).json({ error: `Campo obrigatório faltando: ${field}` });
    }
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO registros
      (Projeto, TipoObra, TipoProjeto, TipoDoc, Disciplina, Sequencia, Revisao, CodigoArquivo, Data, Autor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.Projeto,
      data.TipoObra,
      data.TipoProjeto,
      data.TipoDoc,
      data.Disciplina,
      data.Sequencia,
      data.Revisao,
      data.CodigoArquivo,
      data.Data,
      autor
    );

    broadcast({ action: 'update' });
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar no banco.' });
  }
});

// DELETE REGISTRO
app.delete('/api/data/:codigoArquivo', (req, res) => {
  const codigo = req.params.codigoArquivo;
  try {
    db.prepare('DELETE FROM registros WHERE CodigoArquivo = ?').run(codigo);
    broadcast({ action: 'delete' });
    res.sendStatus(200);
  } catch {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
});

// PUT ATUALIZAR CAMPO
app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  const { campo, valor } = req.body;
  const codigo = req.params.codigoArquivo;

  if (!['Sequencia', 'Revisao'].includes(campo)) {
    return res.status(400).json({ error: 'Campo inválido.' });
  }

  try {
    db.prepare(`UPDATE registros SET ${campo} = ? WHERE CodigoArquivo = ?`).run(valor, codigo);
    broadcast({ action: 'update' });
    res.sendStatus(200);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar campo.' });
  }
});

// GET EXPORTAR CSV
app.get('/api/exportar-csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM registros').all();
    if (!rows.length) {
      return res.send('Nenhum registro para exportar.');
    }

    const header = Object.keys(rows[0]).join(',');
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('dados.csv').send(csv);
  } catch {
    res.status(500).json({ error: 'Erro ao exportar.' });
  }
});

// ========= INICIAR SERVIDOR =========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
