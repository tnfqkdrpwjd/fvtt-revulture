import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
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
  static DEFAULT_OPTIONS = {
    actions: {
      itemEdit: FvttRevultureActorSheet.onItemEdit,
      itemDelete: FvttRevultureActorSheet.onItemDelete,
      itemCreate: FvttRevultureActorSheet.onItemCreate,
      roll: FvttRevultureActorSheet.onRoll,
    },
    classes: ['fvtt-revulture', 'sheet', 'actor'],
    form: { submitOnChange: true },
    id: 'fvtt-revulture-actor-sheet',

    position: {
      width: 600,
      height: 600,
    },
    tag: 'form', // The default is "div"
    window: {
      icon: 'actor icon', // You can now add an icon to the header //css
      title: 'actor.form.title',
    },
  };

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

    // Prepare character data and items.
    this._prepareItems(context);
    this._prepareCharacterData(context);

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
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

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
  }

  async onItemEdit(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);

    item?.sheet.render(true);
  }

  async onItemDelete(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);

    await item?.delete();
  }

  async onItemCreate(event, target) {
    const type = target.dataset.type;

    return Item.create(
      {
        name: `New ${type}`,
        type,
      },
      {
        parent: this.actor,
      },
    );
  }

  onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
}
