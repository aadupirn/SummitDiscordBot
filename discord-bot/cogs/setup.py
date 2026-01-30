"""
Server setup cog for multi-server configuration.
Provides !setup_summit_bot command for server administrators.
"""

import discord
from discord import app_commands
from discord.ext import commands
import logging

from utils.server_config import (
    get_server_config,
    set_server_config,
    is_summit_server,
    SUMMIT_GUILD_ID,
)

logger = logging.getLogger("discord_bot")


class SetupModal(discord.ui.Modal, title="Summit Bot Server Configuration"):
    """Modal for collecting server channel configuration."""

    lfg_channel = discord.ui.TextInput(
        label="LFG Channel ID",
        placeholder="Enter the channel ID for Looking For Game queue",
        required=True,
        min_length=17,
        max_length=20,
    )

    match_report_channel = discord.ui.TextInput(
        label="Match Report Channel ID",
        placeholder="Enter the channel ID for match report notifications",
        required=True,
        min_length=17,
        max_length=20,
    )

    leaderboard_channel = discord.ui.TextInput(
        label="Leaderboard Channel ID (Optional)",
        placeholder="Enter the channel ID for leaderboard display",
        required=False,
        min_length=17,
        max_length=20,
    )

    milestone_channel = discord.ui.TextInput(
        label="Milestone Channel ID (Optional)",
        placeholder="Enter the channel ID for milestone announcements",
        required=False,
        min_length=17,
        max_length=20,
    )

    invite_link = discord.ui.TextInput(
        label="Discord Invite Link (Optional)",
        placeholder="https://discord.gg/yourserver (for cross-server visibility)",
        required=False,
        min_length=0,
        max_length=100,
        style=discord.TextStyle.short,
    )

    def __init__(self, bot: commands.Bot):
        super().__init__()
        self.bot = bot

    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission."""
        await interaction.response.defer(ephemeral=True)

        guild = interaction.guild
        errors = []

        # Validate LFG channel
        try:
            lfg_id = int(self.lfg_channel.value.strip())
            lfg_channel = guild.get_channel(lfg_id)
            if not lfg_channel:
                errors.append(f"LFG Channel ID {lfg_id} not found in this server")
            elif not isinstance(lfg_channel, discord.TextChannel):
                errors.append(f"LFG Channel must be a text channel")
        except ValueError:
            errors.append("LFG Channel ID must be a number")
            lfg_id = None

        # Validate Match Report channel
        try:
            match_report_id = int(self.match_report_channel.value.strip())
            match_report_channel = guild.get_channel(match_report_id)
            if not match_report_channel:
                errors.append(
                    f"Match Report Channel ID {match_report_id} not found in this server"
                )
            elif not isinstance(match_report_channel, discord.TextChannel):
                errors.append(f"Match Report Channel must be a text channel")
        except ValueError:
            errors.append("Match Report Channel ID must be a number")
            match_report_id = None

        # Validate optional Leaderboard channel
        leaderboard_id = None
        if self.leaderboard_channel.value.strip():
            try:
                leaderboard_id = int(self.leaderboard_channel.value.strip())
                leaderboard_channel = guild.get_channel(leaderboard_id)
                if not leaderboard_channel:
                    errors.append(
                        f"Leaderboard Channel ID {leaderboard_id} not found in this server"
                    )
                elif not isinstance(leaderboard_channel, discord.TextChannel):
                    errors.append(f"Leaderboard Channel must be a text channel")
            except ValueError:
                errors.append("Leaderboard Channel ID must be a number")

        # Validate optional Milestone channel
        milestone_id = None
        if self.milestone_channel.value.strip():
            try:
                milestone_id = int(self.milestone_channel.value.strip())
                milestone_channel = guild.get_channel(milestone_id)
                if not milestone_channel:
                    errors.append(
                        f"Milestone Channel ID {milestone_id} not found in this server"
                    )
                elif not isinstance(milestone_channel, discord.TextChannel):
                    errors.append(f"Milestone Channel must be a text channel")
            except ValueError:
                errors.append("Milestone Channel ID must be a number")

        # Validate optional Discord invite link
        invite_link = None
        if self.invite_link.value.strip():
            invite_link = self.invite_link.value.strip()
            # Basic validation - check if it starts with discord link
            if not (invite_link.startswith("https://discord.gg/") or
                    invite_link.startswith("https://discord.com/invite/")):
                errors.append(
                    "Discord invite link must start with 'https://discord.gg/' or 'https://discord.com/invite/'"
                )

        # If there are errors, show them
        if errors:
            error_msg = "**Configuration Errors:**\n" + "\n".join(
                f"• {e}" for e in errors
            )
            await interaction.followup.send(error_msg, ephemeral=True)
            return

        # Check bot permissions in channels
        permission_warnings = []

        for channel_name, channel_id in [
            ("LFG", lfg_id),
            ("Match Report", match_report_id),
            ("Leaderboard", leaderboard_id),
            ("Milestone", milestone_id),
        ]:
            if channel_id:
                channel = guild.get_channel(channel_id)
                if channel:
                    perms = channel.permissions_for(guild.me)
                    if not perms.send_messages:
                        permission_warnings.append(
                            f"Bot cannot send messages in {channel_name} channel"
                        )
                    if not perms.embed_links:
                        permission_warnings.append(
                            f"Bot cannot embed links in {channel_name} channel"
                        )

        # Save the configuration
        success = set_server_config(
            guild_id=guild.id,
            guild_name=guild.name,
            lfg_channel_id=lfg_id,
            match_report_channel_id=match_report_id,
            leaderboard_channel_id=leaderboard_id,
            milestone_channel_id=milestone_id,
            discord_invite_link=invite_link,
        )

        if success:
            response = "**Server Configuration Saved Successfully!**\n\n"
            response += f"• **LFG Channel:** <#{lfg_id}>\n"
            response += f"• **Match Report Channel:** <#{match_report_id}>\n"
            if leaderboard_id:
                response += f"• **Leaderboard Channel:** <#{leaderboard_id}>\n"
            if milestone_id:
                response += f"• **Milestone Channel:** <#{milestone_id}>\n"
            if invite_link:
                response += f"• **Invite Link:** {invite_link}\n"

            if permission_warnings:
                response += "\n**Warnings:**\n" + "\n".join(
                    f"⚠️ {w}" for w in permission_warnings
                )

            response += "\n\nThe Summit Bot is now configured for this server!"
            await interaction.followup.send(response, ephemeral=True)
            logger.info(f"Server {guild.name} ({guild.id}) configured successfully")
        else:
            await interaction.followup.send(
                "Failed to save configuration. Please try again.", ephemeral=True
            )


class SetupButton(discord.ui.View):
    """Button to open the setup modal."""

    def __init__(self, bot: commands.Bot):
        super().__init__(timeout=300)  # 5 minute timeout
        self.bot = bot

    @discord.ui.button(
        label="Configure Server", style=discord.ButtonStyle.primary, emoji="⚙️"
    )
    async def configure_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        """Open the configuration modal."""
        # Check if user has admin permissions
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message(
                "You need Administrator permissions to configure this bot.",
                ephemeral=True,
            )
            return

        modal = SetupModal(self.bot)
        await interaction.response.send_modal(modal)


class SetupCog(commands.Cog):
    """Cog for server setup and configuration commands."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="setup_summit_bot")
    @commands.has_permissions(administrator=True)
    async def setup_summit_bot(self, ctx: commands.Context):
        """
        Configure the Summit Bot for this server.

        This command opens a configuration modal where you can set up
        the channels the bot will use for LFG, match reports, leaderboards,
        and milestone announcements.

        Requires Administrator permissions.
        """
        # Check if this is the Summit server
        if is_summit_server(ctx.guild.id):
            await ctx.send(
                "This is the **Sorcerers Summit** server - it's already configured! "
                "No setup needed here.",
                delete_after=30,
            )
            return

        # Check if already configured
        config = get_server_config(ctx.guild.id)
        if config and config.get("is_configured"):
            embed = discord.Embed(
                title="Server Already Configured",
                description="This server has already been set up. Current configuration:",
                color=discord.Color.blue(),
            )
            embed.add_field(
                name="LFG Channel",
                value=f"<#{config['lfg_channel_id']}>",
                inline=True,
            )
            embed.add_field(
                name="Match Report Channel",
                value=f"<#{config['match_report_channel_id']}>",
                inline=True,
            )
            if config.get("leaderboard_channel_id"):
                embed.add_field(
                    name="Leaderboard Channel",
                    value=f"<#{config['leaderboard_channel_id']}>",
                    inline=True,
                )
            if config.get("milestone_channel_id"):
                embed.add_field(
                    name="Milestone Channel",
                    value=f"<#{config['milestone_channel_id']}>",
                    inline=True,
                )
            if config.get("discord_invite_link"):
                embed.add_field(
                    name="Discord Invite Link",
                    value=config.get("discord_invite_link"),
                    inline=False,
                )

            embed.set_footer(text="Click the button below to reconfigure")

            view = SetupButton(self.bot)
            await ctx.send(embed=embed, view=view)
        else:
            # First time setup
            embed = discord.Embed(
                title="Summit Bot Server Setup",
                description=(
                    "Welcome to the **Summit Bot** setup wizard!\n\n"
                    "Click the button below to configure the bot for this server. "
                    "You'll need to provide channel IDs for:\n\n"
                    "• **LFG Channel** - Where players join the matchmaking queue\n"
                    "• **Match Report Channel** - Where match results are posted\n"
                    "• **Leaderboard Channel** (optional) - Where rankings are displayed\n"
                    "• **Milestone Channel** (optional) - Where milestone announcements go\n"
                    "• **Discord Invite Link** (optional) - For cross-server queue visibility\n\n"
                    "To get a channel ID, right-click the channel and select 'Copy Channel ID' "
                    "(Developer Mode must be enabled in Discord settings)."
                ),
                color=discord.Color.green(),
            )
            embed.set_footer(text="Brought to you by the Sorcerers Summit")

            view = SetupButton(self.bot)
            await ctx.send(embed=embed, view=view)

    @setup_summit_bot.error
    async def setup_summit_bot_error(
        self, ctx: commands.Context, error: commands.CommandError
    ):
        """Handle errors from setup_summit_bot command."""
        if isinstance(error, commands.MissingPermissions):
            await ctx.send(
                "You need **Administrator** permissions to configure this bot.",
                delete_after=15,
            )
        else:
            logger.error(f"Error in setup_summit_bot: {error}")
            await ctx.send(
                "An error occurred while setting up. Please try again.",
                delete_after=15,
            )

    @commands.command(name="server_config")
    @commands.has_permissions(administrator=True)
    async def server_config(self, ctx: commands.Context):
        """
        View the current server configuration.

        Requires Administrator permissions.
        """
        config = get_server_config(ctx.guild.id)

        if not config:
            await ctx.send(
                "This server has not been configured yet. "
                "Use `!setup_summit_bot` to set up the bot.",
                delete_after=30,
            )
            return

        embed = discord.Embed(
            title=f"Server Configuration: {ctx.guild.name}",
            color=discord.Color.blue(),
        )

        if is_summit_server(ctx.guild.id):
            embed.description = "**Sorcerers Summit** - Using default configuration"
        else:
            embed.description = "Custom server configuration"

        embed.add_field(
            name="LFG Channel",
            value=f"<#{config['lfg_channel_id']}>",
            inline=True,
        )
        embed.add_field(
            name="Match Report Channel",
            value=f"<#{config['match_report_channel_id']}>",
            inline=True,
        )

        if config.get("leaderboard_channel_id"):
            embed.add_field(
                name="Leaderboard Channel",
                value=f"<#{config['leaderboard_channel_id']}>",
                inline=True,
            )
        else:
            embed.add_field(
                name="Leaderboard Channel",
                value="Not configured",
                inline=True,
            )

        if config.get("milestone_channel_id"):
            embed.add_field(
                name="Milestone Channel",
                value=f"<#{config['milestone_channel_id']}>",
                inline=True,
            )
        else:
            embed.add_field(
                name="Milestone Channel",
                value="Not configured",
                inline=True,
            )

        embed.add_field(
            name="Leaderboard Mode",
            value=config.get("leaderboard_mode", "elo").upper(),
            inline=True,
        )

        embed.add_field(
            name="Status",
            value="✅ Configured" if config.get("is_configured") else "❌ Not configured",
            inline=True,
        )

        if config.get("discord_invite_link"):
            embed.add_field(
                name="Discord Invite Link",
                value=config.get("discord_invite_link"),
                inline=False,
            )

        await ctx.send(embed=embed)

    @server_config.error
    async def server_config_error(
        self, ctx: commands.Context, error: commands.CommandError
    ):
        """Handle errors from server_config command."""
        if isinstance(error, commands.MissingPermissions):
            await ctx.send(
                "You need **Administrator** permissions to view server configuration.",
                delete_after=15,
            )


async def setup(bot: commands.Bot):
    """Setup function for loading the cog."""
    await bot.add_cog(SetupCog(bot))
