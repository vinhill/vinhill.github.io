function make_card(header, content, footer=undefined) {
	let res = [];
	res.push('<div class="card">');
	res.push('<div class="card-body">');
	res.push(`<h5 class="card-title">${header}</h5>`);
	res.push(`<p class="card-text">${content}</p>`);
	if (footer !== undefined) {
		res.push(`<p class="card-text"><small class="text-muted">footer</small></p>`)
	}
	res.push('</div>');
	res.push('</div>');
	return res.join("");
}

$(function(){
	for (let card of cards) {
		let e = make_card(card.header, card.body, card.footer);
		$("#card-container").append(e);
	}
})