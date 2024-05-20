class StateCarousel extends HTMLElement {
    static observedAttributes = ['state', 'states'];
    _state = 0;
    _states = [' ', 'X'];
    _box = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
    }

    get states() {
        return this._states;
    }

    set states(value) {
        this._states = value.split(",");
        this._render();
    }

    get state() {
        return this._state;
    }

    set state(value) {
        if (value < 0 || value > this.states.length - 1)
            value = 0;
        this._state = value;
        
        // set the text of the box:after
        this._box.innerText = this.states[this.state];

        this.dispatchEvent(new Event('change'));
        this.dispatchEvent(new Event('input'));
    }

    connectedCallback() {
        this._render();
    }

    _render() {
        const maxlen = Math.max(...this.states.map(s => s.length));
        this.shadowRoot.innerHTML = `<style>
        .box {
            background-color: #fafafa;
            border: 1px solid #cacece;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0px -15px 10px -12px rgba(0,0,0,0.05);
            border-radius: 3px;
            cursor: pointer;
            user-select: none;
            white-space: pre;
            text-align: center;
            display: inline-block;
            width: ${maxlen + 0.5}em;
            height: 1.5em;
        }
        </style>
        <div class="box" tabIndex=0></div>
        `;
        this._box = this.shadowRoot.querySelector('.box');
        this._box.onclick = () => {
            this.state = (this.state + 1) % this.states.length;
        };
        this.state = this.state;
        this.shadowRoot.appendChild(this._box);
        // TODO unsure how to design this accessible. Maybe using role=listbox
    }
}

class Tally extends HTMLElement {
    static observedAttributes = ['nrows', 'ncols', 'length', 'states'];
    _size = 1.5;
    _nrows = 0;
    _ncols = 0;
    _length = 0;
    _states = " ,X";

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
        const checked = this.counts;  // buffer current count
        const grid = document.createElement('div');
        grid.style.gridTemplateColumns = `repeat(${this.ncols}, ${this._size}em)`;
        grid.style.gridTemplateRows = `repeat(${this.nrows}, ${this._size}em)`;
        grid.style.display = 'grid';
        grid.style.gap = "1px";
        for (let i = 0; i < this.length; i++) {
            const cell = document.createElement("x-state-carousel");
            cell.states = this.states;
            cell.onclick = () => this.dispatchChange();
            grid.appendChild(cell);
        }
        this.shadowRoot.innerHTML = "";
        this.shadowRoot.appendChild(grid);
        this.counts = checked;
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

    get states() {
        return this._states;
    }

    set states(value) {
        this._states = value;
        this._render();
    }

    get counts() {
        const cbxs = this.shadowRoot.querySelectorAll('x-state-carousel');
        const states = Array.from(cbxs).map(cb => cb.state);
        const state_counts = Array.from({length: this.states.split(",").length}, () => 0);
        for (const state of states) {
            state_counts[state]++;
        }
        return state_counts;
    }

    set counts(value) {
        if (value.length != this.states.split(",").length) {
            console.warn(`Tally set count to ${value} but states is ${this.states}, lengths do not match.`);
            return;
        }

        const cbxs = this.shadowRoot.querySelectorAll("x-state-carousel");

        let vidx = value.length - 1;
        for (const cbx of cbxs) {
            while (vidx >= 0 && value[vidx] == 0) vidx--;
            if (vidx < 0) break;
            cbx.state = vidx;
            value[vidx]--;
        }
        if (value.slice(1).some(v => v != 0)) {
            console.warn(`Tally set count to ${value} but not all counts were used.`);
        }
    }
}

/* https://www.w3schools.com/howto/howto_css_switch.asp */
class Switch extends HTMLElement {
    static observedAttributes = ['checked'];
    _cbx = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this._render();
    }

    _render() {
        this.shadowRoot.innerHTML = `
        <style>
        .switch {
            position: relative;
            display: inline-block;
            width: 3em;
            height: 1.5em;
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 1em;
            width: 1em;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
        }
        input:checked + .slider {
            background-color: rgb(60, 96, 114);
        }
        input:focus + .slider {
            box-shadow: 0 0 1px rgb(60, 96, 114);
        }
        input:checked + .slider:before {
            transform: translateX(2em) translateX(-8px);
        }
        .slider.round {
            border-radius: 2em;
        }
        .slider.round:before {
            border-radius: 50%;
        }
        </style>
        <label class="switch">
            <input type="checkbox">
            <span class="slider round"></span>
        </label>
        `;
        this._cbx = this.shadowRoot.querySelector('input');
        this._cbx.onchange = () => this.dispatchEvent(new Event('change'));
        this._cbx.oninput = () => this.dispatchEvent(new Event('input'));
        this.addEventListener('click', (e) => {
            if (e.target === this) {
                this._cbx.click();
            }
        });
    }

    _delegate(name, value) {
        if (value !== undefined) {
            this._cbx[name] = value;
        } else {
            return this._cbx[name];
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'checked') {
            this._cbx.setAttribute(name, newValue);
        }
    }

    get checked() { return this._delegate('checked'); }
    set checked(value) { this._delegate('checked', value); }
}

customElements.define('x-tally', Tally);
customElements.define('x-state-carousel', StateCarousel);
customElements.define('x-switch', Switch);
