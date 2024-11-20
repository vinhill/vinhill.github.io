
const editors = {};

function init_editors() {
    editors.js = CodeMirror.fromTextArea(document.getElementById('editor-js'), {
        mode: 'javascript',
        lineNumbers: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    });
    editors.css = CodeMirror.fromTextArea(document.getElementById('editor-css'), {
        mode: 'css',
        lineNumbers: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    });
    editors.html = CodeMirror.fromTextArea(document.getElementById('editor-html'), {
        mode: 'text/html',
        lineNumbers: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    });
}

function render_document() {
    let iframe = document.getElementById('viewer');
    let doc = iframe.contentWindow.document;
    // TODO somehow reset iframe to prevent variable redefinitions
    doc.writeln(`
        <!DOCTYPE html>
        <html>
        <head>
            <script src="./paginate.js"></script>
            <link rel="stylesheet" href="./paginate.css">
            <style>${editors.css.getValue()}</style>
        </head>
        <body>
            ${editors.html.getValue()}
            <script>${editors.js.getValue()}</script>
        </body>
        </html>
    `);
    doc.close();
    doc.addEventListener('keydown', on_key_down);
}

function print_document() {
    let iframe = document.getElementById('viewer');
    iframe.contentWindow.print();
}

function on_key_down(event) {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        render_document();
    }
    if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        print_document();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    init_editors();
    render_document();
});

document.addEventListener('keydown', on_key_down);

window.onbeforeunload = function() {
    editors.js.save();
    editors.css.save();
    editors.html.save();
    return 'Are you sure you want to leave?';
};