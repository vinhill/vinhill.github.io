import re
import sqlite3
from datetime import datetime

import pandas as pd
from tqdm import tqdm


def get_regexes():
    """
    Example lines we want to extract
        Client "Poci" spawned in server <STEAM_0:1:202841564> (took 41 seconds).
        Dropped "V8Block" from server<STEAM_0:1:146926915>
        Poci (STEAM_0:1:202841564) - Traitor
        Schnitzelboy (STEAM_0:1:64530231) - Assassin
        ServerLog: 01:30.69 - DMG: 	 Schnitzelboy [assassin] damaged GhastM4n [mercenary] for 40 dmg
        ServerLog: 01:36.33 - KILL:	 Schnitzelboy [assassin] killed V8Block [innocent]
        ServerLog: Result: Traitors win.
        Map: ttt_mw2_terminal
        ServerLog: Round proper has begun...
        
    Returns
    -------
    join_re, leave_re, fight_re, role_re, result_re, map_re, start_re
    """
    # assumes steam names are alphanumeric (a-zA-Z0-9)
    join_re = re.compile(r'Client "(?P<steam_name>\w*)" spawned in server <(?P<steam_id>STEAM_[0-9:]*)> .*')
    leave_re = re.compile(r'Dropped "(?P<steam_name>\w*)" from server<(?P<steam_id>STEAM_[0-9:]*)>')
    fight_re = re.compile(r'ServerLog: (?P<time>[0-9:.]*) - (?P<type>DMG|KILL):\s+(?P<atk_name>\w*) \[(?P<atk_role>\w*)\] (damaged|killed) (?P<vkt_name>\w*) \[(?P<vkt_role>\w*)\]( for (?P<dmg>[0-9]*) dmg)?')
    role_re = re.compile(r'(?P<name>\w*) \(STEAM_[0-9:]*\) - (?P<role>\w*)')
    result_re = re.compile(r'ServerLog: Result: (?P<group>Innocent|Traitors|Killer|Jester) wins?.')
    map_re = re.compile(r'Map: (?P<map>.*)')
    start_re = re.compile(r'ServerLog: Round proper has begun...')
    return join_re, leave_re, fight_re, role_re, result_re, map_re, start_re


def create_database():
    db = sqlite3.connect('ttt.db')
    
    cur = db.cursor()
    cur.execute("DROP TABLE IF EXISTS match")
    cur.execute("DROP TABLE IF EXISTS player")
    cur.execute("DROP TABLE IF EXISTS participates")
    cur.execute("DROP TABLE IF EXISTS kills")
    cur.execute("DROP TABLE IF EXISTS damages")
    cur.execute("DROP TABLE IF EXISTS roles")
    
    # create table linking roles e.g. vampire and group e.g. traitor
    cur.execute("CREATE TABLE roles (role TEXT, team TEXT)")
    cur.executemany("INSERT INTO roles (role, team) VALUES (?, ?)", [
        ("Assassin", "Traitors"),
        ("Traitor", "Traitors"),
        ("Zombie", "Traitors"),
        ("Vampire", "Traitors"),
        ("Hypnotist", "Traitors"),
        ("Killer", "Killer"),
        ("Jester", "Jester"),
        ("Innocent", "Innocent"),
        ("Glitch", "Innocent"),
        ("Detective", "Innocent"),
        ("Phantom", "Innocent"),
        ("Mercenary", "Innocent"),
        ("Swapper", "None")
    ])
    
    cur.execute("CREATE TABLE match (mid INTEGER PRIMARY KEY, map TEXT, result REFERENCES roles(team), date TEXT)")
    cur.execute("CREATE TABLE player (name TEXT PRIMARY KEY)")
    cur.execute("CREATE TABLE participates (mid REFERENCES match(mid), player REFERENCES player(name), role REFERENCES roles(role))")
    cur.execute("CREATE TABLE kills (mid REFERENCES match(mid), attacker REFERENCES player(name), victim REFERENCES player(name), atkrole  REFERENCES roles(role), vktrole  REFERENCES roles(role), time TEXT)")
    cur.execute("CREATE TABLE damages (mid REFERENCES match(mid), attacker REFERENCES player(name), victim REFERENCES player(name), atkrole  REFERENCES roles(role), vktrole  REFERENCES roles(role), time TEXT, damage INTEGER)")
    
    db.commit()
    db.close()


def update_db_through_log(path="console.log"):
    db = sqlite3.connect('ttt.db')
    cur = db.cursor()
    file = open(path, "r")
    join_re, leave_re, fight_re, role_re, result_re, map_re, start_re = get_regexes()
    
    date = datetime.today().strftime('%Y-%m-%d')
    clients = set()
    roles = dict()
    mid = None
    map = None
    
    
    for line in tqdm(file):
        if match := join_re.search(line):  # join
            clients.add(match.group("steam_name"))
            # add player to player table, if it doesn't exist
            cur.execute(
                "INSERT OR IGNORE INTO player (name) VALUES (?)",
                (match.group("steam_name"),)
            )
        elif match := leave_re.search(line):  # leave
            clients.remove(match.group("steam_name"))
            roles.pop(match.group("steam_name"), None)
        elif match := map_re.search(line):  # map
            map = match.group("map")
        elif match := role_re.search(line):  # role assignment
            roles[match.group("name")] = match.group("role")
        elif match := start_re.search(line):  # round started
            cur.execute(
                "INSERT INTO match (map, date) VALUES (?, ?)",
                (map, date)
            )
            mid = cur.lastrowid
            db.executemany(
                "INSERT INTO participates (mid, player, role) VALUES (?, ?, ?)",
                [
                    (mid, p, r) for p, r in roles.items()
                ]
            )
        elif match := fight_re.search(line): # DMG or KILL
            attacker = match.group("atk_name")
            victim = match.group("vkt_name")
            atkrole = match.group("atk_role")
            vktrole = match.group("vkt_role")
            time = match.group("time")
            if match.group("type") == "DMG":
                db.execute(
                    "INSERT INTO damages (mid, attacker, victim, atkrole, vktrole, time, damage) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (mid, attacker, victim, atkrole, vktrole, time, match.group("dmg"))
                )
            else:
                db.execute(
                    "INSERT INTO kills (mid, attacker, victim, atkrole, vktrole, time) VALUES (?, ?, ?, ?, ?, ?)",
                    (mid, attacker, victim, atkrole, vktrole, time)
                )
        elif match := result_re.search(line):  # round result
            db.execute(
                "UPDATE match SET result = ? WHERE mid = ?",
                (match.group("group"), mid)
            )
    
    db.commit()
    db.close()


__singleton_connections = dict()
def get_connection(path='ttt.db'):
    if path not in __singleton_connections:
        __singleton_connections[path] = sqlite3.connect(path)
    return __singleton_connections[path]


def query_df(str):
    con = get_connection()
    res = pd.read_sql_query(str, con)
    return res
    
def query(str):
    cur = get_connection().cursor()
    cur.execute(str)
    return cur.fetchall()