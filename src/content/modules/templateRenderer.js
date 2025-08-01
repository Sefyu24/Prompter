/**
 * @fileoverview Template rendering and search functionality
 * @author Prompter Extension
 * @since 1.0.0
 */

import { escapeHtml } from "../utils.js";
import { CSS_CLASSES } from "../constants.js";

/**
 * @typedef {import('../types.js').Template} Template
 */

/**
 * Manages template rendering and search functionality
 * @class TemplateRenderer
 */
export class TemplateRenderer {
  constructor() {
    /** @type {Template[]} */
    this.allTemplates = [];

    /** @type {Template[]} */
    this.filteredTemplates = [];

    /** @type {number} */
    this.selectedIndex = 0;
  }

  /**
   * Sets the templates to be rendered
   * @param {Template[]} templates - Array of templates
   * @returns {void}
   */
  setTemplates(templates) {
    this.allTemplates = templates || [];
    this.filteredTemplates = [...this.allTemplates];
    this.selectedIndex = 0;
  }

  /**
   * Filters templates based on search query
   * @param {string} query - Search query
   * @returns {Template[]} Filtered templates
   * @example
   * ```javascript
   * const results = renderer.filterTemplates('json');
   * ```
   */
  filterTemplates(query) {
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery === "") {
      this.filteredTemplates = [...this.allTemplates];
    } else {
      this.filteredTemplates = this.allTemplates.filter((template) =>
        this.templateMatchesQuery(template, normalizedQuery)
      );
    }

    this.selectedIndex = 0;
    return this.filteredTemplates;
  }

  /**
   * Checks if a template matches the search query
   * @param {Template} template - Template to check
   * @param {string} query - Normalized search query
   * @returns {boolean} True if template matches
   * @private
   */
  templateMatchesQuery(template, query) {
    const searchFields = [
      template.name,
      template.description,
      template.templateType || template.template_type,
      template.promptTemplate || template.prompt_template,
    ];

    return searchFields.some(
      (field) => field && field.toLowerCase().includes(query)
    );
  }

  /**
   * Renders the template list HTML
   * @returns {string} HTML string for template list
   */
  renderTemplateList() {
    if (this.filteredTemplates.length === 0) {
      return this.renderEmptyState();
    }

    return this.filteredTemplates
      .map((template, index) => this.renderTemplateItem(template, index))
      .join("");
  }

  /**
   * Renders a single template item
   * @param {Template} template - Template to render
   * @param {number} index - Template index in filtered list
   * @returns {string} HTML string for template item
   * @private
   */
  renderTemplateItem(template, index) {
    const templateType = this.getTemplateType(template);
    const isSelected = index === this.selectedIndex;
    const quickSelectNumber = index + 1;

    return `
      <div class="${CSS_CLASSES.TEMPLATE_ITEM} ${
      isSelected ? CSS_CLASSES.TEMPLATE_SELECTED : ""
    }" 
           data-index="${index}"
           data-template-id="${escapeHtml(template.id)}"
           role="option"
           aria-selected="${isSelected}"
           tabindex="${isSelected ? 0 : -1}">
        <div class="prompter-template-content">
          <div class="prompter-template-header">
            <div class="prompter-template-name" title="${escapeHtml(
              template.name
            )}">
              ${this.renderSourceIndicator(template)}${escapeHtml(template.name)}
            </div>
            <div class="prompter-template-badges">
              ${this.renderSourceBadge(template)}
              <span class="prompter-type-badge prompter-type-${templateType.toLowerCase()}" 
                    title="Template type: ${templateType}">
                ${templateType.toUpperCase()}
              </span>
            </div>
          </div>
          ${this.renderTemplateDescription(template)}
        </div>
        <div class="prompter-template-number" title="Press ${quickSelectNumber} to select">
          ${quickSelectNumber <= 9 ? quickSelectNumber : ""}
        </div>
      </div>
    `;
  }

  /**
   * Renders template description if available
   * @param {Template} template - Template object
   * @returns {string} HTML string for description or empty string
   * @private
   */
  renderTemplateDescription(template) {
    const description = template.description;
    if (!description || description.trim() === "") {
      return "";
    }

    const truncatedDescription = this.truncateText(description, 120);
    return `
      <div class="prompter-template-description" title="${escapeHtml(
        description
      )}">
        ${escapeHtml(truncatedDescription)}
      </div>
    `;
  }

  /**
   * Gets the template type with fallbacks
   * @param {Template} template - Template object
   * @returns {string} Template type
   * @private
   */
  getTemplateType(template) {
    return template.templateType || template.template_type || "text";
  }

  /**
   * Renders source indicator prefix for template name
   * @param {Template} template - Template object
   * @returns {string} HTML string for source indicator
   * @private
   */
  renderSourceIndicator(template) {
    if (template.source === 'promptr') {
      return template.isFree === false ? '🔒 ' : '✨ ';
    }
    return ''; // No indicator for user templates
  }

  /**
   * Renders source badge for template
   * @param {Template} template - Template object
   * @returns {string} HTML string for source badge
   * @private
   */
  renderSourceBadge(template) {
    if (template.source === 'promptr') {
      const badgeClass = template.isFree === false ? 'prompter-source-badge-pro' : 'prompter-source-badge-free';
      const badgeText = template.isFree === false ? 'PRO' : 'FREE';
      const badgeTitle = template.isFree === false ? 'Pro template - requires Pro subscription' : 'Free promptr template';
      
      return `
        <span class="prompter-source-badge ${badgeClass}" 
              title="${badgeTitle}">
          ${badgeText}
        </span>
      `;
    }
    return ''; // No badge for user templates
  }

  /**
   * Truncates text to specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   * @private
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Renders empty state when no templates match
   * @returns {string} HTML string for empty state
   * @private
   */
  renderEmptyState() {
    return `
      <div class="prompter-empty" role="status">
        <div>No templates found</div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
          Try adjusting your search terms
        </div>
      </div>
    `;
  }

  /**
   * Renders loading state
   * @returns {string} HTML string for loading state
   */
  renderLoadingState() {
    return `
      <div class="prompter-loading" role="status" aria-live="polite">
        <div>Formatting text...</div>
      </div>
    `;
  }

  /**
   * Renders text replacement progress state
   * @returns {string} HTML string for replacement progress
   */
  renderReplacementProgress() {
    return `
      <div class="prompter-loading" role="status" aria-live="polite">
        <div>Replacing text...</div>
      </div>
    `;
  }

  /**
   * Renders success state
   * @returns {string} HTML string for success state
   */
  renderSuccessState() {
    return `
      <div class="prompter-success" role="status" aria-live="polite">
        <div class="prompter-success-content">✅ Text replaced successfully!</div>
      </div>
    `;
  }

  /**
   * Moves selection up or down
   * @param {number} direction - Direction to move (-1 for up, 1 for down)
   * @returns {boolean} True if selection changed
   */
  moveSelection(direction) {
    const newIndex = this.selectedIndex + direction;

    if (newIndex >= 0 && newIndex < this.filteredTemplates.length) {
      this.selectedIndex = newIndex;
      return true;
    }

    return false;
  }

  /**
   * Gets the currently selected template
   * @returns {Template|null} Selected template or null if none
   */
  getSelectedTemplate() {
    if (
      this.selectedIndex >= 0 &&
      this.selectedIndex < this.filteredTemplates.length
    ) {
      return this.filteredTemplates[this.selectedIndex];
    }
    return null;
  }

  /**
   * Selects template by index
   * @param {number} index - Index to select
   * @returns {boolean} True if selection was successful
   */
  selectByIndex(index) {
    if (index >= 0 && index < this.filteredTemplates.length) {
      this.selectedIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Gets template by quick select number (1-9)
   * @param {number} number - Quick select number (1-9)
   * @returns {Template|null} Template or null if not found
   */
  getTemplateByQuickSelect(number) {
    const index = number - 1;
    if (index >= 0 && index < this.filteredTemplates.length && index <= 8) {
      return this.filteredTemplates[index];
    }
    return null;
  }

  /**
   * Gets the current selection state
   * @returns {{selectedIndex: number, selectedTemplate: Template|null, totalCount: number}}
   */
  getSelectionState() {
    return {
      selectedIndex: this.selectedIndex,
      selectedTemplate: this.getSelectedTemplate(),
      totalCount: this.filteredTemplates.length,
    };
  }

  /**
   * Resets the renderer state
   * @returns {void}
   */
  reset() {
    this.allTemplates = [];
    this.filteredTemplates = [];
    this.selectedIndex = 0;
  }

  /**
   * Gets statistics about templates
   * @returns {{total: number, filtered: number, types: Object<string, number>}}
   */
  getStatistics() {
    const types = {};
    this.allTemplates.forEach((template) => {
      const type = this.getTemplateType(template);
      types[type] = (types[type] || 0) + 1;
    });

    return {
      total: this.allTemplates.length,
      filtered: this.filteredTemplates.length,
      types,
    };
  }
}

// Create a singleton instance
export const templateRenderer = new TemplateRenderer();
