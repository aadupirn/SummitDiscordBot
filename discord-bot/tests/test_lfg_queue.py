"""
Unit tests for LFG queue system
Critical tests to run before deploying error fixes to production
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import queue functions
from cogs.lfg import get_guild_queue, lfg_queues


def clean_expired_lfg_standalone(guild_id: int = None):
    """
    Standalone version of clean_expired_lfg for testing.
    Matches the logic in LFGCog.clean_expired_lfg method.
    """
    now = datetime.now()

    if guild_id:
        # Clean specific guild's queue
        guild_queue = get_guild_queue(guild_id)
        expired = [
            user_id
            for user_id, info in guild_queue.items()
            if (now - info["timestamp"]).total_seconds() > info["timeframe"] * 60
        ]
        for user_id in expired:
            guild_queue.pop(user_id)
    else:
        # Clean all guild queues
        for gid in list(lfg_queues.keys()):
            guild_queue = lfg_queues[gid]
            expired = [
                user_id
                for user_id, info in guild_queue.items()
                if (now - info["timestamp"]).total_seconds() > info["timeframe"] * 60
            ]
            for user_id in expired:
                guild_queue.pop(user_id)


class TestGuildQueueIsolation:
    """Test that queues are properly isolated per guild"""

    def setup_method(self):
        """Clear queues before each test"""
        lfg_queues.clear()

    def test_guild_queue_isolation(self):
        """Verify queues are isolated per guild"""
        queue1 = get_guild_queue(111)
        queue2 = get_guild_queue(222)

        # Add entry to guild 111
        queue1[123] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}

        # Verify isolation
        assert 123 in queue1, "Player should be in guild 111 queue"
        assert 123 not in queue2, "Player should NOT be in guild 222 queue"

    def test_multiple_players_same_guild(self):
        """Verify multiple players can be in same guild queue"""
        queue = get_guild_queue(333)

        queue[100] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}
        queue[200] = {"timestamp": datetime.now(), "timeframe": 45, "deck_url": "https://example.com"}
        queue[300] = {"timestamp": datetime.now(), "timeframe": 60, "deck_url": None}

        assert len(queue) == 3, "Guild should have 3 players in queue"
        assert all(player_id in queue for player_id in [100, 200, 300])

    def test_same_player_different_guilds(self):
        """Verify same player ID can be in different guild queues"""
        queue1 = get_guild_queue(444)
        queue2 = get_guild_queue(555)

        player_id = 999
        queue1[player_id] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}
        queue2[player_id] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}

        assert player_id in queue1, "Player should be in guild 444"
        assert player_id in queue2, "Player should be in guild 555"


class TestQueueExpiry:
    """Test queue expiration logic"""

    def setup_method(self):
        """Clear queues before each test"""
        lfg_queues.clear()

    def test_expired_entry_removed(self):
        """Verify expired entries are removed by clean_expired_lfg_standalone"""
        guild_id = 666
        queue = get_guild_queue(guild_id)

        # Add expired entry (35 minutes old, 30 min timeframe)
        expired_time = datetime.now() - timedelta(minutes=35)
        queue[456] = {"timestamp": expired_time, "timeframe": 30, "deck_url": None}

        # Add valid entry (5 minutes old, 30 min timeframe)
        valid_time = datetime.now() - timedelta(minutes=5)
        queue[789] = {"timestamp": valid_time, "timeframe": 30, "deck_url": None}

        # Clean expired entries
        clean_expired_lfg_standalone(guild_id)

        # Verify results
        assert 456 not in queue, "Expired entry should be removed"
        assert 789 in queue, "Valid entry should remain"

    def test_different_timeframes(self):
        """Test expiry with different timeframes"""
        guild_id = 777
        queue = get_guild_queue(guild_id)

        now = datetime.now()

        # Player 1: 20 min old, 15 min timeframe = EXPIRED
        queue[100] = {"timestamp": now - timedelta(minutes=20), "timeframe": 15, "deck_url": None}

        # Player 2: 20 min old, 30 min timeframe = VALID
        queue[200] = {"timestamp": now - timedelta(minutes=20), "timeframe": 30, "deck_url": None}

        # Player 3: 50 min old, 60 min timeframe = VALID
        queue[300] = {"timestamp": now - timedelta(minutes=50), "timeframe": 60, "deck_url": None}

        # Player 4: 70 min old, 60 min timeframe = EXPIRED
        queue[400] = {"timestamp": now - timedelta(minutes=70), "timeframe": 60, "deck_url": None}

        clean_expired_lfg_standalone(guild_id)

        assert 100 not in queue, "Player 1 should be expired"
        assert 200 in queue, "Player 2 should be valid"
        assert 300 in queue, "Player 3 should be valid"
        assert 400 not in queue, "Player 4 should be expired"

    def test_clean_all_guilds(self):
        """Verify clean_expired_lfg_standalone(None) cleans all guilds"""
        expired_time = datetime.now() - timedelta(minutes=35)

        # Add expired entries to multiple guilds
        for guild_id in [111, 222, 333]:
            queue = get_guild_queue(guild_id)
            queue[guild_id] = {
                "timestamp": expired_time,
                "timeframe": 30,
                "deck_url": None
            }

        # Clean all guilds
        clean_expired_lfg_standalone(guild_id=None)

        # Verify all expired entries removed
        for guild_id in [111, 222, 333]:
            queue = get_guild_queue(guild_id)
            assert guild_id not in queue, f"Guild {guild_id} should have expired entry removed"

    def test_empty_queue_cleanup(self):
        """Verify cleanup works on empty queues without error"""
        guild_id = 888
        queue = get_guild_queue(guild_id)

        assert len(queue) == 0, "Queue should start empty"

        # Should not raise error
        clean_expired_lfg_standalone(guild_id)

        assert len(queue) == 0, "Queue should remain empty"


class TestQueueDataStructure:
    """Test queue data structure and access patterns"""

    def setup_method(self):
        """Clear queues before each test"""
        lfg_queues.clear()

    def test_queue_entry_structure(self):
        """Verify queue entries have correct structure"""
        guild_id = 999
        player_id = 12345
        queue = get_guild_queue(guild_id)

        timestamp = datetime.now()
        timeframe = 45
        deck_url = "https://curiosa.io/decks/test"

        queue[player_id] = {
            "timestamp": timestamp,
            "timeframe": timeframe,
            "deck_url": deck_url
        }

        entry = queue[player_id]
        assert "timestamp" in entry, "Entry should have timestamp"
        assert "timeframe" in entry, "Entry should have timeframe"
        assert "deck_url" in entry, "Entry should have deck_url"
        assert entry["timestamp"] == timestamp
        assert entry["timeframe"] == timeframe
        assert entry["deck_url"] == deck_url

    def test_queue_creation_on_access(self):
        """Verify get_guild_queue creates queue if not exists"""
        new_guild_id = 10001

        # Access queue that doesn't exist
        queue = get_guild_queue(new_guild_id)

        # Should create empty queue
        assert new_guild_id in lfg_queues, "Guild should be added to lfg_queues"
        assert len(queue) == 0, "New queue should be empty"
        assert isinstance(queue, dict), "Queue should be a dictionary"

    def test_multiple_accesses_same_queue(self):
        """Verify multiple accesses return same queue object"""
        guild_id = 10002

        queue1 = get_guild_queue(guild_id)
        queue2 = get_guild_queue(guild_id)

        # Should be the same object
        assert queue1 is queue2, "Should return same queue object"

        # Modifications should be visible in both references
        queue1[100] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}
        assert 100 in queue2, "Modification should be visible in queue2"


class TestQueueOperations:
    """Test common queue operations"""

    def setup_method(self):
        """Clear queues before each test"""
        lfg_queues.clear()

    def test_player_removal(self):
        """Test removing player from queue"""
        guild_id = 10003
        player_id = 5000
        queue = get_guild_queue(guild_id)

        # Add player
        queue[player_id] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}
        assert player_id in queue

        # Remove player
        del queue[player_id]
        assert player_id not in queue

    def test_queue_size_tracking(self):
        """Test tracking queue size"""
        guild_id = 10004
        queue = get_guild_queue(guild_id)

        assert len(queue) == 0, "Initial queue should be empty"

        # Add players
        for i in range(5):
            queue[i] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}

        assert len(queue) == 5, "Queue should have 5 players"

        # Remove players
        for i in range(3):
            del queue[i]

        assert len(queue) == 2, "Queue should have 2 players remaining"

    def test_deck_url_optional(self):
        """Test that deck_url can be None"""
        guild_id = 10005
        queue = get_guild_queue(guild_id)

        # Entry without deck URL
        queue[100] = {"timestamp": datetime.now(), "timeframe": 30, "deck_url": None}

        # Entry with deck URL
        queue[200] = {
            "timestamp": datetime.now(),
            "timeframe": 30,
            "deck_url": "https://curiosa.io/decks/123"
        }

        assert queue[100]["deck_url"] is None
        assert queue[200]["deck_url"] is not None


if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
