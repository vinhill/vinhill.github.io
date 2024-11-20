const style = `
* {box-sizing:border-box}

/* Slideshow container */
.slideshow-container {
  max-width: 1000px;
  position: relative;
  margin: auto;
}

/* Next & previous buttons */
.prev, .next {
  cursor: pointer;
  position: absolute;
  top: 50%;
  width: auto;
  margin-top: -22px;
  padding: 16px;
  color: white;
  font-weight: bold;
  font-size: 18px;
  transition: 0.6s ease;
  border-radius: 0 3px 3px 0;
  user-select: none;
}

/* Position the "next button" to the right */
.next {
  right: 0;
  border-radius: 3px 0 0 3px;
}

/* On hover, add a black background color with a little bit see-through */
.prev:hover, .next:hover {
  background-color: rgba(0,0,0,0.8);
}

/* The dots/bullets/indicators */
.dot {
  cursor: pointer;
  height: 15px;
  width: 15px;
  margin: 0 2px;
  background-color: #bbb;
  border-radius: 50%;
  display: inline-block;
  transition: background-color 0.6s ease;
}

.active, .dot:hover {
  background-color: #717171;
}

.current-slide {
  display: block;
}
`

// https://www.w3schools.com/howto/howto_js_slideshow.asp
class Carousel extends HTMLElement {
    static observedAttributes = ['auto'];

    _idx = 0;
    _auto = false;
    _interval;

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }

    connectedCallback() {
        this._render();
    }

    attributeChangedCallback(name, _, newValue) {
        if (name === 'auto') {
            this.auto = newValue !== null && newValue !== 'false';
        }
    }

    set auto(value) {
        this._auto = value;
        if (this._auto) {
            this._interval = setInterval(() => this._onAutoInterval(), 5000);
        } else {
            clearInterval(this._interval);
        }
    }

    get auto() {
        return this._auto;
    }

    _onAutoInterval() {
        if (this._auto) {
            this.next();
        }
    }

    _render() {
        this.shadowRoot.innerHTML = `
        <style>${style}</style>
        <div class="slideshow-container">
            <slot></slot>
            <a class="prev">&#10094;</a>
            <a class="next">&#10095;</a>
        </div>
        <div style="text-align:center">
            ${Array.from(this.children).map((_, idx) => `
            <span class="dot ${idx === this._idx ? 'active' : ''}"></span>
            `).join('')}
        </div>
        `;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.style.display = i === this._idx ? 'block' : 'none';
        }
        this.shadowRoot.querySelector('.prev').addEventListener('click', () => this.prev());
        this.shadowRoot.querySelector('.next').addEventListener('click', () => this.next());
        this.shadowRoot.querySelectorAll('.dot').forEach((dot, idx) => {
            dot.addEventListener('click', () => this.slide(idx));
        });
    }

    next() {
        this.slide(this._idx + 1);
    }

    prev() {
        this.slide(this._idx - 1);
    }

    slide(n) {
        const n_slides = this.children.length;
        if (n < 0) n = n_slides-1;
        if (n >= n_slides) n = 0;
        this._idx = n;
        this._render();
    } 
}

customElements.define('x-carousel', Carousel);
