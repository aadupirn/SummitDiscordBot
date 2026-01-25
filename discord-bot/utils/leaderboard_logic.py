"""
Flexible leaderboard logic providers for multi-server support.
Each server can have custom leaderboard ranking logic with ELO as the default fallback.
"""

import sqlite3
from typing import List, Tuple, Optional
from abc import ABC, abstractmethod

from utils.server_config import get_server_config, SUMMIT_GUILD_ID


class LeaderboardProvider(ABC):
    """Base class for leaderboard ranking logic"""

    @abstractmethod
    def get_rankings(self, guild_id: int, limit: int = 16) -> List[Tuple]:
        """
        Get rankings for a guild.

        Args:
            guild_id: The Discord guild ID
            limit: Maximum number of players to return

        Returns:
            List of tuples: (user_id, display_name, score, extra_info)
        """
        raise NotImplementedError

    @abstractmethod
    def get_display_name(self) -> str:
        """Get the display name for this leaderboard type"""
        raise NotImplementedError


class EloLeaderboard(LeaderboardProvider):
    """Default ELO-based rankings (global across all servers)"""

    def get_rankings(self, guild_id: int, limit: int = 16) -> List[Tuple]:
        """Get ELO rankings (global, not guild-specific)"""
        conn = sqlite3.connect("elo.db")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT user_id, user_display_name, elo
            FROM overall_standings
            ORDER BY elo DESC
            LIMIT ?
        """,
            (limit,),
        )

        results = cursor.fetchall()
        conn.close()

        # Return as (user_id, display_name, elo, None)
        return [(r[0], r[1], r[2], None) for r in results]

    def get_display_name(self) -> str:
        return "ELO Rankings"


class WinsLeaderboard(LeaderboardProvider):
    """Rankings by total wins"""

    def __init__(self, guild_only: bool = False):
        self.guild_only = guild_only

    def get_rankings(self, guild_id: int, limit: int = 16) -> List[Tuple]:
        """Get rankings by total win count"""
        conn = sqlite3.connect("match_records.db")
        cursor = conn.cursor()

        if self.guild_only and guild_id:
            cursor.execute(
                """
                SELECT winner_id, winner_display_name, COUNT(*) as wins
                FROM match_records
                WHERE guild_id = ?
                GROUP BY winner_id
                ORDER BY wins DESC
                LIMIT ?
            """,
                (guild_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT winner_id, winner_display_name, COUNT(*) as wins
                FROM match_records
                GROUP BY winner_id
                ORDER BY wins DESC
                LIMIT ?
            """,
                (limit,),
            )

        results = cursor.fetchall()
        conn.close()

        # Return as (user_id, display_name, wins, None)
        return [(r[0], r[1], r[2], None) for r in results]

    def get_display_name(self) -> str:
        return "Most Wins"


class WinRateLeaderboard(LeaderboardProvider):
    """Rankings by win percentage (minimum games required)"""

    def __init__(self, min_games: int = 10, guild_only: bool = False):
        self.min_games = min_games
        self.guild_only = guild_only

    def get_rankings(self, guild_id: int, limit: int = 16) -> List[Tuple]:
        """Get rankings by win rate with minimum game requirement"""
        conn = sqlite3.connect("match_records.db")
        cursor = conn.cursor()

        # Build query based on guild_only setting
        guild_filter = "AND guild_id = ?" if self.guild_only and guild_id else ""
        guild_params = (guild_id,) if self.guild_only and guild_id else ()

        # Get wins per player
        cursor.execute(
            f"""
            SELECT winner_id, winner_display_name, COUNT(*) as wins
            FROM match_records
            WHERE 1=1 {guild_filter}
            GROUP BY winner_id
        """,
            guild_params,
        )
        wins_data = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

        # Get losses per player
        cursor.execute(
            f"""
            SELECT losser_id, losser_display_name, COUNT(*) as losses
            FROM match_records
            WHERE 1=1 {guild_filter}
            GROUP BY losser_id
        """,
            guild_params,
        )
        losses_data = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

        conn.close()

        # Calculate win rates
        player_stats = {}
        all_players = set(wins_data.keys()) | set(losses_data.keys())

        for player_id in all_players:
            wins = wins_data.get(player_id, (None, 0))[1]
            losses = losses_data.get(player_id, (None, 0))[1]
            display_name = (
                wins_data.get(player_id, (None, 0))[0]
                or losses_data.get(player_id, (None, 0))[0]
            )
            total_games = wins + losses

            if total_games >= self.min_games:
                win_rate = (wins / total_games) * 100
                player_stats[player_id] = (display_name, win_rate, total_games)

        # Sort by win rate descending
        sorted_players = sorted(
            player_stats.items(), key=lambda x: x[1][1], reverse=True
        )[:limit]

        # Return as (user_id, display_name, win_rate, total_games)
        return [
            (player_id, stats[0], round(stats[1], 1), stats[2])
            for player_id, stats in sorted_players
        ]

    def get_display_name(self) -> str:
        return f"Win Rate (min {self.min_games} games)"


class GuildEloLeaderboard(LeaderboardProvider):
    """ELO-based rankings filtered to a specific guild's matches"""

    def get_rankings(self, guild_id: int, limit: int = 16) -> List[Tuple]:
        """
        Get ELO rankings based only on matches played in this guild.
        This is a calculated ELO, not the global ELO.
        """
        # For now, fall back to global ELO
        # Full implementation would require recalculating ELO from guild-only matches
        return EloLeaderboard().get_rankings(guild_id, limit)

    def get_display_name(self) -> str:
        return "Server ELO Rankings"


def get_leaderboard_provider(guild_id: int) -> LeaderboardProvider:
    """
    Get the appropriate leaderboard provider for a guild.

    Args:
        guild_id: The Discord guild ID

    Returns:
        A LeaderboardProvider instance based on the guild's configuration
    """
    # Summit always uses standard ELO
    if guild_id == SUMMIT_GUILD_ID:
        return EloLeaderboard()

    # Get guild configuration
    config = get_server_config(guild_id)
    if not config:
        return EloLeaderboard()

    mode = config.get("leaderboard_mode", "elo")

    providers = {
        "elo": EloLeaderboard,
        "wins": lambda: WinsLeaderboard(guild_only=True),
        "win_rate": lambda: WinRateLeaderboard(min_games=10, guild_only=True),
        "global_elo": EloLeaderboard,
        "guild_elo": GuildEloLeaderboard,
    }

    provider_class = providers.get(mode, EloLeaderboard)
    if callable(provider_class):
        return provider_class()
    return provider_class()


def get_player_count_for_guild(guild_id: int) -> int:
    """
    Get the total number of unique players who have played matches in a guild.

    Args:
        guild_id: The Discord guild ID (None for all guilds)

    Returns:
        Number of unique players
    """
    conn = sqlite3.connect("match_records.db")
    cursor = conn.cursor()

    if guild_id:
        cursor.execute(
            """
            SELECT COUNT(DISTINCT player_id) FROM (
                SELECT winner_id as player_id FROM match_records WHERE guild_id = ?
                UNION
                SELECT losser_id as player_id FROM match_records WHERE guild_id = ?
            )
        """,
            (guild_id, guild_id),
        )
    else:
        cursor.execute(
            """
            SELECT COUNT(DISTINCT player_id) FROM (
                SELECT winner_id as player_id FROM match_records
                UNION
                SELECT losser_id as player_id FROM match_records
            )
        """
        )

    result = cursor.fetchone()[0]
    conn.close()
    return result


def get_match_count_for_guild(guild_id: int) -> int:
    """
    Get the total number of matches played in a guild.

    Args:
        guild_id: The Discord guild ID (None for all guilds)

    Returns:
        Number of matches
    """
    conn = sqlite3.connect("match_records.db")
    cursor = conn.cursor()

    if guild_id:
        cursor.execute(
            "SELECT COUNT(*) FROM match_records WHERE guild_id = ?", (guild_id,)
        )
    else:
        cursor.execute("SELECT COUNT(*) FROM match_records")

    result = cursor.fetchone()[0]
    conn.close()
    return result
