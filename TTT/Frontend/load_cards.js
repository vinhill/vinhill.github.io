function make_card(idx, header, image=undefined, body=undefined, text=undefined, footer=undefined) {
	/*
	Creates html code for a bootstrap card with the specified content. Only the header is mandatory.
	
	Attributes
	----------
	idx: string
		random identifier for this card
	header: string
		Text that forms the heading of this card
	image: string
		Path relative to the index.html refering to an image
	body: string
		HTML code that will be placed in the cards body
	text: string
		Text that will be placed within the cards body
	footer: string
		Text that will be placed in the footer
	*/
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
	/*
	JQuery function that listens on document DOMContentLoaded i.e. executes when webpage is ready.
	The cards list from cards.js is converted into html card code and inserted into the websites body.
	*/
	let i = 0;
	for (let card of cards) {
		let e = make_card(`collapsables-idx${i}`, card.header, card.image, card.body, card.text, card.footer);
		$("#card-container").append(e);
		i++;
	}
	
	// TODO at the end, add a special card providing the option to send custom sql queries using sql.js
	// See https://github.com/sql-js/sql.js/
})