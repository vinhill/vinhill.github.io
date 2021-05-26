import re
import sqlite3
from datetime import datetime
import shutil
import os

import pandas as pd
from tqdm import tqdm


def get_regexes():
    """
    Creates several regexes designed for extraction of relevant information from the log files.
    
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


def reset_database():
    """
    Resets and initializes the database. This function is used to
    define what tables there are and what scheme they have.
    """
    db = sqlite3.connect('ttt.db')
    cur = db.cursor()
    
    # remove old tables, if they exist (basically clear the database)
    cur.execute("DROP TABLE IF EXISTS match")
    cur.execute("DROP TABLE IF EXISTS player")
    cur.execute("DROP TABLE IF EXISTS participates")
    cur.execute("DROP TABLE IF EXISTS kills")
    cur.execute("DROP TABLE IF EXISTS damages")
    cur.execute("DROP TABLE IF EXISTS roles")
    
    # create table linking roles to teams e.g. vampire to traitor
    cur.execute("CREATE TABLE roles (role TEXT, team TEXT, colour TEXT)")
    cur.executemany("INSERT INTO roles (role, team, colour) VALUES (?, ?, ?)", [
        ("Assassin", "Traitors", "#843001"),
        ("Traitor", "Traitors", "#D60004"),
        ("Zombie", "Traitors", "#3D6F00"),
        ("Vampire", "Traitors", "#343434"),
        ("Hypnotist", "Traitors", "#FF40FF"),
        ("Killer", "Killer", "#37005D"),
        ("Jester", "Jester", "#BC05FF"),
        ("Innocent", "Innocent", "#01C700"),
        ("Glitch", "Innocent", "#FF6300"),
        ("Detective", "Innocent", "#1A22FF"),
        ("Phantom", "Innocent", "#00EAFD"),
        ("Mercenary", "Innocent", "#F3C100"),
        ("Swapper", "None", "#7800FF")
    ])
    
    # create tables for Entities match and player as well as relationships participates, kills and damages
    cur.execute("CREATE TABLE match (mid INTEGER PRIMARY KEY, map TEXT, result REFERENCES roles(team), date TEXT)")
    cur.execute("CREATE TABLE player (name TEXT PRIMARY KEY)")
    cur.execute("CREATE TABLE participates (mid REFERENCES match(mid), player REFERENCES player(name), role REFERENCES roles(role))")
    cur.execute("CREATE TABLE kills (mid REFERENCES match(mid), attacker REFERENCES player(name), victim REFERENCES player(name), atkrole  REFERENCES roles(role), vktrole  REFERENCES roles(role), time TEXT)")
    cur.execute("CREATE TABLE damages (mid REFERENCES match(mid), attacker REFERENCES player(name), victim REFERENCES player(name), atkrole  REFERENCES roles(role), vktrole  REFERENCES roles(role), time TEXT, damage INTEGER)")
    
    db.commit()
    db.close()


def update_db_through_log(logfile="console.log"):
    """
    Iterate over the lines in the logfile, extract relevant information and insert it into the database.
    """
    db = sqlite3.connect('ttt.db')
    cur = db.cursor()
    file = open(logfile, "r")
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
            atkrole = match.group("atk_role").capitalize()  # for some reason, this log entry isn't capitalized
            vktrole = match.group("vkt_role").capitalize()
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
    file.close()
    
    # move file to logs ordner
    # therby preventing one log to be inserted several times
    time = datetime.now().strftime('%Y.%m.%d %H,%M,%S')
    if not os.path.exists("./logs"):
        os.mkdir("./logs")
    shutil.copyfile(logfile, f"./logs/{time}.log")
    os.remove(logfile)


__singleton_connections = dict()
def get_connection(path='ttt.db'):
    """
    Implementation of a singleton in module form keeping track of one connection.
    
    Changes might or might not be persistent, if you don't call close_connections() afterwards.
    """
    if path not in __singleton_connections:
        __singleton_connections[path] = sqlite3.connect(path)
    return __singleton_connections[path]


def close_connections():
    """
    Close all connections that are managed by the singleton
    """
    for con in __singleton_connections.values():
        con.commit()
        con.close()


def query_df(str):
    """
    Send a query to the database and get the result as pandas DataFrame
    """
    con = get_connection()
    res = pd.read_sql_query(str, con)
    return res
    
def query(str):
    """
    Send a query to the database and get the result as tuple (names, result)
    where names is a list of column names and result is a list of rows, where each row is tuple.
    """
    cur = get_connection().cursor()
    cur.execute(str)
    names = [descr[0] for descr in cur.description]
    return names, cur.fetchall()


if __name__ == "__main__":
    update_db_through_log()