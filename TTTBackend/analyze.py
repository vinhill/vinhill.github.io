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
    

def kills():
    """
    Table card consisting of players, their kills and false kills
    """
    body = hmtl_table("""
    SELECT
        a.player,
        a.kills,
        a.wrong,
        (a.kills - 2 * a.wrong) AS score,
        b.rounds,
        ROUND((CAST(a.kills - 2 * a.wrong AS float) / CAST(b.rounds AS float)), 2) AS killsPerGame
    FROM (
        SELECT
            attacker AS player,
            COUNT(*) AS kills,
            sum(case when atkroles.team = vktroles.team then 1 else 0 end) AS wrong
        FROM
            kills
            JOIN roles AS atkroles ON atkroles.role = kills.atkrole
            JOIN roles AS vktroles ON vktroles.role = kills.vktrole
        GROUP BY attacker
        ) a
    NATURAL JOIN (
        SELECT COUNT(mid) as rounds, player FROM participates GROUP BY player
    ) b
    ORDER BY score DESC
    """)
    card = {
        'header': 'Kills',
        'body': body
    }
    return card
    
    
def roles():
    """
    Donut chart displaying how often which roles appeared
    """
    _, values = query("""
        SELECT roles.role, COUNT(mid) as count, colour 
        FROM participates JOIN roles ON roles.role = participates.role 
        GROUP BY roles.role 
        ORDER BY count DESC
    """)
    values = np.array(values)  # [[role, count], [role2, count2], ...]
    
    fig = plt.figure()
    fig.set_figwidth(5)
    fig.set_figheight(7)
    
    # Donut chart
    ax = plt.subplot2grid(shape=(5, 5), loc=(0, 0), colspan=5, rowspan=5)
    ax.pie(values[:,1], colors=values[:,2], autopct='%1.1f%%', startangle=90, pctdistance=1.2)
    centre_circle = plt.Circle((0,0),0.70,fc='white')
    ax.add_artist(centre_circle)
    
    plt.legend(values[:,0], loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.3))
    """
    # Pie chart
    fig1, ax1 = plt.subplots()
    ax1.pie(values[:,1], colors=values[:,2], autopct='%1.1f%%', startangle=90, pctdistance=1.2)
    # Circle for making it donut
    centre_circle = plt.Circle((0,0),0.70,fc='white')
    fig = plt.gcf()
    fig.gca().add_artist(centre_circle)
    # Equal aspect ratio ensures that pie is drawn as a circle
    plt.legend(values[:,0], loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.7))
    plt.tight_layout()
    """
    plt.savefig("./Frontend/rolesdonut.jpg", bbox_inches='tight', pad_inches=0.1, dpi=300)
    
    return {
        "header": "Roles",
        "image": "rolesdonut.jpg"
    }
    
def win_loss(whereClause, header):
    """
    Table card consisting of players, their wins and losses and the quotient wins / (wins+losses)
    """
    body = hmtl_table("""
    SELECT
        a.player,
        a.wins,
        a.losses,
        ROUND(CAST(a.wins as float) / CAST(a.wins + a.losses as float), 3) AS quote
    FROM (
        SELECT
            participates.player AS player,
            sum(case when roles.team = match.result then 1 else 0 end) AS wins,
            sum(case when roles.team = match.result then 0 else 1 end) AS losses
        FROM
            participates
            JOIN roles ON participates.role == roles.role 
            JOIN match ON participates.mid == match.mid
        """ + whereClause + """
        GROUP BY participates.player
        ) a
    ORDER BY quote DESC
    """)
    card = {
        'header': header,
        'body': body
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
    cards.append(win_loss("", 'Siege insgesamt'))
    cards.append(win_loss("WHERE roles.team = 'Innocent'", 'Siege als Innocent'))
    cards.append(win_loss("WHERE roles.team = 'Traitors'", 'Siege als Traitor'))
    cards.append(roles())
    cards.append(kills())
        
    # create a cards.js file containing the code for the cards list
    with open("./Frontend/cards.js", "w") as f:
        f.write("/* autogenerated file */\n")
        f.write("const cards = ")
        f.write(json.dumps(cards).replace("\n", "").replace("'", "\""))
        f.write(";")