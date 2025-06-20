import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    PermissionsBitField
} from "discord.js";
import { NetLevelBotCommand } from "../../class/Builders";
import { fetchMee6Leaderboard, wait } from "../../util/functions";

export default new NetLevelBotCommand({
    type: 1,
    structure: {
        name: 'import',
        description: 'Import Mee6 XP for this guild.',
        options: [
            {
                name: 'limit',
                description: 'The number of pages to import (1 page = 1000 users).',
                type: ApplicationCommandOptionType.Integer,
                max_value: 50,
                min_value: 1,
                required: true
            },
            {
                name: 'guild',
                description: 'Custom guild ID to import from.',
                type: ApplicationCommandOptionType.String,
                required: false
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

        const limit = interaction.options.getInteger('limit', true);
        const targetGuildId = interaction.options.getString('guild') || interaction.guild.id;

        await interaction.deferReply().catch(() => null);

        try {
            await interaction.editReply({
                content: '⏳ Importing from Mee6 database... (**0%**)',
            }).catch(() => null);

            let page = 0;
            const importedUsers: {
                messageCount: number;
                id: string;
                xp: { userXp: number; levelXp: number; totalXp: number };
                level: number;
                rank: number;
            }[] = [];

            while (page < limit) {
                const res = await fetchMee6Leaderboard(targetGuildId, `limit=1000&page=${page}`);
                const players = res.data?.players;

                if (!Array.isArray(players) || players.length === 0) break;

                for (let i = 0; i < players.length; i++) {
                    const user = players[i];
                    const { id, level, message_count: messageCount } = user;
                    const [userXp, levelXp, totalXp] = user.detailed_xp;

                    importedUsers.push({
                        messageCount,
                        id,
                        xp: { userXp, levelXp, totalXp },
                        level,
                        rank: page * 1000 + i + 1
                    });
                }

                page++;

                await interaction.editReply({
                    content: `⏳ Importing from Mee6 database... (**${((page / limit) * 100).toFixed(1)}%**)`
                }).catch(() => null);

                await wait(5000); // Delay to avoid API rate limit
            }

            await interaction.editReply({
                content: `💾 Saving **${importedUsers.length}** users' XP into the database...`
            }).catch(() => null);

            await client.prisma.user.deleteMany({
                where: { guildId: interaction.guild.id }
            });

            for (const user of importedUsers) {
                await client.prisma.user.create({
                    data: {
                        guildId: interaction.guild.id,
                        userId: user.id,
                        level: user.level,
                        levelXp: user.xp.levelXp,
                        totalXp: user.xp.totalXp,
                        xp: user.xp.userXp,
                        messageCount: user.messageCount,
                        rank: user.rank
                    }
                });
            }

            await interaction.editReply({
                content: `✅ Successfully saved **${importedUsers.length}** users' XP to the database.`
            }).catch(() => null);

        } catch (err) {
            await interaction.editReply({
                content: `❌ Failed to import from Mee6. Make sure:\n• The leaderboard is public\n• You're not being rate-limited\n• The Mee6 API is not down.`
            }).catch(() => null);
        }
    }
});
