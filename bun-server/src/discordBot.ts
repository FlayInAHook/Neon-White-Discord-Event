import { Client, GatewayIntentBits, MessageFlags, PermissionsBitField, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createTeam, deleteTeam, linkAccount } from "./db";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID; // Added so we can register commands globally or to a specific guild. Usually best to use guild for instant updates in dev.
// To make it easy we can just register globally if we just provide the APP ID

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your in-game Neon White name")
    .addStringOption(option =>
      option.setName("name")
        .setDescription("Your exact in-game name")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("team_create")
    .setDescription("Create a new team of two players (Admin Only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addStringOption(option => option.setName("player1").setDescription("Exact in-game name of Player 1").setRequired(true))
    .addStringOption(option => option.setName("player2").setDescription("Exact in-game name of Player 2").setRequired(true)),
  new SlashCommandBuilder()
    .setName("team_delete")
    .setDescription("Delete an existing team (Admin Only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addStringOption(option => option.setName("player1").setDescription("Exact in-game name of Player 1").setRequired(true))
    .addStringOption(option => option.setName("player2").setDescription("Exact in-game name of Player 2").setRequired(true)),
];

export async function initDiscordBot() {
  if (!TOKEN || !CLIENT_ID) {
    console.warn("DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID not provided. Bot will not start.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }

  discordClient.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "link") {
      const name = interaction.options.getString("name", true);
      linkAccount(name, interaction.user.id);
      await interaction.reply({ content: `Linked Discord account to in-game name **${name}**!`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "team_create") {
      const p1 = interaction.options.getString("player1", true);
      const p2 = interaction.options.getString("player2", true);
      createTeam(p1, p2);
      await interaction.reply({ content: `Created team: **${p1}** & **${p2}**`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "team_delete") {
      const p1 = interaction.options.getString("player1", true);
      const p2 = interaction.options.getString("player2", true);
      deleteTeam(p1, p2);
      await interaction.reply({ content: `Deleted team: **${p1}** & **${p2}**`, flags: MessageFlags.Ephemeral });
    }
  });

  discordClient.once("clientReady", () => {
    console.log(`Discord bot logged in as ${discordClient.user?.tag}`);
  });

  discordClient.login(TOKEN);
}
