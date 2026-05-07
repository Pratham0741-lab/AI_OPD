"""Add weekdays and language columns to scheduled_calls table."""
import sqlite3

conn = sqlite3.connect("healthcare_voice.db")
c = conn.cursor()
c.execute("PRAGMA table_info(scheduled_calls)")
cols = [r[1] for r in c.fetchall()]

if "weekdays" not in cols:
    c.execute("ALTER TABLE scheduled_calls ADD COLUMN weekdays TEXT")
    print("Added: weekdays")

if "language" not in cols:
    c.execute('ALTER TABLE scheduled_calls ADD COLUMN language TEXT DEFAULT "en"')
    print("Added: language")

conn.commit()
conn.close()
print("Migration done.")
