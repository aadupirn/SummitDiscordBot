"""
Test script to verify database migration for discord_invite_link column
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.server_config import (
    create_server_config_db,
    set_server_config,
    get_server_config,
    get_server_invite_link,
    SUMMIT_GUILD_ID,
)


def test_database_migration():
    """Test that the database migration works correctly"""
    print("Testing database migration...")

    # Step 1: Create/migrate database
    print("1. Creating/migrating database...")
    create_server_config_db()
    print("   [OK] Database created/migrated successfully")

    # Step 2: Test Summit server (hardcoded values)
    print("\n2. Testing Summit server configuration...")
    summit_config = get_server_config(SUMMIT_GUILD_ID)
    assert summit_config is not None, "Summit config should not be None"
    assert (
        summit_config.get("discord_invite_link") == "https://discord.gg/aV8dx5WF"
    ), "Summit invite link should be hardcoded"
    print("   [OK] Summit server config correct")

    # Step 3: Test Summit invite link helper
    print("\n3. Testing get_server_invite_link() for Summit...")
    summit_invite = get_server_invite_link(SUMMIT_GUILD_ID)
    assert summit_invite == "https://discord.gg/aV8dx5WF", "Summit invite should match"
    print(f"   [OK] Summit invite link: {summit_invite}")

    # Step 4: Test creating new server config with invite link
    print("\n4. Testing new server config with invite link...")
    test_guild_id = 999999999999999999
    test_invite = "https://discord.gg/testserver123"

    success = set_server_config(
        guild_id=test_guild_id,
        guild_name="Test Server",
        lfg_channel_id=123456789,
        match_report_channel_id=987654321,
        leaderboard_channel_id=111111111,
        milestone_channel_id=222222222,
        discord_invite_link=test_invite,
    )
    assert success, "Setting server config should succeed"
    print("   [OK] Server config saved")

    # Step 5: Verify the config was saved correctly
    print("\n5. Verifying saved config...")
    config = get_server_config(test_guild_id)
    assert config is not None, "Config should not be None"
    assert config.get("guild_id") == test_guild_id
    assert config.get("guild_name") == "Test Server"
    assert config.get("discord_invite_link") == test_invite
    print(f"   [OK] Config retrieved: {config.get('guild_name')}")
    print(f"   [OK] Invite link: {config.get('discord_invite_link')}")

    # Step 6: Test get_server_invite_link helper
    print("\n6. Testing get_server_invite_link() helper...")
    invite_link = get_server_invite_link(test_guild_id)
    assert invite_link == test_invite, "Invite link should match"
    print(f"   [OK] Invite link helper: {invite_link}")

    # Step 7: Test updating config with None invite link
    print("\n7. Testing update with None invite link...")
    success = set_server_config(
        guild_id=test_guild_id,
        guild_name="Test Server Updated",
        lfg_channel_id=123456789,
        match_report_channel_id=987654321,
        discord_invite_link=None,
    )
    assert success, "Updating config should succeed"
    config = get_server_config(test_guild_id)
    assert config.get("discord_invite_link") is None
    print("   [OK] Config updated with None invite link")

    # Step 8: Test get_server_invite_link returns None
    print("\n8. Testing get_server_invite_link() returns None...")
    invite_link = get_server_invite_link(test_guild_id)
    assert invite_link is None, "Invite link should be None"
    print("   [OK] Invite link helper returns None correctly")

    # Step 9: Test non-existent server
    print("\n9. Testing non-existent server...")
    fake_guild_id = 111111111111111111
    invite_link = get_server_invite_link(fake_guild_id)
    assert invite_link is None, "Non-existent server should return None"
    print("   [OK] Non-existent server returns None")

    print("\n" + "=" * 50)
    print("[PASS] ALL TESTS PASSED!")
    print("=" * 50)
    print("\nDatabase migration successful.")
    print("The discord_invite_link column has been added and is working correctly.")


if __name__ == "__main__":
    try:
        test_database_migration()
    except AssertionError as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
