import { ApplicationCommandOptionType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
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
                description: 'The limit of pages to import.',
                type: ApplicationCommandOptionType.Integer,
                max_value: 50,
                min_value: 1,
                required: true
            },
            {
                name: 'guild',
                description: 'The custom guild ID to import.',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ],
        dm_permission: false
    },

    callback: async (client, interaction) => {
        if (!interaction.guild || !interaction.member) return;

        // Permission check for owner or admin
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
            }).catch(null);
            return;
        }

        const limit = interaction.options.getInteger('limit', true);
        const guildId = interaction.options.getString('guild') || interaction.guild.id;

        await interaction.deferReply().catch(null);

        try {
            await interaction.followUp({
                content: 'Importing from Mee6 database... (**0%**)',
            }).catch(null);

            let page = 0;
            const arr: {
                messageCount: number,
                id: string,
                xp: { userXp: number, levelXp: number, totalXp: number },
                level: number,
                rank: number
            }[] = [];

            while (true) {
                if (page >= limit) break;

                const res = await fetchMee6Leaderboard(guildId, 'limit=1000&page=' + page);
                const players = res.data?.players;

                if (!players || players.length === 0) break;

                players.forEach((user: any, index: number) => {
                    const { id, level, message_count: messageCount } = user;
                    const [userXp, levelXp, totalXp] = user.detailed_xp;

                    arr.push({
                        messageCount,
                        id,
                        xp: { userXp, levelXp, totalXp },
                        level,
                        rank: (page * 1000) + index + 1
                    });
                });

                page++;

                await interaction.editReply({
                    content: `Importing from Mee6 database... (**${(((page) / limit) * 100).toFixed(1)}%**)`
                }).catch(null);

                await wait(5000); // Delay to avoid API rate limit
            }

            await interaction.editReply({
                content: `Successfully imported **${arr.length}** user's XP, saving into the database...`
            }).catch(null);

            await client.prisma.user.deleteMany({
                where: {
                    guildId: interaction.guild.id
                }
            });

            for (const each of arr) {
                await client.prisma.user.create({
                    data: {
                        guildId: interaction.guild.id,
                        level: each.level,
                        levelXp: each.xp.levelXp,
                        totalXp: each.xp.totalXp,
                        xp: each.xp.userXp,
                        messageCount: each.messageCount,
                        rank: each.rank,
                        userId: each.id
                    }
                });
            }

            await interaction.editReply({
                content: `Successfully saved **${arr.length}** user's XP into the database.`
            }).catch(null);

        } catch (err) {
            await interaction.editReply({
                content: `❌ Unable to import from the bot's API. Please make sure the leaderboard is public, Mee6 API is not down, and you're not being rate-limited.`
            }).catch(null);
        }
    }
});
