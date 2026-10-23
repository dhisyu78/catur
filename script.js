// ==========================================
// DHISCHESS ARENA - GAME ENGINE & NAVIGATION
// ==========================================

var board = null;
var game = new Chess();
var $status = $('#statusText');
var currentMode = 'bot'; 
var playerColor = 'w';  
var isHintRequesting = false;
var isMuted = false;

// JAM CATUR (CHESS CLOCK)
var selectedTimeLimit = 0; 
var whiteTime = 0;
var blackTime = 0;
var timerInterval = null;

// EFEK SUARA (SFX)
const soundMove = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_default/mp3/move-self.mp3');
const soundCapture = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_default/mp3/capture.mp3');
const soundCheckmate = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_default/mp3/game-end.mp3');

function playSFX(audio) {
    if (!isMuted) {
        audio.currentTime = 0;
        audio.play().catch(function(){});
    }
}

// BUKU PEMBUKAAN CATUR (OPENING BOOK DICTIONARY)
const openingBook = {
    "e4": "King's Pawn Opening",
    "d4": "Queen's Pawn Opening",
    "c4": "English Opening",
    "Nf3": "Réti Opening",
    "e4 e5": "Open Game",
    "e4 e5 Nf3": "King's Knight Opening",
    "e4 e5 Nf3 Nc6": "King's Knight: Normal",
    "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
    "e4 e5 Nf3 Nc6 Bc4 Bc5": "Giuoco Piano",
    "e4 e5 Nf3 Nc6 Bc4 Nf6": "Two Knights Defense",
    "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez (Spanish Opening)",
    "e4 e5 Nf3 Nc6 d4": "Scotch Game",
    "e4 e5 f4": "King's Gambit",
    "e4 c5": "Sicilian Defense",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3": "Sicilian Defense: Dragon/Najdorf",
    "e4 e6": "French Defense",
    "e4 c6": "Caro-Kann Defense",
    "e4 d6": "Pirc Defense",
    "e4 g6": "Modern Defense",
    "e4 Nf6": "Alekhine's Defense",
    "e4 d5": "Scandinavian Defense",
    "d4 d5": "Closed Game",
    "d4 d5 c4": "Queen's Gambit",
    "d4 d5 c4 dxc4": "Queen's Gambit Accepted",
    "d4 d5 c4 e6": "Queen's Gambit Declined",
    "d4 d5 c4 c6": "Slav Defense",
    "d4 Nf6": "Indian Defense",
    "d4 Nf6 c4 e6 Nf3 b6": "Queen's Indian Defense",
    "d4 Nf6 c4 g6 Nc3 d5": "Grünfeld Defense",
    "d4 Nf6 c4 g6 Nc3 Bg7": "King's Indian Defense",
    "d4 Nf6 c4 e6 Nc3 Bb4": "Nimzo-Indian Defense",
    "d4 f5": "Dutch Defense"
};

// BOT LEVELS
var botLevels = {
    nadya: { name: 'Bot Pemula', badge: 'Pemula', depth: 1, avatarClass: 'bg-info text-dark', badgeClass: 'bg-info text-dark' },
    faiza: { name: 'Bot Sedang', badge: 'Sedang', depth: 4, avatarClass: 'bg-warning text-dark', badgeClass: 'bg-warning text-dark' },
    yudhis: { name: 'Yudhis Raja Terakhir', badge: 'Raja Terakhir', depth: 10, avatarClass: 'bg-danger text-white', badgeClass: 'bg-danger' }
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
                var moveObj = game.move({
                    from: match[1],
                    to: match[2],
                    promotion: match[3] || 'q'
                });

                if (moveObj) {
                    if (moveObj.captured) playSFX(soundCapture);
                    else playSFX(soundMove);
                }

                board.position(game.fen());
                updateStatus();
                switchClockTurn();
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

    if (move.captured) playSFX(soundCapture);
    else playSFX(soundMove);

    removeHighlights();
    updateStatus();
    switchClockTurn();
    
    if (currentMode === 'bot') {
        window.setTimeout(makeAIMove, 250);
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

// 3. LOGIKA JAM CATUR (CHESS CLOCK)
function formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function updateClockDisplays() {
    if (selectedTimeLimit === 0) {
        $('#playerClock .clock-time, #opponentClock .clock-time').text('--:--');
        $('#playerClock, #opponentClock').removeClass('active-clock danger-clock');
        return;
    }

    var whiteClockElem = (playerColor === 'w') ? $('#playerClock') : $('#opponentClock');
    var blackClockElem = (playerColor === 'b') ? $('#playerClock') : $('#opponentClock');

    whiteClockElem.find('.clock-time').text(formatTime(whiteTime));
    blackClockElem.find('.clock-time').text(formatTime(blackTime));

    whiteClockElem.toggleClass('danger-clock', whiteTime < 30);
    blackClockElem.toggleClass('danger-clock', blackTime < 30);

    $('.chess-clock').removeClass('active-clock');
    if (!game.game_over()) {
        if (game.turn() === 'w') whiteClockElem.addClass('active-clock');
        else blackClockElem.addClass('active-clock');
    }
}

function startClockTimer() {
    clearInterval(timerInterval);
    if (selectedTimeLimit === 0) return;

    timerInterval = setInterval(function() {
        if (game.game_over()) {
            clearInterval(timerInterval);
            return;
        }

        if (game.turn() === 'w') {
            whiteTime--;
            if (whiteTime <= 0) handleTimeOut('w');
        } else {
            blackTime--;
            if (blackTime <= 0) handleTimeOut('b');
        }
        updateClockDisplays();
    }, 1000);
}

function switchClockTurn() {
    if (selectedTimeLimit > 0 && !game.game_over()) {
        startClockTimer();
    }
}

function handleTimeOut(timeoutColor) {
    clearInterval(timerInterval);
    playSFX(soundCheckmate);

    var winnerColor = (timeoutColor === 'w') ? 'Hitam' : 'Putih';
    var isPlayerWin = (currentMode === 'bot' && winnerColor === (playerColor === 'w' ? 'Putih' : 'Hitam'));

    if (currentMode === 'bot') {
        if (isPlayerWin) {
            showResultModal('Waktu Habis! Anda Menang', currentBot.name + ' kehabisan waktu.', '<i class="fa-solid fa-stopwatch text-warning"></i>');
        } else {
            showResultModal('Waktu Habis! Anda Kalah', 'Waktu berpikir Anda telah habis.', '<i class="fa-solid fa-stopwatch text-danger"></i>');
        }
    } else {
        showResultModal('Waktu Habis!', 'Pemain ' + winnerColor + ' Menang karena waktu lawan habis.', '<i class="fa-solid fa-stopwatch text-warning"></i>');
    }

    $status.html('Waktu Habis! Pemain ' + winnerColor + ' Menang');
}

// 4. DETEKSI BUKU PEMBUKAAN CATUR (OPENING BOOK)
function updateOpeningName() {
    var historyStr = game.history().join(' ');
    var matchedOpening = 'Pembukaan Bebas';

    for (var key in openingBook) {
        if (historyStr === key || historyStr.indexOf(key) === 0) {
            matchedOpening = openingBook[key];
        }
    }

    if (game.history().length === 0) {
        matchedOpening = 'Awal Pertandingan';
    }

    $('#openingName').text(matchedOpening);
}

// 5. TAMPILAN BIDAK YANG DIMAKAN
function updateCapturedPieces() {
    var initial = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 };
    var currentW = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    var currentB = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };

    var boardState = game.board();
    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            var p = boardState[r][c];
            if (p) {
                if (p.color === 'w') currentW[p.type]++;
                else currentB[p.type]++;
            }
        }
    }

    var capturedFromWhite = [];
    var capturedFromBlack = [];

    var valMap = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    var whiteVal = 0, blackVal = 0;

    ['q', 'r', 'b', 'n', 'p'].forEach(function(type) {
        var diffW = initial[type] - currentW[type];
        for (var i = 0; i < diffW; i++) capturedFromWhite.push(type);

        var diffB = initial[type] - currentB[type];
        for (var i = 0; i < diffB; i++) capturedFromBlack.push(type);

        whiteVal += currentW[type] * valMap[type];
        blackVal += currentB[type] * valMap[type];
    });

    var playerCapElem = (playerColor === 'w') ? $('#playerCaptured') : $('#opponentCaptured');
    var opponentCapElem = (playerColor === 'w') ? $('#opponentCaptured') : $('#playerCaptured');

    var htmlW = capturedFromBlack.map(function(t) {
        return '<img src="img/chesspieces/wikipedia/b' + t.toUpperCase() + '.png" class="captured-icon" alt="' + t + '">';
    }).join('');

    var htmlB = capturedFromWhite.map(function(t) {
        return '<img src="img/chesspieces/wikipedia/w' + t.toUpperCase() + '.png" class="captured-icon" alt="' + t + '">';
    }).join('');

    var diffScore = whiteVal - blackVal;

    if (playerColor === 'w') {
        playerCapElem.html(htmlW + (diffScore > 0 ? '<span class="material-lead">+' + diffScore + '</span>' : ''));
        opponentCapElem.html(htmlB + (diffScore < 0 ? '<span class="material-lead">+' + Math.abs(diffScore) + '</span>' : ''));
    } else {
        playerCapElem.html(htmlB + (diffScore < 0 ? '<span class="material-lead">+' + Math.abs(diffScore) + '</span>' : ''));
        opponentCapElem.html(htmlW + (diffScore > 0 ? '<span class="material-lead">+' + diffScore + '</span>' : ''));
    }
}

// 6. POPUP MODAL & STATUS PERMAINAN
function showResultModal(title, message, iconHtml) {
    clearInterval(timerInterval);
    $('#modalTitle').text(title);
    $('#modalMessage').text(message);
    $('#modalIcon').html(iconHtml);
    
    var modalElement = document.getElementById('gameResultModal');
    if (modalElement) {
        var myModal = new bootstrap.Modal(modalElement);
        myModal.show();
    }
}

function updateMoveLog() {
    var history = game.history();
    var $logContainer = $('#moveLog');
    
    $('#moveCountBadge').text(history.length + ' Langkah');

    if (history.length === 0) {
        $logContainer.html('<div class="text-secondary text-center small py-2">Belum ada langkah</div>');
        return;
    }

    var logHTML = '';
    for (var i = 0; i < history.length; i += 2) {
        var moveNum = (i / 2) + 1;
        var whiteMove = history[i];
        var blackMove = history[i + 1] ? history[i + 1] : '-';

        logHTML += '<div class="move-row">' +
            '<span class="text-warning fw-bold" style="width: 25%;">' + moveNum + '.</span>' +
            '<span class="text-light" style="width: 37.5%;">' + whiteMove + '</span>' +
            '<span class="text-info" style="width: 37.5%;">' + blackMove + '</span>' +
        '</div>';
    }

    $logContainer.html(logHTML);

    var logElem = document.getElementById('moveLog');
    if (logElem) {
        logElem.scrollTop = logElem.scrollHeight;
    }
}

function updateStatus() {
    var statusHTML = '';
    var moveColor = (game.turn() === 'w') ? 'Putih' : 'Hitam';

    if (game.in_checkmate()) {
        playSFX(soundCheckmate);
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

    updateMoveLog();
    updateCapturedPieces();
    updateOpeningName();
    updateClockDisplays();
}

// 7. NAVIGASI HALAMAN & PILIH MODE
function selectMode(mode) {
    if (mode === 'online') {
        alert('Fitur Matchmaking Online memerlukan server backend (WebSocket/Firebase). Saat ini kamu bisa mencoba Mode Bot AI atau Teman Lokal di DhisChess Arena!');
        return;
    }

    if (mode === 'bot') {
        $('#modalSetupTitle').html('<i class="fa-solid fa-robot text-warning me-2"></i>Pengaturan Laga Bot AI');
        $('#modalSetupSub').text('Tentukan durasi jam catur dan tingkat kesulitan Bot:');
        $('#botSelectionContainer').removeClass('d-none');
        $('#friendStartContainer').addClass('d-none');

        var modalElement = document.getElementById('gameSetupModal');
        var myModal = new bootstrap.Modal(modalElement);
        myModal.show();
        return;
    }

    if (mode === 'friend') {
        $('#modalSetupTitle').html('<i class="fa-solid fa-users text-primary me-2"></i>Pengaturan Laga 1v1 Lokal');
        $('#modalSetupSub').text('Tentukan durasi jam catur untuk bertanding bersama teman:');
        $('#botSelectionContainer').addClass('d-none');
        $('#friendStartContainer').removeClass('d-none');

        var modalElement = document.getElementById('gameSetupModal');
        var myModal = new bootstrap.Modal(modalElement);
        myModal.show();
        return;
    }

    startSelectedMode(mode);
}

function confirmBotSelection(botKey) {
    currentBot = botLevels[botKey] || botLevels.yudhis;
    selectedTimeLimit = parseInt($('input[name="timeOption"]:checked').val()) || 0;
    
    var modalElement = document.getElementById('gameSetupModal');
    var instance = bootstrap.Modal.getInstance(modalElement);
    if (instance) instance.hide();

    startSelectedMode('bot');
}

function confirmFriendSelection() {
    selectedTimeLimit = parseInt($('input[name="timeOption"]:checked').val()) || 0;

    var modalElement = document.getElementById('gameSetupModal');
    var instance = bootstrap.Modal.getInstance(modalElement);
    if (instance) instance.hide();

    startSelectedMode('friend');
}

function startSelectedMode(mode) {
    currentMode = mode;
    removeHighlights();
    clearInterval(timerInterval);

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

    whiteTime = selectedTimeLimit;
    blackTime = selectedTimeLimit;

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
        $('#opponentName').text('Pemain 2 (Hitam)');
        $('#opponentBadge').text('Bidak Hitam').removeClass('bg-secondary bg-info bg-danger').addClass('bg-success text-white');
        $('#opponentAvatar').html('<i class="fa-solid fa-user-group"></i>').removeClass('bg-danger bg-info bg-warning').addClass('bg-primary text-white');
        $('.player-card').last().find('.badge').text('Pemain 1 (Putih)');
        $('#hintBtn').addClass('d-none');
    }

    board.resize();
    updateStatus();

    if (currentMode === 'bot' && game.turn() !== playerColor && !game.game_over()) {
        window.setTimeout(makeAIMove, 250);
    } else if (selectedTimeLimit > 0) {
        startClockTimer();
    }
}

// 8. EVENT LISTENERS & TOMBOL KONTROL
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
    clearInterval(timerInterval);
    $('#gameScreen').addClass('d-none');
    $('#modeScreen').removeClass('d-none');
});

// Mute / Unmute
$('#muteBtn').on('click', function() {
    isMuted = !isMuted;
    if (isMuted) {
        $(this).html('<i class="fa-solid fa-volume-xmark"></i>').removeClass('btn-outline-warning').addClass('btn-danger');
    } else {
        $(this).html('<i class="fa-solid fa-volume-high"></i>').removeClass('btn-danger').addClass('btn-outline-warning');
    }
});

// Hint
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

// Undo
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

    playSFX(soundMove);
    board.position(game.fen());
    updateStatus();
    switchClockTurn();
});

// Reset
$('#resetBtn').on('click', function () {
    localStorage.removeItem('savedChessGame_' + currentMode);
    localStorage.removeItem('savedPlayerColor_' + currentMode);
    
    removeHighlights();
    clearInterval(timerInterval);

    if (currentMode === 'bot') {
        playerColor = Math.random() < 0.5 ? 'w' : 'b';
    } else {
        playerColor = 'w';
    }

    whiteTime = selectedTimeLimit;
    blackTime = selectedTimeLimit;

    game.reset();
    board.orientation(playerColor === 'w' ? 'white' : 'black');
    board.start();

    var colorText = playerColor === 'w' ? 'Bidak Putih' : 'Bidak Hitam';
    $('.player-card').last().find('.badge').text(colorText);

    updateStatus();

    if (currentMode === 'bot' && game.turn() !== playerColor && !game.game_over()) {
        window.setTimeout(makeAIMove, 250);
    } else if (selectedTimeLimit > 0) {
        startClockTimer();
    }
});

$(window).on('resize', function () {
    if (board) board.resize();
});