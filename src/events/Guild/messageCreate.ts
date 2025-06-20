import { Guild, TextChannel } from "discord.js";
import { GatewayEventListener } from "../../class/Builders";
import { ExtendedClient } from "../../class/ExtendedClient";

const levelingConfig = {
    xpPerMessage: (min: number, max: number) => {
        return Math.random() * (max - min) + min;
    },
    xpRate: 1.0
};

const antispam = new Map<string, number>();

export default new GatewayEventListener({
    event: 'messageCreate',
    callback: async (client, message) => {
        if (!message.guild || message.author.bot) return;

        const checkspam = antispam.get(message.author.id);
        if (checkspam && checkspam > Date.now()) return;
        if (message.content.length < 3) return;

        antispam.set(message.author.id, Date.now() + 500);

        const guild = await client.prisma.guild.findFirst({
            where: {
                guildId: message.guild.id
            }
        });

        // No XP channel or role
        if (guild?.noXpChannels?.split(',')?.includes(message.channel.id)) return;
        if (guild?.noXpRoles?.split(',')?.some(role => message.member?.roles.cache.has(role))) return;

        const userData = await client.prisma.user.findFirst({
            where: {
                guildId: message.guild.id,
                userId: message.author.id
            }
        });

        if (userData?.noXp === true) return;

        // First-time user
        if (!userData) {
            const count = await client.prisma.user.count({
                where: { guildId: message.guild.id }
            });

            await client.prisma.user.create({
                data: {
                    guildId: message.guild.id,
                    userId: message.author.id,
                    messageCount: 1,
                    level: 0,
                    rank: count + 1,
                    levelXp: 100,
                    xp: 0,
                    totalXp: 0,
                    noXp: false
                }
            });

            setTimeout(() => antispam.delete(message.author.id), 2000);
            return;
        }

        const xpPerMessage = levelingConfig.xpPerMessage(15, 25) * (guild?.xpRate ?? levelingConfig.xpRate);
        const newTotalXp = userData.totalXp + xpPerMessage;

        // Calculate level from total XP
        let level = 0;
        while (newTotalXp >= getXpForLevel(level)) {
            level++;
        }

        const previousLevelXp = getXpForLevel(level - 1);
        const requiredXp = getXpForLevel(level);
        const currentLevelXp = newTotalXp - previousLevelXp;

        const didLevelUp = level > userData.level;

        if (didLevelUp) {
            const levelupChannel = message.guild.channels.cache.get(guild?.levelUpChannel ?? '') as TextChannel;

            await (levelupChannel ?? message.channel).send({
                content: guild?.levelUpMessage
                    ? guild.levelUpMessage
                        .replace(/{user}/g, message.author.toString())
                        .replace(/{userId}/g, message.author.id)
                        .replace(/{username}/g, message.author.username)
                        .replace(/{level}/g, level.toString())
                    : `🎉 Congratulations ${message.author.toString()}, you're now at **level ${level}**!`
            }).catch(() => null);

            await checkRoleRewards(client, message.guild.id, message.author.id, level, guild?.stackingRoles ?? false);
        }

        await client.prisma.user.update({
            where: { id: userData.id },
            data: {
                level,
                xp: currentLevelXp,
                levelXp: requiredXp,
                totalXp: newTotalXp,
                messageCount: userData.messageCount + 1
            }
        });
    }
});

const getXpForLevel = (level: number): number => {
    return 5 * (level ** 2) + 50 * level + 100;
};

const checkRoleRewards = async (
    client: ExtendedClient,
    guildId: string,
    userId: string,
    newLevel: number,
    stacking?: boolean
) => {
    const roleRewards = await client.prisma.role.findMany({
        where: { guildId }
    });

    const userData = await client.prisma.user.findFirst({
        where: { guildId, userId }
    });

    if (!roleRewards || roleRewards.length <= 0 || !userData) return;

    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(userId);
    if (!guild || !member) return;

    const reward = roleRewards.find(r => r.level === newLevel);
    if (reward) {
        const oldRole = guild.roles.cache.get(userData.lastRoleIdGiven ?? '');
        if (oldRole && !stacking) {
            await member.roles.remove(oldRole.id).catch(() => null);
        }

        await member.roles.add(reward.roleId).catch(() => null);
        await client.prisma.user.update({
            where: { id: userData.id },
            data: { lastRoleIdGiven: reward.roleId }
        });
    }
};
