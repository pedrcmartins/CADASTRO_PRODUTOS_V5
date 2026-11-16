const listaDeProdutos = [];

let indiceEdicao = null;

const LIMITE_ESTOQUE_BAIXO = 3;
const CHAVE_STORAGE = "estoque_produtos";

class Produto {
    #preco;
    #quantidade;

    constructor(nome, preco, quantidade) {
        if (!nome || nome.trim() === "") {
            throw new Error("O nome do produto não pode estar vazio.");
        }
        if (!Number.isFinite(preco) || preco <= 0) {
            throw new Error("O preço do produto deve ser maior que zero (R$ 0.00).");
        }
        if (!Number.isInteger(quantidade) || quantidade <= 0) {
            throw new Error("A quantidade de itens deve ser um número inteiro maior que zero.");
        }

        this.nome = nome.trim();
        this.#preco = preco;
        this.#quantidade = quantidade;
    }

    get preco() {
        return this.#preco;
    }

    get quantidade() {
        return this.#quantidade;
    }

    get subtotal() {
        return this.#preco * this.#quantidade;
    }
}

const form = document.getElementById("produto-form");
const tabelaCorpo = document.querySelector("#tabela-produtos tbody");
const botaoSubmit = form.querySelector("button[type='submit']");
const inputNome = document.getElementById("nome");
const inputPreco = document.getElementById("preco");
const inputQuantidade = document.getElementById("quantidade");
const inputBusca = document.getElementById("busca");
const selectOrdenacao = document.getElementById("ordenacao");
const botaoCsv = document.getElementById("exportar-csv");
const botaoBackup = document.getElementById("baixar-backup");
const botaoRestaurar = document.getElementById("restaurar-backup");
const inputArquivoBackup = document.getElementById("arquivo-backup");

const caixaErro = document.getElementById("mensagem-erro");
const caixaSugestoes = document.getElementById("sugestoes");
const listaSugestoes = document.getElementById("lista-sugestoes");

const areaToasts = document.getElementById("area-toasts");
const modalConfirmacaoEl = document.getElementById("modal-confirmacao");
const modalConfirmacao = new bootstrap.Modal(modalConfirmacaoEl);
const confirmacaoTitulo = document.getElementById("confirmacao-titulo");
const confirmacaoMensagem = document.getElementById("confirmacao-mensagem");
const confirmacaoBotao = document.getElementById("confirmacao-confirmar");

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

const formatarMoeda = (valor) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Ignora maiúsculas, minúsculas e acentos ("Cafeteira" == "cafeteira", "Câmera" == "camera")
const normalizar = (texto) =>
    texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

function mostrarErro(mensagem, campo = null) {
    limparErro();
    caixaErro.textContent = mensagem;
    caixaErro.hidden = false;

    if (campo) {
        campo.classList.add("invalido");
        campo.focus();
    }
}

function limparErro() {
    caixaErro.hidden = true;
    caixaErro.textContent = "";
    form.querySelectorAll(".invalido").forEach((el) => el.classList.remove("invalido"));
}


const ESTILOS_TOAST = {
    sucesso: "text-bg-success",
    erro: "text-bg-danger",
    aviso: "text-bg-warning",
    info: "text-bg-dark",
};

function mostrarToast(mensagem, tipo = "sucesso") {
    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center border-0 ${ESTILOS_TOAST[tipo] || ESTILOS_TOAST.info}`;
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.setAttribute("aria-atomic", "true");

    const corBotao = tipo === "aviso" ? "" : "btn-close-white";
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${escaparHTML(mensagem)}</div>
            <button type="button" class="btn-close ${corBotao} me-2 m-auto"
                data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>
    `;

    areaToasts.appendChild(toastEl);
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
    new bootstrap.Toast(toastEl, { delay: 3500 }).show();
}


function confirmarAcao({ titulo, mensagemHTML, textoConfirmar = "Confirmar" }) {
    return new Promise((resolve) => {
        confirmacaoTitulo.textContent = titulo;
        confirmacaoMensagem.innerHTML = mensagemHTML;
        confirmacaoBotao.textContent = textoConfirmar;

        let confirmado = false;

        const aoConfirmar = () => {
            confirmado = true;
            modalConfirmacao.hide();
        };

        confirmacaoBotao.addEventListener("click", aoConfirmar, { once: true });

        modalConfirmacaoEl.addEventListener(
            "hidden.bs.modal",
            () => {
                confirmacaoBotao.removeEventListener("click", aoConfirmar);
                resolve(confirmado);
            },
            { once: true }
        );

        modalConfirmacao.show();
    });
}


function esconderSugestoes() {
    caixaSugestoes.hidden = true;
    listaSugestoes.innerHTML = "";
    inputNome.setAttribute("aria-expanded", "false");
}

function atualizarSugestoes() {
    const termo = normalizar(inputNome.value);

    if (termo === "") {
        esconderSugestoes();
        return;
    }

    const encontrados = listaDeProdutos
        .map((produto, index) => ({ produto, index }))
        .filter(
            ({ produto, index }) =>
                index !== indiceEdicao && normalizar(produto.nome).includes(termo)
        );

    if (encontrados.length === 0) {
        esconderSugestoes();
        return;
    }

    listaSugestoes.innerHTML = encontrados
        .map(
            ({ produto, index }) => `
            <li>
                <button type="button" class="sugestao" data-index="${index}">
                    <span class="sugestao-nome">${escaparHTML(produto.nome)}</span>
                    <span class="sugestao-info">${formatarMoeda(produto.preco)} · ${produto.quantidade} un.</span>
                </button>
            </li>
        `
        )
        .join("");

    caixaSugestoes.hidden = false;
    inputNome.setAttribute("aria-expanded", "true");
}

inputNome.addEventListener("input", () => {
    limparErro();
    atualizarSugestoes();
});

inputNome.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && !caixaSugestoes.hidden) {
        event.preventDefault();
        listaSugestoes.querySelector(".sugestao")?.focus();
    } else if (event.key === "Escape") {
        esconderSugestoes();
    }
});

// Navegação por teclado dentro da caixa
caixaSugestoes.addEventListener("keydown", (event) => {
    const itens = [...listaSugestoes.querySelectorAll(".sugestao")];
    const atual = itens.indexOf(document.activeElement);

    if (event.key === "ArrowDown") {
        event.preventDefault();
        itens[Math.min(atual + 1, itens.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (atual <= 0) {
            inputNome.focus();
        } else {
            itens[atual - 1].focus();
        }
    } else if (event.key === "Escape") {
        esconderSugestoes();
        inputNome.focus();
    }
});

// Clicar numa sugestão leva direto para a edição desse produto
listaSugestoes.addEventListener("click", (event) => {
    const botao = event.target.closest(".sugestao");
    if (!botao) return;

    prepararEdicao(Number(botao.dataset.index));
});

// Clicar fora fecha a caixa
document.addEventListener("click", (event) => {
    if (!event.target.closest(".form-nome")) {
        esconderSugestoes();
    }
});


const ORDENACOES = {
    padrao: null,
    "menor-quantidade": (a, b) => a.quantidade - b.quantidade,
    "maior-preco": (a, b) => b.preco - a.preco,
    "menor-preco": (a, b) => a.preco - b.preco,
    alfabetica: (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
};

function obterProdutosFiltrados() {
    const termo = inputBusca.value.trim().toLowerCase();

    const filtrados = listaDeProdutos.filter((produto) =>
        produto.nome.toLowerCase().includes(termo)
    );

    // Cópia com spread: .sort() altera o array em que é chamado, e não podemos
    // mexer em listaDeProdutos (os índices de edição/remoção dependem dela).
    const copia = [...filtrados];
    const comparador = ORDENACOES[selectOrdenacao.value];

    if (comparador) copia.sort(comparador);

    return copia;
}

const estoqueBaixo = (produto) => produto.quantidade <= LIMITE_ESTOQUE_BAIXO;

function atualizarTotalEstoque(produtosVisiveis) {
    const valorTotal = produtosVisiveis.reduce(
        (acumulador, produto) => acumulador + produto.subtotal,
        0
    );

    document.getElementById("total-estoque").innerText = formatarMoeda(valorTotal);
}

function renderizarTabela() {
    tabelaCorpo.innerHTML = "";

    const produtosVisiveis = obterProdutosFiltrados();

    if (listaDeProdutos.length === 0) {
        tabelaCorpo.innerHTML = `
            <tr>
                <td colspan="5" class="vazio">
                    Nenhum produto cadastrado. Preencha o formulário acima para adicionar o primeiro.
                </td>
            </tr>
        `;
        atualizarTotalEstoque(produtosVisiveis);
        return;
    }

    if (produtosVisiveis.length === 0) {
        tabelaCorpo.innerHTML = `
            <tr>
                <td colspan="5" class="sem-resultado">
                    Produto não localizado para "<strong>${escaparHTML(inputBusca.value.trim())}</strong>".
                </td>
            </tr>
        `;
        atualizarTotalEstoque(produtosVisiveis);
        return;
    }

    produtosVisiveis.forEach((produto) => {
        const index = listaDeProdutos.indexOf(produto);
        const linha = document.createElement("tr");

        if (index === indiceEdicao) {
            linha.classList.add("em-edicao");
        }

        const critico = estoqueBaixo(produto);
        if (critico) {
            linha.classList.add("estoque-baixo");
        }

        linha.innerHTML = `
            <td>${escaparHTML(produto.nome)}</td>
            <td>${formatarMoeda(produto.preco)}</td>
            <td>${produto.quantidade}${critico ? ' <span class="selo-baixo">Estoque Baixo · Repor</span>' : ""}</td>
            <td>${formatarMoeda(produto.subtotal)}</td>
            <td>
                <button type="button" class="btn-editar" data-acao="editar" data-index="${index}">Editar</button>
                <button type="button" class="btn-remover" data-acao="remover" data-index="${index}">Remover</button>
            </td>
        `;

        tabelaCorpo.appendChild(linha);
    });

    atualizarTotalEstoque(produtosVisiveis);
}

tabelaCorpo.addEventListener("click", (event) => {
    const botao = event.target.closest("button[data-acao]");
    if (!botao) return;

    const index = Number(botao.dataset.index);

    if (botao.dataset.acao === "editar") {
        prepararEdicao(index);
    } else if (botao.dataset.acao === "remover") {
        removerProduto(index);
    }
});


function resetarEstado() {
    indiceEdicao = null;
    botaoSubmit.textContent = "Adicionar Produto";
    form.classList.remove("editando");
    form.reset();
    limparErro();
    esconderSugestoes();
}

function prepararEdicao(index) {
    const produto = listaDeProdutos[index];
    if (!produto) return;

    limparErro();
    esconderSugestoes();

    inputNome.value = produto.nome;
    inputPreco.value = produto.preco;
    inputQuantidade.value = produto.quantidade;

    indiceEdicao = index;
    botaoSubmit.textContent = "Salvar Alterações";
    form.classList.add("editando");
    renderizarTabela();
    inputNome.focus();
}

async function removerProduto(index) {
    const produto = listaDeProdutos[index];
    if (!produto) return;

    const confirmado = await confirmarAcao({
        titulo: "Remover produto?",
        mensagemHTML: `Deseja realmente remover <strong>${escaparHTML(produto.nome)}</strong> da lista? Esta ação não pode ser desfeita.`,
        textoConfirmar: "Sim, remover",
    });

    if (!confirmado) return;

    listaDeProdutos.splice(index, 1);

    if (indiceEdicao !== null) {
        if (indiceEdicao === index) {
            resetarEstado();
        } else if (indiceEdicao > index) {
            indiceEdicao--;
        }
    }

    salvarNoStorage();
    renderizarTabela();
    mostrarToast(`"${produto.nome}" foi removido.`, "sucesso");
}

inputBusca.addEventListener("input", renderizarTabela);
selectOrdenacao.addEventListener("change", renderizarTabela);

inputPreco.addEventListener("input", limparErro);
inputQuantidade.addEventListener("input", limparErro);

document.getElementById("limpar-tabela").addEventListener("click", async () => {
    if (listaDeProdutos.length === 0) {
        mostrarToast("Não há produtos para limpar.", "info");
        return;
    }

    const total = listaDeProdutos.length;

    const confirmado = await confirmarAcao({
        titulo: "Limpar todos os produtos?",
        mensagemHTML: `Você está prestes a apagar <strong>${total}</strong> ${total === 1 ? "produto" : "produtos"} da lista. Esta ação não pode ser desfeita.`,
        textoConfirmar: "Sim, limpar tudo",
    });

    if (!confirmado) return;

    listaDeProdutos.length = 0;
    inputBusca.value = "";
    resetarEstado();
    salvarNoStorage();
    renderizarTabela();
    mostrarToast("Todos os produtos foram removidos.", "sucesso");
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    limparErro();

    const nome = inputNome.value.trim();
    const preco = parseFloat(inputPreco.value);
    const quantidade = Number(inputQuantidade.value);

    if (nome === "") {
        mostrarErro("O nome do produto não pode estar vazio.", inputNome);
        return;
    }

    const nomeDuplicado = listaDeProdutos.some(
        (produto, index) =>
            index !== indiceEdicao && normalizar(produto.nome) === normalizar(nome)
    );

    if (nomeDuplicado) {
        mostrarErro(
            `Já existe um produto chamado "${nome}". Clique nele na caixa de sugestões abaixo do nome para editá-lo.`,
            inputNome
        );
        atualizarSugestoes();
        return;
    }

    if (isNaN(preco) || preco <= 0) {
        mostrarErro("O preço deve ser um número maior que zero.", inputPreco);
        return;
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
        mostrarErro("A quantidade deve ser um número inteiro maior que zero.", inputQuantidade);
        return;
    }

    try {
        const novoProduto = new Produto(nome, preco, quantidade);
        const estaEditando = indiceEdicao !== null;

        if (estaEditando) {
            listaDeProdutos[indiceEdicao] = novoProduto;
        } else {
            listaDeProdutos.push(novoProduto);
        }

        resetarEstado();
        salvarNoStorage();
        renderizarTabela();
        mostrarToast(
            estaEditando ? "Produto atualizado com sucesso." : "Produto adicionado com sucesso.",
            "sucesso"
        );
    } catch (error) {
        mostrarErro(error.message);
    }
});


function produtosParaObjetos() {
    // Os campos privados (#preco, #quantidade) não aparecem no JSON.stringify,
    // então montamos objetos simples usando os getters.
    return listaDeProdutos.map((p) => ({
        nome: p.nome,
        preco: p.preco,
        quantidade: p.quantidade,
    }));
}

function salvarNoStorage() {
    try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(produtosParaObjetos()));
    } catch (error) {
        mostrarToast("Não foi possível salvar os dados no navegador.", "erro");
    }
}

// Converte dados externos em instâncias de Produto. Lança erro se algo for inválido.
function objetosParaProdutos(dados) {
    if (!Array.isArray(dados)) {
        throw new Error("O arquivo não contém uma lista de produtos.");
    }

    const nomesVistos = new Set();

    return dados.map((item, i) => {
        if (item === null || typeof item !== "object") {
            throw new Error(`Item ${i + 1} do backup é inválido.`);
        }

        try {
            const produto = new Produto(item.nome, Number(item.preco), Number(item.quantidade));
            const chave = normalizar(produto.nome);

            if (nomesVistos.has(chave)) {
                throw new Error(`Nome duplicado: "${produto.nome}".`);
            }
            nomesVistos.add(chave);

            return produto;
        } catch (error) {
            throw new Error(`Item ${i + 1} do backup: ${error.message}`);
        }
    });
}

function carregarDoStorage() {
    try {
        const texto = localStorage.getItem(CHAVE_STORAGE);
        if (!texto) return;

        const produtos = objetosParaProdutos(JSON.parse(texto));
        listaDeProdutos.push(...produtos);
    } catch (error) {
        mostrarToast("Os dados salvos estavam corrompidos e foram ignorados.", "aviso");
    }
}


function baixarArquivo(conteudo, nomeArquivo, tipoMime) {
    const blob = new Blob([conteudo], { type: tipoMime });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


function campoCsv(valor) {
    let texto = String(valor);

    // Evita que o Excel interprete o texto como fórmula (CSV injection)
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;

    // Aspas, ponto-e-vírgula ou quebra de linha exigem o campo entre aspas
    if (/[";\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;

    return texto;
}

botaoCsv.addEventListener("click", () => {
    if (listaDeProdutos.length === 0) {
        mostrarToast("Não há produtos para exportar.", "info");
        return;
    }

    const casasBR = (n) => n.toFixed(2).replace(".", ",");

    const linhas = [
        ["Nome", "Preço", "Quantidade", "Subtotal"],
        ...listaDeProdutos.map((p) => [p.nome, casasBR(p.preco), p.quantidade, casasBR(p.subtotal)]),
    ].map((colunas) => colunas.map(campoCsv).join(";"));

    // BOM (\uFEFF) faz o Excel reconhecer os acentos em UTF-8
    baixarArquivo("\uFEFF" + linhas.join("\r\n"), "estoque.csv", "text/csv;charset=utf-8");
    mostrarToast("Arquivo estoque.csv gerado.", "sucesso");
});

botaoBackup.addEventListener("click", () => {
    if (listaDeProdutos.length === 0) {
        mostrarToast("Não há produtos para salvar no backup.", "info");
        return;
    }

    baixarArquivo(
        JSON.stringify(produtosParaObjetos(), null, 2),
        "backup_estoque.json",
        "application/json"
    );
    mostrarToast("Backup baixado com sucesso.", "sucesso");
});

botaoRestaurar.addEventListener("click", () => inputArquivoBackup.click());

inputArquivoBackup.addEventListener("change", () => {
    const arquivo = inputArquivoBackup.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.addEventListener("load", async () => {
        let novosProdutos;

        try {
            novosProdutos = objetosParaProdutos(JSON.parse(leitor.result));
        } catch (error) {
            const motivo = error instanceof SyntaxError ? "O arquivo não é um JSON válido." : error.message;
            mostrarToast(`Falha ao restaurar: ${motivo}`, "erro");
            inputArquivoBackup.value = "";
            return;
        }

        const confirmado = await confirmarAcao({
            titulo: "Restaurar backup?",
            mensagemHTML: `O backup contém <strong>${novosProdutos.length}</strong> ${novosProdutos.length === 1 ? "produto" : "produtos"}. Os dados atuais serão <strong>substituídos</strong>.`,
            textoConfirmar: "Sim, restaurar",
        });

        if (confirmado) {
            listaDeProdutos.length = 0;
            listaDeProdutos.push(...novosProdutos);
            inputBusca.value = "";
            resetarEstado();
            salvarNoStorage();
            renderizarTabela();
            mostrarToast("Backup restaurado com sucesso.", "sucesso");
        }

        inputArquivoBackup.value = ""; // permite escolher o mesmo arquivo de novo
    });

    leitor.addEventListener("error", () => {
        mostrarToast("Não foi possível ler o arquivo.", "erro");
        inputArquivoBackup.value = "";
    });

    leitor.readAsText(arquivo);
});

carregarDoStorage();
renderizarTabela();