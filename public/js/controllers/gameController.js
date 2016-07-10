app.controller('gameController', function ($scope, $http, $window, $location) {
    var socket = io('/game');
    socket.on('connect', function() {
        socket.emit('room', gameID);
    });

    $scope.game = {};
    $scope.display = {};
    var fkNum;
    if (gameID) {
        $http({
            method: 'GET',
            url: '/api/games/' + gameID
        }).success(function (dataGame) {
            $scope.game = dataGame[0];
            for (var i = 1; i <= 4; i++) {
                (function (i) {
                    // Get the info of each user
                    $http({
                    method: 'GET',
                    url: '/api/users/' + eval(String("dataGame[0].fk_player" + i + "_id"))
                    }).success(function (dataUser) {
                        // $scope.game.player is the internal database representation of the user
                        eval("$scope.game.player" + i + "=dataUser[0]");
                        // Populate $scope.display.player"i" with players on last loop
                        if (i == 4) {
                            updateDisplayUsers();
                        }
                    }).error(function () {
                        console.log("Error getting user");
                    });
                })(i);
            }
        }).error(function () {
            console.log("Error getting game");
        });
    } else { // there is no game in progress
        $location.path('/');
    }

    var yourTimer, yourOpponentTimer, opponentAcrossTimer, teammateTimer;

    var yourDisplay = $('#yourTime'),
        yourOpponentDisplay = $('#yourOpponentTime'),
        opponentAcrossDisplay = $('#opponentAcrossTime'),
        teammateAcrossDisplay = $('#teammateTime');

    var moves = [];
    var board1;
    var board2;
    var boardEl1 = $('#board1');
    var boardEl2 = $('#board2');
    var board1Turn = 'w';
    var gameOver = false;
    var tmpPromotionPiece = null;
    var tmpSourceSquare = null;
    var tmpTargetSquare = null;

    jQuery(function ($) {
        yourTimer = new CountDownTimer($scope.game.minutes * 60, $scope.game.increment);
        yourOpponentTimer = new CountDownTimer($scope.game.minutes * 60, $scope.game.increment);
        opponentAcrossTimer = new CountDownTimer($scope.game.minutes * 60, $scope.game.increment);
        teammateTimer = new CountDownTimer($scope.game.minutes * 60, $scope.game.increment);

        yourTimer.onTick(format(yourDisplay));
        yourOpponentTimer.onTick(format(yourOpponentDisplay));
        opponentAcrossTimer.onTick(format(opponentAcrossDisplay));
        teammateTimer.onTick(format(teammateAcrossDisplay));

        yourTimer.start();
        opponentAcrossTimer.start();

        function format(display) {
            return function (minutes, seconds) {
                minutes = minutes < 10 ? "0" + minutes : minutes;
                seconds = seconds < 10 ? "0" + seconds : seconds;
                display.text(minutes + ':' + seconds);
            };
        }
    });

    var gameLeft = function () {
        var onDragStart = function (source, piece, position, orientation) {
            // check if moving piece is allowed
            if (((fkNum == 1 || fkNum == 3) && piece.charAt(0) != 'w') || ((fkNum == 2 || fkNum == 4) && piece.charAt(0) != 'b') || (board1Turn != piece.charAt(0)) || gameOver) {
                return false;
            }
        };
        var onDrop = function (source, target, piece) {
            // check if move is a pawn promotion, validate on server
            if (source != "spare" && piece.charAt(1).toLowerCase() == 'p' && (target.charAt(1) == 1 || target.charAt(1) == 8)) {
                $http({
                    method: 'PUT',
                    url: '/api/games/validate/pawnpromotion/' + $scope.game.game_id,
                    data: {source: source, target: target, piece: piece, fkNum: fkNum}
                }).success(function (data) {
                    if (data.valid) {  // promotion is allowed, display popup to select piece
                        function getTargetColumn(letter) {
                            if (letter == 'a') return 1;
                            else if (letter == 'b') return 2;
                            else if (letter == 'c') return 3;
                            else if (letter == 'd') return 4;
                            else if (letter == 'e') return 5;
                            else if (letter == 'f') return 6;
                            else if (letter == 'g') return 7;
                            else return 8;
                        }
                        var targetColumn = getTargetColumn(target.charAt(0));
                        if (piece.charAt(0) == 'w') {
                            $("#white_promotion").css({"display": "block"});
                            $('#white_promotion').css('transform', 'translate(' + (targetColumn * 62 - 60) + 'px, 64px)');
                        }
                        else {
                            targetColumn = 9 - targetColumn;
                            $("#black_promotion").css({"display": "block"});
                            $('#black_promotion').css('transform', 'translate(' + (targetColumn * 62 - 60) + 'px, 64px)');
                        }
                        tmpSourceSquare = source;
                        tmpTargetSquare = target;
                        deletePieceFromSquare(tmpSourceSquare);
                    }
                    return 'snapback'; // remove the pawn being promoted or snapback the invalid piece move
                }).error(function () {
                    console.log("Error validating pawn promotion");
                });
            }
            // not a promotion, handle move normally
            else {
                handleMove(source, target, piece);
            }
        };
        var handleMove = function (source, target, piece) {
            // Update UI without validating
            if (source === "spare") {
                addPieceToSquare(target, piece);
            } else {
                deletePieceFromSquare(source);
                addPieceToSquare(target, piece);
            }

            var putData = {game_id: $scope.game.game_id, fkNum: fkNum, move: {source: source, target: target, piece: piece }};
            socket.emit('update game', putData);

            yourOpponentTimer.toggle();
            yourTimer.toggle();
            updateStatus();
        };
        $scope.selectPromotionPiece = function (piece) {
            tmpPromotionPiece = piece.charAt(1).toLowerCase();
            addPieceToSquare(tmpTargetSquare, piece);
            $("#white_promotion").css({"display": "none"});
            $("#black_promotion").css({"display": "none"});
            handleMove(tmpSourceSquare, tmpTargetSquare, piece);
        }
        var addPieceToSquare = function(square, piece) {
            var newPosition = board1.position();
            newPosition[square] = piece;
            board1.position(newPosition);
        };
        var deletePieceFromSquare = function(square) {
            var newPosition = board1.position();
            delete newPosition[square];
            board1.position(newPosition);
        };
        var updateStatus = function() {
            $('#pgn').html(moves);
        };
        var cfg = {
            draggable: true,
            position: 'start',
            sparePieces: true,
            showNotation: false,
            snapbackSpeed: 0,
            snapSpeed: 0,
            appearSpeed: 0,
            onDragStart: onDragStart,
            onDrop: onDrop
        };
        board1 = ChessBoard('board1', cfg);
        updateStatus();
    };
    var gameRight = function () {
        var cfg = {
            draggable: false,
            position: 'start',
            sparePieces: true,
            showNotation: false
        };
        board2 = ChessBoard('board2', cfg);
    };

    $(document).ready(gameLeft);
    $(document).ready(gameRight);

    $scope.getInfoFormat = function (minutes) {
        if (minutes < 3) return "Bullet";
        else if (minutes >= 3 && minutes <= 8) return "Blitz";
        else return "Classical";
    };
    $scope.getDurationFormat = function (duration) {
        var minutes = Math.floor(duration / 60);
        var seconds = duration % 60;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        return minutes + ":" + seconds;
    };
    $scope.getRating = function (user, game) {
        if (user && game) {
            if (game.minutes < 3) return user.ratingBullet;
            else if (game.minutes >= 3 && game.minutes <= 8) return user.ratingBlitz;
            else return user.ratingClassical;
        }
    };
    $scope.updateHighlights = function(boardEl, color, source, target) {
        boardEl.find('.square-55d63').removeClass('highlight-' + color);
        if (color == 'white') {
            boardEl.find('.square-' + source).addClass('highlight-black');
            boardEl.find('.square-' + target).addClass('highlight-black');
        } else {
            boardEl.find('.square-' + source).addClass('highlight-white');
            boardEl.find('.square-' + target).addClass('highlight-white');
        }
    };

    socket.on('update moves', function(data) {
        var arrMoves = data.split(",");
        var diffMoves = $(arrMoves).not(moves).get();

        for (var i = 0; i < diffMoves.length; i++) {
            var moveStr = diffMoves[i].substring(diffMoves[i].indexOf(" ") + 1);
            var boardLetter = diffMoves[i].charAt(diffMoves[i].indexOf(" ") - 2);
            // 2    3
            // 1    4
            var boardNum = 1;
            if (boardLetter == boardLetter.toLowerCase() && boardLetter.toUpperCase() == 'A') boardNum = 2;
            else if (boardLetter == boardLetter.toUpperCase() && boardLetter.toUpperCase() == 'B') boardNum = 3;
            else if (boardLetter == boardLetter.toLowerCase() && boardLetter.toUpperCase() == 'B') boardNum = 4;
            var promotionPiece = 'q';
            if (moveStr.indexOf("=") != -1) {
                promotionPiece = moveStr.charAt(moveStr.indexOf("=") + 1);
            }
        }
        moves = arrMoves;
    });

    // TODO: Update reserve via socket
    socket.on('update reserve', function(data) {
        console.log('Incoming message reserve: ' + data);
        //board1/2.updateSparePieces("white"/"black", data.pieces);
    });

    socket.on('update game', function(data) {
        // board1/2.updateSparePieces("white"/"black", sparePiecesFromData);
        //  e.g.  if (game1.reserve_white[i].type == 'p') { sparePiecesLeftArr.push('bP'); }
        console.log(data);
        if (fkNum == 1 || fkNum == 2) {
            if (data.boardNum == 1) {
                board1.position(data.fen);
                board1Turn = data.turn;
                if(data.turn === 'w') {
                    $scope.updateHighlights(boardEl1, 'white', data.move.source, data.move.target);
                } else {
                    $scope.updateHighlights(boardEl1, 'black', data.move.source, data.move.target);
                }
            } else {
                board2.position(data.fen);
                if(data.turn === 'w') {
                    $scope.updateHighlights(boardEl2, 'white', data.move.source, data.move.target);
                } else {
                    $scope.updateHighlights(boardEl2, 'black', data.move.source, data.move.target);
                }
            }
        } else {
            if (data.boardNum == 1) {
                board2.position(data.fen);
                if(data.turn === 'w') {
                    $scope.updateHighlights(boardEl2, 'white', data.move.source, data.move.target);
                } else {
                    $scope.updateHighlights(boardEl2, 'black', data.move.source, data.move.target);
                }
            } else {
                board1.position(data.fen);
                board1Turn = data.turn;
                if(data.turn === 'w') {
                    $scope.updateHighlights(boardEl1, 'white', data.move.source, data.move.target);
                } else {
                    $scope.updateHighlights(boardEl1, 'black', data.move.source, data.move.target);
                }
            }
        }
        moves = data.moves;
    });

    socket.on('snapback move', function(data) { // invalid move, 'snapback' move
       board1.position(data.fen);
    });

    socket.on('game over', function(data) {
        gameOver = true;
        $location.path('/gameViewer');
    });

    function arraysEqual(arr1, arr2) {
        if(arr1.length !== arr2.length)
            return false;
        for(var i = arr1.length; i--;) {
            if(arr1[i] !== arr2[i])
                return false;
        }
        return true;
    }
    function getForeignKeyNumber() {
        for(var i = 1; i <= 4; i++) {
            if (eval(String("$scope.game.fk_player" + i + "_id")) == $scope.currentUser.user_id) {
                return i;
            }
        }
    }
    function updateDisplayUsers() {
        // $scope.display.player"i" is graphical representation of the user for display the boards
        //  2   3
        //  1   4
        fkNum = getForeignKeyNumber();
        if(fkNum == 1) {
            $scope.display.player1 = $scope.game.player1;
            $scope.display.player2 = $scope.game.player2;
            $scope.display.player3 = $scope.game.player3;
            $scope.display.player4 = $scope.game.player4;
            board2.flip();
        } else if (fkNum == 2){
            $scope.display.player1 = $scope.game.player2;
            $scope.display.player2 = $scope.game.player1;
            $scope.display.player3 = $scope.game.player4;
            $scope.display.player4 = $scope.game.player3;
            board1.flip();
        } else if (fkNum == 3){
            $scope.display.player1 = $scope.game.player3;
            $scope.display.player2 = $scope.game.player4;
            $scope.display.player3 = $scope.game.player1;
            $scope.display.player4 = $scope.game.player2;
            board2.flip();
        } else if (fkNum == 4){
            $scope.display.player1 = $scope.game.player4;
            $scope.display.player2 = $scope.game.player3;
            $scope.display.player3 = $scope.game.player2;
            $scope.display.player4 = $scope.game.player1;
            board1.flip();
        }
    }
});