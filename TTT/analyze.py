import json

from tqdm import tqdm
import numpy as np

from logparser import query


def players():
    res = query("SELECT COUNT(mid), player as count FROM participates GROUP BY player")
    body = ["""
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">Player</th>
                    <th scope="col">rounds</th>
                </tr>
            </thead>
            <tbody>
    """]
    body.extend([f"<tr><td>{p}</td><td>{c}</td></tr>" for c, p in res])
    body.append("</tbody></table>")
    card = {
        'header': 'Players',
        'body': ''.join(body)
    }
    return card


def maps():
    res = query("SELECT COUNT(mid) as count, map FROM match GROUP BY map")
    body = ["""
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">Map</th>
                    <th scope="col">count</th>
                </tr>
            </thead>
            <tbody>
    """]
    body.extend([f"<tr><td>{m}</td><td>{c}</td></tr>" for c, m in res])
    body.append("</tbody></table>")
    card = {
        'header': 'Maps',
        'body': ''.join(body)
    }
    return card
    
    
def win_loss():
    win = query("SELECT part.player, COUNT(part.mid) as wins \
    FROM participates as part JOIN match ON part.mid == match.mid JOIN roles on part.role == roles.role \
    WHERE roles.team = match.result GROUP BY part.player ORDER BY part.player")
    loss = query("SELECT part.player, COUNT(part.mid) as wins \
    FROM participates as part JOIN match ON part.mid == match.mid JOIN roles on part.role == roles.role \
    WHERE roles.team != match.result GROUP BY part.player ORDER BY part.player")
    players = [p for p, c in win]
    wins = [c for p, c in win]
    losses = [c for p, c in loss]
    quotes = [np.round(w / (w+l), decimals=3) for w, l in zip(wins, losses)]
    data = list(zip(players, wins, losses, quotes))
    data.sort(key=lambda d: d[3], reverse=True)
    body = ["""
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">Player</th>
                    <th scope="col">wins</th>
                    <th scope="col">losses</th>
                    <th scope="col">quote</th>
                </tr>
            </thead>
            <tbody>
    """]
    body.extend([f"<tr><td>{p}</td><td>{w}</td><td>{l}</td><td>{q}</td></tr>" for p, w, l, q in data])
    body.append("</tbody></table>")
    card = {
        'header': 'Siege',
        'body': ''.join(body)
    }
    return card
    
    
if __name__ == "__main__":
    cards = []
    
    queries = [
        ("Played games", "SELECT COUNT(mid) as matches FROM match"),
        ("Who won how often?", "SELECT COUNT(mid) as wins, result as team FROM match GROUP BY result")
    ]
    for q in tqdm(queries):
        res = query(q[1])  # list of tuples
        res = [str(e) for tuple in res for e in tuple]
        res = " ".join(res)
        cards.append({"header": q[0], "body": res})
        
    cards.append(players())
    cards.append(maps())
    cards.append(win_loss())
        
    with open("./Frontend/cards.js", "w") as f:
        f.write("const cards = ")
        f.write(json.dumps(cards).replace("\n", "").replace("'", "\""))
        f.write(";")