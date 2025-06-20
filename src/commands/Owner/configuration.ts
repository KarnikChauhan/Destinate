import { AttachmentBuilder, PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { NetLevelBotCommand } from "../../class/Builders";
import { InteractionError } from "../../util/classes";
import util from "util";

export default new NetLevelBotCommand({
    type: 1,
    structure: {
        name: 'configuration',
        description: 'View the saved configuration for your server.',
        options: [],
        dm_permission: false
    },
    callback: async (client, interaction) => {
        if (!interaction.guild || !interaction.member) return;

        // Safe permission check: allow owner or admin
        const isOwner = interaction.guild.ownerId === interaction.user.id;

        const rawPerms = interaction.member.permissions;
        const memberPerms = new PermissionsBitField(
            typeof rawPerms === 'bigint' || typeof rawPerms === 'number'
                ? rawPerms
                : rawPerms?.bitfield ?? 0n
        );

        const isAdmin = memberPerms.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            await interaction.reply({
                content: '❌ You must be the server owner or have administrator permissions to use this command.',
                ephemeral: true
            }).catch(() => null);
            return;
        }

        await interaction.deferReply().catch(() => null);

        try {
            const data = await client.prisma.guild.findFirst({
                where: {
                    guildId: interaction.guild.id
                }
            });

            if (!data) {
                await interaction.followUp({
                    content: 'The server hasn\'t been configured yet.'
                }).catch(() => null);
                return;
            }

            const roles = await client.prisma.role.findMany({
                where: {
                    guildId: interaction.guild.id
                }
            });

            const objString = `guild: ${util.inspect(data)},\nroles: ${roles.length <= 0 ? '[]' : util.inspect(roles)}`;

            const buffer = Buffer.from(objString, 'utf-8');

            await interaction.followUp({
                content: 'Here is the data saved for your server:',
                files: [
                    new AttachmentBuilder(buffer, {
                        name: `data-${interaction.guild.id}.coffee`
                    })
                ]
            }).catch(() => null);

        } catch (err) {
            new InteractionError(interaction, err);
        }
    }
});
