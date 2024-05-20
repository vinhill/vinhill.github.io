
function exportData() {
    const data = {};
    const tags = ["textarea", "input", "table", "x-tally", "x-switch"];
    const elements = document.querySelectorAll(tags.map(t => t + ".persistent").join(", "));
    for (const e of elements) {
        console.assert(!e.disabled, `Element ${e.name} is disabled and bound.`);
        const name = e.name || e.dataset.name;
        console.assert(name && name.length > 0, `Element ${e} has no name.`);
        console.assert(!data.hasOwnProperty(name), `Name ${name} of element ${e} already in use.`);
        if ((e.tagName == "INPUT" && e.type == "checkbox") || e.tagName == "X-SWITCH") {
            data[name] = e.checked;
        } else if (e.tagName == "INPUT" || e.tagName == "TEXTAREA") {
            if (e.value == "") continue;
            data[name] = e.value;
        } else if (e.tagName == "TABLE") {
            const tbody = e.querySelector("tbody");
            // persist all input element values
            const values = [...tbody.querySelectorAll("input")].filter(x => !x.disabled).map(x => x.value);
            data[name] = { values, rows: tbody.rows.length };
        } else if (e.tagName == "X-TALLY") {
            data[name] = e.counts;
            console.log(e, e.counts);
        } else {
            console.error("Unknown element type: " + e.tagName);
        }
    }

    return JSON.stringify(data);
}

function setCbx(cbx, value) {
    if (cbx.checked != value) {
        cbx.click();
    } else {
        cbx.dispatchEvent(new Event("input"));
    }
}

function importData(data) {
    // create map from name to element
    const map = new Map();
    const tags = ["textarea", "input", "table", "x-tally", "x-switch"];
    for (const e of document.querySelectorAll(tags.map(t => t + ".persistent").join(", "))) {
        map.set(e.name || e.dataset.name, e);
    }
    for (const key in data) {
        if (map.has(key)) {
            const e = map.get(key);
            if ((e.tagName == "INPUT" && e.type == "checkbox") || e.tagName == "X-SWITCH") {
                setCbx(e, data[key]);
            } else if (e.tagName == "INPUT" || e.tagName == "TEXTAREA") {
                e.value = data[key];
                e.dispatchEvent(new Event("input"));
            } else if (e.tagName == "TABLE") {
                SetNumRows(e, data[key].rows);
                const values = data[key].values;
                [...e.querySelectorAll("input")].filter(x => !x.disabled).forEach((x, i) => x.value = values[i]);
            } else if (e.tagName == "X-TALLY") {
                e.counts = data[key];
            } else {
                console.error("Unknown element type: " + e.tagName);
            }
        } else {
            console.warn("Unknown key: " + key);
        }
    }
    splittermond.recompute();
}

function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

function getFile(accept, readAs) {
    return new Promise((res, rej) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = e => {
                res(e.target.result);
            }
            if (readAs == "text") {
                reader.readAsText(file);
            } else if (readAs = "dataURL") {
                reader.readAsDataURL(file);
            } else if (readAs = "binary") {
                reader.readAsBinaryString(file);
            } else if (readAs = "array") {
                reader.readAsArrayBuffer(file);
            } else {
                rej("Unknown readAs: " + readAs);
            }
        };
        input.click();
    });
}

function resizeImage(dataURL, size) {
    return new Promise((res, rej) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = new Image();
        image.onload = () => {
            if (size.mode == "scale") {
                canvas.width = image.width * size.scale;
                canvas.height = image.height * size.scale;
            } else if (size.mode == "w") {
                canvas.width = size.w;
                canvas.height = image.height * (size.w / image.width);
            } else if (size.mode == "h") {
                canvas.width = image.width * (size.h / image.height);
                canvas.height = size.h;
            } else if (size.mode == "wh") {
                canvas.width = size.w;
                canvas.height = size.h;
            } else if (size.mode == "fitwh") {
                if (image.width / image.height > size.w / size.h) {
                    canvas.width = size.w;
                    canvas.height = image.height * (size.w / image.width);
                } else {
                    canvas.width = image.width * (size.h / image.height);
                    canvas.height = size.h;
                }
            } else {
                rej("Unknown size: " + size);
            }
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            res(canvas.toDataURL());
        };
        image.src = dataURL;
    });
}

function setEmblem(data) {
    const e = document.getElementById("emblemdata");
    e.value = data;
    e.dispatchEvent(new Event("input"));
}

class DiceDialog {
    spec_pattern = /^(\d*)W(\d+)([+-]\d*)?$/i;
    spec = "2W10+5"

    init() {
        this.spec_inp = document.getElementById("dice-spec");
        this.spec_inp.value = this.spec;
        this.spec_inp.addEventListener("input", this.validateSpec.bind(this));

        this.dice_container = document.getElementById("dice-container");
        this.tmp_dice = document.getElementById("tmp-dice");

        this.dice_result = document.getElementById("dice-result");

        document.getElementById("dice-form").addEventListener("submit", e => {
            e.preventDefault();
            this.roll();
        });
        
        this.roll();
    }

    setSpec(spec) {
        this.spec = spec;
        this.spec_inp.value = this.spec;
    }

    validateSpec() {
        const match = this.spec_pattern.exec(this.spec_inp.value);
        const [dices, sides, bonus] = match.slice(1).map(x => Number(x));
        let valid = sides < 100 && dices < 30;
        if (!match || !valid) {
            this.spec_inp.value = this.spec;
        } else {
            this.spec = this.spec_inp.value;
        }
    }

    getSpec() {
        const match = this.spec_pattern.exec(this.spec);
        let [dices, sides, bonus] = match.slice(1).map(x => Number(x));
        return { dices: dices || 1, sides, bonus: bonus || 0 };
    }

    updateContainer(values, sides) {
        const { dices } = this.getSpec();
        this.dice_container.innerHTML = "";
        for (let i = 0; i < dices; i++) {
            const dice = document.importNode(this.tmp_dice.content, true);
            const dice_txt = dice.querySelector(".dice-txt")
            dice_txt.textContent = values[i];
            if (values[i] <= 2 || values[i] >= sides-1) {
                dice_txt.classList.add("dice-crit");
            }
            this.dice_container.appendChild(dice);
        }
    }

    roll() {
        const { dices, sides, bonus } = this.getSpec();
        const values = [];
        for (let i = 0; i < dices; i++) {
            values.push(Math.floor(Math.random() * sides) + 1);
        }
        this.updateContainer(values, sides);
        const total = values.reduce((a, b) => a + b, 0) + bonus;
        this.dice_result.textContent = "Ergebnis: "+ total;
    }
}

const diceDialog = new DiceDialog();

function OpenDiceDialog(templated_spec) {
    spec = templated_spec.replace(/#([^#]+)#/gu, (_, str) => splittermond.g.get(str));
    console.log(spec);
    if (!diceDialog.spec_pattern.test(spec)) {
        console.error(`'${templated_spec}' resolved to invalid spec '${spec}'`);
        return;
    }
    document.getElementById("dialog-dice").showModal();
    diceDialog.setSpec(spec);
    diceDialog.roll();
}

function dialogClickHandler(e) {
    // https://stackoverflow.com/questions/50037663/how-to-close-a-native-html-dialog-when-clicking-outside-with-javascript
    if (e.target.tagName !== 'DIALOG') //This prevents issues with forms
        return;

    const rect = e.target.getBoundingClientRect();

    const clickedInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
    );

    if (clickedInDialog === false)
        e.target.close();
}

/* Instantiate a new row, requires table to have a row template */
function AddRowOnClick(e) {
    const btn = e.target;
    const tbody = btn.parentElement.querySelector("tbody");
    const template = tbody.querySelector("template");
    const row = document.importNode(template.content, true);
    tbody.appendChild(row);
}

/* Shrink/Expand table to num rows, requires a row template */
function SetNumRows(table, rows) {
    const template = table.querySelector("template");
    const tbody = table.querySelector("tbody");
    while (tbody.rows.length > rows) {
        tbody.deleteRow(-1);
    }
    for (let i = tbody.rows.length; i < rows; i++) {
        const row = document.importNode(template.content, true);
        tbody.appendChild(row);
    }
}

function RemoveRowOnClick(e) {
    e.target.closest("tr").remove();
}

class MasteryDialog {
    init() {
        this.dialog = document.getElementById("dialog-mastery");
        this.txt_group = this.dialog.querySelector("#txt-group");
        this.txt_skill = this.dialog.querySelector("#txt-fertigkeit");
        this.data_container = this.dialog.querySelector("#data-masteries");
        this.tbl = this.dialog.querySelector("table");
    }

    getGroupData(group) {
        const data = JSON.parse(this.data_container.value);
        return data[group] || {};
    }

    setGroupData(group, values) {
        const data = JSON.parse(this.data_container.value);
        if (Object.keys(values).length == 0) {
            delete data[group];
        } else {
            data[group] = values;
        }
        this.data_container.value = JSON.stringify(data);
    }

    getSkillData(group, skill) {
        const groupdata = this.getGroupData(group);
        return groupdata[skill] || [];
    }

    emptyvalue(value) {
        return value == "" || value == "0";
    }

    setSkillData(group, skill, values) {
        const groupdata = this.getGroupData(group);

        // remove empty rows, i.e. 3 empty / 0 consecutive values
        for (let i = 0; i < values.length; i += 3) {
            if (this.emptyvalue(values[i]) && this.emptyvalue(values[i+1]) && this.emptyvalue(values[i+2])) {
                values.splice(i, 3);
                i -= 3;
            }
        }
        if (values.length == 0) {
            delete groupdata[skill];
        } else {
            groupdata[skill] = values;
        }

        this.setGroupData(group, groupdata);
    }

    open(group, skill) {
        if (skill === undefined) {
            return this.openall(group);
        }

        this.txt_group.textContent = group;
        this.txt_skill.textContent = skill;
        
        const values = this.getSkillData(group, skill);
        console.assert(values.length % 3 == 0, "values must be a multiple of 3");
        
        // reset input to default values
        this.tbl.querySelectorAll("input").forEach(x => x.value = x.getAttribute("value"));
        // fill dialog with values for this skill
        SetNumRows(this.tbl, Math.max(values.length / 3, 1));
        if (values.length > 0) {
            [...this.tbl.querySelectorAll("input")].filter(x => !x.disabled).forEach((x, i) => x.value = values[i]);
        }

        this.dialog.querySelector(".btn-add-row").hidden = false;

        this.dialog.showModal();
    }

    openall(group) {
        // don't have an input for group per skill, so we cannot accept input
        // TODO add such an input
        this.txt_group.textContent = group;
        this.txt_skill.textContent = "alle";
        const groupdata = this.getGroupData(group);
        const values = Object.values(groupdata).flat();
        console.assert(values.length % 3 == 0, "values must be a multiple of 3");
        
        // reset input to default values
        this.tbl.querySelectorAll("input").forEach(x => x.value = x.getAttribute("value"));
        // fill dialog with values for this skill
        SetNumRows(this.tbl, Math.max(values.length / 3, 0));
        if (values.length > 0) {
            [...this.tbl.querySelectorAll("input")].forEach((x, i) => x.value = values[i]);
        }

        // disable all inputs, remove buttons
        [...this.tbl.querySelectorAll("input")].forEach(x => x.disabled = true);
        [...this.tbl.querySelectorAll("button")].forEach(x => x.remove());
        // cannot remove, as not created anew for each open
        this.dialog.querySelector(".btn-add-row").hidden = true;

        this.dialog.showModal();
    }

    close() {
        const data = JSON.parse(this.data_container.value);
        const group = this.txt_group.textContent;
        const skill = this.txt_skill.textContent;
        if (skill == "alle") {
            return this.closeall();
        }
    
        const values = [...this.tbl.querySelectorAll("input")].map(x => x.value);
        this.setSkillData(group, skill, values);
    }

    closeall() {
        // enable all inputs and buttons
        [...this.tbl.querySelectorAll("input")].forEach(x => x.disabled = false);
        [...this.tbl.querySelectorAll("button")].forEach(x => x.disabled = false);
    }
}

const masteryDialog = new MasteryDialog();

function CollapseTableOnClick(e) {
    e.target.classList.toggle("active");

    const table = e.target.closest("table");
    const tbody = table.querySelector("tbody");
    const collapsed = tbody.classList.toggle("collapsed");
    
    const addRowBtn = e.target.closest("section").querySelector(".btn-add-row");
    if (addRowBtn) {
        addRowBtn.classList.toggle("collapsed", collapsed);
    }
}

function toggleDarkmode(active) {
    document.body.classList.toggle("dark", active);
    
    const nav = document.querySelector("nav");
    nav.classList.toggle("navbar-light", !active);
    nav.classList.toggle("navbar-dark", active);
    nav.classList.toggle("bg-light", !active);
    nav.classList.toggle("bg-dark", active);
}

window.addEventListener("load", () => {
    document.getElementById("btn-save").addEventListener("click", () => download(exportData(), "character.json", "text/plain"));
    document.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key == "s") {
            e.preventDefault();
            download(exportData(), "character.json", "text/plain");
        }
    });
    document.getElementById("btn-load").addEventListener("click", () => {
        getFile("application/json", "text").then(data => importData(JSON.parse(data)));
    });
    document.getElementById("emblemdata").addEventListener("input", e => {
        const image = document.getElementById("img-emblem");
        image.setAttribute('href', e.target.value);
    });
    document.getElementById("emblem-container").addEventListener("click", () => {
        getFile("image/*", "dataURL").then(data => {
            resizeImage(data, { mode: "fitwh", w: 216, h: 296 }).then(data2 => {
                setEmblem(data2);
            });
        });
    });
    diceDialog.init();
    masteryDialog.init();
    document.getElementById("dialog-mastery").addEventListener("close", masteryDialog.close.bind(masteryDialog));
    document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", dialogClickHandler));
    toggleDarkmode(document.getElementById("toggle-darkmode").checked);
});

window.addEventListener("beforeunload", e => {
    e.preventDefault();
});
