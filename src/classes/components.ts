import {
	ActionRowBuilder,
	APIContainerComponent,
	BaseSelectMenuBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	Interaction,
	SectionBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
} from 'discord.js';
import { UserSettings } from '../api/elite.js';
import { GetColorTuple } from './Util.js';

export class EliteContainer extends ContainerBuilder {
	declare collapsibles: CollapsibleSection[];
	declare settings?: UserSettings;

	constructor(settings?: UserSettings, from?: Partial<APIContainerComponent>) {
		super(from);

		this.settings = settings;
		this.collapsibles = [];

		if (settings?.features?.embedColor) {
			this.setAccentColor(GetColorTuple('#' + settings.features.embedColor));
		} else {
			this.setAccentColor(GetColorTuple('#03fc7b'));
		}
	}

	addTitle(title: string, separator = true, backButton = '') {
		if (backButton) {
			this.addSectionComponents((s) =>
				s
					.addTextDisplayComponents((t) => t.setContent(title))
					.setButtonAccessory(
						new ButtonBuilder().setCustomId(backButton).setLabel('Back').setStyle(ButtonStyle.Secondary),
					),
			);
		} else {
			this.addText(title);
		}

		if (separator) this.addSeparator();
		return this;
	}

	addDescription(description: string, separator = false) {
		this.addText(description);

		if (separator) this.addSeparator();
		return this;
	}

	addSeparator(big = false, display = true) {
		this.addSeparatorComponents((a) =>
			a.setSpacing(big ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small).setDivider(display),
		);
		return this;
	}

	addText(text: string) {
		this.addTextDisplayComponents((t) => t.setContent(text));
		return this;
	}

	addFooter(separator = true, backButton = '') {
		if (separator) {
			this.addSeparator();
		}

		let text = '-# <:icon:1376644165588488212> [elitebot.dev](<https://elitebot.dev/>)';

		if (!this.settings?.features?.hideShopPromotions && process.env.FOOTER_SKU) {
			// Use this if they eventually make these buttons look better
			// section.setButtonAccessory(new ButtonBuilder()
			//     .setStyle(ButtonStyle.Premium)
			//     .setSKUId(process.env.FOOTER_SKU));

			text += ` • Support development with [Elite Premium](<https://elitebot.dev/shop/${process.env.FOOTER_SKU}>)!`;
		}

		if (backButton) {
			this.addSectionComponents((s) =>
				s
					.addTextDisplayComponents((t) => t.setContent(text))
					.setButtonAccessory(
						new ButtonBuilder().setCustomId(backButton).setLabel('Back').setStyle(ButtonStyle.Secondary),
					),
			);
			return this;
		}

		this.addTextDisplayComponents((t) => t.setContent(text));

		return this;
	}

	addButtonSection(button: ButtonBuilder, ...textComponents: string[]) {
		const section = new SectionBuilder().setId(10000 + Math.floor(Math.random() * 90000)).setButtonAccessory(button);

		if (textComponents.length > 0) {
			section.addTextDisplayComponents(...textComponents.map((text) => new TextDisplayBuilder().setContent(text)));
		}

		this.addSectionComponents(section);
		return this;
	}

	addCollapsible({ collapsed, expanded, opened, radio, header }: CollapsibleSectionData) {
		const sectionId = 10000 + Math.floor(Math.random() * 90000);
		const data = {
			id: sectionId,
			radio: radio ?? false,
			header: !header || header instanceof TextDisplayBuilder ? header : new TextDisplayBuilder().setContent(header),
			collapsed: {
				text:
					collapsed.text instanceof TextDisplayBuilder
						? collapsed.text
						: new TextDisplayBuilder().setContent(collapsed.text),
				button:
					collapsed.button instanceof ButtonBuilder
						? collapsed.button
						: new ButtonBuilder()
								.setCustomId(`collapsible-open-${sectionId}`)
								.setLabel(collapsed.button ?? 'Expand')
								.setStyle(ButtonStyle.Primary),
			},
			expanded: {
				appendText: expanded.appendText ?? true,
				text:
					expanded.text instanceof TextDisplayBuilder
						? expanded.text
						: new TextDisplayBuilder().setContent(expanded.text),
				button:
					expanded.button instanceof ButtonBuilder
						? expanded.button
						: new ButtonBuilder()
								.setCustomId(`collapsible-close-${sectionId}`)
								.setLabel(expanded.button ?? 'Collapse')
								.setStyle(ButtonStyle.Secondary),
			},
		} as CollapsibleSection;

		this.collapsibles.push(data);

		this.addSectionComponents(this.#collapsibleSection(opened, data).section);

		return this;
	}

	handleCollapsibleInteraction(interaction: Interaction) {
		if (!interaction.isButton()) return false;
		const customId = interaction.customId;
		if (!customId.startsWith('collapsible-')) return false;

		const [, state, sectionIdRaw] = customId.split('-');
		const sectionId = parseInt(sectionIdRaw, 10);

		return this.toggleCollapsible(sectionId, state === 'open');
	}

	toggleCollapsible(sectionId: number, opened: boolean) {
		const collapsible = this.collapsibles.find((c) => c.id === sectionId);
		if (!collapsible) return false;

		if (opened && collapsible.radio) {
			// Collapse all other sections if this is a radio collapsible
			this.collapsibles.forEach((c) => {
				if (c.id !== sectionId && c.radio) {
					this.toggleCollapsible(c.id, false);
				}
			});
		}

		// Update the section based on the interaction
		const section = this.components.find((c) => c.data.id === sectionId);
		if (!section || !(section instanceof SectionBuilder)) return false;

		const { text, button } = this.#collapsibleSection(opened, collapsible);
		section.spliceTextDisplayComponents(0, 3);
		section.addTextDisplayComponents(text);
		section.setButtonAccessory(button);

		return true;
	}

	#collapsibleSection(opened: boolean | undefined, data: CollapsibleSection) {
		return opened ? this.#openCollapsibleSection(data) : this.#closedCollapsibleSection(data);
	}

	#openCollapsibleSection(data: CollapsibleSection) {
		const textComponents = [] as TextDisplayBuilder[];

		if (data.header) {
			textComponents.push(data.header);
		}

		if (data.expanded.appendText) {
			textComponents.push(data.collapsed.text);
		}

		textComponents.push(data.expanded.text);

		return {
			text: textComponents,
			button: data.expanded.button,
			get section() {
				return new SectionBuilder()
					.setId(data.id)
					.addTextDisplayComponents(textComponents)
					.setButtonAccessory(data.expanded.button);
			},
		};
	}

	#closedCollapsibleSection(data: CollapsibleSection) {
		const textComponents = [] as TextDisplayBuilder[];
		if (data.header) {
			textComponents.push(data.header);
		}

		textComponents.push(data.collapsed.text);

		return {
			text: textComponents,
			button: data.collapsed.button,
			get section() {
				return new SectionBuilder()
					.setId(data.id)
					.addTextDisplayComponents(textComponents)
					.setButtonAccessory(data.collapsed.button);
			},
		};
	}

	disableEverything() {
		this.components.forEach((c) => {
			if (c instanceof ButtonBuilder) {
				c.setDisabled(true);
			}
			if (c instanceof BaseSelectMenuBuilder) {
				c.setDisabled(true);
			}
			if (c instanceof ActionRowBuilder) {
				c.components.forEach((comp) => {
					if (comp instanceof ButtonBuilder) {
						comp.setDisabled(true);
					} else if (comp instanceof BaseSelectMenuBuilder) {
						comp.setDisabled(true);
					}
				});
			}
			if (c instanceof SectionBuilder) {
				if (c.accessory instanceof ButtonBuilder) {
					c.accessory.setDisabled(true);
				}
			}
		});

		this.collapsibles.forEach((c) => {
			c.collapsed.button.setDisabled(true);
			c.expanded.button.setDisabled(true);
		});

		return this;
	}
}

interface CollapsibleSection {
	id: number;
	radio?: boolean;
	header: TextDisplayBuilder;
	collapsed: {
		text: TextDisplayBuilder;
		button: ButtonBuilder;
	};
	expanded: {
		appendText?: boolean;
		text: TextDisplayBuilder;
		button: ButtonBuilder;
	};
}

interface CollapsibleSectionData {
	opened?: boolean;
	radio?: boolean;
	header?: string | TextDisplayBuilder;
	collapsed: {
		text: string | TextDisplayBuilder;
		button?: ButtonBuilder | string;
	};
	expanded: {
		appendText?: boolean;
		text: string | TextDisplayBuilder;
		button?: ButtonBuilder | string;
	};
}
