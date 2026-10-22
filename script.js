// ==========================================
// DHISCHESS ARENA - GAME ENGINE & NAVIGATION
// ==========================================

var board = null;
var game = new Chess();
var $status = $('#statusText');
var currentMode = 'bot'; 
var playerColor = 'w';  
var isHintRequesting = false;

var botLevels = {
    nadya: { name: 'Nadya Bot', badge: 'Mudah', depth: 1, avatarClass: 'bg-info text-dark', badgeClass: 'bg-info text-dark' },
    faiza: { name: 'Faiza Bot', badge: 'Sedang', depth: 4, avatarClass: 'bg-warning text-dark', badgeClass: 'bg-warning text-dark' },
    yudhis: { name: 'Yudhis Bot', badge: 'Sulit', depth: 10, avatarClass: 'bg-danger text-white', badgeClass: 'bg-danger' }
};
var currentBot = botLevels.yudhis; 

// 1. SETUP BOT AI (STOCKFISH.JS)
var blob = new Blob([
    "importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');"
], {type: 'application/javascript'});
var engine = new Worker(URL.createObjectURL(blob));

engine.onmessage = function(event) {
    var line = event.data;
    if (line && line.indexOf('bestmove') > -1) {
        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            if (isHintRequesting) {
                isHintRequesting = false;
                var from = match[1];
                var to = match[2];

                removeHighlights();
                $('#myBoard .square-' + from).addClass('highlight-hint');
                $('#myBoard .square-' + to).addClass('highlight-hint');

                $status.html('<i class="fa-solid fa-lightbulb text-warning me-2"></i>Saran AI: <b>' + from.toUpperCase() + ' → ' + to.toUpperCase() + '</b>');
            } 
            else if (currentMode === 'bot') {
                game.move({
                    from: match[1],
                    to: match[2],
                    promotion: match[3] || 'q'
                });
                board.position(game.fen());
                updateStatus();
            }
        }
    }
};

function makeAIMove() {
    if (game.game_over() || currentMode !== 'bot') return;
    $status.html('<i class="fa-solid fa-spinner fa-spin me-2"></i>' + currentBot.name + ' sedang berpikir...');
    engine.postMessage('position fen ' + game.fen());
    engine.postMessage('go depth ' + currentBot.depth);
}

function removeHighlights() {
    $('#myBoard div[class*="square-"]').removeClass('highlight-hint');
}

// 2. KONTROL INTERAKSI PAPAN CATUR
function onDragStart(source, piece) {
    if (game.game_over()) return false;
    
    removeHighlights();

    if (currentMode === 'bot') {
        if (playerColor === 'w' && piece.search(/^b/) !== -1) return false;
        if (playerColor === 'b' && piece.search(/^w/) !== -1) return false;
    }
    
    if (currentMode === 'friend') {
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    removeHighlights();
    updateStatus();
    
    if (currentMode === 'bot') {
        window.setTimeout(makeAIMove, 250);
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

// 3. POPUP MODAL & STATUS PERMAINAN
function showResultModal(title, message, iconHtml) {
    $('#modalTitle').text(title);
    $('#modalMessage').text(message);
    $('#modalIcon').html(iconHtml);
    
    var modalElement = document.getElementById('gameResultModal');
    if (modalElement) {
        var myModal = new bootstrap.Modal(modalElement);
        myModal.show();
    }
}

function updateStatus() {
    var statusHTML = '';
    var moveColor = (game.turn() === 'w') ? 'Putih' : 'Hitam';

    if (game.in_checkmate()) {
        statusHTML = 'Skakmat!';
        if (currentMode === 'bot') {
            if (game.turn() !== playerColor) {
                showResultModal('Selamat, Anda Menang!', 'Anda berhasil mengalahkan ' + currentBot.name + ' di DhisChess Arena.', '<i class="fa-solid fa-trophy text-warning"></i>');
            } else {
                showResultModal('Skakmat! Anda Kalah', currentBot.name + ' memenangkan pertandingan kali ini.', '<i class="fa-solid fa-skull text-danger"></i>');
            }
        } else {
            showResultModal('Skakmat!', 'Pemain ' + (game.turn() === 'w' ? 'Hitam' : 'Putih') + ' Menang!', '<i class="fa-solid fa-trophy text-warning"></i>');
        }
    } else if (game.in_draw()) {
        statusHTML = 'Permainan Remis!';
        showResultModal('Permainan Remis!', 'Pertandingan berakhir imbang.', '<i class="fa-solid fa-handshake text-info"></i>');
    } else {
        statusHTML = 'Giliran ' + moveColor;
        if (currentMode === 'bot') {
            statusHTML += (game.turn() === playerColor) ? ' (Anda)' : ' (' + currentBot.name + ')';
        }
        if (game.in_check()) {
            statusHTML += ' <span class="badge bg-danger ms-1">Skak!</span>';
        }
    }

    $status.html(statusHTML);
    localStorage.setItem('savedChessGame_' + currentMode, game.fen());
    localStorage.setItem('savedPlayerColor_' + currentMode, playerColor);
}

// 4. NAVIGASI HALAMAN & PILIH MODE
function selectMode(mode) {
    if (mode === 'online') {
        alert('Fitur Matchmaking Online memerlukan server backend (WebSocket/Firebase). Saat ini kamu bisa mencoba Mode Bot AI atau Teman Lokal di DhisChess Arena!');
        return;
    }

    if (mode === 'bot') {
        var modalElement = document.getElementById('botDifficultyModal');
        var myModal = new bootstrap.Modal(modalElement);
        myModal.show();
        return;
    }

    startSelectedMode(mode);
}

function confirmBotSelection(botKey) {
    currentBot = botLevels[botKey] || botLevels.yudhis;
    
    var modalElement = document.getElementById('botDifficultyModal');
    var instance = bootstrap.Modal.getInstance(modalElement);
    if (instance) instance.hide();

    startSelectedMode('bot');
}

function startSelectedMode(mode) {
    currentMode = mode;
    removeHighlights();
    $('#modeScreen').addClass('d-none');
    $('#gameScreen').removeClass('d-none');

    var savedGame = localStorage.getItem('savedChessGame_' + currentMode);
    var savedColor = localStorage.getItem('savedPlayerColor_' + currentMode);

    if (savedGame && savedColor) {
        playerColor = savedColor;
        game.load(savedGame);
    } else {
        if (mode === 'bot') {
            playerColor = Math.random() < 0.5 ? 'w' : 'b';
        } else {
            playerColor = 'w';
        }
        game.reset();
    }

    if (!board) {
        var config = {
            draggable: true,
            position: 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        };
        board = Chessboard('myBoard', config);
    }

    board.orientation(playerColor === 'w' ? 'white' : 'black');
    board.position(game.fen());

    if (mode === 'bot') {
        var colorText = playerColor === 'w' ? 'Bidak Putih' : 'Bidak Hitam';
        $('#modeBadge').text('Mode: Bot (' + currentBot.badge + ')').removeClass('bg-primary').addClass('bg-warning text-dark');
        $('#opponentName').text(currentBot.name);
        $('#opponentBadge').text('Level ' + currentBot.badge)
            .removeClass('bg-secondary bg-info bg-warning bg-danger text-dark text-white')
            .addClass(currentBot.badgeClass);
        $('#opponentAvatar').html('<i class="fa-solid fa-robot"></i>')
            .removeClass('bg-primary bg-danger bg-info bg-warning text-dark text-white')
            .addClass(currentBot.avatarClass);
            
        $('.player-card').last().find('.badge').text(colorText);
        $('#hintBtn').removeClass('d-none');
    } else if (mode === 'friend') {
        $('#modeBadge').text('Mode: Teman (Lokal)').removeClass('bg-warning text-dark').addClass('bg-primary text-white');
        $('#opponentName').text('Pemain 2 (Teman)');
        $('#opponentBadge').text('Bidak Hitam').removeClass('bg-secondary bg-info bg-danger').addClass('bg-success text-white');
        $('#opponentAvatar').html('<i class="fa-solid fa-user-group"></i>').removeClass('bg-danger bg-info bg-warning').addClass('bg-primary text-white');
        $('.player-card').last().find('.badge').text('Bidak Putih');
        $('#hintBtn').addClass('d-none');
    }

    board.resize();
    updateStatus();

    if (currentMode === 'bot' && game.turn() !== playerColor && !game.game_over()) {
        window.setTimeout(makeAIMove, 250);
    }
}

// 5. EVENT LISTENERS
$('#startMainBtn').on('click', function() {
    $('#landingScreen').addClass('d-none');
    $('#modeScreen').removeClass('d-none');
});

$('#backToLandingBtn').on('click', function() {
    $('#modeScreen').addClass('d-none');
    $('#landingScreen').removeClass('d-none');
});

$('#backToModeBtn').on('click', function() {
    removeHighlights();
    $('#gameScreen').addClass('d-none');
    $('#modeScreen').removeClass('d-none');
});

// Tombol Bantuan AI (Hint)
$('#hintBtn').on('click', function() {
    if (game.game_over()) return;
    if (currentMode !== 'bot') return;
    if (game.turn() !== playerColor) {
        alert('Tunggu giliran Anda untuk meminta Bantuan AI!');
        return;
    }

    isHintRequesting = true;
    $status.html('<i class="fa-solid fa-lightbulb fa-spin me-2 text-warning"></i>Mencari langkah terbaik...');
    engine.postMessage('position fen ' + game.fen());
    engine.postMessage('go depth 12');
});

// Tombol Undo Langkah
$('#undoBtn').on('click', function() {
    if (game.history().length === 0) return;

    removeHighlights();

    if (currentMode === 'bot') {
        if (game.turn() === playerColor) {
            if (game.history().length >= 2) {
                game.undo();
                game.undo();
            } else if (game.history().length === 1) {
                game.undo();
            }
        } else {
            game.undo();
        }
    } else if (currentMode === 'friend') {
        game.undo();
    }

    board.position(game.fen());
    updateStatus();
});

// Tombol Reset Permainan
$('#resetBtn').on('click', function () {
    localStorage.removeItem('savedChessGame_' + currentMode);
    localStorage.removeItem('savedPlayerColor_' + currentMode);
    
    removeHighlights();

    if (currentMode === 'bot') {
        playerColor = Math.random() < 0.5 ? 'w' : 'b';
    } else {
        playerColor = 'w';
    }

    game.reset();
    board.orientation(playerColor === 'w' ? 'white' : 'black');
    board.start();

    var colorText = playerColor === 'w' ? 'Bidak Putih' : 'Bidak Hitam';
    $('.player-card').last().find('.badge').text(colorText);

    updateStatus();

    if (currentMode === 'bot' && game.turn() !== playerColor && !game.game_over()) {
        window.setTimeout(makeAIMove, 250);
    }
});

$(window).on('resize', function () {
    if (board) board.resize();
});