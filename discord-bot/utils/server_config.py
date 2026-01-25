"""
Server configuration management for multi-server support.
Stores per-server settings in SQLite database.
"""

import sqlite3
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger("discord_bot")

# Database path
DB_PATH = Path(__file__).parent.parent / "server_config.db"

# Summit server uses hardcoded values - no setup required
SUMMIT_GUILD_ID = 1319120227643949211

# Summit's hardcoded channel IDs (fallback values)
SUMMIT_CHANNELS = {
    "lfg": 1336912830867439676,
    "match_report": 1456299008023728302,
    "leaderboard": 1457113321118629889,
    "milestone": 1319121592499961886,
    "welcome": 1319120228650844202,
    "fart": 1402265039951368273,
}

# Summit Discord invite link for branding on other servers
SUMMIT_DISCORD_INVITE = "https://discord.gg/aV8dx5WF"


def create_server_config_db():
    """Create the server_configs table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS server_configs (
            guild_id INTEGER PRIMARY KEY,
            guild_name TEXT,
            lfg_channel_id INTEGER,
            match_report_channel_id INTEGER,
            leaderboard_channel_id INTEGER,
            milestone_channel_id INTEGER,
            leaderboard_mode TEXT DEFAULT 'elo',
            is_configured BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def get_server_config(guild_id: int) -> Optional[dict]:
    """
    Get the configuration for a specific guild.

    Args:
        guild_id: The Discord guild ID

    Returns:
        Dictionary with server config, or None if not configured
    """
    # Summit uses hardcoded values
    if guild_id == SUMMIT_GUILD_ID:
        return {
            "guild_id": SUMMIT_GUILD_ID,
            "guild_name": "Sorcerers Summit",
            "lfg_channel_id": SUMMIT_CHANNELS["lfg"],
            "match_report_channel_id": SUMMIT_CHANNELS["match_report"],
            "leaderboard_channel_id": SUMMIT_CHANNELS["leaderboard"],
            "milestone_channel_id": SUMMIT_CHANNELS["milestone"],
            "leaderboard_mode": "elo",
            "is_configured": True,
        }

    create_server_config_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT guild_id, guild_name, lfg_channel_id, match_report_channel_id,
               leaderboard_channel_id, milestone_channel_id, leaderboard_mode,
               is_configured, created_at, updated_at
        FROM server_configs
        WHERE guild_id = ?
    """,
        (guild_id,),
    )

    row = cur.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def set_server_config(
    guild_id: int,
    guild_name: str,
    lfg_channel_id: int,
    match_report_channel_id: int,
    leaderboard_channel_id: Optional[int] = None,
    milestone_channel_id: Optional[int] = None,
    leaderboard_mode: str = "elo",
) -> bool:
    """
    Save or update server configuration.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name
        lfg_channel_id: Channel ID for LFG queue
        match_report_channel_id: Channel ID for match report fallback
        leaderboard_channel_id: Optional channel ID for leaderboard display
        milestone_channel_id: Optional channel ID for milestone announcements
        leaderboard_mode: Leaderboard ranking mode ('elo', 'wins', 'win_rate')

    Returns:
        True if successful, False otherwise
    """
    # Don't allow overwriting Summit config
    if guild_id == SUMMIT_GUILD_ID:
        logger.warning("Attempted to overwrite Summit server config")
        return False

    create_server_config_db()

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO server_configs
                (guild_id, guild_name, lfg_channel_id, match_report_channel_id,
                 leaderboard_channel_id, milestone_channel_id, leaderboard_mode,
                 is_configured, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(guild_id) DO UPDATE SET
                guild_name = excluded.guild_name,
                lfg_channel_id = excluded.lfg_channel_id,
                match_report_channel_id = excluded.match_report_channel_id,
                leaderboard_channel_id = excluded.leaderboard_channel_id,
                milestone_channel_id = excluded.milestone_channel_id,
                leaderboard_mode = excluded.leaderboard_mode,
                is_configured = 1,
                updated_at = CURRENT_TIMESTAMP
        """,
            (
                guild_id,
                guild_name,
                lfg_channel_id,
                match_report_channel_id,
                leaderboard_channel_id,
                milestone_channel_id,
                leaderboard_mode,
            ),
        )

        conn.commit()
        conn.close()
        logger.info(f"Server config saved for guild {guild_id} ({guild_name})")
        return True

    except Exception as e:
        logger.error(f"Error saving server config: {e}")
        return False


def is_server_configured(guild_id: int) -> bool:
    """
    Check if a server has been configured.

    Args:
        guild_id: The Discord guild ID

    Returns:
        True if server is configured, False otherwise
    """
    # Summit is always configured
    if guild_id == SUMMIT_GUILD_ID:
        return True

    config = get_server_config(guild_id)
    return config is not None and config.get("is_configured", False)


def get_channel_for_guild(guild_id: int, channel_type: str) -> Optional[int]:
    """
    Get the appropriate channel ID for a guild and channel type.

    Args:
        guild_id: The Discord guild ID
        channel_type: One of 'lfg', 'match_report', 'leaderboard', 'milestone'

    Returns:
        The channel ID, or None if not configured
    """
    # Summit uses hardcoded values
    if guild_id == SUMMIT_GUILD_ID:
        return SUMMIT_CHANNELS.get(channel_type)

    config = get_server_config(guild_id)
    if config:
        channel_key = f"{channel_type}_channel_id"
        return config.get(channel_key)

    return None


def is_summit_server(guild_id: int) -> bool:
    """Check if the given guild ID is the Summit server."""
    return guild_id == SUMMIT_GUILD_ID


def get_embed_footer(guild_id: int) -> Optional[str]:
    """
    Get the appropriate footer for embeds based on server.

    Args:
        guild_id: The Discord guild ID

    Returns:
        Footer text for non-Summit servers, None for Summit
    """
    if guild_id == SUMMIT_GUILD_ID:
        return None

    return f"Brought to you by the Sorcerers Summit\n{SUMMIT_DISCORD_INVITE}"


def get_all_configured_servers() -> list:
    """
    Get a list of all configured server IDs.

    Returns:
        List of guild IDs that have been configured
    """
    create_server_config_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT guild_id FROM server_configs WHERE is_configured = 1
    """
    )

    rows = cur.fetchall()
    conn.close()

    # Always include Summit
    server_ids = [SUMMIT_GUILD_ID]
    for row in rows:
        if row[0] != SUMMIT_GUILD_ID:
            server_ids.append(row[0])

    return server_ids
