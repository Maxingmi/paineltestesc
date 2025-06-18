// server.js - Versão Final com Correção de Sintaxe

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sua programação completa
const programacao = [
    ['19:00', 'ROTA 069/072'],
    ['20:30', 'ROTA 039'],
    ['22:00', 'ROTA 068/081-043/049'],
    ['23:00', 'ROTA 029/055/026'],
    ['23:50', 'ROTA 030/086'],
    ['00:00', 'ROTA 035/037'],
    ['00:15', 'ROTA 045/076'],
    ['01:30', 'ROTA 007/036'],
    ['02:30', 'ROTA 064/066'],
    ['03:40', 'ROTA 044'],
    ['04:00', 'ROTA 033/038'],
    ['05:00', 'ROTA 006/034']
];

app.use(express.static('public'));

let rotasPassadas = [];

// Função para obter a hora de São Paulo (UTC-3), importante para servidores online
function getSaoPauloTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

// Função que apenas calcula os dados da próxima rota
function calcularProximaRota() {
    try {
        // ### A CORREÇÃO ESTÁ AQUI ###
        const agora = getSaoPauloTime(); // Removido o espaço
        let proximaRotaEncontrada = null;
        let horarioProximaRota = null;
        const programacaoOrdenada = [...programacao].sort((a, b) => a[0].localeCompare(b[0]));

        for (const rota of programacaoOrdenada) {
            const [hora, minuto] = rota[0].split(':');
            const horarioRotaHoje = getSaoPauloTime(); // Removido o espaço
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
            const horarioRotaAmanha = getSaoPauloTime(); // Removido o espaço
            horarioRotaAmanha.setDate(horarioRotaAmanha.getDate() + 1);
            horarioRotaAmanha.setHours(hora, minuto, 0, 0);
            proximaRotaEncontrada = { nome: primeiraRotaDoDia[1], horario: `Saída às ${primeiraRotaDoDia[0]}` };
            horarioProximaRota = horarioRotaAmanha;
            if (rotasPassadas.length > 0) {
                rotasPassadas = [];
            }
        }
        
        if (proximaRotaEncontrada === null) {
            proximaRotaEncontrada = { nome: 'Nenhuma rota programada.', horario: '' };
        }

        const rotaAtual = proximaRotaEncontrada;
        
        const contagemMs = horarioProximaRota ? horarioProximaRota.getTime() - agora.getTime() : null;

        return {
            proxima: rotaAtual,
            passadas: rotasPassadas,
            contagemRegressiva: contagemMs
        };

    } catch (error) {
        console.error("ERRO CRÍTICO na função calcularProximaRota:", error);
    }
}

io.on('connection', (socket) => {
    console.log('Um painel se conectou!');
    const dadosIniciais = calcularProximaRota();
    if (dadosIniciais) socket.emit('atualizar-painel', dadosIniciais);

    socket.on('preciso-de-nova-rota', () => {
        console.log('Cliente pediu nova rota. Calculando...');
        
        // Simplesmente recalcula e envia os dados mais recentes
        const novosDados = calcularProximaRota();
        if(novosDados) socket.emit('atualizar-painel', novosDados);
    });
});

// A Glitch usa um 'listener' para iniciar o servidor
const listener = server.listen(process.env.PORT, () => {
  console.log("Seu app está ouvindo na porta " + listener.address().port);
});