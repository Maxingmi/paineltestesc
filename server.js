// server.js - CORREÇÃO FINAL PARA CAMINHO DE ARQUIVOS ESTÁTICOS NA VERCELL

process.on('uncaughtException', (err, origin) => { console.error(`FATAL ERROR!`, { err, origin }); });
process.on('unhandledRejection', (reason, promise) => { console.error(`FATAL ERROR!`, { reason, promise }); });

const express = require('express');
const http = require('http');
const path = require('path'); // <-- 1. IMPORTAMOS O MÓDULO 'path'
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 1000;

const programacao = [
    ['19:00', 'ROTA 069/072'], ['20:30', 'ROTA 039'], ['22:00', 'ROTA 068/081-043/049'],
    ['23:00', 'ROTA 029/055/026'], ['23:50', 'ROTA 030/086'], ['00:00', 'ROTA 035/037'],
    ['00:15', 'ROTA 045/076'], ['01:30', 'ROTA 007/036'], ['02:30', 'ROTA 064/066'],
    ['03:40', 'ROTA 044'], ['04:00', 'ROTA 033/038'], ['05:00', 'ROTA 006/034']
];

// ===== MUDANÇA IMPORTANTE AQUI =====
// 2. Usamos path.join para criar um caminho absoluto para a pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));
// ===================================

app.get('/health', (req, res) => res.status(200).send('OK'));

let rotasPassadas = [];

function getSaoPauloTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function calcularProximaRota() {
    try {
        const agora = getSaoPauloTime();
        let proximaRotaEncontrada = null;
        let horarioProximaRota = null;
        const programacaoOrdenada = [...programacao].sort((a, b) => a[0].localeCompare(b[0]));
        for (const rota of programacaoOrdenada) {
            const [hora, minuto] = rota[0].split(':');
            const horarioRotaHoje = getSaoPauloTime();
            horarioRotaHoje.setHours(hora, minuto, 0, 0);
            if (horarioRotaHoje >= agora) {
                proximaRotaEncontrada = { nome: rota[1], horario: `Saída às ${rota[0]}` };
                horarioProximaRota = horarioRotaHoje;
                break;
            }
        }
        if (horarioProximaRota === null && programacaoOrdenada.length > 0) {
            const primeiraRotaDoDia = programacaoOrdenada[0];
            const [hora, minuto] = primeiraRotaDoDia[0].split(':');
            const horarioRotaAmanha = getSaoPauloTime();
            horarioRotaAmanha.setDate(horarioRotaAmanha.getDate() + 1);
            horarioRotaAmanha.setHours(hora, minuto, 0, 0);
            proximaRotaEncontrada = { nome: primeiraRotaDoDia[1], horario: `Saída às ${primeiraRotaDoDia[0]}` };
            horarioProximaRota = horarioRotaAmanha;
            if (rotasPassadas.length > 0) {
                console.log('[NOVO CICLO] Histórico reiniciado.');
                rotasPassadas = [];
            }
        }
        if (proximaRotaEncontrada === null) {
            proximaRotaEncontrada = { nome: 'Nenhuma rota programada.', horario: '' };
        }
        const contagemMs = horarioProximaRota ? horarioProximaRota.getTime() - agora.getTime() : null;
        return { proxima: proximaRotaEncontrada, passadas: rotasPassadas, contagemRegressiva: contagemMs };
    } catch (error) {
        console.error("ERRO CRÍTICO na função calcularProximaRota:", error);
    }
}

io.on('connection', (socket) => {
    console.log('Um painel se conectou!');
    const dadosIniciais = calcularProximaRota();
    if (dadosIniciais) socket.emit('atualizar-painel', dadosIniciais);

    socket.on('preciso-de-nova-rota', (rotaConcluida) => {
        console.log('Cliente reportou conclusão da rota:', rotaConcluida.nome);

        if (rotaConcluida && rotaConcluida.nome && !rotaConcluida.nome.includes('Aguardando')) {
            if (!rotasPassadas.find(r => r.nome === rotaConcluida.nome)) {
                rotasPassadas.unshift(rotaConcluida);
                if (rotasPassadas.length > 10) rotasPassadas.pop();
            }
        }

        const novosDados = calcularProximaRota();
        if(novosDados) io.emit('atualizar-painel', novosDados);
    });
});

const listener = server.listen(process.env.PORT || PORT, () => {
  console.log("Seu app está ouvindo na porta " + listener.address().port);
});

// Adicionando um manipulador de rotas raiz para garantir que o express sirva o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});