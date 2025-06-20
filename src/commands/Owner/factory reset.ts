import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    PermissionsBitField,
    PermissionFlagsBits
} from "discord.js";
import { NetLevelBotCommand } from "../../class/Builders";
import { InteractionError } from "../../util/classes";

export default new NetLevelBotCommand({
    type: 1,
    structure: {
        name: 'factory',
        description: 'Factory reset',
        options: [
            {
                name: 'reset',
                description: 'Reset the bot by default, everything will be erased.',
                type: 1
            }
        ],
        dm_permission: false
    },
    callback: async (client, interaction) => {
        if (!interaction.guild || !interaction.member) return;

        const isOwner = interaction.guild.ownerId === interaction.user.id;

        const memberPerms = new PermissionsBitField(
            typeof interaction.member.permissions === "string" || typeof interaction.member.permissions === "number"
                ? BigInt(interaction.member.permissions)
                : interaction.member.permissions ?? 0n
        );

        const isAdmin = memberPerms.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            await interaction.reply({
                content: '❌ You must be the server owner or have administrator permissions to use this command.',
                ephemeral: true
            }).catch(() => null);
            return;
        }

        await interaction.deferReply().catch(null);

        try {
            const buttons = [
                new ButtonBuilder()
                    .setCustomId('yes-' + interaction.id)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('Yes'),
                new ButtonBuilder()
                    .setCustomId('no-' + interaction.id)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('No')
            ];

            await interaction.editReply({
                content: '⚠️ Are you sure you want to reset the bot to default for this server? This will erase **all** XP and configuration data.',
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
                ]
            }).catch(null);

            const collector = interaction.channel?.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 15000
            });

            collector?.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: 'You are not the author of this interaction.',
                        ephemeral: true
                    }).catch(null);
                    return;
                }

                const [choice, id] = i.customId.split('-');
                if (id !== interaction.id) return;

                if (choice === 'yes') {
                    collector.stop();

                    await i.deferReply().catch(null);

                    await client.prisma.user.deleteMany({
                        where: {
                            guildId: interaction.guild.id
                        }
                    });

                    await client.prisma.guild.deleteMany({
                        where: {
                            guildId: interaction.guild.id
                        }
                    });

                    await client.prisma.role.deleteMany({
                        where: {
                            guildId: interaction.guild.id
                        }
                    });

                    await client.prisma.guild.create({
                        data: {
                            guildId: interaction.guild.id
                        }
                    });

                    await i.editReply({
                        content: '✅ The bot has been reset to default for this server.'
                    }).catch(null);
                } else if (choice === 'no') {
                    collector.stop();

                    await i.reply({
                        content: '❎ Factory reset canceled.',
                        ephemeral: true
                    }).catch(null);
                }
            });

            collector?.on('end', async () => {
                await interaction.editReply({
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            buttons.map(btn => btn.setDisabled(true).setStyle(ButtonStyle.Secondary))
                        )
                    ]
                }).catch(null);
            });

        } catch (err) {
            new InteractionError(interaction, err);
        }
    }
});
