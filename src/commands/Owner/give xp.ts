import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    PermissionsBitField
} from "discord.js";
import { NetLevelBotCommand } from "../../class/Builders";
import { InteractionError } from "../../util/classes";

export default new NetLevelBotCommand({
    type: 1,
    structure: {
        name: 'give',
        description: 'Give XP',
        options: [
            {
                name: 'xp',
                description: 'Give an amount of XP to a user.',
                type: 1,
                options: [
                    {
                        name: 'user',
                        description: 'The user to give XP.',
                        type: ApplicationCommandOptionType.User,
                        required: true
                    },
                    {
                        name: 'amount',
                        description: 'The amount of XP to give.',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        max_value: 100_000_000,
                        required: true
                    }
                ]
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
                : interaction.member.permissions?.bitfield ?? 0n
        );

        const isAdmin = memberPerms.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            await interaction.reply({
                content: '❌ You must be the server owner or have administrator permissions to use this command.',
                ephemeral: true
            }).catch(() => null);
            return;
        }

        const user = interaction.options.getUser('user', true);
        const amount = interaction.options.getInteger('amount', true);

        if (user.bot) {
            await interaction.reply({
                content: '❌ You cannot give XP to bots.',
                ephemeral: true
            }).catch(() => null);
            return;
        }

        await interaction.deferReply().catch(() => null);

        try {
            const data = await client.prisma.user.findFirst({
                where: {
                    guildId: interaction.guild.id,
                    userId: user.id
                }
            });

            if (!data) {
                await interaction.editReply({
                    content: '⚠️ The user must send at least one message in any channel before receiving XP.'
                }).catch(() => null);
                return;
            }

            const newTotalXP = data.totalXp + amount;
            let newLevel = data.level;
            let requiredXP = data.levelXp;

            // Level up logic
            while (newTotalXP >= requiredXP) {
                newLevel++;
                requiredXP = 5 * (newLevel ** 2) + 50 * newLevel + 100;
            }

            const remainingXP = requiredXP - newTotalXP;

            await client.prisma.user.updateMany({
                where: {
                    guildId: interaction.guild.id,
                    userId: user.id
                },
                data: {
                    xp: remainingXP,
                    totalXp: newTotalXP,
                    level: newLevel,
                    levelXp: requiredXP
                }
            });

            await interaction.editReply({
                content: `✅ Successfully added **${amount} XP** to ${user.toString()}.\nThey are now at level **${newLevel}**.`
            }).catch(() => null);

        } catch (err) {
            new InteractionError(interaction, err);
        }
    }
});
