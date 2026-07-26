const MOVE_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.justPressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasJustPressed(code) {
    return this.justPressed.has(code);
  }

  // Call once per frame after all systems have read input.
  endFrame() {
    this.justPressed.clear();
  }
}
