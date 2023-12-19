function instantiateTemplate(templateId, _data) {
    // copy so that we can delete used keys to assert all data is used
    const data = Object.assign({}, _data);
    const template = document.getElementById(templateId);
    console.assert(template != null, `Template ${templateId} not found`);
    const clone = document.importNode(template.content, true);

    for (const e of clone.querySelectorAll("[data-fill]")) {
        e.textContent = data[e.dataset.fill];
        delete data[e.dataset.fill];
    }

    for (const e of clone.querySelectorAll("[data-attrs]")) {
        for (const attr in data[e.dataset.attrs]) {
            e.setAttribute(attr, data[e.dataset.attrs][attr]);
        }
        delete data[e.dataset.attrs];
    }

    for (const e of clone.querySelectorAll("[data-events]")) {
        for (const event in data[e.dataset.events]) {
            e.addEventListener(event, data[e.dataset.events][event]);
        }
        delete data[e.dataset.events];
    }

    for (const e of clone.querySelectorAll("[data-event]")) {
        e.addEventListener(e.dataset.event, data[e.dataset.event]);
        delete data[e.dataset.event];
    }

    console.assert(Object.keys(data).length == 0, `Template ${templateId} has unused data: ${JSON.stringify(data)}`);

    return clone;
}

function appendTemplate(templateId, container, data) {
    if (typeof container == "string") {
        container = document.getElementById(container);
        console.assert(container != null, `Container ${container} not found`);
    } else {
        console.assert(typeof container == "object", `Container ${container} is not a string or object`);
    }
    const clone = instantiateTemplate(templateId, data);
    container.appendChild(clone);
}

function make_table_of_contents() {
    tocid = 0;
    for (const e1 of document.querySelectorAll("[data-category")) {
        const sublist_id = "toc-" + tocid + "-sublist";
        const group = instantiateTemplate("tmp-category-list-category", {
            title: e1.dataset.category,
            cbx: { id: "toc-" + tocid, name: "toc-" + tocid },
            lbl: { for: "toc-" + tocid },
            sublist: { id: sublist_id },
            click: () => {
                e1.classList.toggle("collapsed");
                document.getElementById(sublist_id).classList.toggle("collapsed");
            }
        });
        tocid++;

        for (const e2 of e1.querySelectorAll("[data-title]")) {
            const item = instantiateTemplate("tmp-category-list-item", {
                title: e2.dataset.title,
                cbx: { id: "toc-" + tocid, name: "toc-" + tocid },
                lbl: { for: "toc-" + tocid },
                click: () => e2.classList.toggle("collapsed")
            });
            group.querySelector("ul").appendChild(item);
            tocid++;
        }

        document.getElementById("category-list").appendChild(group);
    }
}

window.addEventListener("load", function() {
    make_table_of_contents();
});
