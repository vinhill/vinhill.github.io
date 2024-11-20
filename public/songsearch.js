// globals: zip, songs

// type: {Name: string, Artist: string, Game: string}[]
data = [];

function create_table(data) {
    if (data.length === 0)
        return;

    const cols = Object.keys(data[0]);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const col of cols) {
        const th = document.createElement("th");
        th.innerText = col;
        tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const row of data) {
        const tr = document.createElement("tr");
        for (const col of cols) {
            const td = document.createElement("td");
            td.innerText = row[col];
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

function sortable_table(table) {
    const cols = table.getElementsByTagName("th");
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        col.addEventListener("click", () => {
            if (table.sorted_col === i) {
                table.sorted_reverse = !table.sorted_reverse;
            } else {
                table.sorted_reverse = false;
            }
            sort_column(table, i, table.sorted_reverse);
        });
        col.style.cursor = "pointer";
    }

    table.sorted_col = 0;
    table.sorted_reverse = false;
    const col = table.getElementsByTagName("th")[table.sorted_col];
    col.innerText = col.innerText + "xx";
    sort_column(table, table.sorted_col, table.sorted_reverse);

    return table;
}

function sort_column(table, idx, reverse=false) {
    // remove arrow
    const prev_col = table.getElementsByTagName("th")[table.sorted_col];
    prev_col.innerText = prev_col.innerText.slice(0, -2);

    // new arrow
    const col = table.getElementsByTagName("th")[idx];
    const col_name = col.innerText;
    col.innerText = col_name + (reverse ? " ↓" : " ↑");
    table.sorted_col = idx;

    const tbody = table.getElementsByTagName("tbody")[0];
    let rows = Array.from(tbody.getElementsByTagName("tr"));
    rows.sort((a, b) => {
        const a_val = a.getElementsByTagName("td")[idx].innerText;
        const b_val = b.getElementsByTagName("td")[idx].innerText;
        return a_val.localeCompare(b_val);
    });
    if (reverse) {
        rows.reverse();
    }
    tbody.innerHTML = "";
    for (const row of rows) {
        tbody.appendChild(row);
    }
}

function songsearch() {
    const query = document.getElementById("query").value;
    const limit = document.getElementById("limit").value;

    let res = data.filter((song) => {
        return song.Name.toLowerCase().includes(query.toLowerCase())
            || song.Artist.toLowerCase().includes(query.toLowerCase())
            || song.Game.toLowerCase().includes(query.toLowerCase());
    });
    res = res.splice(0, limit);

    // table
    const output_div = document.getElementById("output");
    if (res.length === 0) {
        output_div.innerHTML = "No results found.";
    } else {
        output_div.innerHTML = "";
        const tbl = sortable_table(create_table(res));
        output_div.appendChild(tbl);
    }

    // go to #card-result
    document.getElementById("card-result").scrollIntoView();
}

function render_gamelist() {
    const div = document.getElementById("gamelist");
    const games = new Set(data.map((song) => song.Game));
    
    // horizontal ul
    const ul = document.createElement("ul");
    for (const game of games) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#card-result";
        a.innerText = game;
        a.addEventListener("click", () => {
            document.getElementById("query").value = game;
            document.getElementById("limit").value = 50;
            songsearch();
        });
        li.appendChild(a);
        ul.appendChild(li);
    }
    div.appendChild(ul);

    // songcount
    const p = document.createElement("p");
    p.innerText = `${data.length} songs in ${games.size} games`;
    div.appendChild(p);
}

function load_data() {
    // from global object songs
   cur_game = "Null";
   for (const line of songs.split("\n")) {
        if (line.startsWith("#")) {
            cur_game = line.slice(2);
        } else {
            const tokens = line.split(" - ");
            try {
            data.push({Artist: tokens[0], Name: tokens[1], Game: cur_game});
            } catch (e) {
            console.log(tokens);
            }
        }
   }
}

function init() {
    load_data();
    render_gamelist();
}

document.addEventListener("DOMContentLoaded", init);