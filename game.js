const puzzle = {
  size: 7,
  rows: [
    "CODE#AI",
    "A######",
    "STACK##",
    "H###BOT",
    "#FUN###",
    "WEB#NET",
    "ARENA##"
  ],
  clues: [
    { id: "1A", dir: "across", number: 1, answer: "CODE", cells: [[0, 0], [0, 1], [0, 2], [0, 3]], clue: "Computer instructions." },
    { id: "2A", dir: "across", number: 2, answer: "AI", cells: [[0, 5], [0, 6]], clue: "Short for artificial intelligence." },
    { id: "3A", dir: "across", number: 3, answer: "STACK", cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], clue: "A pile of things." },
    { id: "4A", dir: "across", number: 4, answer: "BOT", cells: [[3, 4], [3, 5], [3, 6]], clue: "A computer-controlled player." },
    { id: "5A", dir: "across", number: 5, answer: "FUN", cells: [[4, 1], [4, 2], [4, 3]], clue: "The opposite of boring." },
    { id: "6A", dir: "across", number: 6, answer: "WEB", cells: [[5, 0], [5, 1], [5, 2]], clue: "The internet." },
    { id: "7A", dir: "across", number: 7, answer: "NET", cells: [[5, 4], [5, 5], [5, 6]], clue: "Another word for the internet." },
    { id: "8A", dir: "across", number: 8, answer: "ARENA", cells: [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4]], clue: "A place where players compete." },
    { id: "1D", dir: "down", number: 1, answer: "CASH", cells: [[0, 0], [1, 0], [2, 0], [3, 0]], clue: "Money." }
  ]
};

const players = [
  createPlayer("p1"),
  createPlayer("p2")
];

const state = {
  current: 0,
  selected: { player: 0, row: 0, col: 0 },
  selectedClueId: "1A",
  enemyTarget: null,
  clueDirection: "across",
  turnUsed: false,
  winner: null
};

const els = {
  turnName: document.querySelector("#turnName"),
  phaseText: document.querySelector("#phaseText"),
  panels: [document.querySelector("#panel-p1"), document.querySelector("#panel-p2")],
  boards: [document.querySelector("#board-p1"), document.querySelector("#board-p2")],
  scores: [document.querySelector("#score-p1"), document.querySelector("#score-p2")],
  clueList: document.querySelector("#clueList"),
  letterInput: document.querySelector("#letterInput"),
  placeButton: document.querySelector("#placeButton"),
  endTurnButton: document.querySelector("#endTurnButton"),
  resetButton: document.querySelector("#resetButton"),
  playAgainButton: document.querySelector("#playAgainButton"),
  winModal: document.querySelector("#winModal"),
  winTitle: document.querySelector("#winTitle"),
  winText: document.querySelector("#winText"),
  logList: document.querySelector("#logList"),
  tabs: {
    across: document.querySelector("#acrossTab"),
    down: document.querySelector("#downTab")
  }
};

function createPlayer(id) {
  return {
    id,
    grid: puzzle.rows.map(row => row.split("").map(char => char === "#" ? "#" : "")),
    inked: new Set(),
    locked: new Set(),
    usedSabotage: new Set()
  };
}

function key(row, col) {
  return `${row},${col}`;
}

function render() {
  players.forEach((player, index) => {
    renderBoard(player, index);
    els.scores[index].textContent = `${countCorrect(player)} / ${totalPlayable()}`;
    els.panels[index].classList.toggle("active", index === state.current);
    els.panels[index].classList.toggle("hidden-board", index !== state.current);
  });

  els.turnName.textContent = `Player ${state.current + 1}`;
  els.phaseText.textContent = state.turnUsed
    ? "Action used. End the turn to switch boards."
    : "Place one word or use one sabotage.";
  els.placeButton.disabled = state.turnUsed || state.winner !== null || selectedClue() === null;
  els.endTurnButton.disabled = state.winner !== null;
  document.querySelectorAll(".sabotage").forEach(button => {
    const used = players[state.current].usedSabotage.has(button.dataset.sabotage);
    button.disabled = state.turnUsed || used || state.winner !== null;
  });

  renderClues();
}

function renderBoard(player, playerIndex) {
  const board = els.boards[playerIndex];
  board.innerHTML = "";

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = "cell";
      square.dataset.player = String(playerIndex);
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (puzzle.rows[row][col] === "#") {
        square.classList.add("black");
        square.disabled = true;
      } else {
        const number = clueNumberAt(row, col);
        if (number) {
          const marker = document.createElement("span");
          marker.className = "number";
          marker.textContent = number;
          square.appendChild(marker);
        }

        square.append(player.grid[row][col]);
        square.classList.toggle("selected", state.selected.player === playerIndex && state.selected.row === row && state.selected.col === col);
        square.classList.toggle("word-selected", playerIndex === state.current && isInSelectedClue(row, col));
        square.classList.toggle("enemy-target", state.enemyTarget?.player === playerIndex && state.enemyTarget.row === row && state.enemyTarget.col === col);
        square.classList.toggle("locked", player.locked.has(key(row, col)));
        square.classList.toggle("inked", player.inked.has(key(row, col)));
        square.addEventListener("click", () => selectCell(playerIndex, row, col));
      }

      board.appendChild(square);
    }
  }
}

function clueNumberAt(row, col) {
  const clue = puzzle.clues.find(item => item.cells[0][0] === row && item.cells[0][1] === col);
  return clue?.number ?? "";
}

function renderClues() {
  els.clueList.innerHTML = "";
  els.tabs.across.classList.toggle("active", state.clueDirection === "across");
  els.tabs.down.classList.toggle("active", state.clueDirection === "down");

  puzzle.clues
    .filter(clue => clue.dir === state.clueDirection)
    .forEach(clue => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clue";
      button.classList.toggle("complete", isClueComplete(players[state.current], clue));
      button.classList.toggle("active", clue.id === state.selectedClueId);
      button.innerHTML = `<strong>${clue.number}</strong><span>${clue.clue}</span>`;
      button.addEventListener("click", () => selectClue(clue));
      els.clueList.appendChild(button);
    });
}

function selectedClue() {
  return puzzle.clues.find(clue => clue.id === state.selectedClueId) ?? null;
}

function isInSelectedClue(row, col) {
  const clue = selectedClue();
  return clue?.cells.some(([clueRow, clueCol]) => clueRow === row && clueCol === col) ?? false;
}

function selectClue(clue) {
  state.selectedClueId = clue.id;
  state.clueDirection = clue.dir;
  state.selected = { player: state.current, row: clue.cells[0][0], col: clue.cells[0][1] };
  state.enemyTarget = null;
  render();
}

function clueForCell(row, col) {
  const clues = puzzle.clues.filter(clue => clue.cells.some(([clueRow, clueCol]) => clueRow === row && clueCol === col));
  return clues.find(clue => clue.dir === state.clueDirection) ?? clues[0] ?? null;
}

function selectCell(playerIndex, row, col) {
  if (puzzle.rows[row][col] === "#") {
    return;
  }

  if (playerIndex === state.current) {
    state.selected = { player: playerIndex, row, col };
    const clue = clueForCell(row, col);
    if (clue) {
      state.selectedClueId = clue.id;
      state.clueDirection = clue.dir;
    }
    state.enemyTarget = null;
  } else {
    state.enemyTarget = { player: playerIndex, row, col };
  }

  render();
}

function placeWord() {
  if (state.turnUsed || state.winner !== null) {
    return;
  }

  const clue = selectedClue();
  const word = els.letterInput.value.trim().toUpperCase();
  const currentPlayer = players[state.current];

  if (!clue) {
    addLog("Select a clue before placing a word.");
    return;
  }

  if (!/^[A-Z]+$/.test(word)) {
    addLog("Type a word first.");
    return;
  }

  if (word.length !== clue.answer.length) {
    addLog(`${clue.id} needs ${clue.answer.length} letters.`);
    return;
  }

  const lockedCell = clue.cells.find(([row, col]) => currentPlayer.locked.has(key(row, col)));
  if (lockedCell) {
    addLog("That word crosses a locked square.");
    return;
  }

  clue.cells.forEach(([row, col], index) => {
    currentPlayer.grid[row][col] = word[index];
    currentPlayer.inked.delete(key(row, col));
  });

  state.turnUsed = true;
  els.letterInput.value = "";

  if (word === clue.answer) {
    addLog(`Player ${state.current + 1} placed ${clue.id}: ${word}.`);
  } else {
    addLog(`Player ${state.current + 1} dropped ${word} into ${clue.id}.`);
  }

  advanceClueSelection();
  checkWinner();
  if (state.winner === null) {
    endTurn();
    return;
  }
  render();
}

function advanceClueSelection() {
  state.selected = firstOpenCell(state.current);
  const nextClue = clueForCell(state.selected.row, state.selected.col);
  if (nextClue) {
    state.selectedClueId = nextClue.id;
    state.clueDirection = nextClue.dir;
  }
}

function sabotage(type) {
  if (state.turnUsed || state.winner !== null) {
    return;
  }

  const actor = players[state.current];
  const enemyIndex = state.current === 0 ? 1 : 0;
  const enemy = players[enemyIndex];

  if (actor.usedSabotage.has(type)) {
    return;
  }

  if (type === "ink") {
    randomPlayableCells(enemy, 3).forEach(cell => enemy.inked.add(key(cell.row, cell.col)));
    addLog(`Player ${state.current + 1} spilled ink across Player ${enemyIndex + 1}'s grid.`);
  }

  if (type === "swap") {
    const filled = randomFilledCells(enemy, 2);
    if (filled.length < 2) {
      addLog("Letter Swap needs two filled enemy squares.");
      return;
    }
    const first = filled[0];
    const second = filled[1];
    const temp = enemy.grid[first.row][first.col];
    enemy.grid[first.row][first.col] = enemy.grid[second.row][second.col];
    enemy.grid[second.row][second.col] = temp;
    addLog(`Player ${state.current + 1} swapped two of Player ${enemyIndex + 1}'s letters.`);
  }

  if (type === "block") {
    const target = state.enemyTarget?.player === enemyIndex ? state.enemyTarget : randomPlayableCells(enemy, 1)[0];
    enemy.locked.add(key(target.row, target.col));
    addLog(`Player ${state.current + 1} locked one square on Player ${enemyIndex + 1}'s board.`);
  }

  actor.usedSabotage.add(type);
  state.turnUsed = true;
  endTurn();
}

function endTurn() {
  if (state.winner !== null) {
    return;
  }

  const player = players[state.current];
  player.inked.clear();
  player.locked.clear();
  state.current = state.current === 0 ? 1 : 0;
  state.selected = firstOpenCell(state.current);
  const nextClue = clueForCell(state.selected.row, state.selected.col);
  state.selectedClueId = nextClue?.id ?? "1A";
  state.clueDirection = nextClue?.dir ?? "across";
  state.enemyTarget = null;
  state.turnUsed = false;
  addLog(`Board control switches to Player ${state.current + 1}.`);
  render();
}

function firstOpenCell(playerIndex) {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.rows[row][col] !== "#" && players[playerIndex].grid[row][col] !== puzzle.rows[row][col]) {
        return { player: playerIndex, row, col };
      }
    }
  }
  return { player: playerIndex, row: 0, col: 0 };
}

function randomPlayableCells(player, count) {
  const cells = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.rows[row][col] !== "#") {
        cells.push({ row, col });
      }
    }
  }
  return shuffle(cells).slice(0, count);
}

function randomFilledCells(player, count) {
  const cells = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.rows[row][col] !== "#" && player.grid[row][col]) {
        cells.push({ row, col });
      }
    }
  }
  return shuffle(cells).slice(0, count);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function countCorrect(player) {
  let correct = 0;
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.rows[row][col] !== "#" && player.grid[row][col] === puzzle.rows[row][col]) {
        correct += 1;
      }
    }
  }
  return correct;
}

function totalPlayable() {
  return puzzle.rows.join("").replaceAll("#", "").length;
}

function isClueComplete(player, clue) {
  return clue.cells.every(([row, col], index) => player.grid[row][col] === clue.answer[index]);
}

function checkWinner() {
  const complete = countCorrect(players[state.current]) === totalPlayable();
  if (!complete) {
    return;
  }

  state.winner = state.current;
  els.winTitle.textContent = `Player ${state.current + 1} Wins`;
  els.winText.textContent = "The daily word-game throne has been taken by force, timing, and a little sabotage.";
  els.winModal.classList.remove("hidden");
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  els.logList.prepend(item);
  while (els.logList.children.length > 8) {
    els.logList.lastElementChild.remove();
  }
}

function resetGame() {
  players.splice(0, players.length, createPlayer("p1"), createPlayer("p2"));
  state.current = 0;
  state.selected = { player: 0, row: 0, col: 0 };
  state.selectedClueId = "1A";
  state.enemyTarget = null;
  state.clueDirection = "across";
  state.turnUsed = false;
  state.winner = null;
  els.logList.innerHTML = "";
  els.winModal.classList.add("hidden");
  addLog("The match begins. Player 1 has the board.");
  render();
}

els.placeButton.addEventListener("click", placeWord);
els.endTurnButton.addEventListener("click", endTurn);
els.resetButton.addEventListener("click", resetGame);
els.playAgainButton.addEventListener("click", resetGame);
els.letterInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    placeWord();
  }
});
els.letterInput.addEventListener("input", () => {
  els.letterInput.value = els.letterInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
});
els.tabs.across.addEventListener("click", () => {
  state.clueDirection = "across";
  render();
});
els.tabs.down.addEventListener("click", () => {
  state.clueDirection = "down";
  render();
});
document.querySelectorAll(".sabotage").forEach(button => {
  button.addEventListener("click", () => sabotage(button.dataset.sabotage));
});

resetGame();
