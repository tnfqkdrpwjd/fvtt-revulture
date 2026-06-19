import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */

// 수정
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class FvttRevultureItemSheet extends HandlebarsApplicationMixin(
  ItemSheetV2,
) {
  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    actions: {
      effectControl: FvttRevultureItemSheet.prototype.onEffectControl,
      changeTab: FvttRevultureItemSheet.prototype.onChangeTab,
    },
    position: {
      width: 520,
      height: 480,
    },
    window: {
      icon: 'fa-solid fa-suitcase',
      title: 'item.form.title',
    }, // icon도 'item icon'은 placeholder처럼 보여요
    form: {
      submitOnChange: true,
    },
  });

  /** @override */
  static PARTS = {
    sheet: {
      template: 'systems/fvtt-revulture/templates/item/item-sheet.hbs',
    },
  };

  tabGroups = { primary: 'description' };

  _getTabs() {
    const tabs = {
      description: {
        id: 'description',
        group: 'primary',
        label: 'Description',
      },
      attributes: { id: 'attributes', group: 'primary', label: 'Attributes' },
    };
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? 'active' : '';
    }
    return tabs;
  }
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    // Retrieve base data structure.
    const context = await super._prepareContext(options);

    // Use a safe clone of the item data for further operations.
    context.item = this.item;
    context.system = this.item.system;
    context.flags = this.item.flags;

    // Enrich description info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedDescription =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.item.system.description ?? '',
        {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Necessary in v11, can be removed in v12
          // Data to fill in for inline rolls
          rollData: this.item.getRollData(),
          // Relative UUID resolution
          relativeTo: this.item,
        },
      );

    // Add the item's data to context.data for easier access, as well as flags.

    // Adding a pointer to CONFIG.FVTT_REVULTURE
    context.config = CONFIG.FVTT_REVULTURE;

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);

    //get the tabs for the item sheet
    context.tabs = this._getTabs();
    context.editable = this.isEditable;

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    this._activateEditors();
  }

  onEffectControl(event, target) {
    return onManageActiveEffect(event, this.item);
  }

  onChangeTab(event, target) {
    this.tabGroups.primary = target.dataset.tab;
    this.render();
  }

  /**
   * Manually activate ProseMirror editors, since AppV2 no longer does this automatically.
   */
  _activateEditors() {
    const editors = this.element.querySelectorAll('.editor');
    for (const editorDiv of editors) {
      const button = editorDiv.querySelector('.editor-edit');
      const contentDiv = editorDiv.querySelector('.editor-content');
      if (!button || !contentDiv) continue;

      button.addEventListener(
        'click',
        async (event) => {
          event.preventDefault();
          const target = contentDiv.dataset.edit;
          const initialContent = contentDiv.innerHTML;

          button.remove();

          await foundry.applications.ux.ProseMirrorEditor.create(
            contentDiv, // target: 실제 HTMLElement
            initialContent, // content: 초기 HTML 문자열
            {
              document: this.document,
              fieldName: target,
              collaborate: contentDiv.dataset.collaborate === 'true',
            },
          );
        },
        { once: true },
      );
    }
  }
}
