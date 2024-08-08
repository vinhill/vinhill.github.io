// Experiments that are not ready to be used

class TRBtn extends HTMLElement {
    static observedAttributes = ['symbol'];
    span;
    _symbol;
    _voffset = "0em";
    _hoffset = "-0.7em";

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }

    connectedCallback() {
        this._render();
    }

    _render() {
        this.shadowRoot.innerHTML = `
            <style>
                div {
                    position: relative;
                }
                span {
                    display: inline-block;
                    cursor: pointer;
                    position: absolute;
                    left: ${this._hoffset};
                    bottom: ${this._voffset};
                    user-select: none;
                }
            </style>
            <div>
                <span></span>
            </div>
        `;
        this.span = this.shadowRoot.querySelector('span');
        this.span.textContent = this._symbol;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'symbol') {
            this.symbol = newValue;
        }
    }

    get symbol() {
        return this._symbol;
    }

    set symbol(value) {
        this._symbol = value;
        if (this.span)
            this.span.textContent = value;
    }

    get voffset() {
        return this._voffset;
    }

    set voffset(value) {
        this._voffset = value;
        if (this.span)
            this.span.style.bottom = value;
    }

    get hoffset() {
        return this._hoffset;
    }

    set hoffset(value) {
        this._hoffset = value;
        if (this.span)
            this.span.style.left = value;
    }
}

class DynamicTable extends HTMLElement {
    _table;

    constructor() {
        super();
    }

    connectedCallback() {
        const observer = new MutationObserver(mut => this.onTableChanged(mut));
        observer.observe(this, {childList: true, subtree: true});
        this.render();
    }

    onTableChanged(mutations) {
        for (const mut of mutations) {
            if (mut.type !== 'childList') continue;

            for (const node of mut.addedNodes) {
                if (node.tagName === 'TABLE') {
                    this.render();
                } else if (node.tagName === 'TBODY') {
                    node.querySelectorAll('tr').forEach(row => {
                        if (!row.querySelector('x-tr-btn x-symbol-btn')) {
                            this._addRemoveRowBtn(row);
                            this._addAddRowBtn(row);
                        }
                    });
                } else if (node.tagName === 'TR') {
                    if (node.parentNode.tagName === 'TBODY' && !node.querySelector('x-tr-btn x-symbol-btn')) {
                        this._addRemoveRowBtn(node);
                        this._addAddRowBtn(node);
                    }
                }
            }
        }
    }

    render() {
        this._table = this.querySelector('table');
        if (!this._table) return;
        this._table.style.marginLeft = '.8em';
        this._table.style.width = 'calc(100% - .8em)';

        this.querySelectorAll('x-tr-btn').forEach(btn => btn.remove());

        this.querySelectorAll("tbody tr").forEach(row => {
            this._addRemoveRowBtn(row);
            this._addAddRowBtn(row);
        });
    }

    _addAddRowBtn(row) {
        const btn = document.createElement('x-tr-btn');
        btn.symbol = '+';
        btn.voffset = "-0.3em";
        btn.addEventListener('click', () => {
            const template = this.querySelector('template');
            const newRow = template.content.cloneNode(true);
            this._addAddRowBtn(newRow);
            this._addRemoveRowBtn(newRow);
            const row = btn.closest('tr');
            // after current row
            row.parentNode.insertBefore(newRow, row.nextSibling);
        });
        row.querySelector("td").appendChild(btn);
    }

    _addRemoveRowBtn(row) {
        const btn = document.createElement('x-symbol-btn');
        btn.symbol = '\u2212';
        btn.addEventListener('click', () => {
            btn.closest('tr').remove();
        });
        const td = document.createElement('td');
        row.insertBefore(td, row.firstChild);
        td.insertBefore(btn, td.firstChild);
    }
}
customElements.define('x-tr-btn', TRBtn);
customElements.define('x-symbol-btn', SymbolBtn);
customElements.define('x-dynamic-tbl', DynamicTable);