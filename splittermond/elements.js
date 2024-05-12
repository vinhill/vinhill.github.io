class Checkbox extends HTMLElement {
    static observedAttributes = ['state', 'ternary'];
    _size = 1.5;
    _state = 0;
    _box = null;
    _ternary = false;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
    }

    get state() {
        return this._state;
    }

    get ternary() {
        return this._ternary;
    }

    set ternary(value) {
        this._ternary = value;
        this._render();
    }

    set checked(value) {
        this.state = value ? 2 : 0;
    }

    get checked() {
        return this.state == 2;
    }

    _setCkClass(n) {
        this._box.classList.remove("ckone");
        this._box.classList.remove("cktwo");
        if (n == 1)
            this._box.classList.add("ckone");
        else if (n == 2)
            this._box.classList.add("cktwo");
    }

    set state(value) {
        if (value < 0 || value > 2)
            value = 0;
        if (!this.ternary && value == 1)
            value = 2;
        this._state = value;
        this._setCkClass(value);

        this.dispatchEvent(new Event('change'));
        this.dispatchEvent(new Event('input'));
    }

    connectedCallback() {
        this._render();
    }

    _render() {
        this.shadowRoot.innerHTML = `<style>
        .tribox {
            appearance: none;
            background-color: #fafafa;
            border: 1px solid #cacece;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0px -15px 10px -12px rgba(0,0,0,0.05);
            /* also change grid-template-columns in bogen.js */
            padding: ${this._size/2}em;
            border-radius: 3px;
            position: relative;
            margin: 0;
        }
        .tribox .ckone {
            background-color: #e9ecee;
            border: 1px solid #adb8c0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0px -15px 10px -12px rgba(0,0,0,0.05), inset 15px 10px -12px rgba(255,255,255,0.1);
        }
        .ckone:after {
            content: '/';
            position: absolute;
            top: -3px;
            left: 6px;
            font-size: ${this._size}em;
        }
        .tribox .cktwo {
            background-color: #e9ecee;
            border: 1px solid #adb8c0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0px -15px 10px -12px rgba(0,0,0,0.05), inset 15px 10px -12px rgba(255,255,255,0.1);
        }
        .cktwo:after {
            content: 'X';
            position: absolute;
            top: -2px;
            left: 5px;
            font-size: ${this._size}em;
        }
        </style>`;
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.classList.add("tribox");
        inp.onclick = () => {
            this.state = (this.state + 1) % 3;
        };
        this._box = inp;
        this.shadowRoot.appendChild(inp);
    }
}

class Tally extends HTMLElement {
    static observedAttributes = ['nrows', 'ncols', 'length', 'ternary'];
    _size = 1.5;
    _nrows = 0;
    _ncols = 0;
    _length = 0;
    _ternary = false;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this._render();
    }

    dispatchChange() {
        this.dispatchEvent(new Event('change'));
    }

    _render() {
        const checked = this.count;
        const grid = document.createElement('div');
        grid.style.gridTemplateColumns = `repeat(${this.ncols}, ${this._size}em)`;
        grid.style.gridTemplateRows = `repeat(${this.nrows}, ${this._size}em)`;
        grid.style.display = 'grid';
        grid.style.gap = "1px";
        for (let i = 0; i < this.length; i++) {
            const cell = document.createElement("x-checkbox");
            cell.ternary = this.ternary;
            cell.onclick = () => this.dispatchChange();
            grid.appendChild(cell);
        }
        this.shadowRoot.innerHTML = "";
        this.shadowRoot.appendChild(grid);
        this.count = checked;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
    }

    get nrows() {
        return this._nrows;
    }

    set nrows(value) {
        this._nrows = value;
        this._length = this._ncols * this.nrows;
        this._render();
    }

    get ncols() {
        return this._ncols;
    }

    set ncols(value) {
        this._ncols = value;
        this._length = this._ncols * this.nrows;
        this._render();
    }

    get length() {
        return this._length;
    }

    set length(value) {
        this._length = value;
        this._render();
    }

    get count() {
        const cbxs = this.shadowRoot.querySelectorAll('x-checkbox');
        const c1 = Array.from(cbxs).filter(cb => cb.state == 1).length;
        const c2 = Array.from(cbxs).filter(cb => cb.state == 2).length;
        if (this.ternary)
            return [c1, c2];
        return c2;
    }

    set count(value) {
        const cbxs = this.shadowRoot.querySelectorAll("x-checkbox");
        const cur = this.count;
        let dc1 = 0;
        let dc2 = 0;
        if (this.ternary) {
            dc1 = value[0] - cur[0];
            dc2 = value[1] - cur[1];
        } else {
            dc2 = value - cur;
        }

        for (const cbx of cbxs) {
            if (dc2 == 0) break;
            if (cbx.state == 0 && dc2 > 0) {
                cbx.state = 2;
                dc2--;
            } else if (cbx.state == 2 && dc2 < 0) {
                cbx.state = 0;
                dc2++;
            }
        }
        for (const cbx of cbxs) {
            if (dc1 == 0) break;
            if (cbx.state == 0 && dc1 > 0) {
                cbx.state = 1;
                dc1--;
            } else if (cbx.state == 1 && dc1 < 0) {
                cbx.state = 0;
                dc1++;
            }
        }
    }

    get ternary() {
        return this._ternary;
    }

    set ternary(value) {
        this._ternary = value !== null;
        this._render();
    }
}

customElements.define('x-tally', Tally);
customElements.define('x-checkbox', Checkbox);
