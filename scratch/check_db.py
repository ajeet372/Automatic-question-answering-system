import sqlite3
conn = sqlite3.connect('qa.db')
conn.row_factory = sqlite3.Row

tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', [t[0] for t in tables])

try:
    admins = conn.execute('SELECT id, username, password FROM admins').fetchall()
    for a in admins:
        print('Admin ->', 'id:', a[0], '| username:', a[1], '| password:', a[2])
except Exception as e:
    print('Admin error:', e)

try:
    cols = conn.execute('PRAGMA table_info(history)').fetchall()
    print('History cols:', [c[1] for c in cols])
except Exception as e:
    print('History error:', e)

conn.close()
print('Done')
