function debug(...args) {
    //console.log(...args);
}

class Graph {
    constructor() {
        this._edges = new Map();
    }

    add_edge(a, b, label=undefined) {
        if (!this._edges.has(a)) {
            this._edges.set(a, []);
        }
        this._edges.get(a).push([b, label]);
    }

    toposort(a) {
        const { endtick } = this.dfs(a);
        const sorted = [...endtick.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
        return sorted;
    }

    dfs(a) {
        const starttick = new Map();
        const endtick = new Map();
        const cyclic = { value: false };
        this._dfs(a, starttick, endtick, cyclic, 0);
        const visited = new Set(starttick.keys());
        return { visited, cyclic: cyclic.value, starttick, endtick };
    }

    _dfs(a, starttick, endtick, cyclic, tick) {
        if (starttick.has(a) && !endtick.has(a)) {
            cyclic.value = true;
            return tick;
        }
        if (endtick.has(a)) {
            return tick;
        }
        starttick.set(a, tick++);
        if (!this._edges.has(a)) {
            return;
        }
        for (const [b, _lbl] of this._edges.get(a)) {
            tick = this._dfs(b, starttick, endtick, cyclic, tick);
        }
        endtick.set(a, tick++);
    }

    is_cycle_reachable(a) {
        const active = new Set();
        const visited = new Set();
        return this._is_cycle_reachable(a, visited, active);
    }

    _is_cycle_reachable(a, visited, active) {
        if (active.has(a)) {
            debug("found cycle at", a, visited);
            return true;
        }
        if (visited.has(a)) {
            return false;
        }
        active.add(a);
        visited.add(a);
        if (!this._edges.has(a)) return false;
        for (const [b, _lbl] of this._edges.get(a)) {
            if (this._is_cycle_reachable(b, visited, active)) {
                debug("backtracking", a, b);
                return true;
            }
        }
        active.delete(a);
        return false;
    }
}

/**
 * For now, directed, acyclic and inefficient.
 */
class ComputationalGraph {
    constructor() {
        this._values = new Map();
        this._g = new Graph();
        this._internal_node_id = 0;
    }

    _add_op(op, a, b, y) {
        if (op == "link") {
            console.assert(a !== undefined && typeof a !== "number", `x must be a variable for link {${a} -> ${y}}`);
            console.assert(y !== undefined && typeof y !== "number", `y must be a variable for link {${a} -> ${y}}`);
            if (!this.has(a)) {
                this.setsilent(a, 0);
            }
            if (!this.has(y)) {
                this.setsilent(y, 0);
            }
            this._g.add_edge(a, y, ["link", a, undefined, y]);
            return y;
        }

        if (y === undefined) {
            y = "_var" + this._internal_node_id++;
        } else {
            console.assert(!y.startsWith("_var"), `_var is a reserved prefix for internal variables. ${y} is not allowed.`);
        }

        console.assert(a !== undefined, `a must be defined for edge {${a}, ${b}, ${y}}`);
        console.assert(b !== undefined, `b must be defined for edge {${a}, ${b}, ${y}}`);
        if (typeof a !== "number" && !this.has(a)) {
            console.assert(!a.startsWith("_var"), `_var is a reserved prefix for internal variables. ${a} is not allowed.`);
            this.setsilent(a, 0);
        }
        if (op !== "func" && typeof b !== "number" && !this.has(b)) {
            console.assert(!b.startsWith("_var"), `_var is a reserved prefix for internal variables. ${b} is not allowed.`);
            this.setsilent(b, 0);
        }
        if (typeof y !== "number" && !this.has(y)) {
            this.setsilent(y, 0);
        }

        this._g.add_edge(a, y, [op, a, b, y]);

        if (op != "func" && typeof b !== "number") {
            this._g.add_edge(b, y, [op, a, b, y]);
        }
        return y;
    }

    add(x1, x2, y) {
        return this._add_op("add", x1, x2, y);
    }

    addall(xs, y) {
        console.assert(xs.length >= 2, `addall requires at least two summants.`);
        console.assert(typeof xs === "object", `addall requires an array of summants, not ${xs}.`);
        let tmp = xs[0];
        for (let i = 1; i < xs.length - 1; i++) {
            tmp = this.add(tmp, xs[i]);
        }
        return this.add(tmp, xs[xs.length - 1], y);
    }

    sub(x1, x2, y) {
        const y1 = this.mul(x2, -1);
        return this.add(x1, y1, y);
    }

    mul(x1, x2, y) {
        return this._add_op("mul", x1, x2, y);
    }

    func(x, f, y) {
        return this._add_op("func", x, f, y);
    }

    link(x, y) {
        return this._add_op("link", x, undefined, y);
    }

    setsilent(x, value) {
        const num = Number(value);
        this._values.set(x, isNaN(num) ? value : num);
    }

    set(x0, value) {
        debug(`Updating ${x0} to ${value}`);
        this.setsilent(x0, value);
        if (this._g.is_cycle_reachable(x0)) {
            throw new Error("Cycle detected");
        }

        const affected = new Set();
        const queue = [x0];
        while (queue.length > 0) {
            const x = queue.shift();
            if (!this._g._edges.has(x)) continue;
            for (const [y, label] of this._g._edges.get(x)) {
                if (this._eval_edge(label)) {
                    affected.add(y);
                    queue.push(y);
                }
            }
        }
        debug(`Affected: ${[...affected]}`);
        // filter out all internal variables
        return [...affected].filter(x => !x.startsWith("_var"));
    }

    get(x) {
        return this._values.get(x);
    }

    has(x) {
        return this._values.has(x);
    }

    _eval_edge([op, a, b, y]) {
        console.assert(this.has(a), `Unknown variable ${a}`);
        console.assert(this.has(y), `Unknown variable ${y}`);
        console.assert(typeof b == "number" || op == "func" || op == "link" || this.has(b), `Unknown variable ${b}`);
        const prev = this.get(y);
        if (op == "add") {
            if (typeof b == "number") {
                debug(`${y} -> ${a}=${this.get(a)} + ${b}`);
                this.setsilent(y, this.get(a) + b);
            } else {
                debug(`${y} -> ${a}=${this.get(a)} + ${b}=${this.get(b)}`);
                this.setsilent(y, this.get(a) + this.get(b));
            }
        } else if (op == "mul") {
            if (typeof b == "number") {
                debug(`${y} -> ${a}=${this.get(a)} * ${b}`);
                this.setsilent(y, this.get(a) * b);
            } else {
                debug(`${y} -> ${a}=${this.get(a)} * ${b}=${this.get(b)}`);
                this.setsilent(y, this.get(a) * this.get(b));
            }
        } else if (op == "func") {
            debug(`${y} -> f(${a}=${this.get(a)}) = ${b(this.get(a))}`);
            this.setsilent(y, b(this.get(a)));
        } else if (op == "link") {
            debug(`${a} affects ${y}`);
            return true;
        } else {
            throw new Error(`Unknown operation ${op} in edge {${a}, ${b}, ${y}}`);
        }
        return prev != this.get(y);
    }

    recompute() {
        const affected = new Set();
        for (const v of this._values.keys()) {
            this.set(v, this.get(v)).forEach(x => affected.add(x));
        }

        debug(`Affected: ${[...affected]}`);
        return [...affected].filter(x => !x.startsWith("_var"));
    }
}

function clip(x, min, max) {
    const num = Number(x);
    if (isNaN(num)) return min;
    if (min === undefined) return Math.min(max, num);
    if (max === undefined) return Math.max(min, num);
    return Math.min(max, Math.max(min, num));
}

class SplittermondComputations {
    constructor() {
        this.g = new ComputationalGraph();
        this.gval = new Graph();
        this.validators = new Map();
        this.elements = new Map();
    }

    init() {
        this.make_graph();
        this.make_validators();
        this.make_listeners();
        this.bind();
    }

    make_graph() {
        this.g.sub("EPGesamt", "EPEingesetzt", "EPOffen");
        this.g.func("EPGesamt", x => x < 100 ? 100 - x : x < 300 ? 300 - x : x < 600 ? 600 - x : "n/a", "NächsterHeldengrad");

        this.g.func("EPGesamt", x => x < 100 ? 1 : x < 300 ? 2 : x < 600 ? 3 : 4, "Heldengrad");
        this.g.func("Heldengrad", x => x == 1 ? 1 : x == 2 ? 2 : x == 3 ? 3 : x == 4 ? 4 : "n/a", "MaxAttributssteigerung");
        this.g.func("Heldengrad", x => x == 1 ? 6 : x == 2 ? 9 : x == 3 ? 12 : x == 4 ? 15 : "n/a", "MaximaleFertigkeitspunkte");
        this.g.func("Heldengrad", x => x == 1 ? 0 : x == 2 ? 2 : x == 3 ? 2 : x == 4 ? 2 : "n/a", "WiderstandsBonus");
        this.g.func("Heldengrad", x => x == 1 ? 3 : x == 2 ? 4 : x == 3 ? 5 : x == 4 ? 6 : "n/a", "MaximalerBonus");

        for (const attr of "AUS,BEW,INT,KON,MYS,STÄ,VER,WIL".split(",")) {
            this.g.add(attr + "ini", attr + "mod", attr);
        }

        this.g.func("Rasse", x => {
            const map = { Alb: 5, Gnom: 3, Mensch: 5, Varg: 6, Zwerg: 4 };
            return map[x] || 0;
        }, "_GKbase");
        this.g.add("GK", "BEW", "_GSWbase");
        this.g.add(this.g.mul("INT", -1), 10, "_INIbase");
        this.g.add("GK", "KON", "_LPbase");
        this.g.mul(this.g.add("MYS", "WIL"), 2, "_FObase");
        this.g.func("GK", x => 10 - 2 * x, "_GKVTD");
        this.g.addall(["BEW", "STÄ", 12, "_GKVTD"], "_VTDbase");
        this.g.addall(["VER", "WIL", 12], "_GWbase");
        this.g.addall(["KON", "WIL", 12], "_KWbase");
        for (const val of "GK,GSW,INI,LP,FO,VTD,GW,KW".split(",")) {
            this.g.addall(["_" + val + "base", val + "mod", val + "tmp"], val);
        }

        for (const skill of sm_skills) {
            this.g.addall([skill.att1, skill.att2, skill.name + "_pts", skill.name + "_mod"], skill.name);
        }

        for (let i = 1; i <= 6; i++) {
            this.g.func("weapon_fp_" + i, x => this.g.get(x), "_weapon_fp_" + i);
            this.g.func("weapon_att1_" + i, x => this.g.get(x), "_weapon_att1_" + i);
            this.g.func("weapon_att2_" + i, x => this.g.get(x), "_weapon_att2_" + i);
            for (const att of sm_fight_skills) {
                this.g.link(att, "weapon_fp_" + i);
            }
            for (const att of sm_attrs.map(a => a.abbrev)) {
                this.g.link(att, "weapon_att1_" + i);
                this.g.link(att, "weapon_att2_" + i);
            }
            this.g.addall(["_weapon_fp_" + i, "_weapon_att1_" + i, "_weapon_att2_" + i, "weapon_mod_" + i], "weapon_value_" + i);
        }

        this.g.addall([1,2,3,4,5].map(i => "armor_vtd_"+i), "armor_vtd");
        this.g.addall([1,2,3,4,5].map(i => "armor_sr_"+i), "armor_sr");
        this.g.addall([1,2,3,4,5].map(i => "armor_beh_"+i), "armor_beh");
        this.g.addall([1,2,3,4,5].map(i => "armor_tick_"+i), "armor_tick");

        for (const school of sm_magicschools) {
            this.g.addall([school.att1, school.att2, school.name + "_pts"], school.name);
        }

        this.g.add("splitterpunktegesamt", "splitterpunktetemporaer", "_splitterpunkte");
    }

    listen(value, callback) {
        // listener implemented as a function from value to unnamed variable
        this.g.func(value, callback)
    }

    make_validators() {
        for (const edges of this.g._g._edges.values()) {
            for (const [op, a, b, y] of edges) {
                this.gval.add_edge(a, y);
                this.gval.add_edge(b, y);
            }
        }
        for (const attr of "AUS,BEW,INT,KON,MYS,STÄ,VER,WIL".split(",")) {
            this.gval.add_edge("MaxAttributssteigerung", attr + "mod");
        }
        for (const skill of sm_skills) {
            this.gval.add_edge("MaximaleFertigkeitspunkte", skill.name + "_pts");
            this.gval.add_edge("MaximaleFertigkeitspunkte", skill.name + "_mod");
        }
        for (const skill of sm_skills) {
            this.gval.add_edge(skill.name + "_mod", skill.name + "_pts");
            this.gval.add_edge(skill.name + "_pts", skill.name + "_mod");
        }

        this.validators.set("EPGesamt", x => clip(x, 0));
        this.validators.set("EPEingesetzt", x => {
            const ep = this.g.get("EPGesamt");
            return clip(x, 0, ep);
        });

        for (const attr of "AUS,BEW,INT,KON,MYS,STÄ,VER,WIL".split(",")) {
            this.validators.set(attr + "ini", x => clip(x, 0));
            this.validators.set(attr + "mod", x => {
                const max = this.g.get("MaxAttributssteigerung");
                return clip(x, 0, max);
            });
        }

        for (const val of "GK,GSW,INI,LP,FO,VTD,GW,KW".split(",")) {
            this.validators.set(val + "mod", x => clip(x, 0));
            this.validators.set(val + "tmp", x => clip(x, 0));
        }

        this.validators.set("Rasse", x => ["Alb", "Gnom", "Mensch", "Varg", "Zwerg"].indexOf(x) != -1 ? x : "n/a");

        const skills = sm_skills.map(s => s.name);
        for (let i = 0; i < skills.length; i++) {
            this.validators.set(skills[i] + "_pts", x => {
                const max = this.g.get("MaximaleFertigkeitspunkte") - this.g.get(skills[i] + "_mod");
                return clip(x, 0, max);
            });
            this.validators.set(skills[i] + "_mod", x => {
                const max = this.g.get("MaximaleFertigkeitspunkte") - this.g.get(skills[i] + "_pts");
                return clip(x, 0, max);
            });
        }

        for (let i = 1; i <= 6; i++) {
            this.validators.set("weapon_att1_" + i, x => sm_attrs.map(a => a.abbrev).indexOf(x) != -1 ? x : "n/a");
            this.validators.set("weapon_att2_" + i, x => sm_attrs.map(a => a.abbrev).indexOf(x) != -1 ? x : "n/a");
            this.validators.set("weapon_fp_" + i, x => sm_fight_skills.indexOf(x) != -1 ? x : "n/a");
        }
    }

    make_listeners() {
        this.listen("_splitterpunkte", x => {
            document.getElementById("tally-splitterpunkte").ncols = x;
        });
        this.listen("LP", x => {
            document.getElementById("tally-lp").ncols = x;
        });
    }

    bind() {
        for (const e of document.querySelectorAll("[name]")) {
            if (!this.g.has(e.name)) {
                continue;
            }
            console.assert(!this.elements.has(e.name), `Element name ${e.name} is not unique.`);
            this.elements.set(e.name, e);
            e.addEventListener("input", () => this.update(e.name, e.value));
            this.g.setsilent(e.name, this.validate(e.name, e.value));
        }
        for (const e of this.g._values.keys()) {
            if (e.startsWith("_")) {
                continue;
            }
            console.assert(this.elements.has(e), `Element name ${e} is not bound.`);
        }
        this.updateAffected(this.g.recompute());
    }

    update(v, value) {
        this.updateAffected(
            this.g.set(
                v,
                value
            )
        );
        this.gval.dfs(v).visited.forEach(x => this.validate(x, this.g.get(x)));
    }

    validate(v, value) {
        const f = this.validators.get(v)
        if (f === undefined) {
            return value;
        }
        if (typeof f !== "function") {
            throw new Error(`Invalid validator for ${v}`);
        }
        const y = f(value);
        if (y != value) {
            this.elements.get(v).classList.add("invalid");
            debug(`Invalid value ${value} for ${v}`);
        } else {
            this.elements.get(v).classList.remove("invalid");
        }
        return y;
    }

    updateAffected(affected) {
        for (const v of affected) {
            debug(`Updating ${v} from ${v.value} to ${this.g.get(v)}`);
            const e = this.elements.get(v);
            if (e === undefined) {
                console.assert(v.startsWith("_"), `Non-internal variable ${v} has no element.`);
                continue;
            }
            const val = this.g.get(v);
            if (e.disabled) {
                e.value = val;
            } else {
                this.validate(v, val)
            }
        }
    }

    recompute() {
        for (const e of document.querySelectorAll("[name]")) {
            if (!this.g.has(e.name)) {
                continue;
            }
            this.elements.set(e.name, e);
            this.g.setsilent(e.name, this.validate(e.name, e.value));
        }
        this.updateAffected(this.g.recompute());
    }
}

const splittermond = new SplittermondComputations();

window.addEventListener("load", function () {
    splittermond.init();
});