import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class FvttRevultureActorSheet extends HandlebarsApplicationMixin(
  ActorSheetV2,
) {
  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    actions: {
      itemEdit: FvttRevultureActorSheet.prototype.onItemEdit,
      itemDelete: FvttRevultureActorSheet.prototype.onItemDelete,
      itemCreate: FvttRevultureActorSheet.prototype.onItemCreate,
      roll: FvttRevultureActorSheet.prototype.onRoll,

      changeTab: FvttRevultureActorSheet.prototype.onChangeTab,

      effectCreate: FvttRevultureActorSheet.prototype.onEffectCreate,
      effectToggle: FvttRevultureActorSheet.prototype.onEffectToggle,
      effectEdit: FvttRevultureActorSheet.prototype.onEffectEdit,
      effectDelete: FvttRevultureActorSheet.prototype.onEffectDelete,
    },
    classes: ['fvtt-revulture', 'sheet', 'actor'],
    form: {
      submitOnChange: true,
      submitOnClose: true,
    },
    id: 'fvtt-revulture-actor-sheet',

    position: {
      width: 600,
      height: 600,
    },
    tag: 'form', // The default is "div"
    window: {
      icon: 'fa-solid fa-user', // You can now add an icon to the header //css
      title: 'actor.form.title',
    },
  });

  /** @override */
  static PARTS = {
    sheet: {
      template:
        'systems/fvtt-revulture/templates/actor/actor-character-sheet.hbs',
    },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = await super._prepareContext(options);

    // Use a safe clone of the actor data for further operations.
    context.actor = this.actor;
    context.system = this.actor.system;
    context.items = this.actor.items.contents;

    // Adding a pointer to CONFIG.FVTT_REVULTURE
    context.config = CONFIG.FVTT_REVULTURE;

    //add tabs
    context.tabs = this._getTabs();

    //add editable
    context.editable = this.isEditable;

    // Prepare character data and items.
    this._prepareItems(context);
    this._prepareCharacterData(context);

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.actor.system.biography ?? '',
        {
          secrets: this.document.isOwner,
          rollData: this.actor.getRollData(),
          relativeTo: this.actor,
        },
      );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects(),
    );

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    this._activateEditors();
  }

  _activateEditors() {
    const editors = this.element.querySelectorAll('.editor');
    for (const editorDiv of editors) {
      const button = editorDiv.querySelector('.editor-edit');
      const content = editorDiv.querySelector('.editor-content');
      if (!button || !content) continue;

      button.addEventListener(
        'click',
        async (event) => {
          event.preventDefault();
          const target = content.dataset.edit;
          button.remove();

          await foundry.applications.ux.TextEditor.implementation.create(
            {
              target,
              engine: content.dataset.engine || 'prosemirror',
              collaborate: content.dataset.collaborate === 'true',
              document: this.document,
              fieldName: target,
            },
            content.innerHTML,
          );
        },
        { once: true },
      );
    }
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    // This is where you can enrich character-specific editor fields
    // or setup anything else that's specific to this type
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const spells = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    };

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        if (i.system.spellLevel != undefined) {
          spells[i.system.spellLevel].push(i);
        }
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.spells = spells;
  }

  /* -------------------------------------------- */
  tabGroups = { primary: 'features' };

  _getTabs() {
    const tabs = {
      features: { id: 'features', group: 'primary', label: 'Features' },
      description: {
        id: 'description',
        group: 'primary',
        label: 'Description',
      },
      items: { id: 'items', group: 'primary', label: 'Items' },
      spells: { id: 'spells', group: 'primary', label: 'Spells' },
      effects: { id: 'effects', group: 'primary', label: 'Effects' },
    };
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? 'active' : '';
    }
    return tabs;
  }

  /** @override */

  async onItemEdit(event, target) {
    const li = target.closest('[data-item-id]');
    const item = this.actor.items.get(li.dataset.itemId);

    item?.sheet.render(true);
  }

  async onItemDelete(event, target) {
    const li = target.closest('[data-item-id]');
    const item = this.actor.items.get(li.dataset.itemId);

    await item?.delete();
  }

  async onItemCreate(event, target) {
    const type = target.dataset.type;

    return this.actor.createEmbeddedDocuments('Item', [
      {
        name: `New ${type}`,
        type,
      },
    ]);
  }

  onRoll(event, target) {
    const li = target.closest('[data-item-id]');

    if (target.dataset.rollType === 'item') {
      const item = this.actor.items.get(li.dataset.itemId);
      return item?.roll();
    }
  }

  onChangeTab(event, target) {
    this.tabGroups.primary = target.dataset.tab;
    this.render(false);
  }

  async onEffectCreate(event, target) {
    const li = target.closest('[data-effect-type]');

    return this.actor.createEmbeddedDocuments('ActiveEffect', [
      {
        name: game.i18n.format('DOCUMENT.New', {
          type: game.i18n.localize('DOCUMENT.ActiveEffect'),
        }),
        img: 'icons/svg/aura.svg',
        origin: this.actor.uuid,
        duration: {
          rounds: li?.dataset.effectType === 'temporary' ? 1 : undefined,
        },
        disabled: li?.dataset.effectType === 'inactive',
      },
    ]);
  }

  async onEffectEdit(event, target) {
    const li = target.closest('[data-effect-id]');
    const effect = this.actor.effects.get(li.dataset.effectId);

    return effect?.sheet.render(true);
  }

  async onEffectDelete(event, target) {
    const li = target.closest('[data-effect-id]');
    const effect = this.actor.effects.get(li.dataset.effectId);

    return effect?.delete();
  }

  async onEffectToggle(event, target) {
    const li = target.closest('[data-effect-id]');
    const effect = this.actor.effects.get(li.dataset.effectId);

    return effect?.update({
      disabled: !effect.disabled,
    });
  }
}
