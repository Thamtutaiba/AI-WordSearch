// 1. Khởi tạo: Biến trạng thái và hằng số
// Đối tượng gameState lưu trữ trạng thái trò chơi (lưới, từ, thời gian, v.v.)
const gameState = {
    board: [],
    words: [],
    foundWords: [],
    placedWords: [],
    boardSize: 15,
    timer: null,
    timeLeft: 300,
    isGameStarted: false,
    englishWords: [],
    targetWords: 0
};

// Mảng màu sắc để tô các từ đã tìm thấy
const colors = [
    '#81c784', '#ff5555', '#ffaa00', '#55aaff', '#ff55ff', '#55ff55',
    '#aa55ff', '#ffaa55', '#55ffff', '#ff55aa', '#aaff55', '#ff5555',
    '#55aa55', '#aa55aa', '#aaaa55'
];

// Mảng hướng tìm kiếm và đặt từ (8 hướng: ngang, dọc, chéo)
const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// Tham chiếu đến các phần tử HTML trong giao diện
const boardElement = document.getElementById('game-board');
const wordInputElement = document.getElementById('word-input');
const startGameButton = document.getElementById('start-game');
const newGameButton = document.getElementById('new-game');
const hintButton = document.getElementById('hint-button');
const boardSizeSelect = document.getElementById('board-size');
const difficultySelect = document.getElementById('difficulty');
const timeLimitInput = document.getElementById('time-limit');
const timerElement = document.getElementById('timer');
const wordsFoundElement = document.getElementById('words-found');
const foundWordsList = document.getElementById('found-words-list');
const notFoundWordsList = document.getElementById('not-found-words-list');

// 2. Chuẩn bị dữ liệu: Tải từ điển từ file dictionary.json
// Hàm này đọc danh sách từ tiếng Anh để sử dụng trong trò chơi
async function loadEnglishWords() {
    try {
        const response = await fetch('dictionary.json');
        const data = await response.json();
        gameState.englishWords = data; // Lưu từ vào gameState.englishWords
        console.log(`Loaded ${gameState.englishWords.length} words.`);
    } catch (error) {
        console.error('Error loading words:', error);
        alert('Failed to load word list. Please check if dictionary.json exists.');
    }
}

// 3. Chọn từ ngẫu nhiên: Chọn số từ dựa trên độ khó
// Hàm này chọn 5, 10, hoặc 15 từ ngẫu nhiên từ từ điển
function selectRandomWords(difficulty) {
    const shuffled = [...gameState.englishWords].sort(() => 0.5 - Math.random());
    let count;
    switch(difficulty) {
        case 'easy': count = 5; break;
        case 'hard': count = 15; break;
        case 'medium': default: count = 10; break;
    }
    const selectedWords = shuffled.slice(0, count).sort((a, b) => a.length - b.length); // Sắp xếp từ ngắn đến dài
    gameState.targetWords = count;
    console.log("Difficulty:", difficulty, "Number of words:", selectedWords.length, "Words:", selectedWords);
    return selectedWords;
}

// 4. Tạo lưới ô chữ: Tạo lưới và đặt từ bằng thuật toán Greedy
// Hàm này tạo lưới, đặt từ, và xác minh bằng DFS
function generateBoard(size, words) {
    console.time('generateBoard');
    const board = Array(size).fill().map(() => Array(size).fill(''));
    gameState.placedWords = [];
    const usedCells = new Set();
    const maxAttemptsPerWord = 3;
    const sortedWords = [...words].sort((a, b) => b.length - a.length); // Sắp xếp từ dài trước
    const positions = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            positions.push([row, col]);
        }
    }
    sortedWords.forEach(word => {
        let placed = false;
        let attempt = 0;
        while (!placed && attempt < maxAttemptsPerWord) {
            attempt++;
            for (let i = positions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
            let bestPlacement = null;
            let minConflicts = Infinity;
            const shuffledDirections = [...directions].sort(() => 0.5 - Math.random());
            positions.forEach(([row, col]) => {
                shuffledDirections.forEach(([dx, dy]) => {
                    if (canPlaceWord(board, word, row, col, dx, dy, size, usedCells)) {
                        const conflicts = countConflicts(board, word, row, col, dx, dy);
                        if (conflicts < minConflicts) {
                            minConflicts = conflicts;
                            bestPlacement = { row, col, dx, dy };
                        }
                    }
                });
            });
            if (bestPlacement) {
                const { row, col, dx, dy } = bestPlacement;
                const path = [];
                for (let i = 0; i < word.length; i++) {
                    const r = row + i * dx;
                    const c = col + i * dy;
                    board[r][c] = word[i];
                    usedCells.add(`${r},${c}`);
                    path.push([r, c]);
                }
                gameState.placedWords.push({
                    word,
                    start: [row, col],
                    end: [row + (word.length - 1) * dx, col + (word.length - 1) * dy],
                    direction: [dx, dy]
                });
                placed = true;
            }
        }
        if (!placed) {
            console.log(`Could not place word: ${word} after ${maxAttemptsPerWord} attempts`);
        }
    });
    const latinChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === '') {
                board[row][col] = latinChars.charAt(Math.floor(Math.random() * latinChars.length));
            }
        }
    }
    console.log("Placed words in the grid:", gameState.placedWords);
    printBoard(board);
    // Xác minh các từ đã đặt bằng DFS để đảm bảo chúng có thể tìm thấy
    gameState.placedWords = gameState.placedWords.filter(({ word }) => {
        const result = findWordDFS(board, word);
        if (!result.found) {
            console.error(`Verification failed: "${word}" was placed but cannot be found in the grid!`);
            return false;
        }
        return true;
    });
    gameState.targetWords = gameState.placedWords.length; // Cập nhật số từ mục tiêu
    console.log("Verified placed words:", gameState.placedWords);
    console.timeEnd('generateBoard');
    console.log(`Successfully placed ${gameState.placedWords.length} out of ${words.length} words`);
    return board;
}

// Kiểm tra xem từ có thể đặt ở vị trí và hướng cụ thể không
function canPlaceWord(board, word, startRow, startCol, dx, dy, size, usedCells) {
    for (let i = 0; i < word.length; i++) {
        const row = startRow + i * dx;
        const col = startCol + i * dy;
        if (row < 0 || row >= size || col < 0 || col >= size) {
            return false;
        }
        const cellKey = `${row},${col}`;
        if (usedCells.has(cellKey)) {
            if (board[row][col] !== word[i]) {
                return false;
            }
        }
    }
    return true;
}

// Đếm số xung đột khi đặt từ, ưu tiên chồng chéo hợp lệ
function countConflicts(board, word, startRow, startCol, dx, dy) {
    let conflicts = 0;
    let overlaps = 0;
    for (let i = 0; i < word.length; i++) {
        const row = startRow + i * dx;
        const col = startCol + i * dy;
        if (board[row][col] !== '') {
            if (board[row][col] !== word[i]) {
                conflicts++;
            } else {
                overlaps++;
            }
        }
    }
    return conflicts - overlaps * 0.8; // Khuyến khích chồng chéo hợp lệ
}

// In lưới ra console để kiểm tra
function printBoard(board) {
    console.log("Current Grid:");
    const header = "   " + [...Array(board[0].length).keys()].map(i => String(i).padStart(2, ' ')).join(' ');
    console.log(header);
    board.forEach((row, idx) => {
        console.log(String(idx).padStart(2, ' ') + ' ' + row.join('  '));
    });
}

// 5. Hiển thị lưới ô chữ: Vẽ lưới lên giao diện
// Hàm này tạo các ô div để hiển thị lưới ô chữ
function renderBoard(board) {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${board.length}, 30px)`; // Đặt số cột cho lưới
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board.length; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.textContent = board[row][col];
            cell.dataset.row = row;
            cell.dataset.col = col;
            boardElement.appendChild(cell);
        }
    }
}

// 6. Xử lý nhập từ: Tìm từ người chơi nhập bằng DFS
// Hàm này kiểm tra từ nhập vào và tô màu nếu tìm thấy
function findWordDFS(board, word) {
    const boardSize = board.length;
    const visited = Array(boardSize).fill().map(() => Array(boardSize).fill(false));
    const path = [];
    
    console.log(`Searching for "${word}" in the grid...`);
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] === word[0]) {
                path.length = 0;
                const found = dfs(row, col, 0);
                if (found && isValidPath(path)) {
                    console.log(`Found "${word}" at path:`, path);
                    return { found: true, path: path.slice() };
                }
            }
        }
    }
    
    console.log(`Could not find "${word}" in the grid.`);
    printBoard(board);
    return { found: false, path: [] };
    
    function dfs(row, col, index) {
        if (index === word.length) return true;
        if (row < 0 || row >= boardSize || col < 0 || col >= boardSize || 
            visited[row][col] || board[row][col] !== word[index]) return false;
        
        visited[row][col] = true;
        path.push([row, col]);
        
        for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (dfs(newRow, newCol, index + 1)) return true;
        }
        
        visited[row][col] = false;
        path.pop();
        return false;
    }

    function isValidPath(path) {
        if (path.length < 2) return true;
        const [startRow, startCol] = path[0];
        const [endRow, endCol] = path[path.length - 1];
        const dx = endRow - startRow;
        const dy = endCol - startCol;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        if (steps === 0) return path.length === 1;
        if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
        
        const stepX = dx === 0 ? 0 : dx / steps;
        const stepY = dy === 0 ? 0 : dy / steps;
        
        for (let i = 1; i < path.length; i++) {
            const expectedRow = Math.round(startRow + i * stepX);
            const expectedCol = Math.round(startCol + i * stepY);
            const [actualRow, actualCol] = path[i];
            if (actualRow !== expectedRow || actualCol !== expectedCol) return false;
        }
        return true;
    }
}

// Tô màu từ đã tìm thấy trên lưới
function markWordAsFound(word, path) {
    const colorIndex = gameState.foundWords.length % colors.length;
    const wordColor = colors[colorIndex]; // Chọn màu từ mảng colors
    path.forEach(([row, col]) => {
        const cell = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.style.backgroundColor) {
            cell.style.backgroundColor = wordColor;
            cell.style.color = 'white';
        }
    });
    gameState.foundWords.push({ word, path, color: wordColor });
    wordsFoundElement.textContent = `${gameState.foundWords.length}/${gameState.targetWords}`;
    
    const listItem = document.createElement('li');
    const colorIndicator = document.createElement('span');
    colorIndicator.className = 'color-indicator';
    colorIndicator.style.backgroundColor = wordColor;
    listItem.appendChild(colorIndicator);
    listItem.appendChild(document.createTextNode(`${word}: (${path[0][0]},${path[0][1]}) -> (${path[path.length-1][0]},${path[path.length-1][1]})`));
    foundWordsList.appendChild(listItem);
}

// 7. Cung cấp gợi ý: Hiển thị thông tin về từ chưa tìm thấy
// Hàm này chọn ngẫu nhiên từ chưa tìm và tô màu ô đầu tiên
function provideHint() {
    if (!gameState.isGameStarted) {
        alert('Please start the game first!');
        return;
    }
    const foundWordsSet = new Set(gameState.foundWords.map(entry => entry.word));
    const notFoundWords = gameState.placedWords.filter(({ word }) => !foundWordsSet.has(word)); // Lấy từ chưa tìm
    if (notFoundWords.length === 0) {
        alert('No words left to hint! You have found all words.');
        return;
    }
    const randomIndex = Math.floor(Math.random() * notFoundWords.length);
    const { word, start } = notFoundWords[randomIndex];
    const [startRow, startCol] = start;
    const cell = boardElement.querySelector(`[data-row="${startRow}"][data-col="${startCol}"]`);
    if (cell && !cell.style.backgroundColor) {
        cell.style.backgroundColor = '#ffd700';
        cell.style.color = 'black';
    }
    alert(`Hint: A word starts with "${word[0]}" at position (${startRow}, ${startCol}) and has ${word.length} letters.`);
}

// 8. Quản lý thời gian: Đếm ngược thời gian chơi
// Hàm này định dạng thời gian và khởi động đồng hồ đếm ngược
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Hàm khởi động đồng hồ đếm ngược
function startTimer() {
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        timerElement.textContent = formatTime(gameState.timeLeft);
        if (gameState.timeLeft <= 0) {
            endGame(false);
        }
    }, 1000);
}

// 9. Kết thúc trò chơi: Dừng trò chơi và hiển thị kết quả
// Hàm này dừng đồng hồ và hiển thị từ chưa tìm thấy
function endGame(win) {
    clearInterval(gameState.timer);
    gameState.isGameStarted = false;
    wordInputElement.disabled = true;
    hintButton.disabled = true;
    if (!win) {
        markNotFoundWords(); // Hiển thị từ chưa tìm thấy
    }
    alert(win ? 'Congratulations! You found all words!' : 'Time’s up! Try again.');
}

// Tô màu từ chưa tìm thấy khi hết thời gian
function markNotFoundWords() {
    const foundWordsSet = new Set(gameState.foundWords.map(entry => entry.word));
    const notFoundWords = gameState.placedWords.filter(({ word }) => !foundWordsSet.has(word));
    notFoundWordsList.innerHTML = '';
    notFoundWords.forEach(({ word, start, end }) => {
        const result = findWordDFS(gameState.board, word);
        if (result.found) {
            const path = result.path;
            path.forEach(([row, col]) => {
                const cell = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell && !cell.style.backgroundColor) {
                    cell.style.backgroundColor = '#808080';
                    cell.style.color = 'white';
                }
            });
            const listItem = document.createElement('li');
            const colorIndicator = document.createElement('span');
            colorIndicator.className = 'color-indicator';
            colorIndicator.style.backgroundColor = '#808080';
            listItem.appendChild(colorIndicator);
            listItem.appendChild(document.createTextNode(`${word}: (${start[0]},${start[1]}) -> (${end[0]},${end[1]})`));
            notFoundWordsList.appendChild(listItem);
        } else {
            console.error(`Failed to re-find word "${word}" in the grid during markNotFoundWords.`);
        }
    });
}

// 10. Bắt đầu trò chơi mới: Reset trạng thái trò chơi
// Hàm này xóa trạng thái cũ và cho phép bắt đầu lại
newGameButton.addEventListener('click', () => {
    clearInterval(gameState.timer);
    gameState.isGameStarted = false;
    wordInputElement.disabled = true;
    hintButton.disabled = true;
    startGameButton.disabled = false;
    newGameButton.disabled = true;
    gameState.foundWords = [];
    gameState.placedWords = [];
    foundWordsList.innerHTML = '';
    notFoundWordsList.innerHTML = '';
    wordsFoundElement.textContent = `0/${gameState.targetWords}`;
    timerElement.textContent = formatTime(parseInt(timeLimitInput.value) * 60);
});

// Xử lý sự kiện bắt đầu trò chơi
startGameButton.addEventListener('click', async () => {
    if (gameState.englishWords.length === 0) {
        await loadEnglishWords();
    }
    const size = parseInt(boardSizeSelect.value);
    const difficulty = difficultySelect.value;
    console.log("Selected difficulty:", difficulty);
    const timeLimit = parseInt(timeLimitInput.value) * 60;
    gameState.boardSize = size;
    gameState.timeLeft = timeLimit;
    gameState.foundWords = [];
    gameState.placedWords = [];
    gameState.isGameStarted = true;
    gameState.words = selectRandomWords(difficulty);
    gameState.board = generateBoard(size, gameState.words);
    renderBoard(gameState.board);
    foundWordsList.innerHTML = '';
    notFoundWordsList.innerHTML = '';
    wordInputElement.disabled = false;
    hintButton.disabled = false;
    wordInputElement.focus();
    timerElement.textContent = formatTime(timeLimit);
    wordsFoundElement.textContent = `0/${gameState.targetWords}`;
    startTimer(); // Khởi động đồng hồ đếm ngược
    startGameButton.disabled = true;
    newGameButton.disabled = false;
});

// Xử lý sự kiện nhấn nút gợi ý
hintButton.addEventListener('click', () => {
    provideHint();
});

// Xử lý sự kiện nhập từ
wordInputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && gameState.isGameStarted) {
        const word = wordInputElement.value.toUpperCase().trim();
        if (word && !gameState.foundWords.some(entry => entry.word === word)) {
            if (gameState.englishWords.includes(word)) {
                const result = findWordDFS(gameState.board, word);
                if (result.found) {
                    markWordAsFound(word, result.path);
                } else {
                    alert('Word not found in the grid!');
                }
            } else {
                alert('Not a valid English word!');
            }
        } else {
            alert('Word already found or invalid!');
        }
        wordInputElement.value = '';
    }
});