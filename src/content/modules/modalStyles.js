/**
 * @fileoverview Modal styling module - handles all CSS for modal components
 * @author Promptr Extension
 * @since 1.0.0
 */

import { CSS_CLASSES, Z_INDEX, COLORS } from "../constants.js";

/**
 * Manages modal CSS styles and injection
 * @class ModalStyleManager
 */
export class ModalStyleManager {
  constructor() {
    /** @type {boolean} */
    this.stylesInjected = false;
  }

  /**
   * Ensures modal styles are added to the page
   * @returns {void}
   */
  ensureModalStyles() {
    if (this.stylesInjected) return;

    const styleId = CSS_CLASSES.MODAL_STYLES;
    if (document.getElementById(styleId)) {
      this.stylesInjected = true;
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = this.getModalCSS();

    document.head.appendChild(style);
    this.stylesInjected = true;
  }

  /**
   * Gets the complete CSS for modal components
   * @returns {string} CSS content
   * @private
   */
  getModalCSS() {
    return `
      ${this.getFontImports()}
      ${this.getModalOverlayStyles()}
      ${this.getModalContentStyles()}
      ${this.getHeaderStyles()}
      ${this.getSearchStyles()}
      ${this.getTemplateListStyles()}
      ${this.getTemplateItemStyles()}
      ${this.getTypeBadgeStyles()}
      ${this.getFooterStyles()}
      ${this.getAnimationStyles()}
    `;
  }

  /**
   * Font imports for modal
   * @returns {string} CSS font imports
   * @private
   */
  getFontImports() {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap');
    `;
  }

  /**
   * Modal overlay styles
   * @returns {string} CSS for modal overlay
   * @private
   */
  getModalOverlayStyles() {
    return `
      .${CSS_CLASSES.MODAL_OVERLAY} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: ${Z_INDEX.MODAL_OVERLAY};
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Plus Jakarta Sans', sans-serif;
        letter-spacing: -0.025em;
      }
    `;
  }

  /**
   * Modal content container styles
   * @returns {string} CSS for modal content
   * @private
   */
  getModalContentStyles() {
    return `
      .${CSS_CLASSES.MODAL} {
        background: oklch(0.994 0 0);
        border: 1px solid oklch(0.93 0.0094 286.2156);
        border-radius: 1.4rem;
        box-shadow: 0px 8px 10px -1px hsl(0 0% 0% / 0.16), 0px 2px 3px 0px hsl(0 0% 0% / 0.16);
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
        overflow: hidden;
        animation: prompter-modal-enter 0.2s ease-out;
      }
    `;
  }

  /**
   * Modal header styles
   * @returns {string} CSS for modal header
   * @private
   */
  getHeaderStyles() {
    return `
      .prompter-header {
        padding: 20px 20px 16px;
        border-bottom: 1px solid oklch(0.93 0.0094 286.2156);
      }

      .prompter-header h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 600;
        color: oklch(0 0 0);
      }
    `;
  }

  /**
   * Search input styles
   * @returns {string} CSS for search input
   * @private
   */
  getSearchStyles() {
    return `
      .prompter-search {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid oklch(0.93 0.0094 286.2156);
        border-radius: calc(1.4rem - 8px);
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        background: oklch(0.9401 0 0);
        color: oklch(0 0 0);
        font-family: 'Plus Jakarta Sans', sans-serif;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .prompter-search:focus {
        border-color: ${COLORS.INFO};
        box-shadow: 0 0 0 3px oklch(0.5393 0.2713 286.7462 / 0.1);
      }

      .prompter-search::placeholder {
        color: oklch(0.6 0 0);
      }
    `;
  }

  /**
   * Template list container styles
   * @returns {string} CSS for template list
   * @private
   */
  getTemplateListStyles() {
    return `
      .prompter-template-list {
        max-height: 300px;
        overflow-y: auto;
        padding: 8px;
        scrollbar-width: thin;
        scrollbar-color: oklch(0.7 0 0) transparent;
      }

      .prompter-template-list::-webkit-scrollbar {
        width: 6px;
      }

      .prompter-template-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .prompter-template-list::-webkit-scrollbar-thumb {
        background-color: oklch(0.7 0 0);
        border-radius: 3px;
      }

      .prompter-empty {
        text-align: center;
        padding: 40px 20px;
        color: oklch(0.4386 0 0);
        font-size: 14px;
      }
    `;
  }

  /**
   * Template item styles
   * @returns {string} CSS for template items
   * @private
   */
  getTemplateItemStyles() {
    return `
      .${CSS_CLASSES.TEMPLATE_ITEM} {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        margin: 4px 0;
        border-radius: calc(1.4rem - 6px);
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
        background: oklch(0.994 0 0);
        border: 1px solid transparent;
      }

      .${CSS_CLASSES.TEMPLATE_ITEM}:hover {
        background-color: oklch(0.9702 0);
        border: 1px solid oklch(0.93 0.0094 286.2156);
        box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.08);
        transform: translateY(-1px);
      }

      .${CSS_CLASSES.TEMPLATE_ITEM}.${CSS_CLASSES.TEMPLATE_SELECTED} {
        background-color: oklch(0.9393 0.0288 266.368);
        border-color: ${COLORS.INFO};
        box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16);
        transform: translateY(-1px);
      }

      .prompter-template-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2px;
        width: 100%;
      }

      .prompter-template-name {
        font-weight: 500;
        color: oklch(0 0 0);
        flex: 1;
        font-size: 14px;
      }

      .prompter-template-badges {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .prompter-source-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .prompter-source-badge-free {
        background: oklch(0.5568 0.2294 142.495 / 0.15);
        color: oklch(0.5568 0.2294 142.495);
      }

      .prompter-source-badge-pro {
        background: oklch(0.5393 0.2713 286.7462 / 0.15);
        color: oklch(0.5393 0.2713 286.7462);
      }

      .prompter-template-description {
        font-size: 13px;
        color: oklch(0.4386 0 0);
        flex: 1;
        margin-top: 2px;
        line-height: 1.3;
      }

      .prompter-template-number {
        position: absolute;
        top: 8px;
        right: 8px;
        background: oklch(0.9702 0 0);
        color: oklch(0.4386 0 0);
        font-size: 11px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: calc(1.4rem - 10px);
        min-width: 16px;
        text-align: center;
        transition: all 0.15s ease;
      }

      .${CSS_CLASSES.TEMPLATE_ITEM}.${CSS_CLASSES.TEMPLATE_SELECTED} .prompter-template-number {
        background: ${COLORS.INFO};
        color: ${COLORS.WHITE};
      }
    `;
  }

  /**
   * Type badge styles for different template types
   * @returns {string} CSS for type badges
   * @private
   */
  getTypeBadgeStyles() {
    return `
      .prompter-type-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all 0.15s ease;
      }

      .prompter-type-json {
        background: oklch(0.4792 0.2202 231.6067 / 0.1);
        color: oklch(0.4792 0.2202 231.6067);
      }

      .prompter-type-xml {
        background: oklch(0.5568 0.2294 142.495 / 0.1);
        color: oklch(0.5568 0.2294 142.495);
      }

      .prompter-type-markdown {
        background: oklch(0.5393 0.2713 286.7462 / 0.1);
        color: oklch(0.5393 0.2713 286.7462);
      }

      .prompter-type-text {
        background: oklch(0.6 0 0 / 0.1);
        color: oklch(0.6 0 0);
      }
    `;
  }

  /**
   * Modal footer styles
   * @returns {string} CSS for modal footer
   * @private
   */
  getFooterStyles() {
    return `
      .prompter-footer {
        padding: 12px 20px;
        background: oklch(0.9702 0 0);
        border-top: 1px solid oklch(0.93 0.0094 286.2156);
      }

      .prompter-hints {
        font-size: 12px;
        color: oklch(0.4386 0 0);
        text-align: center;
        display: block;
        line-height: 1.4;
      }

      .prompter-loading {
        text-align: center;
        padding: 20px;
        color: oklch(0.4386 0 0);
        font-size: 14px;
      }

      .prompter-loading::after {
        content: '';
        display: inline-block;
        width: 20px;
        height: 20px;
        margin-left: 8px;
        border: 3px solid oklch(0.7 0 0);
        border-top: 3px solid ${COLORS.INFO};
        border-radius: 50%;
        animation: prompter-loading-spin 1s linear infinite;
      }

      .prompter-success {
        text-align: center;
        padding: 20px;
        color: oklch(0.5568 0.2294 142.495);
        font-size: 14px;
        font-weight: 500;
        animation: prompter-success-fade-in 0.3s ease-out;
      }

      .prompter-success-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
    `;
  }

  /**
   * Animation keyframes
   * @returns {string} CSS animations
   * @private
   */
  getAnimationStyles() {
    return `
      @keyframes prompter-modal-enter {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      @keyframes prompter-modal-exit {
        from {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        to {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
      }

      @keyframes prompter-loading-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes prompter-success-fade-in {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes prompter-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
  }

  /**
   * Removes modal styles from the page
   * @returns {void}
   */
  removeStyles() {
    const existingStyles = document.getElementById(CSS_CLASSES.MODAL_STYLES);
    if (existingStyles) {
      existingStyles.remove();
      this.stylesInjected = false;
    }
  }
}

// Create a singleton instance
export const modalStyleManager = new ModalStyleManager();
