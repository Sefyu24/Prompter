/**
 * @fileoverview Keyboard handling module for modal navigation and shortcuts
 * @author Promptr Extension
 * @since 1.0.0
 */

/**
 * Manages keyboard interactions and shortcuts
 * @class KeyboardHandler
 */
export class KeyboardHandler {
  constructor() {
    /** @type {Map<string, Function>} */
    this.keyHandlers = new Map();

    /** @type {Set<string>} */
    this.pressedKeys = new Set();

    /** @type {boolean} */
    this.isListening = false;
  }

  /**
   * Starts listening for keyboard events
   * @param {HTMLElement} [element=document] - Element to listen on
   * @returns {void}
   */
  startListening(element = document) {
    if (this.isListening) return;

    element.addEventListener("keydown", this.handleKeyDown.bind(this), true);
    element.addEventListener("keyup", this.handleKeyUp.bind(this), true);
    this.isListening = true;
  }

  /**
   * Stops listening for keyboard events
   * @param {HTMLElement} [element=document] - Element to stop listening on
   * @returns {void}
   */
  stopListening(element = document) {
    if (!this.isListening) return;

    element.removeEventListener("keydown", this.handleKeyDown.bind(this), true);
    element.removeEventListener("keyup", this.handleKeyUp.bind(this), true);
    this.isListening = false;
    this.pressedKeys.clear();
  }

  /**
   * Registers a keyboard shortcut handler
   * @param {string} keyCombo - Key combination (e.g., 'ctrl+shift+p', 'escape')
   * @param {Function} handler - Handler function
   * @param {Object} [options={}] - Options for the handler
   * @returns {void}
   * @example
   * ```javascript
   * keyboardHandler.registerShortcut('escape', () => modal.close());
   * keyboardHandler.registerShortcut('ctrl+a', () => selectAll());
   * ```
   */
  registerShortcut(keyCombo, handler, options = {}) {
    const normalizedCombo = this.normalizeKeyCombo(keyCombo);
    this.keyHandlers.set(normalizedCombo, { handler, options });
  }

  /**
   * Unregisters a keyboard shortcut handler
   * @param {string} keyCombo - Key combination to unregister
   * @returns {void}
   */
  unregisterShortcut(keyCombo) {
    const normalizedCombo = this.normalizeKeyCombo(keyCombo);
    this.keyHandlers.delete(normalizedCombo);
  }

  /**
   * Handles keydown events
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {void}
   * @private
   */
  handleKeyDown(event) {
    const key = this.normalizeKey(event.key);
    this.pressedKeys.add(key);

    // Add modifier keys
    if (event.ctrlKey) this.pressedKeys.add("ctrl");
    if (event.shiftKey) this.pressedKeys.add("shift");
    if (event.altKey) this.pressedKeys.add("alt");
    if (event.metaKey) this.pressedKeys.add("meta");

    // Check for registered shortcuts
    const currentCombo = this.getCurrentKeyCombo();
    const handler = this.keyHandlers.get(currentCombo);

    if (handler) {
      const { handler: handlerFn, options } = handler;

      if (options.preventDefault !== false) {
        event.preventDefault();
      }

      if (options.stopPropagation !== false) {
        event.stopPropagation();
      }

      try {
        handlerFn(event);
      } catch (error) {
        console.error("Keyboard handler error:", error);
      }
    }
  }

  /**
   * Handles keyup events
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {void}
   * @private
   */
  handleKeyUp(event) {
    const key = this.normalizeKey(event.key);
    this.pressedKeys.delete(key);

    // Remove modifier keys when released
    if (!event.ctrlKey) this.pressedKeys.delete("ctrl");
    if (!event.shiftKey) this.pressedKeys.delete("shift");
    if (!event.altKey) this.pressedKeys.delete("alt");
    if (!event.metaKey) this.pressedKeys.delete("meta");
  }

  /**
   * Normalizes a key combination string
   * @param {string} keyCombo - Key combination
   * @returns {string} Normalized key combination
   * @private
   */
  normalizeKeyCombo(keyCombo) {
    return keyCombo
      .toLowerCase()
      .split("+")
      .map((key) => key.trim())
      .sort()
      .join("+");
  }

  /**
   * Normalizes a single key
   * @param {string} key - Key to normalize
   * @returns {string} Normalized key
   * @private
   */
  normalizeKey(key) {
    const keyMap = {
      " ": "space",
      arrowup: "up",
      arrowdown: "down",
      arrowleft: "left",
      arrowright: "right",
      control: "ctrl",
      command: "meta",
    };

    const normalized = key.toLowerCase();
    return keyMap[normalized] || normalized;
  }

  /**
   * Gets the current key combination being pressed
   * @returns {string} Current key combination
   * @private
   */
  getCurrentKeyCombo() {
    return Array.from(this.pressedKeys).sort().join("+");
  }

  /**
   * Checks if a specific key is currently pressed
   * @param {string} key - Key to check
   * @returns {boolean} True if key is pressed
   */
  isKeyPressed(key) {
    const normalizedKey = this.normalizeKey(key);
    return this.pressedKeys.has(normalizedKey);
  }

  /**
   * Simulates a key press
   * @param {string} keyCombo - Key combination to simulate
   * @returns {void}
   */
  simulateKeyPress(keyCombo) {
    const normalizedCombo = this.normalizeKeyCombo(keyCombo);
    const handler = this.keyHandlers.get(normalizedCombo);

    if (handler) {
      try {
        handler.handler();
      } catch (error) {
        console.error("Simulated key press error:", error);
      }
    }
  }

  /**
   * Clears all pressed keys (useful for cleanup)
   * @returns {void}
   */
  clearPressedKeys() {
    this.pressedKeys.clear();
  }

  /**
   * Gets all registered shortcuts
   * @returns {string[]} Array of registered key combinations
   */
  getRegisteredShortcuts() {
    return Array.from(this.keyHandlers.keys());
  }

  /**
   * Creates a modal-specific keyboard handler
   * @param {Object} callbacks - Callback functions for modal actions
   * @returns {KeyboardHandler} Configured keyboard handler
   * @static
   */
  static createModalHandler(callbacks) {
    const handler = new KeyboardHandler();

    // Navigation shortcuts
    handler.registerShortcut("down", callbacks.moveDown || (() => {}));
    handler.registerShortcut("up", callbacks.moveUp || (() => {}));
    handler.registerShortcut("tab", callbacks.moveDown || (() => {}));
    handler.registerShortcut("shift+tab", callbacks.moveUp || (() => {}));

    // Selection shortcuts
    handler.registerShortcut("enter", callbacks.select || (() => {}));
    handler.registerShortcut("space", callbacks.select || (() => {}));

    // Quick select shortcuts (1-9)
    for (let i = 1; i <= 9; i++) {
      handler.registerShortcut(i.toString(), () => {
        if (callbacks.quickSelect) {
          callbacks.quickSelect(i);
        }
      });
    }

    // Control shortcuts
    handler.registerShortcut("escape", callbacks.close || (() => {}));
    handler.registerShortcut("ctrl+w", callbacks.close || (() => {}));

    // Search shortcuts
    handler.registerShortcut("ctrl+f", callbacks.focusSearch || (() => {}));
    handler.registerShortcut("/", callbacks.focusSearch || (() => {}), {
      preventDefault: false, // Let the search input handle this
    });

    return handler;
  }

  /**
   * Creates a search input keyboard handler
   * @param {Object} callbacks - Callback functions for search actions
   * @returns {KeyboardHandler} Configured keyboard handler
   * @static
   */
  static createSearchHandler(callbacks) {
    const handler = new KeyboardHandler();

    // Clear search
    handler.registerShortcut("ctrl+k", callbacks.clearSearch || (() => {}));
    handler.registerShortcut("escape", callbacks.clearOrClose || (() => {}));

    // Navigation while in search
    handler.registerShortcut("down", callbacks.moveDown || (() => {}));
    handler.registerShortcut("up", callbacks.moveUp || (() => {}));
    handler.registerShortcut("enter", callbacks.select || (() => {}));

    return handler;
  }

  /**
   * Debounces keyboard events to prevent rapid firing
   * @param {Function} handler - Handler function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced handler
   * @static
   */
  static debounce(handler, delay = 100) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler.apply(this, args), delay);
    };
  }

  /**
   * Throttles keyboard events to limit frequency
   * @param {Function} handler - Handler function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled handler
   * @static
   */
  static throttle(handler, limit = 100) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        handler.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

/**
 * Global keyboard utilities for common operations
 */
export const KeyboardUtils = {
  /**
   * Checks if an element is focusable
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is focusable
   */
  isFocusable(element) {
    if (!element) return false;

    const focusableElements = ["input", "textarea", "button", "select", "a"];

    return (
      focusableElements.includes(element.tagName.toLowerCase()) ||
      element.tabIndex >= 0 ||
      element.contentEditable === "true"
    );
  },

  /**
   * Gets all focusable elements within a container
   * @param {HTMLElement} container - Container element
   * @returns {HTMLElement[]} Array of focusable elements
   */
  getFocusableElements(container) {
    const selector =
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    return Array.from(container.querySelectorAll(selector)).filter(
      (el) => !el.disabled && el.offsetParent !== null
    );
  },

  /**
   * Focuses the next/previous focusable element
   * @param {HTMLElement} currentElement - Currently focused element
   * @param {boolean} reverse - True to focus previous element
   * @returns {boolean} True if focus was moved
   */
  moveFocus(currentElement, reverse = false) {
    const focusableElements = this.getFocusableElements(document.body);
    const currentIndex = focusableElements.indexOf(currentElement);

    if (currentIndex === -1) return false;

    const nextIndex = reverse
      ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
      : (currentIndex + 1) % focusableElements.length;

    focusableElements[nextIndex].focus();
    return true;
  },

  /**
   * Traps focus within a container (useful for modals)
   * @param {HTMLElement} container - Container to trap focus in
   * @returns {Function} Cleanup function to remove trap
   */
  trapFocus(container) {
    const focusableElements = this.getFocusableElements(container);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Return cleanup function
    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  },
};

// Create a global instance for common use
export const globalKeyboardHandler = new KeyboardHandler();
