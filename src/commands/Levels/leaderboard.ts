import { NetLevelBotCommand } from "../../class/Builders";
import { InteractionError } from "../../util/classes";
import { formatNumber } from "../../util/functions";

export default new NetLevelBotCommand({
    type: 1,
    structure: {
        name: 'leaderboard',
        description: 'The leaderboard of ranked people.',
        options: [],
        dm_permission: false
    },
    callback: async (client, interaction) => {
        if (!interaction.guild) return;

        await interaction.deferReply().catch(null);

        try {
            const data = await client.prisma.user.findMany({
                where: {
                    guildId: interaction.guild.id
                }
            });

            // Sort by total XP descending
            const sorted = data.sort((a, b) => b.totalXp - a.totalXp);

            // Map with ranks
            const mapped = sorted.map((each, index) => {
                const user = client.users.cache.get(each.userId);
                return {
                    rank: index + 1,
                    userId: each.userId,
                    level: each.level,
                    totalXp: each.totalXp,
                    userDisplay: user ? user.toString() : `<@${each.userId}>`,
                    isSelf: each.userId === interaction.user.id
                };
            });

            const top10 = mapped.slice(0, 10).map(entry =>
                `\`#${entry.rank}\` ${entry.userDisplay}${entry.isSelf ? ' (You)' : ''} - **Total XP**: ${formatNumber(entry.totalXp)}, **Level**: ${entry.level}`
            );

            const selfEntry = mapped.find(entry => entry.userId === interaction.user.id);

            await interaction.followUp({
                content: `🏆 **Leaderboard of ${interaction.guild.name}**:\n\n${top10.join('\n')}\n\nYou are currently at rank **#${selfEntry?.rank || '?'}**.`,
                allowedMentions: { parse: [] }
            }).catch(null);
        } catch (err) {
            new InteractionError(interaction, err);
        }
    }
});
