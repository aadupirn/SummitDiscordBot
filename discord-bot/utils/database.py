import sqlite3
import datetime
import logging
import re

from utils.deck_checker import scrape_Curosa
from utils.server_config import SUMMIT_GUILD_ID

logger = logging.getLogger("discord_bot")


def sanitize_table_name(guild_name: str) -> str:
    """
    Convert a guild name to a valid SQL table name.

    Args:
        guild_name: The Discord guild name

    Returns:
        A sanitized string safe for use as a SQL table name
    """
    # Convert to lowercase
    name = guild_name.lower()
    # Replace spaces and hyphens with underscores
    name = re.sub(r'[\s\-]+', '_', name)
    # Remove any characters that aren't alphanumeric or underscore
    name = re.sub(r'[^a-z0-9_]', '', name)
    # Ensure it doesn't start with a number
    if name and name[0].isdigit():
        name = '_' + name
    # Limit length to 50 characters
    name = name[:50]
    # Ensure we have something valid
    if not name:
        name = 'unknown_server'
    return name


def get_match_table_name(guild_id: int, guild_name: str = None) -> str:
    """
    Get the appropriate match records table name for a guild.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name (required for non-Summit servers)

    Returns:
        The table name to use for match records
    """
    if guild_id == SUMMIT_GUILD_ID:
        return "match_records"

    if not guild_name:
        # Fallback to guild_id if name not provided
        return f"match_records_{guild_id}"

    return f"match_records_{sanitize_table_name(guild_name)}"


def create_server_match_table(guild_id: int, guild_name: str):
    """
    Create a server-specific match records table if it doesn't exist.
    Non-Summit servers don't track ELO.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name
    """
    if guild_id == SUMMIT_GUILD_ID:
        # Summit uses the main match_records table
        create_db()
        return

    table_name = get_match_table_name(guild_id, guild_name)

    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    # Create server-specific table without ELO columns
    cur.execute(f"""CREATE TABLE IF NOT EXISTS {table_name}
                   (match_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reporter_id INTEGER,
                    winner_id INTEGER,
                    winner_display_name TEXT,
                    losser_id INTEGER,
                    losser_display_name TEXT,
                    did_win BOOLEAN,
                    timestamp TEXT,
                    first_player TEXT,
                    match_time INTEGER,
                    curiosa_url TEXT,
                    match_comment TEXT,
                    json_deck_data TEXT,
                    curiosa_url_winner TEXT,
                    curiosa_url_loser TEXT,
                    json_deck_data_winner TEXT,
                    json_deck_data_loser TEXT,
                    guild_id INTEGER
                   )""")

    conn.commit()
    conn.close()
    logger.info(f"Created/verified server match table: {table_name}")


def get_server_match_count(guild_id: int, guild_name: str = None) -> int:
    """
    Get the total number of matches for a specific server.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name (required for non-Summit servers)

    Returns:
        The match count for that server
    """
    table_name = get_match_table_name(guild_id, guild_name)

    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    try:
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cur.fetchone()[0]
    except sqlite3.OperationalError:
        # Table doesn't exist yet
        count = 0

    conn.close()
    return count


def create_db():
    """Create all required database tables if they don't exist."""
    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    # Create match_records table with auto-increment match_id
    cur.execute("""CREATE TABLE IF NOT EXISTS match_records
                   (match_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reporter_id INTEGER,
                    winner_id INTEGER, 
                    winner_display_name TEXT,
                    losser_id INTEGER,
                    losser_display_name TEXT,
                    did_win BOOLEAN,
                    timestamp TEXT,
                    first_player TEXT,
                    match_time INTEGER,
                    curiosa_url TEXT,
                    match_comment TEXT,
                    json_deck_data TEXT,
                    winner_elo_change INTEGER,
                    loser_elo_change INTEGER
                   )""")

    # Add match_id column if it doesn't exist (migration for existing databases)
    try:
        cur.execute(
            "ALTER TABLE match_records ADD COLUMN match_id INTEGER PRIMARY KEY AUTOINCREMENT"
        )
    except sqlite3.OperationalError:
        pass  # Column already exists or table was created with it

    # Add elo_change columns if they don't exist (migration for existing databases)
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN winner_elo_change INTEGER")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN loser_elo_change INTEGER")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Add new deck columns for winner and loser (Phase 1 migration)
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN curiosa_url_winner TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN curiosa_url_loser TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN json_deck_data_winner TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN json_deck_data_loser TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Add guild_id column for multi-server support
    try:
        cur.execute("ALTER TABLE match_records ADD COLUMN guild_id INTEGER")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Create solo_match_reports table with auto-increment report_id
    cur.execute("""CREATE TABLE IF NOT EXISTS solo_match_reports
                   (report_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reporter_id INTEGER,
                    reporter_name TEXT,
                    opponent_name TEXT,
                    is_winner BOOLEAN,
                    first_player TEXT,
                    match_time INTEGER,
                    curiosa_link TEXT,
                    match_comment TEXT,
                    report_date DATETIME,
                    json_deck_data TEXT
                   )""")

    conn.commit()
    conn.close()


def create_challenge_db():
    """Create the challenge_matches table if it doesn't exist."""
    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    cur.execute("""CREATE TABLE IF NOT EXISTS challenge_matches
                   (match_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    challenger_id INTEGER NOT NULL,
                    challenged_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    match_time DATETIME NOT NULL,
                    winner_id INTEGER,
                    curiosa_url TEXT,
                    match_comment TEXT,
                    json_deck_data TEXT
                   )""")

    # Add guild_id column for multi-server support
    try:
        cur.execute("ALTER TABLE challenge_matches ADD COLUMN guild_id INTEGER")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()


def update_elo(player_elo, opponent_elo, did_win, k=32):
    """
    Update Elo rating.

    :param player_elo: Current player's Elo rating
    :param opponent_elo: Opponent's Elo rating
    :param did_win: True if player won, False if lost
    :param k: K-factor (default = 32)
    :return: Updated Elo rating
    """
    expected_score = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
    actual_score = 1 if did_win else 0
    new_elo = player_elo + k * (actual_score - expected_score)
    return round(new_elo)


def update_elo_db(user_id, user_display_name, did_win, opponent_id):
    """Update the ELO database with match results."""
    conn = sqlite3.connect("elo.db")
    cur = conn.cursor()
    print(user_id, opponent_id)

    cur.execute("""CREATE TABLE IF NOT EXISTS overall_standings
                   (user_id INTEGER PRIMARY KEY, 
                    user_display_name TEXT,
                    elo INTEGER DEFAULT 1500
                   )""")

    # Get player's current ELO (or insert if new)
    cur.execute("SELECT elo FROM overall_standings WHERE user_id=?", (user_id,))
    player_row = cur.fetchone()

    if player_row:
        player_elo = player_row[0]
        print("Existing player found with ELO:", player_elo)
    else:
        player_elo = 1500
        cur.execute(
            """INSERT OR IGNORE INTO overall_standings 
               (user_id, user_display_name, elo) VALUES (?, ?, ?)""",
            (user_id, user_display_name, player_elo),
        )
        print("New player inserted with default ELO:", player_elo)

    # Get opponent's ELO (or use default if not found)
    cur.execute("SELECT elo FROM overall_standings WHERE user_id=?", (opponent_id,))
    opponent_row = cur.fetchone()

    if opponent_row:
        opponent_elo = opponent_row[0]
        print("Opponent found with ELO:", opponent_elo)
    else:
        opponent_elo = 1500
        print("Opponent not found, using default ELO:", opponent_elo)

    # Calculate new ELO
    new_player_elo = update_elo(player_elo, opponent_elo, did_win)
    elo_change = new_player_elo - player_elo
    print(
        f"New ELO calculated: {player_elo} -> {new_player_elo} (change: {elo_change:+d})"
    )

    # Update player's ELO
    cur.execute(
        "UPDATE overall_standings SET elo = ? WHERE user_id = ?",
        (new_player_elo, user_id),
    )

    conn.commit()
    conn.close()

    print(f"Player {user_id} ELO updated to {new_player_elo}")
    return new_player_elo, elo_change


def get_user_elo(user_id: int) -> int:
    """
    Get a user's current ELO from the database.

    Args:
        user_id: The Discord user ID

    Returns:
        The user's current ELO, or 1500 if not found
    """
    conn = sqlite3.connect("elo.db")
    cur = conn.cursor()
    cur.execute("SELECT elo FROM overall_standings WHERE user_id=?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 1500


async def winner_report(
    reporter_id,
    user_id,
    user_display_name,
    did_win,
    opponent_id,
    opponent_display_name,
    first_player,
    match_time,
    curiosa_link,
    match_comment,
    interaction_user_id,
    interaction_global,
    guild_id=None,
    guild_name=None,
    winner_deck_url=None,
    loser_deck_url=None,
):
    """
    Log a win in the database.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name (required for non-Summit servers)

    Returns:
        Tuple of (match_id, winner_id, loser_id)
    """
    logger.info(f"Logging win for user {interaction_global} in guild {guild_id}")

    # Determine if this is Summit server (has ELO) or other server (no ELO)
    is_summit = guild_id == SUMMIT_GUILD_ID

    # Ensure the appropriate table exists
    if is_summit:
        create_db()
        table_name = "match_records"
    else:
        create_server_match_table(guild_id, guild_name)
        table_name = get_match_table_name(guild_id, guild_name)

    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    # Fetch deck data for both players
    json_deck_data_winner = "{}"
    json_deck_data_loser = "{}"

    # Use new deck URLs if provided, otherwise fall back to old curiosa_link
    if winner_deck_url:
        json_deck_data_winner = scrape_Curosa(winner_deck_url, "deck_data_test.json")
    elif curiosa_link and curiosa_link != "No URL provided":
        # Backward compatibility: if only one URL provided, assume it's winner's
        json_deck_data_winner = scrape_Curosa(curiosa_link, "deck_data_test.json")

    if loser_deck_url:
        json_deck_data_loser = scrape_Curosa(loser_deck_url, "deck_data_test.json")

    # Only update ELO for Summit server
    winner_elo_change = None
    loser_elo_change = None
    if is_summit:
        new_elo, elo_change = update_elo_db(
            interaction_user_id, interaction_global, did_win, opponent_id
        )
        # For winner_report, did_win is True so this is the winner's elo change
        winner_elo_change = elo_change
        loser_elo_change = -elo_change  # Approximate: loser loses roughly what winner gains

    if is_summit:
        # Summit table has ELO columns
        cur.execute(
            f"INSERT INTO {table_name} (reporter_id, winner_id, winner_display_name, "
            "losser_id, losser_display_name, did_win, timestamp, first_player, match_time, "
            "curiosa_url, curiosa_url_winner, curiosa_url_loser, match_comment, "
            "json_deck_data, json_deck_data_winner, json_deck_data_loser, winner_elo_change, loser_elo_change, guild_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                reporter_id,
                user_id,
                user_display_name,
                opponent_id,
                opponent_display_name,
                did_win,
                datetime.datetime.now().isoformat(),
                first_player,
                match_time,
                curiosa_link,
                winner_deck_url or curiosa_link,
                loser_deck_url,
                match_comment,
                json_deck_data_winner,
                json_deck_data_winner,
                json_deck_data_loser,
                winner_elo_change,
                loser_elo_change,
                guild_id,
            ),
        )
    else:
        # Non-Summit table has no ELO columns
        cur.execute(
            f"INSERT INTO {table_name} (reporter_id, winner_id, winner_display_name, "
            "losser_id, losser_display_name, did_win, timestamp, first_player, match_time, "
            "curiosa_url, curiosa_url_winner, curiosa_url_loser, match_comment, "
            "json_deck_data, json_deck_data_winner, json_deck_data_loser, guild_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                reporter_id,
                user_id,
                user_display_name,
                opponent_id,
                opponent_display_name,
                did_win,
                datetime.datetime.now().isoformat(),
                first_player,
                match_time,
                curiosa_link,
                winner_deck_url or curiosa_link,
                loser_deck_url,
                match_comment,
                json_deck_data_winner,
                json_deck_data_winner,
                json_deck_data_loser,
                guild_id,
            ),
        )

    match_id = cur.lastrowid
    conn.commit()
    conn.close()

    return (match_id, user_id, opponent_id)


async def losser_report(
    reporter_id,
    user_id,
    user_display_name,
    did_win,
    opponent_id,
    opponent_display_name,
    first_player,
    match_time,
    curiosa_link,
    match_comment,
    interaction_user_id,
    interaction_global,
    guild_id=None,
    guild_name=None,
    winner_deck_url=None,
    loser_deck_url=None,
):
    """
    Log a loss in the database.

    Args:
        guild_id: The Discord guild ID
        guild_name: The guild name (required for non-Summit servers)

    Returns:
        Tuple of (match_id, winner_id, loser_id)
    """
    logger.info(f"Logging loss for user {interaction_global} in guild {guild_id}")

    # Determine if this is Summit server (has ELO) or other server (no ELO)
    is_summit = guild_id == SUMMIT_GUILD_ID

    # Ensure the appropriate table exists
    if is_summit:
        create_db()
        table_name = "match_records"
    else:
        create_server_match_table(guild_id, guild_name)
        table_name = get_match_table_name(guild_id, guild_name)

    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    # Fetch deck data for both players
    json_deck_data_winner = "{}"
    json_deck_data_loser = "{}"

    # Use new deck URLs if provided, otherwise fall back to old curiosa_link
    if winner_deck_url:
        json_deck_data_winner = scrape_Curosa(winner_deck_url, "deck_data_test.json")

    if loser_deck_url:
        json_deck_data_loser = scrape_Curosa(loser_deck_url, "deck_data_test.json")
    elif curiosa_link and curiosa_link != "No URL provided":
        # Backward compatibility: if only one URL provided, assume it's loser's
        json_deck_data_loser = scrape_Curosa(curiosa_link, "deck_data_test.json")

    # Only update ELO for Summit server
    winner_elo_change = None
    loser_elo_change = None
    if is_summit:
        new_elo, elo_change = update_elo_db(
            interaction_user_id, interaction_global, did_win, opponent_id
        )
        # For losser_report, did_win is False so this is the loser's elo change
        loser_elo_change = elo_change
        winner_elo_change = -elo_change  # Approximate: winner gains roughly what loser loses

    if is_summit:
        # Summit table has ELO columns
        cur.execute(
            f"INSERT INTO {table_name} (reporter_id, winner_id, winner_display_name, "
            "losser_id, losser_display_name, did_win, timestamp, first_player, match_time, "
            "curiosa_url, curiosa_url_winner, curiosa_url_loser, match_comment, "
            "json_deck_data, json_deck_data_winner, json_deck_data_loser, winner_elo_change, loser_elo_change, guild_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                reporter_id,
                user_id,
                user_display_name,
                opponent_id,
                opponent_display_name,
                did_win,
                datetime.datetime.now().isoformat(),
                first_player,
                match_time,
                curiosa_link,
                winner_deck_url,
                loser_deck_url or curiosa_link,
                match_comment,
                json_deck_data_loser,
                json_deck_data_winner,
                json_deck_data_loser,
                winner_elo_change,
                loser_elo_change,
                guild_id,
            ),
        )
    else:
        # Non-Summit table has no ELO columns
        cur.execute(
            f"INSERT INTO {table_name} (reporter_id, winner_id, winner_display_name, "
            "losser_id, losser_display_name, did_win, timestamp, first_player, match_time, "
            "curiosa_url, curiosa_url_winner, curiosa_url_loser, match_comment, "
            "json_deck_data, json_deck_data_winner, json_deck_data_loser, guild_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                reporter_id,
                user_id,
                user_display_name,
                opponent_id,
                opponent_display_name,
                did_win,
                datetime.datetime.now().isoformat(),
                first_player,
                match_time,
                curiosa_link,
                winner_deck_url,
                loser_deck_url or curiosa_link,
                match_comment,
                json_deck_data_loser,
                json_deck_data_winner,
                json_deck_data_loser,
                guild_id,
            ),
        )

    match_id = cur.lastrowid
    conn.commit()
    conn.close()

    return (match_id, user_id, opponent_id)


def get_total_match_count(guild_id: int = None, guild_name: str = None):
    """
    Get the total number of matches recorded in the database.

    Args:
        guild_id: Optional guild ID to filter by (None = Summit/global)
        guild_name: Optional guild name (required for non-Summit servers)

    Returns:
        The match count
    """
    if guild_id is None or guild_id == SUMMIT_GUILD_ID:
        table_name = "match_records"
    else:
        table_name = get_match_table_name(guild_id, guild_name)

    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    try:
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cur.fetchone()[0]
    except sqlite3.OperationalError:
        # Table doesn't exist yet
        count = 0

    conn.close()
    return count


def check_milestone(match_id, guild_id: int = None, guild_name: str = None):
    """
    Check if the current match is a milestone (every 100 matches).

    Args:
        match_id: The ID of the just-recorded match
        guild_id: Optional guild ID for server-specific milestone checking
        guild_name: Optional guild name (required for non-Summit servers)

    Returns:
        int or None: The milestone number if this is a milestone match, None otherwise
    """
    total_matches = get_total_match_count(guild_id, guild_name)
    if total_matches > 0 and total_matches % 100 == 0:
        return total_matches
    return None


async def save_challenge_match(
    challenger_id: int,
    challenged_id: int,
    status: str,
    winner_id: int = None,
    guild_id: int = None,
):
    """
    Save a challenge match to the database.

    Args:
        challenger_id: ID of the player who initiated the challenge
        challenged_id: ID of the player who was challenged
        status: Match status ('pending', 'completed', 'declined', 'cancelled')
        winner_id: ID of the winning player (if match is completed)
        guild_id: ID of the guild where the match occurred
    """
    # Ensure the challenge_matches table exists, then open a connection directly.
    create_challenge_db()
    conn = sqlite3.connect("match_records.db")
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO challenge_matches
            (challenger_id, challenged_id, status, match_time, winner_id, guild_id)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        """,
            (challenger_id, challenged_id, status, winner_id, guild_id),
        )
        conn.commit()
    except Exception as e:
        logger.error(f"Error saving challenge match: {e}")
    finally:
        conn.close()


class DatabaseConnection:
    def __init__(self, db_name):
        self.db_name = db_name

    async def __aenter__(self):
        self.conn = sqlite3.connect(self.db_name)
        return self.conn.cursor()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.commit()
            self.conn.close()


async def solo_match_report(
    reporter_id: int,
    reporter_global: str,
    opponent_name: str,
    is_winner: bool,
    first_player: str,
    match_time: int,
    curiosa_link: str,
    match_comment: str,
) -> int:
    """
    Save a solo match report to the database.

    Args:
        reporter_id: Discord ID of the reporting player
        reporter_global: Global name of the reporting player
        opponent_name: Name of the opponent (manually entered)
        is_winner: True if reporter won, False if lost
        first_player: 'y' if reporter went first, 'n' if not
        match_time: Duration of match in minutes
        curiosa_link: URL to Curiosa deck
        match_comment: Additional match notes

    Returns:
        The report_id of the newly created report
    """
    logger.info(f"Logging solo match report for user {reporter_global}")
    create_db()  # Ensure tables exist
    conn = sqlite3.connect("match_records.db")
    cur = conn.cursor()

    json_deck_data = "{}"
    if curiosa_link and curiosa_link != "No URL provided":
        json_deck_data = scrape_Curosa(curiosa_link, "deck_data_test.json")

    cur.execute(
        """INSERT INTO solo_match_reports 
           (reporter_id, reporter_name, opponent_name, is_winner, 
            first_player, match_time, curiosa_link, match_comment, 
            report_date, json_deck_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)""",
        (
            reporter_id,
            reporter_global,
            opponent_name,
            is_winner,
            first_player,
            match_time,
            curiosa_link,
            match_comment,
            json_deck_data,
        ),
    )

    report_id = cur.lastrowid
    conn.commit()
    conn.close()

    return report_id
