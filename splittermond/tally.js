class Tally extends HTMLElement {
    static observedAttributes = ['nrows', 'ncols', 'length'];
    _size = 1.5;
    _nrows = 0;
    _ncols = 0;
    _length = 0;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this._render();
    }

    _render() {
        const checked = this.count;
        const grid = document.createElement('div');
        grid.style.gridTemplateColumns = `repeat(${this.ncols}, ${this._size}em)`;
        grid.style.gridTemplateRows = `repeat(${this.nrows}, ${this._size}em)`;
        grid.style.display = 'grid';
        grid.style.gap = "1px";
        for (let i = 0; i < this.length; i++) {
            const cell = document.createElement("input");
            cell.type = "checkbox";
            cell.classList.add("tally-cbx");
            grid.appendChild(cell);
        }
        this.shadowRoot.innerHTML = `<style>
        .tally-cbx {
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
        .tally-cbx:checked {
            background-color: #e9ecee;
            border: 1px solid #adb8c0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0px -15px 10px -12px rgba(0,0,0,0.05), inset 15px 10px -12px rgba(255,255,255,0.1);
        }
        .tally-cbx:checked:after {
            content: 'X';
            position: absolute;
            top: -1px;
            left: 5px;
            font-size: ${this._size}em;
        }
        </style>`;
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
        return this.shadowRoot.querySelectorAll('.tally-cbx:checked').length;
    }

    set count(value) {
        const change = value - this.count;
        if (change > 0) {
            for (let i = 0; i < change; i++) {
                this.shadowRoot.querySelector('.tally-cbx:not(:checked)').checked = true;
            }
        } else if (change < 0) {
            for (let i = 0; i < -change; i++) {
                this.shadowRoot.querySelector('.tally-cbx:checked').checked = false;
            }
        }
    }
}

customElements.define('x-tally', Tally);