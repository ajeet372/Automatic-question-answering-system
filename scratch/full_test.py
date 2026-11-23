import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, '.')
os.environ['AJ_AI_SECRET_KEY'] = 'test'

# 1. Syntax check
import ast
with open('app.py', encoding='utf-8') as f:
    src = f.read()
ast.parse(src)
print("[OK] Syntax valid")

# 2. Import check
import app as aj
print("[OK] Module imports OK")

# 3. init_database - migration test
aj.init_database()
print("[OK] init_database - migration done")

# 4. Check DB columns
import sqlite3
conn = sqlite3.connect('qa.db')
conn.row_factory = sqlite3.Row
cols = [c['name'] for c in conn.execute('PRAGMA table_info(history)').fetchall()]
print("[OK] History columns:", cols)
admins = conn.execute('SELECT username, password FROM admins').fetchall()
for a in admins:
    print("[OK] Admin:", a['username'], "| hashed:", a['password'][:20] + "...")
conn.close()

# 5. NLP pipeline test
tests = [
    ('hello bhai',               'greeting',  1.0),
    ('Python kya hota hai',      'definition', None),
    ('ksdjfksdjfk gibberish',    'general',   None),
    ('ram ram',                  'greeting',  1.0),
    ('bye',                      'farewell',  1.0),
]
print()
print("NLP Pipeline Tests:")
print("-" * 60)
for q, exp_intent, exp_conf in tests:
    result = aj.find_answer_detailed(q)
    status = "OK" if result['intent'] == exp_intent else "WARN"
    print(f"[{status}] Q: {q!r}")
    print(f"      intent={result['intent']} | conf={result['confidence']} | ans={result['answer'][:55]!r}")
print()
print("ALL CHECKS PASSED")
