self.onmessage = function (event) {
  const { difficulty } = event.data || {};
  if (!difficulty) {
    postMessage({ status: 'error', message: 'Missing difficulty' });
    return;
  }
  try {
    // game.js defines PuzzleGenerator globally; ensure it's loaded
    if (typeof PuzzleGenerator === 'undefined') {
      // In some bundlers importScripts may not be available; guard.
      if (typeof importScripts === 'function') {
        importScripts('game.js');
      }
    }
    if (typeof PuzzleGenerator === 'undefined') {
      postMessage({ status: 'error', message: 'PuzzleGenerator unavailable' });
      return;
    }

    const puzzle = PuzzleGenerator.generate(difficulty);
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

