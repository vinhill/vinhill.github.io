class Page {
    constructor() {
        this._element = document.createElement('div');
        this._element.classList.add('page');
        this._main = document.createElement('div');
        this._main.classList.add('page-main');
        this._element.appendChild(this._main);
    }

    get element() {
        return this._element;
    }

    get main() {
        return this._main;
    }

    get bottom() {
        return this._main.getBoundingClientRect().bottom;
    }
}

class ElementChunker {
    static appliesTo(node) {
        return true;
    }

    /**
     * @param {*} node a too large node placed in a page
     *  Must not be moved or removed within the DOM
     * @param {*} height the available height for the node
     */
    constructor(node, height) {
        this.node = node;
        this.height = height;
    }

    /**
     * Try to reduce the node size by splitting off parts of it
     * that will be paginated separately.
     * 
     * @returns list of additional nodes to be paginated
     */
    chunk() {
        return [];
    }
}

class TextChunker extends ElementChunker {
    // TODO if justified text is chunked, the last line of the widow is wrong

    static appliesTo(node) {
        return node.nodeType === Node.TEXT_NODE || node.nodeName === 'P';
    }

    constructor(node, height) {
        super(node, height);
        this.range = document.createRange();
        this.text = node.textContent;
    }

    get lineHeight() {
        if (this._lineHeight === undefined) {
            let element = this.node;
            if (this.node.nodeType === Node.TEXT_NODE) {
                element = this.node.parentElement;
            }
            this._lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
        }
        return this._lineHeight;
    }

    /**
     * Binary search for a text length that fits in the remaining height
     */
    findMaxSplitIndex() {
        let low = 0, high = this.text.length;
        let splitIndex = 0;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            this.node.textContent = this.text.slice(0, mid);
            this.range.selectNodeContents(this.node);
            const rect = this.range.getBoundingClientRect();
            if (rect.height <= this.height) {
                splitIndex = mid;
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return splitIndex;
    }

    /**
     * Find the last whitespace or punctuation character before |index|
     */
    findBoundaryBefore(index) {
        // TODO consider css word-break properties
        const regex = /[\s-.,?!;:]/;
        let reversed = this.text.slice(0, index).split('').reverse().join('');
        let match = reversed.match(regex);
        return match ? index - match.index : index;   
    }

    /**
     * Number of lines of the widow and orphan, i.e. the part before and after
     * the split index
     */
    calculateLines(splitIndex) {
        this.node.textContent = this.text.slice(0, splitIndex);
        this.range.selectNodeContents(this.node);
        const widowHeight = this.range.getBoundingClientRect().height;

        this.node.textContent = this.text.slice(splitIndex);
        this.range.selectNodeContents(this.node);
        const orphanHeight = this.range.getBoundingClientRect().height;

        return { widow: widowHeight / this.lineHeight, orphan: orphanHeight / this.lineHeight };
    }

    /**
     * Move splitIndex forward to avoid a single-line orphan
     */
    adjustSplitIndexForOrphan(splitIndex) {
        // binary search for a the largest splitIndex that leaves at least two lines
        let low = 0, high = splitIndex;
        let newSplitIndex = 0;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            this.node.textContent = this.text.slice(mid);
            this.range.selectNodeContents(node);
            const height = this.range.getBoundingClientRect().height;
            const lines = height / this.lineHeight;
            if (lines >= 2) {
                newSplitIndex = mid;
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return newSplitIndex;
    }
    
    chunk() {
        let splitIndex = this.findMaxSplitIndex();
        splitIndex = this.findBoundaryBefore(splitIndex);

        let lines = this.calculateLines(splitIndex);
        if (lines.orphan < 2) {
            splitIndex = this.adjustSplitIndexForOrphan(splitIndex);
            splitIndex = this.findBoundaryBefore(splitIndex);
            lines = this.calculateLines(splitIndex);
        }
        if (lines.widow < 2) {
            // splitIndex can only decrease, cannot chunk without leaving a single line widow
            splitIndex = 0;
        }

        // check for nan and undefined
        if (splitIndex != splitIndex) {
            console.error("SplitIndex is nan, should not be possible");
            return [];
        }

        if (splitIndex == 0 || splitIndex == this.text.length) {
            // node is too large, do not chunk
            return [];
        } else {
            this.node.textContent = this.text.slice(0, splitIndex);
            const clone = this.node.cloneNode(true);
            clone.textContent = this.text.slice(splitIndex);
            console.log(`Split text at ${splitIndex} of ${this.text.length} characters`);
            return [clone];
        }
    }
}

class Paginator {
    constructor(make_page_func) {
        this.make_page_func = make_page_func || (() => new Page());
        this.chunkers = [TextChunker];
    }

    addChunker(chunker) {
        this.chunkers.push(chunker);
    }

    _createPage(container) {
        const page = this.make_page_func();
        container.appendChild(page.element);
        return page;
    }

    /**
     * Flow the html content from source to target, thereby placing it
     * in page elements.
     * 
     * @param {*} source some element whose children should be paginated
     * @param {*} target some container to place the pages in
     * @param {*} clone whether to clone the source elements or move them
     */
    flow(source, target, clone=true) {
        let queue = Array.from(source.childNodes);
        const range = document.createRange();

        let page = this._createPage(target);
        
        // TODO handle page-break CSS properties
        // TODO support for floating elements
        // TODO if element is a page, keep it unchanged and continue with a new
        // page after it

        while (queue.length > 0) {
            // try placing next element in page
            // get and clone element
            const element = clone ? queue.shift().cloneNode(true) : queue.shift();
            page.main.appendChild(element);
            range.selectNodeContents(element);
            let rect = range.getBoundingClientRect();
            if (rect.bottom > page.bottom) {
                // page overflows, try chunking the element
                const chunkerCls = this.chunkers.find(chunker => chunker.appliesTo(element));
                if (chunkerCls) {
                    const chunks = new chunkerCls(element, page.bottom - rect.top).chunk();
                    queue = chunks.concat(queue);
                }

                let oldPage = page;
                page = this._createPage(target);

                // check if element is still to big and needs to be placed on the new page
                range.selectNodeContents(element);
                rect = range.getBoundingClientRect();
                if (rect.bottom > oldPage.bottom) {    
                    if (oldPage.main.children.length == 0) {
                        console.warn("Element is too large for a single page", element);
                    } else {
                        page.main.appendChild(element);
                    }
                }
            }
        }
    }
}

htmldoc = (function(){
    // sizes in mm
    // https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size#page-size
    const sizes = {
        "a5": { width: 148, height: 210 },
        "a4": { width: 210, height: 297 },
        "a3": { width: 297, height: 420 },
        "b5": { width: 176, height: 250 },
        "b4": { width: 250, height: 353 },
        "jis-b5": { width: 182, height: 257 },
        "jis-b4": { width: 257, height: 364 },
        "letter": { width: 216, height: 279 },
        "legal": { width: 216, height: 356 },
        "ledger": { width: 279, height: 432 },
    }

    let config = {
        size: 'a4',
        orientation: 'portrait',
        margin: '0mm'
    };

    function getPageHeight() {
        return sizes[config.size][config.orientation === 'portrait' ? 'height' : 'width'];
    }

    function getPageWidth() {
        return sizes[config.size][config.orientation === 'portrait' ? 'width' : 'height'];
    }

    function configure_page() {
        document.body.style.width = getPageWidth()+"mm";
        const style = document.createElement('style');
        style.textContent = `
        @page {
            size: ${config.size} ${config.orientation};
            margin: ${config.margin};
        }
        .page {
            height: ${getPageHeight()}mm;
        }`;
        // TODO ensure this element exists only once
        document.head.insertBefore(style, document.head.firstChild);
    }

    async function lipsum({ what, amount, html }) {
        what = what || 'paras';
        amount = amount || 5;
        html = html || false;
        const res = await fetch(`https://corsproxy.io/?https://lipsum.com/feed/json?what=${what}&amount=${amount}`);
        const content = await res.json();
        let txt = content.feed.lipsum.replace(/[\n|\t|\f|\v|\r]+/g, "\n");
        if (html) {
            txt = "<p>"+txt.replace(/[\n]/g, "</p><p>")+"</p>";
        }
        return txt;
    }

    function init({ size, orientation, margin }) {
        if (!sizes[size]) {
            console.error(`'${size}' is not a valid page size, available sizes are: ${Object.keys(sizes).join(', ')}`);
            return;
        }

        config.size = size || config.size;
        config.orientation = orientation || config.orientation;
        config.margin = margin || config.margin;

        configure_page();
    }

    return {
        init,
        lipsum
    };
}());