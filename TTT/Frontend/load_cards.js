function make_card(idx, header, image=undefined, body=undefined, text=undefined, footer=undefined) {
	let res = [];
	res.push('<div class="card">');
	// image
	if (image !== undefined) {
		res.push(`<img class="card-img-top collapse show multi-collapse ${idx}" src=image alt="Card image cap">`);
	}
	//header
	res.push(`<h5 class="card-header" data-toggle="collapse" data-target=".${idx}">${header}</h5>`);
	// content part
	res.push(`<div class="card-body collapse show ${idx}">`);
	if (body !== undefined) {
		res.push(body);
	}
	if (text !== undefined) {
		res.push(`<p class="card-text">${text}</p>`);
	}
	if (footer !== undefined) {
		res.push(`<p class="card-text"><small class="text-muted">footer</small></p>`)
	}
	res.push('</div>');
	res.push('</div>')
	return res.join("");
}

$(function(){
	let i = 0;
	for (let card of cards) {
		let e = make_card(`collapsables-idx${i}`, card.header, card.image, card.body, card.text, card.footer);
		$("#card-container").append(e);
		i++;
	}
	
	// TODO add sql query card via sql.js
})