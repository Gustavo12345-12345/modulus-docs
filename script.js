

document.getElementById('btnGerar').addEventListener('click', () => {
  const tipoProjeto   = document.getElementById('TipoProjeto').value;
  const tipoObra      = document.getElementById('TipoObra').value;
  const disciplina     = document.getElementById('Disciplina').value;
  const tipoDoc       = document.getElementById('TipoDoc').value;
  const codigoProjeto = document.getElementById('CodigoProjeto').value;
  const sequencia     = document.getElementById('Sequencia').value;
  const revisao       = document.getElementById('Revisao').value;

  if (!tipoProjeto || !tipoObra || !disciplina || !tipoDoc || !codigoProjeto || !sequencia || !revisao) {
    alert("Por favor, preencha todos os campos.");
    return;
  }

  const codigoArquivo = `${codigoProjeto}-${tipoObra}-${tipoProjeto}-${tipoDoc}-${disciplina}-${sequencia}-${revisao}`;
  const dataAtual     = new Date().toLocaleDateString('pt-BR');

  const registro = {
    Projeto:       codigoProjeto,
    TipoObra:      tipoObra,
    TipoProjeto:   tipoProjeto,
    TipoDoc:       tipoDoc,
    Disciplina:    disciplina,
    Sequencia:     sequencia,
    Revisao:       revisao,
    CodigoArquivo: codigoArquivo,
    Data:          dataAtual,
    Autor:         "MODULUS"
  };

  fetch('/api/data', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(registro)
  }).then(response => {
    if (response.ok) {
      alert("Código gerado com sucesso!");
    } else {
      alert("Erro ao gerar código.");
    }
  });
});

// WebSocket para atualização em tempo real
const socket = new WebSocket('ws://localhost:3000');
socket.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.action === 'update' || msg.action === 'delete') {
    loadDataFromServer();
  }
};

// Carregar dados na tabela
function loadDataFromServer() {
  fetch('/api/registros')
    .then(res => res.json())
    .then(data => {
      const tbody = document.querySelector('#tabela tbody');
      tbody.innerHTML = '';

      data.forEach(item => {
        const row = tbody.insertRow();
        [
          item.Projeto, item.TipoObra, item.TipoProjeto, item.TipoDoc,
          item.Disciplina,
          createEditableCell(item.Sequencia, item.CodigoArquivo, 'Sequencia'),
          createEditableCell(item.Revisao, item.CodigoArquivo, 'Revisao'),
          item.CodigoArquivo, item.Data, item.Autor
        ].forEach(cell => {
          const td = row.insertCell();
          if (cell instanceof HTMLElement) {
            td.appendChild(cell);
          } else {
            td.innerText = cell;
          }
        });

        const cellAcoes = row.insertCell();
        cellAcoes.innerHTML = `<button onclick="deletarLinha('${item.CodigoArquivo}')">🗑️</button>`;
      });
    });
}

document.querySelectorAll('#tabela th').forEach((th, colIndex) => {
  th.addEventListener('click', () => {
    const rows = Array.from(document.querySelectorAll('#tabela tbody tr'));
    const asc = th.dataset.order !== 'asc';
    th.dataset.order = asc ? 'asc' : 'desc';

    rows.sort((a, b) => {
      const cellA = a.cells[colIndex].textContent.trim().toLowerCase();
      const cellB = b.cells[colIndex].textContent.trim().toLowerCase();
      return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    const tbody = document.querySelector('#tabela tbody');
    rows.forEach(row => tbody.appendChild(row));
  });
});


function deletarLinha(codigoArquivo) {
  fetch(`/api/data/${codigoArquivo}`, { method: 'DELETE' });
}

window.addEventListener('load', loadDataFromServer);

// Filtros da tabela
document.querySelectorAll('.filtros input').forEach((input, colIndex) => {
  input.addEventListener('keyup', () => {
    const searchValue = input.value.toLowerCase();
    const rows = document.querySelectorAll('#tabela tbody tr');
    rows.forEach(row => {
      const cell = row.cells[colIndex];
      if (cell && cell.textContent.toLowerCase().includes(searchValue)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
});
function createEditableCell(value, codigoArquivo, campo) {
  const span = document.createElement('span');
  span.textContent = value;
  span.contentEditable = true;
  span.style.cursor = 'text';
  span.addEventListener('blur', () => {
    const novoValor = span.textContent.trim();

    fetch(`/api/data/${codigoArquivo}/campo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, valor: novoValor })
    }).then(() => {
      loadDataFromServer();
    });
  });
  return span;
}
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
document.getElementById('btnLimparFiltros').addEventListener('click', () => {
  const filtros = document.querySelectorAll('.filtros input');
  filtros.forEach(input => input.value = '');

  const linhas = document.querySelectorAll('#tabela tbody tr');
  linhas.forEach(linha => linha.style.display = '');
});
document.getElementById('btnLimparFiltros').addEventListener('click', () => {
  // Limpa todos os campos da linha de filtros
  document.querySelectorAll('.filtros input').forEach(input => {
    input.value = '';
  });

  // Reexibe todas as linhas da tabela
  document.querySelectorAll('#tabela tbody tr').forEach(row => {
    row.style.display = '';
  });
});
document.getElementById('btnLimparFiltros').addEventListener('click', () => {
  // 1. Limpa todos os campos de input da linha de filtros
  document.querySelectorAll('.filtros input').forEach(input => {
    input.value = '';
  });

  // 2. Recarrega os dados diretamente do servidor (força tabela completa)
  loadDataFromServer();
});
document.getElementById('btnExportarFiltro').addEventListener('click', () => {
  const rows = document.querySelectorAll('#tabela tbody tr');
  const dadosFiltrados = [];

  rows.forEach(row => {
    if (row.style.display !== 'none') {
      const cells = row.querySelectorAll('td');
      const dado = {
        Projeto:       cells[0].innerText,
        TipoObra:      cells[1].innerText,
        TipoProjeto:   cells[2].innerText,
        TipoDoc:       cells[3].innerText,
        Disciplina:    cells[4].innerText,
        Sequencia:     cells[5].innerText,
        Revisao:       cells[6].innerText,
        CodigoArquivo: cells[7].innerText,
        Data:          cells[8].innerText,
        Autor:         cells[9].innerText
      };
      dadosFiltrados.push(dado);
    }
  });

  fetch('/api/exportar-filtro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosFiltrados)
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dados-filtrados.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
});
