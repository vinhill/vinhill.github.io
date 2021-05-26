import json
from typing import Dict, List

from tqdm import tqdm
import numpy as np
import matplotlib.pyplot as plt

from logparser import query


def hmtl_table(query_str):
    """
    Convert the result of a query to a html table
    """
    names, res = query(query_str)
    body = list()
    body.append('<table class="table"><thead><tr>')
    body.extend(f'<th scope="col">{h}</th>' for h in names)
    body.append("</tr></thead><tbody>")
    for row in res:
        body.append("<tr>")
        for val in row:
            body.append(f"<td>{val}</td>")
        body.append("</tr>")
    body.append("</tbody></table>")
    return ''.join(body)


def players():
    """
    Table card consisting of players and how many rounds they played
    """
    body = hmtl_table("SELECT player, COUNT(mid) as rounds FROM participates GROUP BY player ORDER BY rounds DESC")
    card = {
        'header': 'Players',
        'body': body
    }
    return card


def maps():
    """
    Table card consisting of maps and how often they were played
    """
    body = hmtl_table("SELECT map, COUNT(mid) as count FROM match GROUP BY map ORDER BY count DESC")
    card = {
        'header': 'Maps',
        'body': body
    }
    return card
    
    
def roles():
    """
    Donut chart displaying how often which roles appeared
    """
    _, values = query("SELECT role, COUNT(mid) as count FROM participates GROUP BY role ORDER BY count DESC")
    values = np.array(values)  # [[role, count], [role2, count2], ...]
    
    # see https://matplotlib.org/stable/gallery/pie_and_polar_charts/pie_and_donut_labels.html
    fig, ax = plt.subplots(figsize=(6, 3), subplot_kw=dict(aspect="equal"))
    wedges, texts = ax.pie(values[:, 1], wedgeprops=dict(width=0.5), startangle=-40)

    bbox_props = dict(boxstyle="square,pad=0.3", fc="w", ec="k", lw=0.72)
    kw = dict(arrowprops=dict(arrowstyle="-"),
              bbox=bbox_props, zorder=0, va="center")

    for i, p in enumerate(wedges):
        ang = (p.theta2 - p.theta1)/2. + p.theta1
        y = np.sin(np.deg2rad(ang))
        x = np.cos(np.deg2rad(ang))
        horizontalalignment = {-1: "right", 1: "left"}[int(np.sign(x))]
        connectionstyle = "angle,angleA=0,angleB={}".format(ang)
        kw["arrowprops"].update({"connectionstyle": connectionstyle})
        ax.annotate(values[i,0], xy=(x, y), xytext=(1.35*np.sign(x), 1.4*y),
                    horizontalalignment=horizontalalignment, **kw)

    plt.savefig("./Frontend/rolesdonut.jpg")
    plt.show()
    
    return {
        "header": "Roles",
        "image": "rolesdonut.jpg"
    }

    
def win_loss():
    """
    Table card consisting of players, how often they won and lost and what the win-loss-ratio is
    """
    _, win = query("SELECT part.player, COUNT(part.mid) as wins \
    FROM participates as part JOIN match ON part.mid == match.mid JOIN roles on part.role == roles.role \
    WHERE roles.team = match.result GROUP BY part.player ORDER BY part.player")
    _, loss = query("SELECT part.player, COUNT(part.mid) as wins \
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
    # cards is a list consisting of dictionaries, each representing one html card
    # a dictionary can have the keys header, image, body, text, footer and values being strings
    cards: List[Dict[str, str]] = []
    
    # quick text cards that display the result of queries
    queries = [
        ("Played games", "SELECT COUNT(mid) as matches FROM match"),
        ("Who won how often?", "SELECT COUNT(mid) as wins, result as team FROM match GROUP BY result")
    ]
    for q in tqdm(queries):
        _, res = query(q[1])  # list of tuples
        res = [str(e) for tuple in res for e in tuple]
        res = " ".join(res)
        cards.append({"header": q[0], "text": res})
        
    # more complex cards created by functions
    cards.append(players())
    cards.append(maps())
    cards.append(win_loss())
    cards.append(roles())
        
    # create a cards.js file containing the code for the cards list
    with open("./Frontend/cards.js", "w") as f:
        f.write("/* autogenerated file */\n")
        f.write("const cards = ")
        f.write(json.dumps(cards).replace("\n", "").replace("'", "\""))
        f.write(";")