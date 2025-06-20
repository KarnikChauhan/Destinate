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

        // ✅ Admin or Owner check
        const isOwner = interaction.guild.ownerId === interaction.user.id;

        const rawPerms = interaction.member.permissions;
        const memberPerms = new PermissionsBitField(
            typeof rawPerms === "string" || typeof rawPerms === "number"
                ? BigInt(rawPerms)
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

        await interaction.deferReply().catch(null);

        try {
            const yesId = `yes-${interaction.id}`;
            const noId = `no-${interaction.id}`;

            const buttons = [
                new ButtonBuilder().setCustomId(yesId).setStyle(ButtonStyle.Danger).setLabel('Yes'),
                new ButtonBuilder().setCustomId(noId).setStyle(ButtonStyle.Secondary).setLabel('No')
            ];

            await interaction.editReply({
                content: '⚠️ Are you sure you want to fac
