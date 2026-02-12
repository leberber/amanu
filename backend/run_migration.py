"""
Run database migration to add brands table and brand_id column
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

# Read migration file
with open("migrations/add_brands.sql", "r") as f:
    migration_sql = f.read()

# Connect and run migration
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Execute migration
    cur.execute(migration_sql)
    conn.commit()

    print("✅ Migration completed successfully!")
    print("   - Created brands table")
    print("   - Added brand_id column to products table")
    print("   - Added foreign key constraint and indexes")

    cur.close()
    conn.close()

except Exception as e:
    print(f"❌ Migration failed: {e}")
    exit(1)
