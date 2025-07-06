
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registros (
        id SERIAL PRIMARY KEY,
        projeto TEXT,
        tipoObra TEXT,
        tipoProjeto TEXT,
        tipoDoc TEXT,
        disciplina TEXT,
        sequencia TEXT,
        revisao TEXT,
        codigoArquivo TEXT UNIQUE,
        data TEXT,
        autor TEXT
      );
    `);
    console.log("Banco de dados PostgreSQL inicializado.");
  } catch (err) {
    console.error("Erro ao inicializar o banco:", err);
  }
}

async function inserirRegistro(registro) {
  const query = \`
    INSERT INTO registros (
      projeto, tipoObra, tipoProjeto, tipoDoc, disciplina,
      sequencia, revisao, codigoArquivo, data, autor
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (codigoArquivo) DO UPDATE SET
      projeto = EXCLUDED.projeto,
      tipoObra = EXCLUDED.tipoObra,
      tipoProjeto = EXCLUDED.tipoProjeto,
      tipoDoc = EXCLUDED.tipoDoc,
      disciplina = EXCLUDED.disciplina,
      sequencia = EXCLUDED.sequencia,
      revisao = EXCLUDED.revisao,
      data = EXCLUDED.data,
      autor = EXCLUDED.autor;
  \`;

  const valores = [
    registro.projeto,
    registro.tipoObra,
    registro.tipoProjeto,
    registro.tipoDoc,
    registro.disciplina,
    registro.sequencia,
    registro.revisao,
    registro.codigoArquivo,
    registro.data,
    registro.autor
  ];

  await pool.query(query, valores);
}

async function buscarRegistros() {
  const res = await pool.query('SELECT * FROM registros ORDER BY id DESC');
  return res.rows;
}

async function excluirRegistro(codigoArquivo) {
  await pool.query('DELETE FROM registros WHERE codigoArquivo = $1', [codigoArquivo]);
}

module.exports = {
  inicializarBanco,
  inserirRegistro,
  buscarRegistros,
  excluirRegistro
};
