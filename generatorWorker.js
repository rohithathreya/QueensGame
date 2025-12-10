self.onmessage = function (event) {
  const { difficulty } = event.data || {};
  if (!difficulty) {
    postMessage({ status: 'error', message: 'Missing difficulty' });
    return;
  }
  try {
    // game.js defines PuzzleGenerator globally; ensure it's loaded
    if (typeof PuzzleGenerator === 'undefined') {
      if (typeof importScripts === 'function') {
        importScripts('game.js');
      }
    }
    if (typeof PuzzleGenerator === 'undefined') {
      postMessage({ status: 'error', message: 'PuzzleGenerator unavailable' });
      return;
    }

    const puzzle = PuzzleGenerator.generate(difficulty);

    // Belt-and-suspenders logical verification inside worker to avoid leaking any bad puzzle
    if (typeof LogicalSolver !== 'undefined') {
      const solver = new LogicalSolver(puzzle.size, puzzle.regions, puzzle.solution);
      const check = solver.solveLogically({ allowNishio: true, stepLimit: 1500 });
      if (!check.solved) {
        postMessage({ status: 'error', message: 'Generated puzzle failed logical verify, retry.' });
        return;
      }
    }

    postMessage({
      status: 'ok',
      puzzle: {
        size: puzzle.size,
        regions: puzzle.regions,
        solution: puzzle.solution
      }
    });
  } catch (err) {
    postMessage({ status: 'error', message: err?.message || 'Generation failed' });
  }
};

